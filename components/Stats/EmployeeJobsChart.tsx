'use client'

import { EmployeeJobStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

type EmployeeJobsChartProps = {
  rows: EmployeeJobStat[]
}

export function EmployeeJobsChart({ rows }: EmployeeJobsChartProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No completed jobs in this period.</div>
  }

  const maxValue = Math.max(...rows.map((row) => row.jobs_completed), 1)

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const percent = Math.round((row.jobs_completed / maxValue) * 100)
        const label = row.profile?.full_name || row.profile?.email || 'Unknown'

        return (
          <div key={row.employee_id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{label}</span>
              <span className="text-purple-200">{formatNumber(row.jobs_completed)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900/60">
              <div
                className="h-2 rounded-full bg-amber-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
