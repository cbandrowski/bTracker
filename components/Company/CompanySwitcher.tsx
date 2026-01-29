'use client'

import { useMemo, useState } from 'react'
import { CompanyRole } from '@/types/database'
import { useCompanyContext } from '@/contexts/CompanyContext'

interface CompanyOption {
  value: string
  label: string
  companyId: string
  role: CompanyRole
}

export function CompanySwitcher() {
  const {
    memberships,
    activeCompanyId,
    activeRole,
    loading,
    setActiveContext,
  } = useCompanyContext()
  const [saving, setSaving] = useState(false)

  const options = useMemo<CompanyOption[]>(() => {
    return memberships.flatMap((membership) =>
      membership.roles.map((role) => {
        const companyName = membership.company_name ?? 'Company'
        return {
          value: `${membership.company_id}:${role}`,
          label: `${companyName} (${role})`,
          companyId: membership.company_id,
          role,
        }
      })
    )
  }, [memberships])

  const activeValue =
    activeCompanyId && activeRole ? `${activeCompanyId}:${activeRole}` : ''

  const handleChange = async (value: string) => {
    const selected = options.find((option) => option.value === value)
    if (!selected) return

    try {
      setSaving(true)
      await setActiveContext(selected.companyId, selected.role)
    } catch (error) {
      console.error('Failed to update company context:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading || options.length <= 1) {
    return null
  }

  return (
    <div className="px-3 py-3">
      <label className="text-xs uppercase tracking-wide text-slate-400 block mb-2">
        Active Company
      </label>
      <select
        className="w-full rounded-md bg-slate-900/70 border border-slate-600/40 text-sm px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/60"
        value={activeValue}
        onChange={(event) => handleChange(event.target.value)}
        disabled={saving}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
