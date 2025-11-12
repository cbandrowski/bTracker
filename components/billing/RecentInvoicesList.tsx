'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface RecentInvoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  status: string
  due_date: string | null
  total: number
  paid_amount?: number
  created_at: string
}

interface RecentInvoicesListProps {
  invoices: RecentInvoice[]
  loading: boolean
}

export function RecentInvoicesList({ invoices, loading }: RecentInvoicesListProps) {
  const router = useRouter()

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

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'default'
      case 'partial':
        return 'outline'
      case 'issued':
        return 'secondary'
      case 'draft':
        return 'secondary'
      case 'void':
      case 'cancelled':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No invoices yet
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => {
        const total = Number(invoice.total || 0)
        const paidAmount = Number(invoice.paid_amount || 0)
        const balance = total - paidAmount
        const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && balance > 0

        return (
          <div
            key={invoice.id}
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {invoice.invoice_number}
                </span>
                <Badge variant={getStatusVariant(invoice.status) as any}>
                  {invoice.status}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {invoice.customer_name}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {formatCurrency(balance)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  of {formatCurrency(total)}
                </div>
              </div>

              <div className="text-right min-w-[100px]">
                <div className="text-sm text-gray-500 dark:text-gray-400">Due</div>
                <div className="text-sm font-medium">{formatDate(invoice.due_date)}</div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard/owner/invoices/${invoice.id}`)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
