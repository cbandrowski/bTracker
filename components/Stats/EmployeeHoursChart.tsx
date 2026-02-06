'use client'

import { EmployeeHoursStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value)

type EmployeeHoursChartProps = {
  rows: EmployeeHoursStat[]
}

export function EmployeeHoursChart({ rows }: EmployeeHoursChartProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No approved time entries in this period.</div>
  }

  const maxValue = Math.max(...rows.map((row) => row.hours_total), 1)

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const percent = Math.round((row.hours_total / maxValue) * 100)
        const label = row.profile?.full_name || row.profile?.email || 'Unknown'

        return (
          <div key={row.employee_id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{label}</span>
              <span className="text-purple-200">{formatNumber(row.hours_total)} hrs</span>
            </div>
            <div className="text-xs text-purple-300">
              Regular {formatNumber(row.hours_regular)} · Overtime {formatNumber(row.hours_overtime)}
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900/60">
              <div
                className="h-2 rounded-full bg-sky-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
