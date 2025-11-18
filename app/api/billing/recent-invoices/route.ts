import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Get limit from query params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch recent invoices with customer names using v_invoice_summary for accurate status
    const { data: invoices, error } = await supabase
      .from('v_invoice_summary')
      .select(`
        invoice_id,
        invoice_number,
        customer_id,
        computed_status,
        due_date,
        total_amount,
        total_paid,
        created_at
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent invoices:', error)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // Get customer names for the invoices
    const customerIds = [...new Set(invoices?.map(inv => inv.customer_id) || [])]
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)

    const customerMap = new Map(customers?.map(c => [c.id, c.name]) || [])

    // Format response
    const formattedInvoices = invoices?.map(invoice => ({
      id: invoice.invoice_id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: customerMap.get(invoice.customer_id) || 'Unknown',
      status: invoice.computed_status,
      due_date: invoice.due_date,
      total: Number(invoice.total_amount) || 0,
      paid_amount: Number(invoice.total_paid) || 0,
      created_at: invoice.created_at,
    })) || []

    return NextResponse.json({ invoices: formattedInvoices })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
