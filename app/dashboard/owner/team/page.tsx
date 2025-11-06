'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { CompanyEmployee, ApprovalStatus, WorkStatus } from '@/types/database'

interface EmployeeWithProfile extends CompanyEmployee {
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
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

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

        setCompanyId(ownerData.company_id)

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
          console.log('Fetched employees:', employeesData)
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
      setOpenMenuId(null)
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to update approval status')
    }
  }

  const handleWorkStatusChange = async (employeeId: string, newStatus: WorkStatus) => {
    try {
      const { error } = await supabase
        .from('company_employees')
        .update({ work_status: newStatus })
        .eq('id', employeeId)

      if (error) {
        console.error('Error updating work status:', error)
        alert('Failed to update work status')
        return
      }

      // Update local state
      setEmployees(prev =>
        prev.map(emp =>
          emp.id === employeeId ? { ...emp, work_status: newStatus } : emp
        )
      )
      setOpenMenuId(null)
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to update work status')
    }
  }

  const getApprovalBadgeColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-600 text-white'
      case 'pending':
        return 'bg-yellow-600 text-white'
      case 'rejected':
        return 'bg-red-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  const getWorkStatusBadgeColor = (status: WorkStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-600 text-white'
      case 'inactive':
        return 'bg-gray-600 text-white'
      case 'vacation':
        return 'bg-blue-600 text-white'
      case 'sick':
        return 'bg-orange-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  const pendingEmployees = employees.filter(e => e.approval_status === 'pending')
  const approvedEmployees = employees.filter(e => e.approval_status === 'approved')
  const rejectedEmployees = employees.filter(e => e.approval_status === 'rejected')

  return (
    <div className="space-y-6">
      {/* Pending Approvals Section */}
      {pendingEmployees.length > 0 && (
        <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Pending Approval ({pendingEmployees.length})
          </h2>
          <div className="space-y-3">
            {pendingEmployees.map((employee) => (
              <div key={employee.id} className="bg-gray-800 p-4 rounded border border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{employee.profile?.full_name || 'Unknown'}</h3>
                    <p className="text-gray-400 text-sm">{employee.profile?.email}</p>
                    {employee.job_title && (
                      <p className="text-gray-500 text-sm">{employee.job_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprovalStatusChange(employee.id, 'approved')}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleApprovalStatusChange(employee.id, 'rejected')}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members Table */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          Team Members ({approvedEmployees.length} active)
        </h2>

        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Job Title</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Work Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No approved team members yet
                  </td>
                </tr>
              ) : (
                approvedEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-3 px-4 text-white">{employee.profile?.full_name || 'Unknown'}</td>
                    <td className="py-3 px-4 text-gray-400">{employee.profile?.email || 'N/A'}</td>
                    <td className="py-3 px-4 text-gray-400">{employee.job_title || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getApprovalBadgeColor(employee.approval_status)}`}>
                        {employee.approval_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkStatusBadgeColor(employee.work_status)}`}>
                        {employee.work_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative" ref={openMenuId === employee.id ? dropdownRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === employee.id ? null : employee.id)
                          }}
                          className="text-gray-400 hover:text-white"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {openMenuId === employee.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-gray-900 rounded-md shadow-2xl z-50 border border-gray-700 max-h-80 overflow-y-auto">
                            <div className="py-1">
                              <div className="px-4 py-2 text-xs text-gray-400 font-semibold sticky top-0 bg-gray-900 border-b border-gray-700">Change Work Status</div>
                              <button
                                onClick={() => handleWorkStatusChange(employee.id, 'available')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Available
                              </button>
                              <button
                                onClick={() => handleWorkStatusChange(employee.id, 'inactive')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Inactive
                              </button>
                              <button
                                onClick={() => handleWorkStatusChange(employee.id, 'vacation')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Vacation
                              </button>
                              <button
                                onClick={() => handleWorkStatusChange(employee.id, 'sick')}
                                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                              >
                                Sick
                              </button>
                              <div className="border-t border-gray-700 my-1"></div>
                              <button
                                onClick={() => handleApprovalStatusChange(employee.id, 'pending')}
                                className="block w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-gray-700"
                              >
                                Set to Pending
                              </button>
                              <button
                                onClick={() => handleApprovalStatusChange(employee.id, 'rejected')}
                                className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rejected Employees Section */}
      {rejectedEmployees.length > 0 && (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
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
