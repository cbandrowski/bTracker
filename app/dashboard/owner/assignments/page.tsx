'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Job, JobAssignment, CompanyEmployee, Profile, JobWithCustomer } from '@/types/database'

interface EmployeeWithProfile extends CompanyEmployee {
  profile: Profile
}

interface JobAssignmentWithDetails extends JobAssignment {
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

  useEffect(() => {
    const fetchData = async () => {
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
        setCompanyId(companyIds[0])

        // Fetch all employees
        const { data: employeesData } = await supabase
          .from('company_employees')
          .select(`
            *,
            profile:profiles(*)
          `)
          .in('company_id', companyIds)
          .eq('employment_status', 'active')

        setEmployees((employeesData as any) || [])

        // Fetch all jobs with customer info
        const { data: jobsData } = await supabase
          .from('jobs')
          .select(`
            *,
            customer:customers(*)
          `)
          .in('company_id', companyIds)
          .neq('status', 'done')
          .neq('status', 'cancelled')

        // Fetch all assignments
        const { data: assignmentsData } = await supabase
          .from('job_assignments')
          .select(`
            *,
            job:jobs(
              *,
              customer:customers(*)
            ),
            employee:company_employees(
              *,
              profile:profiles(*)
            )
          `)
          .in('company_id', companyIds)
          .neq('assignment_status', 'cancelled')

        setAssignments((assignmentsData as any) || [])

        // Filter unassigned jobs (jobs with no assignments)
        const assignedJobIds = new Set((assignmentsData || []).map((a: any) => a.job_id))
        const unassigned = (jobsData || []).filter((job: any) => !assignedJobIds.has(job.id))
        setUnassignedJobs(unassigned as any)

      } catch (error) {
        console.error('Error fetching data:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchData()
    }
  }, [profile])

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

      const { data, error } = await supabase
        .from('job_assignments')
        .insert([assignmentData])
        .select(`
          *,
          job:jobs(
            *,
            customer:customers(*)
          ),
          employee:company_employees(
            *,
            profile:profiles(*)
          )
        `)
        .single()

      if (error) throw error

      // Add to assignments list
      setAssignments(prev => [...prev, data as any])

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

  const handleRemoveAssignment = async (assignmentId: string, jobId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      // Remove from assignments list
      const removedAssignment = assignments.find(a => a.id === assignmentId)
      setAssignments(prev => prev.filter(a => a.id !== assignmentId))

      // Check if job should go back to unassigned
      const remainingAssignments = assignments.filter(a => a.job_id === jobId && a.id !== assignmentId)
      if (remainingAssignments.length === 0 && removedAssignment?.job) {
        setUnassignedJobs(prev => [...prev, removedAssignment.job as JobWithCustomer])
      }

      alert('Assignment removed successfully!')
    } catch (error) {
      console.error('Error removing assignment:', error)
      alert('Failed to remove assignment. Please try again.')
    }
  }

  const inProgressAssignments = assignments.filter(a =>
    a.assignment_status === 'assigned' || a.assignment_status === 'in_progress'
  )
  const doneAssignments = assignments.filter(a => a.assignment_status === 'done')

  // Group assignments by job
  const groupedInProgress = inProgressAssignments.reduce((acc, assignment) => {
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

  const groupedDone = doneAssignments.reduce((acc, assignment) => {
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

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-400">Loading assignments...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-6">
          Job Assignments
        </h2>

        {/* Three Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Unassigned Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-orange-600 overflow-hidden">
            <div className="bg-orange-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
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
                      Customer: {job.customer?.name || 'Unknown'}
                    </p>
                    {job.service_city && (
                      <p className="text-gray-500 text-xs mb-2">
                        {job.service_city}, {job.service_state}
                      </p>
                    )}

                    {assigningJobId === job.id ? (
                      <div className="mt-3 space-y-2">
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.profile.full_name} {emp.job_title ? `- ${emp.job_title}` : ''}
                            </option>
                          ))}
                        </select>

                        <input
                          type="datetime-local"
                          value={serviceStartDate}
                          onChange={(e) => setServiceStartDate(e.target.value)}
                          placeholder="Start Date/Time"
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="datetime-local"
                          value={serviceEndDate}
                          onChange={(e) => setServiceEndDate(e.target.value)}
                          placeholder="End Date/Time"
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none"
                      >
                        + Assign Employee
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-yellow-500 overflow-hidden">
            <div className="bg-yellow-500 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                Assigned / In Progress ({inProgressAssignments.length})
              </h3>
            </div>
            <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto">
              {Object.keys(groupedInProgress).length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No assignments in progress</p>
              ) : (
                Object.values(groupedInProgress).map((group) => (
                  <div key={group.job?.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                    <h4 className="text-white font-medium text-sm mb-1">{group.job?.title}</h4>
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {group.job?.customer?.name || 'Unknown'}
                    </p>

                    <div className="mt-3 space-y-2">
                      <p className="text-gray-300 text-xs font-semibold">Assigned Workers:</p>
                      {group.assignments.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-700 p-2 rounded">
                          <div className="flex justify-between items-start">
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
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                                assignment.assignment_status === 'in_progress'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}>
                                {assignment.assignment_status === 'in_progress' ? 'In Progress' : 'Assigned'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveAssignment(assignment.id, assignment.job_id)}
                              className="ml-2 text-red-400 hover:text-red-300"
                              title="Remove assignment"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Allow adding more employees to same job */}
                    <button
                      onClick={() => setAssigningJobId(group.job?.id || null)}
                      className="w-full mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none"
                    >
                      + Add Another Worker
                    </button>

                    {assigningJobId === group.job?.id && (
                      <div className="mt-3 space-y-2 border-t border-gray-600 pt-2">
                        <select
                          value={selectedEmployeeId}
                          onChange={(e) => setSelectedEmployeeId(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Employee</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.profile.full_name} {emp.job_title ? `- ${emp.job_title}` : ''}
                            </option>
                          ))}
                        </select>

                        <input
                          type="datetime-local"
                          value={serviceStartDate}
                          onChange={(e) => setServiceStartDate(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <input
                          type="datetime-local"
                          value={serviceEndDate}
                          onChange={(e) => setServiceEndDate(e.target.value)}
                          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAssignEmployee(group.job?.id || '')}
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
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Done Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-green-600 overflow-hidden">
            <div className="bg-green-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
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
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {group.job?.customer?.name || 'Unknown'}
                    </p>

                    <div className="mt-3 space-y-2">
                      <p className="text-gray-300 text-xs font-semibold">Completed By:</p>
                      {group.assignments.map((assignment) => (
                        <div key={assignment.id} className="bg-gray-700 p-2 rounded">
                          <p className="text-white text-xs font-medium">
                            {assignment.employee?.profile?.full_name}
                          </p>
                          {assignment.worker_confirmed_done_at && (
                            <p className="text-gray-400 text-xs mt-1">
                              Completed: {new Date(assignment.worker_confirmed_done_at).toLocaleString()}
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
