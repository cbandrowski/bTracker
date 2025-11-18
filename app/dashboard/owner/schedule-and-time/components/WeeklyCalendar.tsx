/**
 * Weekly Calendar Component
 * Google Calendar-style week view for employee schedules
 */

'use client'

import { format, eachDayOfInterval, isSameDay } from 'date-fns'
import { useState } from 'react'

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

interface WeeklyCalendarProps {
  startDate: Date
  endDate: Date
  shifts: Shift[]
  onShiftClick: (shift: Shift) => void
  onTimeSlotClick: (date: Date, hour: number) => void
}

export default function WeeklyCalendar({
  startDate,
  endDate,
  shifts,
  onShiftClick,
  onTimeSlotClick,
}: WeeklyCalendarProps) {
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  // Default visible hours: 6 AM to 9 PM (6-21)
  const visibleHours = Array.from({ length: 16 }, (_, i) => i + 6) // 6-21 (6am to 9pm)

  // Check if any shifts fall outside visible hours
  const hasShiftsOutsideVisibleHours = shifts.some(shift => {
    const shiftStart = new Date(shift.start_planned)
    const shiftEnd = new Date(shift.end_planned)
    const startHour = shiftStart.getHours()
    const endHour = shiftEnd.getHours()
    return startHour < 6 || endHour > 21
  })

  // Use extended hours if needed (midnight to midnight)
  const hours = hasShiftsOutsideVisibleHours
    ? Array.from({ length: 24 }, (_, i) => i)
    : visibleHours

  // Group shifts by day and hour
  const getShiftsForDayAndHour = (day: Date, hour: number) => {
    return shifts.filter((shift) => {
      const shiftStart = new Date(shift.start_planned)
      const shiftEnd = new Date(shift.end_planned)
      const slotStart = new Date(day)
      slotStart.setHours(hour, 0, 0, 0)
      const slotEnd = new Date(day)
      slotEnd.setHours(hour + 1, 0, 0, 0)

      // Check if shift overlaps with this hour slot
      return shiftStart < slotEnd && shiftEnd > slotStart && isSameDay(shiftStart, day)
    })
  }

  // Calculate shift position and height
  const getShiftStyle = (shift: Shift) => {
    const start = new Date(shift.start_planned)
    const end = new Date(shift.end_planned)

    const startHour = start.getHours()
    const startMinute = start.getMinutes()
    const endHour = end.getHours()
    const endMinute = end.getMinutes()

    // Calculate offset based on the first visible hour
    const firstVisibleHour = hours[0] || 0
    const adjustedStartHour = startHour - firstVisibleHour

    const topOffset = (adjustedStartHour + startMinute / 60) * 60 // 60px per hour
    const duration = (endHour + endMinute / 60) - (startHour + startMinute / 60)
    const height = duration * 60

    return {
      top: `${topOffset}px`,
      height: `${height}px`,
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500 hover:bg-blue-600'
      case 'completed':
        return 'bg-green-500 hover:bg-green-600'
      case 'cancelled':
        return 'bg-gray-400 hover:bg-gray-500'
      default:
        return 'bg-blue-500 hover:bg-blue-600'
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Extended Hours Notice */}
      {hasShiftsOutsideVisibleHours && (
        <div className="bg-yellow-900 bg-opacity-50 border-b border-yellow-700 px-4 py-2">
          <p className="text-xs text-yellow-200">
            ⚠️ Showing extended hours (12 AM - 11 PM) because shifts exist outside normal hours (6 AM - 9 PM)
          </p>
        </div>
      )}

      {/* Calendar Header */}
      <div className="grid grid-cols-8 border-b border-gray-700">
        <div className="p-4 border-r border-gray-700 bg-gray-900">
          <span className="text-sm font-medium text-gray-400">Time</span>
        </div>
        {days.map((day) => (
          <div key={day.toISOString()} className="p-4 text-center border-r border-gray-700 last:border-r-0 bg-gray-900">
            <div className="text-sm font-medium text-gray-300">{format(day, 'EEE')}</div>
            <div className="text-2xl font-bold text-white">{format(day, 'd')}</div>
            <div className="text-xs text-gray-400">{format(day, 'MMM')}</div>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="relative overflow-y-auto" style={{ maxHeight: '600px' }}>
        <div className="grid grid-cols-8">
          {/* Time column */}
          <div className="border-r border-gray-700 bg-gray-900">
            {hours.map((hour) => (
              <div key={hour} className="h-[60px] border-b border-gray-700 px-2 py-1 text-right">
                <span className="text-xs text-gray-400">
                  {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div key={day.toISOString()} className="border-r border-gray-700 last:border-r-0 relative bg-gray-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-gray-700 hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => onTimeSlotClick(day, hour)}
                />
              ))}

              {/* Render shifts for this day */}
              <div className="absolute top-0 left-0 right-0 pointer-events-none">
                {shifts
                  .filter((shift) => {
                    const shiftStart = new Date(shift.start_planned)
                    return isSameDay(shiftStart, day)
                  })
                  .map((shift) => {
                    const style = getShiftStyle(shift)
                    const statusColor = getStatusColor(shift.status)

                    return (
                      <div
                        key={shift.id}
                        className={`absolute left-1 right-1 ${statusColor} text-white rounded px-2 py-1 text-xs overflow-hidden pointer-events-auto cursor-pointer shadow-sm`}
                        style={style}
                        onClick={(e) => {
                          e.stopPropagation()
                          onShiftClick(shift)
                        }}
                      >
                        <div className="font-semibold truncate">{shift.employee_name}</div>
                        {shift.job_title && (
                          <div className="truncate opacity-90">{shift.job_title}</div>
                        )}
                        <div className="text-xs opacity-75">
                          {format(new Date(shift.start_planned), 'h:mm a')} - {format(new Date(shift.end_planned), 'h:mm a')}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
