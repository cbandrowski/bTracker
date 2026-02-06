'use client'

import { EmployeeHoursStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value)

type EmployeeHoursTableProps = {
  rows: EmployeeHoursStat[]
}

export function EmployeeHoursTable({ rows }: EmployeeHoursTableProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No approved time entries in this period.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Employee</th>
            <th className="py-3 px-2 font-semibold">Email</th>
            <th className="py-3 px-2 font-semibold">Regular Hours</th>
            <th className="py-3 px-2 font-semibold">Overtime Hours</th>
            <th className="py-3 px-2 font-semibold">Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employee_id} className="border-b border-purple-500/10">
              <td className="py-3 px-2 font-medium text-white">
                {row.profile?.full_name || row.profile?.email || 'Unknown'}
              </td>
              <td className="py-3 px-2 text-purple-200">{row.profile?.email || '—'}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.hours_regular)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.hours_overtime)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.hours_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
