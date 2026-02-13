'use client'

import { EmployeeJobStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

type EmployeeJobsTableProps = {
  rows: EmployeeJobStat[]
}

export function EmployeeJobsTable({ rows }: EmployeeJobsTableProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No completed jobs in this period.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Employee</th>
            <th className="py-3 px-2 font-semibold">Email</th>
            <th className="py-3 px-2 font-semibold">Jobs Completed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.employee_id} className="border-b border-purple-500/10">
              <td className="py-3 px-2 font-medium text-white">
                {row.profile?.full_name || row.profile?.email || 'Unknown'}
              </td>
              <td className="py-3 px-2 text-purple-200">{row.profile?.email || '—'}</td>
              <td className="py-3 px-2 text-purple-100">
                {formatNumber(row.jobs_completed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
