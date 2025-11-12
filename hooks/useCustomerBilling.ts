'use client'

import { useState, useEffect, useCallback } from 'react'

interface BillingHeader {
  billedBalance: number
  unappliedCredit: number
  openInvoices: number
}

interface UnpaidJob {
  id: string
  title: string
  description: string | null
  completed_at: string
  estimated_amount: number | null
  customer_id: string
}

interface UnappliedPayment {
  paymentId: string
  date: string
  amount: number
  depositType: string | null
  jobId: string | null
  jobTitle: string | null
  memo: string | null
  unappliedAmount: number
}

interface DepositsResponse {
  items: UnappliedPayment[]
  unappliedCredit: number
}

export function useCustomerBillingHeader(customerId: string) {
  const [data, setData] = useState<BillingHeader | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${customerId}/billing-header`)

      if (!response.ok) {
        throw new Error('Failed to fetch billing header')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

export function useUnpaidJobs(customerId: string) {
  const [data, setData] = useState<UnpaidJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/customers/${customerId}/unpaid-done-jobs`)

      if (!response.ok) {
        throw new Error('Failed to fetch unpaid jobs')
      }

      const result = await response.json()
      setData(result.jobs || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

export function useUnappliedPayments(customerId: string, depositType?: string) {
  const [data, setData] = useState<DepositsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (depositType) {
        params.set('depositType', depositType)
      }

      const url = `/api/customers/${customerId}/unapplied-payments${params.toString() ? `?${params}` : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch unapplied payments')
      }

      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [customerId, depositType])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}

interface CreateInvoiceData {
  customerId: string
  jobIds?: string[]
  lines?: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
  }>
  depositIds?: string[]
  terms: string
  issueNow: boolean
  dueDate?: string
}

interface CreateInvoiceResponse {
  invoiceId: string
  invoiceNumber: string
  summary: {
    subtotal: number
    tax: number
    total: number
    depositApplied: number
    balance: number
  }
}

export function useCreateInvoice() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createInvoice = async (
    data: CreateInvoiceData,
    idempotencyKey?: string
  ): Promise<CreateInvoiceResponse> => {
    try {
      setLoading(true)
      setError(null)

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey
      }

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create invoice')
      }

      const result = await response.json()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { createInvoice, loading, error }
}
