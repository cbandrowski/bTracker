'use client'

import { useMemo, useState } from 'react'
import { FileDown, ShieldCheck } from 'lucide-react'
import { useOwners } from '@/hooks/useOwners'
import { AuditTable } from '@/components/Audit/AuditTable'
import { useAuditLogs } from '@/hooks/useAuditLogs'

export default function AuditPage() {
  const { owners } = useOwners()
  const [actorId, setActorId] = useState('')
  const [entityTable, setEntityTable] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const toIso = (value: string) => {
    if (!value) return undefined
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return undefined
    return parsed.toISOString()
  }

  const filters = useMemo(() => ({
    actorId: actorId || undefined,
    entityTable: entityTable || undefined,
    from: toIso(from),
    to: toIso(to),
    limit: 50,
    offset: 0,
  }), [actorId, entityTable, from, to])

  const { logs, total, loading, error } = useAuditLogs(filters)

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.actorId) params.set('actor_id', filters.actorId)
    if (filters.entityTable) params.set('entity_table', filters.entityTable)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    return `/api/audit/export?${params.toString()}`
  }, [filters])

  const resetFilters = () => {
    setActorId('')
    setEntityTable('')
    setFrom('')
    setTo('')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-amber-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Owner Audit Log</h2>
          <p className="text-sm text-purple-200">
            Track and review all owner actions across the company.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-purple-200 mb-1">Owner</label>
            <select
              value={actorId}
              onChange={(event) => setActorId(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            >
              <option value="">All owners</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.profile_id}>
                  {owner.profile?.full_name || owner.profile?.email || 'Unknown'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-purple-200 mb-1">Entity</label>
            <input
              value={entityTable}
              onChange={(event) => setEntityTable(event.target.value)}
              placeholder="jobs, invoices, payments"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-purple-200 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-purple-200 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900/70 border border-purple-500/30 text-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg bg-slate-700/80 text-white hover:bg-slate-700"
            >
              Reset
            </button>
            <a
              href={exportUrl}
              className="px-4 py-2 rounded-lg bg-amber-500/80 text-white font-semibold hover:bg-amber-500 inline-flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/40 bg-red-900/30 text-red-200">
          {error}
        </div>
      )}

      <div className="bg-slate-900/40 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          <div className="text-xs text-purple-300">
            {loading ? 'Loading...' : `${logs.length} of ${total} entries`}
          </div>
        </div>
        {loading ? (
          <div className="text-sm text-purple-200">Loading audit logs...</div>
        ) : (
          <AuditTable logs={logs} />
        )}
      </div>
    </div>
  )
}
