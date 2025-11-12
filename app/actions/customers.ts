'use server'

/**
 * Server actions for customer operations
 * Provides efficient batch fetching of customer billing data
 */

import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export interface CustomerWithBilling {
  id: string
  name: string
  email: string | null
  phone: string | null
  billing_city: string | null
  billing_state: string | null
  billedBalance: number
  unappliedCredit: number
  openInvoices: number
  created_at: string
}

/**
 * Get all customers with their billing information
 * Efficiently fetches in parallel to avoid N+1 queries
 */
export async function getCustomersWithBilling(): Promise<CustomerWithBilling[]> {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    return []
  }

  const companyIds = await getUserCompanyIds(supabase, user.id)
  if (companyIds.length === 0) {
    return []
  }

  // Fetch customers
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, name, email, phone, billing_city, billing_state, created_at')
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })

  if (customersError || !customers) {
    console.error('Error fetching customers:', customersError)
    return []
  }

  // Batch fetch billing data in parallel
  const customersWithBilling = await Promise.all(
    customers.map(async (customer) => {
      const billingData = await getCustomerBillingHeader(customer.id)

      return {
        ...customer,
        billedBalance: billingData.billedBalance,
        unappliedCredit: billingData.unappliedCredit,
        openInvoices: billingData.openInvoices,
      }
    })
  )

  return customersWithBilling
}

/**
 * Get billing header for a single customer
 */
export async function getCustomerBillingHeader(customerId: string) {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    return { billedBalance: 0, unappliedCredit: 0, openInvoices: 0 }
  }

  const companyIds = await getUserCompanyIds(supabase, user.id)

  // Get billed balance from view
  const { data: balanceData } = await supabase
    .from('v_customer_billed_balance')
    .select('billed_balance, unapplied_credit')
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .single()

  // Count open invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id')
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .not('status', 'in', '(void,cancelled,paid)')

  return {
    billedBalance: Number(balanceData?.billed_balance || 0),
    unappliedCredit: Number(balanceData?.unapplied_credit || 0),
    openInvoices: invoices?.length || 0,
  }
}

/**
 * Get count of unpaid done jobs for a customer
 */
export async function getUnpaidJobsCount(customerId: string): Promise<number> {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    return 0
  }

  const companyIds = await getUserCompanyIds(supabase, user.id)

  // Get done jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .eq('status', 'done')

  if (!jobs) return 0

  // Filter out invoiced jobs
  let unpaidCount = 0
  for (const job of jobs) {
    const { data: invoiceLines } = await supabase
      .from('invoice_lines')
      .select('id')
      .eq('job_id', job.id)
      .limit(1)

    if (!invoiceLines || invoiceLines.length === 0) {
      unpaidCount++
    }
  }

  return unpaidCount
}
