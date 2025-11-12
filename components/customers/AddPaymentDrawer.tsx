'use client'

import { useState } from 'react'
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

interface AddPaymentDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  onSuccess?: () => void
}

type PaymentMethod = 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other'
type DepositType = 'general' | 'parts' | 'supplies'

export function AddPaymentDrawer({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: AddPaymentDrawerProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [depositType, setDepositType] = useState<DepositType>('general')
  const [memo, setMemo] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          amount: amountNum,
          method,
          depositType,
          memo: memo || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create payment')
      }

      const result = await response.json()
      console.log('Payment created:', result)

      // Reset form
      setAmount('')
      setMethod('check')
      setDepositType('general')
      setMemo('')

      // Close drawer
      onOpenChange(false)

      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Error creating payment:', err)
      setError(err instanceof Error ? err.message : 'Failed to create payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setAmount('')
    setMethod('check')
    setDepositType('general')
    setMemo('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add Deposit</DrawerTitle>
          <DrawerDescription>
            Create a deposit for {customerName} that can be applied to invoices later
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={isSubmitting}
            />
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
            <Label htmlFor="depositType">Deposit Type</Label>
            <Select
              value={depositType}
              onValueChange={(value) => setDepositType(value as DepositType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="depositType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="parts">Parts</SelectItem>
                <SelectItem value="supplies">Supplies</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Optional: Categorize this deposit for tracking purposes
            </p>
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
              {isSubmitting ? 'Creating...' : 'Create Deposit'}
            </Button>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
