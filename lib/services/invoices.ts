import { SupabaseServerClient } from '@/lib/supabaseServer'
import { UpdateInvoiceInput } from '@/lib/schemas/billing'
import { getUnappliedAmount } from '@/lib/transactions'
import { InvoiceAuditSnapshot, InvoiceStatus } from '@/types/database'

interface InvoiceLineInsert {
  invoice_id: string
  line_number: number
  line_type: string
  description: string
  quantity: number
  unit_price: number
  taxable: boolean
  tax_rate: number
  job_id: string | null
  applied_payment_id: string | null
}

const buildSnapshot = (
  status: InvoiceStatus,
  invoiceDate: string | null,
  dueDate: string | null,
  terms: string | null,
  notes: string | null,
  totals: { total_amount: number; balance_due: number },
  lines: Array<Pick<InvoiceLineInsert, 'line_type' | 'description' | 'quantity' | 'unit_price' | 'tax_rate' | 'applied_payment_id'>>
): InvoiceAuditSnapshot => ({
  status,
  invoice_date: invoiceDate,
  due_date: dueDate,
  terms,
  notes,
  total_amount: totals.total_amount,
  balance_due: totals.balance_due,
  lines: lines.map((line) => ({
    line_type: line.line_type,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    tax_rate: line.tax_rate,
    applied_payment_id: line.applied_payment_id,
  })),
})

