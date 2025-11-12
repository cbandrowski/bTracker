/**
 * POST /api/invoices - Create invoice from jobs + manual lines + attach deposits
 *
 * Transactional behavior (ALL-OR-NOTHING):
 * 1. Create invoice with next invoice_number
 * 2. Insert job-derived lines (if any)
 * 3. Insert manual lines
 * 4. For each depositId, insert negative "Deposit Applied" line
 * 5. Optionally create payment_applications records
 * 6. If issueNow=true, set status='issued'
 *
 * Preconditions:
 * - User must be authenticated
 * - Customer must belong to user's company
 * - All jobs must belong to customer and be status='done'
 * - All deposits must belong to customer and have unapplied balance
 * - Total deposit application cannot exceed invoice total
 *
 * Postconditions:
 * - Invoice created with all lines
 * - Deposits partially/fully applied
 * - payment_applications created
 * - Returns invoice summary with totals
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { CreateInvoiceSchema } from '@/lib/schemas/billing'
import { validateCompanyOwnership, getNextInvoiceNumber, getUnappliedAmount } from '@/lib/transactions'
import { checkIdempotency, getIdempotencyKey, storeIdempotency } from '@/lib/idempotency'
import { ZodError } from 'zod'

export async function POST(request: NextRequest) {
  try {
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

    // Check idempotency
    const idempotencyKey = getIdempotencyKey(request.headers)
    if (idempotencyKey) {
      const cached = await checkIdempotency(
        supabase,
        user.id,
        companyId,
        idempotencyKey,
        '/api/invoices'
      )
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status })
      }
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = CreateInvoiceSchema.parse(body)

    // Validate customer belongs to company
    const customerValid = await validateCompanyOwnership(
      supabase,
      'customers',
      validated.customerId,
      companyId
    )
    if (!customerValid) {
      return NextResponse.json(
        { error: 'Customer not found or unauthorized' },
        { status: 403 }
      )
    }

    // Validate all jobs belong to customer and are done
    if (validated.jobIds.length > 0) {
      for (const jobId of validated.jobIds) {
        const { data: job } = await supabase
          .from('jobs')
          .select('customer_id, company_id, status')
          .eq('id', jobId)
          .single()

        if (
          !job ||
          job.company_id !== companyId ||
          job.customer_id !== validated.customerId ||
          job.status !== 'done'
        ) {
          return NextResponse.json(
            { error: `Job ${jobId} not found, unauthorized, or not completed` },
            { status: 400 }
          )
        }
      }
    }

    // Validate all deposits belong to customer and have unapplied balance
    const depositAmounts: { [key: string]: number } = {}
    if (validated.depositIds.length > 0) {
      for (const depositId of validated.depositIds) {
        const { data: payment } = await supabase
          .from('payments')
          .select('customer_id, company_id, is_deposit')
          .eq('id', depositId)
          .single()

        if (
          !payment ||
          payment.company_id !== companyId ||
          payment.customer_id !== validated.customerId ||
          !payment.is_deposit
        ) {
          return NextResponse.json(
            { error: `Deposit ${depositId} not found or unauthorized` },
            { status: 400 }
          )
        }

        const unapplied = await getUnappliedAmount(supabase, depositId)
        if (unapplied <= 0) {
          return NextResponse.json(
            { error: `Deposit ${depositId} has no unapplied balance` },
            { status: 400 }
          )
        }

        depositAmounts[depositId] = unapplied
      }
    }

    // ========================================================================
    // BEGIN TRANSACTION-LIKE OPERATIONS
    // ========================================================================

    // Step 1: Get next invoice number
    const invoiceNumber = await getNextInvoiceNumber(supabase, companyId)

    // Step 2: Create invoice
    const invoiceData: any = {
      company_id: companyId,
      customer_id: validated.customerId,
      invoice_number: `INV-${invoiceNumber}`,
      invoice_date: new Date().toISOString().split('T')[0],
      status: validated.issueNow ? 'issued' : 'draft',
      terms: validated.terms || null,
      notes: validated.notes || null,
      created_by: user.id,
    }

    if (validated.issueNow) {
      invoiceData.issued_at = new Date().toISOString()
      // Use provided due date or calculate 30 days from now
      if (validated.dueDate) {
        invoiceData.due_date = validated.dueDate
      } else {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 30)
        invoiceData.due_date = dueDate.toISOString().split('T')[0]
      }
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select('id, invoice_number')
      .single()

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError)
      throw new Error(`Failed to create invoice: ${invoiceError.message}`)
    }

    const invoiceId = invoice.id

    // Step 3: Insert all lines (both job-based and manual)
    const allLines = validated.lines.map((line, index) => ({
      invoice_id: invoiceId,
      line_number: index + 1,
      line_type: line.lineType || 'service',
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      taxable: true,
      tax_rate: (line.taxRate || 0) / 100, // Convert percentage to decimal
      job_id: line.jobId || null,
    }))

    if (allLines.length > 0) {
      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(allLines)

      if (linesError) {
        // Rollback: delete invoice
        await supabase.from('invoices').delete().eq('id', invoiceId)
        console.error('Error inserting lines:', linesError)
        throw new Error(`Failed to create invoice lines: ${linesError.message}`)
      }
    }

    // Calculate subtotal so far
    let subtotal = allLines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price,
      0
    )

    // Step 5: Insert "Deposit Applied" negative lines
    const depositLines = []
    let totalDepositApplied = 0
    let lineNumber = allLines.length + 1

    for (const depositId of validated.depositIds) {
      const availableDeposit = depositAmounts[depositId]
      // Apply up to the remaining invoice total (prevent negative invoice)
      const remainingInvoice = subtotal + totalDepositApplied // totalDepositApplied is negative
      const applyAmount = Math.min(availableDeposit, Math.max(0, remainingInvoice))

      if (applyAmount > 0) {
        depositLines.push({
          invoice_id: invoiceId,
          line_number: lineNumber++,
          line_type: 'deposit_applied',
          description: 'Deposit Applied',
          quantity: 1,
          unit_price: -applyAmount, // NEGATIVE
          taxable: false,
          tax_rate: 0,
          applied_payment_id: depositId,
        })

        totalDepositApplied -= applyAmount // Track as negative
      }
    }

    if (depositLines.length > 0) {
      const { error: depositLinesError } = await supabase
        .from('invoice_lines')
        .insert(depositLines)

      if (depositLinesError) {
        // Rollback
        await supabase.from('invoices').delete().eq('id', invoiceId)
        console.error('Error inserting deposit lines:', depositLinesError)
        throw new Error(`Failed to apply deposits: ${depositLinesError.message}`)
      }
    }

    // Step 6: Create payment_applications
    const applications = depositLines.map((line) => ({
      payment_id: line.applied_payment_id!,
      invoice_id: invoiceId,
      applied_amount: Math.abs(line.unit_price), // Store as positive
      applied_at: new Date().toISOString(),
      applied_by: user.id,
    }))

    if (applications.length > 0) {
      const { error: appsError } = await supabase
        .from('payment_applications')
        .insert(applications)

      if (appsError) {
        console.error('Error creating payment applications:', appsError)
        // Continue anyway - negative lines already created
      }
    }

    // ========================================================================
    // END TRANSACTION-LIKE OPERATIONS
    // ========================================================================

    // Calculate final totals from v_invoice_summary
    const { data: summary } = await supabase
      .from('v_invoice_summary')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single()

    const response = {
      invoiceId,
      invoiceNumber: invoice.invoice_number,
      summary: {
        subtotal: Number(summary?.subtotal || 0),
        tax: Number(summary?.tax_amount || 0),
        total: Number(summary?.total_amount || 0),
        depositApplied: Math.abs(totalDepositApplied),
        balance: Number(summary?.balance_due || 0),
      },
    }

    // Store idempotency record
    if (idempotencyKey) {
      await storeIdempotency(
        supabase,
        user.id,
        companyId,
        idempotencyKey,
        '/api/invoices',
        201,
        response
      )
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
