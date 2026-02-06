'use client'

import { CompanyOverviewStats } from '@/types/stats'

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value)

type StatsSummaryCardsProps = {
  totals: CompanyOverviewStats['totals']
  rangeLabel: string
}

export function StatsSummaryCards({ totals, rangeLabel }: StatsSummaryCardsProps) {
  const cards = [
    { label: 'Jobs Completed', value: formatNumber(totals.jobs_completed) },
    { label: 'Hours Worked', value: formatNumber(totals.hours_total) },
    { label: 'Invoices Created', value: formatNumber(totals.invoices_created) },
    { label: 'Payments Recorded', value: formatNumber(totals.payments_recorded) },
  ]

  return (
    <div className="space-y-3">
      <div className="text-sm text-purple-200">{rangeLabel}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-purple-500/30 bg-slate-900/40 p-4"
          >
            <div className="text-xs uppercase tracking-wide text-purple-300">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
