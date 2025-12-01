'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface UnpaidJob {
  id: string
  title: string
  estimated_amount: number | null
  description?: string | null
  completed_at?: string
}

interface UnappliedPayment {
  paymentId: string
  date: string
  amount: number
  depositType: string | null
  unappliedAmount: number
}

interface InvoiceLine {
  id: string
  type: 'job' | 'manual'
  jobId?: string
  description: string
  notes: string
  completedAt?: string
  quantity: number
  unitPrice: number
  taxRate: number
  quantityInput: string
  unitPriceInput: string
  taxRateInput: string
  subtotal: number
  total: number
}

interface InvoiceLineInput {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  jobId?: string | null
}

interface CompanyInfo {
  name: string
  address: string
  address_line_2?: string
  city: string
  state: string
  zipcode: string
  phone: string
  email: string
}

interface InlineInvoiceFormProps {
  selectedJobIds: string[]
  jobs: UnpaidJob[]
  deposits: UnappliedPayment[]
  companyInfo: CompanyInfo | null
  onSubmit: (data: {
    jobIds: string[]
    lines: InvoiceLineInput[]
    depositIds: string[]
    terms: string
    issueNow: boolean
    dueDate?: string
  }) => Promise<void>
  onCancel: () => void
}

export function InlineInvoiceForm({
  selectedJobIds,
  jobs,
  deposits,
  companyInfo,
  onSubmit,
  onCancel,
}: InlineInvoiceFormProps) {
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([])
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set())
  const [terms, setTerms] = useState('Net 30')
  const [issueNow, setIssueNow] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize invoice lines from selected jobs
  useEffect(() => {
    const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id))
    const jobLines: InvoiceLine[] = selectedJobs.map(job => {
      const price = job.estimated_amount || 0
      return {
        id: job.id,
        type: 'job',
        jobId: job.id,
        description: job.title,
        notes: job.description || '',
        completedAt: job.completed_at,
        quantity: 1,
        unitPrice: price,
        taxRate: 0,
        quantityInput: '1',
        unitPriceInput: price.toString(),
        taxRateInput: '0',
        subtotal: price,
        total: price,
      }
    })
    setInvoiceLines(jobLines)
  }, [selectedJobIds, jobs])

  const parseDecimal = (value: string) => {
    const normalized = value.replace(/,/g, '.')
    const num = Number.parseFloat(normalized)
    return Number.isFinite(num) ? num : 0
  }

  const recomputeLine = (line: InvoiceLine): InvoiceLine => {
    const quantity = parseDecimal(line.quantityInput)
    const unitPrice = parseDecimal(line.unitPriceInput)
    const taxRate = parseDecimal(line.taxRateInput)
    const subtotal = quantity * unitPrice
    const total = subtotal * (1 + taxRate / 100)
    return {
      ...line,
      quantity,
      unitPrice,
      taxRate,
      subtotal,
      total,
    }
  }

  const addManualLine = () => {
    const newLine: InvoiceLine = {
      id: `manual-${Date.now()}`,
      type: 'manual',
      description: '',
      notes: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      quantityInput: '1',
      unitPriceInput: '0',
      taxRateInput: '0',
      subtotal: 0,
      total: 0,
    }
    setInvoiceLines([...invoiceLines, newLine])
  }

  const removeLine = (id: string) => {
    setInvoiceLines(invoiceLines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, updates: Partial<InvoiceLine>) => {
    setInvoiceLines(invoiceLines.map(line => {
      if (line.id === id) {
        const updated = recomputeLine({ ...line, ...updates })
        return updated
      }
      return line
    }))
  }

  const toggleDeposit = (depositId: string, checked: boolean) => {
    const newSelected = new Set(selectedDepositIds)
    if (checked) {
      newSelected.add(depositId)
    } else {
      newSelected.delete(depositId)
    }
    setSelectedDepositIds(newSelected)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Calculate totals
  const subtotal = invoiceLines.reduce((sum, line) => sum + line.subtotal, 0)
  const tax = invoiceLines.reduce((sum, line) => sum + (line.total - line.subtotal), 0)
  const total = subtotal + tax
  const depositApplied = Array.from(selectedDepositIds).reduce((sum, id) => {
    const deposit = deposits.find(d => d.paymentId === id)
    return sum + (deposit?.unappliedAmount || 0)
  }, 0)
  const balance = total - depositApplied

  // Validation
  const depositsExceedTotal = depositApplied > total
  const hasContent = invoiceLines.length > 0
  const needsDueDate = issueNow && !dueDate && terms !== 'Due on Receipt'
  const hasInvalidLines = invoiceLines.some(line => !line.description.trim())

  const canSubmit = hasContent && !depositsExceedTotal && !needsDueDate && !hasInvalidLines

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      const jobIds = invoiceLines.filter(l => l.type === 'job').map(l => l.jobId!)
      const lines: InvoiceLineInput[] = invoiceLines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxRate: line.taxRate,
        jobId: line.type === 'job' ? line.jobId : null,
      }))

      await onSubmit({
        jobIds,
        lines,
        depositIds: Array.from(selectedDepositIds),
        terms,
        issueNow,
        dueDate: dueDate || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-2">
      <CardHeader className="border-b bg-gray-50 dark:bg-gray-900 pb-6">
        {/* Invoice Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">INVOICE</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Draft</p>
          </div>

          {/* Company Information */}
          {companyInfo && (
            <div className="text-right space-y-1">
              <div className="font-bold text-lg">{companyInfo.name}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div>{companyInfo.address}</div>
                {companyInfo.address_line_2 && <div>{companyInfo.address_line_2}</div>}
                <div>
                  {companyInfo.city}, {companyInfo.state} {companyInfo.zipcode}
                </div>
                <div className="mt-2">
                  <div>{companyInfo.phone}</div>
                  <div>{companyInfo.email}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Validation warnings */}
        {depositsExceedTotal && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <strong>Error:</strong> Selected deposits ({formatCurrency(depositApplied)}) exceed invoice total ({formatCurrency(total)})
          </div>
        )}

        {hasInvalidLines && (
          <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <strong>Warning:</strong> All invoice lines must have a description
          </div>
        )}

        {/* Invoice Lines Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-lg font-semibold">Invoice Lines</Label>
            <Button onClick={addManualLine} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Line Item
            </Button>
          </div>

          {invoiceLines.length === 0 ? (
            <div className="text-center py-8 border rounded-md bg-gray-50 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No line items. Add jobs or manual line items to create an invoice.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 bg-gray-100 dark:bg-gray-800 p-3 text-sm font-semibold border-b">
                <div className="col-span-4">Description / Notes</div>
                <div className="col-span-2">Completed</div>
                <div className="col-span-1 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-1 text-center">Tax %</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Table Rows */}
              {invoiceLines.map((line, index) => (
                <div
                  key={line.id}
                  className={`grid grid-cols-12 gap-4 p-3 items-start ${
                    index !== invoiceLines.length - 1 ? 'border-b' : ''
                  }`}
                >
                  {/* Description / Notes */}
                  <div className="col-span-4 space-y-2">
                    <Input
                      placeholder="Description *"
                      value={line.description}
                      onChange={e => updateLine(line.id, { description: e.target.value })}
                      className="font-medium"
                    />
                    <Textarea
                      placeholder="Notes (optional)"
                      value={line.notes}
                      onChange={e => updateLine(line.id, { notes: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Completed Date */}
                  <div className="col-span-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                    {formatDate(line.completedAt)}
                  </div>

                  {/* Quantity */}
                  <div className="col-span-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.quantityInput}
                      onChange={e => updateLine(line.id, { quantityInput: e.target.value })}
                      className="text-center"
                      placeholder="0"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.unitPriceInput}
                      onChange={e => updateLine(line.id, { unitPriceInput: e.target.value })}
                      placeholder="0.00"
                      className="text-right"
                    />
                  </div>

                  {/* Tax Rate */}
                  <div className="col-span-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.taxRateInput}
                      onChange={e => updateLine(line.id, { taxRateInput: e.target.value })}
                      placeholder="0"
                      className="text-center"
                    />
                  </div>

                  {/* Total */}
                  <div className="col-span-1 flex items-center justify-end text-sm font-medium">
                    {formatCurrency(line.total)}
                  </div>

                  {/* Delete Button */}
                  <div className="col-span-1 flex items-start justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deposits Section */}
        {deposits.length > 0 && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">Available Deposits</Label>
            <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {deposits.map(deposit => {
                const isSelected = selectedDepositIds.has(deposit.paymentId)
                return (
                  <div key={deposit.paymentId} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-gray-800 rounded">
                    <Checkbox
                      id={`deposit-${deposit.paymentId}`}
                      checked={isSelected}
                      onCheckedChange={checked =>
                        toggleDeposit(deposit.paymentId, checked as boolean)
                      }
                      className="h-5 w-5"
                    />
                    <Label htmlFor={`deposit-${deposit.paymentId}`} className="flex-1 cursor-pointer text-sm">
                      <span className="font-medium">
                        {formatCurrency(deposit.unappliedAmount)}
                      </span>
                      {deposit.depositType && (
                        <span className="ml-2 text-gray-500">
                          ({deposit.depositType})
                        </span>
                      )}
                      <span className="ml-2 text-gray-400 text-xs">
                        {formatDate(deposit.date)}
                      </span>
                    </Label>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Terms and Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="terms">Payment Terms</Label>
            <Select value={terms} onValueChange={setTerms}>
              <SelectTrigger id="terms">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                <SelectItem value="Net 15">Net 15</SelectItem>
                <SelectItem value="Net 30">Net 30</SelectItem>
                <SelectItem value="Net 60">Net 60</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="issueNow"
            checked={issueNow}
            onCheckedChange={checked => setIssueNow(checked as boolean)}
            className="h-5 w-5"
          />
          <Label htmlFor="issueNow" className="cursor-pointer">
            Issue invoice immediately
          </Label>
        </div>

        {/* Totals Summary */}
        <div className="space-y-3 rounded-lg border-2 p-6 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between text-base">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-base">
            <span className="text-gray-600 dark:text-gray-400">Tax</span>
            <span className="font-medium">{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t pt-3">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {depositApplied > 0 && (
            <>
              <div className="flex justify-between text-base text-blue-600 dark:text-blue-400">
                <span>Deposit Applied</span>
                <span className="font-medium">-{formatCurrency(depositApplied)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t-2 pt-3">
                <span>Balance Due</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="flex-1">
            {submitting ? 'Creating Invoice...' : 'Create Invoice'}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
