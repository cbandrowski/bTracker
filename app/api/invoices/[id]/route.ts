import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { UpdateInvoiceSchema } from '@/lib/schemas/billing'
import { deleteInvoice, updateInvoice } from '@/lib/services/invoices'
import { ZodError } from 'zod'

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

    // Fetch invoice with computed status from v_invoice_summary
    const { data: invoiceSummary, error: summaryError } = await supabase
      .from('v_invoice_summary')
      .select(`
        invoice_id,
        company_id,
        customer_id,
        invoice_number,
        invoice_date,
        due_date,
        invoice_status,
        computed_status,
        total_amount,
        total_paid,
        balance_due,
        notes,
        terms,
        issued_at,
        paid_at,
        voided_at,
        created_at,
        updated_at
      `)
      .eq('invoice_id', invoiceId)
      .in('company_id', companyIds)
      .single()

    if (summaryError || !invoiceSummary) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Fetch customer info separately
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        name,
        email,
        phone,
        billing_address,
        billing_address_line_2,
        billing_city,
        billing_state,
        billing_zipcode,
        billing_country
      `)
      .eq('id', invoiceSummary.customer_id)
      .single()

    if (customerError) {
      console.error('Error fetching customer:', customerError)
    }

    // Construct invoice object with computed status
    const invoice = {
      id: invoiceSummary.invoice_id,
      company_id: invoiceSummary.company_id,
      customer_id: invoiceSummary.customer_id,
      invoice_number: invoiceSummary.invoice_number,
      invoice_date: invoiceSummary.invoice_date,
      due_date: invoiceSummary.due_date,
      status: invoiceSummary.computed_status, // Use computed status
      total_amount: invoiceSummary.total_amount,
      notes: invoiceSummary.notes,
      terms: invoiceSummary.terms,
      issued_at: invoiceSummary.issued_at,
      paid_at: invoiceSummary.paid_at,
      voided_at: invoiceSummary.voided_at,
      created_at: invoiceSummary.created_at,
      updated_at: invoiceSummary.updated_at,
      customers: customer,
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

export async function PATCH(
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
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const body = await request.json()
    const validated = UpdateInvoiceSchema.parse(body)

    const updated = await updateInvoice(supabase, invoiceId, companyIds, user.id, validated)
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Error updating invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const result = await deleteInvoice(supabase, invoiceId, companyIds, user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
