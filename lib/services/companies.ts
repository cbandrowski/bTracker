import { SupabaseServerClient } from '@/lib/supabaseServer'
import { Company } from '@/types/database'

type PaymentPreferenceFields = Pick<
  Company,
  | 'paypal_handle'
  | 'zelle_phone'
  | 'zelle_email'
  | 'check_payable_to'
  | 'accept_cash'
  | 'accept_credit_debit'
  | 'late_fee_enabled'
  | 'late_fee_days'
  | 'late_fee_amount'
>

export type PaymentPreferencesUpdate = Partial<PaymentPreferenceFields>

type PaymentPreferencesPayload = Partial<PaymentPreferenceFields> & { updated_at: string }

export async function updateCompanyPaymentPreferences(
  supabase: SupabaseServerClient,
  companyId: string,
  updates: PaymentPreferencesUpdate
): Promise<Company> {
  const payload: PaymentPreferencesPayload = { updated_at: new Date().toISOString() }

  if (typeof updates.paypal_handle !== 'undefined') {
    payload.paypal_handle = updates.paypal_handle
  }
  if (typeof updates.zelle_phone !== 'undefined') {
    payload.zelle_phone = updates.zelle_phone
  }
  if (typeof updates.zelle_email !== 'undefined') {
    payload.zelle_email = updates.zelle_email
  }
  if (typeof updates.check_payable_to !== 'undefined') {
    payload.check_payable_to = updates.check_payable_to
  }
  if (typeof updates.accept_cash !== 'undefined') {
    payload.accept_cash = updates.accept_cash
  }
  if (typeof updates.accept_credit_debit !== 'undefined') {
    payload.accept_credit_debit = updates.accept_credit_debit
  }
  if (typeof updates.late_fee_enabled !== 'undefined') {
    payload.late_fee_enabled = updates.late_fee_enabled
  }
  if (typeof updates.late_fee_days !== 'undefined') {
    payload.late_fee_days = updates.late_fee_days
  }
  if (typeof updates.late_fee_amount !== 'undefined') {
    payload.late_fee_amount = updates.late_fee_amount
  }

  const { data, error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', companyId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update payment preferences: ${error?.message || 'Unknown error'}`)
  }

  return data as Company
}
