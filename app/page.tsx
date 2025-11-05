'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import Link from 'next/link'

export default function Home() {
  const { user, loading, hasProfile, profile } = useAuth()
  const router = useRouter()
  const hasRedirected = useRef(false)
  const lastUserId = useRef<string | null>(null)

  // Reset redirect flag when user changes
  useEffect(() => {
    if (user?.id !== lastUserId.current) {
      console.log('🟢 User changed, resetting redirect flag')
      hasRedirected.current = false
      lastUserId.current = user?.id || null
    }
  }, [user])

  // Debug logging
  useEffect(() => {
    console.log('🟢 Landing Page State:', {
      user: !!user,
      userId: user?.id,
      loading,
      hasProfile,
      profile: !!profile
    })

    // If loading is stuck for too long, force show landing page
    if (loading && !user) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Loading stuck, forcing landing page render')
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [user, loading, hasProfile, profile])

  useEffect(() => {
    // Only redirect if user is logged in
    if (user && !hasRedirected.current) {
      console.log('🟢 Home page - user detected, checking profile:', {
        userId: user.id,
        loading,
        hasProfile,
        profile: !!profile
      })

      // If still loading profile, wait
      if (loading) {
        console.log('🟢 Still loading profile, waiting...')
        return
      }

      console.log('🟢 Auth loaded, making redirect decision')
      hasRedirected.current = true

      // Check if user has completed profile
      if (profile) {
        console.log('🟢 Profile exists, redirecting to dashboard')
        router.replace('/dashboard')
      } else {
        console.log('🟢 No profile, redirecting to onboarding')
        router.replace('/onboarding')
      }
    }
  }, [user, loading, profile, router])

  // Always show landing page if no user (even if loading)
  // This prevents getting stuck on loading screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-8">btracker</h1>
          <p className="text-xl text-gray-400 mb-12">Track your business with ease</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-lg transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-8 py-3 bg-gray-800 text-white border border-gray-700 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium text-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // If user exists and still loading profile, show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-white">Loading profile...</div>
      </div>
    )
  }

  // Fallback (shouldn't reach here due to useEffect redirect)
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-8">btracker</h1>
        <p className="text-xl text-gray-400 mb-12">Track your business with ease</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-lg transition-colors"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-8 py-3 bg-gray-800 text-white border border-gray-700 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium text-lg transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
