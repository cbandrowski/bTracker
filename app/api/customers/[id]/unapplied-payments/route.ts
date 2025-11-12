/**
 * GET /api/customers/[id]/unapplied-payments - Get unapplied payments/deposits for a customer
 *
 * Query params:
 * - depositType: filter by deposit type (general|parts|supplies)
 *
 * Preconditions:
 * - User must be authenticated
 * - Customer must belong to user's company
 *
 * Postconditions:
 * - Returns list of unapplied payments with amounts
 * - Returns total unapplied credit
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { validateCompanyOwnership } from '@/lib/transactions'
import { UnappliedPaymentsQuerySchema } from '@/lib/schemas/billing'
import { ZodError } from 'zod'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
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

    // Validate customer belongs to company
    const customerValid = await validateCompanyOwnership(
      supabase,
      'customers',
      customerId,
      companyId
    )
    if (!customerValid) {
      return NextResponse.json(
        { error: 'Customer not found or unauthorized' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    const filters = UnappliedPaymentsQuerySchema.parse(queryParams)

    // Query from v_customer_unapplied_payments view
    let query = supabase
      .from('v_customer_unapplied_payments')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .eq('has_unapplied_credit', true)

    // Apply deposit type filter
    if (filters.depositType) {
      query = query.eq('deposit_type', filters.depositType)
    }

    query = query.order('payment_date', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Error fetching unapplied payments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to API response format
    const items = (data || []).map((p: any) => ({
      paymentId: p.payment_id,
      date: p.payment_date,
      amount: Number(p.payment_amount),
      depositType: p.deposit_type,
      memo: p.memo,
      unappliedAmount: Number(p.unapplied_amount),
    }))

    const totalUnappliedCredit = items.reduce(
      (sum, item) => sum + item.unappliedAmount,
      0
    )

    return NextResponse.json({
      items,
      unappliedCredit: totalUnappliedCredit,
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
