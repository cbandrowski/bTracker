'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CompanyOverviewStats, StatsPeriod } from '@/types/stats'

type StatsFilters = {
  period?: StatsPeriod
  anchorDate?: string
  startDate?: string
  endDate?: string
  limit?: number
}

export function useCompanyStats(filters: StatsFilters) {
  const [data, setData] = useState<CompanyOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.period) params.set('period', filters.period)
    if (filters.anchorDate) params.set('anchor_date', filters.anchorDate)
    if (filters.startDate) params.set('start_date', filters.startDate)
    if (filters.endDate) params.set('end_date', filters.endDate)
    if (filters.limit) params.set('limit', String(filters.limit))
    return params.toString()
  }, [filters.period, filters.anchorDate, filters.startDate, filters.endDate, filters.limit])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/stats?${queryString}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load stats')
      }

      const payload = (await response.json()) as CompanyOverviewStats
      setData(payload)
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

  return { data, loading, error, refresh }
}
