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
    </div>
  )
}
