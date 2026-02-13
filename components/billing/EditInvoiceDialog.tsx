'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { invoicesService, InvoiceUpdateLine, UpdateInvoicePayload } from '@/lib/services'
import { useToast } from '@/hooks/useToast'
import { Loader2, Plus, Trash } from 'lucide-react'

type InvoiceLineType = InvoiceUpdateLine['lineType']

interface InvoiceLineResponse {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  line_type: InvoiceLineType
  job_id?: string | null
  jobs?: { title?: string | null } | null
  applied_payment_id?: string | null
}

interface InvoiceResponse {
  invoice: {
    id: string
    invoice_number: string
    invoice_date: string | null
    due_date: string | null
    terms: string | null
    notes: string | null
    status: UpdateInvoicePayload['status']
    customer_id?: string
  }
  lines: InvoiceLineResponse[]
}

interface EditInvoiceDialogProps {
  invoiceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

interface EditableInvoiceLine {
  id?: string
  description: string
  quantity: number
  quantityInput: string
  unitPrice: number
  unitPriceInput: string
  subtotal: number
  lineType: InvoiceLineType
  jobId?: string | null
  jobTitle?: string | null
  appliedPaymentId?: string | null
  locked?: boolean
}

const createManualLine = (): EditableInvoiceLine => ({
  description: '',
  quantity: 1,
  quantityInput: '1',
  unitPrice: 0,
  unitPriceInput: '0',
  subtotal: 0,
  lineType: 'service',
  jobId: null,
  jobTitle: null,
})

export function EditInvoiceDialog({
  invoiceId,
  open,
  onOpenChange,
  onSaved,
}: EditInvoiceDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<UpdateInvoicePayload['status']>('draft')
  const [taxRate, setTaxRate] = useState(0)
  const [taxRateInput, setTaxRateInput] = useState('')
  const [lines, setLines] = useState<EditableInvoiceLine[]>([])

  const parseDecimal = (value: string) => {
    const normalized = value.replace(/,/g, '.')
    const num = Number.parseFloat(normalized)
    return Number.isFinite(num) ? num : 0
  }

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoice(invoiceId)
    }
  }, [open, invoiceId])

  useEffect(() => {
    const parsed = parseDecimal(taxRateInput)
    setTaxRate(parsed)
  }, [taxRateInput])

  const loadInvoice = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) {
        throw new Error('Failed to load invoice')
      }
      const data: InvoiceResponse = await response.json()
      const invoice = data.invoice

      setInvoiceNumber(invoice.invoice_number)
      setInvoiceDate(invoice.invoice_date || '')
      setDueDate(invoice.due_date || '')
      setTerms(invoice.terms || '')
      setNotes(invoice.notes || '')
      setStatus(invoice.status || 'draft')

      const firstTaxableLine = (data.lines || []).find(
        (line) => line.line_type !== 'deposit_applied'
      )
      const initialTaxRate = firstTaxableLine ? Number(firstTaxableLine.tax_rate || 0) * 100 : 0
      setTaxRate(initialTaxRate)
      setTaxRateInput(initialTaxRate ? initialTaxRate.toString() : '')

      const mappedLines: EditableInvoiceLine[] = (data.lines || []).map((line) => {
        const isDeposit = line.line_type === 'deposit_applied'
        const quantity = isDeposit ? 1 : Number(line.quantity)
        const unitPrice = Math.abs(Number(line.unit_price))
        return {
          id: line.id,
          description: line.description || '',
          quantity,
          quantityInput: quantity.toString(),
          unitPrice,
          unitPriceInput: unitPrice.toString(),
          subtotal: quantity * unitPrice,
          lineType: line.line_type,
          jobId: line.job_id || null,
          jobTitle: line.jobs?.title || null,
          appliedPaymentId: line.applied_payment_id || null,
          locked: isDeposit,
        }
      })

      setLines(mappedLines.length > 0 ? mappedLines : [createManualLine()])
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error loading invoice',
        description: error instanceof Error ? error.message : 'Unable to load invoice details',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const recomputeLine = (line: EditableInvoiceLine) => {
    if (line.lineType === 'deposit_applied') {
      const unitPrice = Math.abs(parseDecimal(line.unitPriceInput))
      return {
        ...line,
        quantity: 1,
        quantityInput: '1',
        unitPrice,
        unitPriceInput: unitPrice.toString(),
        subtotal: unitPrice,
      }
    }

    const quantity = parseDecimal(line.quantityInput)
    const unitPrice = parseDecimal(line.unitPriceInput)
    const subtotal = quantity * unitPrice
    return {
      ...line,
      quantity,
      unitPrice,
      subtotal,
    }
  }

  const updateLineByIndex = (index: number, updates: Partial<EditableInvoiceLine>) => {
    setLines((prev) => {
      const next = [...prev]
      next[index] = recomputeLine({ ...next[index], ...updates })
      return next
    })
  }

  const addLine = () => setLines((prev) => [...prev, createManualLine()])

  const removeLine = (index: number) => {
    setLines((prev) => {
      const candidate = prev[index]
      if (candidate.locked) return prev

      const remainingNonDeposits = prev.filter((line, i) => i !== index && line.lineType !== 'deposit_applied')
      if (remainingNonDeposits.length === 0) return prev

      const updated = [...prev]
      updated.splice(index, 1)
      return updated
    })
  }

  const totals = useMemo(() => {
    const taxableLines = lines.filter((line) => line.lineType !== 'deposit_applied')
    const depositLines = lines.filter((line) => line.lineType === 'deposit_applied')

    const subtotal = taxableLines.reduce((sum, line) => sum + line.subtotal, 0)
    const tax = subtotal * (taxRate / 100)
    const depositApplied = depositLines.reduce((sum, line) => sum + Math.abs(line.subtotal), 0)
    const total = subtotal + tax - depositApplied

    return { subtotal, tax, depositApplied, total }
  }, [lines, taxRate])

  const hasInvalidLines = lines.some(
    (line) => line.lineType !== 'deposit_applied' && !line.description.trim()
  )
  const hasEditableContent = lines.some((line) => line.lineType !== 'deposit_applied')
  const disableSave = saving || loading || hasInvalidLines || !hasEditableContent

  const setDueDateOffset = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    setDueDate(date.toISOString().split('T')[0])
  }

  const handleSave = async () => {
    if (!invoiceId) return
    if (!hasEditableContent) {
      toast({
        variant: 'destructive',
        title: 'Add at least one line item',
        description: 'Invoices need a billable line before saving.',
      })
      return
    }

    setSaving(true)
    try {
      const payload: UpdateInvoicePayload = {
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || null,
        terms: terms || null,
        notes: notes || null,
        status,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: line.lineType === 'deposit_applied' ? 1 : Number(line.quantity),
          unitPrice: line.lineType === 'deposit_applied' ? -Math.abs(line.unitPrice) : Number(line.unitPrice),
          taxRate: line.lineType === 'deposit_applied' ? 0 : Number(taxRate),
          lineType: line.lineType,
          jobId: line.jobId || null,
          appliedPaymentId: line.lineType === 'deposit_applied' ? line.appliedPaymentId || null : null,
        })),
      }

      const response = await invoicesService.update(invoiceId, payload)
      if (response.error) {
        throw new Error(response.error)
      }

      const status = response.data?.status

      if (status === 'pending') {
        toast({
          variant: 'success',
          title: 'Invoice update submitted',
          description: response.data?.message || 'Waiting for another owner to approve.',
        })
      } else {
        const balance = response.data?.summary?.balance
        const balanceText =
          typeof balance === 'number'
            ? balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            : null

        toast({
          variant: 'success',
          title: 'Invoice updated',
          description: balanceText
            ? `Totals recalculated. New balance: ${balanceText}`
            : 'Totals recalculated.',
        })
      }

      if (onSaved) await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Unable to update invoice',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!invoiceId) return
    const confirmed = window.confirm('Delete this invoice? Applied payments will be released.')
    if (!confirmed) return

    setDeleting(true)
    try {
      const response = await invoicesService.delete(invoiceId)
      if (response.error) {
        throw new Error(response.error)
      }
      toast({
        variant: 'success',
        title: 'Invoice deleted',
        description: 'Invoice and line items have been removed.',
      })
      if (onSaved) await onSaved()
      onOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unable to delete invoice',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-screen-xl w-screen h-screen max-h-screen overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Edit Invoice {invoiceNumber ? `(${invoiceNumber})` : ''}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading invoice...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Match the create-invoice layout and tax setup</p>
                <h3 className="text-2xl font-bold">Invoice Builder</h3>
              </div>
              <Badge variant="secondary" className="w-fit capitalize">
                {status}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as UpdateInvoicePayload['status'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="issued">Issued</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Terms</Label>
                <Input
                  value={terms}
                  placeholder="Net 30"
                  onChange={(e) => setTerms(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-gray-600 dark:text-gray-400">Quick Due Date</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDueDateOffset(7)}>
                  1 Week
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDueDateOffset(10)}>
                  10 Days
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDueDateOffset(14)}>
                  2 Weeks
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setDueDateOffset(21)}>
                  3 Weeks
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date()
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                    setDueDate(lastDay.toISOString().split('T')[0])
                  }}
                >
                  End of Month
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note that will appear next to Bill To on the invoice"
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Label className="text-lg font-semibold">Invoice Lines</Label>
                <Button onClick={addLine} size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line Item
                </Button>
              </div>

              {lines.length === 0 ? (
                <div className="text-center py-8 border rounded-md bg-gray-50 dark:bg-gray-900">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No line items. Add a billable line to edit the invoice.
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-hidden">
                    <div className="w-full">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-gray-100 dark:bg-gray-800 p-3 text-sm font-semibold border-b">
                        <div className="sm:col-span-4">Description</div>
                        <div className="sm:col-span-2 hidden sm:block">Type</div>
                        <div className="sm:col-span-2 hidden sm:block text-center">Qty</div>
                        <div className="sm:col-span-2 hidden sm:block text-right">Unit Price</div>
                        <div className="sm:col-span-1 hidden sm:block text-right">Subtotal</div>
                        <div className="sm:col-span-1 hidden sm:block" />
                      </div>

                      {lines.map((line, index) => (
                        <div
                          key={line.id || `${line.description}-${index}`}
                          className={`grid grid-cols-1 sm:grid-cols-12 gap-4 p-3 items-start ${
                            index !== lines.length - 1 ? 'border-b' : ''
                          }`}
                        >
                          <div className="sm:col-span-4 space-y-2">
                            <Input
                              placeholder="Description *"
                              value={line.description}
                              disabled={line.locked}
                              onChange={(e) => updateLineByIndex(index, { description: e.target.value })}
                              className="font-medium"
                            />
                            {line.jobTitle && (
                              <p className="text-xs text-muted-foreground">Job: {line.jobTitle}</p>
                            )}
                            {line.appliedPaymentId && line.lineType === 'deposit_applied' && (
                              <p className="text-xs text-amber-600 dark:text-amber-300">
                                Deposit applied ({line.appliedPaymentId})
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-2 flex items-center sm:justify-start gap-2">
                            <Badge variant="outline" className="capitalize">
                              {line.lineType.replace('_', ' ')}
                            </Badge>
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">Quantity</p>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={line.quantityInput}
                              disabled={line.locked}
                              onChange={(e) => updateLineByIndex(index, { quantityInput: e.target.value })}
                              className="text-center"
                              placeholder="0"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">Unit Price</p>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={line.unitPriceInput}
                              disabled={line.locked}
                              onChange={(e) => updateLineByIndex(index, { unitPriceInput: e.target.value })}
                              placeholder="0.00"
                              className="text-right"
                            />
                          </div>

                          <div className="sm:col-span-1 flex flex-col sm:flex-row sm:items-center sm:justify-end text-sm font-medium gap-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">Subtotal</span>
                            <span>{formatCurrency(line.subtotal)}</span>
                          </div>

                          <div className="sm:col-span-1 flex items-start justify-start sm:justify-center">
                            {!line.locked && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLine(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="taxRate" className="text-gray-600 dark:text-gray-400">
                      Tax Rate (%)
                    </Label>
                    <p className="text-xs text-muted-foreground">Applied to all non-deposit lines</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="taxRate"
                      type="text"
                      inputMode="decimal"
                      value={taxRateInput}
                      onChange={(e) => setTaxRateInput(e.target.value)}
                      placeholder="0"
                      className="w-24 text-right"
                    />
                    <span className="text-gray-600 dark:text-gray-400">%</span>
                  </div>
                </div>
                {hasInvalidLines && (
                  <p className="text-sm text-amber-600 dark:text-amber-300">
                    All billable lines need a description.
                  </p>
                )}
              </div>

              <div className="space-y-2 rounded-lg border p-4 bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-between text-base">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-gray-600 dark:text-gray-400">
                      Tax ({taxRate.toFixed(2)}%)
                    </span>
                    <span className="font-medium">{formatCurrency(totals.tax)}</span>
                  </div>
                )}
                {totals.depositApplied > 0 && (
                  <div className="flex justify-between text-base text-blue-600 dark:text-blue-400">
                    <span>Deposit Applied</span>
                    <span className="font-medium">-{formatCurrency(totals.depositApplied)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold border-t pt-3">
                  <span>Total</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || loading}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Delete
          </Button>
          <Button onClick={handleSave} disabled={disableSave}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
