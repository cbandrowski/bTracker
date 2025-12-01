'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'

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
  period_start: string
  period_end: string
  regular_hours: number
  overtime_hours: number
  total_hours: number
  hourly_rate: number
  gross_pay: number
  entries?: PayStubEntry[]
}

export default function EmployeePayStubsPage() {
  const [payStubs, setPayStubs] = useState<PayStub[]>([])
  const [selectedStubId, setSelectedStubId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPayStubs = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/employee/paystubs')
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load pay stubs')
        }
        setPayStubs(data.pay_stubs || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pay stubs')
      } finally {
        setLoading(false)
      }
    }

    fetchPayStubs()
  }, [])

  const getSelected = () => payStubs.find((stub) => stub.id === selectedStubId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        {error}
      </div>
    )
  }

  if (payStubs.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-white">Pay Stubs</h1>
        <p className="text-gray-400">No pay stubs available yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pay Stubs</h1>
        <p className="text-gray-400">View your pay periods and earnings.</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Pay Period
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Hours (Reg / OT)
              </th>
              <th className="px-4 py-2 text-left text-xs text-gray-300 uppercase tracking-wider">
                Gross
              </th>
              <th className="px-4 py-2 text-right text-xs text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {payStubs.map((stub) => (
              <tr key={stub.id} className="hover:bg-gray-700">
                <td className="px-4 py-2 text-sm text-white">
                  {format(new Date(stub.period_start), 'MMM d, yyyy')} -{' '}
                  {format(new Date(stub.period_end), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-2 text-sm text-gray-300">
                  {stub.regular_hours.toFixed(2)}h / {stub.overtime_hours.toFixed(2)}h
                </td>
                <td className="px-4 py-2 text-sm text-gray-300">
                  ${stub.gross_pay.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setSelectedStubId(stub.id === selectedStubId ? null : stub.id)}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    {selectedStubId === stub.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStubId && getSelected() && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold text-white">Pay Stub Details</h2>
              <p className="text-sm text-gray-400">
                {format(new Date(getSelected()!.period_start), 'MMM d, yyyy')} -{' '}
                {format(new Date(getSelected()!.period_end), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-sm text-gray-300 text-right">
              <div>Total Hours: {getSelected()!.total_hours.toFixed(2)}</div>
              <div>Regular: {getSelected()!.regular_hours.toFixed(2)}h · OT: {getSelected()!.overtime_hours.toFixed(2)}h</div>
              <div>Rate: ${getSelected()!.hourly_rate.toFixed(2)}</div>
              <div className="font-semibold text-white">Gross: ${getSelected()!.gross_pay.toFixed(2)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
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
                {(getSelected()!.entries || []).map((entry) => (
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
        </div>
      )}
    </div>
  )
}
