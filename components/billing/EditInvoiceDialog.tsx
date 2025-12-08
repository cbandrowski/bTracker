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
import { invoicesService, InvoiceUpdateLine, UpdateInvoicePayload } from '@/lib/services'
import { useToast } from '@/hooks/useToast'
import { Loader2, Plus, Trash } from 'lucide-react'

type EditableInvoiceLine = InvoiceUpdateLine & {
  id?: string
  locked?: boolean
}

interface EditInvoiceDialogProps {
  invoiceId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

const newLine = (): EditableInvoiceLine => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  lineType: 'service',
  jobId: null,
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
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<UpdateInvoicePayload['status']>('draft')
  const [lines, setLines] = useState<EditableInvoiceLine[]>([])

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoice(invoiceId)
    }
  }, [open, invoiceId])

  const loadInvoice = async (id: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/invoices/${id}`)
      if (!response.ok) {
        throw new Error('Failed to load invoice')
      }
      const data = await response.json()
      const invoice = data.invoice
      setInvoiceDate(invoice?.invoice_date || '')
      setDueDate(invoice?.due_date || '')
      setTerms(invoice?.terms || '')
      setNotes(invoice?.notes || '')
      setStatus(
        (invoice?.status as UpdateInvoicePayload['status']) || 'draft'
      )

      const mappedLines: EditableInvoiceLine[] = (data.lines || []).map((line: any) => ({
        id: line.id,
        description: line.description || '',
        quantity: Number(line.quantity),
        unitPrice: Number(line.unit_price),
        taxRate: Number(line.tax_rate || 0) * 100,
        lineType: line.line_type,
        jobId: line.job_id || null,
        appliedPaymentId: line.applied_payment_id || null,
        locked: line.line_type === 'deposit_applied',
      }))

      setLines(mappedLines.length > 0 ? mappedLines : [newLine()])
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

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    const tax = lines.reduce((sum, line) => {
      if (line.lineType === 'deposit_applied') return sum
      return sum + line.quantity * line.unitPrice * (line.taxRate / 100)
    }, 0)
    const total = subtotal + tax
    return { subtotal, tax, total }
  }, [lines])

  const updateLine = (index: number, field: keyof EditableInvoiceLine, value: any) => {
    setLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addLine = () => setLines((prev) => [...prev, newLine()])

  const removeLine = (index: number) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev
      const updated = [...prev]
      updated.splice(index, 1)
      return updated
    })
  }

  const handleSave = async () => {
    if (!invoiceId) return
    setSaving(true)
    try {
      const payload: UpdateInvoicePayload = {
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || null,
        terms,
        notes,
        status,
        lines: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate),
          lineType: line.lineType,
          jobId: line.jobId || null,
          appliedPaymentId: line.lineType === 'deposit_applied' ? line.appliedPaymentId || null : null,
        })),
      }

      const response = await invoicesService.update(invoiceId, payload)
      if (response.error) {
        throw new Error(response.error)
      }

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

  const disableSave = lines.length === 0 || saving || loading

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Invoice</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading invoice...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate || ''}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div>
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
              <div>
                <Label>Terms</Label>
                <Input value={terms || ''} onChange={(e) => setTerms(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes || ''}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes displayed on the invoice"
              />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Line Items</h3>
              <Button variant="secondary" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={line.id || index}
                  className="grid grid-cols-12 gap-2 items-end rounded border border-gray-700 p-3 bg-gray-900/50"
                >
                  <div className="col-span-5">
                    <Label>Description</Label>
                    <Input
                      value={line.description}
                      disabled={line.locked}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Type</Label>
                    <Select
                      value={line.lineType}
                      disabled={line.locked}
                      onValueChange={(v) => updateLine(index, 'lineType', v as InvoiceUpdateLine['lineType'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="labor">Labor</SelectItem>
                        <SelectItem value="parts">Parts</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="adjustment">Adjustment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="deposit_applied" disabled>
                          Deposit Applied
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      value={line.quantity}
                      disabled={line.locked}
                      onChange={(e) => updateLine(index, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      value={line.unitPrice}
                      disabled={line.locked}
                      onChange={(e) => updateLine(index, 'unitPrice', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Tax %</Label>
                    <Input
                      type="number"
                      value={line.taxRate}
                      disabled={line.locked || line.lineType === 'deposit_applied'}
                      onChange={(e) => updateLine(index, 'taxRate', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {!line.locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 1}
                        className="text-red-400 hover:text-red-200"
                        aria-label="Remove line"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {line.lineType === 'deposit_applied' && line.appliedPaymentId && (
                    <div className="col-span-12 text-xs text-amber-300">
                      Linked deposit {line.appliedPaymentId} (locked)
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 bg-gray-900/50 border border-gray-700 rounded p-3">
              <div>
                <p className="text-xs text-gray-400">Subtotal</p>
                <p className="text-lg font-semibold text-white">${totals.subtotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tax</p>
                <p className="text-lg font-semibold text-white">${totals.tax.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-lg font-semibold text-white">${totals.total.toFixed(2)}</p>
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
