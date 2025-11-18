'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { EmployeeSidebar } from '@/components/dashboard/EmployeeSidebar'

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [isEmployee, setIsEmployee] = useState<boolean | null>(null)
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'pending' | 'rejected' | null>(null)

  useEffect(() => {
    const verifyEmployee = async () => {
      if (loading) return

      if (!user) {
        router.push('/login')
        return
      }

      if (!profile) {
        router.push('/onboarding')
        return
      }

      // Check if user is an owner (if so, redirect to owner dashboard)
      const { data: ownerData } = await supabase
        .from('company_owners')
        .select('company_id')
        .eq('profile_id', profile.id)
        .limit(1)

      if (ownerData && ownerData.length > 0) {
        console.log('User is an owner, redirecting to owner dashboard')
        router.push('/dashboard/owner')
        return
      }

      // Check if user is an employee and approved
      const { data: employeeData } = await supabase
        .from('company_employees')
        .select('id, approval_status')
        .eq('profile_id', profile.id)
        .limit(1)

      if (employeeData && employeeData.length > 0) {
        const employee = employeeData[0] as any
        setApprovalStatus(employee.approval_status)

        // Check if employee is approved
        if (employee.approval_status === 'approved') {
          setIsEmployee(true)
        } else {
          // Pending or rejected - show status screen
          setIsEmployee(false)
        }
      } else {
        // Not an employee either, redirect to onboarding
        router.push('/onboarding')
      }
    }

    verifyEmployee()
  }, [user, profile, loading, router])

  if (loading || isEmployee === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  // Show pending approval screen
  if (approvalStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-8">
            <svg className="w-16 h-16 text-yellow-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">Pending Approval</h2>
            <p className="text-gray-300 mb-4">
              Your account is waiting for approval from your company administrator.
            </p>
            <p className="text-gray-400 text-sm">
              You'll receive access once your account has been approved.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="mt-6 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show rejected screen
  if (approvalStatus === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-900/20 border-2 border-red-600 rounded-lg p-8">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-gray-300 mb-4">
              Your account access has been denied by your company administrator.
            </p>
            <p className="text-gray-400 text-sm">
              Please contact your administrator for more information.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="mt-6 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isEmployee) {
    return null
  }

  const menu = [
    {
      label: 'Dashboard',
      link: '/dashboard/employee',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Profile',
      link: '/dashboard/employee/profile',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: 'Clock In/Out',
      link: '/dashboard/employee/clock-in',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'My Shifts',
      link: '/dashboard/employee/my-schedule',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Timesheets',
      link: '/dashboard/employee/timesheets',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
    {
      label: 'Job Assignments',
      link: '/dashboard/employee/schedule',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Documents',
      link: '/dashboard/employee/documents',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Job Board',
      link: '/dashboard/employee/job-board',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-gray-900 shadow-lg rounded-lg mb-6 border border-gray-800">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-800">
            <div>
              <h1 className="text-2xl font-bold text-white">Employee Dashboard</h1>
              <p className="mt-1 text-sm text-gray-400">
                Welcome back, {profile?.full_name || user?.email}!
              </p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Layout with Sidebar and Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          <EmployeeSidebar menu={menu} />

          {/* Main Content */}
          <main className="flex-1 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
