'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Profile, CompanyEmployee } from '@/types/database'

interface EmployeeWithProfile extends CompanyEmployee {
  profile: Profile
}

export default function EmployeesPage() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        // Get owned companies
        const { data: ownerData } = await supabase
          .from('company_owners')
          .select('company_id')
          .eq('profile_id', profile.id)

        if (!ownerData || ownerData.length === 0) {
          setLoadingData(false)
          return
        }

        // Fetch employees for all owned companies
        const companyIds = ownerData.map(o => o.company_id)

        const { data: employeesData } = await supabase
          .from('company_employees')
          .select(`
            *,
            profile:profiles(*)
          `)
          .in('company_id', companyIds)
          .neq('profile_id', profile.id)

        setEmployees((employeesData as any) || [])
      } catch (error) {
        console.error('Error fetching employees:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchEmployees()
    }
  }, [profile])

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-muted-foreground">Loading employees...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="glass-surface shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold guild-heading">
            Team Members ({employees.length})
          </h2>
        </div>

        {employees.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-muted-foreground">No employees yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share your company code with team members to get started
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="glass-surface">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Job Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Hire Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="glass-surface divide-y divide-border">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {employee.profile.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatPhoneNumber(employee.profile.phone)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {employee.job_title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {employee.hire_date
                        ? new Date(employee.hire_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        employee.employment_status === 'active'
                          ? 'bg-secondary text-secondary-foreground'
                          : employee.employment_status === 'on_leave'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-destructive text-destructive-foreground'
                      }`}>
                        {employee.employment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
