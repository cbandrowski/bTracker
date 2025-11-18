/**
 * Date Range Picker Component
 * Simple date range selector with week navigation
 */

'use client'

import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns'

interface DateRangePickerProps {
  startDate: Date
  endDate: Date
  onDateRangeChange: (start: Date, end: Date) => void
  mode?: 'week' | 'custom'
}

export default function DateRangePicker({
  startDate,
  endDate,
  onDateRangeChange,
  mode = 'week',
}: DateRangePickerProps) {
  const goToPreviousWeek = () => {
    const newStart = subWeeks(startDate, 1)
    const newEnd = endOfWeek(newStart, { weekStartsOn: 0 })
    onDateRangeChange(startOfWeek(newStart, { weekStartsOn: 0 }), newEnd)
  }

  const goToNextWeek = () => {
    const newStart = addWeeks(startDate, 1)
    const newEnd = endOfWeek(newStart, { weekStartsOn: 0 })
    onDateRangeChange(startOfWeek(newStart, { weekStartsOn: 0 }), newEnd)
  }

  const goToToday = () => {
    const today = new Date()
    const newStart = startOfWeek(today, { weekStartsOn: 0 })
    const newEnd = endOfWeek(today, { weekStartsOn: 0 })
    onDateRangeChange(newStart, newEnd)
  }

  if (mode === 'week') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={goToPreviousWeek}
          className="px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-md hover:bg-gray-600"
        >
          ←
        </button>
        <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md min-w-[280px] text-center">
          <span className="font-medium text-white">
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>
        <button
          onClick={goToNextWeek}
          className="px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-md hover:bg-gray-600"
        >
          →
        </button>
        <button
          onClick={goToToday}
          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Today
        </button>
      </div>
    )
  }

  // Custom date range mode
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">From</label>
        <input
          type="date"
          value={format(startDate, 'yyyy-MM-dd')}
          onChange={(e) => {
            const newStart = new Date(e.target.value)
            onDateRangeChange(newStart, endDate)
          }}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">To</label>
        <input
          type="date"
          value={format(endDate, 'yyyy-MM-dd')}
          onChange={(e) => {
            const newEnd = new Date(e.target.value)
            onDateRangeChange(startDate, newEnd)
          }}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  )
}
