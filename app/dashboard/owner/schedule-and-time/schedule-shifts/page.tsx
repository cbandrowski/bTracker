/**
 * Schedule Tab
 * Interactive weekly calendar for planning employee shifts
 */

'use client'

import { useState, useEffect } from 'react'
import { startOfWeek, endOfWeek } from 'date-fns'
import WeeklyCalendar from '../components/WeeklyCalendar'
import ShiftEditorModal from '../components/ShiftEditorModal'
import EmployeeFilter from '../components/EmployeeFilter'
import DateRangePicker from '../components/DateRangePicker'

interface Employee {
  id: string
  full_name: string
  job_title?: string
}

interface Job {
  id: string
  title: string
}

interface Shift {
  id: string
  employee_id: string
  employee_name?: string
  job_id?: string | null
  job_title?: string | null
  start_planned: string
  end_planned: string
  status: 'scheduled' | 'cancelled' | 'completed'
  notes?: string | null
}

export default function SchedulePage() {
  const [startDate, setStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }))
  const [endDate, setEndDate] = useState(endOfWeek(new Date(), { weekStartsOn: 0 }))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)

  const [shifts, setShifts] = useState<Shift[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null)
  const [newShiftDefaults, setNewShiftDefaults] = useState<{ date?: Date; hour?: number }>({})

  // Recurring shift creation states
  const [showRecurringDialog, setShowRecurringDialog] = useState(false)
  const [recurringEmployee, setRecurringEmployee] = useState<string>('')
  const [recurringStartTime, setRecurringStartTime] = useState('09:00')
  const [recurringEndTime, setRecurringEndTime] = useState('17:00')
  const [recurringDays, setRecurringDays] = useState<number[]>([]) // 0=Sun, 1=Mon, etc.
  const [recurringDuration, setRecurringDuration] = useState<'1week' | '2weeks' | '3weeks' | '4weeks' | 'month'>('1week')
  const [recurringStartDate, setRecurringStartDate] = useState(new Date().toISOString().split('T')[0])
  const [recurringSameHours, setRecurringSameHours] = useState(true)
  const [recurringDayHours, setRecurringDayHours] = useState<Record<number, { start: string; end: string }>>({})
  const [isCreatingRecurring, setIsCreatingRecurring] = useState(false)

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch('/api/employees')
        if (res.ok) {
          const data = await res.json()
          // API returns array directly, map to our format
          const employeeList = Array.isArray(data) ? data.map((emp: any) => ({
            id: emp.id,
            full_name: emp.profile?.full_name || 'Unknown',
            job_title: emp.job_title
          })) : []
          setEmployees(employeeList)
        }
      } catch (error) {
        console.error('Error fetching employees:', error)
      }
    }
    fetchEmployees()
  }, [])

  // Fetch jobs
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await fetch('/api/jobs')
        if (res.ok) {
          const data = await res.json()
          setJobs(data.jobs || [])
        }
      } catch (error) {
        console.error('Error fetching jobs:', error)
      }
    }
    fetchJobs()
  }, [])

  // Fetch shifts
  useEffect(() => {
    const fetchShifts = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'all',
        })

        if (selectedEmployeeId) {
          params.append('employee_id', selectedEmployeeId)
        }

        const res = await fetch(`/api/schedule/shifts?${params}`)
        if (res.ok) {
          const data = await res.json()
          setShifts(data.shifts || [])
        }
      } catch (error) {
        console.error('Error fetching shifts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchShifts()
  }, [startDate, endDate, selectedEmployeeId])

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleShiftClick = (shift: Shift) => {
    setSelectedShift(shift)
    setNewShiftDefaults({})
    setIsModalOpen(true)
  }

  const handleTimeSlotClick = (date: Date, hour: number) => {
    setSelectedShift(null)
    setNewShiftDefaults({ date, hour })
    setIsModalOpen(true)
  }

  const handleSaveShift = async (shiftData: any) => {
    try {
      if (selectedShift?.id) {
        // Update existing shift
        const res = await fetch(`/api/schedule/shifts/${selectedShift.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shiftData),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to update shift')
        }
      } else {
        // Create new shift
        const res = await fetch('/api/schedule/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shiftData),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to create shift')
        }
      }

      // Refresh shifts
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'all',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const res = await fetch(`/api/schedule/shifts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
      }
    } catch (error) {
      console.error('Error saving shift:', error)
      throw error
    }
  }

  const handleDeleteShift = async (shiftId: string) => {
    try {
      const res = await fetch(`/api/schedule/shifts/${shiftId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to cancel shift')
      }

      // Refresh shifts
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'all',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const refreshRes = await fetch(`/api/schedule/shifts?${params}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setShifts(data.shifts || [])
      }
    } catch (error) {
      console.error('Error deleting shift:', error)
      throw error
    }
  }

  const handleCreateRecurringShifts = async () => {
    if (!recurringEmployee || recurringDays.length === 0) {
      alert('Please select an employee and at least one day of the week')
      return
    }

    if (!recurringSameHours) {
      const invalidDay = recurringDays.find((day) => {
        const config = recurringDayHours[day]
        const start = config?.start || recurringStartTime
        const end = config?.end || recurringEndTime
        if (!start || !end) return true
        return end <= start
      })

      if (invalidDay !== undefined) {
        alert('Please provide valid start/end times for each selected day (end must be after start).')
        return
      }
    }

    setIsCreatingRecurring(true)

    try {
      const dayHoursPayload = recurringSameHours
        ? undefined
        : recurringDays.map((day) => {
            const override = recurringDayHours[day]
            return {
              day_of_week: day,
              start_time: override?.start || recurringStartTime,
              end_time: override?.end || recurringEndTime,
            }
          })

      const response = await fetch('/api/schedule/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: recurringEmployee,
          start_time: recurringStartTime,
          end_time: recurringEndTime,
          days_of_week: recurringDays,
          duration: recurringDuration,
          start_date: recurringStartDate,
          day_hours: dayHoursPayload,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create recurring shifts')
      }

      const data = await response.json()
      alert(`Successfully created ${data.count} shifts!`)

      setShowRecurringDialog(false)
      setRecurringEmployee('')
      setRecurringDays([])
      setRecurringStartTime('09:00')
      setRecurringEndTime('17:00')
      setRecurringDuration('1week')
      setRecurringSameHours(true)
      setRecurringDayHours({})

      // Reload shifts
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'all',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const res = await fetch(`/api/schedule/shifts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setShifts(data.shifts || [])
      }
    } catch (error) {
      console.error('Error creating recurring shifts:', error)
      alert(error instanceof Error ? error.message : 'Failed to create recurring shifts')
    } finally {
      setIsCreatingRecurring(false)
    }
  }

  const toggleRecurringDay = (day: number) => {
    setRecurringDays(prev => {
      const nextDays = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
      if (!recurringSameHours) {
        setRecurringDayHours((current) => {
          const copy = { ...current }
          if (nextDays.includes(day)) {
            copy[day] = copy[day] || { start: recurringStartTime, end: recurringEndTime }
          } else {
            delete copy[day]
          }
          return copy
        })
      }
      return nextDays
    })
  }

  const updateDayHours = (day: number, field: 'start' | 'end', value: string) => {
    setRecurringDayHours((prev) => ({
      ...prev,
      [day]: {
        start: field === 'start' ? value : prev[day]?.start || recurringStartTime,
        end: field === 'end' ? value : prev[day]?.end || recurringEndTime,
      }
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              mode="week"
            />
            <EmployeeFilter
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeChange={setSelectedEmployeeId}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedShift(null)
                setNewShiftDefaults({})
                setIsModalOpen(true)
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              + Add Shift
            </button>
            <button
              onClick={() => setShowRecurringDialog(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:from-purple-700 hover:to-pink-700 shadow-lg"
            >
              + Create Recurring Shifts
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-400">Loading shifts...</p>
        </div>
      )}

      {/* Calendar */}
      {!isLoading && (
        <WeeklyCalendar
          startDate={startDate}
          endDate={endDate}
          shifts={shifts}
          onShiftClick={handleShiftClick}
          onTimeSlotClick={handleTimeSlotClick}
        />
      )}

      {/* Shift Editor Modal */}
      <ShiftEditorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedShift(null)
          setNewShiftDefaults({})
        }}
        onSave={handleSaveShift}
        onDelete={handleDeleteShift}
        shift={selectedShift}
        employees={employees}
        jobs={jobs}
        defaultDate={newShiftDefaults.date}
        defaultHour={newShiftDefaults.hour}
      />

      {/* Recurring Shifts Creation Dialog */}
      {showRecurringDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-purple-500/30 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Create Recurring Shifts
              </h3>
              <p className="text-gray-400 text-sm mt-1">Set up repeating shifts for your team</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Employee *</label>
                <select
                  value={recurringEmployee}
                  onChange={(e) => setRecurringEmployee(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Start Date *</label>
                <input
                  type="date"
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Start Time *</label>
                  <input
                    type="time"
                    value={recurringStartTime}
                    onChange={(e) => setRecurringStartTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">End Time *</label>
                  <input
                    type="time"
                    value={recurringEndTime}
                    onChange={(e) => setRecurringEndTime(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Hours mode */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300 font-medium">Use same hours for all selected days</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !recurringSameHours
                    setRecurringSameHours(next)
                    if (next) {
                      setRecurringDayHours({})
                    } else {
                      setRecurringDayHours((prev) => {
                        const nextMap: Record<number, { start: string; end: string }> = {}
                        recurringDays.forEach((day) => {
                          nextMap[day] = prev[day] || { start: recurringStartTime, end: recurringEndTime }
                        })
                        return nextMap
                      })
                    }
                  }}
                  className={`px-3 py-1 rounded-md text-sm font-semibold ${
                    recurringSameHours
                      ? 'bg-purple-700 text-white'
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {recurringSameHours ? 'Same Hours' : 'Custom Per Day'}
                </button>
              </div>

              {/* Days of Week */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">Days of Week *</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { day: 0, label: 'S', full: 'Sunday' },
                    { day: 1, label: 'M', full: 'Monday' },
                    { day: 2, label: 'T', full: 'Tuesday' },
                    { day: 3, label: 'W', full: 'Wednesday' },
                    { day: 4, label: 'T', full: 'Thursday' },
                    { day: 5, label: 'F', full: 'Friday' },
                    { day: 6, label: 'S', full: 'Saturday' },
                  ].map(({ day, label, full }) => (
                    <button
                      key={day}
                      onClick={() => toggleRecurringDay(day)}
                      className={`w-12 h-12 rounded-lg font-bold transition-all ${
                        recurringDays.includes(day)
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                      title={full}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Click to toggle days</p>
              </div>

              {/* Per-day hours */}
              {!recurringSameHours && recurringDays.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-300 font-medium">Set hours for each selected day</div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecurringDayHours((prev) => {
                          const next: Record<number, { start: string; end: string }> = {}
                          recurringDays.forEach((day) => {
                            next[day] = prev[day] || { start: recurringStartTime, end: recurringEndTime }
                          })
                          return next
                        })
                      }}
                      className="text-xs px-3 py-1 rounded-md bg-gray-700 text-gray-100 hover:bg-gray-600"
                    >
                      Fill all with first time
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recurringDays.map((day) => {
                      const config = recurringDayHours[day] || { start: recurringStartTime, end: recurringEndTime }
                      return (
                        <div key={day} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                          <div className="text-sm text-gray-200 font-semibold mb-2">
                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="time"
                              value={config.start}
                              onChange={(e) => updateDayHours(day, 'start', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-purple-500"
                            />
                            <input
                              type="time"
                              value={config.end}
                              onChange={(e) => updateDayHours(day, 'end', e.target.value)}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Repeat For *</label>
                <select
                  value={recurringDuration}
                  onChange={(e) => setRecurringDuration(e.target.value as any)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="1week">Next 1 Week</option>
                  <option value="2weeks">Next 2 Weeks</option>
                  <option value="3weeks">Next 3 Weeks</option>
                  <option value="4weeks">Next 4 Weeks</option>
                  <option value="month">Rest of Month</option>
                </select>
              </div>

              {/* Summary */}
              {recurringEmployee && recurringDays.length > 0 && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm text-purple-200">
                    <strong>Preview:</strong> Creating shifts for{' '}
                    <strong>{employees.find(e => e.id === recurringEmployee)?.full_name}</strong>
                    {' '}on{' '}
                    <strong>{recurringDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}</strong>
                    {' '}{
                      recurringSameHours
                        ? <>from <strong>{recurringStartTime}</strong> to <strong>{recurringEndTime}</strong></>
                        : 'with custom hours per selected day'
                    }
                    {' '}for <strong>{recurringDuration.replace('weeks', ' weeks').replace('week', ' week').replace('month', ' the rest of the month')}</strong>
                  </p>
                  {!recurringSameHours && (
                    <div className="mt-2 text-xs text-purple-100 space-y-1">
                      {recurringDays.map((day) => {
                        const config = recurringDayHours[day] || { start: recurringStartTime, end: recurringEndTime }
                        return (
                          <div key={day} className="flex justify-between">
                            <span>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}</span>
                            <span>{config.start} - {config.end}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowRecurringDialog(false)}
                disabled={isCreatingRecurring}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRecurringShifts}
                disabled={isCreatingRecurring || !recurringEmployee || recurringDays.length === 0}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isCreatingRecurring ? 'Creating...' : 'Create Shifts'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
