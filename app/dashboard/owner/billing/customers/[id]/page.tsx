'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, CreditCard, ArrowLeft } from 'lucide-react'
import {
  useCustomerBillingHeader,
  useUnpaidJobs,
  useUnappliedPayments,
  useCreateInvoice,
} from '@/hooks/useCustomerBilling'
import { UnpaidJobsTable } from '@/components/billing/UnpaidJobsTable'
import { DepositsList } from '@/components/billing/DepositsList'
import { InlineInvoiceForm } from '@/components/billing/InlineInvoiceForm'
import { InvoicesList } from '@/components/billing/InvoicesList'
import { AddPaymentDrawer } from '@/components/customers/AddPaymentDrawer'
import { ApplyPaymentDrawer } from '@/components/billing/ApplyPaymentDrawer'
import { useToast } from '@/hooks/useToast'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CustomerBillingPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const customerId = resolvedParams.id
  const router = useRouter()
  const { toast } = useToast()

  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [depositDrawerOpen, setDepositDrawerOpen] = useState(false)
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set())
  const [customerName, setCustomerName] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [companyInfo, setCompanyInfo] = useState<any>(null)

  const billingHeader = useCustomerBillingHeader(customerId)
  const unpaidJobs = useUnpaidJobs(customerId)
  const unappliedPayments = useUnappliedPayments(customerId)
  const { createInvoice, loading: creatingInvoice } = useCreateInvoice()

  // Fetch customer name and company info
  useEffect(() => {
    async function fetchCustomer() {
      try {
        const response = await fetch(`/api/customers/${customerId}`)
        if (response.ok) {
          const data = await response.json()
          setCustomerName(data.name)
        }
      } catch (error) {
        console.error('Error fetching customer:', error)
      }
    }

    async function fetchCompanyInfo() {
      try {
        const response = await fetch('/api/companies')
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0) {
            setCompanyInfo(data[0])
          }
        }
      } catch (error) {
        console.error('Error fetching company info:', error)
      }
    }

    fetchCustomer()
    fetchCompanyInfo()
  }, [customerId])

  // Fetch invoices
  useEffect(() => {
    async function fetchInvoices() {
      try {
        setInvoicesLoading(true)
        const response = await fetch(`/api/customers/${customerId}/invoices`)
        if (response.ok) {
          const data = await response.json()
          setInvoices(data.invoices || [])
        }
      } catch (error) {
        console.error('Error fetching invoices:', error)
      } finally {
        setInvoicesLoading(false)
      }
    }
    fetchInvoices()
  }, [customerId])

  const refreshAllData = () => {
    billingHeader.refresh()
    unpaidJobs.refresh()
    unappliedPayments.refresh()
    // Refresh invoices
    fetch(`/api/customers/${customerId}/invoices`)
      .then(res => res.json())
      .then(data => setInvoices(data.invoices || []))
      .catch(console.error)
  }

  const handleCreateInvoice = (jobIds: string[]) => {
    setSelectedJobIds(jobIds)
    setShowInvoiceForm(true)
  }

  const handleToggleDeposit = (depositId: string, checked: boolean) => {
    const newSelected = new Set(selectedDepositIds)
    if (checked) {
      newSelected.add(depositId)
    } else {
      newSelected.delete(depositId)
    }
    setSelectedDepositIds(newSelected)
  }

  const handleInvoiceSubmit = async (data: any) => {
    try {
      // Generate idempotency key
      const idempotencyKey = `invoice-${customerId}-${Date.now()}`

      const result = await createInvoice(
        {
          customerId,
          jobIds: data.jobIds,
          lines: data.lines,
          depositIds: data.depositIds,
          terms: data.terms,
          issueNow: data.issueNow,
          dueDate: data.dueDate,
        },
        idempotencyKey
      )

      toast({
        variant: 'success',
        title: 'Invoice Created',
        description: `Invoice ${result.invoiceNumber} created successfully. Balance: ${formatCurrency(result.summary.balance)}`,
      })

      refreshAllData()
      setSelectedJobIds([])
      setSelectedDepositIds(new Set())
      setShowInvoiceForm(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
      })
      throw error
    }
  }

  const handleCancelInvoice = () => {
    setShowInvoiceForm(false)
    setSelectedJobIds([])
    setSelectedDepositIds(new Set())
  }

  const handlePaymentSuccess = () => {
    toast({
      variant: 'success',
      title: 'Payment Added',
      description: 'Payment/deposit has been recorded successfully',
    })
    refreshAllData()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/owner/billing/customers')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Billing</h1>
            <p className="text-sm text-gray-400">
              {customerName || 'Loading...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setDepositDrawerOpen(true)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Add Deposit
          </Button>
          <Button
            variant="outline"
            onClick={() => setPaymentDrawerOpen(true)}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Add Payment
          </Button>
          <Button
            onClick={() => handleCreateInvoice([])}
            disabled={unpaidJobs.loading}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Billing Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 bg-gray-800">
          <div className="text-sm font-medium text-gray-400">
            Billed Balance
          </div>
          {billingHeader.loading ? (
            <Skeleton className="h-8 w-32 mt-2" />
          ) : (
            <div className="mt-2 text-2xl font-bold">
              <Badge
                variant={
                  (billingHeader.data?.billedBalance || 0) > 0
                    ? 'destructive'
                    : 'secondary'
                }
                className="text-lg px-3 py-1"
              >
                {formatCurrency(billingHeader.data?.billedBalance || 0)}
              </Badge>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Total invoiced minus payments
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-gray-800">
          <div className="text-sm font-medium text-gray-400">
            Unapplied Credit
          </div>
          {billingHeader.loading ? (
            <Skeleton className="h-8 w-32 mt-2" />
          ) : (
            <div className="mt-2 text-2xl font-bold">
              <Badge
                variant={(billingHeader.data?.unappliedCredit || 0) > 0 ? 'default' : 'secondary'}
                className="text-lg px-3 py-1"
              >
                {formatCurrency(billingHeader.data?.unappliedCredit || 0)}
              </Badge>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Available to apply to invoices
          </p>
        </div>

        <div className="rounded-lg border p-4 bg-gray-800">
          <div className="text-sm font-medium text-gray-400">
            Open Invoices
          </div>
          {billingHeader.loading ? (
            <Skeleton className="h-8 w-32 mt-2" />
          ) : (
            <div className="mt-2 text-2xl font-bold text-white">
              {billingHeader.data?.openInvoices || 0}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Unpaid or partially paid
          </p>
        </div>
      </div>

      {/* Unpaid Done Jobs */}
      <div className="rounded-lg border p-6 bg-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Unpaid Done Jobs</h2>
        <UnpaidJobsTable
          jobs={unpaidJobs.data}
          loading={unpaidJobs.loading}
          onCreateInvoice={handleCreateInvoice}
        />
      </div>

      {/* Deposits Available */}
      {unappliedPayments.data && unappliedPayments.data.items.length > 0 && !showInvoiceForm && (
        <div className="rounded-lg border p-6 bg-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Deposits Available</h2>
          <DepositsList
            deposits={unappliedPayments.data.items}
            loading={unappliedPayments.loading}
            selectedDepositIds={selectedDepositIds}
            onToggleDeposit={handleToggleDeposit}
          />
        </div>
      )}

      {/* Inline Invoice Form */}
      {showInvoiceForm && (
        <InlineInvoiceForm
          selectedJobIds={selectedJobIds}
          jobs={unpaidJobs.data}
          deposits={unappliedPayments.data?.items || []}
          companyInfo={companyInfo}
          customerId={customerId}
          onSubmit={handleInvoiceSubmit}
          onCancel={handleCancelInvoice}
        />
      )}

      {/* Invoices List */}
      <div className="rounded-lg border p-6 bg-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">Invoices</h2>
        <InvoicesList invoices={invoices} loading={invoicesLoading} />
      </div>

      {/* Add Deposit Drawer */}
      {customerName && (
        <AddPaymentDrawer
          open={depositDrawerOpen}
          onOpenChange={setDepositDrawerOpen}
          customerId={customerId}
          customerName={customerName}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Add Payment Drawer */}
      {customerName && (
        <ApplyPaymentDrawer
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          customerId={customerId}
          customerName={customerName}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  )
}
