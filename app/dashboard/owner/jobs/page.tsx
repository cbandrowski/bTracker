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
  const [paidJobIds, setPaidJobIds] = useState<Set<string>>(new Set())
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [returnPath, setReturnPath] = useState<string | null>(null)
  const [hasReturnPath, setHasReturnPath] = useState(false)

  // Form state
  const createEmptyForm = () => ({
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
  const [formData, setFormData] = useState(createEmptyForm)

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

        // Fetch paid job IDs
        const paidResponse = await fetch('/api/jobs/paid')
        if (paidResponse.ok) {
          const { paidJobIds: paidIds } = await paidResponse.json()
          setPaidJobIds(new Set(paidIds || []))
        }
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

        const storedReturnPath = sessionStorage.getItem('createJobReturnPath')
        if (storedReturnPath) {
          setReturnPath(storedReturnPath)
          setHasReturnPath(true)
        }

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
      setReturnPath(null)
      setHasReturnPath(false)
      sessionStorage.removeItem('createJobReturnPath')

      // Reset form
      setFormData(createEmptyForm())

      alert('Job created successfully!')
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. Please try again.')
    }

    setSubmitting(false)
  }

  const handleCancelCreateJob = () => {
    setShowForm(false)
    setFormData(createEmptyForm())

    const storedReturn = returnPath ?? sessionStorage.getItem('createJobReturnPath')
    const destination = hasReturnPath && storedReturn ? storedReturn : '/dashboard/owner/jobs'

    sessionStorage.removeItem('createJobReturnPath')
    setReturnPath(null)
    setHasReturnPath(false)
    router.replace(destination)
  }

  // Filter out paid jobs from all views
  const unpaidJobs = jobs.filter(job => !paidJobIds.has(job.id))

  const upcomingJobs = unpaidJobs.filter(job => job.status === 'upcoming')
  const inProgressJobs = unpaidJobs.filter(job => job.status === 'in_progress')
  const doneJobs = unpaidJobs.filter(job => job.status === 'done')

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-muted-foreground">Loading jobs...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-surface shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold guild-heading">
            Job Board ({jobs.length} total)
          </h2>
        </div>

        {/* Job Board - 3 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Upcoming Column (Red) */}
          <div className="glass-surface rounded-lg border-2 border-destructive overflow-hidden">
            <div className="bg-destructive px-4 py-3">
              <h3 className="text-destructive-foreground font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Upcoming ({upcomingJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {upcomingJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No upcoming jobs</p>
              ) : (
                upcomingJobs.map((job) => (
                  <div key={job.id} className="glass-surface p-3 rounded hover:border-destructive transition-colors">
                    <h4 className="text-foreground font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-muted-foreground text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-muted-foreground text-xs">
                        Due: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-muted-foreground text-xs">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Column (Yellow) */}
          <div className="glass-surface rounded-lg border-2 border-accent overflow-hidden">
            <div className="bg-accent px-4 py-3">
              <h3 className="text-accent-foreground font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                In Progress ({inProgressJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {inProgressJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No jobs in progress</p>
              ) : (
                inProgressJobs.map((job) => (
                  <div key={job.id} className="glass-surface p-3 rounded hover:border-accent transition-colors">
                    <h4 className="text-foreground font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-muted-foreground text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-muted-foreground text-xs">
                        Due: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-muted-foreground text-xs">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Done Column (Green) */}
          <div className="glass-surface rounded-lg border-2 border-secondary overflow-hidden">
            <div className="bg-secondary px-4 py-3">
              <h3 className="text-secondary-foreground font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Done ({doneJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {doneJobs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No completed jobs</p>
              ) : (
                doneJobs.map((job) => (
                  <div key={job.id} className="glass-surface p-3 rounded hover:border-secondary transition-colors">
                    <h4 className="text-foreground font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-muted-foreground text-xs mb-2">
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.planned_end_date && (
                      <p className="text-muted-foreground text-xs">
                        Completed: {new Date(job.planned_end_date).toLocaleDateString()}
                      </p>
                    )}
                    {job.service_city && (
                      <p className="text-muted-foreground text-xs">
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
