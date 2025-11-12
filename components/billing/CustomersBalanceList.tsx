'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CustomerBalance {
  customer_id: string
  customer_name: string
  billedBalance: number
  unappliedCredit: number
  openInvoices: number
}

interface CustomersBalanceListProps {
  customers: CustomerBalance[]
  loading: boolean
}

export function CustomersBalanceList({ customers, loading }: CustomersBalanceListProps) {
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No customers with outstanding balance
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {customers.map((customer) => (
        <div
          key={customer.customer_id}
          className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {customer.customer_name}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {customer.openInvoices} open {customer.openInvoices === 1 ? 'invoice' : 'invoices'}
              </span>
              {customer.unappliedCredit > 0 && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {formatCurrency(customer.unappliedCredit)} credit available
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Outstanding
              </div>
              <Badge variant="destructive" className="font-mono">
                {formatCurrency(customer.billedBalance)}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/owner/customers/${customer.customer_id}/billing`)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
