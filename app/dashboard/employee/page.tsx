'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { JobAssignment, JobWithCustomer } from '@/types/database'

interface JobAssignmentWithJob extends JobAssignment {
  job?: JobWithCustomer
}

export default function EmployeeDashboardPage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<JobAssignmentWithJob[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        // Get employee record
        const { data: employeeData } = await supabase
          .from('company_employees')
          .select('id')
          .eq('profile_id', profile.id)
          .single()

        if (!employeeData) {
          setLoadingData(false)
          return
        }

        // Fetch all job assignments for this employee
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('job_assignments')
          .select(`
            *,
            job:jobs(
              *,
              customer:customers(*),
              company:companies(*)
            )
          `)
          .eq('employee_id', employeeData.id)
          .neq('assignment_status', 'cancelled')
          .order('service_start_at', { ascending: true, nullsFirst: false })

        if (assignmentsError) {
          console.error('Error fetching assignments:', assignmentsError)
        }

        console.log('Fetched assignments:', assignmentsData)
        setAssignments((assignmentsData as any) || [])
      } catch (error) {
        console.error('Error fetching assignments:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchAssignments()
    }
  }, [profile])

  const assignedJobs = assignments.filter(a => a.assignment_status === 'assigned')
  const inProgressJobs = assignments.filter(a => a.assignment_status === 'in_progress')
  const doneJobs = assignments.filter(a => a.assignment_status === 'done')

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-6">
          My Assignments ({assignments.length} total)
        </h2>

        {/* Three Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Assigned Section */}
          <div className="bg-gray-900 rounded-lg border-2 border-blue-600 overflow-hidden">
            <div className="bg-blue-600 px-4 py-3">
              <h3 className="text-white font-semibold flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Assigned ({assignedJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {assignedJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No assigned jobs</p>
              ) : (
                assignedJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-blue-500 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-blue-400 text-xs mb-1 font-semibold">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.job?.service_address && (
                      <p className="text-gray-500 text-xs mb-2">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {assignment.job.service_address}
                        {assignment.job.service_city && (
                          <>, {assignment.job.service_city}, {assignment.job.service_state}</>
                        )}
                      </p>
                    )}
                    {assignment.service_start_at && (
                      <p className="text-gray-500 text-xs">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
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
                    {assignment.job?.tasks_to_complete && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-gray-400 text-xs font-semibold mb-1">Tasks:</p>
                        <p className="text-gray-500 text-xs whitespace-pre-line">{assignment.job.tasks_to_complete}</p>
                      </div>
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
                In Progress ({inProgressJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {inProgressJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No jobs in progress</p>
              ) : (
                inProgressJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-yellow-500 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-blue-400 text-xs mb-1 font-semibold">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.job?.service_address && (
                      <p className="text-gray-500 text-xs mb-2">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {assignment.job.service_address}
                        {assignment.job.service_city && (
                          <>, {assignment.job.service_city}, {assignment.job.service_state}</>
                        )}
                      </p>
                    )}
                    {assignment.service_start_at && (
                      <p className="text-gray-500 text-xs">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        {new Date(assignment.service_start_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {assignment.job?.tasks_to_complete && (
                      <div className="mt-2 pt-2 border-t border-gray-700">
                        <p className="text-gray-400 text-xs font-semibold mb-1">Tasks:</p>
                        <p className="text-gray-500 text-xs whitespace-pre-line">{assignment.job.tasks_to_complete}</p>
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
                Completed ({doneJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {doneJobs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No completed jobs</p>
              ) : (
                doneJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-gray-800 p-3 rounded border border-gray-700 hover:border-green-600 transition-colors">
                    <h4 className="text-white font-medium text-sm mb-1">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-blue-400 text-xs mb-1 font-semibold">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs mb-2">
                      Customer: {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.worker_confirmed_done_at && (
                      <p className="text-gray-500 text-xs">
                        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Completed: {new Date(assignment.worker_confirmed_done_at).toLocaleString()}
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
