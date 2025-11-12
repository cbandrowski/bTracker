import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Get customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .in('company_id', companyIds)

    if (customersError) {
      console.error('Error fetching customers:', customersError)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    // Get billed balance for each customer from view
    const { data: balances, error: balancesError } = await supabase
      .from('v_customer_billed_balance')
      .select('customer_id, billed_balance, unapplied_credit')
      .in('company_id', companyIds)

    if (balancesError) {
      console.error('Error fetching balances:', balancesError)
      return NextResponse.json({ error: 'Failed to fetch balances' }, { status: 500 })
    }

    // Get open invoices count per customer
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('customer_id, status, total, paid_amount')
      .in('company_id', companyIds)
      .not('status', 'in', '(void,cancelled,paid)')

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError)
    }

    // Group open invoices by customer
    const openInvoicesByCustomer: Record<string, number> = {}
    invoices?.forEach(invoice => {
      const balance = invoice.total - invoice.paid_amount
      if (balance > 0) {
        openInvoicesByCustomer[invoice.customer_id] =
          (openInvoicesByCustomer[invoice.customer_id] || 0) + 1
      }
    })

    // Combine data
    const customersWithBalance = customers?.map(customer => {
      const balance = balances?.find(b => b.customer_id === customer.id)
      const billedBalance = Number(balance?.billed_balance || 0)
      const unappliedCredit = Number(balance?.unapplied_credit || 0)

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        billedBalance,
        unappliedCredit,
        openInvoices: openInvoicesByCustomer[customer.id] || 0,
      }
    }) || []

    // Filter to only customers with outstanding balance and sort by balance desc
    const customersWithOutstanding = customersWithBalance
      .filter(c => c.billedBalance > 0)
      .sort((a, b) => b.billedBalance - a.billedBalance)

    return NextResponse.json({ customers: customersWithOutstanding })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
