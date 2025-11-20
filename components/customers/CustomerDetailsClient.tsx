'use client'

import { useRef } from 'react'
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
  const infoPanelRef = useRef<{ scrollIntoEdit: () => void }>(null)

  const handleEditClick = () => {
    // Scroll to info panel and trigger edit mode
    const infoPanelElement = document.getElementById('customer-info-panel')
    if (infoPanelElement) {
      infoPanelElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Small delay to allow scroll to complete before triggering edit
      setTimeout(() => {
        const editButton = infoPanelElement.querySelector('button')
        if (editButton) {
          editButton.click()
        }
      }, 300)
    }
  }

  return (
    <>
      {/* Header */}
      <CustomerHeader customer={customer} onEditClick={handleEditClick} />

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
