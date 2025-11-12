'use client'

import { useState, useEffect, useCallback } from 'react'

interface BillingStats {
  totalRevenue: number
  totalOutstanding: number
  totalUnappliedCredit: number
  openInvoicesCount: number
  overdueInvoicesCount: number
}

interface RecentInvoice {
  id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  status: string
  due_date: string | null
  total: number
  paid_amount: number
  created_at: string
}

interface CustomerBalance {
  customer_id: string
  customer_name: string
  billedBalance: number
  unappliedCredit: number
  openInvoices: number
}

export function useBillingStats() {
  const [data, setData] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/billing/stats')

      if (!response.ok) {
        throw new Error('Failed to fetch billing stats')
      }

      const result = await response.json()
      setData(result)
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

  return { data, loading, error, refresh }
}

export function useRecentInvoices(limit: number = 10) {
  const [data, setData] = useState<RecentInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/billing/recent-invoices?limit=${limit}`)

      if (!response.ok) {
        throw new Error('Failed to fetch recent invoices')
      }

      const result = await response.json()
      setData(result.invoices || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

export function useCustomersWithBalance() {
  const [data, setData] = useState<CustomerBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/billing/customers-balance')

      if (!response.ok) {
        throw new Error('Failed to fetch customer balances')
      }

      const result = await response.json()
      setData(result.customers || [])
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

  return { data, loading, error, refresh }
}
