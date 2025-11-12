'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCustomersWithBilling, CustomerWithBilling } from '@/app/actions/customers'
import { CustomersTable } from '@/components/customers/CustomersTable'
import { AddPaymentDrawer } from '@/components/customers/AddPaymentDrawer'
import { ApplyPaymentDrawer } from '@/components/billing/ApplyPaymentDrawer'
import { CustomersTableSkeleton } from '@/components/customers/CustomersTableSkeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

type JobStatusFilter = 'all' | 'with-jobs' | 'unassigned' | 'assigned' | 'in-progress' | 'done' | 'no-active-jobs'

export default function BillingCustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerWithBilling[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerWithBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [jobStatusFilter, setJobStatusFilter] = useState<JobStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [depositDrawerOpen, setDepositDrawerOpen] = useState(false)
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<{
    id: string
    name: string
  } | null>(null)

  // Fetch customers with job status information
  const fetchCustomersData = async () => {
    try {
      setLoading(true)
      const billingData = await getCustomersWithBilling()

      // Fetch job status for each customer
      const customersWithJobs = await Promise.all(
        billingData.map(async (customer) => {
          try {
            const response = await fetch(`/api/customers/${customer.id}/job-status`)
            if (response.ok) {
              const jobData = await response.json()
              return { ...customer, jobStatus: jobData }
            }
          } catch (error) {
            console.error('Error fetching job status:', error)
          }
          return { ...customer, jobStatus: { hasActiveJobs: false, statusCounts: {} } }
        })
      )

      setCustomers(customersWithJobs)
      setFilteredCustomers(customersWithJobs)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomersData()
  }, [])

  // Filter customers based on job status and search
  useEffect(() => {
    let filtered = [...customers]

    // Apply job status filter
    if (jobStatusFilter !== 'all') {
      filtered = filtered.filter((customer: any) => {
        const jobStatus = customer.jobStatus || { hasActiveJobs: false, statusCounts: {} }

        switch (jobStatusFilter) {
          case 'no-active-jobs':
            return !jobStatus.hasActiveJobs
          case 'with-jobs':
            return jobStatus.hasActiveJobs
          case 'unassigned':
            return (jobStatus.statusCounts?.unassigned || 0) > 0
          case 'assigned':
            return (jobStatus.statusCounts?.assigned || 0) > 0
          case 'in-progress':
            return (jobStatus.statusCounts?.in_progress || 0) > 0
          case 'done':
            return (jobStatus.statusCounts?.done || 0) > 0
          default:
            return true
        }
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.phone?.toLowerCase().includes(query)
      )
    }

    setFilteredCustomers(filtered)
  }, [jobStatusFilter, searchQuery, customers])

  const handleAddDeposit = (customerId: string, customerName: string) => {
    setSelectedCustomerForPayment({ id: customerId, name: customerName })
    setDepositDrawerOpen(true)
  }

  const handleAddPayment = (customerId: string, customerName: string) => {
    setSelectedCustomerForPayment({ id: customerId, name: customerName })
    setPaymentDrawerOpen(true)
  }

  const handlePaymentSuccess = () => {
    fetchCustomersData()
  }

  const handleEditCustomer = (customer: CustomerWithBilling) => {
    // Navigate to customer billing page
    router.push(`/dashboard/owner/billing/customers/${customer.id}`)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/owner/billing')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Billing Customers</h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage customer billing and create invoices
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-gray-800 p-4 rounded-lg border border-gray-700">
        <div className="flex-1">
          <Input
            placeholder="Search customers by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-900 border-gray-600"
          />
        </div>
        <div className="w-64">
          <Select value={jobStatusFilter} onValueChange={(value) => setJobStatusFilter(value as JobStatusFilter)}>
            <SelectTrigger className="bg-gray-900 border-gray-600">
              <SelectValue placeholder="Filter by job status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              <SelectItem value="no-active-jobs">No Active Jobs</SelectItem>
              <SelectItem value="with-jobs">With Active Jobs</SelectItem>
              <SelectItem value="unassigned">Unassigned Jobs</SelectItem>
              <SelectItem value="assigned">Assigned Jobs</SelectItem>
              <SelectItem value="in-progress">In Progress Jobs</SelectItem>
              <SelectItem value="done">Done Jobs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-400">
        Showing {filteredCustomers.length} of {customers.length} customers
      </div>

      {/* Customers Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        {loading ? (
          <CustomersTableSkeleton />
        ) : (
          <CustomersTable
            customers={filteredCustomers}
            onAddDeposit={handleAddDeposit}
            onAddPayment={handleAddPayment}
            onEditCustomer={handleEditCustomer}
          />
        )}
      </div>

      {/* Add Deposit Drawer */}
      {selectedCustomerForPayment && (
        <AddPaymentDrawer
          open={depositDrawerOpen}
          onOpenChange={setDepositDrawerOpen}
          customerId={selectedCustomerForPayment.id}
          customerName={selectedCustomerForPayment.name}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Add Payment Drawer */}
      {selectedCustomerForPayment && (
        <ApplyPaymentDrawer
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          customerId={selectedCustomerForPayment.id}
          customerName={selectedCustomerForPayment.name}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
