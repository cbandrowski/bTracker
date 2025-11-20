/**
 * Approvals Tab
 * Manage pending time entry approvals
 */

'use client'

import { useState, useEffect } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import ApprovalsTable from '../components/ApprovalsTable'
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
  status: 'pending_clock_in' | 'pending_approval' | 'approved' | 'rejected'
  schedule?: {
    job?: {
      title: string
    }
  }
}

export default function ApprovalsPage() {
  const [startDate, setStartDate] = useState(startOfMonth(new Date()))
  const [endDate, setEndDate] = useState(endOfMonth(new Date()))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'pending_approval' | 'pending_clock_in' | 'all' | 'approved' | 'rejected'>('all')

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

  // Fetch time entries
  useEffect(() => {
    const fetchTimeEntries = async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: statusFilter,
          exclude_payroll: 'true', // Only show entries not yet in payroll
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

    fetchTimeEntries()
  }, [startDate, endDate, selectedEmployeeId, statusFilter])

  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start)
    setEndDate(end)
  }

  const handleApprove = async (
    entryId: string,
    adjustments?: { clock_in?: string; clock_out?: string; reason?: string }
  ) => {
    try {
      const payload: any = {}
      if (adjustments?.clock_in) {
        payload.clock_in_approved_at = adjustments.clock_in
      }
      if (adjustments?.clock_out) {
        payload.clock_out_approved_at = adjustments.clock_out
      }
      if (adjustments?.reason) {
        payload.edit_reason = adjustments.reason
      }

      const res = await fetch(`/api/time-entries/${entryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to approve time entry')
      }

      // Refresh time entries
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: statusFilter,
        exclude_payroll: 'true',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const refreshRes = await fetch(`/api/time-entries?${params}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setTimeEntries(data.time_entries || [])
      }
    } catch (error) {
      console.error('Error approving time entry:', error)
      alert(`Failed to approve: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  const handleReject = async (entryId: string, reason: string) => {
    try {
      const res = await fetch(`/api/time-entries/${entryId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edit_reason: reason }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to reject time entry')
      }

      // Refresh time entries
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: statusFilter,
        exclude_payroll: 'true',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const refreshRes = await fetch(`/api/time-entries?${params}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setTimeEntries(data.time_entries || [])
      }
    } catch (error) {
      console.error('Error rejecting time entry:', error)
      alert(`Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  const handleBulkApprove = async (entryIds: string[]) => {
    try {
      const res = await fetch('/api/time-entries/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_entry_ids: entryIds }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to bulk approve')
      }

      const result = await res.json()
      alert(`Bulk approval completed: ${result.approved_count} approved, ${result.failed_count} failed`)

      // Refresh time entries
      const params = new URLSearchParams({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: statusFilter,
        exclude_payroll: 'true',
      })
      if (selectedEmployeeId) {
        params.append('employee_id', selectedEmployeeId)
      }
      const refreshRes = await fetch(`/api/time-entries?${params}`)
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        setTimeEntries(data.time_entries || [])
      }
    } catch (error) {
      console.error('Error bulk approving:', error)
      alert(`Failed to bulk approve: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
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
                <option value="all">All Pending</option>
                <option value="pending_approval">Clocked Out - Needs Approval</option>
                <option value="pending_clock_in">Currently Clocked In</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  statusFilter === 'approved' ? 'bg-green-500' :
                  statusFilter === 'rejected' ? 'bg-red-500' :
                  'bg-yellow-500'
                }`}></div>
                <span>Showing {timeEntries.length} {
                  statusFilter === 'all' ? 'pending' :
                  statusFilter === 'pending_approval' ? 'awaiting approval' :
                  statusFilter === 'pending_clock_in' ? 'active' :
                  statusFilter
                } entries</span>
              </div>
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

      {/* Approvals Table */}
      {!isLoading && (
        <ApprovalsTable
          timeEntries={timeEntries}
          onApprove={handleApprove}
          onReject={handleReject}
          onBulkApprove={handleBulkApprove}
          readonly={statusFilter === 'approved' || statusFilter === 'rejected'}
        />
      )}
    </div>
  )
}
