'use client'

import { StatsViewMode } from '@/types/stats'

type StatsViewToggleProps = {
  value: StatsViewMode
  onChange: (value: StatsViewMode) => void
}

const buttonBase =
  'flex-1 px-3 py-2 text-sm font-medium transition rounded-lg border'

export function StatsViewToggle({ value, onChange }: StatsViewToggleProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-slate-900/60 p-2">
      <button
        type="button"
        onClick={() => onChange('tables')}
        className={`${buttonBase} ${
          value === 'tables'
            ? 'bg-purple-500/30 border-purple-400 text-white'
            : 'border-transparent text-purple-200 hover:text-white hover:border-purple-400/40'
        }`}
      >
        Tables
      </button>
      <button
        type="button"
        onClick={() => onChange('charts')}
        className={`${buttonBase} ${
          value === 'charts'
            ? 'bg-amber-500/20 border-amber-300 text-white'
            : 'border-transparent text-purple-200 hover:text-white hover:border-amber-300/50'
        }`}
      >
        Charts
      </button>
    </div>
  )
}
