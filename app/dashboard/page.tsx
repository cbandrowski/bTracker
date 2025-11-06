'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function DashboardPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const redirectToCorrectDashboard = async () => {
      console.log('📊 Dashboard: Determining user role and redirecting', {
        loading,
        user: !!user,
        userId: user?.id,
        profile: !!profile,
        profileId: profile?.id,
      })

      if (loading) return

      if (!user) {
        console.log('📊 Dashboard: No user, redirecting to login')
        router.push('/login')
        return
      }

      if (!profile) {
        console.log('📊 Dashboard: No profile found, checking if profile exists in DB...')
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (!data) {
          console.log('📊 Dashboard: Confirmed no profile in DB, redirecting to onboarding')
          router.push('/onboarding')
        } else {
          console.log('📊 Dashboard: Profile exists in DB but not in context, refreshing page')
          window.location.reload()
        }
        return
      }

      // Check if user is an owner
      const { data: ownerData } = await supabase
        .from('company_owners')
        .select('id')
        .eq('profile_id', profile.id)
        .limit(1)

      if (ownerData && ownerData.length > 0) {
        console.log('📊 Dashboard: User is an owner, redirecting to owner dashboard')
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
        console.log('📊 Dashboard: User is an employee, redirecting to employee dashboard')
        router.push('/dashboard/employee')
        return
      }

      // User has no company affiliation, redirect to onboarding
      console.log('📊 Dashboard: User has no company, redirecting to onboarding')
      router.push('/onboarding')
    }

    redirectToCorrectDashboard()
  }, [user, loading, profile, router])

  // Show loading screen while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-xl text-white">Redirecting...</div>
    </div>
  )
}
