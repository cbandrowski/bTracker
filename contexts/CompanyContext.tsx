'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CompanyMembership, CompanyRole } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

interface CompanyContextValue {
  memberships: CompanyMembership[]
  activeCompanyId: string | null
  activeCompanyName: string | null
  activeRole: CompanyRole | null
  activeEmployeeId: string | null
  activeOwnerId: string | null
  loading: boolean
  refreshContext: () => Promise<void>
  setActiveContext: (companyId: string, role?: CompanyRole) => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue>({
  memberships: [],
  activeCompanyId: null,
  activeCompanyName: null,
  activeRole: null,
  activeEmployeeId: null,
  activeOwnerId: null,
  loading: true,
  refreshContext: async () => {},
  setActiveContext: async () => {},
})

export const useCompanyContext = () => useContext(CompanyContext)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [memberships, setMemberships] = useState<CompanyMembership[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<CompanyRole | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshContext = useCallback(async () => {
    if (!user) {
      setMemberships([])
      setActiveCompanyId(null)
      setActiveRole(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/company-context', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        setMemberships([])
        setActiveCompanyId(null)
        setActiveRole(null)
        setLoading(false)
        return
      }

      const data = await response.json()
      setMemberships(data.memberships ?? [])
      setActiveCompanyId(data.context?.company_id ?? null)
      setActiveRole(data.context?.role ?? null)
    } catch (error) {
      console.error('Failed to load company context:', error)
      setMemberships([])
      setActiveCompanyId(null)
      setActiveRole(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  const setActiveContext = useCallback(
    async (companyId: string, role?: CompanyRole) => {
      if (!user) {
        return
      }

      const response = await fetch('/api/company-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, role }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = payload?.error ?? 'Failed to update company context'
        throw new Error(message)
      }

      const data = await response.json()
      setActiveCompanyId(data.context?.company_id ?? null)
      setActiveRole(data.context?.role ?? null)
    },
    [user]
  )

  useEffect(() => {
    refreshContext()
  }, [refreshContext])

  const activeMembership = useMemo(
    () => memberships.find((membership) => membership.company_id === activeCompanyId) ?? null,
    [memberships, activeCompanyId]
  )

  const activeCompanyName = activeMembership?.company_name ?? null
  const activeEmployeeId =
    activeRole === 'employee' ? activeMembership?.employee_id ?? null : null
  const activeOwnerId =
    activeRole === 'owner' ? activeMembership?.owner_id ?? null : null

  return (
    <CompanyContext.Provider
      value={{
        memberships,
        activeCompanyId,
        activeCompanyName,
        activeRole,
        activeEmployeeId,
        activeOwnerId,
        loading,
        refreshContext,
        setActiveContext,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}
