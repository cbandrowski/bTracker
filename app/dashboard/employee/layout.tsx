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

      // Check if user is an employee
      const { data: employeeData } = await supabase
        .from('company_employees')
        .select('id')
        .eq('profile_id', profile.id)
        .limit(1)

      if (employeeData && employeeData.length > 0) {
        setIsEmployee(true)
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
      label: 'Timesheets',
      link: '/dashboard/employee/timesheets',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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
