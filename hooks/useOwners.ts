'use client'

import { useCallback, useEffect, useState } from 'react'
import { CompanyOwner, Profile } from '@/types/database'

export type OwnerWithProfile = CompanyOwner & { profile?: Profile | null }

export function useOwners() {
  const [owners, setOwners] = useState<OwnerWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/owners')

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to load owners')
      }

      const payload = await response.json()
      setOwners(payload.owners || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { owners, loading, error, refresh }
}
