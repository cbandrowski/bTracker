'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { EmployeeSidebar } from '@/components/dashboard/EmployeeSidebar'
import { Shield, LogOut, Clock, HourglassIcon } from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-slate-900 to-teal-950 flex items-center justify-center">
        <div className="text-xl text-cyan-200">Loading your quest...</div>
      </div>
    )
  }

  // Show pending approval screen
  if (approvalStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-slate-900 to-teal-950 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-slate-800/50 backdrop-blur-md border-2 border-amber-500/50 rounded-xl p-8">
            <HourglassIcon className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-2">
              Awaiting Guild Approval
            </h2>
            <p className="text-cyan-200 mb-4">
              Your request to join the guild is being reviewed by your guild master.
            </p>
            <p className="text-cyan-300/70 text-sm">
              You'll gain access to your warrior dashboard once approved.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="mt-6 px-6 py-2 bg-slate-700/50 text-cyan-200 rounded-lg hover:bg-slate-600/50 transition-colors border border-cyan-500/30"
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
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-slate-900 to-teal-950 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-slate-800/50 backdrop-blur-md border-2 border-red-500/50 rounded-xl p-8">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-red-400 mb-2">
              Access Denied
            </h2>
            <p className="text-cyan-200 mb-4">
              Your guild application has been declined by your guild master.
            </p>
            <p className="text-cyan-300/70 text-sm">
              Please contact your guild master for more information.
            </p>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="mt-6 px-6 py-2 bg-slate-700/50 text-cyan-200 rounded-lg hover:bg-slate-600/50 transition-colors border border-cyan-500/30"
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
      label: 'Payroll',
      link: '/dashboard/employee/payroll',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Quest Board',
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
    <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-slate-900 to-teal-950 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 relative z-10">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-xl border border-cyan-500/30 mb-4 sm:mb-6">
          <div className="px-3 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-1">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400 flex-shrink-0" />
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-400 truncate">
                  Warrior Dashboard
                </h1>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-cyan-200 truncate">
                Welcome back, {profile?.full_name || user?.email}!
              </p>
            </div>
          </div>
        </div>

        {/* Layout with Sidebar and Content */}
        <div className="flex lg:flex-row gap-0 lg:gap-6">
          <EmployeeSidebar menu={menu} />

          {/* Main Content - takes full width on mobile */}
          <main className="flex-1 w-full lg:w-auto bg-slate-800/50 backdrop-blur-md rounded-xl border border-cyan-500/30 overflow-hidden shadow-2xl">
            <div className="p-3 sm:p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
