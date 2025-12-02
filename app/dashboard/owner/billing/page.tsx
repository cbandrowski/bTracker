'use client'

import { useState, useEffect } from 'react'
import { BillingStatsCards } from '@/components/billing/BillingStatsCards'
import { RecentInvoicesList } from '@/components/billing/RecentInvoicesList'
import { CustomersBalanceList } from '@/components/billing/CustomersBalanceList'
import { UnbilledJobsTable } from '@/components/billing/UnbilledJobsTable'
import {
  useBillingStats,
  useRecentInvoices,
  useCustomersWithBalance,
} from '@/hooks/useBillingOverview'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function BillingPage() {
  const router = useRouter()
  const billingStats = useBillingStats()
  const recentInvoices = useRecentInvoices(10)
  const customersBalance = useCustomersWithBalance()
  const [unbilledJobs, setUnbilledJobs] = useState<any[]>([])
  const [unbilledLoading, setUnbilledLoading] = useState(true)

  const fetchUnbilledJobs = async () => {
    try {
      setUnbilledLoading(true)
      const response = await fetch('/api/billing/unbilled-jobs')
      if (response.ok) {
        const data = await response.json()
        setUnbilledJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching unbilled jobs:', error)
    } finally {
      setUnbilledLoading(false)
    }
  }

  useEffect(() => {
    fetchUnbilledJobs()
  }, [])

  const handleRefresh = () => {
    billingStats.refresh()
    recentInvoices.refresh()
    customersBalance.refresh()
    fetchUnbilledJobs()
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold guild-heading">Billing Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage invoices, payments, and customer balances
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={billingStats.loading || recentInvoices.loading || customersBalance.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${
              (billingStats.loading || recentInvoices.loading || customersBalance.loading) ? 'animate-spin' : ''
            }`} />
            Refresh
          </Button>
          <Button
            onClick={() => router.push('/dashboard/owner/billing/customers')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <BillingStatsCards stats={billingStats.data} loading={billingStats.loading} />

      {/* Unbilled Jobs Table */}
      <div className="rounded-lg border-border p-6 glass-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold guild-heading">
              Unbilled Jobs
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Completed jobs ready to be invoiced. Click a row to create an invoice.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/owner/billing/customers')}
          >
            View All Customers
          </Button>
        </div>
        <UnbilledJobsTable jobs={unbilledJobs} loading={unbilledLoading} />
      </div>

      {/* Two Column Layout - Side by side on all screen sizes */}
      <div className="grid grid-cols-2 gap-3 sm:gap-6">
        {/* Recent Invoices */}
        <div className="rounded-lg border-border p-3 sm:p-6 glass-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="text-sm sm:text-lg font-semibold guild-heading">
              Recent Invoices
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/owner/billing/customers')}
              className="text-xs sm:text-sm self-start sm:self-auto"
            >
              View All
            </Button>
          </div>
          <RecentInvoicesList
            invoices={recentInvoices.data}
            loading={recentInvoices.loading}
          />
        </div>

        {/* Customers with Outstanding Balance */}
        <div className="rounded-lg border-border p-3 sm:p-6 glass-surface">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-2">
            <h2 className="text-sm sm:text-lg font-semibold guild-heading">
              Outstanding Balances
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/owner/billing/customers')}
              className="text-xs sm:text-sm self-start sm:self-auto"
            >
              View All
            </Button>
          </div>
          <CustomersBalanceList
            customers={customersBalance.data}
            loading={customersBalance.loading}
          />
        </div>
      </div>

    </div>
  )
}
