'use client'

import { OwnerActivityStat } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

type OwnerActivityChartProps = {
  rows: OwnerActivityStat[]
}

const getTotal = (row: OwnerActivityStat) =>
  row.jobs_created +
  row.jobs_assigned +
  row.invoices_created +
  row.invoice_updates +
  row.payments_recorded

export function OwnerActivityChart({ rows }: OwnerActivityChartProps) {
  if (rows.length === 0) {
    return <div className="text-sm text-purple-200">No owner activity found for this period.</div>
  }

  const totals = rows.map(getTotal)
  const maxValue = Math.max(...totals, 1)

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const total = getTotal(row)
        const percent = Math.round((total / maxValue) * 100)
        const label = row.profile?.full_name || row.profile?.email || 'Unknown'

        return (
          <div key={row.owner_profile_id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{label}</span>
              <span className="text-purple-200">{formatNumber(total)} actions</span>
            </div>
            <div className="text-xs text-purple-300">
              Jobs {formatNumber(row.jobs_created + row.jobs_assigned)} · Invoices {formatNumber(row.invoices_created)} · Updates {formatNumber(row.invoice_updates)} · Payments {formatNumber(row.payments_recorded)}
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900/60">
              <div
                className="h-2 rounded-full bg-violet-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
