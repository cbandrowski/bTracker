'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Customer } from '@/types/database'
import AddressAutocomplete, { ParsedAddress } from '@/components/AddressAutocomplete'
import { useRouter } from 'next/navigation'
import { customersService, companiesService } from '@/lib/services'
import { getCustomersWithBilling, CustomerWithBilling } from '@/app/actions/customers'
import { CustomersTable } from '@/components/customers/CustomersTable'
import { AddPaymentDrawer } from '@/components/customers/AddPaymentDrawer'
import { ApplyPaymentDrawer } from '@/components/billing/ApplyPaymentDrawer'
import { CustomersTableSkeleton } from '@/components/customers/CustomersTableSkeleton'
import { CreateRecurringJobDrawer } from '@/components/jobs/CreateRecurringJobDrawer'

export default function CustomersPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersWithBilling, setCustomersWithBilling] = useState<CustomerWithBilling[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [depositDrawerOpen, setDepositDrawerOpen] = useState(false)
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)
  const [recurringJobDrawerOpen, setRecurringJobDrawerOpen] = useState(false)
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<{
    id: string
    name: string
  } | null>(null)

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

  const fetchCustomersData = async () => {
    if (!profile?.id) {
      setLoadingData(false)
      return
    }

    try {
      setLoadingData(true)

      // Get owned companies
      const companiesResponse = await companiesService.getAll()

      if (companiesResponse.error || !companiesResponse.data || companiesResponse.data.length === 0) {
        setLoadingData(false)
        return
      }

      setCompanyId(companiesResponse.data[0].id) // Use first company for now

      // Fetch customers via API
      const response = await customersService.getAll()

      if (response.error) {
        console.error('Error fetching customers:', response.error)
        setLoadingData(false)
        return
      }

      setCustomers(response.data || [])

      // Fetch customers with billing data
      const billingData = await getCustomersWithBilling()
      setCustomersWithBilling(billingData)
    } catch (error) {
      console.error('Error fetching customers:', error)
    }

    setLoadingData(false)
  }

  useEffect(() => {
    if (profile) {
      fetchCustomersData()
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

  const handleBillingAddressSelect = (address: ParsedAddress) => {
    console.log('🏠 Billing address parsed from Google:', address)
    const {
      address: streetAddress,
      addressLine2,
      city,
      state,
      zipcode,
      country,
    } = address

    setFormData(prev => ({
      ...prev,
      billing_address: streetAddress,
      billing_address_line_2: addressLine2 || prev.billing_address_line_2,
      billing_city: city,
      billing_state: state,
      billing_zipcode: zipcode,
      billing_country: country,
      ...(prev.same_as_billing ? {
        service_address: streetAddress,
        service_address_line_2: addressLine2 || prev.service_address_line_2,
        service_city: city,
        service_state: state,
        service_zipcode: zipcode,
        service_country: country
      } : {})
    }))
  }

  const handleServiceAddressSelect = (address: ParsedAddress) => {
    console.log('🏠 Service address parsed from Google:', address)
    setFormData(prev => ({
      ...prev,
      service_address: address.address,
      service_address_line_2: address.addressLine2 || prev.service_address_line_2,
      service_city: address.city,
      service_state: address.state,
      service_zipcode: address.zipcode,
      service_country: address.country
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
      if (editingCustomer) {
        // Update existing customer via API
        const response = await customersService.update(editingCustomer.id, formData)

        if (response.error) throw new Error(response.error)

        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? response.data! : c))

        // Refresh billing data to update the table
        await fetchCustomersData()

        alert('Customer updated successfully!')
      } else {
        // Create new customer via API
        const customerData = {
          company_id: companyId,
          ...formData
        }

        const response = await customersService.create(customerData as any)

        if (response.error) throw new Error(response.error)

        setCustomers(prev => [response.data!, ...prev])

        // Refresh billing data to show the new customer in the table
        await fetchCustomersData()

        alert('Customer created successfully!')
      }

      setShowForm(false)
      setEditingCustomer(null)

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
    } catch (error) {
      console.error('Error saving customer:', error)
      alert(`Failed to ${editingCustomer ? 'update' : 'create'} customer. Please try again.`)
    }

    setSubmitting(false)
  }

  const handleEditCustomer = (customerWithBilling: CustomerWithBilling | Customer) => {
    // Find the full customer data from the customers array
    const fullCustomer = customers.find(c => c.id === customerWithBilling.id)
    if (!fullCustomer) return

    setEditingCustomer(fullCustomer)
    setFormData({
      name: fullCustomer.name,
      phone: fullCustomer.phone || '',
      email: fullCustomer.email || '',
      billing_address: fullCustomer.billing_address || '',
      billing_address_line_2: fullCustomer.billing_address_line_2 || '',
      billing_city: fullCustomer.billing_city || '',
      billing_state: fullCustomer.billing_state || '',
      billing_zipcode: fullCustomer.billing_zipcode || '',
      billing_country: fullCustomer.billing_country || 'USA',
      service_address: fullCustomer.service_address || '',
      service_address_line_2: fullCustomer.service_address_line_2 || '',
      service_city: fullCustomer.service_city || '',
      service_state: fullCustomer.service_state || '',
      service_zipcode: fullCustomer.service_zipcode || '',
      service_country: fullCustomer.service_country || 'USA',
      same_as_billing: fullCustomer.same_as_billing,
      notes: fullCustomer.notes || ''
    })
    setShowForm(false) // Don't show the top form
    // Scroll to the customer row after a brief delay to let the edit form render
    setTimeout(() => {
      const element = document.getElementById(`customer-${fullCustomer.id}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  }

  const handleCancelEdit = () => {
    setEditingCustomer(null)
    setShowForm(false)
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
  }

  const handleAddDeposit = (customerId: string, customerName: string) => {
    setSelectedCustomerForPayment({ id: customerId, name: customerName })
    setDepositDrawerOpen(true)
  }

  const handleAddPayment = (customerId: string, customerName: string) => {
    setSelectedCustomerForPayment({ id: customerId, name: customerName })
    setPaymentDrawerOpen(true)
  }

  const handleCreateRecurringJob = (customerId: string, customerName: string) => {
    setSelectedCustomerForPayment({ id: customerId, name: customerName })
    setRecurringJobDrawerOpen(true)
  }

  const handlePaymentSuccess = () => {
    // Refresh customer billing data
    fetchCustomersData()
  }

  const handleRecurringJobSuccess = () => {
    // Jobs created, could refresh if needed
    fetchCustomersData()
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

        {/* Create/Edit Customer Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-white">
                {editingCustomer ? 'Edit Customer' : 'New Customer'}
              </h3>
              {editingCustomer && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
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
                {submitting ? (editingCustomer ? 'Updating...' : 'Creating...') : (editingCustomer ? 'Update Customer' : 'Create Customer')}
              </button>
            </div>
          </form>
        )}

        {/* Customer List with Billing */}
        {loadingData ? (
          <CustomersTableSkeleton />
        ) : (
          <CustomersTable
            customers={customersWithBilling}
            onAddDeposit={handleAddDeposit}
            onAddPayment={handleAddPayment}
            onEditCustomer={handleEditCustomer}
            onCreateRecurringJob={handleCreateRecurringJob}
            editingCustomer={editingCustomer}
            formData={formData}
            onFormChange={setFormData}
            onSubmit={handleSubmit}
            onCancelEdit={handleCancelEdit}
            submitting={submitting}
            onBillingAddressSelect={handleBillingAddressSelect}
            onServiceAddressSelect={handleServiceAddressSelect}
            onSameAsBillingToggle={handleSameAsBillingToggle}
            onInputChange={handleInputChange}
          />
        )}
      </div>

      {/* Add Deposit Drawer */}
      {selectedCustomerForPayment && (
        <AddPaymentDrawer
          open={depositDrawerOpen}
          onOpenChange={setDepositDrawerOpen}
          customerId={selectedCustomerForPayment.id}
          customerName={selectedCustomerForPayment.name}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Add Payment Drawer */}
      {selectedCustomerForPayment && (
        <ApplyPaymentDrawer
          open={paymentDrawerOpen}
          onOpenChange={setPaymentDrawerOpen}
          customerId={selectedCustomerForPayment.id}
          customerName={selectedCustomerForPayment.name}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Create Recurring Job Drawer */}
      {selectedCustomerForPayment && (
        <CreateRecurringJobDrawer
          open={recurringJobDrawerOpen}
          onOpenChange={setRecurringJobDrawerOpen}
          customerId={selectedCustomerForPayment.id}
          customerName={selectedCustomerForPayment.name}
          onSuccess={handleRecurringJobSuccess}
        />
      )}
    </div>
  )
}
