'use client'

import { OwnerActivityStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

type OwnerActivityTableProps = {
  rows: OwnerActivityStat[]
}

export function OwnerActivityTable({ rows }: OwnerActivityTableProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No owner activity found for this period.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-purple-100">
        <thead>
          <tr className="text-left border-b border-purple-500/30">
            <th className="py-3 px-2 font-semibold">Owner</th>
            <th className="py-3 px-2 font-semibold">Email</th>
            <th className="py-3 px-2 font-semibold">Jobs Created</th>
            <th className="py-3 px-2 font-semibold">Jobs Assigned</th>
            <th className="py-3 px-2 font-semibold">Invoices Created</th>
            <th className="py-3 px-2 font-semibold">Invoice Updates</th>
            <th className="py-3 px-2 font-semibold">Payments Recorded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.owner_profile_id} className="border-b border-purple-500/10">
              <td className="py-3 px-2 font-medium text-white">
                {row.profile?.full_name || row.profile?.email || 'Unknown'}
              </td>
              <td className="py-3 px-2 text-purple-200">{row.profile?.email || '—'}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.jobs_created)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.jobs_assigned)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.invoices_created)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.invoice_updates)}</td>
              <td className="py-3 px-2 text-purple-100">{formatNumber(row.payments_recorded)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
