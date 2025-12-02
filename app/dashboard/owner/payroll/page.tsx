/**
 * Owner Payroll List Page
 *
 * Lists all payroll runs with filters and ability to create new runs
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface PayrollRun {
  id: string
  period_start: string
  period_end: string
  status: 'draft' | 'finalized'
  total_gross_pay: number
  created_at: string
  lines: { count: number }[]
}

interface PayrollSettings {
  period_start_day: number
  period_end_day: number
  auto_generate: boolean
  last_generated_end_date: string | null
}

const DAY_OPTIONS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]

export default function PayrollPage() {
  const router = useRouter()
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'finalized'>('all')
  const [settings, setSettings] = useState<PayrollSettings>({
    period_start_day: 1,
    period_end_day: 0,
    auto_generate: false,
    last_generated_end_date: null,
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [autoRunMessage, setAutoRunMessage] = useState<string | null>(null)
  const [settingsConfigured, setSettingsConfigured] = useState(false)
  const [showSettingsForm, setShowSettingsForm] = useState(false)

  useEffect(() => {
    fetchPayrollRuns()
  }, [statusFilter])

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchPayrollRuns = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/payroll/runs?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch payroll runs')
      }

      const data = await response.json()
      setPayrollRuns(data.payroll_runs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true)
      setSettingsError(null)
      const response = await fetch('/api/payroll/settings')
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load payroll settings')
      }
      setSettings(data)

      // Check if settings have been configured (not default values)
      const hasSettings = data.period_start_day !== undefined && data.period_end_day !== undefined
      setSettingsConfigured(hasSettings)
      setShowSettingsForm(!hasSettings) // Show form if not configured

      // Trigger auto-run opportunistically
      const autoResponse = await fetch('/api/payroll/auto-run', { method: 'POST' })
      const autoData = await autoResponse.json()
      if (autoData.status === 'created') {
        setAutoRunMessage(`Automatically created payroll ending ${autoData.period_end}`)
        // refresh runs to reflect new run
        fetchPayrollRuns()
      } else if (autoData.status === 'skipped') {
        setAutoRunMessage(autoData.reason || 'Auto-run skipped')
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to load settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSavingSettings(true)
      setSettingsError(null)
      const response = await fetch('/api/payroll/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings')
      }
      setSettings(data)
      setSettingsConfigured(true)
      setShowSettingsForm(false)
      setAutoRunMessage('Settings saved successfully')
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const getEmployeeCount = (run: PayrollRun) => {
    return run.lines?.[0]?.count || 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-gray-400 mt-1">Manage payroll runs and employee compensation</p>
        </div>
        <Link
          href="/dashboard/owner/payroll/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Payroll Run
        </Link>
      </div>

      {/* Settings */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Pay Period & Automation</h2>
            {settingsConfigured && !showSettingsForm ? (
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-300 border border-green-700">
                  ✓ Settings Configured
                </span>
                <span className="text-sm text-gray-400">
                  Period: {DAY_OPTIONS.find(d => d.value === settings.period_start_day)?.label} to {DAY_OPTIONS.find(d => d.value === settings.period_end_day)?.label}
                  {settings.auto_generate && ' • Auto-generate enabled'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Define pay period boundaries and auto-generate runs.</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {autoRunMessage && (
              <span className="text-xs text-gray-400">{autoRunMessage}</span>
            )}
            {settingsConfigured && !showSettingsForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsForm(true)}
              >
                Update Settings
              </Button>
            )}
          </div>
        </div>
        {settingsError && (
          <div className="text-sm text-red-300 bg-red-900/30 border border-red-800 rounded px-3 py-2">
            {settingsError}
          </div>
        )}
        {showSettingsForm && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Period Start Day</Label>
            <Select
              value={settings.period_start_day.toString()}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, period_start_day: Number(val) }))
              }
              disabled={settingsLoading}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-gray-300">Period End Day</Label>
            <Select
              value={settings.period_end_day.toString()}
              onValueChange={(val) =>
                setSettings((prev) => ({ ...prev, period_end_day: Number(val) }))
              }
              disabled={settingsLoading}
            >
              <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-3 pt-6">
            <Checkbox
              id="auto-generate"
              checked={settings.auto_generate}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, auto_generate: Boolean(checked) }))
              }
              disabled={settingsLoading}
              className="h-5 w-5"
            />
            <Label htmlFor="auto-generate" className="text-gray-200 cursor-pointer">
              Auto-create payroll when a period ends
            </Label>
          </div>
        </div>

            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>
                Last generated:{' '}
                {settings.last_generated_end_date
                  ? format(new Date(settings.last_generated_end_date), 'MMM d, yyyy')
                  : 'Not yet'}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsForm(false)}
                  disabled={settingsLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveSettings}
                  disabled={settingsLoading || savingSettings}
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-400">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Payroll Runs List */}
      {!loading && (
        <div className="bg-gray-800 shadow-lg rounded-lg border border-gray-700 overflow-hidden">
          {payrollRuns.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-gray-400">No payroll runs found</p>
              <p className="text-sm text-gray-500 mt-2">
                Create your first payroll run to get started
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Pay Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Total Gross Pay
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {payrollRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => router.push(`/dashboard/owner/payroll/${run.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">
                        {format(new Date(run.period_start), 'MMM d')} -{' '}
                        {format(new Date(run.period_end), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded ${
                          run.status === 'finalized'
                            ? 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700'
                            : 'bg-yellow-900 bg-opacity-50 text-yellow-200 border border-yellow-700'
                        }`}
                      >
                        {run.status === 'finalized' ? 'Finalized' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {getEmployeeCount(run)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      ${run.total_gross_pay.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {format(new Date(run.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/dashboard/owner/payroll/${run.id}`}
                        className="text-blue-400 hover:text-blue-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
