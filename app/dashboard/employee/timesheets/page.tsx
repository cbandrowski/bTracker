/**
 * Employee Timesheets/Hours Summary Page
 * View hours worked with day/week toggle
 */

'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface TimeEntry {
  id: string
  clock_in_reported_at: string
  clock_out_reported_at: string | null
  clock_in_approved_at: string | null
  clock_out_approved_at: string | null
  status: string
  computed_hours: number
  schedule?: {
    job?: {
      title: string
      customer?: {
        name: string
      }
    }
  }
}

interface TimeEntriesResponse {
  time_entries: TimeEntry[]
  total_hours: number
  from_date: string
  to_date: string
}

type ViewMode = 'day' | 'week'

export default function TimesheetsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [data, setData] = useState<TimeEntriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeEntries = async (view: ViewMode) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/employee/time-entries/me?view=${view}`)
      if (!response.ok) {
        throw new Error('Failed to fetch time entries')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeEntries(viewMode)
  }, [viewMode])

  const getDateRangeLabel = () => {
    if (!data) return ''
    const from = new Date(data.from_date)
    const to = new Date(data.to_date)

    if (viewMode === 'day') {
      return format(from, 'MMMM d, yyyy')
    } else {
      return `${format(from, 'MMM d')} - ${format(to, 'MMM d, yyyy')}`
    }
  }

  // Group entries by date
  const groupedEntries = data?.time_entries.reduce((acc, entry) => {
    const date = format(new Date(entry.clock_in_reported_at), 'yyyy-MM-dd')
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(entry)
    return acc
  }, {} as Record<string, TimeEntry[]>) || {}

  // Calculate daily totals
  const dailyTotals = Object.entries(groupedEntries).reduce((acc, [date, entries]) => {
    acc[date] = entries.reduce((sum, entry) => sum + entry.computed_hours, 0)
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">My Hours</h2>

          {/* View Toggle */}
          <div className="inline-flex rounded-lg border border-gray-600 p-1 bg-gray-700">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              This Week
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-gray-700 rounded-lg p-6 border border-gray-600 mb-6">
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">{getDateRangeLabel()}</div>
            <div className="text-5xl font-bold text-white mb-2">
              {data?.total_hours.toFixed(1) || '0.0'}
            </div>
            <div className="text-lg text-gray-300">Total Hours</div>
            {data && data.time_entries.length > 0 && (
              <div className="mt-4 text-sm text-gray-400">
                {data.time_entries.length} time {data.time_entries.length === 1 ? 'entry' : 'entries'}
              </div>
            )}
          </div>
        </div>

        {/* Time Entries by Day */}
        {Object.keys(groupedEntries).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedEntries)
              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
              .map(([date, entries]) => (
                <div key={date} className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                  {/* Date Header */}
                  <div className="bg-gray-600 px-4 py-3 flex items-center justify-between">
                    <div className="font-semibold text-white">
                      {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                    </div>
                    <div className="text-blue-400 font-semibold">
                      {dailyTotals[date].toFixed(2)}h
                    </div>
                  </div>

                  {/* Entries for this day */}
                  <div className="divide-y divide-gray-600">
                    {entries.map((entry) => (
                      <div key={entry.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-white font-medium">
                                {format(new Date(entry.clock_in_reported_at), 'h:mm a')}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-white font-medium">
                                {entry.clock_out_reported_at
                                  ? format(new Date(entry.clock_out_reported_at), 'h:mm a')
                                  : 'In Progress'}
                              </span>
                            </div>
                            {entry.schedule?.job && (
                              <div className="text-sm text-gray-400">
                                {entry.schedule.job.title}
                                {entry.schedule.job.customer && ` - ${entry.schedule.job.customer.name}`}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-blue-400 font-semibold mb-1">
                              {entry.computed_hours.toFixed(2)}h
                            </div>
                            <span
                              className={`inline-block px-2 py-1 text-xs rounded ${
                                entry.status === 'approved'
                                  ? 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700'
                                  : entry.status === 'pending_approval'
                                  ? 'bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700'
                                  : 'bg-gray-600 text-gray-300 border border-gray-500'
                              }`}
                            >
                              {entry.status === 'approved' && 'Approved'}
                              {entry.status === 'pending_approval' && 'Pending'}
                              {entry.status === 'pending_clock_in' && 'Active'}
                            </span>
                          </div>
                        </div>

                        {/* Show approved times if different */}
                        {entry.clock_in_approved_at && entry.clock_out_approved_at && (
                          entry.clock_in_approved_at !== entry.clock_in_reported_at ||
                          entry.clock_out_approved_at !== entry.clock_out_reported_at
                        ) && (
                          <div className="mt-2 text-xs text-gray-400 bg-gray-600 bg-opacity-50 rounded px-2 py-1">
                            Approved: {format(new Date(entry.clock_in_approved_at), 'h:mm a')} → {format(new Date(entry.clock_out_approved_at), 'h:mm a')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-gray-400">No time entries for this period</p>
          </div>
        )}
      </div>
    </div>
  )
}
