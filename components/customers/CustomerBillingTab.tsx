'use client'

import { CustomerInvoice, CustomerPayment } from '@/types/customer-details'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye, FileText, Receipt } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CustomerBillingTabProps {
  customerId: string
  invoices: CustomerInvoice[]
  payments: CustomerPayment[]
}

export function CustomerBillingTab({ customerId, invoices, payments }: CustomerBillingTabProps) {
  const router = useRouter()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getInvoiceStatusBadge = (status: CustomerInvoice['status']) => {
    const variants: Record<
      CustomerInvoice['status'],
      { variant: 'default' | 'secondary' | 'outline' | 'destructive', label: string }
    > = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'outline', label: 'Issued' },
      partial: { variant: 'outline', label: 'Partial' },
      paid: { variant: 'default', label: 'Paid' },
      void: { variant: 'destructive', label: 'Void' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
    }

    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  const getPaymentMethodLabel = (method: CustomerPayment['payment_method']) => {
    const labels: Record<CustomerPayment['payment_method'], string> = {
      cash: 'Cash',
      check: 'Check',
      credit_card: 'Credit Card',
      debit_card: 'Debit Card',
      bank_transfer: 'Bank Transfer',
      other: 'Other',
    }
    return labels[method]
  }

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/dashboard/owner/invoices/${invoiceId}`)
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const deposits = payments.filter(p => p.is_deposit)
  const regularPayments = payments.filter(p => !p.is_deposit)

  return (
    <div className="space-y-6">
      {/* Invoices Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>All invoices for this customer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-4">
                <FileText className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No invoices yet
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                      <TableCell>{getInvoiceStatusBadge(invoice.status)}</TableCell>
                      <TableCell>{formatDate(invoice.due_date)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            invoice.balance_due > 0
                              ? 'font-semibold text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }
                        >
                          {formatCurrency(invoice.balance_due)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Payment history{' '}
                {payments.length > 0 && (
                  <span className="font-medium">
                    (Total: {formatCurrency(totalPaid)})
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-6 mb-4">
                <Receipt className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No payments yet
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Regular Payments */}
              {regularPayments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Payments</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Memo</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regularPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell>
                              {getPaymentMethodLabel(payment.payment_method)}
                            </TableCell>
                            <TableCell>
                              {payment.reference_number || (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {payment.memo || <span className="text-gray-400">-</span>}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Deposits */}
              {deposits.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Deposits</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Memo</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deposits.map((deposit) => (
                          <TableRow key={deposit.id}>
                            <TableCell>{formatDate(deposit.payment_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {deposit.deposit_type
                                  ? deposit.deposit_type
                                      .replace('_', ' ')
                                      .replace(/\b\w/g, (l) => l.toUpperCase())
                                  : 'Deposit'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getPaymentMethodLabel(deposit.payment_method)}
                            </TableCell>
                            <TableCell>
                              {deposit.memo || <span className="text-gray-400">-</span>}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(deposit.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
