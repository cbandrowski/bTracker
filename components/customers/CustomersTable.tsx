'use client'

import { CustomerWithBilling } from '@/app/actions/customers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MoreHorizontal, Eye, CreditCard, FileText, Plus, Edit, Briefcase, Repeat, FilePlus2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CustomersTableProps {
  customers: CustomerWithBilling[]
  onAddDeposit: (customerId: string, customerName: string) => void
  onAddPayment: (customerId: string, customerName: string) => void
  onEditCustomer: (customer: CustomerWithBilling) => void
  onCreateRecurringJob?: (customerId: string, customerName: string) => void
}

export function CustomersTable({ customers, onAddDeposit, onAddPayment, onEditCustomer, onCreateRecurringJob }: CustomersTableProps) {
  const router = useRouter()
  const [sortColumn, setSortColumn] = useState<keyof CustomerWithBilling | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleCreateJob = (customer: CustomerWithBilling) => {
    const currentPath = `${window.location.pathname}${window.location.search}`
    sessionStorage.setItem('createJobReturnPath', currentPath)
    sessionStorage.setItem('createJobForCustomer', JSON.stringify(customer))
    router.push('/dashboard/owner/jobs?create=true')
  }

  const handleManualInvoice = (customer: CustomerWithBilling) => {
    router.push(`/dashboard/owner/billing/customers/${customer.id}/manual`)
  }

  const handleSort = (column: keyof CustomerWithBilling) => {
    const newDirection =
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
  }

  const sortedCustomers = [...customers].sort((a, b) => {
    if (!sortColumn) return 0

    const aValue = a[sortColumn]
    const bValue = b[sortColumn]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
          <CreditCard className="h-6 w-6 text-gray-400" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No customers yet</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Get started by creating your first customer
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {sortedCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-slate-700/50 border border-purple-500/30 rounded-lg p-4 space-y-3"
          >
            {/* Header with name and actions */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg">{customer.name}</h3>
                {customer.billing_city && customer.billing_state && (
                  <p className="text-sm text-gray-400">
                    {customer.billing_city}, {customer.billing_state}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={`Actions for ${customer.name}`}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => router.push(`/dashboard/owner/customers/${customer.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEditCustomer(customer)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Customer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCreateJob(customer)}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Create Job
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleManualInvoice(customer)}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Manual Invoice
                  </DropdownMenuItem>
                  {onCreateRecurringJob && (
                    <DropdownMenuItem
                      onClick={() => onCreateRecurringJob(customer.id, customer.name)}
                    >
                      <Repeat className="mr-2 h-4 w-4" />
                      Create Recurring Jobs
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/dashboard/owner/billing/customers/${customer.id}`)
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Billing
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAddDeposit(customer.id, customer.name)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add Deposit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAddPayment(customer.id, customer.name)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Add Payment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Contact Info */}
            <div className="space-y-1 text-sm">
              {customer.email && (
                <p className="text-gray-300">
                  <span className="text-gray-400">Email: </span>
                  {customer.email}
                </p>
              )}
              {customer.phone && (
                <p className="text-gray-300">
                  <span className="text-gray-400">Phone: </span>
                  {formatPhoneNumber(customer.phone)}
                </p>
              )}
            </div>

            {/* Financial Info */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-500/20">
              <div>
                <p className="text-xs text-gray-400 mb-1">Balance</p>
                <Badge
                  variant={
                    customer.billedBalance > 0
                      ? 'destructive'
                      : customer.billedBalance < 0
                      ? 'default'
                      : 'secondary'
                  }
                  className="font-mono text-xs"
                >
                  {formatCurrency(customer.billedBalance)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Credit</p>
                {customer.unappliedCredit > 0 ? (
                  <Badge variant="default" className="font-mono text-xs">
                    {formatCurrency(customer.unappliedCredit)}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Invoices</p>
                {customer.openInvoices > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    {customer.openInvoices}
                  </Badge>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort('name')}
                role="button"
                aria-sort={
                  sortColumn === 'name'
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center">
                  Client
                  {sortColumn === 'name' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead className="whitespace-nowrap">Location</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right whitespace-nowrap"
                onClick={() => handleSort('billedBalance')}
                role="button"
                aria-sort={
                  sortColumn === 'billedBalance'
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center justify-end">
                  Billed Balance
                  {sortColumn === 'billedBalance' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-right whitespace-nowrap"
                onClick={() => handleSort('unappliedCredit')}
                role="button"
                aria-sort={
                  sortColumn === 'unappliedCredit'
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <div className="flex items-center justify-end">
                  Unapplied Credit
                  {sortColumn === 'unappliedCredit' && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </TableHead>
              <TableHead className="text-center whitespace-nowrap">Open Invoices</TableHead>
              <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCustomers.map((customer) => (
              <TableRow key={customer.id} className="group">
                <TableCell className="align-top">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{customer.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {customer.email || '-'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatPhoneNumber(customer.phone)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {customer.billing_city && customer.billing_state
                      ? `${customer.billing_city}, ${customer.billing_state}`
                      : '-'}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className="inline-flex items-center"
                    title={`Total invoiced minus payments: ${formatCurrency(
                      customer.billedBalance
                    )}`}
                  >
                    <Badge
                      variant={
                        customer.billedBalance > 0
                          ? 'destructive'
                          : customer.billedBalance < 0
                          ? 'default'
                          : 'secondary'
                      }
                      className="font-mono"
                    >
                      {formatCurrency(customer.billedBalance)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className="inline-flex items-center"
                    title="Credit available to apply to invoices"
                  >
                    {customer.unappliedCredit > 0 ? (
                      <Badge variant="default" className="font-mono">
                        {formatCurrency(customer.unappliedCredit)}
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {customer.openInvoices > 0 ? (
                    <Badge variant="outline">{customer.openInvoices}</Badge>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Actions for ${customer.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/owner/customers/${customer.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditCustomer(customer)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Customer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleCreateJob(customer)}
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        Create Job
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleManualInvoice(customer)}
                      >
                        <FilePlus2 className="mr-2 h-4 w-4" />
                        Manual Invoice
                      </DropdownMenuItem>
                      {onCreateRecurringJob && (
                        <DropdownMenuItem
                          onClick={() => onCreateRecurringJob(customer.id, customer.name)}
                        >
                          <Repeat className="mr-2 h-4 w-4" />
                          Create Recurring Jobs
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/dashboard/owner/billing/customers/${customer.id}`)
                        }
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Billing
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onAddDeposit(customer.id, customer.name)}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add Deposit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onAddPayment(customer.id, customer.name)}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Add Payment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
