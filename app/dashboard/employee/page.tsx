'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { JobAssignment, JobWithCustomer, AssignmentStatus } from '@/types/database'
import { Scroll, Swords, Award, MapPin, Clock, Building2, Phone } from 'lucide-react'

interface JobAssignmentWithJob extends JobAssignment {
  job?: JobWithCustomer
}

export default function EmployeeDashboardPage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<JobAssignmentWithJob[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const handleChangeStatus = async (assignmentId: string, newStatus: AssignmentStatus) => {
    try {
      const updateData: any = {
        assignment_status: newStatus,
      }

      if (newStatus === 'done') {
        updateData.worker_confirmed_done_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('job_assignments')
        .update(updateData)
        .eq('id', assignmentId)

      if (error) {
        console.error('Error updating status:', error)
        alert(`Error: ${error.message}`)
        return
      }

      // Update local state
      setAssignments(prev =>
        prev.map(a =>
          a.id === assignmentId
            ? { ...a, assignment_status: newStatus, worker_confirmed_done_at: newStatus === 'done' ? new Date().toISOString() : a.worker_confirmed_done_at }
            : a
        )
      )
    } catch (error) {
      console.error('Error:', error)
      alert(`Error: ${error}`)
    }
  }

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
        <div className="text-xl text-cyan-200">Loading your quests...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-cyan-500/20">
        <div className="flex items-center gap-3 mb-6">
          <Scroll className="h-6 w-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">
            My Quest Log ({assignments.length} total)
          </h2>
        </div>

        {/* Three Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Assigned Section */}
          <div className="bg-slate-900/50 rounded-xl border-2 border-blue-500/50 overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3">
              <h3 className="text-white font-bold flex items-center">
                <Scroll className="w-5 h-5 mr-2" />
                Available Quests ({assignedJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {assignedJobs.length === 0 ? (
                <p className="text-cyan-300/70 text-sm text-center py-8">No quests available</p>
              ) : (
                assignedJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-slate-800/50 p-4 rounded-lg hover:border-blue-400 border border-blue-500/30 transition-all backdrop-blur-sm">
                    <h4 className="text-cyan-100 font-bold text-sm mb-2">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-amber-400 text-xs mb-2 font-semibold flex items-center">
                        <Building2 className="w-3 h-3 mr-1" />
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-cyan-300/80 text-xs mb-2">
                      <strong>Client:</strong> {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.job?.customer?.phone && (
                      <p className="text-cyan-300/80 text-xs mb-2 flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        <a href={`tel:${assignment.job.customer.phone}`} className="hover:text-cyan-200 transition-colors">
                          {assignment.job.customer.phone}
                        </a>
                      </p>
                    )}
                    {assignment.job?.service_address && (
                      <div className="text-cyan-300/80 text-xs mb-2">
                        <div className="flex items-start mb-1">
                          <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span>
                            {assignment.job.service_address}
                            {assignment.job.service_city && (
                              <>, {assignment.job.service_city}, {assignment.job.service_state}</>
                            )}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${assignment.job.service_address}, ${assignment.job.service_city}, ${assignment.job.service_state} ${assignment.job.service_zipcode || ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 hover:underline inline-block ml-4"
                        >
                          Get Directions →
                        </a>
                      </div>
                    )}
                    {assignment.service_start_at && (
                      <p className="text-cyan-300/80 text-xs flex items-center mb-2">
                        <Clock className="w-3 h-3 mr-1" />
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
                      <div className="mt-3 pt-3 border-t border-cyan-500/20">
                        <p className="text-cyan-300 text-xs font-bold mb-1">Quest Objectives:</p>
                        <p className="text-cyan-300/70 text-xs whitespace-pre-line">{assignment.job.tasks_to_complete}</p>
                      </div>
                    )}
                    {/* Start Button */}
                    <button
                      onClick={() => handleChangeStatus(assignment.id, 'in_progress')}
                      className="mt-4 w-full px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-amber-500/30"
                    >
                      Accept Quest →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* In Progress Section */}
          <div className="bg-slate-900/50 rounded-xl border-2 border-orange-500/50 overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3">
              <h3 className="text-white font-bold flex items-center">
                <Swords className="w-5 h-5 mr-2" />
                Active Quests ({inProgressJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {inProgressJobs.length === 0 ? (
                <p className="text-cyan-300/70 text-sm text-center py-8">No active quests</p>
              ) : (
                inProgressJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-slate-800/50 p-4 rounded-lg hover:border-orange-400 border border-orange-500/30 transition-all backdrop-blur-sm">
                    <h4 className="text-cyan-100 font-bold text-sm mb-2">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-amber-400 text-xs mb-2 font-semibold flex items-center">
                        <Building2 className="w-3 h-3 mr-1" />
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-cyan-300/80 text-xs mb-2">
                      <strong>Client:</strong> {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.job?.customer?.phone && (
                      <p className="text-cyan-300/80 text-xs mb-2 flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        <a href={`tel:${assignment.job.customer.phone}`} className="hover:text-cyan-200 transition-colors">
                          {assignment.job.customer.phone}
                        </a>
                      </p>
                    )}
                    {assignment.job?.service_address && (
                      <div className="text-cyan-300/80 text-xs mb-2">
                        <div className="flex items-start mb-1">
                          <MapPin className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span>
                            {assignment.job.service_address}
                            {assignment.job.service_city && (
                              <>, {assignment.job.service_city}, {assignment.job.service_state}</>
                            )}
                          </span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${assignment.job.service_address}, ${assignment.job.service_city}, ${assignment.job.service_state} ${assignment.job.service_zipcode || ''}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 hover:underline inline-block ml-4"
                        >
                          Get Directions →
                        </a>
                      </div>
                    )}
                    {assignment.service_start_at && (
                      <p className="text-cyan-300/80 text-xs flex items-center mb-2">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(assignment.service_start_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {assignment.job?.tasks_to_complete && (
                      <div className="mt-3 pt-3 border-t border-cyan-500/20">
                        <p className="text-cyan-300 text-xs font-bold mb-1">Quest Objectives:</p>
                        <p className="text-cyan-300/70 text-xs whitespace-pre-line">{assignment.job.tasks_to_complete}</p>
                      </div>
                    )}
                    {/* Complete Button */}
                    <button
                      onClick={() => handleChangeStatus(assignment.id, 'done')}
                      className="mt-4 w-full px-3 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/30"
                    >
                      Complete Quest →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Done Section */}
          <div className="bg-slate-900/50 rounded-xl border-2 border-emerald-500/50 overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-3">
              <h3 className="text-white font-bold flex items-center">
                <Award className="w-5 h-5 mr-2" />
                Completed ({doneJobs.length})
              </h3>
            </div>
            <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
              {doneJobs.length === 0 ? (
                <p className="text-cyan-300/70 text-sm text-center py-8">No completed quests yet</p>
              ) : (
                doneJobs.map((assignment) => (
                  <div key={assignment.id} className="bg-slate-800/50 p-4 rounded-lg hover:border-emerald-400 border border-emerald-500/30 transition-all backdrop-blur-sm">
                    <h4 className="text-cyan-100 font-bold text-sm mb-2">{assignment.job?.title}</h4>
                    {(assignment.job as any)?.company?.name && (
                      <p className="text-amber-400 text-xs mb-2 font-semibold flex items-center">
                        <Building2 className="w-3 h-3 mr-1" />
                        {(assignment.job as any).company.name}
                      </p>
                    )}
                    <p className="text-cyan-300/80 text-xs mb-2">
                      <strong>Client:</strong> {assignment.job?.customer?.name || 'Unknown'}
                    </p>
                    {assignment.job?.customer?.phone && (
                      <p className="text-cyan-300/80 text-xs mb-2 flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        <a href={`tel:${assignment.job.customer.phone}`} className="hover:text-cyan-200 transition-colors">
                          {assignment.job.customer.phone}
                        </a>
                      </p>
                    )}
                    {assignment.worker_confirmed_done_at && (
                      <p className="text-emerald-300 text-xs flex items-center">
                        <Award className="w-3 h-3 mr-1" />
                        Completed: {new Date(assignment.worker_confirmed_done_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
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
