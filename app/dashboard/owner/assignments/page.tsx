'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { JobWithCustomer, AssignmentStatus } from '@/types/database'
import { assignmentsService, employeesService, jobsService, companiesService } from '@/lib/services'

interface EmployeeWithProfile {
  id: string
  profile?: {
    full_name: string
  }
  job_title?: string
}

interface JobAssignmentWithDetails {
  id: string
  job_id: string
  employee_id: string
  assignment_status: AssignmentStatus
  service_start_at?: string
  service_end_at?: string
  worker_confirmed_done_at?: string
  job?: JobWithCustomer
  employee?: EmployeeWithProfile
}

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const [unassignedJobs, setUnassignedJobs] = useState<JobWithCustomer[]>([])
  const [assignments, setAssignments] = useState<JobAssignmentWithDetails[]>([])
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  const [serviceStartDate, setServiceStartDate] = useState('')
  const [serviceEndDate, setServiceEndDate] = useState('')

  const fetchData = async () => {
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

      // Fetch all employees via API
      const employeesResponse = await employeesService.getAll()
      setEmployees((employeesResponse.data || []).filter((emp: any) =>
        emp.employment_status === 'active' && emp.approval_status === 'approved'
      ) as any)

      // Fetch all jobs via API
      const jobsResponse = await jobsService.getAll()
      const allJobs = (jobsResponse.data || []).filter(job => job.status !== 'cancelled')

      // Fetch all assignments via API
      const assignmentsResponse = await assignmentsService.getAll()
      setAssignments((assignmentsResponse.data as any) || [])

      // Filter unassigned jobs (jobs with no assignments)
      const assignedJobIds = new Set((assignmentsResponse.data || []).map((a: any) => a.job_id))
      const unassigned = allJobs.filter((job: any) =>
        !assignedJobIds.has(job.id) && job.status !== 'done'
      )
      setUnassignedJobs(unassigned)

    } catch (error) {
      console.error('Error fetching data:', error)
    }

    setLoadingData(false)
  }

  useEffect(() => {
    if (profile) {
      fetchData()
    }
  }, [profile])

  const handleChangeAssignmentStatus = async (assignmentId: string, newStatus: AssignmentStatus) => {
    try {
      const response = await assignmentsService.changeStatus(assignmentId, newStatus)

      if (response.error) throw new Error(response.error)

      // Update local state
      setAssignments(prev => prev.map(a => a.id === assignmentId ? response.data as any : a))

      // Refresh data to sync everything (job status is auto-updated by database trigger)
      fetchData()

      alert(`Assignment updated to ${newStatus}`)
    } catch (error) {
      console.error('Error updating assignment status:', error)
      alert('Failed to update assignment status')
    }
  }

  const handleAssignEmployee = async (jobId: string) => {
    if (!companyId || !selectedEmployeeId) {
      alert('Please select an employee')
      return
    }

    try {
      const assignmentData: any = {
        company_id: companyId,
        job_id: jobId,
        employee_id: selectedEmployeeId,
        assignment_status: 'assigned'
      }

      if (serviceStartDate) {
        assignmentData.service_start_at = new Date(serviceStartDate).toISOString()
      }
      if (serviceEndDate) {
        assignmentData.service_end_at = new Date(serviceEndDate).toISOString()
      }

      const response = await assignmentsService.create(assignmentData)

      if (response.error) throw new Error(response.error)

      // Add to assignments list
      setAssignments(prev => [...prev, response.data as any])

      // Remove from unassigned
      setUnassignedJobs(prev => prev.filter(job => job.id !== jobId))

      // Reset form
      setAssigningJobId(null)
      setSelectedEmployeeId('')
      setServiceStartDate('')
      setServiceEndDate('')

      alert('Employee assigned successfully!')
    } catch (error) {
      console.error('Error assigning employee:', error)
      alert('Failed to assign employee. Please try again.')
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

  const assignedAssignments = assignments.filter(a => a.assignment_status === 'assigned')
  const inProgressAssignments = assignments.filter(a => a.assignment_status === 'in_progress')
  const doneAssignments = assignments.filter(a => a.assignment_status === 'done')

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
  const groupedDone = groupByJob(doneAssignments)

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading assignments...</div>
      </div>
    )
  }

  const renderAssignmentCard = (assignment: JobAssignmentWithDetails, showStatusButtons: boolean) => (
    <div key={assignment.id} className="bg-gray-700 p-2 rounded">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="text-white text-xs font-medium">
            {assignment.employee?.profile?.full_name}
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
      {showStatusButtons && (
        <div className="flex gap-1 mt-2">
          {assignment.assignment_status === 'assigned' && (
            <button
              onClick={() => handleChangeAssignmentStatus(assignment.id, 'in_progress')}
              className="flex-1 px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
            >
              Start →
            </button>
          )}
          {assignment.assignment_status === 'in_progress' && (
            <button
              onClick={() => handleChangeAssignmentStatus(assignment.id, 'done')}
              className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
            >
              Complete →
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-6">
          Job Assignments
        </h2>

        {/* Four Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Unassigned Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-orange-600 overflow-hidden">
            <div className="bg-orange-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center text-sm">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Unassigned ({unassignedJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {unassignedJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No unassigned jobs</p>
              ) : (
                unassignedJobs.map((job) => (
                  <div key={job.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <h4 className="text-white font-medium text-sm mb-1">{job.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">
                      {job.customer?.name || 'Unknown'}
                    </p>

                    {assigningJobId === job.id ? (
                      <div className="mt-3 space-y-2">
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.profile?.full_name || 'Unknown'}
                            </option>
                          ))}
                        </select>

                        <input
                          type="datetime-local"
                          value={serviceStartDate}
                          onChange={(e) => setServiceStartDate(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                        />

                        <input
                          type="datetime-local"
                          value={serviceEndDate}
                          onChange={(e) => setServiceEndDate(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                        />

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
                              setServiceStartDate('')
                              setServiceEndDate('')
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
                    <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                    <p className="text-gray-400 text-xs mb-3">
                      {group.job?.customer?.name || 'Unknown'}
                    </p>
                    <div className="space-y-2">
                      {group.assignments.map((assignment) => renderAssignmentCard(assignment, true))}
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
                    <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                    <p className="text-gray-400 text-xs mb-3">
                      {group.job?.customer?.name || 'Unknown'}
                    </p>
                    <div className="space-y-2">
                      {group.assignments.map((assignment) => renderAssignmentCard(assignment, true))}
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
                Done ({doneAssignments.length})
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {Object.keys(groupedDone).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No completed assignments</p>
              ) : (
                Object.values(groupedDone).map((group) => (
                  <div key={group.job?.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                    <p className="text-gray-400 text-xs mb-3">
                      {group.job?.customer?.name || 'Unknown'}
                    </p>
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
        </div>
      </div>
    </div>
  )
}
