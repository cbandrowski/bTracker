/**
 * Employee Clock In/Out Page
 * Allows employees to track their work hours
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
  schedule?: {
    job?: {
      title: string
      customer?: {
        name: string
      }
    }
  }
}

interface TodayEntry extends TimeEntry {
  computed_hours: number
}

export default function ClockInPage() {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null)
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch current status and today's entries
  const fetchStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get today's entries
      const response = await fetch('/api/employee/time-entries/me?view=day')
      if (!response.ok) {
        throw new Error('Failed to fetch time entries')
      }

      const data = await response.json()
      setTodayEntries(data.time_entries || [])

      // Find currently open entry (clocked in, not clocked out, not rejected)
      const openEntry = (data.time_entries || []).find(
        (entry: TimeEntry) => !entry.clock_out_reported_at && entry.status !== 'rejected'
      )
      setCurrentEntry(openEntry || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  // Clock in
  const handleClockIn = async () => {
    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch('/api/employee/time-entries/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock in')
      }

      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Clock out
  const handleClockOut = async () => {
    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch('/api/employee/time-entries/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock out')
      }

      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  // Calculate time since clock in
  const getTimeSinceClockIn = () => {
    if (!currentEntry?.clock_in_reported_at) return ''
    const clockInTime = new Date(currentEntry.clock_in_reported_at)
    const diff = currentTime.getTime() - clockInTime.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    return `${hours}h ${minutes}m ${seconds}s`
  }

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
      {/* Current Status Card */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Time Clock</h2>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Current Time Display */}
        <div className="text-center mb-8">
          <div className="text-5xl font-bold text-white mb-2">
            {format(currentTime, 'h:mm:ss a')}
          </div>
          <div className="text-gray-400">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        {/* Status and Action */}
        <div className="text-center">
          {currentEntry ? (
            <>
              {/* Clocked In Status */}
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 bg-green-900 bg-opacity-50 border border-green-700 rounded-lg mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-green-200 font-semibold">Clocked In</span>
                </div>
                <div className="text-gray-400 text-sm">
                  Since {format(new Date(currentEntry.clock_in_reported_at), 'h:mm a')}
                </div>
                <div className="text-2xl font-bold text-white mt-2">
                  {getTimeSinceClockIn()}
                </div>
                {currentEntry.schedule?.job && (
                  <div className="mt-4 text-gray-300">
                    <div className="font-semibold">{currentEntry.schedule.job.title}</div>
                    {currentEntry.schedule.job.customer && (
                      <div className="text-sm text-gray-400">
                        {currentEntry.schedule.job.customer.name}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clock Out Button */}
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full max-w-md px-8 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                {actionLoading ? 'Clocking Out...' : 'Clock Out'}
              </button>
            </>
          ) : (
            <>
              {/* Not Clocked In Status */}
              <div className="mb-6">
                <div className="inline-flex items-center px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
                  <span className="text-gray-300 font-semibold">Not Clocked In</span>
                </div>
              </div>

              {/* Clock In Button */}
              <button
                onClick={handleClockIn}
                disabled={actionLoading}
                className="w-full max-w-md px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-colors text-lg"
              >
                {actionLoading ? 'Clocking In...' : 'Clock In'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Today's Entries */}
      {todayEntries.length > 0 && (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Today's Time Entries</h3>
          <div className="space-y-3">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
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
                  {entry.computed_hours > 0 && (
                    <span className="text-blue-400 font-semibold">
                      {entry.computed_hours.toFixed(2)}h
                    </span>
                  )}
                </div>
                {entry.schedule?.job && (
                  <div className="text-sm text-gray-400">
                    {entry.schedule.job.title}
                    {entry.schedule.job.customer && ` - ${entry.schedule.job.customer.name}`}
                  </div>
                )}
                <div className="mt-2">
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
                    {entry.status === 'pending_approval' && 'Pending Approval'}
                    {entry.status === 'pending_clock_in' && 'In Progress'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
