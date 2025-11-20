/**
 * GET /api/customers/[id]/billing-header - Get billing summary for customer header
 *
 * Preconditions:
 * - User must be authenticated
 * - Customer must belong to user's company
 *
 * Postconditions:
 * - Returns billedBalance (total invoices - total payments globally)
 * - Returns unappliedCredit (sum of unapplied payments/deposits)
 * - Returns count of open invoices
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { validateCompanyOwnership } from '@/lib/transactions'

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

    // Get billed balance from view
    const { data: balanceData, error: balanceError } = await supabase
      .from('v_customer_billed_balance')
      .select('billed_balance, unapplied_credit, total_invoiced, total_payments')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .single()

    if (balanceError) {
      // If no data, customer has no transactions yet
      if (balanceError.code === 'PGRST116') {
        return NextResponse.json({
          billedBalance: 0,
          unappliedCredit: 0,
          openInvoices: 0,
        })
      }
      console.error('Error fetching balance:', balanceError)
      return NextResponse.json({ error: balanceError.message }, { status: 500 })
    }

    // Count open invoices - use v_invoice_summary to check balance_due instead of status
    // An invoice is "open" if it has a balance due > 0 and is not void/cancelled/draft
    const { data: invoices, error: invoicesError } = await supabase
      .from('v_invoice_summary')
      .select('balance_due, invoice_status')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .not('invoice_status', 'in', '(void,cancelled,draft)')

    if (invoicesError) {
      console.error('Error counting invoices:', invoicesError)
    }

    // Count invoices with outstanding balance
    const openInvoicesCount = invoices?.filter(inv => Number(inv.balance_due) > 0).length || 0

    return NextResponse.json({
      billedBalance: Number(balanceData?.billed_balance || 0),
      unappliedCredit: Number(balanceData?.unapplied_credit || 0),
      openInvoices: openInvoicesCount,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
