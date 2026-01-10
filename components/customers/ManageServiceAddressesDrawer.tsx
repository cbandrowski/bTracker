'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CustomerServiceAddress } from '@/types/database'
import { customerAddressesService } from '@/lib/services'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { Trash2, Edit, Plus, MapPin } from 'lucide-react'

interface ManageServiceAddressesDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  customerName: string
  onSuccess?: () => void
}

export function ManageServiceAddressesDrawer({
  open,
  onOpenChange,
  customerId,
  customerName,
  onSuccess,
}: ManageServiceAddressesDrawerProps) {
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    label: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
  })

  // Load addresses when drawer opens
  useEffect(() => {
    if (open && customerId) {
      loadAddresses()
    }
  }, [open, customerId])

  const loadAddresses = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await customerAddressesService.list(customerId)
      if (response.error) throw new Error(response.error)
      setAddresses(response.data || [])
    } catch (err) {
      console.error('Error loading addresses:', err)
      setError(err instanceof Error ? err.message : 'Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      label: '',
      address: '',
      address_line_2: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'USA',
    })
    setEditingId(null)
    setIsCreating(false)
    setError(null)
  }

  const handleEdit = (address: CustomerServiceAddress) => {
    setFormData({
      label: address.label,
      address: address.address || '',
      address_line_2: address.address_line_2 || '',
      city: address.city || '',
      state: address.state || '',
      zipcode: address.zipcode || '',
      country: address.country || 'USA',
    })
    setEditingId(address.id)
    setIsCreating(false)
  }

  const handleDelete = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    try {
      const response = await customerAddressesService.delete(customerId, addressId)
      if (response.error) throw new Error(response.error)

      await loadAddresses()
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Error deleting address:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete address')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.label.trim()) {
      setError('Please enter a label for this address')
      return
    }

    try {
      if (editingId) {
        // Update existing
        const response = await customerAddressesService.update(customerId, editingId, formData)
        if (response.error) throw new Error(response.error)
      } else {
        // Create new
        const response = await customerAddressesService.create(customerId, formData)
        if (response.error) throw new Error(response.error)
      }

      await loadAddresses()
      resetForm()
      if (onSuccess) onSuccess()
    } catch (err) {
      console.error('Error saving address:', err)
      setError(err instanceof Error ? err.message : 'Failed to save address')
    }
  }

  const handleAddressSelect = (addressData: {
    address: string
    city: string
    state: string
    zipcode: string
    country: string
  }) => {
    setFormData(prev => ({
      ...prev,
      address: addressData.address,
      city: addressData.city,
      state: addressData.state,
      zipcode: addressData.zipcode,
      country: addressData.country || 'USA'
    }))
  }

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, address: value }))
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader>
          <DrawerTitle>Manage Service Addresses</DrawerTitle>
          <DrawerDescription>
            Add and manage service addresses for {customerName}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Existing Addresses List */}
          {!isCreating && !editingId && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Service Addresses</h3>
                <Button
                  onClick={() => setIsCreating(true)}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Address
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading addresses...</div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 bg-gray-800/50 rounded-lg border border-gray-700">
                  <MapPin className="mx-auto h-12 w-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm">No additional service addresses yet</p>
                  <p className="text-gray-500 text-xs mt-1">Add locations where jobs will be performed</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {addresses.map((address) => (
                    <div
                      key={address.id}
                      className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-purple-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-purple-400" />
                            <h4 className="font-semibold text-white">{address.label}</h4>
                          </div>
                          <div className="text-sm text-gray-400">
                            {address.address && <p>{address.address}</p>}
                            {address.address_line_2 && <p>{address.address_line_2}</p>}
                            {address.city && address.state && (
                              <p>
                                {address.city}, {address.state} {address.zipcode || ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleEdit(address)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(address.id)}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create/Edit Form */}
          {(isCreating || editingId) && (
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">
                  {editingId ? 'Edit Address' : 'Add New Address'}
                </h3>
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>

              <div>
                <Label htmlFor="label" className="text-gray-300">
                  Label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Main Property, Rental Unit A, Vacation Home"
                  required
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label htmlFor="address" className="text-gray-300">Street Address</Label>
                <AddressAutocomplete
                  value={formData.address}
                  onChange={handleAddressChange}
                  onPlaceSelected={handleAddressSelect}
                  placeholder="Start typing address..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <Label htmlFor="address_line_2" className="text-gray-300">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  value={formData.address_line_2}
                  onChange={(e) => setFormData(prev => ({ ...prev, address_line_2: e.target.value }))}
                  placeholder="Apt, Suite, Unit, etc."
                  className="bg-gray-800 border-gray-600 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="city" className="text-gray-300">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="state" className="text-gray-300">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="zipcode" className="text-gray-300">Zip</Label>
                  <Input
                    id="zipcode"
                    value={formData.zipcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, zipcode: e.target.value }))}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {editingId ? 'Update Address' : 'Add Address'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <DrawerFooter className="border-t border-gray-700">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
