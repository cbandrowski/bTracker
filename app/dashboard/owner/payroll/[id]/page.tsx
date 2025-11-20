/**
 * Payroll Run Details Page
 *
 * Shows detailed breakdown of a payroll run with employee lines and time entries
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

interface PayrollRun {
  id: string
  company_id: string
  period_start: string
  period_end: string
  status: 'draft' | 'finalized'
  total_gross_pay: number
  created_at: string
}

interface PayrollLine {
  id: string
  employee_id: string
  total_regular_hours: number
  total_overtime_hours: number
  hourly_rate_snapshot: number
  overtime_rate_multiplier: number
  regular_pay: number
  overtime_pay: number
  total_gross_pay: number
  employee: {
    id: string
    hourly_rate: number
    profile: {
      id: string
      full_name: string
      email: string | null
    }
  }
}

interface TimeEntry {
  id: string
  employee_id: string
  clock_in_approved_at: string
  clock_out_approved_at: string
  regular_hours: number
  overtime_hours: number
  gross_pay: number
  schedule?: {
    job?: {
      title: string
      customer?: { name: string }
    }
  }
}

export default function PayrollRunDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null)
  const [lines, setLines] = useState<PayrollLine[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [payrollRunId, setPayrollRunId] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setPayrollRunId(p.id))
  }, [params])

  useEffect(() => {
    if (payrollRunId) {
      fetchPayrollRun()
    }
  }, [payrollRunId])

  const fetchPayrollRun = async () => {
    if (!payrollRunId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/payroll/runs/${payrollRunId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch payroll run')
      }

      const data = await response.json()
      setPayrollRun(data.payroll_run)
      setLines(data.lines)
      setTimeEntries(data.time_entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleFinalize = async () => {
    if (!payrollRunId || !confirm('Are you sure you want to finalize this payroll run? This cannot be undone.')) {
      return
    }

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/payroll/runs/${payrollRunId}/finalize`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to finalize payroll run')
      }

      // Refresh data
      await fetchPayrollRun()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!payrollRunId || !confirm('Are you sure you want to delete this payroll run? This will unlink all time entries.')) {
      return
    }

    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/payroll/runs/${payrollRunId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete payroll run')
      }

      // Redirect back to payroll list
      router.push('/dashboard/owner/payroll')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setActionLoading(false)
    }
  }

  const getEmployeeTimeEntries = (employeeId: string) => {
    return timeEntries.filter((te) => te.employee_id === employeeId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!payrollRun) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Payroll run not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Payroll Run</h1>
            <span
              className={`inline-block px-3 py-1 text-sm rounded ${
                payrollRun.status === 'finalized'
                  ? 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700'
                  : 'bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700'
              }`}
            >
              {payrollRun.status === 'finalized' ? 'Finalized' : 'Draft'}
            </span>
          </div>
          <p className="text-gray-400 mt-1">
            {format(new Date(payrollRun.period_start), 'MMMM d')} -{' '}
            {format(new Date(payrollRun.period_end), 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/owner/payroll"
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back to List
          </Link>
          {payrollRun.status === 'draft' && (
            <>
              <button
                onClick={handleFinalize}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Finalize'}
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Total Employees</div>
          <div className="text-3xl font-bold text-white">{lines.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Total Hours</div>
          <div className="text-3xl font-bold text-white">
            {lines.reduce((sum, line) => sum + line.total_regular_hours + line.total_overtime_hours, 0).toFixed(1)}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Total Gross Pay</div>
          <div className="text-3xl font-bold text-white">${payrollRun.total_gross_pay.toFixed(2)}</div>
        </div>
      </div>

      {/* Employee Lines */}
      <div className="bg-gray-800 shadow-lg rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Employee Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Regular Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Overtime Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Hourly Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Regular Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Overtime Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Gross Pay
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {lines.map((line) => (
                <>
                  <tr key={line.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {line.employee.profile.full_name}
                      </div>
                      {line.employee.profile.email && (
                        <div className="text-sm text-gray-400">{line.employee.profile.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {line.total_regular_hours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {line.total_overtime_hours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      ${line.hourly_rate_snapshot.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      ${line.regular_pay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      ${line.overtime_pay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      ${line.total_gross_pay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          setSelectedEmployeeId(
                            selectedEmployeeId === line.employee_id ? null : line.employee_id
                          )
                        }
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {selectedEmployeeId === line.employee_id ? 'Hide' : 'View'} Entries
                      </button>
                    </td>
                  </tr>
                  {selectedEmployeeId === line.employee_id && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-750">
                        <div className="text-sm text-gray-300 mb-3 font-medium">Time Entries</div>
                        <div className="space-y-2">
                          {getEmployeeTimeEntries(line.employee_id).map((entry) => (
                            <div
                              key={entry.id}
                              className="bg-gray-700 rounded p-3 flex items-center justify-between"
                            >
                              <div>
                                <div className="text-sm text-white">
                                  {format(new Date(entry.clock_in_approved_at), 'MMM d, yyyy h:mm a')} →{' '}
                                  {format(new Date(entry.clock_out_approved_at), 'h:mm a')}
                                </div>
                                {entry.schedule?.job && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {entry.schedule.job.title}
                                    {entry.schedule.job.customer && ` - ${entry.schedule.job.customer.name}`}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-white">${entry.gross_pay.toFixed(2)}</div>
                                <div className="text-xs text-gray-400">
                                  {entry.regular_hours.toFixed(2)}h regular, {entry.overtime_hours.toFixed(2)}h OT
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
