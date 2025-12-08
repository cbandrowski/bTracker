'use client'

import { CustomerWithBilling } from '@/app/actions/customers'
import { Customer } from '@/types/database'
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
import {
  MoreHorizontal,
  Eye,
  CreditCard,
  FileText,
  Edit,
  Briefcase,
  Repeat,
  FilePlus2,
  Search,
  X,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState, useMemo } from 'react'
import AddressAutocomplete, { ParsedAddress } from '@/components/AddressAutocomplete'

interface CustomersTableProps {
  customers: CustomerWithBilling[]
  onAddDeposit: (customerId: string, customerName: string) => void
  onAddPayment: (customerId: string, customerName: string) => void
  onEditCustomer: (customer: CustomerWithBilling) => void
  onCreateRecurringJob?: (customerId: string, customerName: string) => void
  editingCustomer?: Customer | null
  formData?: any
  onFormChange?: (data: any) => void
  onSubmit?: (e: React.FormEvent) => void
  onCancelEdit?: () => void
  submitting?: boolean
  onBillingAddressSelect?: (address: ParsedAddress) => void
  onServiceAddressSelect?: (address: ParsedAddress) => void
  onSameAsBillingToggle?: (checked: boolean) => void
  onInputChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onArchiveToggle?: (customer: CustomerWithBilling, archived: boolean) => void
}

