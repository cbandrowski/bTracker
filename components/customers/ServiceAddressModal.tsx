'use client'

import { useState, useEffect } from 'react'
import { CustomerServiceAddress } from '@/types/database'
import { customerAddressesService, CustomerServiceAddressPayload } from '@/lib/services'
import { useToast } from '@/hooks/useToast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import AddressAutocomplete, { ParsedAddress } from '@/components/AddressAutocomplete'

interface ServiceAddressModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  address?: CustomerServiceAddress | null
  onSuccess: (address: CustomerServiceAddress, isNew: boolean) => void
}

export function ServiceAddressModal({
  open,
  onOpenChange,
  customerId,
  address,
  onSuccess,
}: ServiceAddressModalProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    label: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
  })

  // Reset form when modal opens/closes or address changes
  useEffect(() => {
    if (open) {
      if (address) {
        // Editing existing address
        setFormData({
          label: address.label || '',
          address: address.address || '',
          address_line_2: address.address_line_2 || '',
          city: address.city || '',
          state: address.state || '',
          zipcode: address.zipcode || '',
          country: address.country || 'USA',
        })
      } else {
        // New address
        setFormData({
          label: '',
          address: '',
          address_line_2: '',
          city: '',
          state: '',
          zipcode: '',
          country: 'USA',
        })
      }
    }
  }, [open, address])

  const handlePlaceSelected = (place: ParsedAddress) => {
    setFormData({
      ...formData,
      address: place.address || formData.address,
      address_line_2: place.addressLine2 || formData.address_line_2,
      city: place.city || formData.city,
      state: place.state || formData.state,
      zipcode: place.zipcode || formData.zipcode,
      country: place.country || formData.country,
    })
  }

  const handleSave = async () => {
    // Validation
    if (!formData.address || !formData.city || !formData.state || !formData.zipcode) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in address, city, state, and zipcode',
      })
      return
    }

    setSaving(true)
    try {
      const payload: CustomerServiceAddressPayload = {
        label: formData.label || 'Service Address',
        address: formData.address,
        address_line_2: formData.address_line_2 || null,
        city: formData.city,
        state: formData.state,
        zipcode: formData.zipcode,
        country: formData.country || 'USA',
      }

      let response
      let isNew = false

      if (address?.id) {
        // Update existing address
        response = await customerAddressesService.update(customerId, address.id, payload)
      } else {
        // Create new address
        response = await customerAddressesService.create(customerId, payload)
        isNew = true
      }

      if (response.error) throw new Error(response.error)
      if (!response.data) throw new Error('No data returned from server')

      toast({
        variant: 'success',
        title: isNew ? 'Service address added' : 'Service address updated',
      })

      onSuccess(response.data, isNew)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {address ? 'Edit Service Address' : 'Add Additional Service Address'}
          </DialogTitle>
          <DialogDescription>
            {address
              ? 'Update the service address details below'
              : 'Add a new service address for this customer'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              placeholder="e.g., Vacation Home, Rental Property"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="address">Address *</Label>
            <div className="mt-1">
              <AddressAutocomplete
                value={formData.address}
                onChange={(value) => setFormData({ ...formData, address: value })}
                onPlaceSelected={handlePlaceSelected}
                placeholder="Start typing address..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address_line_2">Address Line 2</Label>
            <Input
              id="address_line_2"
              placeholder="Apt, Suite, Unit, etc."
              value={formData.address_line_2}
              onChange={(e) => setFormData({ ...formData, address_line_2: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zipcode">Zipcode *</Label>
              <Input
                id="zipcode"
                value={formData.zipcode}
                onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
