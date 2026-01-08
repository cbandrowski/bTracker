'use client'

import { useState, useEffect } from 'react'
import { CustomerServiceAddress } from '@/types/database'
import { customerAddressesService } from '@/lib/services'
import { MapPin, Edit, Trash2, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ServiceAddressModal } from './ServiceAddressModal'
import { useToast } from '@/hooks/useToast'

interface ServiceAddressListProps {
  customerId: string
  onAddressChange?: () => void // Callback when addresses are modified
}

export function ServiceAddressList({ customerId, onAddressChange }: ServiceAddressListProps) {
  const { toast } = useToast()
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerServiceAddress | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadAddresses()
  }, [customerId])

  const loadAddresses = async () => {
    setLoading(true)
    try {
      const response = await customerAddressesService.list(customerId)
      if (!response.error && response.data) {
        setAddresses(response.data)
      }
    } catch (err) {
      console.error('Error loading addresses:', err)
    } finally {
      setLoading(false)
    }
  }

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
      const response = await customerAddressesService.delete(customerId, id)
      if (response.error) throw new Error(response.error)

      // Update local state
      setAddresses(prev => prev.filter(addr => addr.id !== id))

      toast({ variant: 'success', title: 'Service address deleted' })
      onAddressChange?.() // Notify parent to refresh
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
      // Add to local state
      setAddresses(prev => [...prev, address])
    } else {
      // Update in local state
      setAddresses(prev => prev.map(addr => addr.id === address.id ? address : addr))
    }

    setModalOpen(false)
    setEditingAddress(null)
    onAddressChange?.() // Notify parent to refresh
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-white">Additional Service Addresses</h4>
          <Button
            type="button"
            onClick={handleAddNewAddress}
            size="sm"
            variant="outline"
            className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Address
          </Button>
        </div>

        {/* Existing Addresses */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-4 text-gray-400 text-sm">Loading addresses...</div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <MapPin className="mx-auto h-8 w-8 text-gray-600 mb-2" />
              <p className="text-gray-500 text-xs">No additional service addresses</p>
            </div>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-3 w-3 text-purple-400" />
                      <h5 className="font-medium text-white text-sm">{address.label}</h5>
                    </div>
                    <div className="text-xs text-gray-400 ml-5">
                      {address.address && <p>{address.address}</p>}
                      {address.address_line_2 && <p>{address.address_line_2}</p>}
                      {address.city && address.state && (
                        <p>
                          {address.city}, {address.state} {address.zipcode || ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => handleEditAddress(address)}
                      className="h-6 w-6 flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(address.id)}
                      disabled={deletingId === address.id}
                      className="h-6 w-6 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded disabled:opacity-50"
                    >
                      {deletingId === address.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Service Address Modal */}
      <ServiceAddressModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        customerId={customerId}
        address={editingAddress}
        onSuccess={handleModalSuccess}
      />
    </>
  )
}
