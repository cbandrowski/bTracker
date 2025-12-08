'use client'

import { useEffect, useState } from 'react'
import { customerAddressesService, CustomerServiceAddressPayload } from '@/lib/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/useToast'
import { Loader2, Plus, X } from 'lucide-react'
import AddressAutocomplete, { ParsedAddress } from '@/components/AddressAutocomplete'

interface ServiceAddressesProps {
  customerId: string
  onAdded?: (address: any) => void
}

export function ServiceAddresses({ customerId, onAdded }: ServiceAddressesProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CustomerServiceAddressPayload>({
    label: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
  })

  useEffect(() => {
    // reset when closed
    if (!showCreate) {
      resetForm()
    }
  }, [showCreate])

  const resetForm = () => {
    setForm({
      label: '',
      address: '',
      address_line_2: '',
      city: '',
      state: '',
      zipcode: '',
      country: 'USA',
    })
    setShowCreate(false)
  }

  const handleCreate = async () => {
    if (!form.label.trim()) {
      toast({
        variant: 'destructive',
        title: 'Label required',
        description: 'Please enter a label for this service address.',
      })
      return
    }
    setLoading(true)
    try {
      const response = await customerAddressesService.create(customerId, form)
      if (response.error) throw new Error(response.error)
      onAdded?.(response.data)
      resetForm()
      toast({ variant: 'success', title: 'Service address added' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to add address',
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Additional Service Addresses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">Manage additional properties for this customer.</div>
          {!showCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Service Address
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="space-y-3 rounded border border-gray-200 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">New Service Address</h4>
              <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Label</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g., Lake House, Warehouse"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <AddressAutocomplete
                  value={form.address || ''}
                  onChange={(value) => setForm({ ...form, address: value })}
                  onPlaceSelected={(place: ParsedAddress) =>
                    setForm((prev) => ({
                      ...prev,
                      address: place.address,
                      address_line_2: place.addressLine2 || prev.address_line_2,
                      city: place.city || prev.city,
                      state: place.state || prev.state,
                      zipcode: place.zipcode || prev.zipcode,
                      country: place.country || prev.country,
                    }))
                  }
                  placeholder="Start typing address..."
                />
              </div>
              <div>
                <Label>Address Line 2</Label>
                <Input
                  value={form.address_line_2 || ''}
                  onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
                  placeholder="Apt, Suite, Unit"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={form.city || ''}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.state || ''}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
              <div>
                <Label>Zip</Label>
                <Input
                  value={form.zipcode || ''}
                  onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Address
              </Button>
            </div>
          </div>
        )}

        {/* existing addresses are managed/displayed in CustomerInfoPanel */}
      </CardContent>
    </Card>
  )
}
