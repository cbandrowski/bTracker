'use client'

import { useState, useEffect } from 'react'
import { Customer, CustomerServiceAddress, Job } from '@/types/database'
import { customersService, jobsService, customerAddressesService } from '@/lib/services'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { MapPin } from 'lucide-react'

interface JobCreationFormProps {
  companyId: string
  onSuccess: () => void
  onCancel: () => void
  prefilledCustomer?: Customer | null
}

export default function JobCreationForm({ companyId, onSuccess, onCancel, prefilledCustomer }: JobCreationFormProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceAddresses, setServiceAddresses] = useState<CustomerServiceAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('default')

  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    title: '',
    summary: '',
    service_address: '',
    service_address_line_2: '',
    service_city: '',
    service_state: '',
    service_zipcode: '',
    service_country: 'USA',
    tasks_to_complete: '',
    planned_end_date: '',
    arrival_window_start_time: '',
    arrival_window_end_time: ''
  })

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await customersService.getAll('active')
        if (!response.error && response.data) {
          setCustomers(response.data)
        }
      } catch (error) {
        console.error('Error fetching customers:', error)
      }
      setLoadingCustomers(false)
    }

    fetchCustomers()
  }, [])

  // Handle prefilled customer from navigation
  useEffect(() => {
    if (prefilledCustomer && customers.length > 0) {
      handleCustomerSelect(prefilledCustomer.id)
    }
  }, [prefilledCustomer, customers])

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  )

  const handleCustomerSelect = async (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return

    // Fetch customer's additional service addresses
    try {
      const response = await customerAddressesService.list(customerId)
      if (!response.error && response.data) {
        setServiceAddresses(response.data)
      }
    } catch (error) {
      console.error('Error fetching service addresses:', error)
    }

    // Pre-fill form with customer's default service address
    setFormData({
      customer_id: customer.id,
      title: `Job for ${customer.name}`,
      summary: '',
      service_address: customer.same_as_billing
        ? (customer.billing_address || '')
        : (customer.service_address || customer.billing_address || ''),
      service_address_line_2: customer.same_as_billing
        ? (customer.billing_address_line_2 || '')
        : (customer.service_address_line_2 || customer.billing_address_line_2 || ''),
      service_city: customer.same_as_billing
        ? (customer.billing_city || '')
        : (customer.service_city || customer.billing_city || ''),
      service_state: customer.same_as_billing
        ? (customer.billing_state || '')
        : (customer.service_state || customer.billing_state || ''),
      service_zipcode: customer.same_as_billing
        ? (customer.billing_zipcode || '')
        : (customer.service_zipcode || customer.billing_zipcode || ''),
      service_country: customer.same_as_billing
        ? (customer.billing_country || 'USA')
        : (customer.service_country || customer.billing_country || 'USA'),
      tasks_to_complete: '',
      planned_end_date: '',
      arrival_window_start_time: '',
      arrival_window_end_time: ''
    })
    setSelectedAddressId('default')
    setSearchTerm('')
  }

  const handleAddressSelection = (addressId: string) => {
    setSelectedAddressId(addressId)

    if (addressId === 'default') {
      // Use customer's default address
      const customer = customers.find(c => c.id === formData.customer_id)
      if (!customer) return

      setFormData(prev => ({
        ...prev,
        service_address: customer.same_as_billing
          ? (customer.billing_address || '')
          : (customer.service_address || customer.billing_address || ''),
        service_address_line_2: customer.same_as_billing
          ? (customer.billing_address_line_2 || '')
          : (customer.service_address_line_2 || customer.billing_address_line_2 || ''),
        service_city: customer.same_as_billing
          ? (customer.billing_city || '')
          : (customer.service_city || customer.billing_city || ''),
        service_state: customer.same_as_billing
          ? (customer.billing_state || '')
          : (customer.service_state || customer.billing_state || ''),
        service_zipcode: customer.same_as_billing
          ? (customer.billing_zipcode || '')
          : (customer.service_zipcode || customer.billing_zipcode || ''),
        service_country: customer.same_as_billing
          ? (customer.billing_country || 'USA')
          : (customer.service_country || customer.billing_country || 'USA'),
      }))
    } else if (addressId === 'custom') {
      // Clear form for custom address entry
      setFormData(prev => ({
        ...prev,
        service_address: '',
        service_address_line_2: '',
        service_city: '',
        service_state: '',
        service_zipcode: '',
        service_country: 'USA',
      }))
    } else {
      // Use selected additional service address
      const address = serviceAddresses.find(addr => addr.id === addressId)
      if (!address) return

      setFormData(prev => ({
        ...prev,
        service_address: address.address || '',
        service_address_line_2: address.address_line_2 || '',
        service_city: address.city || '',
        service_state: address.state || '',
        service_zipcode: address.zipcode || '',
        service_country: address.country || 'USA',
      }))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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
      service_address: addressData.address,
      service_city: addressData.city,
      service_state: addressData.state,
      service_zipcode: addressData.zipcode,
      service_country: addressData.country || 'USA'
    }))
  }

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, service_address: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customer_id) {
      alert('Please select a customer')
      return
    }

    const arrivalStart = formData.arrival_window_start_time || ''
    const arrivalEnd = formData.arrival_window_end_time || ''

    if ((arrivalStart && !arrivalEnd) || (!arrivalStart && arrivalEnd)) {
      alert('Please set both arrival window times')
      return
    }

    if (arrivalStart && arrivalEnd) {
      const [startHour, startMinute] = arrivalStart.split(':').map(Number)
      const [endHour, endMinute] = arrivalEnd.split(':').map(Number)
      const startTotal = startHour * 60 + startMinute
      const endTotal = endHour * 60 + endMinute

      if (endTotal <= startTotal) {
        alert('Arrival window end time must be after start time')
        return
      }

      if (!formData.planned_end_date) {
        alert('Please set a planned completion date when using an arrival window')
        return
      }
    }

    setSubmitting(true)

    try {
      const jobData: Omit<Job, 'id' | 'created_at' | 'updated_at'> = {
        company_id: companyId,
        customer_id: formData.customer_id,
        title: formData.title,
        summary: formData.summary || null,
        service_address: formData.service_address || null,
        service_address_line_2: formData.service_address_line_2 || null,
        service_city: formData.service_city || null,
        service_state: formData.service_state || null,
        service_zipcode: formData.service_zipcode || null,
        service_country: formData.service_country || 'USA',
        tasks_to_complete: formData.tasks_to_complete || null,
        planned_end_date: formData.planned_end_date || null,
        arrival_window_start_time: arrivalStart || null,
        arrival_window_end_time: arrivalEnd || null,
        status: 'upcoming'
      }

      const response = await jobsService.create(jobData)

      if (response.error) throw new Error(response.error)

      alert('Job created successfully!')
      onSuccess()
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. Please try again.')
    }

    setSubmitting(false)
  }

  const selectedCustomer = customers.find(c => c.id === formData.customer_id)

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-6 border-2 border-purple-500">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-white">Create New Job</h2>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Customer <span className="text-red-500">*</span>
          </label>

          {!formData.customer_id ? (
            <div className="space-y-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search customers by name, email, or phone..."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />

              {searchTerm && (
                <div className="max-h-48 overflow-y-auto bg-gray-700 border border-gray-600 rounded-lg">
                  {loadingCustomers ? (
                    <div className="p-4 text-gray-400 text-sm">Loading customers...</div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="p-4 text-gray-400 text-sm">No customers found</div>
                  ) : (
                    filteredCustomers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleCustomerSelect(customer.id)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-600 border-b border-gray-600 last:border-b-0"
                      >
                        <div className="text-white font-medium">{customer.name}</div>
                        <div className="text-gray-400 text-sm">
                          {customer.email && <span>{customer.email}</span>}
                          {customer.email && customer.phone && <span className="mx-2">•</span>}
                          {customer.phone && <span>{customer.phone}</span>}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
              <div>
                <div className="text-white font-medium">{selectedCustomer?.name}</div>
                <div className="text-gray-400 text-sm">
                  {selectedCustomer?.email && <span>{selectedCustomer.email}</span>}
                  {selectedCustomer?.email && selectedCustomer?.phone && <span className="mx-2">•</span>}
                  {selectedCustomer?.phone && <span>{selectedCustomer.phone}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, customer_id: '' }))}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Job Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="e.g., Kitchen Remodel, Roof Repair"
          />
        </div>

        {/* Summary/Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Job Description / Estimate
          </label>
          <textarea
            name="summary"
            value={formData.summary}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Describe the job, scope of work, materials needed, estimated cost..."
          />
        </div>

        {/* Service Address */}
        <div className="bg-gray-700/50 border border-purple-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-300">
              Service Address
            </label>
          </div>

          {/* Address Selector Dropdown */}
          {formData.customer_id && (serviceAddresses.length > 0 || selectedCustomer) && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Select Service Location
              </label>
              <select
                value={selectedAddressId}
                onChange={(e) => handleAddressSelection(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="default">
                  {selectedCustomer?.same_as_billing ? 'Billing/Service Address (Default)' : 'Primary Service Address (Default)'}
                </option>
                {serviceAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label} - {addr.city}, {addr.state}
                  </option>
                ))}
                <option value="custom">Custom Address (Enter Manually)</option>
              </select>
              {serviceAddresses.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  <MapPin className="inline h-3 w-3 mr-1" />
                  {serviceAddresses.length} additional service {serviceAddresses.length === 1 ? 'address' : 'addresses'} available
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {selectedAddressId === 'custom' ? (
              <AddressAutocomplete
                value={formData.service_address}
                onChange={handleAddressChange}
                onPlaceSelected={handleAddressSelect}
                placeholder="Street address"
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            ) : (
              <input
                type="text"
                value={formData.service_address}
                readOnly
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                placeholder="Street address"
              />
            )}

            <input
              type="text"
              name="service_address_line_2"
              value={formData.service_address_line_2}
              onChange={handleInputChange}
              readOnly={selectedAddressId !== 'custom'}
              className={`w-full px-4 py-2 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                selectedAddressId === 'custom' ? 'bg-gray-800' : 'bg-gray-900 text-gray-400 cursor-not-allowed'
              }`}
              placeholder="Apt, Suite, Unit, Building, Floor, etc."
            />

            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                name="service_city"
                value={formData.service_city}
                onChange={handleInputChange}
                readOnly={selectedAddressId !== 'custom'}
                className={`w-full px-3 py-2 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  selectedAddressId === 'custom' ? 'bg-gray-800' : 'bg-gray-900 text-gray-400 cursor-not-allowed'
                }`}
                placeholder="City"
              />
              <input
                type="text"
                name="service_state"
                value={formData.service_state}
                onChange={handleInputChange}
                readOnly={selectedAddressId !== 'custom'}
                className={`w-full px-3 py-2 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  selectedAddressId === 'custom' ? 'bg-gray-800' : 'bg-gray-900 text-gray-400 cursor-not-allowed'
                }`}
                placeholder="State"
              />
              <input
                type="text"
                name="service_zipcode"
                value={formData.service_zipcode}
                onChange={handleInputChange}
                readOnly={selectedAddressId !== 'custom'}
                className={`w-full px-3 py-2 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  selectedAddressId === 'custom' ? 'bg-gray-800' : 'bg-gray-900 text-gray-400 cursor-not-allowed'
                }`}
                placeholder="Zip"
              />
            </div>
          </div>
        </div>

        {/* Tasks to Complete */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tasks to Complete
          </label>
          <textarea
            name="tasks_to_complete"
            value={formData.tasks_to_complete}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="List specific tasks, deliverables, or milestones..."
          />
        </div>

        {/* Planned End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Planned Completion Date
          </label>
          <input
            type="date"
            name="planned_end_date"
            value={formData.planned_end_date}
            onChange={handleInputChange}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Arrival Window */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Arrival Window
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              name="arrival_window_start_time"
              value={formData.arrival_window_start_time}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <input
              type="time"
              name="arrival_window_end_time"
              value={formData.arrival_window_end_time}
              onChange={handleInputChange}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Optional. Shows the preferred arrival range for the planned date.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-600">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !formData.customer_id}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  )
}
