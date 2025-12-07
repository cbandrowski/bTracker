import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { PaymentPreferencesUpdate, updateCompanyPaymentPreferences } from '@/lib/services/companies'

const paymentPreferencesSchema = z.object({
  paypal_handle: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().trim().max(100).nullable().optional()
  ).refine(
    (val) => !val || !val.includes('@'),
    { message: 'PayPal handle should not include @ symbol' }
  ),
  zelle_phone: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().trim().nullable().optional()
  ),
  zelle_email: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().trim().email().nullable().optional()
  ),
  check_payable_to: z.preprocess(
    (val) => (val === '' ? null : val),
    z.string().trim().nullable().optional()
  ),
  accept_cash: z.boolean().optional(),
  accept_credit_debit: z.boolean().optional(),
  late_fee_enabled: z.boolean().optional(),
  late_fee_days: z.preprocess(
    (val) => {
      if (val === '' || val === null || typeof val === 'undefined') return undefined
      return typeof val === 'string' ? Number(val) : val
    },
    z.number().int().positive().max(365).optional()
  ),
  late_fee_amount: z.preprocess(
    (val) => {
      if (val === '' || val === null || typeof val === 'undefined') return undefined
      return typeof val === 'string' ? Number(val) : val
    },
    z.number().min(0).optional()
  ),
})

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = companyIds[0]
    const body = await request.json()
    const validated = paymentPreferencesSchema.parse(body)

    const updates: PaymentPreferencesUpdate = {}

    if (typeof validated.paypal_handle !== 'undefined') {
      updates.paypal_handle = validated.paypal_handle
    }
    if (typeof validated.zelle_phone !== 'undefined') {
      updates.zelle_phone = validated.zelle_phone
    }
    if (typeof validated.zelle_email !== 'undefined') {
      updates.zelle_email = validated.zelle_email
    }
    if (typeof validated.check_payable_to !== 'undefined') {
      updates.check_payable_to = validated.check_payable_to
    }
    if (typeof validated.accept_cash !== 'undefined') {
      updates.accept_cash = validated.accept_cash
    }
    if (typeof validated.accept_credit_debit !== 'undefined') {
      updates.accept_credit_debit = validated.accept_credit_debit
    }
    if (typeof validated.late_fee_enabled !== 'undefined') {
      updates.late_fee_enabled = validated.late_fee_enabled
    }
    if (typeof validated.late_fee_days !== 'undefined') {
      updates.late_fee_days = validated.late_fee_days
    }
    if (typeof validated.late_fee_amount !== 'undefined') {
      updates.late_fee_amount = validated.late_fee_amount
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const company = await updateCompanyPaymentPreferences(supabase, companyId, updates)

    return NextResponse.json({
      message: 'Payment preferences updated successfully',
      company,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
