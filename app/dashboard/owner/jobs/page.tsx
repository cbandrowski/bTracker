'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Customer, JobWithCustomer } from '@/types/database'
import { useRouter, useSearchParams } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { jobsService, companiesService } from '@/lib/services'

export default function JobsPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<JobWithCustomer[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '', // For display only
    title: '',
    summary: '',
    service_address: '',
    service_address_line_2: '',
    service_city: '',
    service_state: '',
    service_zipcode: '',
    service_country: 'USA',
    tasks_to_complete: '',
    planned_end_date: ''
  })

  useEffect(() => {
    const fetchJobs = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        // Get owned companies
        const companiesResponse = await companiesService.getAll()

        if (companiesResponse.error || !companiesResponse.data || companiesResponse.data.length === 0) {
          setLoadingData(false)
          return
        }

        setCompanyId(companiesResponse.data[0].id)

        // Fetch jobs via API
        const response = await jobsService.getAll()

        if (response.error) {
          console.error('Error fetching jobs:', response.error)
          setLoadingData(false)
          return
        }

        setJobs(response.data || [])
      } catch (error) {
        console.error('Error fetching jobs:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchJobs()
    }
  }, [profile])

  // Check if we should open the create form
  useEffect(() => {
    const shouldCreate = searchParams.get('create')
    if (shouldCreate === 'true') {
      const customerDataStr = sessionStorage.getItem('createJobForCustomer')
      if (customerDataStr) {
        const customer: Customer = JSON.parse(customerDataStr)

        // Pre-fill form with customer data
        setFormData({
          customer_id: customer.id,
          customer_name: customer.name,
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
          planned_end_date: ''
        })

        setShowForm(true)

        // Clear sessionStorage and URL param
        sessionStorage.removeItem('createJobForCustomer')
        router.replace('/dashboard/owner/jobs')
      }
    }
  }, [searchParams, router])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAddressSelect = (addressData: any) => {
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

    if (!formData.customer_id) {
      alert('Customer is required.')
      return
    }

    setSubmitting(true)

    try {
      const jobData = {
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
        status: 'upcoming'
      }

      const response = await jobsService.create(jobData as any)

      if (response.error) throw new Error(response.error)

      setJobs(prev => [response.data!, ...prev])
      setShowForm(false)

      // Reset form
      setFormData({
        customer_id: '',
        customer_name: '',
        title: '',
        summary: '',
        service_address: '',
        service_address_line_2: '',
        service_city: '',
        service_state: '',
        service_zipcode: '',
        service_country: 'USA',
        tasks_to_complete: '',
        planned_end_date: ''
      })

      alert('Job created successfully!')
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. Please try again.')
    }

    setSubmitting(false)
  }

  const upcomingJobs = jobs.filter(job => job.status === 'upcoming')
  const inProgressJobs = jobs.filter(job => job.status === 'in_progress')
  const doneJobs = jobs.filter(job => job.status === 'done')

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">
            Job Board ({jobs.length} total)
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {showForm ? 'Cancel' : '+ Create Job'}
          </button>
        </div>

        {/* Create Job Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <h3 className="text-md font-semibold text-white mb-4">New Job</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Customer *
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                  placeholder="Select customer from Customer List"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Go to Customers tab and click "Create Job" to select a customer
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Job Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Roof Repair, Lawn Maintenance"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Summary
                </label>
                <textarea
                  name="summary"
                  value={formData.summary}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Brief description of the job"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Planned End Date
                </label>
                <input
                  type="date"
                  name="planned_end_date"
                  value={formData.planned_end_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-white mb-2">Service Location</h4>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Street Address
                  </label>
                  <AddressAutocomplete
                    value={formData.service_address}
                    onChange={(value) => setFormData(prev => ({ ...prev, service_address: value }))}
                    onPlaceSelected={handleAddressSelect}
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
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tasks to Complete
              </label>
              <textarea
                name="tasks_to_complete"
                value={formData.tasks_to_complete}
                onChange={handleInputChange}
                rows={4}
                placeholder="List the tasks that need to be completed for this job..."
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
                disabled={submitting || !formData.customer_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        )}

        {/* Job Board - 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Upcoming Column (Red) */}
          <div className="bg-gray-900 rounded-lg border-2 border-red-600 overflow-hidden">
            <div className="bg-red-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Upcoming ({upcomingJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {upcomingJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No upcoming jobs</p>
              ) : (
                upcomingJobs.map((job) => (
                  <div key={job.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-red-500 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-gray-500 text-xs">
                        Due: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-gray-500 text-xs">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Column (Yellow) */}
          <div className="bg-gray-900 rounded-lg border-2 border-yellow-500 overflow-hidden">
            <div className="bg-yellow-500 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                In Progress ({inProgressJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {inProgressJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No jobs in progress</p>
              ) : (
                inProgressJobs.map((job) => (
                  <div key={job.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-yellow-500 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-gray-500 text-xs">
                        Due: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-gray-500 text-xs">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Done Column (Green) */}
          <div className="bg-gray-900 rounded-lg border-2 border-green-600 overflow-hidden">
            <div className="bg-green-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Done ({doneJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {doneJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No completed jobs</p>
              ) : (
                doneJobs.map((job) => (
                  <div key={job.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-green-600 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-gray-500 text-xs">
                        Completed: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-gray-500 text-xs">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
