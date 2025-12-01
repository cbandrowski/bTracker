/**
 * Time Entries Tab
 * Historical view of all time entries with export functionality
 */

'use client'

import { useState, useEffect } from 'react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import TimeEntriesTable from '../components/TimeEntriesTable'
import EmployeeFilter from '../components/EmployeeFilter'
import DateRangePicker from '../components/DateRangePicker'

interface Employee {
  id: string
  full_name: string
  job_title?: string
}

interface TimeEntry {
  id: string
  employee_id: string
  employee?: {
    profile?: {
      full_name: string
      email: string
    }
  }
  clock_in_reported_at: string
  clock_out_reported_at: string | null
  clock_in_approved_at: string | null
  clock_out_approved_at: string | null
  status: 'pending_clock_in' | 'pending_approval' | 'approved' | 'rejected'
  edit_reason?: string | null
  approved_at?: string | null
  approver?: {
    full_name: string
  }
  schedule?: {
    job?: {
      title: string
    }
  }
}

export default function TimeEntriesPage() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'approved' | 'rejected' | 'pending_approval' | 'pending_clock_in' | 'all'>('approved')

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(false)

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

  const fetchTimeEntries = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: statusFilter,
        exclude_payroll: 'true', // Only show entries not yet in payroll,
      })

      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }

      const res = await fetch(`/api/time-entries?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTimeEntries(data.time_entries || [])
      }
    } catch (error) {
      console.error('Error fetching time entries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch time entries
  useEffect(() => {
    fetchTimeEntries()
  }, [startDate, endDate, selectedEmployeeId, statusFilter])

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start)
    setEndDate(end)
  }

  const calculateHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return 'N/A'
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return hours.toFixed(2)
  }

  const handleExportCSV = () => {
    if (timeEntries.length === 0) {
      alert('No data to export')
      return
    }

    // Build CSV content
    const headers = [
      'Employee Name',
      'Employee Email',
      'Date',
      'Clock In (Reported)',
      'Clock Out (Reported)',
      'Clock In (Approved)',
      'Clock Out (Approved)',
      'Hours Worked',
      'Job',
      'Status',
      'Approved By',
      'Approved At',
      'Notes/Reason',
    ]

    const rows = timeEntries.map((entry) => {
      const employeeName = entry.employee?.profile?.full_name || 'Unknown'
      const employeeEmail = entry.employee?.profile?.email || ''
      const date = format(new Date(entry.clock_in_reported_at), 'yyyy-MM-dd')
      const clockInReported = format(new Date(entry.clock_in_reported_at), 'HH:mm:ss')
      const clockOutReported = entry.clock_out_reported_at
        ? format(new Date(entry.clock_out_reported_at), 'HH:mm:ss')
        : ''
      const clockInApproved = entry.clock_in_approved_at
        ? format(new Date(entry.clock_in_approved_at), 'HH:mm:ss')
        : ''
      const clockOutApproved = entry.clock_out_approved_at
        ? format(new Date(entry.clock_out_approved_at), 'HH:mm:ss')
        : ''
      const hours = calculateHours(entry.clock_in_approved_at, entry.clock_out_approved_at)
      const jobTitle = entry.schedule?.job?.title || ''
      const status = entry.status
      const approverName = entry.approver?.full_name || ''
      const approvedAt = entry.approved_at ? format(new Date(entry.approved_at), 'yyyy-MM-dd HH:mm:ss') : ''
      const notes = entry.edit_reason || ''

      return [
        employeeName,
        employeeEmail,
        date,
        clockInReported,
        clockOutReported,
        clockInApproved,
        clockOutApproved,
        hours,
        jobTitle,
        status,
        approverName,
        approvedAt,
        notes,
      ]
    })

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `time_entries_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateRangeChange={handleDateRangeChange}
              mode="custom"
            />
            <EmployeeFilter
              employees={employees}
              selectedEmployeeId={selectedEmployeeId}
              onEmployeeChange={setSelectedEmployeeId}
            />
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-300 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="approved">Approved</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="pending_clock_in">Currently Clocked In</option>
                <option value="rejected">Rejected</option>
                <option value="all">All Statuses</option>
              </select>
            </div>
          </div>
        </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-400">Loading time entries...</p>
        </div>
      )}

      {/* Time Entries Table */}
      {!isLoading && <TimeEntriesTable timeEntries={timeEntries} onExportCSV={handleExportCSV} onRefresh={fetchTimeEntries} />}
    </div>
  )
}
