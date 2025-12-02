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
  billing_address: string | null
  billing_address_line_2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zipcode: string | null
  billing_country: string | null
  service_address: string | null
  service_address_line_2: string | null
  service_city: string | null
  service_state: string | null
  service_zipcode: string | null
  service_country: string | null
  same_as_billing: boolean | null
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

  // Fetch customers with full address information
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select(`
      id,
      name,
      email,
      phone,
      billing_address,
      billing_address_line_2,
      billing_city,
      billing_state,
      billing_zipcode,
      billing_country,
      service_address,
      service_address_line_2,
      service_city,
      service_state,
      service_zipcode,
      service_country,
      same_as_billing,
      created_at
    `)
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

  // Count open invoices - use v_invoice_summary to check balance_due instead of status
  // An invoice is "open" if it has a balance due > 0 and is not void/cancelled/draft
  const { data: invoices } = await supabase
    .from('v_invoice_summary')
    .select('balance_due, invoice_status')
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .not('invoice_status', 'in', '(void,cancelled,draft)')

  // Count invoices with outstanding balance
  const openInvoicesCount = invoices?.filter(inv => Number(inv.balance_due) > 0).length || 0

  return {
    billedBalance: Number(balanceData?.billed_balance || 0),
    unappliedCredit: Number(balanceData?.unapplied_credit || 0),
    openInvoices: openInvoicesCount,
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
