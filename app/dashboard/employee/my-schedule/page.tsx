/**
 * Employee Planned Shifts Page
 * View upcoming shifts from employee_schedules
 */

'use client'

import { useState, useEffect } from 'react'
import { format, addWeeks, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns'

interface Schedule {
  id: string
  start_planned: string
  end_planned: string
  status: string
  notes: string | null
  job?: {
    id: string
    title: string
    customer?: {
      id: string
      name: string
    }
  }
}

export default function MySchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)

  const fetchSchedules = async (offset: number) => {
    try {
      setLoading(true)
      setError(null)

      const startDate = startOfWeek(addWeeks(new Date(), offset), { weekStartsOn: 0 })
      const endDate = endOfWeek(addWeeks(new Date(), offset), { weekStartsOn: 0 })

      const response = await fetch(
        `/api/employee/schedule?from_date=${startDate.toISOString()}&to_date=${endDate.toISOString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch schedule')
      }

      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules(weekOffset)
  }, [weekOffset])

  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 })
  const currentWeekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 0 })

  // Group schedules by day
  const schedulesByDay: Record<string, Schedule[]> = {}
  schedules.forEach((schedule) => {
    const date = format(parseISO(schedule.start_planned), 'yyyy-MM-dd')
    if (!schedulesByDay[date]) {
      schedulesByDay[date] = []
    }
    schedulesByDay[date].push(schedule)
  })

  // Generate all days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentWeekStart)
    date.setDate(date.getDate() + i)
    return date
  })

  const isToday = (date: Date) => isSameDay(date, new Date())

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
      {/* Header */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">My Scheduled Shifts</h2>

          {/* Week Navigation */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              ← Previous
            </button>
            <div className="text-white font-medium">
              {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
            </div>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Next →
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                This Week
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Week View */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {weekDays.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd')
            const daySchedules = schedulesByDay[dateKey] || []
            const today = isToday(date)

            return (
              <div
                key={dateKey}
                className={`bg-gray-700 rounded-lg border ${
                  today ? 'border-blue-500 border-2' : 'border-gray-600'
                } overflow-hidden`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center ${
                    today ? 'bg-blue-900 bg-opacity-50' : 'bg-gray-600'
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-300 uppercase">
                    {format(date, 'EEE')}
                  </div>
                  <div className="text-2xl font-bold text-white">{format(date, 'd')}</div>
                  {today && <div className="text-xs text-blue-300">Today</div>}
                </div>

                {/* Shifts for this day */}
                <div className="p-2 space-y-2 min-h-[100px]">
                  {daySchedules.length > 0 ? (
                    daySchedules.map((schedule) => (
                      <div
                        key={schedule.id}
                        className="bg-blue-900 bg-opacity-50 border border-blue-700 rounded p-2 text-xs"
                      >
                        <div className="font-semibold text-blue-200 mb-1">
                          {format(parseISO(schedule.start_planned), 'h:mm a')} -{' '}
                          {format(parseISO(schedule.end_planned), 'h:mm a')}
                        </div>
                        {schedule.job && (
                          <>
                            <div className="text-white truncate">{schedule.job.title}</div>
                            {schedule.job.customer && (
                              <div className="text-gray-400 truncate text-xs">
                                {schedule.job.customer.name}
                              </div>
                            )}
                          </>
                        )}
                        {schedule.notes && (
                          <div className="text-gray-400 mt-1 text-xs truncate">
                            {schedule.notes}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 text-xs py-4">No shifts</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 bg-gray-700 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center justify-between">
            <div className="text-gray-300">
              <span className="font-semibold text-white">{schedules.length}</span>{' '}
              {schedules.length === 1 ? 'shift' : 'shifts'} scheduled this week
            </div>
            {schedules.length > 0 && (
              <div className="text-sm text-gray-400">
                Total hours:{' '}
                <span className="font-semibold text-blue-400">
                  {schedules
                    .reduce((total, schedule) => {
                      const start = parseISO(schedule.start_planned)
                      const end = parseISO(schedule.end_planned)
                      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                      return total + hours
                    }, 0)
                    .toFixed(1)}
                  h
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List View for Mobile/Detail */}
      {schedules.length > 0 && (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700 md:hidden">
          <h3 className="text-lg font-semibold text-white mb-4">Shift Details</h3>
          <div className="space-y-3">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-white font-semibold">
                    {format(parseISO(schedule.start_planned), 'EEEE, MMM d')}
                  </div>
                  {isToday(parseISO(schedule.start_planned)) && (
                    <span className="px-2 py-1 bg-blue-900 bg-opacity-50 border border-blue-700 text-blue-200 text-xs rounded">
                      Today
                    </span>
                  )}
                </div>
                <div className="text-blue-400 font-medium mb-2">
                  {format(parseISO(schedule.start_planned), 'h:mm a')} -{' '}
                  {format(parseISO(schedule.end_planned), 'h:mm a')}
                </div>
                {schedule.job && (
                  <div className="mb-2">
                    <div className="text-white font-medium">{schedule.job.title}</div>
                    {schedule.job.customer && (
                      <div className="text-sm text-gray-400">{schedule.job.customer.name}</div>
                    )}
                  </div>
                )}
                {schedule.notes && (
                  <div className="text-sm text-gray-400 bg-gray-600 bg-opacity-50 rounded p-2">
                    {schedule.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
