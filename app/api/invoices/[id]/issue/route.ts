/**
 * POST /api/invoices/[id]/issue - Issue a draft invoice
 *
 * Preconditions:
 * - User must be authenticated
 * - Invoice must belong to user's company
 * - Invoice must be in 'draft' status
 *
 * Postconditions:
 * - Invoice status changed to 'issued'
 * - issued_at timestamp set
 * - due_date set based on terms or provided date
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { IssueInvoiceSchema } from '@/lib/schemas/billing'
import { validateCompanyOwnership } from '@/lib/transactions'
import { ZodError } from 'zod'

export async function POST(
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
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }
    const companyId = companyIds[0]

    // Validate invoice belongs to company
    const invoiceValid = await validateCompanyOwnership(
      supabase,
      'invoices',
      invoiceId,
      companyId
    )
    if (!invoiceValid) {
      return NextResponse.json(
        { error: 'Invoice not found or unauthorized' },
        { status: 403 }
      )
    }

    // Check invoice is in draft status
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('status, invoice_number')
      .eq('id', invoiceId)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: `Invoice is already ${invoice.status}, cannot issue` },
        { status: 400 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = IssueInvoiceSchema.parse(body)

    // Update invoice
    const issueDate = new Date().toISOString().split('T')[0]

    const { data: updated, error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'issued',
        issued_at: new Date().toISOString(),
        due_date: validated.dueDate,
        terms: validated.terms || null,
      })
      .eq('id', invoiceId)
      .select('id, invoice_number, status, due_date')
      .single()

    if (updateError) {
      console.error('Error issuing invoice:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      invoiceId: updated.id,
      invoiceNumber: updated.invoice_number,
      status: updated.status,
      issueDate,
      dueDate: updated.due_date,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
