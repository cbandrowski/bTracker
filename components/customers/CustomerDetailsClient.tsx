'use client'

import { useState } from 'react'
import { Customer, CustomerJob, CustomerInvoice, CustomerPayment, CustomerStats } from '@/types/customer-details'
import { CustomerServiceAddress } from '@/types/database'
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
  serviceAddresses: CustomerServiceAddress[]
}

export function CustomerDetailsClient({
  customer,
  jobs,
  invoices,
  payments,
  stats,
  serviceAddresses,
}: CustomerDetailsClientProps) {
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>(serviceAddresses)

  const handleAddressAdded = (addr: CustomerServiceAddress) => {
    setAddresses((prev) => [...prev, addr])
  }

  const handleAddressUpdated = (addr: CustomerServiceAddress) => {
    setAddresses((prev) => prev.map((a) => (a.id === addr.id ? addr : a)))
  }

  const handleAddressDeleted = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <>
      {/* Header */}
      <CustomerHeader customer={customer} />

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer Info */}
        <div className="lg:col-span-1 space-y-4" id="customer-info-panel">
          <CustomerInfoPanel
            customer={customer}
            serviceAddresses={addresses}
            onAddressCreated={handleAddressAdded}
            onAddressUpdated={handleAddressUpdated}
            onAddressDeleted={handleAddressDeleted}
          />
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
