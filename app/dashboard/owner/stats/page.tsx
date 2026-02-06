'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Calendar } from 'lucide-react'
import { StatsSummaryCards } from '@/components/Stats/StatsSummaryCards'
import { StatsViewToggle } from '@/components/Stats/StatsViewToggle'
import { EmployeeJobsTable } from '@/components/Stats/EmployeeJobsTable'
import { EmployeeJobsChart } from '@/components/Stats/EmployeeJobsChart'
import { EmployeeHoursTable } from '@/components/Stats/EmployeeHoursTable'
import { EmployeeHoursChart } from '@/components/Stats/EmployeeHoursChart'
import { OwnerActivityTable } from '@/components/Stats/OwnerActivityTable'
import { OwnerActivityChart } from '@/components/Stats/OwnerActivityChart'
import { useCompanyStats } from '@/hooks/useCompanyStats'
import { StatsPeriod, StatsViewMode } from '@/types/stats'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function OwnerStatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('month')
  const [viewMode, setViewMode] = useState<StatsViewMode>('tables')
  const [anchorDate, setAnchorDate] = useState(todayIso())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filters = useMemo(() => {
    if (period === 'custom') {
      return { period, startDate: startDate || undefined, endDate: endDate || undefined, limit: 25 }
    }

    return { period, anchorDate, limit: 25 }
  }, [period, anchorDate, startDate, endDate])

  const { data, loading, error } = useCompanyStats(filters)

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-7 w-7 text-amber-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Company Stats</h2>
          <p className="text-sm text-purple-200">
            Track jobs, hours, and owner activity across the company.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-purple-200 mb-1">Period</label>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as StatsPeriod)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-purple-200 mb-1">View</label>
            <StatsViewToggle value={viewMode} onChange={setViewMode} />
          </div>

          {period === 'custom' ? (
            <>
              <div className="flex-1">
                <label className="block text-xs text-purple-200 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-purple-200 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
                />
              </div>
            </>
          ) : (
            <div className="flex-1">
              <label className="block text-xs text-purple-200 mb-1">Anchor Date</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-300" />
                <input
                  type="date"
                  value={anchorDate}
                  onChange={(event) => setAnchorDate(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/40 bg-red-900/30 text-red-200">
          {error}
        </div>
      )}

      {loading || !data ? (
        <div className="text-sm text-purple-200">Loading stats...</div>
      ) : (
        <>
          <StatsSummaryCards totals={data.totals} rangeLabel={data.range.label} />

          <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Jobs Completed by Employee</h3>
            {viewMode === 'charts' ? (
              <EmployeeJobsChart rows={data.jobs_by_employee} />
            ) : (
              <EmployeeJobsTable rows={data.jobs_by_employee} />
            )}
          </div>

          <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Hours Worked by Employee</h3>
            {viewMode === 'charts' ? (
              <EmployeeHoursChart rows={data.hours_by_employee} />
            ) : (
              <EmployeeHoursTable rows={data.hours_by_employee} />
            )}
          </div>

          <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Owner Activity</h3>
            <p className="text-xs text-purple-300 mb-4">
              Owner activity uses audit logs and only reflects actions after audit logging was enabled.
            </p>
            {viewMode === 'charts' ? (
              <OwnerActivityChart rows={data.owner_activity} />
            ) : (
              <OwnerActivityTable rows={data.owner_activity} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
