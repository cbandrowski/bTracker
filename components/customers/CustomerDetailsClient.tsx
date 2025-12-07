'use client'

import { Customer, CustomerJob, CustomerInvoice, CustomerPayment, CustomerStats } from '@/types/customer-details'
import { CustomerHeader } from './CustomerHeader'
import { CustomerInfoPanel } from './CustomerInfoPanel'
import { CustomerStatsGrid } from './CustomerStatsGrid'
import { CustomerTabs } from './CustomerTabs'

interface CustomerDetailsClientProps {
  customer: Customer
  jobs: CustomerJob[]
  invoices: CustomerInvoice[]
  payments: CustomerPayment[]
  stats: CustomerStats
}

export function CustomerDetailsClient({
  customer,
  jobs,
  invoices,
  payments,
  stats,
}: CustomerDetailsClientProps) {
  return (
    <>
      {/* Header */}
      <CustomerHeader customer={customer} />

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer Info */}
        <div className="lg:col-span-1" id="customer-info-panel">
          <CustomerInfoPanel customer={customer} />
        </div>

        {/* Right: Stats Grid */}
        <div className="lg:col-span-2">
          <CustomerStatsGrid stats={stats} />
        </div>
      </div>

      {/* Tabs: Jobs / Invoices & Payments / Notes */}
      <CustomerTabs
        customerId={customer.id}
        jobs={jobs}
        invoices={invoices}
        payments={payments}
        customerNotes={customer.notes}
      />
    </>
  )
}
