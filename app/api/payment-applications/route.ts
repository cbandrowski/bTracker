/**
 * POST /api/payment-applications - Create payment and apply to an invoice
 *
 * Two modes:
 * 1. Apply existing payment: provide paymentId, invoiceId, amount
 * 2. Create new payment and apply: provide customerId, invoiceId, amount, method, memo
 *
 * Preconditions:
 * - User must be authenticated
 * - Invoice must belong to user's company and customer
 * - Amount must not exceed invoice balance due
 *
 * Postconditions:
 * - payment created (if new)
 * - payment_application created
 * - Returns payment and application details
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { CreatePaymentApplicationSchema } from '@/lib/schemas/billing'
import { getUnappliedAmount } from '@/lib/transactions'
import { ZodError } from 'zod'

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

    // Parse request body
    const body = await request.json()
    const { paymentId, customerId, invoiceId, amount, method, memo } = body

    // Validate required fields
    if (!invoiceId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invoice ID and valid amount are required' },
        { status: 400 }
      )
    }

    // Determine if creating new payment or using existing
    const isNewPayment = !paymentId && customerId

    if (!isNewPayment && !paymentId) {
      return NextResponse.json(
        { error: 'Either paymentId or customerId must be provided' },
        { status: 400 }
      )
    }

    // Validate invoice belongs to company
    const { data: invoice } = await supabase
      .from('invoices')
      .select('company_id, customer_id')
      .eq('id', invoiceId)
      .single()

    if (!invoice || invoice.company_id !== companyId) {
      return NextResponse.json(
        { error: 'Invoice not found or unauthorized' },
        { status: 403 }
      )
    }

    // Check invoice has enough balance due
    const { data: invoiceSummary } = await supabase
      .from('v_invoice_summary')
      .select('balance_due')
      .eq('invoice_id', invoiceId)
      .single()

    const balanceDue = Number(invoiceSummary?.balance_due || 0)
    if (balanceDue < amount) {
      return NextResponse.json(
        {
          error: `Invoice only has balance of ${balanceDue}, cannot apply ${amount}`,
        },
        { status: 400 }
      )
    }

    let finalPaymentId = paymentId

    // Create new payment if needed
    if (isNewPayment) {
      if (!method) {
        return NextResponse.json(
          { error: 'Payment method is required when creating new payment' },
          { status: 400 }
        )
      }

      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: companyId,
          customer_id: customerId,
          amount: amount,
          payment_method: method,
          memo: memo || null,
          payment_date: new Date().toISOString().split('T')[0],
          is_deposit: false,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (paymentError) {
        console.error('Error creating payment:', paymentError)
        return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
      }

      finalPaymentId = newPayment.id
    } else {
      // Validate existing payment
      const { data: payment } = await supabase
        .from('payments')
        .select('company_id, customer_id, amount')
        .eq('id', paymentId)
        .single()

      if (!payment || payment.company_id !== companyId) {
        return NextResponse.json(
          { error: 'Payment not found or unauthorized' },
          { status: 403 }
        )
      }

      if (payment.customer_id !== invoice.customer_id) {
        return NextResponse.json(
          { error: 'Payment and invoice belong to different customers' },
          { status: 400 }
        )
      }

      // Check payment has enough unapplied balance
      const unappliedPayment = await getUnappliedAmount(supabase, paymentId)
      if (unappliedPayment < amount) {
        return NextResponse.json(
          {
            error: `Payment only has ${unappliedPayment} unapplied, cannot apply ${amount}`,
          },
          { status: 400 }
        )
      }
    }

    // Create payment application
    const { data: application, error } = await supabase
      .from('payment_applications')
      .insert({
        payment_id: finalPaymentId,
        invoice_id: invoiceId,
        applied_amount: amount,
        applied_at: new Date().toISOString(),
        applied_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating payment application:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get updated balance
    const { data: updatedSummary } = await supabase
      .from('v_invoice_summary')
      .select('balance_due')
      .eq('invoice_id', invoiceId)
      .single()

    return NextResponse.json({
      paymentApplicationId: application.id,
      paymentId: finalPaymentId,
      remainingBalance: Number(updatedSummary?.balance_due || 0),
    }, { status: 201 })
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
