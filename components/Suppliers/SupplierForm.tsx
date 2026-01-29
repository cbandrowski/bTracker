'use client'

import { Button } from '@/components/ui/button'
import AddressAutocomplete, { ParsedAddress } from '@/components/AddressAutocomplete'

export type SupplierFormData = {
  label: string
  name: string
  phone: string
  address: string
  address_line_2: string
  city: string
  state: string
  zipcode: string
  country: string
  account_number: string
}

interface SupplierFormProps {
  formData: SupplierFormData
  isEditing: boolean
  submitting: boolean
  onInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAddressChange: (value: string) => void
  onAddressSelect: (place: ParsedAddress) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}

export function SupplierForm({
  formData,
  isEditing,
  submitting,
  onInputChange,
  onAddressChange,
  onAddressSelect,
  onSubmit,
  onCancel,
}: SupplierFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 bg-gray-900/60 border border-gray-700 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Label</label>
          <input
            type="text"
            name="label"
            value={formData.label}
            onChange={onInputChange}
            placeholder="Sand, Tile, Paint..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Supplier Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={onInputChange}
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Phone</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Account Number</label>
          <input
            type="text"
            name="account_number"
            value={formData.account_number}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-300 mb-1">Address</label>
          <AddressAutocomplete
            value={formData.address}
            onChange={onAddressChange}
            onPlaceSelected={onAddressSelect}
            placeholder="Start typing address..."
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-300 mb-1">Address Line 2</label>
          <input
            type="text"
            name="address_line_2"
            value={formData.address_line_2}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">City</label>
          <input
            type="text"
            name="city"
            value={formData.city}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">State</label>
          <input
            type="text"
            name="state"
            value={formData.state}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Zipcode</label>
          <input
            type="text"
            name="zipcode"
            value={formData.zipcode}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Country</label>
          <input
            type="text"
            name="country"
            value={formData.country}
            onChange={onInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Supplier'}
        </Button>
      </div>
    </form>
  )
}
