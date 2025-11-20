/**
 * New Payroll Run Page
 *
 * Form to create a new payroll run for a date range
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns'

export default function NewPayrollRunPage() {
  const router = useRouter()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDateRangePreset = (preset: 'this_week' | 'last_week' | 'this_month' | 'last_month') => {
    const today = new Date()

    switch (preset) {
      case 'this_week':
        setPeriodStart(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
        setPeriodEnd(format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
        break
      case 'last_week':
        const lastWeek = subWeeks(today, 1)
        setPeriodStart(format(startOfWeek(lastWeek, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
        setPeriodEnd(format(endOfWeek(lastWeek, { weekStartsOn: 0 }), 'yyyy-MM-dd'))
        break
      case 'this_month':
        setPeriodStart(format(startOfMonth(today), 'yyyy-MM-dd'))
        setPeriodEnd(format(endOfMonth(today), 'yyyy-MM-dd'))
        break
      case 'last_month':
        const lastMonth = subMonths(today, 1)
        setPeriodStart(format(startOfMonth(lastMonth), 'yyyy-MM-dd'))
        setPeriodEnd(format(endOfMonth(lastMonth), 'yyyy-MM-dd'))
        break
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/payroll/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payroll run')
      }

      // Redirect to the payroll run details page
      router.push(`/dashboard/owner/payroll/${data.payroll_run.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">New Payroll Run</h1>
        <p className="text-gray-400 mt-1">
          Create a new payroll run for a specific pay period
        </p>
      </div>

      {/* Form */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Date Range Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Quick Select Period
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDateRangePreset('last_week')}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
              >
                Last Week
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('this_week')}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('last_month')}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => setDateRangePreset('this_month')}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors border border-gray-600"
              >
                This Month
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6"></div>

          {/* Period Start */}
          <div>
            <label htmlFor="period_start" className="block text-sm font-medium text-gray-300 mb-2">
              Period Start Date *
            </label>
            <input
              type="date"
              id="period_start"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Period End */}
          <div>
            <label htmlFor="period_end" className="block text-sm font-medium text-gray-300 mb-2">
              Period End Date *
            </label>
            <input
              type="date"
              id="period_end"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
            <div className="flex">
              <svg
                className="h-5 w-5 text-blue-400 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">What happens when you create a payroll run?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-300">
                  <li>All approved time entries in this period will be included</li>
                  <li>Hours will be calculated and split into regular/overtime</li>
                  <li>Gross pay will be computed using employee hourly rates</li>
                  <li>Time entries will be locked to this payroll run</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !periodStart || !periodEnd}
            >
              {loading ? 'Creating...' : 'Create Payroll Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
