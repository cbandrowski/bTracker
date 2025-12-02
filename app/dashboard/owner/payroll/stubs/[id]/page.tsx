'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface PayStubEntry {
  id: string
  work_date: string
  regular_hours: number
  overtime_hours: number
  gross_pay: number
}

interface PayStub {
  id: string
  payroll_run_id: string
  employee_id: string
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  total_hours: number
  hourly_rate: number
  gross_pay: number
  employee?: {
    profile?: {
      full_name: string
      email: string | null
    }
  }
  entries?: PayStubEntry[]
}

export default function PayStubPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [payStub, setPayStub] = useState<PayStub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      fetchStub(id)
    })
  }, [params])

  const fetchStub = async (id: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/paystubs/${id}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load pay stub')
      }
      setPayStub(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pay stub')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !payStub) {
    return (
      <div className="space-y-4 p-6">
        <div className="text-red-400">{error || 'Pay stub not found'}</div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pay Stub</h1>
          <p className="text-sm text-gray-400">
            {payStub.employee?.profile?.full_name || 'Employee'} ·{' '}
            {format(new Date(payStub.period_start), 'MMM d, yyyy')} -{' '}
            {format(new Date(payStub.period_end), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="text-right text-sm text-gray-300">
          <div>Total Hours: {payStub.total_hours.toFixed(2)}</div>
          <div>Regular: {payStub.regular_hours.toFixed(2)}h · OT: {payStub.overtime_hours.toFixed(2)}h</div>
          <div>Rate: ${payStub.hourly_rate.toFixed(2)}</div>
          <div className="font-semibold text-white">Gross: ${payStub.gross_pay.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Regular Hours
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                OT Hours
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Gross
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {(payStub.entries || []).map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2 text-sm text-white">
                  {format(new Date(entry.work_date), 'EEE, MMM d')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-300">
                  {entry.regular_hours.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm text-gray-300">
                  {entry.overtime_hours.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-sm text-gray-300">
                  ${entry.gross_pay.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Back
        </button>
      </div>
    </div>
  )
}
