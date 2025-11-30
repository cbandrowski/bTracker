'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { OwnerSidebar } from '@/components/dashboard/OwnerSidebar'
import { Crown, LogOut } from 'lucide-react'

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [isOwner, setIsOwner] = useState<boolean | null>(null)
  const [employeeCount, setEmployeeCount] = useState(0)

  useEffect(() => {
    const verifyOwner = async () => {
      if (loading) return

      if (!user) {
        router.push('/login')
        return
      }

      if (!profile) {
        router.push('/onboarding')
        return
      }

      // Check if user is an owner
      const { data: ownerData } = await supabase
        .from('company_owners')
        .select('company_id')
        .eq('profile_id', profile.id)
        .limit(1)

      if (!ownerData || ownerData.length === 0) {
        console.log('User is not an owner, redirecting to employee dashboard')
        router.push('/dashboard/employee')
        return
      }

      setIsOwner(true)

      // Fetch employee count for the menu
      const companyIds = ownerData.map(o => o.company_id)
      const { data: employeesData } = await supabase
        .from('company_employees')
        .select('id', { count: 'exact' })
        .in('company_id', companyIds)
        .neq('profile_id', profile.id)

      setEmployeeCount(employeesData?.length || 0)
    }

    verifyOwner()
  }, [user, profile, loading, router])

  if (loading || isOwner === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-violet-950 flex items-center justify-center">
        <div className="text-xl text-purple-200">Loading Guild Hall...</div>
      </div>
    )
  }

  if (!isOwner) {
    return null
  }

  const menu = [
    {
      label: 'Profile',
      link: '/dashboard/owner',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: `Warriors (${employeeCount})`,
      link: '/dashboard/owner/team',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Clients',
      link: '/dashboard/owner/customers',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Treasury',
      link: '/dashboard/owner/billing',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    },
    {
      label: 'Quests',
      link: '/dashboard/owner/jobs',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Quest Assignments',
      link: '/dashboard/owner/assignments',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Quest Board',
      link: '/dashboard/owner/job-board',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Schedule',
      link: '/dashboard/owner/schedule',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Time Ledger',
      link: '/dashboard/owner/schedule-and-time/schedule',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Payroll',
      link: '/dashboard/owner/payroll',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Suppliers',
      link: '/dashboard/owner/suppliers',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      label: 'Merchant Contacts',
      link: '/dashboard/owner/vendor-contacts',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-violet-950 py-8 print:py-0 print:bg-white relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print:px-0 print:max-w-none relative z-10">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-xl border border-purple-500/30 mb-6 print:hidden">
          <div className="px-6 py-5 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Crown className="h-8 w-8 text-amber-400" />
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">
                  Guild Master Hall
                </h1>
              </div>
              <p className="mt-1 text-sm text-purple-200">
                Welcome back, {profile?.full_name || user?.email}!
              </p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="flex items-center gap-2 px-5 py-2 bg-red-600/80 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all shadow-lg"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Layout with Sidebar and Content */}
        <div className="flex flex-col lg:flex-row gap-6 print:block print:gap-0">
          <div className="print:hidden">
            <OwnerSidebar menu={menu} />
          </div>

          {/* Main Content */}
          <main className="flex-1 bg-slate-800/50 backdrop-blur-md rounded-xl border border-purple-500/30 overflow-hidden shadow-2xl print:border-0 print:rounded-none print:bg-white print:overflow-visible">
            <div className="p-6 print:p-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
