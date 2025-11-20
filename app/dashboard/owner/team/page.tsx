'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { CompanyEmployee, ApprovalStatus } from '@/types/database'
import Link from 'next/link'

interface EmployeeWithProfile extends CompanyEmployee {
  hourly_rate?: number
  profile?: {
    full_name: string
    email: string | null
    phone: string | null
  }
}

export default function TeamMembersPage() {
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
        // Get the company the owner owns
        const { data: ownerData } = await supabase
          .from('company_owners')
          .select('company_id')
          .eq('profile_id', profile.id)
          .single()

        if (!ownerData) {
          setLoadingData(false)
          return
        }

        // Fetch all employees for this company
        const { data: employeesData, error } = await supabase
          .from('company_employees')
          .select(`
            *,
            profile:profiles(
              full_name,
              email,
              phone
            )
          `)
          .eq('company_id', ownerData.company_id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching employees:', error)
        } else {
          setEmployees((employeesData as any) || [])
        }
      } catch (error) {
        console.error('Error:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchEmployees()
    }
  }, [profile])

  const handleApprovalStatusChange = async (employeeId: string, newStatus: ApprovalStatus) => {
    try {
      const { error } = await supabase
        .from('company_employees')
        .update({ approval_status: newStatus })
        .eq('id', employeeId)

      if (error) {
        console.error('Error updating approval status:', error)
        alert('Failed to update approval status')
        return
      }

      // Update local state
      setEmployees(prev =>
        prev.map(emp =>
          emp.id === employeeId ? { ...emp, approval_status: newStatus } : emp
        )
      )
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to update approval status')
    }
  }

  const getWorkStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700'
      case 'inactive':
        return 'bg-gray-700 text-gray-300 border border-gray-600'
      case 'vacation':
        return 'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-700'
      case 'sick':
        return 'bg-orange-900 bg-opacity-50 text-orange-200 border border-orange-700'
      default:
        return 'bg-gray-700 text-gray-300 border border-gray-600'
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const pendingEmployees = employees.filter(e => e.approval_status === 'pending')
  const approvedEmployees = employees.filter(e => e.approval_status === 'approved')
  const rejectedEmployees = employees.filter(e => e.approval_status === 'rejected')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Members</h1>
          <p className="text-gray-400 mt-1">{approvedEmployees.length} active members</p>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingEmployees.length > 0 && (
        <div className="bg-yellow-900 bg-opacity-20 border-2 border-yellow-600 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Pending Approval ({pendingEmployees.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingEmployees.map((employee) => (
              <div key={employee.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-white font-semibold text-lg mb-1">
                  {employee.profile?.full_name || 'Unknown'}
                </h3>
                <p className="text-gray-400 text-sm mb-2">{employee.profile?.email}</p>
                {employee.job_title && (
                  <p className="text-gray-500 text-sm mb-4">{employee.job_title}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprovalStatusChange(employee.id, 'approved')}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleApprovalStatusChange(employee.id, 'rejected')}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {approvedEmployees.map((employee) => (
          <Link
            key={employee.id}
            href={`/dashboard/owner/team/${employee.id}`}
            className="block bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg">
                  {employee.profile?.full_name || 'Unknown'}
                </h3>
                <p className="text-gray-400 text-sm">{employee.profile?.email}</p>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getWorkStatusBadgeColor(employee.work_status)}`}>
                {employee.work_status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              {employee.job_title && (
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {employee.job_title}
                </div>
              )}
              {employee.hourly_rate && (
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ${Number(employee.hourly_rate).toFixed(2)}/hr
                </div>
              )}
              {employee.profile?.phone && (
                <div className="flex items-center text-gray-300">
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {employee.profile.phone}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <span className="text-blue-400 text-sm hover:text-blue-300">
                View Details →
              </span>
            </div>
          </Link>
        ))}

        {approvedEmployees.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-800 rounded-lg border border-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="mt-4 text-gray-400">No team members yet</p>
          </div>
        )}
      </div>

      {/* Rejected Employees Section */}
      {rejectedEmployees.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-red-400 mb-4">
            Rejected ({rejectedEmployees.length})
          </h2>
          <div className="space-y-2">
            {rejectedEmployees.map((employee) => (
              <div key={employee.id} className="bg-gray-900 p-3 rounded border border-gray-700 flex items-center justify-between">
                <div>
                  <span className="text-white">{employee.profile?.full_name || 'Unknown'}</span>
                  <span className="text-gray-500 text-sm ml-2">{employee.profile?.email}</span>
                </div>
                <button
                  onClick={() => handleApprovalStatusChange(employee.id, 'pending')}
                  className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
                >
                  Review Again
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
