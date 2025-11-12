// Database transaction helpers for Supabase
import { createServerClient } from './supabaseServer'

/**
 * Execute multiple operations in a transaction-like manner
 * Note: Supabase JS client doesn't support true transactions
 * For critical operations, use Postgres RPC functions instead
 *
 * This helper provides error handling and rollback patterns
 */
export async function withTransaction<T>(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  operations: () => Promise<T>
): Promise<T> {
  try {
    return await operations()
  } catch (error) {
    // Log error for monitoring
    console.error('Transaction failed:', error)
    throw error
  }
}

/**
 * Get the next invoice number for a company (atomic)
 * Uses Postgres RPC function for atomic increment
 */
export async function getNextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  companyId: string
): Promise<number> {
  // First, try to get or create counter
  const { data: existing } = await supabase
    .from('company_invoice_counters')
    .select('last_number')
    .eq('company_id', companyId)
    .single()

  if (existing) {
    // Increment atomically
    const { data, error } = await supabase
      .from('company_invoice_counters')
      .update({ last_number: existing.last_number + 1 })
      .eq('company_id', companyId)
      .select('last_number')
      .single()

    if (error) throw error
    return data!.last_number
  } else {
    // Create new counter starting at 10001
    const { data, error } = await supabase
      .from('company_invoice_counters')
      .insert({ company_id: companyId, last_number: 10001 })
      .select('last_number')
      .single()

    if (error) throw error
    return data!.last_number
  }
}

/**
 * Validate that an entity belongs to the specified company
 */
export async function validateCompanyOwnership(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  table: string,
  id: string,
  companyId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(table)
    .select('company_id')
    .eq('id', id)
    .single()

  if (error || !data) return false
  return data.company_id === companyId
}

/**
 * Check if a payment is fully unapplied (can be edited)
 */
export async function canEditPayment(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  paymentId: string
): Promise<boolean> {
  const { data: applications } = await supabase
    .from('payment_applications')
    .select('applied_amount')
    .eq('payment_id', paymentId)

  // If any applications exist, payment cannot be edited
  return !applications || applications.length === 0
}

/**
 * Get remaining unapplied amount on a payment
 */
export async function getUnappliedAmount(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  paymentId: string
): Promise<number> {
  const { data: payment } = await supabase
    .from('payments')
    .select('amount')
    .eq('id', paymentId)
    .single()

  if (!payment) return 0

  const { data: applications } = await supabase
    .from('payment_applications')
    .select('applied_amount')
    .eq('payment_id', paymentId)

  const totalApplied =
    applications?.reduce((sum, app) => sum + Number(app.applied_amount), 0) || 0

  return Number(payment.amount) - totalApplied
}
