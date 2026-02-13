'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CompanyOwner,
  OwnerChangeApproval,
  OwnerChangeRequest,
  Profile,
} from '@/types/database'

export type OwnerWithProfile = CompanyOwner & { profile?: Profile | null }
export type OwnerChangeApprovalWithProfile = OwnerChangeApproval & {
  approver_profile?: Profile | null
}
export type OwnerChangeRequestWithDetails = OwnerChangeRequest & {
  target_profile?: Profile | null
  created_by_profile?: Profile | null
  approvals?: OwnerChangeApprovalWithProfile[]
}

type OwnerChangeRequestPayload = {
  action: 'add_owner' | 'remove_owner'
  target_profile_id?: string
  target_email?: string
}

async function requestJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed')
  }

  return payload as T
}

export function useOwnerManagement() {
  const [owners, setOwners] = useState<OwnerWithProfile[]>([])
  const [requests, setRequests] = useState<OwnerChangeRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const [ownersPayload, requestsPayload] = await Promise.all([
        requestJson<{ owners: OwnerWithProfile[] }>('/api/owners'),
        requestJson<{ requests: OwnerChangeRequestWithDetails[] }>('/api/owners/requests'),
      ])

      setOwners(ownersPayload.owners || [])
      setRequests(requestsPayload.requests || [])
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

  const createRequest = useCallback(async (payload: OwnerChangeRequestPayload) => {
    await requestJson('/api/owners/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    await refresh()
  }, [refresh])

  const approveRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/owners/requests/${requestId}/approve`, {
      method: 'POST',
    })
    await refresh()
  }, [refresh])

  const rejectRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/owners/requests/${requestId}/reject`, {
      method: 'POST',
    })
    await refresh()
  }, [refresh])

  const cancelRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/owners/requests/${requestId}/cancel`, {
      method: 'POST',
    })
    await refresh()
  }, [refresh])

  const finalizeRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/owners/requests/${requestId}/finalize`, {
      method: 'POST',
    })
    await refresh()
  }, [refresh])

  return {
    owners,
    requests,
    loading,
    error,
    refresh,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    finalizeRequest,
  }
}
