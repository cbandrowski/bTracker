'use client'

import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'

interface UnappliedPayment {
  paymentId: string
  date: string
  amount: number
  depositType: string | null
  jobId: string | null
  jobTitle: string | null
  memo: string | null
  unappliedAmount: number
}

interface DepositsListProps {
  deposits: UnappliedPayment[]
  loading: boolean
  selectedDepositIds: Set<string>
  onToggleDeposit: (depositId: string, checked: boolean) => void
}

export function DepositsList({
  deposits,
  loading,
  selectedDepositIds,
  onToggleDeposit,
}: DepositsListProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getDepositTypeColor = (type: string | null) => {
    if (!type) return 'secondary'
    switch (type.toLowerCase()) {
      case 'parts':
        return 'default'
      case 'supplies':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (deposits.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No unapplied deposits available
        </p>
      </div>
    )
  }

  const totalSelected = Array.from(selectedDepositIds).reduce((sum, id) => {
    const deposit = deposits.find(d => d.paymentId === id)
    return sum + (deposit?.unappliedAmount || 0)
  }, 0)

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        <p>
          <strong>Info:</strong> Selected deposits will be added as negative "Deposit Applied" lines on the invoice.
        </p>
        {selectedDepositIds.size > 0 && (
          <p className="mt-1">
            <strong>Total selected:</strong> {formatCurrency(totalSelected)}
          </p>
        )}
      </div>

      {/* Deposits list */}
      <div className="space-y-2">
        {deposits.map((deposit) => {
          const isSelected = selectedDepositIds.has(deposit.paymentId)
          return (
            <div
              key={deposit.paymentId}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800'
              }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) =>
                  onToggleDeposit(deposit.paymentId, checked as boolean)
                }
                aria-label={`Select deposit from ${formatDate(deposit.date)}`}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {formatCurrency(deposit.unappliedAmount)}
                  </span>
                  {deposit.depositType && (
                    <Badge variant={getDepositTypeColor(deposit.depositType) as any}>
                      {deposit.depositType}
                    </Badge>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(deposit.date)}
                  </span>
                </div>
                {deposit.jobTitle && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Related to: {deposit.jobTitle}
                  </div>
                )}
                {deposit.memo && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {deposit.memo}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