export function CustomersTable({
  customers,
  onAddDeposit,
  onAddPayment,
  onEditCustomer,
  onCreateRecurringJob,
  editingCustomer,
  formData,
  onFormChange,
  onSubmit,
  onCancelEdit,
  submitting,
  onBillingAddressSelect,
  onServiceAddressSelect,
  onSameAsBillingToggle,
  onInputChange,
  onArchiveToggle,
}: CustomersTableProps) {
  const router = useRouter()
  const [sortColumn, setSortColumn] = useState<keyof CustomerWithBilling | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')

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

  // Filter customers based on search query - only show matches
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers

    const query = searchQuery.toLowerCase().trim()

    return customers.filter(customer => {
      // Search in name
      if (customer.name?.toLowerCase().includes(query)) return true

      // Search in phone (strip formatting from both)
      const cleanPhone = customer.phone?.replace(/\D/g, '') || ''
      const cleanQuery = query.replace(/\D/g, '')
      if (cleanQuery && cleanPhone.includes(cleanQuery)) return true

      // Search in billing address
      if (customer.billing_address?.toLowerCase().includes(query)) return true
      if (customer.billing_address_line_2?.toLowerCase().includes(query)) return true
      if (customer.billing_city?.toLowerCase().includes(query)) return true
      if (customer.billing_state?.toLowerCase().includes(query)) return true
      if (customer.billing_zipcode?.toLowerCase().includes(query)) return true

      // Search in service address
      if (customer.service_address?.toLowerCase().includes(query)) return true
      if (customer.service_address_line_2?.toLowerCase().includes(query)) return true
      if (customer.service_city?.toLowerCase().includes(query)) return true
      if (customer.service_state?.toLowerCase().includes(query)) return true
      if (customer.service_zipcode?.toLowerCase().includes(query)) return true

      // Search in additional service addresses
      if (customer.serviceAddresses && customer.serviceAddresses.length > 0) {
        const foundInServiceAddress = customer.serviceAddresses.some(addr => {
          if (addr.label?.toLowerCase().includes(query)) return true
          if (addr.address?.toLowerCase().includes(query)) return true
          if (addr.address_line_2?.toLowerCase().includes(query)) return true
          if (addr.city?.toLowerCase().includes(query)) return true
          if (addr.state?.toLowerCase().includes(query)) return true
          if (addr.zipcode?.toLowerCase().includes(query)) return true
          return false
        })
        if (foundInServiceAddress) return true
      }

      // Search in email
      if (customer.email?.toLowerCase().includes(query)) return true

      return false
    })
  }, [customers, searchQuery])

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
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
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, phone, address, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-400">
            Showing {sortedCustomers.length} of {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {sortedCustomers.map((customer) => (
          <React.Fragment key={customer.id}>
            <div
              id={`customer-${customer.id}`}
              className="bg-slate-700/50 border border-purple-500/30 rounded-lg p-4 space-y-3"
            >
            {/* Header with name and actions */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-lg">{customer.name}</h3>
                  {customer.archived && (
                    <Badge variant="outline" className="text-xs border-amber-400 text-amber-200">
                      Archived
                    </Badge>
                  )}
                </div>
                {customer.billing_address ? (
                  <p className="text-sm text-gray-400">
                    {customer.billing_address}
                    {customer.billing_address_line_2 && `, ${customer.billing_address_line_2}`}
                    {customer.billing_city && customer.billing_state && (
                      <>
                        <br />
                        {customer.billing_city}, {customer.billing_state} {customer.billing_zipcode || ''}
                      </>
                    )}
                  </p>
                ) : customer.billing_city && customer.billing_state ? (
                  <p className="text-sm text-gray-400">
                    {customer.billing_city}, {customer.billing_state}
                  </p>
                ) : null}
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
                  {onArchiveToggle && (
                    <DropdownMenuItem
                      onClick={() => onArchiveToggle(customer, !customer.archived)}
                    >
                      {customer.archived ? (
                        <RotateCcw className="mr-2 h-4 w-4" />
                      ) : (
                        <Archive className="mr-2 h-4 w-4" />
                      )}
                      {customer.archived ? 'Restore Customer' : 'Archive Customer'}
                    </DropdownMenuItem>
                  )}
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

          {/* Inline Edit Form for Mobile */}
          {editingCustomer?.id === customer.id && formData && onSubmit && onCancelEdit && (
            <div className="bg-gray-900/80 border border-blue-500/30 rounded-lg p-4">
              <form onSubmit={onSubmit}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-white">
                    Edit Customer: {customer.name}
                  </h3>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={onInputChange}
                      required
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={onInputChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={onInputChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Billing Address</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Street Address
                        </label>
                        {onBillingAddressSelect && (
                          <AddressAutocomplete
                            value={formData.billing_address}
                            onChange={(value) => onFormChange?.({ ...formData, billing_address: value })}
                            onPlaceSelected={onBillingAddressSelect}
                            placeholder="Start typing address..."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Address Line 2
                        </label>
                        <input
                          type="text"
                          name="billing_address_line_2"
                          value={formData.billing_address_line_2}
                          onChange={onInputChange}
                          placeholder="Apt, Suite, Unit, etc."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                          <input
                            type="text"
                            name="billing_city"
                            value={formData.billing_city}
                            onChange={onInputChange}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                          <input
                            type="text"
                            name="billing_state"
                            value={formData.billing_state}
                            onChange={onInputChange}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                          <input
                            type="text"
                            name="billing_zipcode"
                            value={formData.billing_zipcode}
                            onChange={onInputChange}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Service Address</h4>

                    <label className="flex items-center space-x-2 mb-3">
                      <input
                        type="checkbox"
                        checked={formData.same_as_billing}
                        onChange={(e) => onSameAsBillingToggle?.(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-300">Same as billing address</span>
                    </label>

                    {!formData.same_as_billing && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Street Address
                          </label>
                          {onServiceAddressSelect && (
                            <AddressAutocomplete
                              value={formData.service_address}
                              onChange={(value) => onFormChange?.({ ...formData, service_address: value })}
                              onPlaceSelected={onServiceAddressSelect}
                              placeholder="Start typing address..."
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Address Line 2
                          </label>
                          <input
                            type="text"
                            name="service_address_line_2"
                            value={formData.service_address_line_2}
                            onChange={onInputChange}
                            placeholder="Apt, Suite, Unit, etc."
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                            <input
                              type="text"
                              name="service_city"
                              value={formData.service_city}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                            <input
                              type="text"
                              name="service_state"
                              value={formData.service_state}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                            <input
                              type="text"
                              name="service_zipcode"
                              value={formData.service_zipcode}
                              onChange={onInputChange}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={onInputChange}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          )}
          </React.Fragment>
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
              <React.Fragment key={customer.id}>
                <TableRow id={`customer-${customer.id}`} className="group">
                  <TableCell className="align-top">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{customer.name}</span>
                        {customer.archived && (
                          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-200">
                            Archived
                          </Badge>
                        )}
                      </div>
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
                    {customer.billing_address ? (
                      <>
                        {customer.billing_address}
                        {customer.billing_address_line_2 && `, ${customer.billing_address_line_2}`}
                        <br />
                        {customer.billing_city && customer.billing_state
                          ? `${customer.billing_city}, ${customer.billing_state} ${customer.billing_zipcode || ''}`
                          : ''}
                      </>
                    ) : customer.billing_city && customer.billing_state ? (
                      `${customer.billing_city}, ${customer.billing_state}`
                    ) : (
                      '-'
                    )}
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
                      {onArchiveToggle && (
                        <DropdownMenuItem
                          onClick={() => onArchiveToggle(customer, !customer.archived)}
                        >
                          {customer.archived ? (
                            <RotateCcw className="mr-2 h-4 w-4" />
                          ) : (
                            <Archive className="mr-2 h-4 w-4" />
                          )}
                          {customer.archived ? 'Restore Customer' : 'Archive Customer'}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>

              {/* Inline Edit Form */}
              {editingCustomer?.id === customer.id && formData && onSubmit && onCancelEdit && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <form onSubmit={onSubmit} className="p-6 bg-gray-900/50 border-t border-b border-blue-500/30">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-md font-semibold text-white">
                          Edit Customer: {customer.name}
                        </h3>
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Customer Name *
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={onInputChange}
                            required
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={onInputChange}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={onInputChange}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-white mb-2">Billing Address</h4>

                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Street Address
                            </label>
                            {onBillingAddressSelect && (
                              <AddressAutocomplete
                                value={formData.billing_address}
                                onChange={(value) => onFormChange?.({ ...formData, billing_address: value })}
                                onPlaceSelected={onBillingAddressSelect}
                                placeholder="Start typing address..."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                              Address Line 2
                            </label>
                            <input
                              type="text"
                              name="billing_address_line_2"
                              value={formData.billing_address_line_2}
                              onChange={onInputChange}
                              placeholder="Apt, Suite, Unit, etc."
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                              <input
                                type="text"
                                name="billing_city"
                                value={formData.billing_city}
                                onChange={onInputChange}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                              <input
                                type="text"
                                name="billing_state"
                                value={formData.billing_state}
                                onChange={onInputChange}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                              <input
                                type="text"
                                name="billing_zipcode"
                                value={formData.billing_zipcode}
                                onChange={onInputChange}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-white mb-2">Service Address</h4>

                        <label className="flex items-center space-x-2 mb-3">
                          <input
                            type="checkbox"
                            checked={formData.same_as_billing}
                            onChange={(e) => onSameAsBillingToggle?.(e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-300">Same as billing address</span>
                        </label>

                        {!formData.same_as_billing && (
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Street Address
                              </label>
                              {onServiceAddressSelect && (
                                <AddressAutocomplete
                                  value={formData.service_address}
                                  onChange={(value) => onFormChange?.({ ...formData, service_address: value })}
                                  onPlaceSelected={onServiceAddressSelect}
                                  placeholder="Start typing address..."
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-1">
                                Address Line 2
                              </label>
                              <input
                                type="text"
                                name="service_address_line_2"
                                value={formData.service_address_line_2}
                                onChange={onInputChange}
                                placeholder="Apt, Suite, Unit, etc."
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
                                <input
                                  type="text"
                                  name="service_city"
                                  value={formData.service_city}
                                  onChange={onInputChange}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                                <input
                                  type="text"
                                  name="service_state"
                                  value={formData.service_state}
                                  onChange={onInputChange}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                                <input
                                  type="text"
                                  name="service_zipcode"
                                  value={formData.service_zipcode}
                                  onChange={onInputChange}
                                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Notes
                        </label>
                        <textarea
                          name="notes"
                          value={formData.notes}
                          onChange={onInputChange}
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="mt-4 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {submitting ? 'Updating...' : 'Update Customer'}
                        </button>
                      </div>
                    </form>
                  </TableCell>
                </TableRow>
              )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
