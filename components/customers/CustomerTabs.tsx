'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CustomerJob, CustomerInvoice, CustomerPayment } from '@/types/customer-details'
import { CustomerJobsTab } from './CustomerJobsTab'
import { CustomerBillingTab } from './CustomerBillingTab'
import { CustomerNotesTab } from './CustomerNotesTab'

interface CustomerTabsProps {
  customerId: string
  jobs: CustomerJob[]
  invoices: CustomerInvoice[]
  payments: CustomerPayment[]
  customerNotes: string | null
}

export function CustomerTabs({
  customerId,
  jobs,
  invoices,
  payments,
  customerNotes,
}: CustomerTabsProps) {
  const [activeTab, setActiveTab] = useState('jobs')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
        <TabsTrigger value="jobs">
          Jobs ({jobs.length})
        </TabsTrigger>
        <TabsTrigger value="billing">
          Invoices & Payments
        </TabsTrigger>
        <TabsTrigger value="notes">
          Notes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="jobs" className="mt-6">
        <CustomerJobsTab customerId={customerId} jobs={jobs} />
      </TabsContent>

      <TabsContent value="billing" className="mt-6">
        <CustomerBillingTab
          customerId={customerId}
          invoices={invoices}
          payments={payments}
        />
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        <CustomerNotesTab notes={customerNotes} />
      </TabsContent>
    </Tabs>
  )
}
