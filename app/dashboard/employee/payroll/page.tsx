'use client'

import { useEffect, useState } from 'react'
import { PayrollRunLine } from '@/types/payroll'

interface PayrollLineWithRun extends PayrollRunLine {
  payroll_run: {
    id: string
    period_start: string
    period_end: string
    status: 'draft' | 'finalized'
    created_at: string
  }
}

interface EmployeePayrollData {
  employee: {
    id: string
    job_title: string | null
    hourly_rate: number | null
  }
  payroll_history: PayrollLineWithRun[]
  current_period: {
    hours: number
    regular_hours: number
    overtime_hours: number
    gross_pay: number
    time_entries_count: number
  }
}

export default function EmployeePayrollPage() {
  const [data, setData] = useState<EmployeePayrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPayrollData = async () => {
      try {
        const response = await fetch('/api/employee/payroll')
        if (!response.ok) {
          throw new Error('Failed to fetch payroll data')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error('Error fetching payroll:', err)
        setError('Failed to load payroll information')
      } finally {
        setLoading(false)
      }
    }

    fetchPayrollData()
  }, [])

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '$0.00'
    return `$${Number(amount).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatHours = (hours: number | null) => {
    if (hours === null || hours === undefined) return '0.00'
    return Number(hours).toFixed(2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-6">
          <p className="text-red-400">{error || 'No payroll data available'}</p>
        </div>
      </div>
    )
  }

  const totalEarnedAllTime = data.payroll_history
    .filter(line => line.payroll_run && line.payroll_run.status === 'finalized')
    .reduce((sum, line) => sum + Number(line.total_gross_pay || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Payroll</h1>
        <p className="text-gray-400 mt-1">View your earnings and pay history</p>
      </div>

      {/* Current Pay Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly Rate Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Hourly Rate</p>
              <p className="text-3xl font-bold text-white mt-1">
                {formatCurrency(data.employee.hourly_rate)}<span className="text-lg text-gray-400">/hr</span>
              </p>
              {data.employee.job_title && (
                <p className="text-sm text-gray-500 mt-1">{data.employee.job_title}</p>
              )}
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-900 bg-opacity-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Total Earned Card */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Earned (All Time)</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                {formatCurrency(totalEarnedAllTime)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {data.payroll_history.filter(l => l.payroll_run && l.payroll_run.status === 'finalized').length} pay periods
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-900 bg-opacity-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Current Period (Unpaid Hours) */}
      {data.current_period.time_entries_count > 0 && (
        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Current Period (Not Yet Paid)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Total Hours</p>
              <p className="text-2xl font-bold text-white">{formatHours(data.current_period.hours)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Regular Hours</p>
              <p className="text-2xl font-bold text-white">{formatHours(data.current_period.regular_hours)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Overtime Hours</p>
              <p className="text-2xl font-bold text-white">{formatHours(data.current_period.overtime_hours)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">Estimated Pay</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(data.current_period.gross_pay)}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            {data.current_period.time_entries_count} approved time {data.current_period.time_entries_count === 1 ? 'entry' : 'entries'} pending payroll processing
          </p>
        </div>
      )}

      {/* Payroll History */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Pay History</h2>
          <p className="text-sm text-gray-400 mt-1">Your past pay periods and earnings</p>
        </div>

        {data.payroll_history.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-4 text-gray-400">No payroll history yet</p>
            <p className="text-sm text-gray-500 mt-1">Your pay periods will appear here once processed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Pay Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Regular Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Overtime Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Gross Pay
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {data.payroll_history.filter(line => line.payroll_run).map((line) => (
                  <tr key={line.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {formatDate(line.payroll_run.period_start)} - {formatDate(line.payroll_run.period_end)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(line.payroll_run.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {line.payroll_run.status === 'finalized' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 bg-opacity-50 text-green-200 border border-green-700">
                          Finalized
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                      {formatHours(line.total_regular_hours)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                      {formatHours(line.total_overtime_hours)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-white">
                      {formatCurrency(line.total_gross_pay)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-400">
                      {formatCurrency(line.net_pay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Information Footer */}
      <div className="bg-blue-900 bg-opacity-20 border border-blue-600 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">About Your Payroll</p>
            <ul className="list-disc list-inside space-y-1 text-blue-200">
              <li>Regular hours are paid at your hourly rate</li>
              <li>Overtime hours (over 40/week) are paid at 1.5x your hourly rate</li>
              <li>Net pay reflects deductions (if applicable)</li>
              <li>Draft payrolls may be adjusted before finalization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
