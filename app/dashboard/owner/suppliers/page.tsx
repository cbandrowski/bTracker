'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCompanyContext } from '@/contexts/CompanyContext'
import { useEffect, useMemo, useState } from 'react'
import { Supplier } from '@/types/database'
import { suppliersService } from '@/lib/services'
import { SupplierForm, SupplierFormData } from '@/components/Suppliers/SupplierForm'
import { SuppliersTable } from '@/components/Suppliers/SuppliersTable'
import { Button } from '@/components/ui/button'
import { ParsedAddress } from '@/components/AddressAutocomplete'

const EMPTY_FORM: SupplierFormData = {
  label: '',
  name: '',
  phone: '',
  address: '',
  address_line_2: '',
  city: '',
  state: '',
  zipcode: '',
  country: 'USA',
  account_number: '',
}

const buildFormData = (supplier?: Supplier | null): SupplierFormData => ({
  label: supplier?.label ?? '',
  name: supplier?.name ?? '',
  phone: supplier?.phone ?? '',
  address: supplier?.address ?? '',
  address_line_2: supplier?.address_line_2 ?? '',
  city: supplier?.city ?? '',
  state: supplier?.state ?? '',
  zipcode: supplier?.zipcode ?? '',
  country: supplier?.country ?? 'USA',
  account_number: supplier?.account_number ?? '',
})

const normalizePayload = (data: SupplierFormData) => ({
  label: data.label.trim() || null,
  name: data.name.trim(),
  phone: data.phone.trim() || null,
  address: data.address.trim() || null,
  address_line_2: data.address_line_2.trim() || null,
  city: data.city.trim() || null,
  state: data.state.trim() || null,
  zipcode: data.zipcode.trim() || null,
  country: data.country.trim() || null,
  account_number: data.account_number.trim() || null,
})

export default function SuppliersPage() {
  const { profile } = useAuth()
  const { activeCompanyId, loading: contextLoading } = useCompanyContext()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState<SupplierFormData>(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')
  const [labelFilter, setLabelFilter] = useState('all')

  const fetchSuppliers = async () => {
    if (!profile?.id || !activeCompanyId) {
      if (!contextLoading) {
        setLoadingData(false)
      }
      return
    }

    try {
      setLoadingData(true)

      const suppliersResponse = await suppliersService.getAll()
      if (suppliersResponse.error) {
        throw new Error(suppliersResponse.error)
      }

      setSuppliers(
        (suppliersResponse.data || []).filter((supplier) => supplier.company_id === activeCompanyId)
      )
    } catch (error) {
      console.error('Error loading suppliers:', error)
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (profile && activeCompanyId) {
      fetchSuppliers()
    } else if (!contextLoading) {
      setLoadingData(false)
    }
  }, [profile, activeCompanyId, contextLoading])

  const labelOptions = useMemo(() => {
    const labels = suppliers
      .map((supplier) => supplier.label?.trim())
      .filter((label): label is string => Boolean(label))

    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b))
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return suppliers.filter((supplier) => {
      if (labelFilter === 'unlabeled' && supplier.label) {
        return false
      }
      if (labelFilter !== 'all' && labelFilter !== 'unlabeled' && supplier.label !== labelFilter) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = [
        supplier.name,
        supplier.label,
        supplier.phone,
        supplier.address,
        supplier.address_line_2,
        supplier.city,
        supplier.state,
        supplier.zipcode,
        supplier.account_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [suppliers, searchQuery, labelFilter])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddressChange = (value: string) => {
    setFormData((prev) => ({ ...prev, address: value }))
  }

  const handleAddressSelect = (place: ParsedAddress) => {
    setFormData((prev) => ({
      ...prev,
      address: place.address,
      address_line_2: place.addressLine2 || prev.address_line_2,
      city: place.city,
      state: place.state,
      zipcode: place.zipcode,
      country: place.country,
    }))
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData(buildFormData(supplier))
    setShowForm(true)
  }

  const resetForm = () => {
    setEditingSupplier(null)
    setFormData(EMPTY_FORM)
    setShowForm(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!activeCompanyId && !editingSupplier) {
      alert('No company found. Please create a company first.')
      return
    }

    setSubmitting(true)

    try {
      const payload = normalizePayload(formData)

      if (editingSupplier) {
        const response = await suppliersService.update(editingSupplier.id, payload)
        if (response.error) throw new Error(response.error)
      } else {
        const response = await suppliersService.create({
          company_id: activeCompanyId!,
          ...payload,
        })
        if (response.error) throw new Error(response.error)
      }

      await fetchSuppliers()
      resetForm()
    } catch (error) {
      console.error('Error saving supplier:', error)
      alert('Failed to save supplier. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading suppliers...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Suppliers</h2>
            <p className="text-sm text-gray-400">Track supplier contacts and account details.</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingSupplier(null)
              setFormData(EMPTY_FORM)
              setShowForm(true)
            }}
          >
            Add Supplier
          </Button>
        </div>

        {showForm && (
          <SupplierForm
            formData={formData}
            isEditing={Boolean(editingSupplier)}
            submitting={submitting}
            onInputChange={handleInputChange}
            onAddressChange={handleAddressChange}
            onAddressSelect={handleAddressSelect}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        )}

        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <select
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
            >
              <option value="all">All Labels</option>
              <option value="unlabeled">Unlabeled</option>
              {labelOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {(searchQuery || labelFilter !== 'all') && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setLabelFilter('all')
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <SuppliersTable suppliers={filteredSuppliers} onEdit={handleEdit} />
      </div>
    </div>
  )
}
