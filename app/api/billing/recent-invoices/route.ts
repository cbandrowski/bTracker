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

    // Fetch recent invoices with customer names
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        customer_id,
        status,
        due_date,
        total_amount,
        created_at,
        customers (
          name
        )
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent invoices:', error)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // Format response
    const formattedInvoices = invoices?.map(invoice => ({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: (invoice.customers as any)?.name || 'Unknown',
      status: invoice.status,
      due_date: invoice.due_date,
      total: Number(invoice.total_amount) || 0,
      created_at: invoice.created_at,
    })) || []

    return NextResponse.json({ invoices: formattedInvoices })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
