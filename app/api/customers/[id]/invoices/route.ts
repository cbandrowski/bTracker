import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

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

    // Verify customer belongs to user's company
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .in('company_id', companyIds)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Fetch invoices from v_invoice_summary to get correct balances
    const { data: invoices, error } = await supabase
      .from('v_invoice_summary')
      .select('invoice_id, invoice_number, invoice_status, due_date, total_amount, deposit_applied, total_paid, balance_due, created_at')
      .eq('customer_id', customerId)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invoices:', error)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // Map to match expected interface
    const mappedInvoices = invoices?.map(inv => ({
      id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      status: inv.invoice_status,
      due_date: inv.due_date,
      total_amount: inv.total_amount,
      deposit_applied: inv.deposit_applied,
      total_paid: inv.total_paid,
      balance_due: inv.balance_due,
      created_at: inv.created_at,
    })) || []

    return NextResponse.json({ invoices: mappedInvoices })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
