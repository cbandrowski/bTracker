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
  const [unassignedJobs, setUnassignedJobs] = useState<Array<Job & { customer?: { name: string } }>>([])
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // View and filter states
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithDetails | null>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

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
          console.log('Fetched assignments:', assignmentsData)
          console.log('Number of assignments:', assignmentsData?.length || 0)
          // Log each assignment's dates
          assignmentsData?.forEach((assignment: any) => {
            const effectiveDate = assignment.service_start_at || assignment.job?.planned_end_date
            console.log(`Assignment ${assignment.id}:`, {
              job_title: assignment.job?.title,
              service_start_at: assignment.service_start_at,
              service_end_at: assignment.service_end_at,
              job_planned_end_date: assignment.job?.planned_end_date,
              effective_date_used: effectiveDate,
              effective_date_parsed: effectiveDate ? new Date(effectiveDate).toDateString() : null
            })
          })
          setAssignments((assignmentsData as any) || [])
        }

        // Fetch unassigned jobs (jobs without any assignments)
        const { data: allJobs } = await supabase
          .from('jobs')
          .select(`
            *,
            customer:customers(name)
          `)
          .eq('company_id', ownerData.company_id)
          .neq('status', 'done')
          .order('planned_end_date', { ascending: true })

        if (allJobs) {
          // Get list of job IDs that have assignments
          const assignedJobIds = new Set(assignmentsData?.map((a: any) => a.job_id) || [])

          // Filter to only unassigned jobs
          const unassigned = allJobs.filter(job => !assignedJobIds.has(job.id))
          console.log('Unassigned jobs:', unassigned.length)
          setUnassignedJobs(unassigned as any)
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
    // If showing unassigned jobs, return empty array (we'll handle unassigned separately)
    if (employeeFilter === 'unassigned') {
      return []
    }

    const filtered = assignments.filter(assignment => {
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
    console.log('Filtered assignments:', filtered)
    console.log('Total assignments:', assignments.length, 'Filtered:', filtered.length)
    return filtered
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

    console.log(`Checking assignments for ${day.toDateString()} (${dayStart.toISOString()} to ${dayEnd.toISOString()})`)

    // If showing unassigned jobs
    if (employeeFilter === 'unassigned') {
      const unassignedForDay = unassignedJobs
        .filter(job => {
          if (!job.planned_end_date) {
            console.log('  ❌ Unassigned job without planned_end_date:', job.title)
            return false
          }
          // Parse date as local date to avoid timezone issues
          const [year, month, day] = job.planned_end_date.split('-').map(Number)
          const dateToCheck = new Date(year, month - 1, day)
          const inRange = dateToCheck >= dayStart && dateToCheck <= dayEnd
          console.log(`  ${inRange ? '✅' : '⏭️'} Unassigned: ${job.title}: ${dateToCheck.toDateString()} (planned: ${job.planned_end_date}) - inRange: ${inRange}`)
          return inRange
        })
        .sort((a, b) => {
          const timeA = a.planned_end_date ? new Date(a.planned_end_date).getTime() : 0
          const timeB = b.planned_end_date ? new Date(b.planned_end_date).getTime() : 0
          return timeA - timeB
        })
        // Convert to assignment-like format for display
        .map(job => ({
          id: job.id,
          job_id: job.id,
          company_id: job.company_id,
          employee_id: '',
          service_start_at: null,
          service_end_at: null,
          assignment_status: 'assigned' as AssignmentStatus,
          worker_confirmed_done_at: null,
          notes: null,
          created_at: job.created_at,
          updated_at: job.updated_at,
          job: job,
          employee: undefined
        } as AssignmentWithDetails))

      console.log(`Unassigned jobs for ${day.toDateString()}:`, unassignedForDay.length)
      return unassignedForDay
    }

    const dayAssignments = filteredAssignments
      .filter(assignment => {
        // Check both service_start_at and job's planned_end_date
        let dateToCheck: Date | null = null
        let dateSource = ''

        if (assignment.service_start_at) {
          dateToCheck = new Date(assignment.service_start_at)
          dateSource = 'service_start_at'
        } else if (assignment.job?.planned_end_date) {
          // Use job's planned_end_date as fallback - parse as local date to avoid timezone issues
          const [year, month, day] = assignment.job.planned_end_date.split('-').map(Number)
          dateToCheck = new Date(year, month - 1, day)
          dateSource = 'planned_end_date'
        }

        if (!dateToCheck) {
          console.log('  ❌ Assignment without any date:', assignment.job?.title)
          return false
        }

        const inRange = dateToCheck >= dayStart && dateToCheck <= dayEnd
        console.log(`  ${inRange ? '✅' : '⏭️'} ${assignment.job?.title}: ${dateToCheck.toDateString()} (${dateSource}) - inRange: ${inRange}`)
        return inRange
      })
      .sort((a, b) => {
        // Sort by service_start_at if available, otherwise by planned_end_date
        const timeA = a.service_start_at
          ? new Date(a.service_start_at).getTime()
          : (a.job?.planned_end_date ? new Date(a.job.planned_end_date).getTime() : 0)
        const timeB = b.service_start_at
          ? new Date(b.service_start_at).getTime()
          : (b.job?.planned_end_date ? new Date(b.job.planned_end_date).getTime() : 0)
        return timeA - timeB
      })

    console.log(`Assignments for ${day.toDateString()}:`, dayAssignments.length)
    return dayAssignments
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

  const formatTimeRange = (startString: string | null, endString: string | null, fallbackDate?: string | null) => {
    if (!startString && !fallbackDate) return 'No time set'
    if (!startString && fallbackDate) return 'All day'
    const start = formatTime(startString!)
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
        <div className="text-foreground">Loading schedule...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="bg-slate-900/50 backdrop-blur-sm shadow-xl rounded-xl p-6 border border-purple-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">Quest Schedule</h2>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            {/* Employee Filter */}
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 text-purple-200 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 backdrop-blur-sm"
            >
              <option value="all">All Warriors</option>
              <option value="unassigned">🔍 Unassigned Jobs ({unassignedJobs.length})</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 bg-slate-800/50 text-purple-200 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 backdrop-blur-sm"
            >
              <option value="all">All Statuses</option>
              <option value="upcoming">Upcoming Only</option>
              <option value="in_progress">In Progress Only</option>
              <option value="completed">Completed Only</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-800/50 border border-purple-500/30 rounded-lg overflow-hidden backdrop-blur-sm">
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 font-medium transition-all ${
                  viewMode === 'day'
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-lg'
                    : 'text-purple-200 hover:bg-purple-500/10'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 font-medium transition-all border-x border-purple-500/30 ${
                  viewMode === 'week'
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-lg'
                    : 'text-purple-200 hover:bg-purple-500/10'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-2 font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-lg'
                    : 'text-purple-200 hover:bg-purple-500/10'
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
            className="px-4 py-2 glass-surface text-foreground rounded-md hover:bg-muted"
          >
            ← Previous
          </button>

          <div className="text-center relative">
            <button
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="text-xl font-semibold guild-heading hover:text-primary transition-colors"
            >
              {currentDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                ...(viewMode === 'month' ? {} : { day: 'numeric' }),
                ...(viewMode === 'day' ? { weekday: 'long' } : {})
              })}
              <span className="ml-2 text-sm">▼</span>
            </button>
            <button
              onClick={goToToday}
              className="text-sm text-primary hover:text-primary/80 mt-1 block"
            >
              Today
            </button>

            {/* Month/Year Picker Dropdown */}
            {showMonthPicker && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 z-50 min-w-[300px]">
                <div className="space-y-4">
                  {/* Year Selector */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Year</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newDate = new Date(currentDate)
                          newDate.setFullYear(currentDate.getFullYear() - 1)
                          setCurrentDate(newDate)
                        }}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        ←
                      </button>
                      <select
                        value={currentDate.getFullYear()}
                        onChange={(e) => {
                          const newDate = new Date(currentDate)
                          newDate.setFullYear(parseInt(e.target.value))
                          setCurrentDate(newDate)
                        }}
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - 1 + i
                          return <option key={year} value={year}>{year}</option>
                        })}
                      </select>
                      <button
                        onClick={() => {
                          const newDate = new Date(currentDate)
                          newDate.setFullYear(currentDate.getFullYear() + 1)
                          setCurrentDate(newDate)
                        }}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Month Grid */}
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Month</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                        <button
                          key={month}
                          onClick={() => {
                            const newDate = new Date(currentDate)
                            newDate.setMonth(index)
                            setCurrentDate(newDate)
                            setShowMonthPicker(false)
                          }}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                            currentDate.getMonth() === index
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                          }`}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowMonthPicker(false)}
                    className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={goToNext}
            className="px-4 py-2 glass-surface text-foreground rounded-md hover:bg-muted"
          >
            Next →
          </button>
        </div>
      </div>

      {viewMode === 'day' ? (
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
                  // If no service_start_at but has planned_end_date, show as all-day at top
                  const hasServiceTime = !!assignment.service_start_at

                  let top = 0
                  let height = 0

                  if (hasServiceTime) {
                    const startMinutes = Math.max(0, Math.min(minutesSinceStartOfDay(assignment.service_start_at!), HOURS_IN_DAY * 60))
                    const endMinutesRaw = assignment.service_end_at ? minutesSinceStartOfDay(assignment.service_end_at) : startMinutes + 60
                    const endMinutes = Math.max(startMinutes + MIN_MINUTES_PER_BLOCK, Math.min(endMinutesRaw, HOURS_IN_DAY * 60))
                    const durationMinutes = Math.max(MIN_MINUTES_PER_BLOCK, endMinutes - startMinutes)
                    top = startMinutes * minuteHeight
                    height = durationMinutes * minuteHeight
                  } else {
                    // All-day event - show at top with fixed height
                    top = 0
                    height = HOUR_BLOCK_HEIGHT
                  }

                  return (
                    <div
                      key={assignment.id}
                      className={`absolute left-4 right-4 p-3 rounded-lg border shadow-sm cursor-pointer transition-all hover:ring-2 hover:ring-primary ${getStatusColor(assignment.assignment_status)} ${selectedAssignment?.id === assignment.id ? 'ring-2 ring-primary' : ''} ${!hasServiceTime ? 'opacity-80' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedAssignment(assignment)
                      }}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {assignment.employee?.profile?.full_name || '🔍 Unassigned'}
                      </div>
                      <div className="text-lg font-bold text-foreground truncate">
                        {assignment.job?.title || 'Untitled Job'}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        {assignment.job?.customer?.name || 'No customer'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeRange(assignment.service_start_at, assignment.service_end_at, assignment.job?.planned_end_date)}
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
      ) : (
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
                          {assignment.service_start_at ? formatTime(assignment.service_start_at) : 'All day'}
                        </div>
                        <div className="truncate">{assignment.job?.title || 'Untitled Job'}</div>
                        {viewMode === 'week' && (
                          <>
                            <div className="truncate text-muted-foreground">
                              {assignment.employee?.profile?.full_name || '🔍 Unassigned'}
                            </div>
                            <div className="truncate text-muted-foreground">
                              {assignment.job?.customer?.name || 'No customer'}
                            </div>
                          </>
                        )}
                        {/* Click indicator */}
                        <div className="absolute bottom-1 right-1 text-muted-foreground hover:text-foreground">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a 1 1 0 001 1h1a 1 1 0 100-2v-3a 1 1 0 00-1-1H9z" clipRule="evenodd" />
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
                      {selectedAssignment.assignment_status === 'assigned' ? 'Scheduled' :
                       selectedAssignment.assignment_status === 'in_progress' ? 'In Progress' :
                       selectedAssignment.assignment_status === 'done' ? 'Completed' : 'Cancelled'}
                    </span>
                    {selectedAssignment.job?.status && (
                      <span className="px-3 py-1 rounded-full text-sm glass-surface text-muted-foreground">
                        Job: {selectedAssignment.job.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedAssignment.job?.summary && (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <div className="text-sm font-semibold text-gray-400 mb-2">Summary</div>
                  <p className="text-foreground">{selectedAssignment.job.summary}</p>
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
            <span className="text-muted-foreground">Upcoming (Assigned)</span>
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
