/**
 * Shift Editor Modal
 * Create or edit a shift/schedule
 */

'use client'

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'

const ShiftSchema = z.object({
  employee_id: z.string().uuid('Please select an employee'),
  job_id: z.string().uuid().optional().nullable(),
  start_planned: z.string(),
  end_planned: z.string(),
  notes: z.string().optional().nullable(),
  repeat: z.enum(['none', 'next_week', 'next_2_weeks', 'rest_of_month']).optional(),
})

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
  id?: string
  employee_id: string
  job_id?: string | null
  start_planned: string
  end_planned: string
  notes?: string | null
  status?: string
}

interface ShiftEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (shift: any) => Promise<void>
  onDelete?: (shiftId: string) => Promise<void>
  shift?: Shift | null
  employees: Employee[]
  jobs: Job[]
  defaultDate?: Date
  defaultHour?: number
}

export default function ShiftEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  shift,
  employees,
  jobs,
  defaultDate,
  defaultHour,
}: ShiftEditorModalProps) {
  const [formData, setFormData] = useState({
    employee_id: '',
    job_id: '',
    start_planned: '',
    end_planned: '',
    notes: '',
    repeat: 'none' as 'none' | 'next_week' | 'next_2_weeks' | 'rest_of_month',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (shift) {
      // Editing existing shift - disable repeat option when editing
      setFormData({
        employee_id: shift.employee_id,
        job_id: shift.job_id || '',
        start_planned: format(new Date(shift.start_planned), "yyyy-MM-dd'T'HH:mm"),
        end_planned: format(new Date(shift.end_planned), "yyyy-MM-dd'T'HH:mm"),
        notes: shift.notes || '',
        repeat: 'none',
      })
    } else if (defaultDate && defaultHour !== undefined) {
      // Creating new shift with defaults
      const start = new Date(defaultDate)
      start.setHours(defaultHour, 0, 0, 0)
      const end = new Date(start)
      end.setHours(defaultHour + 2, 0, 0, 0) // Default 2-hour shift

      setFormData({
        employee_id: '',
        job_id: '',
        start_planned: format(start, "yyyy-MM-dd'T'HH:mm"),
        end_planned: format(end, "yyyy-MM-dd'T'HH:mm"),
        notes: '',
        repeat: 'none',
      })
    }
  }, [shift, defaultDate, defaultHour])

  const calculateRepeatDates = (startDate: Date, endDate: Date, repeatOption: string): Array<{ start: Date; end: Date }> => {
    const dates: Array<{ start: Date; end: Date }> = []
    const shiftDuration = endDate.getTime() - startDate.getTime()

    if (repeatOption === 'none') {
      return [{ start: startDate, end: endDate }]
    }

    // Always include the original date
    dates.push({ start: new Date(startDate), end: new Date(endDate) })

    if (repeatOption === 'next_week') {
      // Add 1 week
      const nextStart = new Date(startDate)
      nextStart.setDate(nextStart.getDate() + 7)
      const nextEnd = new Date(nextStart.getTime() + shiftDuration)
      dates.push({ start: nextStart, end: nextEnd })
    } else if (repeatOption === 'next_2_weeks') {
      // Add 2 weeks
      for (let i = 1; i <= 2; i++) {
        const nextStart = new Date(startDate)
        nextStart.setDate(nextStart.getDate() + (7 * i))
        const nextEnd = new Date(nextStart.getTime() + shiftDuration)
        dates.push({ start: nextStart, end: nextEnd })
      }
    } else if (repeatOption === 'rest_of_month') {
      // Add all remaining weeks in the month
      const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
      let weekCounter = 1
      while (true) {
        const nextStart = new Date(startDate)
        nextStart.setDate(nextStart.getDate() + (7 * weekCounter))
        if (nextStart > lastDayOfMonth) break
        const nextEnd = new Date(nextStart.getTime() + shiftDuration)
        dates.push({ start: nextStart, end: nextEnd })
        weekCounter++
      }
    }

    return dates
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setIsSubmitting(true)

    try {
      // Validate
      const validated = ShiftSchema.parse({
        ...formData,
        job_id: formData.job_id || null,
        notes: formData.notes || null,
      })

      const startDate = new Date(validated.start_planned)
      const endDate = new Date(validated.end_planned)

      // Calculate all dates based on repeat option
      const repeatDates = calculateRepeatDates(startDate, endDate, formData.repeat || 'none')

      // Create all shifts
      for (const dateSet of repeatDates) {
        const payload = {
          employee_id: validated.employee_id,
          job_id: validated.job_id,
          start_planned: dateSet.start.toISOString(),
          end_planned: dateSet.end.toISOString(),
          notes: validated.notes,
        }

        await onSave(payload)
      }

      onClose()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message
          }
        })
        setErrors(fieldErrors)
      } else {
        console.error('Error saving shift:', error)
        alert('Failed to save shift')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!shift?.id || !onDelete) return
    if (!confirm('Are you sure you want to cancel this shift?')) return

    setIsSubmitting(true)
    try {
      await onDelete(shift.id)
      onClose()
    } catch (error) {
      console.error('Error deleting shift:', error)
      alert('Failed to cancel shift')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          {shift ? 'Edit Shift' : 'Create New Shift'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} {emp.job_title ? `(${emp.job_title})` : ''}
                </option>
              ))}
            </select>
            {errors.employee_id && <p className="text-red-500 text-xs mt-1">{errors.employee_id}</p>}
          </div>

          {/* Job (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Job (optional)
            </label>
            <select
              value={formData.job_id}
              onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No job assigned</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.start_planned}
              onChange={(e) => setFormData({ ...formData, start_planned: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
            />
            {errors.start_planned && <p className="text-red-500 text-xs mt-1">{errors.start_planned}</p>}
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.end_planned}
              onChange={(e) => setFormData({ ...formData, end_planned: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
            />
            {errors.end_planned && <p className="text-red-500 text-xs mt-1">{errors.end_planned}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add any notes about this shift..."
            />
          </div>

          {/* Repeat Option (only for new shifts) */}
          {!shift && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Repeat Shift
              </label>
              <select
                value={formData.repeat}
                onChange={(e) => setFormData({ ...formData, repeat: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No repeat (one-time shift)</option>
                <option value="next_week">Repeat next week (same day)</option>
                <option value="next_2_weeks">Repeat next 2 weeks (same day)</option>
                <option value="rest_of_month">Repeat rest of month (same day)</option>
              </select>
              {formData.repeat !== 'none' && (
                <p className="text-xs text-gray-400 mt-1">
                  This will create multiple shifts on the same day of the week
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <div>
              {shift?.id && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Cancel Shift
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded-md hover:bg-gray-600 disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : (
                  formData.repeat !== 'none' && !shift ? 'Create Shifts' : 'Save'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
