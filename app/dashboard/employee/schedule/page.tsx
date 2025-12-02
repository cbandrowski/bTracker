'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { JobAssignment, Job, AssignmentStatus } from '@/types/database'

interface AssignmentWithDetails extends JobAssignment {
  job?: Job & {
    customer?: {
      name: string
    }
  }
}

type ViewMode = 'day' | 'week' | 'month'
type StatusFilter = 'all' | 'upcoming' | 'in_progress' | 'completed'
const HOURS_IN_DAY = 24
const HOUR_BLOCK_HEIGHT = 64
const MIN_MINUTES_PER_BLOCK = 30

export default function EmployeeSchedulePage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [employeeId, setEmployeeId] = useState<string | null>(null)

  // View and filter states
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null)
  const [viewType, setViewType] = useState<'schedule' | 'jobs'>('schedule')

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.id) {
        setLoading(false)
        return
      }

      try {
        // Get employee record for current user
        const { data: employeeData } = await supabase
          .from('company_employees')
          .select('id, company_id')
          .eq('profile_id', profile.id)
          .eq('employment_status', 'active')
          .eq('approval_status', 'approved')
          .single()

        if (!employeeData) {
          setLoading(false)
          return
        }

        setEmployeeId(employeeData.id)

        // Fetch only assignments for this employee
        const { data: assignmentsData, error } = await supabase
          .from('job_assignments')
          .select(`
            *,
            job:jobs(
              *,
              customer:customers(name)
            )
          `)
          .eq('employee_id', employeeData.id)
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

  // Filter assignments based on status
  const filteredAssignments = useMemo(() => {
    return assignments.filter(assignment => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'upcoming' && assignment.assignment_status !== 'assigned') return false
        if (statusFilter === 'in_progress' && assignment.assignment_status !== 'in_progress') return false
        if (statusFilter === 'completed' && assignment.assignment_status !== 'done') return false
      }

      return true
    })
  }, [assignments, statusFilter])

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

    if (viewMode === 'day') {
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
        <div className="text-foreground">Loading your schedule...</div>
      </div>
    )
  }

  if (!employeeId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-destructive text-lg mb-2">No Employee Record Found</div>
          <div className="text-muted-foreground">Please contact your administrator.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-cyan-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400">My Quest Schedule</h2>
            <p className="text-sm text-cyan-300/70 mt-1">View your assigned quests and missions</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* View Type Toggle */}
            <div className="flex bg-slate-800/50 border border-cyan-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => setViewType('schedule')}
                className={`px-4 py-2 font-medium transition-all ${
                  viewType === 'schedule'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg'
                    : 'text-cyan-200 hover:bg-cyan-500/10'
                }`}
              >
                📅 Schedule View
              </button>
              <button
                onClick={() => setViewType('jobs')}
                className={`px-4 py-2 font-medium transition-all border-l border-cyan-500/30 ${
                  viewType === 'jobs'
                    ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg'
                    : 'text-cyan-200 hover:bg-cyan-500/10'
                }`}
              >
                📋 All Jobs
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-slate-800/50 text-cyan-200 border border-cyan-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 backdrop-blur-sm"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming Only</option>
              <option value="in_progress">In Progress Only</option>
              <option value="completed">Completed Only</option>
            </select>

            {/* Calendar View Mode Toggle (only show in schedule view) */}
            {viewType === 'schedule' && (
              <div className="flex bg-slate-800/50 border border-cyan-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-4 py-2 font-medium transition-all ${
                    viewMode === 'day'
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg'
                      : 'text-cyan-200 hover:bg-cyan-500/10'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 font-medium transition-all border-x border-cyan-500/30 ${
                    viewMode === 'week'
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg'
                      : 'text-cyan-200 hover:bg-cyan-500/10'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 font-medium transition-all ${
                    viewMode === 'month'
                      ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg'
                      : 'text-cyan-200 hover:bg-cyan-500/10'
                  }`}
                >
                  Month
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm font-semibold">Upcoming</div>
          <div className="text-2xl font-bold text-white mt-1">
            {assignments.filter(a => a.assignment_status === 'assigned').length}
          </div>
        </div>
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="text-blue-400 text-sm font-semibold">In Progress</div>
          <div className="text-2xl font-bold text-white mt-1">
            {assignments.filter(a => a.assignment_status === 'in_progress').length}
          </div>
        </div>
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div className="text-green-400 text-sm font-semibold">Completed</div>
          <div className="text-2xl font-bold text-white mt-1">
            {assignments.filter(a => a.assignment_status === 'done').length}
          </div>
        </div>
      </div>

      {/* Calendar Navigation - Only show in schedule view */}
      {viewType === 'schedule' && (
        <div className="bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPrevious}
              className="px-4 py-2 glass-surface text-foreground rounded-md hover:bg-muted"
            >
              ← Previous
            </button>

            <div className="text-center">
              <h3 className="text-xl font-semibold guild-heading">
                {currentDate.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                  ...(viewMode === 'month' ? {} : { day: 'numeric' }),
                  ...(viewMode === 'day' ? { weekday: 'long' } : {})
                })}
              </h3>
              <button
                onClick={goToToday}
                className="text-sm text-primary hover:text-primary/80 mt-1"
              >
                Today
              </button>
            </div>

            <button
              onClick={goToNext}
              className="px-4 py-2 glass-surface text-foreground rounded-md hover:bg-muted"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* All Jobs List View */}
      {viewType === 'jobs' && (
        <div className="glass-surface shadow-lg rounded-lg p-6">
          <h3 className="text-lg font-semibold guild-heading mb-4">All Assigned Jobs</h3>
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No jobs assigned
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map(assignment => (
                <div
                  key={assignment.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:ring-2 hover:ring-primary ${getStatusColor(assignment.assignment_status)}`}
                  onClick={() => setSelectedAssignment(assignment)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-foreground mb-1">
                        {assignment.job?.title || 'Untitled Job'}
                      </h4>
                      <div className="text-sm text-muted-foreground mb-2">
                        {assignment.job?.customer?.name || 'No customer'}
                      </div>
                      {assignment.service_start_at && (
                        <div className="text-sm text-gray-300 mb-1">
                          📅 {new Date(assignment.service_start_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      )}
                      {assignment.service_start_at && (
                        <div className="text-sm text-gray-300">
                          🕐 {formatTimeRange(assignment.service_start_at, assignment.service_end_at)}
                        </div>
                      )}
                      {assignment.job?.service_address && (
                        <div className="text-sm text-gray-400 mt-2">
                          📍 {assignment.job.service_address}
                          {assignment.job.service_city && `, ${assignment.job.service_city}`}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.assignment_status)}`}>
                        {getStatusBadge(assignment.assignment_status)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewType === 'schedule' && viewMode === 'day' ? (
        <div className="glass-surface shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold guild-heading">Daily Schedule</h3>
            <span className="text-sm text-muted-foreground">
              {currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
          <div className="mt-6 grid grid-cols-[70px_1fr] gap-4">
            <div className="text-right text-xs text-muted-foreground">
              {Array.from({ length: HOURS_IN_DAY }).map((_, hour) => (
                <div key={hour} className="h-16 relative">
                  <span className="absolute top-1/2 right-2 -translate-y-1/2">
                    {getHourLabel(hour)}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="relative border-l border-border rounded-lg glass-surface overflow-hidden"
              style={{ height: `${timelineHeight}px` }}
              onClick={() => setSelectedAssignment(null)}
            >
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: HOURS_IN_DAY }).map((_, hour) => (
                  <div key={hour} className="h-16 border-b border-border/50"></div>
                ))}
              </div>
              <div className="relative h-full">
                {dayAssignments.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
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
                      className={`absolute left-4 right-4 p-3 rounded-lg border shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary ${getStatusColor(assignment.assignment_status)} ${selectedAssignment?.id === assignment.id ? 'ring-2 ring-primary' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedAssignment(assignment)
                      }}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {assignment.job?.customer?.name || 'Customer'}
                      </div>
                      <div className="text-lg font-bold text-foreground truncate">
                        {assignment.job?.title || 'Untitled Job'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTimeRange(assignment.service_start_at, assignment.service_end_at)}
                      </div>
                      <div className="mt-2">
                        <span className="text-xs px-2 py-0.5 rounded glass-surface border border-border">
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
      ) : viewType === 'schedule' ? (
        <div className="glass-surface shadow-lg rounded-lg p-6">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-muted-foreground py-2">
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
                      ? 'glass-surface border-primary'
                      : 'glass-surface border-border'
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
                    isTodayDate ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {day.getDate()}
                  </div>

                  {/* Assignments for this day */}
                  <div className="space-y-1">
                    {dayAssignments.slice(0, viewMode === 'week' ? 10 : 3).map(assignment => (
                      <div
                        key={assignment.id}
                        className={`relative text-xs p-2 rounded border cursor-pointer transition-all hover:ring-2 hover:ring-primary ${getStatusColor(assignment.assignment_status)} ${selectedAssignment?.id === assignment.id ? 'ring-2 ring-primary' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleDaySelection(day)
                          setSelectedAssignment(assignment)
                        }}
                      >
                        <div className="font-semibold truncate">
                          {assignment.service_start_at && formatTime(assignment.service_start_at)}
                        </div>
                        <div className="truncate font-medium">{assignment.job?.title || 'Untitled Job'}</div>
                        {viewMode === 'week' && (
                          <>
                            <div className="truncate text-muted-foreground mt-1">
                              {assignment.job?.customer?.name || 'No customer'}
                            </div>
                            <div className="mt-1">
                              <span className="text-xs px-1.5 py-0.5 rounded glass-surface">
                                {getStatusBadge(assignment.assignment_status)}
                              </span>
                            </div>
                          </>
                        )}
                        {/* Click indicator */}
                        <div className="absolute bottom-1 right-1 text-muted-foreground hover:text-foreground">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    ))}
                    {dayAssignments.length > (viewMode === 'week' ? 10 : 3) && (
                      <div className="text-xs text-muted-foreground pl-2">
                        +{dayAssignments.length - (viewMode === 'week' ? 10 : 3)} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Upcoming Assignments List - Only show in schedule view */}
      {viewType === 'schedule' && filteredAssignments.filter(a => {
        if (!a.service_start_at) return false
        return new Date(a.service_start_at) >= new Date()
      }).length > 0 && (
        <div className="glass-surface shadow-lg rounded-lg p-6">
          <h3 className="text-lg font-semibold guild-heading mb-4">Upcoming Assignments</h3>
          <div className="space-y-3">
            {filteredAssignments
              .filter(a => {
                if (!a.service_start_at) return false
                return new Date(a.service_start_at) >= new Date()
              })
              .slice(0, 5)
              .map(assignment => (
                <div
                  key={assignment.id}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-foreground">{assignment.job?.title || 'Untitled Job'}</h4>
                        <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(assignment.assignment_status)}`}>
                          {getStatusBadge(assignment.assignment_status)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>📅 {new Date(assignment.service_start_at!).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}</div>
                        <div>🕐 {formatTimeRange(assignment.service_start_at, assignment.service_end_at)}</div>
                        {assignment.job?.customer?.name && (
                          <div>👤 {assignment.job.customer.name}</div>
                        )}
                        {assignment.job?.service_address && (
                          <div>📍 {assignment.job.service_address}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Job Details Panel */}
      {selectedAssignment && (
        <div className="bg-gray-800 shadow-lg rounded-lg border border-gray-700 overflow-hidden">
          <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <h3 className="text-xl font-semibold guild-heading">Assignment Details</h3>
            <button
              onClick={() => setSelectedAssignment(null)}
              className="text-muted-foreground hover:text-foreground"
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
                  <h4 className="text-2xl font-bold text-foreground mb-2">
                    {selectedAssignment.job?.title || 'Untitled Job'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedAssignment.assignment_status)}`}>
                      {getStatusBadge(selectedAssignment.assignment_status)}
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

            {/* Customer */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-400 mb-2">🏢 Customer</div>
              <div className="text-white font-medium">
                {selectedAssignment.job?.customer?.name || 'No customer'}
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
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-900/30 border border-blue-600"></div>
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-900/30 border border-green-600"></div>
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-900/30 border border-gray-600"></div>
            <span className="text-muted-foreground">Cancelled</span>
          </div>
        </div>
      </div>
    </div>
  )
}
