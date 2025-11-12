'use client'

import React, { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Printer, Mail } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function InvoiceViewPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const invoiceId = resolvedParams.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [depositApplications, setDepositApplications] = useState<any[]>([])
  const [paymentApplications, setPaymentApplications] = useState<any[]>([])

  useEffect(() => {
    async function fetchInvoice() {
      try {
        setLoading(true)
        const response = await fetch(`/api/invoices/${invoiceId}`)
        if (response.ok) {
          const data = await response.json()
          setInvoice(data.invoice)
          setLines(data.lines)
          setCompany(data.company)
          setDepositApplications(data.deposit_applications || [])
          setPaymentApplications(data.payment_applications || [])
        }
      } catch (error) {
        console.error('Error fetching invoice:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchInvoice()
  }, [invoiceId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'partial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'issued':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'void':
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Invoice not found
          </h2>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const customer = invoice.customers

  // Group lines by job
  const groupedLines: { [key: string]: any[] } = {}
  const standaloneLines: any[] = []

  lines.forEach(line => {
    if (line.job_id && line.jobs) {
      if (!groupedLines[line.job_id]) {
        groupedLines[line.job_id] = []
      }
      groupedLines[line.job_id].push(line)
    } else {
      standaloneLines.push(line)
    }
  })

  // Calculate subtotal (excluding deposits)
  const subtotal = lines
    .filter(line => line.line_type !== 'deposit_applied')
    .reduce((sum, line) => {
      const lineTotal = Number(line.line_total || 0)
      return sum + lineTotal
    }, 0)

  // Calculate tax
  const taxTotal = lines
    .filter(line => line.line_type !== 'deposit_applied')
    .reduce((sum, line) => {
      const lineTotal = Number(line.line_total || 0)
      const taxRate = Number(line.tax_rate || 0)
      return sum + (lineTotal * taxRate)
    }, 0)

  // Total = subtotal + tax
  const total = subtotal + taxTotal

  // Deposits applied (negative amounts)
  const depositsApplied = lines
    .filter(line => line.line_type === 'deposit_applied')
    .reduce((sum, line) => sum + Math.abs(Number(line.line_total || 0)), 0)

  // Payments applied separately
  const paymentsApplied = Number(invoice.total_paid || 0)

  // Balance = total - deposits - payments
  const balance = total - depositsApplied - paymentsApplied

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header Actions */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Invoice Template */}
      <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden print:shadow-none">
        {/* Invoice Header */}
        <div className="border-b-4 border-blue-600 p-8 pb-6">
          <div className="flex justify-between items-start">
            {/* Company Info */}
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {company?.name || 'Company Name'}
              </h1>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {company?.address && <div>{company.address}</div>}
                {company?.address_line_2 && <div>{company.address_line_2}</div>}
                {company?.city && (
                  <div>
                    {company.city}, {company.state} {company.zipcode}
                  </div>
                )}
                {company?.phone && <div>Phone: {company.phone}</div>}
                {company?.email && <div>Email: {company.email}</div>}
              </div>
            </div>

            {/* Invoice Info */}
            <div className="text-right">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                INVOICE
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Invoice #:
                  </span>
                  <span className="text-gray-900 dark:text-white font-mono">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Date:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {formatDate(invoice.invoice_date)}
                  </span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Due Date:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    Status:
                  </span>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Section */}
        <div className="p-8 pb-6">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Bill To
            </h3>
            <div className="text-gray-900 dark:text-white">
              <div className="font-semibold text-lg mb-1">{customer?.name || 'Customer'}</div>
              {customer?.billing_address && (
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>{customer.billing_address}</div>
                  {customer.billing_address_line_2 && <div>{customer.billing_address_line_2}</div>}
                  {customer.billing_city && (
                    <div>
                      {customer.billing_city}, {customer.billing_state} {customer.billing_zipcode}
                    </div>
                  )}
                  {customer.email && <div className="mt-2">Email: {customer.email}</div>}
                  {customer.phone && <div>Phone: {customer.phone}</div>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="px-8 pb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Description
                </th>
                <th className="text-center py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-24">
                  Quantity
                </th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-32">
                  Unit Price
                </th>
                <th className="text-right py-3 text-sm font-bold text-gray-700 dark:text-gray-300 uppercase w-32">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Render grouped job lines */}
              {Object.entries(groupedLines).map(([jobId, jobLines]) => {
                const job = (jobLines[0].jobs as any)
                return (
                  <React.Fragment key={jobId}>
                    {/* Job Title Header */}
                    <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      <td colSpan={4} className="py-3 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {job?.title || 'Job'}
                        </div>
                      </td>
                    </tr>
                    {/* Job Line Items - Indented */}
                    {jobLines.map((line, index) => (
                      <tr
                        key={line.id}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''
                        }`}
                      >
                        <td className="py-3 pr-4 pl-8">
                          <div className="text-gray-900 dark:text-white">
                            {line.description}
                          </div>
                          {line.line_type !== 'service' && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {line.line_type}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-center text-gray-900 dark:text-white">
                          {Number(line.quantity).toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-gray-900 dark:text-white">
                          {formatCurrency(Number(line.unit_price))}
                        </td>
                        <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(Number(line.line_total))}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}

              {/* Render standalone lines (not linked to jobs) */}
              {standaloneLines.map((line, index) => (
                <tr
                  key={line.id}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    index % 2 === 0 && Object.keys(groupedLines).length % 2 === 0
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : index % 2 === 1 && Object.keys(groupedLines).length % 2 === 1
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : ''
                  }`}
                >
                  <td className="py-4 pr-4">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {line.description}
                    </div>
                    {line.line_type !== 'service' && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {line.line_type}
                      </div>
                    )}
                  </td>
                  <td className="py-4 text-center text-gray-900 dark:text-white">
                    {Number(line.quantity).toFixed(2)}
                  </td>
                  <td className="py-4 text-right text-gray-900 dark:text-white">
                    {formatCurrency(Number(line.unit_price))}
                  </td>
                  <td className="py-4 text-right font-medium text-gray-900 dark:text-white">
                    {formatCurrency(Number(line.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="px-8 pb-8">
          <div className="flex justify-end">
            <div className="w-80">
              <div className="space-y-3 border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                {taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(taxTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-gray-900 dark:text-white">Total:</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatCurrency(total)}
                  </span>
                </div>
                {depositsApplied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Deposits Applied:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(depositsApplied)}
                    </span>
                  </div>
                )}
                {paymentsApplied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Payments Applied:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(paymentsApplied)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold border-t-2 border-gray-200 dark:border-gray-700 pt-3">
                  <span className="text-gray-900 dark:text-white">Balance Due:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deposits and Payments Applied Section */}
        {(depositApplications.length > 0 || paymentApplications.length > 0) && (
          <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              Deposits & Payments Applied
            </h3>
            <div className="space-y-3">
              {/* Deposit Applications */}
              {depositApplications.map((app, index) => (
                <div
                  key={`deposit-${index}`}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-green-900 dark:text-green-100">
                        {formatCurrency(Number(app.applied_amount))}
                      </div>
                      <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        Deposit
                        {app.payments?.deposit_type && ` - ${app.payments.deposit_type}`}
                      </Badge>
                    </div>
                    {app.payments?.memo && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {app.payments.memo}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {app.applied_at && formatDate(app.applied_at)}
                  </div>
                </div>
              ))}

              {/* Payment Applications */}
              {paymentApplications.map((app, index) => (
                <div
                  key={`payment-${index}`}
                  className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {formatCurrency(Number(app.applied_amount))}
                      </div>
                      <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        Payment
                        {app.payments?.payment_method && ` - ${app.payments.payment_method.replace('_', ' ')}`}
                      </Badge>
                    </div>
                    {app.payments?.memo && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {app.payments.memo}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {app.applied_at && formatDate(app.applied_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes/Terms Section */}
        {(invoice.terms || invoice.notes) && (
          <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            {invoice.terms && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Payment Terms
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{invoice.terms}</p>
              </div>
            )}
            {invoice.notes && (
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-8 py-6 text-center border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Thank you for your business!
          </p>
        </div>
      </div>
    </div>
  )
}
