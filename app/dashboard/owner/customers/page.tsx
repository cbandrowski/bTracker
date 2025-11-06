'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Customer } from '@/types/database'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { useRouter } from 'next/navigation'

export default function CustomersPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<'name' | 'billing_city' | 'service_city' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    billing_address: '',
    billing_address_line_2: '',
    billing_city: '',
    billing_state: '',
    billing_zipcode: '',
    billing_country: 'USA',
    service_address: '',
    service_address_line_2: '',
    service_city: '',
    service_state: '',
    service_zipcode: '',
    service_country: 'USA',
    same_as_billing: false,
    notes: ''
  })

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        // Get owned companies
        const { data: ownerData } = await supabase
          .from('company_owners')
          .select('company_id')
          .eq('profile_id', profile.id)

        if (!ownerData || ownerData.length === 0) {
          setLoadingData(false)
          return
        }

        const companyIds = ownerData.map(o => o.company_id)
        setCompanyId(companyIds[0]) // Use first company for now

        // Fetch customers for all owned companies
        const { data: customersData } = await supabase
          .from('customers')
          .select('*')
          .in('company_id', companyIds)
          .order('created_at', { ascending: false })

        setCustomers((customersData as Customer[]) || [])
      } catch (error) {
        console.error('Error fetching customers:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchCustomers()
    }
  }, [profile])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSameAsBillingToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      same_as_billing: checked,
      ...(checked ? {
        service_address: prev.billing_address,
        service_address_line_2: prev.billing_address_line_2,
        service_city: prev.billing_city,
        service_state: prev.billing_state,
        service_zipcode: prev.billing_zipcode,
        service_country: prev.billing_country
      } : {})
    }))
  }

  const handleBillingAddressSelect = (addressData: any) => {
    setFormData(prev => ({
      ...prev,
      billing_address: addressData.address,
      billing_city: addressData.city,
      billing_state: addressData.state,
      billing_zipcode: addressData.zipcode,
      billing_country: addressData.country || 'USA',
      ...(prev.same_as_billing ? {
        service_address: addressData.address,
        service_city: addressData.city,
        service_state: addressData.state,
        service_zipcode: addressData.zipcode,
        service_country: addressData.country || 'USA'
      } : {})
    }))
  }

  const handleServiceAddressSelect = (addressData: any) => {
    setFormData(prev => ({
      ...prev,
      service_address: addressData.address,
      service_city: addressData.city,
      service_state: addressData.state,
      service_zipcode: addressData.zipcode,
      service_country: addressData.country || 'USA'
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyId) {
      alert('No company found. Please create a company first.')
      return
    }

    setSubmitting(true)

    try {
      const customerData = {
        company_id: companyId,
        ...formData
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single()

      if (error) throw error

      setCustomers(prev => [data as Customer, ...prev])
      setShowForm(false)

      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        billing_address: '',
        billing_address_line_2: '',
        billing_city: '',
        billing_state: '',
        billing_zipcode: '',
        billing_country: 'USA',
        service_address: '',
        service_address_line_2: '',
        service_city: '',
        service_state: '',
        service_zipcode: '',
        service_country: 'USA',
        same_as_billing: false,
        notes: ''
      })

      alert('Customer created successfully!')
    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Failed to create customer. Please try again.')
    }

    setSubmitting(false)
  }

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const handleSort = (column: 'name' | 'billing_city' | 'service_city') => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)

    const sorted = [...customers].sort((a, b) => {
      let aValue = ''
      let bValue = ''

      if (column === 'name') {
        aValue = a.name?.toLowerCase() || ''
        bValue = b.name?.toLowerCase() || ''
      } else if (column === 'billing_city') {
        aValue = a.billing_city?.toLowerCase() || ''
        bValue = b.billing_city?.toLowerCase() || ''
      } else if (column === 'service_city') {
        // Use service city if different from billing, otherwise use billing city
        aValue = (a.same_as_billing ? a.billing_city : a.service_city)?.toLowerCase() || ''
        bValue = (b.same_as_billing ? b.billing_city : b.service_city)?.toLowerCase() || ''
      }

      if (newDirection === 'asc') {
        return aValue.localeCompare(bValue)
      } else {
        return bValue.localeCompare(aValue)
      }
    })

    setCustomers(sorted)
  }

  const SortIcon = ({ column }: { column: 'name' | 'billing_city' | 'service_city' }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 ml-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4 ml-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const handleCreateJob = (customer: Customer) => {
    // Store customer data in sessionStorage to pre-fill job form
    sessionStorage.setItem('createJobForCustomer', JSON.stringify(customer))
    router.push('/dashboard/owner/jobs?create=true')
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading customers...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">
            Customers ({customers.length})
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showForm ? 'Cancel' : '+ Add Customer'}
          </button>
        </div>

        {/* Create Customer Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <h3 className="text-md font-semibold text-white mb-4">New Customer</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                  <AddressAutocomplete
                    value={formData.billing_address}
                    onChange={(value) => setFormData(prev => ({ ...prev, billing_address: value }))}
                    onPlaceSelected={handleBillingAddressSelect}
                    placeholder="Start typing address..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="billing_address_line_2"
                    value={formData.billing_address_line_2}
                    onChange={handleInputChange}
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
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      name="billing_state"
                      value={formData.billing_state}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                    <input
                      type="text"
                      name="billing_zipcode"
                      value={formData.billing_zipcode}
                      onChange={handleInputChange}
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
                  onChange={(e) => handleSameAsBillingToggle(e.target.checked)}
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
                    <AddressAutocomplete
                      value={formData.service_address}
                      onChange={(value) => setFormData(prev => ({ ...prev, service_address: value }))}
                      onPlaceSelected={handleServiceAddressSelect}
                      placeholder="Start typing address..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      name="service_address_line_2"
                      value={formData.service_address_line_2}
                      onChange={handleInputChange}
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
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
                      <input
                        type="text"
                        name="service_state"
                        value={formData.service_state}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Zip</label>
                      <input
                        type="text"
                        name="service_zipcode"
                        value={formData.service_zipcode}
                        onChange={handleInputChange}
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
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </form>
        )}

        {/* Customer List */}
        {customers.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-400">No customers yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Click "Add Customer" to create your first customer
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      Name
                      <SortIcon column="name" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Contact
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                    onClick={() => handleSort('billing_city')}
                  >
                    <div className="flex items-center">
                      Billing Address
                      <SortIcon column="billing_city" />
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                    onClick={() => handleSort('service_city')}
                  >
                    <div className="flex items-center">
                      Service Address
                      <SortIcon column="service_city" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div>{formatPhoneNumber(customer.phone)}</div>
                      {customer.email && (
                        <div className="text-xs text-gray-400">{customer.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {customer.billing_address ? (
                        <div>
                          <div>{customer.billing_address}</div>
                          {customer.billing_address_line_2 && (
                            <div>{customer.billing_address_line_2}</div>
                          )}
                          {customer.billing_city && customer.billing_state && (
                            <div className="text-xs text-gray-400">
                              {customer.billing_city}, {customer.billing_state} {customer.billing_zipcode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {customer.same_as_billing ? (
                        <span className="text-gray-500 italic">Same as billing</span>
                      ) : customer.service_address ? (
                        <div>
                          <div>{customer.service_address}</div>
                          {customer.service_address_line_2 && (
                            <div>{customer.service_address_line_2}</div>
                          )}
                          {customer.service_city && customer.service_state && (
                            <div className="text-xs text-gray-400">
                              {customer.service_city}, {customer.service_state} {customer.service_zipcode}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleCreateJob(customer)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-xs font-medium"
                      >
                        Create Job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
