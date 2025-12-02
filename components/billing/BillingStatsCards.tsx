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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
            <Skeleton className="h-3 sm:h-4 w-16 sm:w-24 mb-2 sm:mb-3" />
            <Skeleton className="h-6 sm:h-8 w-20 sm:w-32 mb-1 sm:mb-2" />
            <Skeleton className="h-2 sm:h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
      {/* Total Revenue */}
      <div className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="line-clamp-1">Total Revenue</span>
        </div>
        <div className="text-base sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2 line-clamp-1">
          {formatCurrency(stats.totalRevenue)}
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          From paid invoices
        </p>
      </div>

      {/* Total Outstanding */}
      <div className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="line-clamp-1">Outstanding</span>
        </div>
        <div className="text-base sm:text-2xl font-bold mb-1 sm:mb-2">
          <Badge
            variant={stats.totalOutstanding > 0 ? 'destructive' : 'secondary'}
            className="text-xs sm:text-lg px-2 sm:px-3 py-0.5 sm:py-1"
          >
            {formatCurrency(stats.totalOutstanding)}
          </Badge>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          Unpaid balance
        </p>
      </div>

      {/* Unapplied Credit */}
      <div className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
          <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="line-clamp-1">Unapplied Credit</span>
        </div>
        <div className="text-base sm:text-2xl font-bold mb-1 sm:mb-2">
          <Badge
            variant={stats.totalUnappliedCredit > 0 ? 'default' : 'secondary'}
            className="text-xs sm:text-lg px-2 sm:px-3 py-0.5 sm:py-1"
          >
            {formatCurrency(stats.totalUnappliedCredit)}
          </Badge>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          Available to apply
        </p>
      </div>

      {/* Open Invoices */}
      <div className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="line-clamp-1">Open Invoices</span>
        </div>
        <div className="text-base sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
          {stats.openInvoicesCount}
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          Awaiting payment
        </p>
      </div>

      {/* Overdue Invoices */}
      <div className="rounded-lg border p-3 sm:p-6 bg-white dark:bg-gray-800 aspect-square flex flex-col justify-center">
        <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
          <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="line-clamp-1">Overdue</span>
        </div>
        <div className="text-base sm:text-2xl font-bold mb-1 sm:mb-2">
          {stats.overdueInvoicesCount > 0 ? (
            <Badge variant="destructive" className="text-xs sm:text-lg px-2 sm:px-3 py-0.5 sm:py-1">
              {stats.overdueInvoicesCount}
            </Badge>
          ) : (
            <span className="text-gray-900 dark:text-gray-100">0</span>
          )}
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          Past due date
        </p>
      </div>
    </div>
  )
}
