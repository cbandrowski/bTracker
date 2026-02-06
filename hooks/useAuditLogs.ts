'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuditLog, Profile } from '@/types/database'

export type AuditLogWithActor = AuditLog & { actor_profile?: Profile | null }

export type AuditLogFilters = {
  actorId?: string
  entityTable?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

type AuditLogResult = {
  logs: AuditLogWithActor[]
  total: number
}

export function useAuditLogs(filters: AuditLogFilters) {
  const [logs, setLogs] = useState<AuditLogWithActor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.actorId) params.set('actor_id', filters.actorId)
    if (filters.entityTable) params.set('entity_table', filters.entityTable)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.limit) params.set('limit', String(filters.limit))
    if (typeof filters.offset === 'number') params.set('offset', String(filters.offset))
    return params.toString()
  }, [filters.actorId, filters.entityTable, filters.from, filters.to, filters.limit, filters.offset])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/audit?${queryString}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load audit logs')
      }

      const payload = (await response.json()) as AuditLogResult
      setLogs(payload.logs || [])
      setTotal(payload.total || 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { logs, total, loading, error, refresh }
}
