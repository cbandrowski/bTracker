/**
 * PATCH /api/payments/[id] - Edit a payment/deposit (only if unapplied)
 *
 * Preconditions:
 * - User must be authenticated
 * - Payment must belong to user's company
 * - Payment must be fully unapplied (no applications)
 *
 * Postconditions:
 * - Payment amount, depositType, or memo updated
 * - Customer unapplied credit recalculated
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { EditPaymentSchema } from '@/lib/schemas/billing'
import { canEditPayment, validateCompanyOwnership } from '@/lib/transactions'
import { ZodError } from 'zod'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Validate payment belongs to company
    const paymentValid = await validateCompanyOwnership(supabase, 'payments', id, companyId)
    if (!paymentValid) {
      return NextResponse.json(
        { error: 'Payment not found or unauthorized' },
        { status: 403 }
      )
    }

    // Check if payment can be edited (must be unapplied)
    const editable = await canEditPayment(supabase, id)
    if (!editable) {
      return NextResponse.json(
        {
          error: 'Cannot edit payment that has been applied to invoices',
          hint: 'Remove all applications first',
        },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = EditPaymentSchema.parse(body)

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (validated.amount !== undefined) {
      updateData.amount = validated.amount
    }

    if (validated.depositType !== undefined) {
      updateData.deposit_type = validated.depositType
      updateData.is_deposit = true
    }

    if (validated.memo !== undefined) {
      updateData.memo = validated.memo
    }

    // Update payment
    const { data: payment, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', id)
      .select('id')
      .single()

    if (error) {
      console.error('Error updating payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      paymentId: payment.id,
      updated: true,
    })
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
