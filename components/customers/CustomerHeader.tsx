'use client'

import { Customer } from '@/types/customer-details'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, FileText, CreditCard, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CustomerHeaderProps {
  customer: Customer
}

export function CustomerHeader({ customer }: CustomerHeaderProps) {
  const router = useRouter()
  const [isActive] = useState(true) // TODO: Add customer status to schema if needed
  const [deleting, setDeleting] = useState(false)

  const handleNewJob = () => {
    // TODO: Navigate to job creation with prefilled customerId
    router.push(`/dashboard/owner/jobs/new?customerId=${customer.id}`)
  }

  const handleNewInvoice = () => {
    // TODO: Navigate to invoice creation with prefilled customerId
    router.push(`/dashboard/owner/invoices/new?customerId=${customer.id}`)
  }

  const handleAddPayment = () => {
    // TODO: Open payment drawer or navigate to payment page
    router.push(`/dashboard/owner/customers/${customer.id}/billing`)
  }

  const handleDeleteCustomer = async () => {
    const confirmed = window.confirm('Delete this customer? This action cannot be undone.')
    if (!confirmed) return

    try {
      setDeleting(true)
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete customer')
      }
      router.push('/dashboard/owner/customers')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete customer')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left side: Customer info */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/owner/customers')}
            className="mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {customer.name}
              </h1>
              {isActive && (
                <Badge variant="default">Active</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Phone:</span> {customer.phone}
                </span>
              )}
              {customer.email && (
                <span className="flex items-center gap-1">
                  <span className="font-medium">Email:</span> {customer.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewJob}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Job
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNewInvoice}
          >
            <FileText className="h-4 w-4 mr-1" />
            New Invoice
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddPayment}
          >
            <CreditCard className="h-4 w-4 mr-1" />
            Add Payment
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteCustomer}
            disabled={deleting}
            className="w-full sm:w-auto"
          >
            <Trash className="h-4 w-4 mr-1" />
            {deleting ? 'Deleting...' : 'Delete Customer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
