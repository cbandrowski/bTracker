'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalRequestStatus,
  Profile,
} from '@/types/database'

export type ApprovalDecisionWithProfile = ApprovalDecision & {
  approver_profile?: Profile | null
}

export type ApprovalRequestWithDetails = ApprovalRequest & {
  requested_by_profile?: Profile | null
  approvals?: ApprovalDecisionWithProfile[]
}

async function requestJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

export function useApprovals(status?: ApprovalRequestStatus | 'all') {
  const [requests, setRequests] = useState<ApprovalRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const query = status && status !== 'all' ? `?status=${status}` : ''
      const payload = await requestJson<{ approvals: ApprovalRequestWithDetails[] }>(
        `/api/approvals${query}`
      )
      setRequests(payload.approvals || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    refresh()
  }, [refresh])

  const approveRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/approvals/${requestId}/approve`, { method: 'POST' })
    await refresh()
  }, [refresh])

  const rejectRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/approvals/${requestId}/reject`, { method: 'POST' })
    await refresh()
  }, [refresh])

  const cancelRequest = useCallback(async (requestId: string) => {
    await requestJson(`/api/approvals/${requestId}/cancel`, { method: 'POST' })
    await refresh()
  }, [refresh])

  return {
    requests,
    loading,
    error,
    refresh,
    approveRequest,
    rejectRequest,
    cancelRequest,
  }
}
