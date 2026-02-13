'use client'

import { AuditLogWithActor } from '@/hooks/useAuditLogs'

const actionStyles: Record<string, string> = {
  insert: 'bg-emerald-500/20 text-emerald-200',
  update: 'bg-amber-500/20 text-amber-200',
  delete: 'bg-red-500/20 text-red-200',
}

const formatValue = (value: unknown) => {
  if (value === null || typeof value === 'undefined') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

type AuditTableProps = {
  logs: AuditLogWithActor[]
}

export function AuditTable({ logs }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="text-sm text-purple-200">No audit logs found for this filter.</div>
    )
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => {
        const actorName = log.actor_profile?.full_name || log.actor_profile?.email || 'Unknown'
        const actionClass = actionStyles[log.action] || 'bg-slate-500/20 text-slate-200'
        const diffEntries = Array.isArray(log.diff) ? log.diff : []

        return (
          <div
            key={log.id}
            className="border border-purple-500/30 rounded-xl bg-slate-900/40 p-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-2 py-1 rounded-full text-xs ${actionClass}`}>
                    {log.action}
                  </span>
                  <span className="text-sm font-semibold text-white">{log.entity_table}</span>
                  <span className="text-xs text-purple-300">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-purple-200 mt-1">
                  {actorName} · {log.actor_profile?.email || 'No email'}
                </div>
              </div>
              <div className="text-xs text-purple-300">
                {log.entity_id ? `ID: ${log.entity_id}` : 'No entity id'}
              </div>
            </div>

            {diffEntries.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-amber-200">View changes</summary>
                <div className="mt-3 space-y-2">
                  {diffEntries.map((entry) => (
                    <div
                      key={entry.field}
                      className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs bg-slate-900/60 border border-purple-500/20 rounded-lg p-3"
                    >
                      <div className="text-purple-200 font-semibold">{entry.field}</div>
                      <div className="text-purple-100">Before: {formatValue(entry.before)}</div>
                      <div className="text-purple-100">After: {formatValue(entry.after)}</div>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <div className="mt-3 text-xs text-purple-300">No diff available.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
