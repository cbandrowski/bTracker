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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, Receipt } from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  status: string
  due_date: string | null
  total_amount: number
  deposit_applied: number
  total_paid: number
  balance_due: number
}

interface ApplyPaymentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  onSuccess?: () => void
}

type PaymentMethod = 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other'

export function ApplyPaymentDrawer({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: ApplyPaymentDrawerProps) {
  const [step, setStep] = useState<'list' | 'payment'>('list')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // Payment form state
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch invoices when drawer opens
  useEffect(() => {
    if (open) {
      fetchInvoices()
    } else {
      // Reset state when drawer closes
      setStep('list')
      setSelectedInvoice(null)
      setAmount('')
      setMethod('check')
      setMemo('')
      setError(null)
    }
  }, [open, customerId])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${customerId}/invoices`)
      if (response.ok) {
        const data = await response.json()
        // Filter to only show invoices with balance > 0
        const openInvoices = (data.invoices || []).filter(
          (inv: Invoice) => inv.balance_due > 0
        )
        setInvoices(openInvoices)
      }
    } catch (err) {
      console.error('Error fetching invoices:', err)
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setAmount(invoice.balance_due.toString())
    setStep('payment')
  }

  const handleBack = () => {
    setStep('list')
    setSelectedInvoice(null)
    setAmount('')
    setMethod('check')
    setMemo('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoice) return

    setError(null)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    if (amountNum > selectedInvoice.balance_due) {
      setError(`Amount cannot exceed balance of ${formatCurrency(selectedInvoice.balance_due)}`)
      return
    }

    setIsSubmitting(true)

    try {
      // Create payment and apply to invoice
      const response = await fetch('/api/payment-applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          invoiceId: selectedInvoice.id,
          amount: amountNum,
          method,
          memo: memo || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to apply payment')
      }

      // Close drawer
      onOpenChange(false)

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error applying payment:', err)
      setError(err instanceof Error ? err.message : 'Failed to apply payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        {step === 'list' ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Apply Payment to Invoice</DrawerTitle>
              <DrawerDescription>
                Select an invoice for {customerName} to apply payment
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 pb-4 overflow-auto">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No open invoices with outstanding balance
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      onClick={() => handleSelectInvoice(invoice)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {invoice.invoice_number}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Due: {formatDate(invoice.due_date)}
                          </div>
                        </div>
                        <Badge variant="outline">{invoice.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Total</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(invoice.total_amount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Applied</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(invoice.deposit_applied + invoice.total_paid)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Balance</div>
                          <div className="font-medium text-blue-600 dark:text-blue-400">
                            {formatCurrency(invoice.balance_due)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DrawerTitle>Apply Payment</DrawerTitle>
                  <DrawerDescription>
                    {selectedInvoice?.invoice_number} - Balance: {formatCurrency(selectedInvoice?.balance_due || 0)}
                  </DrawerDescription>
                </div>
              </div>
            </DrawerHeader>

            <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedInvoice?.balance_due}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Maximum: {formatCurrency(selectedInvoice?.balance_due || 0)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Payment Method *</Label>
                <Select
                  value={method}
                  onValueChange={(value) => setMethod(value as PaymentMethod)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memo">Memo</Label>
                <Input
                  id="memo"
                  type="text"
                  placeholder="Optional note about this payment"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>

              <DrawerFooter className="px-0">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Apply Payment'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
              </DrawerFooter>
            </form>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
