'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  jobId?: string | null
  jobTitle?: string
}

interface UnappliedPayment {
  paymentId: string
  date: string
  amount: number
  depositType: string | null
  unappliedAmount: number
}

interface CompanyInfo {
  name: string
  address: string
  address_line_2?: string
  city: string
  state: string
  zipcode: string
  phone: string
  email: string
  logo_url?: string
  show_address_on_invoice?: boolean
  paypal_handle?: string
  zelle_phone?: string
  zelle_email?: string
  check_payable_to?: string
  accept_cash?: boolean
  accept_credit_debit?: boolean
  late_fee_enabled?: boolean
  late_fee_days?: number
  late_fee_amount?: number
}

interface CustomerInfo {
  name: string
  email?: string
  phone?: string
  billing_address?: string
  billing_address_line_2?: string
  billing_city?: string
  billing_state?: string
  billing_zipcode?: string
}

interface InvoicePreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lines: InvoiceLine[]
  deposits: UnappliedPayment[]
  selectedDepositIds: string[]
  companyInfo: CompanyInfo | null
  customerInfo: CustomerInfo | null
  dueDate?: string
  notes?: string | null
  onConfirm: () => void
  onCancel: () => void
  isSubmitting?: boolean
}

export function InvoicePreview({
  open,
  onOpenChange,
  lines,
  deposits,
  selectedDepositIds,
  companyInfo,
  customerInfo,
  dueDate,
  notes,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: InvoicePreviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Group lines by job
  const groupedLines: { [key: string]: InvoiceLine[] } = {}
  const standaloneLines: InvoiceLine[] = []

  lines.forEach(line => {
    if (line.jobId && line.jobTitle) {
      if (!groupedLines[line.jobId]) {
        groupedLines[line.jobId] = []
      }
      groupedLines[line.jobId].push(line)
    } else {
      standaloneLines.push(line)
    }
  })

  // Calculate subtotal (excluding tax)
  const subtotal = lines.reduce((sum, line) => {
    const lineTotal = line.quantity * line.unitPrice
    return sum + lineTotal
  }, 0)

  // Calculate tax
  const taxTotal = lines.reduce((sum, line) => {
    const lineTotal = line.quantity * line.unitPrice
    const lineTax = lineTotal * (line.taxRate / 100)
    return sum + lineTax
  }, 0)

  // Total = subtotal + tax
  const total = subtotal + taxTotal

  // Deposits applied
  const depositsApplied = selectedDepositIds.reduce((sum, id) => {
    const deposit = deposits.find(d => d.paymentId === id)
    return sum + (deposit?.unappliedAmount || 0)
  }, 0)

  // Balance = total - deposits
  const balance = total - depositsApplied

  const selectedDeposits = deposits.filter(d => selectedDepositIds.includes(d.paymentId))

  const billToAddress = [
    customerInfo?.billing_address,
    customerInfo?.billing_address_line_2,
    [customerInfo?.billing_city, customerInfo?.billing_state, customerInfo?.billing_zipcode].filter(Boolean).join(' ').trim() || null,
  ].filter(Boolean).join(', ')

  const billToLine = [customerInfo?.name || 'Customer', billToAddress].filter(Boolean).join(', ')


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[95vw] max-w-none max-h-[95vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Invoice Preview</DialogTitle>
        <DialogDescription className="sr-only">
          Review how your invoice will appear before creating it.
        </DialogDescription>
        {/* Header with title and close button */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Invoice Preview</h2>
              <p className="text-sm text-muted-foreground">Review how your invoice will look when printed or downloaded as PDF</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice Preview Content - Exact replica of the actual invoice */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900">
          <div className="w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden">
          {/* Invoice Header */}
          <div className="border-b-4 border-blue-600 p-8 pb-6">
            <div className="flex justify-between items-start gap-6">
              {/* Company Info */}
              <div className="flex items-start gap-4 flex-1">
                {companyInfo?.logo_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={companyInfo.logo_url}
                      alt={companyInfo.name || 'Company Logo'}
                      className="w-20 h-20 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {companyInfo?.name || 'Company Name'}
                  </h1>
                  {companyInfo && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {companyInfo.show_address_on_invoice !== false && companyInfo.address && (
                        <>
                          <div>{companyInfo.address}</div>
                          {companyInfo.address_line_2 && <div>{companyInfo.address_line_2}</div>}
                          <div>
                            {companyInfo.city}, {companyInfo.state} {companyInfo.zipcode}
                          </div>
                        </>
                      )}
                      {companyInfo.phone && <div>Phone: {companyInfo.phone}</div>}
                      {companyInfo.email && <div>Email: {companyInfo.email}</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Info */}
              <div className="text-right flex-shrink-0">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  INVOICE
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Invoice #:
                    </span>
                    <span className="text-gray-900 dark:text-white font-mono">
                      [Draft]
                    </span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Date:
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatDate(new Date().toISOString())}
                    </span>
                  </div>
                  {dueDate && (
                    <div className="flex justify-end gap-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Due Date:
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {formatDate(dueDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Status:
                    </span>
                    <Badge className="bg-gray-100 text-gray-800">
                      DRAFT
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="p-8 pb-6">
            <div className="mb-6 grid md:grid-cols-2 gap-6 items-start">
              <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  Bill To
                </h3>
                <div className="text-gray-900 dark:text-white space-y-1">
                  <div className="font-semibold text-base">
                    {billToLine}
                  </div>
                  {(customerInfo?.email || customerInfo?.phone) && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {customerInfo?.email && <span>{customerInfo.email}</span>}
                      {customerInfo?.email && customerInfo?.phone && <span className="mx-2">•</span>}
                      {customerInfo?.phone && <span>{customerInfo.phone}</span>}
                    </div>
                  )}
                </div>
              </div>

              {notes && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {notes}
                  </p>
                </div>
              )}
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
                  const jobTitle = jobLines[0]?.jobTitle || 'Job'
                  return (
                    <React.Fragment key={jobId}>
                      {/* Job Title Header */}
                      <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <td colSpan={4} className="py-3 px-4">
                          <div className="font-bold text-gray-900 dark:text-white">
                            {jobTitle}
                          </div>
                        </td>
                      </tr>
                      {/* Job Line Items */}
                      {jobLines.map((line, index) => (
                        <tr
                          key={`${jobId}-${index}`}
                          className={`border-b border-gray-100 dark:border-gray-800 ${
                            index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''
                          }`}
                        >
                          <td className="py-3 pr-4 pl-8">
                            <div className="text-gray-900 dark:text-white">
                              {line.description}
                            </div>
                          </td>
                          <td className="py-3 text-center text-gray-900 dark:text-white">
                            {line.quantity.toFixed(2)}
                          </td>
                          <td className="py-3 text-right text-gray-900 dark:text-white">
                            {formatCurrency(line.unitPrice)}
                          </td>
                          <td className="py-3 text-right font-medium text-gray-900 dark:text-white">
                            {formatCurrency(line.quantity * line.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}

                {/* Render standalone lines */}
                {standaloneLines.map((line, index) => (
                  <tr
                    key={`standalone-${index}`}
                    className={`border-b border-gray-100 dark:border-gray-800 ${
                      (index + Object.keys(groupedLines).length) % 2 === 0
                        ? 'bg-gray-50 dark:bg-gray-900'
                        : ''
                    }`}
                  >
                    <td className="py-4 pr-4">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {line.description}
                      </div>
                    </td>
                    <td className="py-4 text-center text-gray-900 dark:text-white">
                      {line.quantity.toFixed(2)}
                    </td>
                    <td className="py-4 text-right text-gray-900 dark:text-white">
                      {formatCurrency(line.unitPrice)}
                    </td>
                    <td className="py-4 text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(line.quantity * line.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="px-8 pb-8">
            <div className="flex justify-between items-start gap-8">
              {/* Payment Details Section - Left Side */}
              {(companyInfo?.paypal_handle || companyInfo?.zelle_phone || companyInfo?.zelle_email || companyInfo?.check_payable_to || companyInfo?.accept_cash || companyInfo?.accept_credit_debit) && (
                <div className="flex-1 max-w-md">
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Payment Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    {companyInfo?.accept_cash && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Cash:</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          Accepted
                        </span>
                      </div>
                    )}
                    {companyInfo?.accept_credit_debit && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Credit/Debit Card:</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          Accepted
                        </span>
                      </div>
                    )}
                    {companyInfo?.paypal_handle && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">PayPal:</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          @{companyInfo.paypal_handle}
                        </span>
                      </div>
                    )}
                    {companyInfo?.zelle_phone && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Zelle (Phone):</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          {companyInfo.zelle_phone}
                        </span>
                      </div>
                    )}
                    {companyInfo?.zelle_email && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Zelle (Email):</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          {companyInfo.zelle_email}
                        </span>
                      </div>
                    )}
                    {companyInfo?.check_payable_to && (
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Checks Payable To:</span>
                        <span className="text-gray-900 dark:text-white ml-2">
                          {companyInfo.check_payable_to}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Totals - Right Side */}
              <div className="w-80 flex-shrink-0">
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

          {/* Deposits Applied Section */}
          {selectedDeposits.length > 0 && (
            <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Deposits Applied
              </h3>
              <div className="space-y-3">
                {selectedDeposits.map((deposit, index) => (
                  <div
                    key={`deposit-${index}`}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium text-green-900 dark:text-green-100">
                          {formatCurrency(deposit.unappliedAmount)}
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          Deposit
                          {deposit.depositType && ` - ${deposit.depositType}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {formatDate(deposit.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Late Fee Policy + Support */}
          {(companyInfo?.late_fee_enabled || companyInfo?.phone || companyInfo?.email) && (
            <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-700 pt-6 space-y-3">
              {companyInfo?.late_fee_enabled && (
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Late Fee Policy
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Late fees start the day after the invoice due date. An additional <strong>{formatCurrency(companyInfo.late_fee_amount || 0)}</strong> is applied every <strong>{companyInfo.late_fee_days} days</strong> after the due date until paid.
                  </p>
                </div>
              )}
              {(companyInfo?.phone || companyInfo?.email) && (
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Need help with this bill? Call {companyInfo?.phone || 'our office'} or email {companyInfo?.email || 'our team'}.
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

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-950 border-t px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={onConfirm}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Creating Invoice...' : 'Confirm & Create Invoice'}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Back to Edit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
