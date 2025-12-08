'use client'

import { useState } from 'react'
import { Customer } from '@/types/customer-details'
import { CustomerServiceAddress } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { customerAddressesService } from '@/lib/services'
import { useToast } from '@/hooks/useToast'
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { ServiceAddressModal } from './ServiceAddressModal'

interface CustomerInfoPanelProps {
  customer: Customer
  serviceAddresses?: CustomerServiceAddress[]
  onAddressUpdated?: (address: CustomerServiceAddress) => void
  onAddressDeleted?: (id: string) => void
  onAddressCreated?: (address: CustomerServiceAddress) => void
}

export function CustomerInfoPanel({
  customer,
  serviceAddresses = [],
  onAddressUpdated,
  onAddressDeleted,
  onAddressCreated,
}: CustomerInfoPanelProps) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerServiceAddress | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formatAddress = (
    address?: string | null,
    addressLine2?: string | null,
    city?: string | null,
    state?: string | null,
    zipcode?: string | null,
    country?: string | null
  ) => {
    const lines = []
    if (address) lines.push(address)
    if (addressLine2) lines.push(addressLine2)
    const cityStateZip = [city, state].filter(Boolean).join(', ')
    const cityLine = [cityStateZip, zipcode].filter(Boolean).join(' ')
    if (cityLine) lines.push(cityLine)
    if (country && country !== 'USA') lines.push(country)
    return lines
  }

  const billingAddressLines = formatAddress(
    customer.billing_address,
    customer.billing_address_line_2,
    customer.billing_city,
    customer.billing_state,
    customer.billing_zipcode,
    customer.billing_country
  )

  const serviceAddressLines = formatAddress(
    customer.service_address,
    customer.service_address_line_2,
    customer.service_city,
    customer.service_state,
    customer.service_zipcode,
    customer.service_country
  )

  const addressesAreSame = customer.same_as_billing ||
    (billingAddressLines.join(',') === serviceAddressLines.join(',') && serviceAddressLines.length > 0)

  const handleAddNewAddress = () => {
    setEditingAddress(null)
    setModalOpen(true)
  }

  const handleEditAddress = (address: CustomerServiceAddress) => {
    setEditingAddress(address)
    setModalOpen(true)
  }

  const handleDeleteAddress = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this service address?')
    if (!confirm) return

    setDeletingId(id)
    try {
      const response = await customerAddressesService.delete(customer.id, id)
      if (response.error) throw new Error(response.error)
      onAddressDeleted?.(id)
      toast({ variant: 'success', title: 'Service address deleted' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleModalSuccess = (address: CustomerServiceAddress, isNew: boolean) => {
    if (isNew) {
      onAddressCreated?.(address)
    } else {
      onAddressUpdated?.(address)
    }
    setModalOpen(false)
    setEditingAddress(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
          <CardDescription>Contact and address details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-base text-gray-900 dark:text-white">{customer.name}</p>
          </div>

          {customer.phone && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-base text-gray-900 dark:text-white">{customer.phone}</p>
            </div>
          )}

          {customer.email && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-base text-gray-900 dark:text-white">{customer.email}</p>
            </div>
          )}

          {billingAddressLines.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {addressesAreSame ? 'Billing/Service Address' : 'Billing Address'}
              </p>
              <div className="text-base text-gray-900 dark:text-white">
                {billingAddressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {!addressesAreSame && serviceAddressLines.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Address</p>
              <div className="text-base text-gray-900 dark:text-white">
                {serviceAddressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* Button to add additional service addresses */}
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddNewAddress}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Additional Service Address
            </Button>
          </div>

          {/* Display additional service addresses */}
          {serviceAddresses.length > 0 && (
            <div className="space-y-2 pt-2">
              {serviceAddresses.map((addr) => {
                const addrLines = formatAddress(
                  addr.address,
                  addr.address_line_2,
                  addr.city,
                  addr.state,
                  addr.zipcode,
                  addr.country
                )

                return (
                  <div
                    key={addr.id}
                    className="flex items-start gap-2 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex gap-1 flex-shrink-0 pt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditAddress(addr)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => handleDeleteAddress(addr.id)}
                        disabled={deletingId === addr.id}
                      >
                        {deletingId === addr.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      {addr.label && (
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {addr.label}
                        </p>
                      )}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {addrLines.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {customer.notes && (
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-base text-gray-900 dark:text-white whitespace-pre-wrap">
                {customer.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Address Modal */}
      <ServiceAddressModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        customerId={customer.id}
        address={editingAddress}
        onSuccess={handleModalSuccess}
      />
    </>
  )
}
