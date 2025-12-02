'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FilePlus2 } from 'lucide-react'
import { InlineInvoiceForm } from '@/components/billing/InlineInvoiceForm'
import { useUnappliedPayments, useCreateInvoice } from '@/hooks/useCustomerBilling'
import { useToast } from '@/hooks/useToast'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ManualInvoicePage({ params }: PageProps) {
  const resolvedParams = use(params)
  const customerId = resolvedParams.id
  const router = useRouter()
  const { toast } = useToast()

  const [customerName, setCustomerName] = useState<string>('')
  const { data: depositsResponse, loading: depositsLoading } = useUnappliedPayments(customerId)
  const { createInvoice, loading: creatingInvoice } = useCreateInvoice()

  // Fetch customer display name for header context
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`)
        if (response.ok) {
          const data = await response.json()
          setCustomerName(data.name || '')
        }
      } catch (error) {
        console.error('Error fetching customer for manual invoice:', error)
      }
    }
    fetchCustomer()
  }, [customerId])

  const deposits = useMemo(() => depositsResponse?.items || [], [depositsResponse])

  const handleSubmit = async (formData: {
    jobIds: string[]
    lines: { description: string; quantity: number; unitPrice: number; taxRate: number }[]
    depositIds: string[]
    terms: string
    issueNow: boolean
    dueDate?: string
  }) => {
    const idempotencyKey = `manual-invoice-${customerId}-${Date.now()}`
    const payload = {
      customerId,
      jobIds: formData.jobIds,
      lines: formData.lines,
      depositIds: formData.depositIds,
      terms: formData.terms,
      issueNow: formData.issueNow,
      dueDate: formData.dueDate,
    }

    try {
      const result = await createInvoice(payload, idempotencyKey)
      toast({
        variant: 'success',
        title: 'Invoice Created',
        description: `Invoice ${result.invoiceNumber} created successfully.`,
      })
      router.push(`/dashboard/owner/billing/customers/${customerId}`)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Creating Invoice',
        description: error instanceof Error ? error.message : 'Failed to create invoice',
      })
      throw error
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/owner/billing/customers/${customerId}`)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Billing
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FilePlus2 className="h-5 w-5" />
              Manual Invoice
            </h1>
            <p className="text-sm text-muted-foreground">
              {customerName ? `Creating for ${customerName}` : 'Select items and totals'}
            </p>
          </div>
        </div>
      </div>

      <InlineInvoiceForm
        selectedJobIds={[]}
        jobs={[]}
        deposits={deposits}
        companyInfo={null}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        key={`${customerId}-${creatingInvoice}`}
      />

      {depositsLoading && (
        <p className="text-sm text-muted-foreground">Loading deposits...</p>
      )}
    </div>
  )
}
