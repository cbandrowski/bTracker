/**
 * POST /api/payments - Create a new payment or deposit (unapplied)
 * GET /api/payments - List all payments with filters
 *
 * Preconditions:
 * - User must be authenticated
 * - Customer must belong to user's company
 * - Optional job must belong to same customer and company
 *
 * Postconditions:
 * - Payment created with unapplied status
 * - Customer unapplied credit updated
 * - Idempotent on POST (same key = same response)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { CreatePaymentSchema, PaymentsIndexQuerySchema } from '@/lib/schemas/billing'
import { validateCompanyOwnership } from '@/lib/transactions'
import { checkIdempotency, getIdempotencyKey, storeIdempotency } from '@/lib/idempotency'
import { ZodError } from 'zod'

// ============================================================================
// POST /api/payments - Create payment/deposit
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }
    const companyId = companyIds[0]

    // Check idempotency
    const idempotencyKey = getIdempotencyKey(request.headers)
    if (idempotencyKey) {
      const cached = await checkIdempotency(
        supabase,
        user.id,
        companyId,
        idempotencyKey,
        '/api/payments'
      )
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status })
      }
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = CreatePaymentSchema.parse(body)

    // Validate customer belongs to company
    const customerValid = await validateCompanyOwnership(
      supabase,
      'customers',
      validated.customerId,
      companyId
    )
    if (!customerValid) {
      return NextResponse.json(
        { error: 'Customer not found or unauthorized' },
        { status: 403 }
      )
    }

    // Validate job belongs to customer and company (if provided)
    if (validated.jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('customer_id, company_id')
        .eq('id', validated.jobId)
        .single()

      if (!job || job.company_id !== companyId || job.customer_id !== validated.customerId) {
        return NextResponse.json(
          { error: 'Job not found or does not belong to this customer' },
          { status: 403 }
        )
      }
    }

    // Determine if this is a deposit
    const isDeposit = !!validated.depositType

    // Create payment
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        customer_id: validated.customerId,
        job_id: validated.jobId || null,
        amount: validated.amount,
        payment_method: validated.method,
        is_deposit: isDeposit,
        deposit_type: validated.depositType || null,
        memo: validated.memo || null,
        payment_date: new Date().toISOString().split('T')[0],
        created_by: user.id,
      })
      .select('id, amount')
      .single()

    if (error) {
      console.error('Error creating payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const response = {
      paymentId: payment.id,
      unappliedCredit: payment.amount,
    }

    // Store idempotency record
    if (idempotencyKey) {
      await storeIdempotency(supabase, user.id, companyId, idempotencyKey, '/api/payments', 201, response)
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================================
// GET /api/payments - List payments with filters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json([])
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    const filters = PaymentsIndexQuerySchema.parse(queryParams)

    // Build query
    let query = supabase
      .from('payments')
      .select(
        `
        id,
        payment_date,
        amount,
        payment_method,
        is_deposit,
        deposit_type,
        memo,
        customer_id,
        job_id
      `
      )
      .in('company_id', companyIds)

    // Apply filters
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.from) {
      query = query.gte('payment_date', filters.from)
    }

    if (filters.to) {
      query = query.lte('payment_date', filters.to)
    }

    if (filters.depositType) {
      query = query.eq('deposit_type', filters.depositType)
    }

    query = query.order('payment_date', { ascending: false })

    const { data: payments, error } = await query

    if (error) {
      console.error('Error fetching payments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get application amounts for each payment
    const paymentsWithApplications = await Promise.all(
      (payments || []).map(async (payment) => {
        const { data: applications } = await supabase
          .from('payment_applications')
          .select('applied_amount')
          .eq('payment_id', payment.id)

        const appliedAmount =
          applications?.reduce((sum, app) => sum + Number(app.applied_amount), 0) || 0

        return {
          paymentId: payment.id,
          date: payment.payment_date,
          amount: Number(payment.amount),
          depositType: payment.deposit_type,
          appliedAmount,
          unappliedAmount: Number(payment.amount) - appliedAmount,
          jobId: payment.job_id,
          customerId: payment.customer_id,
        }
      })
    )

    // Apply "applied" filter if specified
    const filteredPayments = filters.applied !== undefined
      ? paymentsWithApplications.filter((p) =>
          filters.applied ? p.appliedAmount > 0 : p.unappliedAmount > 0
        )
      : paymentsWithApplications

    return NextResponse.json({
      items: filteredPayments,
      total: filteredPayments.length,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
