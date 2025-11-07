'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Job, JobAssignment, Customer, Profile } from '@/types/database'

type AssignmentStatus = 'assigned' | 'in_progress' | 'done'

interface AssignmentWithDetails extends JobAssignment {
  jobs: Job & {
    customers: Customer
  }
  profiles: Profile
}

export default function EmployeeAssignmentsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (!profile) {
        router.push('/onboarding')
      }
    }
  }, [user, loading, profile, router])

  // Get employee ID for the current user
  useEffect(() => {
    const getEmployeeId = async () => {
      if (!profile?.id) return

      const { data: employeeData } = await supabase
        .from('company_employees')
        .select('id')
        .eq('profile_id', profile.id)
        .single()

      if (employeeData) {
        setEmployeeId(employeeData.id)
      }
    }

    if (profile) {
      getEmployeeId()
    }
  }, [profile])

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!employeeId) {
        console.log('Employee Assignments: No employee ID yet')
        setLoadingData(false)
        return
      }

      console.log('Employee Assignments: Fetching assignments for employee ID:', employeeId)

      try {
        const { data, error } = await supabase
          .from('job_assignments')
          .select(`
            *,
            jobs (
              *,
              customers (*)
            ),
            profiles (*)
          `)
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching assignments:', error)
        } else {
          console.log('Employee Assignments: Fetched assignments:', data)
          setAssignments(data as AssignmentWithDetails[] || [])
        }
      } catch (error) {
        console.error('Error:', error)
      }

      setLoadingData(false)
    }

    if (employeeId) {
      fetchAssignments()
    }
  }, [employeeId])

  const handleChangeAssignmentStatus = async (assignmentId: string, newStatus: AssignmentStatus) => {
    console.log('Attempting to change assignment status:', assignmentId, 'to', newStatus)

    try {
      const updateData: any = {
        assignment_status: newStatus,
      }

      // When marking as done, set the worker confirmed timestamp
      if (newStatus === 'done') {
        updateData.worker_confirmed_done_at = new Date().toISOString()
      }

      console.log('Update data:', updateData)

      const { data, error } = await supabase
        .from('job_assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .select()

      if (error) {
        console.error('Error updating assignment status:', error)
        alert(`Failed to update status: ${error.message}`)
        return
      }

      console.log('Assignment updated successfully:', data)

      // Update local state
      setAssignments(prev =>
        prev.map(a =>
          a.id === assignmentId
            ? { ...a, assignment_status: newStatus, worker_confirmed_done_at: newStatus === 'done' ? new Date().toISOString() : a.worker_confirmed_done_at }
            : a
        )
      )

      alert(`Assignment status changed to ${newStatus}`)

      // Note: Job status is automatically updated by database trigger
    } catch (error) {
      console.error('Error:', error)
      alert(`Error: ${error}`)
    }
  }

  // Group assignments by status
  const assignedAssignments = assignments.filter(a => a.assignment_status === 'assigned')
  const inProgressAssignments = assignments.filter(a => a.assignment_status === 'in_progress')
  const doneAssignments = assignments.filter(a => a.assignment_status === 'done')

  const renderAssignmentCard = (assignment: AssignmentWithDetails) => {
    const job = assignment.jobs
    const customer = job.customers

    return (
      <div
        key={assignment.id}
        className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
      >
        <div className="space-y-2">
          {/* Customer Name */}
          <div className="font-semibold text-white">
            {customer.name}
          </div>

          {/* Job Title */}
          <div className="text-sm text-gray-300">
            {job.title}
          </div>

          {/* Address */}
          {customer.service_address && (
            <div className="text-xs text-gray-400">
              {customer.service_address}
              {customer.service_city && customer.service_state && (
                <>, {customer.service_city}, {customer.service_state}</>
              )}
            </div>
          )}

          {/* Scheduled Date/Time */}
          {assignment.service_start_at && (
            <div className="text-xs text-gray-400">
              {new Date(assignment.service_start_at).toLocaleDateString()}
              {' at '}
              {new Date(assignment.service_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Assignment Notes */}
          {assignment.notes && (
            <div className="text-xs text-gray-300 bg-gray-900 p-2 rounded">
              {assignment.notes}
            </div>
          )}

          {/* Status Change Buttons */}
          <div className="pt-2 flex gap-2">
            {assignment.assignment_status === 'assigned' && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  handleChangeAssignmentStatus(assignment.id, 'in_progress')
                }}
                className="flex-1 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Start →
              </button>
            )}
            {assignment.assignment_status === 'in_progress' && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  handleChangeAssignmentStatus(assignment.id, 'done')
                }}
                className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Complete →
              </button>
            )}
            {assignment.assignment_status === 'done' && (
              <div className="flex-1 px-3 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-md text-center">
                ✓ Completed
              </div>
            )}
          </div>

          {/* Debug info */}
          <div className="pt-2 text-xs text-gray-500">
            Status: {assignment.assignment_status}
          </div>
        </div>
      </div>
    )
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Debug Panel */}
      <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4">
        <h3 className="text-yellow-200 font-semibold mb-2">Debug Info</h3>
        <div className="text-sm text-yellow-100 space-y-1">
          <div>Employee ID: {employeeId || 'Not found'}</div>
          <div>Total Assignments: {assignments.length}</div>
          <div>Assigned: {assignedAssignments.length}</div>
          <div>In Progress: {inProgressAssignments.length}</div>
          <div>Done: {doneAssignments.length}</div>
        </div>
      </div>

      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-2xl font-semibold text-white mb-6">My Assignments</h2>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assigned Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Assigned</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 text-white text-sm font-semibold rounded-full">
                {assignedAssignments.length}
              </span>
            </div>
            <div className="space-y-3">
              {assignedAssignments.length > 0 ? (
                assignedAssignments.map(renderAssignmentCard)
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                  No assigned jobs
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">In Progress</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-yellow-600 text-white text-sm font-semibold rounded-full">
                {inProgressAssignments.length}
              </span>
            </div>
            <div className="space-y-3">
              {inProgressAssignments.length > 0 ? (
                inProgressAssignments.map(renderAssignmentCard)
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                  No jobs in progress
                </div>
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Done</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-green-600 text-white text-sm font-semibold rounded-full">
                {doneAssignments.length}
              </span>
            </div>
            <div className="space-y-3">
              {doneAssignments.length > 0 ? (
                doneAssignments.map(renderAssignmentCard)
              ) : (
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm">
                  No completed jobs
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
