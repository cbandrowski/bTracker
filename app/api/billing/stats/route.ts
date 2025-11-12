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

    // Use v_invoice_summary which has correct balance calculations including deposits
    const { data: invoices, error: invoicesError } = await supabase
      .from('v_invoice_summary')
      .select('invoice_status, total_amount, balance_due, due_date, deposit_applied, total_paid')
      .in('company_id', companyIds)

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // Get total payments and deposits collected
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .in('company_id', companyIds)

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
    }

    // Get all applied amounts from payment_applications table (join with payments to filter by company)
    const { data: applications, error: applicationsError } = await supabase
      .from('payment_applications')
      .select(`
        applied_amount,
        payments!inner(company_id)
      `)
      .in('payments.company_id', companyIds)

    if (applicationsError) {
      console.error('Error fetching payment applications:', applicationsError)
    }

    const totalPayments = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const totalApplied = applications?.reduce((sum, a) => sum + Number(a.applied_amount), 0) || 0
    const totalUnappliedCredit = totalPayments - totalApplied

    // Calculate stats
    const now = new Date()
    let totalRevenue = 0
    let totalOutstanding = 0
    let openInvoicesCount = 0
    let overdueInvoicesCount = 0

    invoices?.forEach(invoice => {
      const balance = Number(invoice.balance_due) || 0
      const depositsApplied = Number(invoice.deposit_applied) || 0
      const paymentsApplied = Number(invoice.total_paid) || 0

      // Total revenue is all money collected (deposits + payments applied to invoices)
      totalRevenue += depositsApplied + paymentsApplied

      // Outstanding balance from non-void/cancelled/draft invoices
      if (!['void', 'cancelled', 'draft'].includes(invoice.invoice_status)) {
        totalOutstanding += balance

        // Count open invoices (invoices with remaining balance)
        if (balance > 0) {
          openInvoicesCount++

          // Count overdue invoices
          if (invoice.due_date && new Date(invoice.due_date) < now) {
            overdueInvoicesCount++
          }
        }
      }
    })

    return NextResponse.json({
      totalRevenue,
      totalOutstanding,
      totalUnappliedCredit,
      openInvoicesCount,
      overdueInvoicesCount,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
