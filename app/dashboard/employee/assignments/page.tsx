'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCompanyContext } from '@/contexts/CompanyContext'
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
  const { activeEmployeeId, loading: contextLoading } = useCompanyContext()
  const router = useRouter()
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
      } else if (!profile) {
        router.push('/onboarding')
      }
    }
  }, [user, loading, profile, router])

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!activeEmployeeId) {
        console.log('Employee Assignments: No employee ID yet')
        setLoadingData(false)
        return
      }

      setLoadingData(true)
      console.log('Employee Assignments: Fetching assignments for employee ID:', activeEmployeeId)

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
          .eq('employee_id', activeEmployeeId)
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

    if (activeEmployeeId) {
      fetchAssignments()
    } else if (!contextLoading) {
      setLoadingData(false)
    }
  }, [activeEmployeeId, contextLoading])

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
  const doneAssignmentsAll = assignments.filter(a => a.assignment_status === 'done')
  const now = new Date()

  const getCompletedDate = (assignment: AssignmentWithDetails) => {
    const completedAt =
      assignment.worker_confirmed_done_at ||
      assignment.updated_at ||
      assignment.service_end_at ||
      assignment.service_start_at

    if (!completedAt) {
      return null
    }

    const parsed = new Date(completedAt)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const isSameDay = (left: Date, right: Date) => {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    )
  }

  const doneAssignmentsToday = doneAssignmentsAll.filter(assignment => {
    const completedDate = getCompletedDate(assignment)
    return completedDate ? isSameDay(completedDate, now) : false
  })


  const renderAssignmentCard = (assignment: AssignmentWithDetails) => {
    const job = assignment.jobs
    const customer = job.customers

    return (
      <div
        key={assignment.id}
        className="glass-surface rounded-lg p-4 hover:border-primary transition-colors"
      >
        <div className="space-y-2">
          {/* Customer Name */}
          <div className="font-semibold text-foreground">
            {customer.name}
          </div>

          {/* Job Title */}
          <div className="text-sm text-muted-foreground">
            {job.title}
          </div>

          {/* Address */}
          {customer.service_address && (
            <div className="text-xs text-muted-foreground">
              {customer.service_address}
              {customer.service_city && customer.service_state && (
                <>, {customer.service_city}, {customer.service_state}</>
              )}
            </div>
          )}

          {/* Scheduled Date/Time */}
          {assignment.service_start_at && (
            <div className="text-xs text-muted-foreground">
              {new Date(assignment.service_start_at).toLocaleDateString()}
              {' at '}
              {new Date(assignment.service_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Assignment Notes */}
          {assignment.notes && (
            <div className="text-xs text-muted-foreground glass-surface p-2 rounded">
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
                className="flex-1 px-3 py-1.5 bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium rounded-md transition-colors"
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
                className="flex-1 px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground text-sm font-medium rounded-md transition-colors"
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
          <div className="pt-2 text-xs text-muted-foreground">
            Status: {assignment.assignment_status}
          </div>
        </div>
      </div>
    )
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-foreground">Loading...</div>
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
          <div>Employee ID: {activeEmployeeId || 'Not found'}</div>
          <div>Total Assignments: {assignments.length}</div>
          <div>Assigned: {assignedAssignments.length}</div>
          <div>In Progress: {inProgressAssignments.length}</div>
          <div>Done Today: {doneAssignmentsToday.length}</div>
          <div>Total Done: {doneAssignmentsAll.length}</div>
        </div>
      </div>

      <div className="glass-surface shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-semibold guild-heading mb-6">My Assignments</h2>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assigned Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold guild-heading">Assigned</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                {assignedAssignments.length}
              </span>
            </div>
            <div className="space-y-3">
              {assignedAssignments.length > 0 ? (
                assignedAssignments.map(renderAssignmentCard)
              ) : (
                <div className="glass-surface rounded-lg p-4 text-center text-muted-foreground text-sm">
                  No assigned jobs
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold guild-heading">In Progress</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-accent text-accent-foreground text-sm font-semibold rounded-full">
                {inProgressAssignments.length}
              </span>
            </div>
            <div className="space-y-3">
              {inProgressAssignments.length > 0 ? (
                inProgressAssignments.map(renderAssignmentCard)
              ) : (
                <div className="glass-surface rounded-lg p-4 text-center text-muted-foreground text-sm">
                  No jobs in progress
                </div>
              )}
            </div>
          </div>

          {/* Done Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold guild-heading">Done Today</h3>
              <span className="inline-flex items-center justify-center w-8 h-8 bg-secondary text-secondary-foreground text-sm font-semibold rounded-full">
                {doneAssignmentsToday.length}
              </span>
            </div>
            <div className="space-y-3">
              {doneAssignmentsToday.length > 0 ? (
                doneAssignmentsToday.map(renderAssignmentCard)
              ) : (
                <div className="glass-surface rounded-lg p-4 text-center text-muted-foreground text-sm">
                  No completed jobs today
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
