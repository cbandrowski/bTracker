'use client'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DollarSign, CreditCard, FileText, AlertCircle, TrendingUp } from 'lucide-react'

interface BillingStats {
  totalRevenue: number
  totalOutstanding: number
  totalUnappliedCredit: number
  openInvoicesCount: number
  overdueInvoicesCount: number
}

interface BillingStatsCardsProps {
  stats: BillingStats | null
  loading: boolean
}

export function BillingStatsCards({ stats, loading }: BillingStatsCardsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Revenue */}
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          <TrendingUp className="h-4 w-4" />
          <span>Total Revenue</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {formatCurrency(stats.totalRevenue)}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          From paid invoices
        </p>
      </div>

      {/* Total Outstanding */}
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          <DollarSign className="h-4 w-4" />
          <span>Outstanding</span>
        </div>
        <div className="text-2xl font-bold mb-2">
          <Badge
            variant={stats.totalOutstanding > 0 ? 'destructive' : 'secondary'}
            className="text-lg px-3 py-1"
          >
            {formatCurrency(stats.totalOutstanding)}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Unpaid invoice balance
        </p>
      </div>

      {/* Unapplied Credit */}
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          <CreditCard className="h-4 w-4" />
          <span>Unapplied Credit</span>
        </div>
        <div className="text-2xl font-bold mb-2">
          <Badge
            variant={stats.totalUnappliedCredit > 0 ? 'default' : 'secondary'}
            className="text-lg px-3 py-1"
          >
            {formatCurrency(stats.totalUnappliedCredit)}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Available to apply
        </p>
      </div>

      {/* Open Invoices */}
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          <FileText className="h-4 w-4" />
          <span>Open Invoices</span>
        </div>
        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {stats.openInvoicesCount}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Awaiting payment
        </p>
      </div>

      {/* Overdue Invoices */}
      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          <AlertCircle className="h-4 w-4" />
          <span>Overdue</span>
        </div>
        <div className="text-2xl font-bold mb-2">
          {stats.overdueInvoicesCount > 0 ? (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {stats.overdueInvoicesCount}
            </Badge>
          ) : (
            <span className="text-gray-900 dark:text-gray-100">0</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Past due date
        </p>
      </div>
    </div>
  )
}
