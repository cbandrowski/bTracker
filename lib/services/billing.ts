import { SupabaseServerClient } from '@/lib/supabaseServer'

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'void' | 'cancelled'
type InvoiceLineType = 'service' | 'parts' | 'supplies' | 'labor' | 'deposit_applied' | 'adjustment' | 'other'

interface InvoiceSummaryRow {
  invoice_id: string
  company_id: string
  due_date: string | null
  balance_due: number
  invoice_status: InvoiceStatus
}

interface InvoiceLineRow {
  invoice_id: string
  line_number: number
  description: string | null
  line_type: InvoiceLineType
}

interface LateFeeDetail {
  invoiceId: string
  addedDates: string[]
}

interface LateFeeResult {
  invoicesChecked: number
  invoicesUpdated: number
  feesCreated: number
  details: LateFeeDetail[]
  skippedReason?: string
}

const LATE_FEE_PREFIX = 'Late Fee - '

const toUtcDate = (date: Date | string) => {
  if (typeof date === 'string') {
    return new Date(`${date}T00:00:00Z`)
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const formatDate = (date: Date) => date.toISOString().split('T')[0]

const addDays = (date: Date, days: number) => {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

export async function applyLateFeesForCompany(
  supabase: SupabaseServerClient,
  companyId: string,
  asOfDate: Date = new Date()
): Promise<LateFeeResult> {
  const asOf = toUtcDate(asOfDate)
  const asOfDateString = formatDate(asOf)

  // Load company late fee settings
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('late_fee_enabled, late_fee_days, late_fee_amount')
    .eq('id', companyId)
    .single()

  if (companyError) {
    throw new Error(`Failed to load company late fee settings: ${companyError.message}`)
  }

  if (
    !company?.late_fee_enabled ||
    !company.late_fee_days ||
    company.late_fee_days <= 0 ||
    !company.late_fee_amount ||
    company.late_fee_amount <= 0
  ) {
    return {
      invoicesChecked: 0,
      invoicesUpdated: 0,
      feesCreated: 0,
      details: [],
      skippedReason: 'Late fees are disabled or not configured for this company',
    }
  }

  // Fetch overdue invoices that still have a balance
  const { data: invoices, error: invoicesError } = await supabase
    .from('v_invoice_summary')
    .select('invoice_id, company_id, due_date, balance_due, invoice_status')
    .eq('company_id', companyId)
    .not('invoice_status', 'in', '("void","cancelled","draft")')
    .gt('balance_due', 0)
    .not('due_date', 'is', null)
    .lt('due_date', asOfDateString)

  if (invoicesError) {
    throw new Error(`Failed to load overdue invoices: ${invoicesError.message}`)
  }

  if (!invoices || invoices.length === 0) {
    return {
      invoicesChecked: 0,
      invoicesUpdated: 0,
      feesCreated: 0,
      details: [],
      skippedReason: 'No overdue invoices with an outstanding balance',
    }
  }

  const invoiceIds = invoices.map((inv) => inv.invoice_id)

  // Load existing lines for these invoices to determine current late fees and next line numbers
  const { data: invoiceLines, error: linesError } = await supabase
    .from('invoice_lines')
    .select('invoice_id, line_number, description, line_type')
    .in('invoice_id', invoiceIds)

  if (linesError) {
    throw new Error(`Failed to load invoice lines: ${linesError.message}`)
  }

  const linesByInvoice = new Map<string, InvoiceLineRow[]>()
  for (const line of invoiceLines || []) {
    const existing = linesByInvoice.get(line.invoice_id) || []
    existing.push(line)
    linesByInvoice.set(line.invoice_id, existing)
  }

  const linesToInsert: Array<{
    invoice_id: string
    line_number: number
    line_type: InvoiceLineType
    description: string
    quantity: number
    unit_price: number
    taxable: boolean
    tax_rate: number
  }> = []

  const details: LateFeeDetail[] = []

  for (const invoice of invoices as InvoiceSummaryRow[]) {
    if (!invoice.due_date) continue

    const dueDate = toUtcDate(invoice.due_date)
    const daysPastDue = Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysPastDue < 1) continue

    // Build expected fee dates: day after due date, then every late_fee_days after due date
    const expectedDates: string[] = []
    const firstFeeDate = addDays(dueDate, 1)
    if (firstFeeDate <= asOf) {
      expectedDates.push(formatDate(firstFeeDate))
    }

    let counter = 1
    while (true) {
      const candidate = addDays(dueDate, company.late_fee_days * counter)
      if (candidate > asOf) break
      expectedDates.push(formatDate(candidate))
      counter += 1
    }

    const existingLines = linesByInvoice.get(invoice.invoice_id) || []
    const existingMaxLineNumber = existingLines.reduce(
      (max, line) => Math.max(max, line.line_number),
      0
    )

    const existingLateFeeDates = new Set(
      existingLines
        .filter((line) => line.line_type === 'adjustment' && line.description)
        .map((line) => {
          const match = line.description?.startsWith(LATE_FEE_PREFIX)
            ? line.description.slice(LATE_FEE_PREFIX.length)
            : null
          return match || ''
        })
        .filter(Boolean)
    )

    const missingDates = expectedDates.filter((date) => !existingLateFeeDates.has(date))
    if (missingDates.length === 0) continue

    let lineNumber = existingMaxLineNumber
    for (const feeDate of missingDates) {
      lineNumber += 1
      linesToInsert.push({
        invoice_id: invoice.invoice_id,
        line_number: lineNumber,
        line_type: 'adjustment',
        description: `${LATE_FEE_PREFIX}${feeDate}`,
        quantity: 1,
        unit_price: company.late_fee_amount,
        taxable: false,
        tax_rate: 0,
      })
    }

    details.push({
      invoiceId: invoice.invoice_id,
      addedDates: missingDates,
    })
  }

  if (linesToInsert.length === 0) {
    return {
      invoicesChecked: invoices.length,
      invoicesUpdated: 0,
      feesCreated: 0,
      details,
      skippedReason: 'All overdue invoices already have the required late fees',
    }
  }

  const { error: insertError } = await supabase.from('invoice_lines').insert(linesToInsert)
  if (insertError) {
    throw new Error(`Failed to apply late fees: ${insertError.message}`)
  }

  return {
    invoicesChecked: invoices.length,
    invoicesUpdated: details.length,
    feesCreated: linesToInsert.length,
    details,
  }
}
