'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCompanyContext } from '@/contexts/CompanyContext'
import { useEffect, useMemo, useState } from 'react'
import { AssignmentStatus, CompanyEmployee, Customer, JobWithCustomer } from '@/types/database'
import { assignmentsService, employeesService, jobsService } from '@/lib/services'
import JobCreationForm from '@/components/JobCreationForm'
import { useSearchParams, useRouter } from 'next/navigation'

interface EmployeeWithProfile extends CompanyEmployee {
  profile?: {
    full_name: string
  } | null
}

interface JobAssignmentWithDetails {
  id: string
  company_id: string
  job_id: string
  employee_id: string
  assignment_status: AssignmentStatus
  service_start_at?: string | null
  service_end_at?: string | null
  worker_confirmed_done_at?: string | null
  notes?: string | null
  job?: JobWithCustomer
  employee?: EmployeeWithProfile
}

type JobWithServiceTimes = JobWithCustomer & {
  service_start_at?: string | null
  scheduled_start_at?: string | null
  start_at?: string | null
  scheduled_at?: string | null
  service_end_at?: string | null
  scheduled_end_at?: string | null
  end_at?: string | null
  arrival_window_start_time?: string | null
  arrival_window_end_time?: string | null
}

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const { activeCompanyId, loading: contextLoading } = useCompanyContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [unassignedJobs, setUnassignedJobs] = useState<JobWithCustomer[]>([])
  const [assignments, setAssignments] = useState<JobAssignmentWithDetails[]>([])
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([])
  const [paidJobIds, setPaidJobIds] = useState<Set<string>>(new Set())
  const [unbilledJobIds, setUnbilledJobIds] = useState<Set<string> | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [prefilledCustomer, setPrefilledCustomer] = useState<Customer | null>(null)

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEmployee, setFilterEmployee] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('all')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const ownerEmployeeId = useMemo(() => {
    if (!profile?.id) return null
    const ownerEmployee = employees.find((employee) => employee.profile_id === profile.id)
    return ownerEmployee?.id ?? null
  }, [employees, profile?.id])

  const fetchData = async () => {
    if (!profile?.id || !activeCompanyId) {
      if (!contextLoading) {
        setLoadingData(false)
      }
      return
    }

    try {
      // Fetch all employees via API
      const employeesResponse = await employeesService.getAll()
      const employeesData = (employeesResponse.data || []) as EmployeeWithProfile[]
      const activeEmployees = employeesData.filter(
        (emp) =>
          emp.company_id === activeCompanyId &&
          emp.employment_status === 'active' &&
          emp.approval_status === 'approved'
      )
      setEmployees(activeEmployees)

      // Fetch all jobs via API
      const jobsResponse = await jobsService.getAll()
      const allJobs = (jobsResponse.data || []).filter(
        (job) => job.company_id === activeCompanyId && job.status !== 'cancelled'
      )

      // Fetch all assignments via API
      const assignmentsResponse = await assignmentsService.getAll()
      const assignmentsData = ((assignmentsResponse.data || []) as JobAssignmentWithDetails[])
        .filter((assignment) => assignment.company_id === activeCompanyId)
      setAssignments(assignmentsData)

      // Fetch paid job IDs
      let paidJobIdsArray: string[] = []
      try {
        const paidResponse = await fetch('/api/jobs/paid')
        if (paidResponse.ok) {
          const { paidJobIds: paidIds } = await paidResponse.json()
          paidJobIdsArray = paidIds || []
          setPaidJobIds(new Set(paidJobIdsArray))
        }
      } catch (error) {
        console.error('Error fetching paid jobs:', error)
      }

      // Fetch unbilled job IDs (done jobs without invoices)
      try {
        const unbilledResponse = await fetch('/api/billing/unbilled-jobs')
        if (unbilledResponse.ok) {
          const data = await unbilledResponse.json()
          const jobIds = (data.jobs || []).map((job: { id: string }) => job.id)
          setUnbilledJobIds(new Set(jobIds))
        } else {
          setUnbilledJobIds(null)
        }
      } catch (error) {
        console.error('Error fetching unbilled jobs:', error)
        setUnbilledJobIds(null)
      }

      // Filter unassigned jobs (jobs with no assignments and not paid)
      const assignedJobIds = new Set(assignmentsData.map((assignment) => assignment.job_id))
      const paidJobIdsSet = new Set(paidJobIdsArray)
      const unassigned = allJobs.filter((job) =>
        !assignedJobIds.has(job.id) && job.status !== 'done' && !paidJobIdsSet.has(job.id)
      )
      setUnassignedJobs(unassigned)

    } catch (error) {
      console.error('Error fetching data:', error)
    }

    setLoadingData(false)
  }

  useEffect(() => {
    if (profile && activeCompanyId) {
      fetchData()
    } else if (!contextLoading) {
      setLoadingData(false)
    }
  }, [profile, activeCompanyId, contextLoading])

  useEffect(() => {
    const handleFocus = () => {
      if (profile?.id && activeCompanyId) {
        fetchData()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [profile?.id, activeCompanyId])

  // Check if we should open the create form from customer list
  useEffect(() => {
    const shouldCreate = searchParams.get('create')
    if (shouldCreate === 'true') {
      const customerDataStr = sessionStorage.getItem('createJobForCustomer')
      if (customerDataStr) {
        const customer: Customer = JSON.parse(customerDataStr)
        setPrefilledCustomer(customer)
        setShowForm(true)

        // Clear sessionStorage and URL param
        sessionStorage.removeItem('createJobForCustomer')
        router.replace('/dashboard/owner/assignments')
      }
    }
  }, [searchParams, router])

  const handleChangeAssignmentStatus = async (assignmentId: string, newStatus: AssignmentStatus) => {
    try {
      const response = await assignmentsService.changeStatus(assignmentId, newStatus)

      if (response.error) throw new Error(response.error)

      // Update local state
      if (response.data) {
        const updatedAssignment = response.data as JobAssignmentWithDetails
        setAssignments(prev => prev.map(a => a.id === assignmentId ? updatedAssignment : a))
      }

      // Refresh data to sync everything (job status is auto-updated by database trigger)
      fetchData()

      alert(`Assignment updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating assignment status:', error)
      const message = error instanceof Error ? error.message : 'Failed to update assignment status'
      alert(message)
    }
  }

  const handleAssignEmployee = async (jobId: string) => {
    if (!activeCompanyId || !selectedEmployeeId) {
      alert('Please select an employee')
      return
    }

    try {
      const assignmentData: {
        company_id: string
        job_id: string
        employee_id: string
        service_start_at?: string
        service_end_at?: string
      } = {
        company_id: activeCompanyId,
        job_id: jobId,
        employee_id: selectedEmployeeId,
      }

      const job = unassignedJobs.find(j => j.id === jobId) as JobWithServiceTimes | undefined
      if (job?.planned_end_date && job.arrival_window_start_time && job.arrival_window_end_time) {
        const [yearStr, monthStr, dayStr] = job.planned_end_date.split('-')
        const year = Number(yearStr)
        const month = Number(monthStr)
        const day = Number(dayStr)
        const [startHourStr, startMinuteStr] = job.arrival_window_start_time.split(':')
        const [endHourStr, endMinuteStr] = job.arrival_window_end_time.split(':')
        const startDate = new Date(
          year,
          month - 1,
          day,
          Number(startHourStr),
          Number(startMinuteStr),
          0,
          0
        )
        const endDate = new Date(
          year,
          month - 1,
          day,
          Number(endHourStr),
          Number(endMinuteStr),
          0,
          0
        )
        assignmentData.service_start_at = startDate.toISOString()
        assignmentData.service_end_at = endDate.toISOString()
      }

      const response = await assignmentsService.create(assignmentData)

      if (response.error) throw new Error(response.error)

      // Add to assignments list
      if (response.data) {
        const createdAssignment = response.data as JobAssignmentWithDetails
        setAssignments(prev => [...prev, createdAssignment])
      }

      // Remove from unassigned
      setUnassignedJobs(prev => prev.filter(job => job.id !== jobId))

      // Reset form
      setAssigningJobId(null)
      setSelectedEmployeeId('')

      alert('Employee assigned successfully!')
    } catch (error) {
      console.error('Error assigning employee:', error)
      const message = error instanceof Error ? error.message : 'Failed to assign employee. Please try again.'
      alert(message)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return
    }

    try {
      const response = await assignmentsService.delete(assignmentId)

      if (response.error) throw new Error(response.error)

      fetchData() // Refresh to update unassigned jobs

      alert('Assignment removed successfully!')
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert('Failed to remove assignment. Please try again.')
    }
  }

  const handleJobCreated = () => {
    setShowForm(false)
    setPrefilledCustomer(null)
    fetchData() // Refresh to show new job in unassigned
  }

  // Filter out assignments for paid jobs
  const unpaidAssignments = assignments.filter(a => !paidJobIds.has(a.job_id))

  // Apply search and filters
  const filterAssignments = (assignmentsList: JobAssignmentWithDetails[]) => {
    return assignmentsList.filter(assignment => {
      const job = assignment.job
      if (!job) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesCustomer = job.customer?.name?.toLowerCase().includes(query)
        const matchesTitle = job.title?.toLowerCase().includes(query)
        const matchesAddress = job.service_address?.toLowerCase().includes(query)
        const matchesCity = job.service_city?.toLowerCase().includes(query)

        if (!matchesCustomer && !matchesTitle && !matchesAddress && !matchesCity) {
          return false
        }
      }

      // Employee filter
      if (filterEmployee !== 'all' && assignment.employee_id !== filterEmployee) {
        return false
      }

      // Date filter
      if (filterDate !== 'all' && assignment.service_start_at) {
        const jobDate = new Date(assignment.service_start_at)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (filterDate === 'today') {
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          if (jobDate < today || jobDate >= tomorrow) return false
        } else if (filterDate === 'week') {
          const weekEnd = new Date(today)
          weekEnd.setDate(weekEnd.getDate() + 7)
          if (jobDate < today || jobDate >= weekEnd) return false
        } else if (filterDate === 'overdue') {
          if (jobDate >= today) return false
        }
      }

      return true
    })
  }

  // Filter unassigned jobs
  const filteredUnassignedJobs = unassignedJobs.filter(job => {
    if (!job) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesCustomer = job.customer?.name?.toLowerCase().includes(query)
      const matchesTitle = job.title?.toLowerCase().includes(query)
      const matchesAddress = job.service_address?.toLowerCase().includes(query)
      const matchesCity = job.service_city?.toLowerCase().includes(query)

      if (!matchesCustomer && !matchesTitle && !matchesAddress && !matchesCity) {
        return false
      }
    }

    return true
  })

  const assignedAssignments = filterAssignments(unpaidAssignments.filter(a => a.assignment_status === 'assigned'))
  const inProgressAssignments = filterAssignments(unpaidAssignments.filter(a => a.assignment_status === 'in_progress'))
  const heldAssignments = filterAssignments(
    unpaidAssignments.filter(a =>
      a.assignment_status === 'done' &&
      (!unbilledJobIds || unbilledJobIds.has(a.job_id)) &&
      a.job?.billing_hold
    )
  )
  const readyDoneAssignments = filterAssignments(
    unpaidAssignments.filter(a =>
      a.assignment_status === 'done' &&
      (!unbilledJobIds || unbilledJobIds.has(a.job_id)) &&
      !a.job?.billing_hold
    )
  )

  // Group assignments by job
  const groupByJob = (assignments: JobAssignmentWithDetails[]) => {
    return assignments.reduce((acc, assignment) => {
      const jobId = assignment.job_id
      if (!acc[jobId]) {
        acc[jobId] = {
          job: assignment.job,
          assignments: []
        }
      }
      acc[jobId].assignments.push(assignment)
      return acc
    }, {} as Record<string, { job?: JobWithCustomer, assignments: JobAssignmentWithDetails[] }>)
  }

  const groupedAssigned = groupByJob(assignedAssignments)
  const groupedInProgress = groupByJob(inProgressAssignments)
  const groupedDone = groupByJob(readyDoneAssignments)
  const groupedHeldByCustomer = heldAssignments.reduce((acc, assignment) => {
    const customer = assignment.job?.customer ?? null
    const customerId = customer?.id || assignment.job?.customer_id
    const key = customerId ?? 'unknown'

    if (!acc[key]) {
      acc[key] = {
        customer,
        customerId,
        jobIds: new Set<string>(),
        assignments: []
      }
    }

    acc[key].jobIds.add(assignment.job_id)
    acc[key].assignments.push(assignment)
    return acc
  }, {} as Record<string, {
    customer: Customer | null
    customerId?: string
    jobIds: Set<string>
    assignments: JobAssignmentWithDetails[]
  }>)

  const heldCustomerGroups = Object.entries(groupedHeldByCustomer)
    .map(([key, group]) => ({
      key,
      ...group
    }))
    .sort((left, right) => {
      const leftName = left.customer?.name || 'Unknown Client'
      const rightName = right.customer?.name || 'Unknown Client'
      return leftName.localeCompare(rightName)
    })

  // Calculate employee workload
  const getEmployeeWorkload = (employeeId: string) => {
    const activeAssignments = unpaidAssignments.filter(
      a => a.employee_id === employeeId && (a.assignment_status === 'assigned' || a.assignment_status === 'in_progress')
    )
    return activeAssignments.length
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading assignments...</div>
      </div>
    )
  }

  const renderJobDetails = (job?: JobWithCustomer) => {
    if (!job) return null
    const formatArrivalTime = (timeValue: string) => {
      const [hoursStr, minutesStr] = timeValue.split(':')
      const hours = Number(hoursStr)
      const minutes = Number(minutesStr)
      const date = new Date()
      date.setHours(hours, minutes, 0, 0)
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    return (
      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2 text-xs">
        {job.planned_end_date && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v2h16V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm12 8H2v6a2 2 0 002 2h12a2 2 0 002-2v-6z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-300">
              Complete by: {new Date(job.planned_end_date).toLocaleDateString()}
            </span>
          </div>
        )}
        {job.arrival_window_start_time && job.arrival_window_end_time && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.553.894l2.5 1.25a1 1 0 10.894-1.788L11 10.382V7z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-300">
              Arrival window: {formatArrivalTime(job.arrival_window_start_time)} - {formatArrivalTime(job.arrival_window_end_time)}
            </span>
          </div>
        )}
        {job.customer?.phone && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
            <a href={`tel:${job.customer.phone}`} className="text-green-400 hover:underline">
              {job.customer.phone}
            </a>
          </div>
        )}
        {job.customer?.email && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <a href={`mailto:${job.customer.email}`} className="text-blue-400 hover:underline">
              {job.customer.email}
            </a>
          </div>
        )}
        {job.service_address && (
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-purple-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-gray-300">{job.service_address}</p>
              {job.service_city && job.service_state && (
                <p className="text-gray-400">
                  {job.service_city}, {job.service_state} {job.service_zipcode}
                </p>
              )}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${job.service_address}, ${job.service_city}, ${job.service_state} ${job.service_zipcode}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline text-xs mt-1 inline-block"
              >
                Get Directions →
              </a>
            </div>
          </div>
        )}
        {job.summary && (
          <div className="pt-2">
            <p className="text-gray-400 font-medium">Description:</p>
            <p className="text-gray-300 mt-1">{job.summary}</p>
          </div>
        )}
        {job.tasks_to_complete && (
          <div className="pt-2">
            <p className="text-gray-400 font-medium">Tasks:</p>
            <p className="text-gray-300 mt-1 whitespace-pre-wrap">{job.tasks_to_complete}</p>
          </div>
        )}
      </div>
    )
  }

  const renderAssignmentCard = (assignment: JobAssignmentWithDetails) => {
    const isOwnerAssignment =
      ownerEmployeeId !== null && assignment.employee_id === ownerEmployeeId
    const employeeName = assignment.employee?.profile?.full_name || 'Unknown'

    return (
      <div key={assignment.id} className="bg-gray-700 p-2 rounded">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <p className="text-white text-xs font-medium">
              {isOwnerAssignment ? `${employeeName} (You)` : employeeName}
            </p>
            {assignment.employee?.job_title && (
              <p className="text-gray-400 text-xs">
                {assignment.employee.job_title}
              </p>
            )}
            {assignment.service_start_at && (
              <p className="text-gray-400 text-xs mt-1">
                {new Date(assignment.service_start_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
                {assignment.service_end_at && (
                  <> - {new Date(assignment.service_end_at).toLocaleString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}</>
                )}
              </p>
            )}
            {isOwnerAssignment ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {assignment.assignment_status === 'assigned' && (
                  <button
                    onClick={() => handleChangeAssignmentStatus(assignment.id, 'in_progress')}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    Start
                  </button>
                )}
                {assignment.assignment_status === 'in_progress' && (
                  <button
                    onClick={() => handleChangeAssignmentStatus(assignment.id, 'done')}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    Mark Done
                  </button>
                )}
                {assignment.assignment_status === 'done' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-200">
                    Done
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  assignment.assignment_status === 'assigned' ? 'bg-blue-900 text-blue-200' :
                  assignment.assignment_status === 'in_progress' ? 'bg-yellow-900 text-yellow-200' :
                  'bg-green-900 text-green-200'
                }`}>
                  {assignment.assignment_status === 'assigned' && 'Assigned'}
                  {assignment.assignment_status === 'in_progress' && 'In Progress'}
                  {assignment.assignment_status === 'done' && 'Done'}
                </span>
                <p className="text-gray-500 text-xs mt-1 italic">
                  Employee manages status
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => handleRemoveAssignment(assignment.id)}
            className="ml-2 text-red-400 hover:text-red-300"
            title="Remove assignment"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  const handleCreateInvoice = (job?: JobWithCustomer) => {
    if (!job?.id) {
      return
    }
    const customerId = job.customer?.id || job.customer_id
    if (!customerId) {
      alert('Customer not found for this job.')
      return
    }
    router.push(`/dashboard/owner/customers/${customerId}/billing?jobId=${job.id}`)
  }

  const handleBillingHoldChange = async (jobId: string, hold: boolean) => {
    try {
      const response = await jobsService.setBillingHold(jobId, hold)

      if (response.error) throw new Error(response.error)

      fetchData()
      alert(hold ? 'Job saved for later invoicing.' : 'Job moved back to Done.')
    } catch (error) {
      console.error('Error updating billing hold:', error)
      const message = error instanceof Error ? error.message : 'Failed to update job billing status'
      alert(message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Job Form */}
      {showForm && activeCompanyId && (
        <JobCreationForm
          companyId={activeCompanyId}
          onSuccess={handleJobCreated}
          onCancel={() => {
            setShowForm(false)
            setPrefilledCustomer(null)
          }}
          prefilledCustomer={prefilledCustomer}
        />
      )}

      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-white">
            Job Assignments
          </h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Job
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer, job title, or address..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Employee Filter */}
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.profile?.full_name || 'Unknown'}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="all">All Dates</option>
              <option value="today">Due Today</option>
              <option value="week">This Week</option>
              <option value="overdue">Overdue</option>
            </select>

            {/* Clear Filters Button */}
            {(searchQuery || filterEmployee !== 'all' || filterDate !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterEmployee('all')
                  setFilterDate('all')
                }}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Four Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Unassigned Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-orange-600 overflow-hidden">
            <div className="bg-orange-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Unassigned ({filteredUnassignedJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {filteredUnassignedJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No unassigned jobs</p>
              ) : (
                filteredUnassignedJobs.map((job) => (
                  <div key={job.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm mb-1">{job.title}</h4>
                          <p className="text-gray-400 text-xs mb-2">
                            {job.customer?.name || 'Unknown'}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedJobId === job.id ? 'rotate-180' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedJobId === job.id && renderJobDetails(job)}

                    {assigningJobId === job.id ? (
                      <div className="mt-3 space-y-2">
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => {
                            const workload = getEmployeeWorkload(emp.id)
                            return (
                              <option key={emp.id} value={emp.id}>
                                {emp.profile?.full_name || 'Unknown'} ({workload} {workload === 1 ? 'job' : 'jobs'})
                              </option>
                            )
                          })}
                        </select>
                        {selectedEmployeeId && (
                          <div className="text-xs mt-1">
                            {(() => {
                              const workload = getEmployeeWorkload(selectedEmployeeId)
                              const color = workload <= 2 ? 'text-green-400' : workload <= 5 ? 'text-yellow-400' : 'text-red-400'
                              return (
                                <span className={color}>
                                  {workload === 0 && '✓ Available'}
                                  {workload > 0 && workload <= 2 && '✓ Light workload'}
                                  {workload > 2 && workload <= 5 && '⚠ Moderate workload'}
                                  {workload > 5 && '⚠ Heavy workload'}
                                </span>
                              )
                            })()}
                          </div>
                        )}


                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAssignEmployee(job.id)}
                            disabled={!selectedEmployeeId}
                            className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => {
                              setAssigningJobId(null)
                              setSelectedEmployeeId('')
                            }}
                            className="flex-1 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigningJobId(job.id)}
                        className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        + Assign
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Assigned Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-blue-600 overflow-hidden">
            <div className="bg-blue-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Assigned ({assignedAssignments.length})
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {Object.keys(groupedAssigned).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No assigned jobs</p>
              ) : (
                Object.values(groupedAssigned).map((group) => (
                  <div key={group.job?.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        if (group.job?.id) {
                          setExpandedJobId(expandedJobId === group.job.id ? null : group.job.id)
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                          <p className="text-gray-400 text-xs mb-3">
                            {group.job?.customer?.name || 'Unknown'}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedJobId === group.job?.id ? 'rotate-180' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {expandedJobId === group.job?.id && renderJobDetails(group.job)}
                    <div className="space-y-2">
                      {group.assignments.map((assignment) => renderAssignmentCard(assignment))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-yellow-500 overflow-hidden">
            <div className="bg-yellow-500 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                In Progress ({inProgressAssignments.length})
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {Object.keys(groupedInProgress).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No jobs in progress</p>
              ) : (
                Object.values(groupedInProgress).map((group) => (
                  <div key={group.job?.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        if (group.job?.id) {
                          setExpandedJobId(expandedJobId === group.job.id ? null : group.job.id)
                        }
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                          <p className="text-gray-400 text-xs mb-3">
                            {group.job?.customer?.name || 'Unknown'}
                          </p>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${expandedJobId === group.job?.id ? 'rotate-180' : ''}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {expandedJobId === group.job?.id && renderJobDetails(group.job)}
                    <div className="space-y-2">
                      {group.assignments.map((assignment) => renderAssignmentCard(assignment))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Done Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-green-600 overflow-hidden">
            <div className="bg-green-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Done ({readyDoneAssignments.length})
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {Object.keys(groupedDone).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No completed assignments</p>
              ) : (
                Object.values(groupedDone).map((group) => (
                  <div key={group.job?.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (group.job?.id) {
                            setExpandedJobId(expandedJobId === group.job.id ? null : group.job.id)
                          }
                        }}
                        className="flex-1 text-left"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                            <p className="text-gray-400 text-xs mb-3">
                              {group.job?.customer?.name || 'Unknown'}
                            </p>
                          </div>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${expandedJobId === group.job?.id ? 'rotate-180' : ''}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </button>
                      {group.job?.id && (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleCreateInvoice(group.job)
                            }}
                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Create Invoice
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              const jobId = group.job?.id
                              if (!jobId) {
                                return
                              }
                              handleBillingHoldChange(jobId, true)
                            }}
                            className="px-2 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-500"
                          >
                            Save For Later
                          </button>
                        </div>
                      )}
                    </div>
                    {expandedJobId === group.job?.id && renderJobDetails(group.job)}
                    <div className="space-y-2">
                      {group.assignments.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-700 p-2 rounded">
                          <p className="text-white text-xs font-medium">
                            {assignment.employee?.profile?.full_name}
                          </p>
                          {assignment.worker_confirmed_done_at && (
                            <p className="text-gray-400 text-xs mt-1">
                              {new Date(assignment.worker_confirmed_done_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Saved For Invoice Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-purple-500 overflow-hidden">
            <div className="bg-purple-500 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-2.414-2.414A2 2 0 0013.586 3H4zm8 2a1 1 0 100 2h2V5h-2zm-8 0v10h12V9H3a1 1 0 010-2h2V5H4z" clipRule="evenodd" />
                </svg>
                Saved For Invoice ({heldCustomerGroups.length} clients)
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {heldCustomerGroups.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No saved jobs</p>
              ) : (
                heldCustomerGroups.map((group) => (
                  <div key={group.key} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-white font-medium text-sm">
                          {group.customer?.name || 'Unknown Client'}
                        </h4>
                        <p className="text-gray-400 text-xs">
                          {group.jobIds.size} unbilled job{group.jobIds.size === 1 ? '' : 's'}
                        </p>
                      </div>
                      {group.customerId ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/owner/customers/${group.customerId}/billing`)}
                          className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                        >
                          Open Billing
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 text-xs rounded bg-gray-700 text-gray-300">
                          No billing profile
                        </span>
                      )}
                    </div>
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
