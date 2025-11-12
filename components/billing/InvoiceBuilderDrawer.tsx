'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Plus } from 'lucide-react'

interface UnpaidJob {
  id: string
  title: string
  estimated_amount: number | null
}

interface UnappliedPayment {
  paymentId: string
  date: string
  amount: number
  depositType: string | null
  unappliedAmount: number
}

interface AdditionalLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

interface InvoiceLineInput {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

interface InvoiceBuilderDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedJobIds: string[]
  jobs: UnpaidJob[]
  deposits: UnappliedPayment[]
  onSubmit: (data: {
    jobIds: string[]
    lines: InvoiceLineInput[]
    depositIds: string[]
    terms: string
    issueNow: boolean
    dueDate?: string
  }) => Promise<void>
}

export function InvoiceBuilderDrawer({
  open,
  onOpenChange,
  selectedJobIds,
  jobs,
  deposits,
  onSubmit,
}: InvoiceBuilderDrawerProps) {
  const [additionalLines, setAdditionalLines] = useState<AdditionalLine[]>([])
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set())
  const [terms, setTerms] = useState('Net 30')
  const [issueNow, setIssueNow] = useState(true)
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (open) {
      setAdditionalLines([])
      setSelectedDepositIds(new Set())
      setTerms('Net 30')
      setIssueNow(true)
      setDueDate('')
      setError(null)
    }
  }, [open])

  const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id))

  const addLine = () => {
    setAdditionalLines([
      ...additionalLines,
      {
        id: Math.random().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 0,
      },
    ])
  }

  const removeLine = (id: string) => {
    setAdditionalLines(additionalLines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: keyof AdditionalLine, value: any) => {
    setAdditionalLines(
      additionalLines.map(l => (l.id === id ? { ...l, [field]: value } : l))
    )
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

  // Calculate totals
  const jobsTotal = selectedJobs.reduce((sum, job) => sum + (job.estimated_amount || 0), 0)
  const linesSubtotal = additionalLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  )
  const linesTax = additionalLines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice * (line.taxRate / 100),
    0
  )
  const linesTotal = linesSubtotal + linesTax
  const subtotal = jobsTotal + linesSubtotal
  const tax = linesTax
  const total = subtotal + tax
  const depositApplied = Array.from(selectedDepositIds).reduce((sum, id) => {
    const deposit = deposits.find(d => d.paymentId === id)
    return sum + (deposit?.unappliedAmount || 0)
  }, 0)
  const balance = total - depositApplied

  // Validation
  const depositsExceedTotal = depositApplied > total
  const hasContent = selectedJobIds.length > 0 || additionalLines.length > 0
  const needsDueDate = issueNow && !dueDate && terms !== 'Due on Receipt'

  const canSubmit = hasContent && !depositsExceedTotal && !needsDueDate

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        jobIds: selectedJobIds,
        lines: additionalLines.map(({ id, ...rest }) => rest),
        depositIds: Array.from(selectedDepositIds),
        terms,
        issueNow,
        dueDate: dueDate || undefined,
      })

      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Create Invoice</DrawerTitle>
            <DrawerDescription>
              Review selected jobs, add additional lines, attach deposits, and configure terms
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-6 p-6">
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

            {!hasContent && (
              <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                <strong>Warning:</strong> No jobs or lines selected. Add at least one item.
              </div>
            )}

            {/* Selected Jobs */}
            {selectedJobs.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Jobs ({selectedJobs.length})</Label>
                <div className="space-y-2 rounded-md border p-4">
                  {selectedJobs.map(job => (
                    <div key={job.id} className="flex justify-between text-sm">
                      <span>{job.title}</span>
                      <span className="font-medium">
                        {job.estimated_amount ? formatCurrency(job.estimated_amount) : 'N/A'}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Jobs Total</span>
                    <span>{formatCurrency(jobsTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Additional Lines</Label>
                <Button onClick={addLine} size="sm" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
              </div>

              {additionalLines.length > 0 && (
                <div className="space-y-3">
                  {additionalLines.map(line => (
                    <div
                      key={line.id}
                      className="grid grid-cols-12 gap-2 rounded-md border p-3"
                    >
                      <div className="col-span-12 sm:col-span-5">
                        <Input
                          placeholder="Description"
                          value={line.description}
                          onChange={e =>
                            updateLine(line.id, 'description', e.target.value)
                          }
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={e =>
                            updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="1"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Price"
                          value={line.unitPrice}
                          onChange={e =>
                            updateLine(line.id, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Input
                          type="number"
                          placeholder="Tax %"
                          value={line.taxRate}
                          onChange={e =>
                            updateLine(line.id, 'taxRate', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.1"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Deposits */}
            {deposits.length > 0 && (
              <div className="space-y-2">
                <Label>Available Deposits</Label>
                <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                  {deposits.map(deposit => {
                    const isSelected = selectedDepositIds.has(deposit.paymentId)
                    return (
                      <div key={deposit.paymentId} className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked =>
                            toggleDeposit(deposit.paymentId, checked as boolean)
                          }
                        />
                        <div className="flex-1 text-sm">
                          <span className="font-medium">
                            {formatCurrency(deposit.unappliedAmount)}
                          </span>
                          {deposit.depositType && (
                            <span className="ml-2 text-gray-500">
                              ({deposit.depositType})
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Terms and Issue */}
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
              />
              <Label htmlFor="issueNow" className="cursor-pointer">
                Issue invoice immediately
              </Label>
            </div>

            {/* Totals */}
            <div className="space-y-2 rounded-md border p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {depositApplied > 0 && (
                <>
                  <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
                    <span>Deposit Applied</span>
                    <span>-{formatCurrency(depositApplied)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Balance Due</span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? 'Creating...' : 'Create Invoice'}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