export async function updateInvoice(
  supabase: SupabaseServerClient,
  invoiceId: string,
  companyIds: string[],
  userId: string,
  payload: UpdateInvoiceInput
) {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, company_id, customer_id, invoice_number, status, invoice_date, due_date, terms, notes')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice || !companyIds.includes(invoice.company_id)) {
    throw new Error('Invoice not found or unauthorized')
  }

  const { data: existingLines, error: linesError } = await supabase
    .from('invoice_lines')
    .select('line_type, description, quantity, unit_price, tax_rate, applied_payment_id')
    .eq('invoice_id', invoiceId)

  if (linesError || !existingLines) {
    throw new Error('Unable to load invoice lines')
  }

  const normalizedExistingLines = (existingLines || []).map((line) => ({
    line_type: line.line_type,
    description: line.description,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    tax_rate: Number(line.tax_rate ?? 0),
    applied_payment_id: line.applied_payment_id || null,
  }))

  const { data: existingSummary } = await supabase
    .from('v_invoice_summary')
    .select('total_amount, balance_due, invoice_status')
    .eq('invoice_id', invoiceId)
    .single()

  const beforeSnapshot = buildSnapshot(
    (existingSummary?.invoice_status as InvoiceStatus) || (invoice.status as InvoiceStatus),
    invoice.invoice_date || null,
    invoice.due_date || null,
    invoice.terms || null,
    invoice.notes || null,
    {
      total_amount: Number(existingSummary?.total_amount || 0),
      balance_due: Number(existingSummary?.balance_due || 0),
    },
    normalizedExistingLines
  )

  // Validate requested deposit applications against remaining balances
  const previousDepositApplied = new Map<string, number>()
  for (const line of normalizedExistingLines) {
    if (line.line_type === 'deposit_applied' && line.applied_payment_id) {
      const applied = Math.abs(Number(line.unit_price))
      previousDepositApplied.set(
        line.applied_payment_id,
        (previousDepositApplied.get(line.applied_payment_id) || 0) + applied
      )
    }
  }

  const requestedDepositApplied = new Map<string, number>()
  for (const line of payload.lines) {
    if (line.lineType === 'deposit_applied' && line.appliedPaymentId) {
      const applied = Math.abs(Number(line.unitPrice))
      requestedDepositApplied.set(
        line.appliedPaymentId,
        (requestedDepositApplied.get(line.appliedPaymentId) || 0) + applied
      )
    }
  }

  for (const [paymentId, requestedAmount] of requestedDepositApplied.entries()) {
    const available = await getUnappliedAmount(supabase, paymentId)
    const previouslyApplied = previousDepositApplied.get(paymentId) || 0
    if (requestedAmount > available + previouslyApplied) {
      throw new Error('Deposit amount exceeds available balance')
    }
  }

  // Clear existing applications and lines so we can rebuild cleanly
  const { error: deleteAppsError } = await supabase
    .from('payment_applications')
    .delete()
    .eq('invoice_id', invoiceId)

  if (deleteAppsError) {
    throw new Error(`Failed to remove previous payment applications: ${deleteAppsError.message}`)
  }

  const { error: deleteLinesError } = await supabase
    .from('invoice_lines')
    .delete()
    .eq('invoice_id', invoiceId)

  if (deleteLinesError) {
    throw new Error(`Failed to remove previous invoice lines: ${deleteLinesError.message}`)
  }

  const preparedLines: InvoiceLineInsert[] = payload.lines.map((line, index) => {
    const isDeposit = line.lineType === 'deposit_applied'
    return {
      invoice_id: invoiceId,
      line_number: index + 1,
      line_type: line.lineType,
      description: line.description,
      quantity: line.quantity,
      unit_price: isDeposit ? -Math.abs(line.unitPrice) : line.unitPrice,
      taxable: !isDeposit,
      tax_rate: line.taxRate / 100,
      job_id: line.jobId || null,
      applied_payment_id: isDeposit ? line.appliedPaymentId || null : null,
    }
  })

  if (preparedLines.length === 0) {
    throw new Error('Invoice must include at least one line')
  }

  const { error: insertLinesError } = await supabase
    .from('invoice_lines')
    .insert(preparedLines)

  if (insertLinesError) {
    throw new Error(`Failed to insert invoice lines: ${insertLinesError.message}`)
  }

  const depositApplications = preparedLines
    .filter((line) => line.line_type === 'deposit_applied' && line.applied_payment_id)
    .map((line) => ({
      payment_id: line.applied_payment_id!,
      invoice_id: invoiceId,
      applied_amount: Math.abs(line.unit_price),
      applied_at: new Date().toISOString(),
      applied_by: userId,
    }))

  if (depositApplications.length > 0) {
    const { error: appsError } = await supabase
      .from('payment_applications')
      .insert(depositApplications)

    if (appsError) {
      throw new Error(`Failed to re-apply deposits: ${appsError.message}`)
    }
  }

  const invoiceUpdate: Partial<{
    invoice_date: string
    due_date: string | null
    terms: string | null
    notes: string | null
    status: string
    updated_at: string
  }> = {
    updated_at: new Date().toISOString(),
  }

  if (payload.invoiceDate) invoiceUpdate.invoice_date = payload.invoiceDate
  if (payload.dueDate !== undefined) invoiceUpdate.due_date = payload.dueDate
  if (payload.terms !== undefined) invoiceUpdate.terms = payload.terms
  if (payload.notes !== undefined) invoiceUpdate.notes = payload.notes
  if (payload.status) invoiceUpdate.status = payload.status

  const { data: updatedInvoice, error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update(invoiceUpdate)
    .eq('id', invoiceId)
    .select('status, invoice_date, due_date, terms, notes')
    .single()

  if (invoiceUpdateError || !updatedInvoice) {
    throw new Error(`Failed to update invoice: ${invoiceUpdateError?.message || 'Unknown error'}`)
  }

  const { data: updatedSummary } = await supabase
    .from('v_invoice_summary')
    .select('subtotal, tax_amount, total_amount, balance_due, invoice_status')
    .eq('invoice_id', invoiceId)
    .single()

  // Persist rolled-up totals on the invoice row for consistency
  await supabase
    .from('invoices')
    .update({
      subtotal: Number(updatedSummary?.subtotal || 0),
      tax_amount: Number(updatedSummary?.tax_amount || 0),
      total_amount: Number(updatedSummary?.total_amount || 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  const afterSnapshot = buildSnapshot(
    (updatedSummary?.invoice_status as InvoiceStatus) || (updatedInvoice.status as InvoiceStatus),
    updatedInvoice.invoice_date || null,
    updatedInvoice.due_date || null,
    updatedInvoice.terms || null,
    updatedInvoice.notes || null,
    {
      total_amount: Number(updatedSummary?.total_amount || 0),
      balance_due: Number(updatedSummary?.balance_due || 0),
    },
    preparedLines
  )

  await supabase.from('invoice_audit_logs').insert({
    invoice_id: invoiceId,
    company_id: invoice.company_id,
    user_id: userId,
    action: 'edit',
    diff: {
      before: beforeSnapshot,
      after: afterSnapshot,
    },
  })

  return {
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    summary: {
      subtotal: Number(updatedSummary?.subtotal || 0),
      tax: Number(updatedSummary?.tax_amount || 0),
      total: Number(updatedSummary?.total_amount || 0),
      balance: Number(updatedSummary?.balance_due || 0),
    },
  }
}

export async function deleteInvoice(
  supabase: SupabaseServerClient,
  invoiceId: string,
  companyIds: string[],
  userId: string
) {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, company_id, status, invoice_date, due_date, terms, notes, invoice_number')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice || !companyIds.includes(invoice.company_id)) {
    throw new Error('Invoice not found or unauthorized')
  }

  const { data: existingLines } = await supabase
    .from('invoice_lines')
    .select('line_type, description, quantity, unit_price, tax_rate, applied_payment_id')
    .eq('invoice_id', invoiceId)

  const normalizedExistingLines = (existingLines || []).map((line) => ({
    line_type: line.line_type,
    description: line.description,
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    tax_rate: Number(line.tax_rate ?? 0),
    applied_payment_id: line.applied_payment_id || null,
  }))

  const { data: existingSummary } = await supabase
    .from('v_invoice_summary')
    .select('total_amount, balance_due, invoice_status')
    .eq('invoice_id', invoiceId)
    .single()

  const beforeSnapshot = buildSnapshot(
    (existingSummary?.invoice_status as InvoiceStatus) || (invoice.status as InvoiceStatus),
    invoice.invoice_date || null,
    invoice.due_date || null,
    invoice.terms || null,
    invoice.notes || null,
    {
      total_amount: Number(existingSummary?.total_amount || 0),
      balance_due: Number(existingSummary?.balance_due || 0),
    },
    normalizedExistingLines
  )

  const { error: deleteAppsError } = await supabase
    .from('payment_applications')
    .delete()
    .eq('invoice_id', invoiceId)

  if (deleteAppsError) {
    throw new Error(`Failed to remove applied payments: ${deleteAppsError.message}`)
  }

  const { error: deleteInvoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)

  if (deleteInvoiceError) {
    throw new Error(`Failed to delete invoice: ${deleteInvoiceError.message}`)
  }

  await supabase.from('invoice_audit_logs').insert({
    invoice_id: invoiceId,
    company_id: invoice.company_id,
    user_id: userId,
    action: 'delete',
    diff: { before: beforeSnapshot },
  })

  return { success: true }
}
