import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Fetch invoice with customer and company info
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers (
          name,
          email,
          phone,
          billing_address,
          billing_address_line_2,
          billing_city,
          billing_state,
          billing_zipcode,
          billing_country
        )
      `)
      .eq('id', invoiceId)
      .in('company_id', companyIds)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch invoice lines with job information
    const { data: lines, error: linesError } = await supabase
      .from('invoice_lines')
      .select(`
        *,
        jobs (
          id,
          title
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('line_number', { ascending: true })

    if (linesError) {
      console.error('Error fetching invoice lines:', linesError)
      return NextResponse.json({ error: 'Failed to fetch invoice lines' }, { status: 500 })
    }

    // Fetch company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', invoice.company_id)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
    }

    // Fetch payment applications with payment details
    const { data: applications, error: appsError } = await supabase
      .from('payment_applications')
      .select(`
        applied_amount,
        applied_at,
        payments (
          payment_date,
          payment_method,
          memo,
          is_deposit,
          deposit_type
        )
      `)
      .eq('invoice_id', invoiceId)
      .order('applied_at', { ascending: true })

    if (appsError) {
      console.error('Error fetching payment applications:', appsError)
    }

    // Separate deposits and payments based on the is_deposit flag from the payment
    const deposits = applications?.filter(app => {
      const payment = app.payments as any
      return payment?.is_deposit === true
    }) || []

    const payments = applications?.filter(app => {
      const payment = app.payments as any
      return payment?.is_deposit !== true
    }) || []

    const totalDeposits = deposits.reduce((sum, app) => sum + Number(app.applied_amount), 0)
    const totalPayments = payments.reduce((sum, app) => sum + Number(app.applied_amount), 0)

    return NextResponse.json({
      invoice: {
        ...invoice,
        total_paid: totalPayments,
        total_deposits: totalDeposits,
      },
      lines: lines || [],
      company: company || null,
      deposit_applications: deposits,
      payment_applications: payments,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
