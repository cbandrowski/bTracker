/**
 * Time Entries Table Component
 * Historical view of approved/rejected time entries
 */

'use client'

import { format } from 'date-fns'
import { useState, useEffect } from 'react'

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

interface TimeEntriesTableProps {
  timeEntries: TimeEntry[]
  onExportCSV: () => void
}

function LiveHoursDisplay({ clockIn }: { clockIn: string }) {
  const [hours, setHours] = useState('')

  useEffect(() => {
    const updateHours = () => {
      const start = new Date(clockIn)
      const now = new Date()
      const diff = (now.getTime() - start.getTime()) / (1000 * 60 * 60)
      setHours(diff.toFixed(2))
    }

    updateHours()
    const interval = setInterval(updateHours, 1000) // Update every second

    return () => clearInterval(interval)
  }, [clockIn])

  return <span className="text-blue-400">{hours}h (live)</span>
}

export default function TimeEntriesTable({ timeEntries, onExportCSV }: TimeEntriesTableProps) {
  const calculateHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn) return '0.00'
    if (!clockOut) {
      // Currently clocked in - will be shown with live component
      return null
    }
    const start = new Date(clockIn)
    const end = new Date(clockOut)
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return hours.toFixed(2)
  }

  const getDetailedStatus = (entry: TimeEntry) => {
    // Check granular approval state
    const clockInApproved = !!entry.clock_in_approved_at
    const clockOutReported = !!entry.clock_out_reported_at
    const clockOutApproved = !!entry.clock_out_approved_at

    if (entry.status === 'rejected') {
      return { label: 'Rejected', color: 'bg-red-900 bg-opacity-50 text-red-200 border border-red-700' }
    }

    if (entry.status === 'approved') {
      // Fully approved (both clock-in and clock-out)
      return { label: 'Approved', color: 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700' }
    }

    if (entry.status === 'pending_approval') {
      if (clockInApproved && clockOutReported && !clockOutApproved) {
        // Clock-in approved, but clock-out needs approval
        return { label: 'Clock-Out Needs Approval', color: 'bg-red-900 bg-opacity-50 text-red-200 border border-red-700' }
      }
      // Normal pending approval (both need approval)
      return { label: 'Pending Approval', color: 'bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700' }
    }

    if (entry.status === 'pending_clock_in') {
      if (clockInApproved) {
        // Clock-in approved, still working
        return { label: 'Approved (Working)', color: 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700' }
      }
      // Still clocked in, not approved yet
      return { label: 'Currently Clocked In', color: 'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-700' }
    }

    return { label: 'Unknown', color: 'bg-gray-700 text-gray-300 border border-gray-600' }
  }

  if (timeEntries.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400">No time entries found for the selected filters</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header with Export */}
      <div className="bg-gray-900 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Time Entries History</h3>
          <p className="text-xs text-gray-400 mt-1">{timeEntries.length} entries</p>
        </div>
        <button
          onClick={onExportCSV}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock In</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Clock Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hours</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Job</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Approved By</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {timeEntries.map((entry) => {
              const employeeName = entry.employee?.profile?.full_name || 'Unknown'
              const jobTitle = entry.schedule?.job?.title || '-'
              const approverName = entry.approver?.full_name || '-'
              // Use approved times if available, otherwise fall back to reported times
              const clockIn = entry.clock_in_approved_at || entry.clock_in_reported_at
              const clockOut = entry.clock_out_approved_at || entry.clock_out_reported_at
              const hours = calculateHours(clockIn, clockOut)

              return (
                <tr key={entry.id}>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-white">{employeeName}</div>
                    <div className="text-xs text-gray-400">{entry.employee?.profile?.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {format(new Date(entry.clock_in_reported_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-4">
                    {entry.clock_in_approved_at ? (
                      <>
                        <div className="text-sm text-gray-300">
                          {format(new Date(entry.clock_in_approved_at), 'h:mm a')}
                        </div>
                        {entry.clock_in_approved_at !== entry.clock_in_reported_at && (
                          <div className="text-xs text-orange-400">
                            (Reported: {format(new Date(entry.clock_in_reported_at), 'h:mm a')})
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-300">
                        {format(new Date(entry.clock_in_reported_at), 'h:mm a')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {entry.clock_out_approved_at ? (
                      <>
                        <div className="text-sm text-gray-300">
                          {format(new Date(entry.clock_out_approved_at), 'h:mm a')}
                        </div>
                        {entry.clock_out_reported_at &&
                          entry.clock_out_approved_at !== entry.clock_out_reported_at && (
                            <div className="text-xs text-orange-400">
                              (Reported: {format(new Date(entry.clock_out_reported_at), 'h:mm a')})
                            </div>
                          )}
                      </>
                    ) : entry.clock_out_reported_at ? (
                      <div className="text-sm text-gray-300">
                        {format(new Date(entry.clock_out_reported_at), 'h:mm a')}
                      </div>
                    ) : (
                      <span className="text-sm text-yellow-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-white">
                    {hours !== null ? (
                      `${hours}h`
                    ) : (
                      <LiveHoursDisplay clockIn={clockIn} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">{jobTitle}</td>
                  <td className="px-4 py-4">
                    {(() => {
                      const statusInfo = getDetailedStatus(entry)
                      return (
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-300">{approverName}</div>
                    {entry.approved_at && (
                      <div className="text-xs text-gray-400">
                        {format(new Date(entry.approved_at), 'MMM d, h:mm a')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {entry.edit_reason && (
                      <div className="text-xs text-gray-400 max-w-xs truncate" title={entry.edit_reason}>
                        {entry.edit_reason}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="bg-gray-900 px-4 py-3 border-t border-gray-700">
        <div className="flex justify-end gap-8 text-sm">
          <div>
            <span className="text-gray-400">Total Hours: </span>
            <span className="font-semibold text-white">
              {timeEntries
                .reduce((sum, entry) => {
                  const clockIn = entry.clock_in_approved_at || entry.clock_in_reported_at
                  const clockOut = entry.clock_out_approved_at || entry.clock_out_reported_at
                  const hours = calculateHours(clockIn, clockOut)
                  if (hours === null) return sum // Skip currently clocked-in entries
                  const parsed = parseFloat(hours)
                  return sum + (isNaN(parsed) ? 0 : parsed)
                }, 0)
                .toFixed(2)}
              h
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
