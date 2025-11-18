'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { JobAssignment, Job, CompanyEmployee, AssignmentStatus } from '@/types/database'

interface AssignmentWithDetails extends JobAssignment {
  job?: Job & {
    customer?: {
      name: string
    }
  }
  employee?: CompanyEmployee & {
    profile?: {
      full_name: string
      email: string
    }
  }
}

type ViewMode = 'day' | 'week' | 'month'
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed'
const HOURS_IN_DAY = 24
const HOUR_BLOCK_HEIGHT = 64
const MIN_MINUTES_PER_BLOCK = 30

export default function SchedulePage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // View and filter states
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) {
        setLoading(false)
        return
      }

      try {
        // Get company
        const { data: ownerData } = await supabase
          .from('company_owners')
          .select('company_id')
          .eq('profile_id', profile.id)
          .single()

        if (!ownerData) {
          setLoading(false)
          return
        }

        setCompanyId(ownerData.company_id)

        // Fetch employees for filter dropdown
        const { data: employeesData } = await supabase
          .from('company_employees')
          .select(`
            id,
            profile:profiles(full_name)
          `)
          .eq('company_id', ownerData.company_id)
          .eq('employment_status', 'active')
          .eq('approval_status', 'approved')
          .order('profile(full_name)')

        if (employeesData) {
          const formattedEmployees = employeesData.map((emp: any) => ({
            id: emp.id,
            full_name: emp.profile?.full_name || 'Unknown'
          }))
          setEmployees(formattedEmployees)
        }

        // Fetch assignments with job and employee details
        const { data: assignmentsData, error } = await supabase
          .from('job_assignments')
          .select(`
            *,
            job:jobs(
              *,
              customer:customers(name)
            ),
            employee:company_employees(
              *,
              profile:profiles(full_name, email)
            )
          `)
          .eq('company_id', ownerData.company_id)
          .order('service_start_at', { ascending: true })

        if (error) {
          console.error('Error fetching assignments:', error)
        } else {
          setAssignments((assignmentsData as any) || [])
        }
      } catch (error) {
        console.error('Error:', error)
      }

      setLoading(false)
    }

    if (profile) {
      fetchData()
    }
  }, [profile])

  // Filter assignments based on status and employee
  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'upcoming' && assignment.assignment_status !== 'assigned') return false
        if (statusFilter === 'in_progress' && assignment.assignment_status !== 'in_progress') return false
        if (statusFilter === 'completed' && assignment.assignment_status !== 'done') return false
      }

      // Employee filter
      if (employeeFilter !== 'all' && assignment.employee_id !== employeeFilter) return false

      return true
    })
  }, [assignments, statusFilter, employeeFilter])

  // Get calendar data based on view mode
  const calendarData = useMemo(() => {
    const startOfWeek = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = d.getDate() - day
      return new Date(d.setDate(diff))
    }

    const startOfMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), 1)
    }

    const endOfMonth = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    }

    if (viewMode === 'day') {
      // Day view - just return single day
      return [new Date(currentDate)]
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate)
      const days = []
      for (let i = 0; i < 7; i++) {
        const day = new Date(start)
        day.setDate(start.getDate() + i)
        days.push(day)
      }
      return days
    } else {
      // Month view
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      const firstDayOfWeek = start.getDay()

      // Start from the Sunday before the first of the month
      const calendarStart = new Date(start)
      calendarStart.setDate(start.getDate() - firstDayOfWeek)

      const days = []
      let currentDay = new Date(calendarStart)

      // Generate 6 weeks (42 days) for consistent calendar
      for (let i = 0; i < 42; i++) {
        days.push(new Date(currentDay))
        currentDay.setDate(currentDay.getDate() + 1)
      }

      return days
    }
  }, [viewMode, currentDate])

  // Get assignments for a specific day
  const getAssignmentsForDay = (day: Date) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    return filteredAssignments
      .filter(assignment => {
        if (!assignment.service_start_at) return false
        const startDate = new Date(assignment.service_start_at)
        return startDate >= dayStart && startDate <= dayEnd
      })
      .sort((a, b) => {
        const timeA = new Date(a.service_start_at!).getTime()
        const timeB = new Date(b.service_start_at!).getTime()
        return timeA - timeB
      })
  }

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() - 1)
    } else if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() - 7)
    } else {
      newDate.setMonth(currentDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() + 1)
    } else if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + 7)
    } else {
      newDate.setMonth(currentDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const formatTimeRange = (startString: string | null, endString: string | null) => {
    if (!startString) return 'No time set'
    const start = formatTime(startString)
    if (!endString) return start
    const end = formatTime(endString)
    return `${start} - ${end}`
  }

  const getStatusColor = (status: AssignmentStatus) => {
    switch (status) {
      case 'assigned':
        return 'bg-yellow-900/30 text-yellow-300 border-yellow-600'
      case 'in_progress':
        return 'bg-blue-900/30 text-blue-300 border-blue-600'
      case 'done':
        return 'bg-green-900/30 text-green-300 border-green-600'
      case 'cancelled':
        return 'bg-gray-900/30 text-gray-400 border-gray-600'
      default:
        return 'bg-gray-900/30 text-gray-300 border-gray-600'
    }
  }

  const getStatusBadge = (status: AssignmentStatus) => {
    switch (status) {
      case 'assigned':
        return 'Scheduled'
      case 'in_progress':
        return 'In Progress'
      case 'done':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      default:
        return status
    }
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }

  const getHourLabel = (hour: number) => {
    const date = new Date()
    date.setHours(hour, 0, 0, 0)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }

  const minutesSinceStartOfDay = (dateString: string) => {
    const date = new Date(dateString)
    return date.getHours() * 60 + date.getMinutes()
  }

  const minuteHeight = HOUR_BLOCK_HEIGHT / 60
  const timelineHeight = HOURS_IN_DAY * HOUR_BLOCK_HEIGHT
  const dayAssignments = getAssignmentsForDay(currentDate)

  const handleDaySelection = (day: Date) => {
    const selectedDay = new Date(day)
    setCurrentDate(selectedDay)
    if (viewMode !== 'day') {
      setViewMode('day')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white">Loading schedule...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h2 className="text-2xl font-semibold text-white">Schedule</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Employee Filter */}
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming Only</option>
              <option value="in_progress">In Progress Only</option>
              <option value="completed">Completed Only</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-gray-700 rounded-md border border-gray-600">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-l-md ${
                  viewMode === 'day'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 ${
                  viewMode === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 rounded-r-md ${
                  viewMode === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevious}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            ← Previous
          </button>

          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                ...(viewMode === 'month' ? {} : { day: 'numeric' }),
                ...(viewMode === 'day' ? { weekday: 'long' } : {})
              })}
            </h3>
            <button
              onClick={goToToday}
              className="text-sm text-blue-400 hover:text-blue-300 mt-1"
            >
              Today
            </button>
          </div>

          <button
            onClick={goToNext}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            Next →
          </button>
        </div>
      </div>

      {viewMode === 'day' ? (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Daily Schedule</h3>
            <span className="text-sm text-gray-400">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-[70px_1fr] gap-4">
            <div className="text-right text-xs text-gray-500">
              {Array.from({ length: HOURS_IN_DAY }).map((_, hour) => (
                <div key={hour} className="h-16 relative">
                  <span className="absolute top-1/2 right-2 -translate-y-1/2">
                    {getHourLabel(hour)}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="relative border-l border-gray-700 rounded-lg bg-gray-900/30 overflow-hidden"
              style={{ height: `${timelineHeight}px` }}
              onClick={() => setSelectedAssignment(null)}
            >
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: HOURS_IN_DAY }).map((_, hour) => (
                  <div key={hour} className="h-16 border-b border-gray-800/70"></div>
                ))}
              </div>
              <div className="relative h-full">
                {dayAssignments.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                    No assignments scheduled
                  </div>
                )}
                {dayAssignments.map(assignment => {
                  if (!assignment.service_start_at) return null
                  const startMinutes = Math.max(0, Math.min(minutesSinceStartOfDay(assignment.service_start_at), HOURS_IN_DAY * 60))
                  const endMinutesRaw = assignment.service_end_at ? minutesSinceStartOfDay(assignment.service_end_at) : startMinutes + 60
                  const endMinutes = Math.max(startMinutes + MIN_MINUTES_PER_BLOCK, Math.min(endMinutesRaw, HOURS_IN_DAY * 60))
                  const durationMinutes = Math.max(MIN_MINUTES_PER_BLOCK, endMinutes - startMinutes)
                  const top = startMinutes * minuteHeight
                  const height = durationMinutes * minuteHeight

                  return (
                    <div
                      key={assignment.id}
                      className={`absolute left-4 right-4 p-3 rounded-lg border shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 ${getStatusColor(assignment.assignment_status)} ${selectedAssignment?.id === assignment.id ? 'ring-2 ring-blue-500' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedAssignment(assignment)
                      }}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-300">
                        {assignment.employee?.profile?.full_name || 'Unassigned'}
                      </div>
                      <div className="text-lg font-bold text-white truncate">
                        {assignment.job?.title || 'Untitled Job'}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        {assignment.job?.customer?.name || 'No customer'}
                      </div>
                      <div className="text-xs text-gray-300">
                        {formatTimeRange(assignment.service_start_at, assignment.service_end_at)}
                      </div>
                      <div className="mt-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-900/60 border border-gray-700">
                          {getStatusBadge(assignment.assignment_status)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarData.map((day, index) => {
              const dayAssignments = getAssignmentsForDay(day)
              const isTodayDate = isToday(day)
              const isCurrentMonthDate = isCurrentMonth(day)

              return (
                <div
                  key={index}
                  className={`min-h-32 p-2 rounded-lg border cursor-pointer ${
                    isTodayDate
                      ? 'bg-blue-900/20 border-blue-500'
                      : 'bg-gray-900 border-gray-700'
                  } ${
                    viewMode === 'month' && !isCurrentMonthDate
                      ? 'opacity-40'
                      : ''
                  }`}
                  onClick={() => {
                    handleDaySelection(day)
                    setSelectedAssignment(null)
                  }}
                >
                  <div className={`text-sm font-semibold mb-2 ${
                    isTodayDate ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {day.getDate()}
                  </div>

                  {/* Assignments for this day */}
                  <div className="space-y-1">
                    {dayAssignments.slice(0, viewMode === 'week' ? 10 : 3).map(assignment => (
                      <div
                        key={assignment.id}
                        className={`relative text-xs p-2 rounded border cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 ${getStatusColor(assignment.assignment_status)} ${selectedAssignment?.id === assignment.id ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDaySelection(day)
                          setSelectedAssignment(assignment)
                        }}
                      >
                        <div className="font-semibold truncate">
                          {assignment.service_start_at && formatTime(assignment.service_start_at)}
                        </div>
                        <div className="truncate">{assignment.job?.title || 'Untitled Job'}</div>
                        {viewMode === 'week' && (
                          <>
                            <div className="truncate text-gray-400">
                              {assignment.employee?.profile?.full_name || 'Unknown'}
                            </div>
                            <div className="truncate text-gray-400">
                              {assignment.job?.customer?.name || 'No customer'}
                            </div>
                          </>
                        )}
                        {/* Click indicator */}
                        <div className="absolute bottom-1 right-1 text-gray-500 hover:text-gray-300">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a 1 1 0 001 1h1a 1 1 0 100-2v-3a 1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    ))}
                    {dayAssignments.length > (viewMode === 'week' ? 10 : 3) && (
                      <div className="text-xs text-gray-500 pl-2">
                        +{dayAssignments.length - (viewMode === 'week' ? 10 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Job Details Panel */}
      {selectedAssignment && (
        <div className="bg-gray-800 shadow-lg rounded-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <h3 className="text-xl font-semibold text-white">Assignment Details</h3>
            <button
              onClick={() => setSelectedAssignment(null)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Job Information */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-2xl font-bold text-white mb-2">
                    {selectedAssignment.job?.title || 'Untitled Job'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedAssignment.assignment_status)}`}>
                      {selectedAssignment.assignment_status === 'assigned' ? 'Scheduled' :
                       selectedAssignment.assignment_status === 'in_progress' ? 'In Progress' :
                       selectedAssignment.assignment_status === 'done' ? 'Completed' : 'Cancelled'}
                    </span>
                    {selectedAssignment.job?.status && (
                      <span className="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300">
                        Job: {selectedAssignment.job.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedAssignment.job?.summary && (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="text-sm font-semibold text-gray-400 mb-2">Summary</div>
                  <p className="text-white">{selectedAssignment.job.summary}</p>
                </div>
              )}
            </div>

            {/* Time and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">📅 Service Date</div>
                <div className="text-white">
                  {selectedAssignment.service_start_at ?
                    new Date(selectedAssignment.service_start_at).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Not scheduled'}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">🕐 Time</div>
                <div className="text-white">
                  {selectedAssignment.service_start_at && formatTime(selectedAssignment.service_start_at)}
                  {selectedAssignment.service_end_at && ` - ${formatTime(selectedAssignment.service_end_at)}`}
                  {!selectedAssignment.service_start_at && 'Not scheduled'}
                </div>
              </div>
            </div>

            {/* Employee and Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">👤 Assigned Employee</div>
                <div className="text-white font-medium">
                  {selectedAssignment.employee?.profile?.full_name || 'Unknown'}
                </div>
                {selectedAssignment.employee?.profile?.email && (
                  <div className="text-sm text-gray-400 mt-1">
                    {selectedAssignment.employee.profile.email}
                  </div>
                )}
                {selectedAssignment.employee?.job_title && (
                  <div className="text-sm text-gray-400 mt-1">
                    {selectedAssignment.employee.job_title}
                  </div>
                )}
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">🏢 Customer</div>
                <div className="text-white font-medium">
                  {selectedAssignment.job?.customer?.name || 'No customer'}
                </div>
              </div>
            </div>

            {/* Service Address */}
            {selectedAssignment.job?.service_address && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">📍 Service Location</div>
                <div className="text-white">
                  {selectedAssignment.job.service_address}
                  {selectedAssignment.job.service_address_line_2 && (
                    <>, {selectedAssignment.job.service_address_line_2}</>
                  )}
                  <br />
                  {selectedAssignment.job.service_city && `${selectedAssignment.job.service_city}, `}
                  {selectedAssignment.job.service_state && `${selectedAssignment.job.service_state} `}
                  {selectedAssignment.job.service_zipcode}
                </div>
              </div>
            )}

            {/* Tasks */}
            {selectedAssignment.job?.tasks_to_complete && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">✓ Tasks to Complete</div>
                <div className="text-white whitespace-pre-wrap">{selectedAssignment.job.tasks_to_complete}</div>
              </div>
            )}

            {/* Notes */}
            {selectedAssignment.notes && (
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-sm font-semibold text-gray-400 mb-2">📝 Assignment Notes</div>
                <div className="text-white whitespace-pre-wrap">{selectedAssignment.notes}</div>
              </div>
            )}

            {/* Confirmation */}
            {selectedAssignment.worker_confirmed_done_at && (
              <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
                <div className="text-sm font-semibold text-green-400 mb-2">✅ Confirmed Complete</div>
                <div className="text-gray-300">
                  {new Date(selectedAssignment.worker_confirmed_done_at).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-700">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-900/30 border border-yellow-600"></div>
            <span className="text-gray-300">Upcoming (Assigned)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-900/30 border border-blue-600"></div>
            <span className="text-gray-300">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-900/30 border border-green-600"></div>
            <span className="text-gray-300">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-900/30 border border-gray-600"></div>
            <span className="text-gray-300">Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  )
}
