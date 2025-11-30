'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Users,
  Briefcase,
  Shield,
  Scroll,
  Swords,
  Crown,
  TrendingUp,
  Clock,
  Award
} from 'lucide-react'

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
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
        {/* Navigation */}
        <nav className="border-b border-purple-800/30 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-amber-500" />
                <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">
                  GuildTasks
                </span>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/login"
                  className="px-6 py-2 text-purple-200 hover:text-white transition-colors font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-6 py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-500/30 font-medium"
                >
                  Join the Guild
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative px-4 pt-20 pb-32 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Crown className="h-16 w-16 text-amber-400" />
                <div className="absolute inset-0 blur-xl bg-amber-400/30"></div>
              </div>
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Forge Your Business
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-purple-400 to-amber-400">
                Into Legend
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-purple-200 mb-12 max-w-3xl mx-auto leading-relaxed">
              Command your guild with powerful tools to track quests, recruit adventurers,
              and manage your workforce with the wisdom of ancient strategy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="group relative px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg hover:from-amber-500 hover:to-amber-400 transition-all shadow-2xl shadow-amber-500/40 font-bold text-lg"
              >
                <span className="relative z-10">Begin Your Quest</span>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-amber-400 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 bg-slate-800/50 text-purple-200 border-2 border-purple-500/50 rounded-lg hover:bg-slate-700/50 hover:border-purple-400 transition-all font-bold text-lg backdrop-blur-sm"
              >
                Return to Guild
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="relative px-4 py-20 sm:px-6 lg:px-8 bg-slate-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Master Your Guild&apos;s Domain
              </h2>
              <p className="text-xl text-purple-200">
                Legendary tools for modern guilds
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-amber-500/10 rounded-lg">
                  <Briefcase className="h-8 w-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Quest Management</h3>
                <p className="text-purple-200">
                  Track jobs and projects like epic quests. Assign tasks, monitor progress,
                  and complete missions with strategic precision.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-purple-500/10 rounded-lg">
                  <Users className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Recruit Adventurers</h3>
                <p className="text-purple-200">
                  Find skilled workers and temporary heroes for your guild.
                  Build your party with the finest talent in the realm.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-emerald-500/10 rounded-lg">
                  <Clock className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Time Tracking</h3>
                <p className="text-purple-200">
                  Monitor hours and attendance like a master strategist.
                  Know when your warriors are in battle and when they rest.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-blue-500/10 rounded-lg">
                  <Scroll className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Scroll of Records</h3>
                <p className="text-purple-200">
                  Maintain detailed chronicles of all activities.
                  Your guild&apos;s history preserved in mystical ledgers.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-rose-500/10 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-rose-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Kingdom Analytics</h3>
                <p className="text-purple-200">
                  Divine insights into your guild&apos;s performance.
                  Chart your path to glory with powerful analytics.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="group p-8 bg-gradient-to-br from-slate-800/80 to-purple-900/30 rounded-xl border border-purple-500/20 hover:border-amber-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20 backdrop-blur-sm">
                <div className="mb-4 inline-block p-3 bg-amber-500/10 rounded-lg">
                  <Award className="h-8 w-8 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Reward System</h3>
                <p className="text-purple-200">
                  Manage payroll and rewards like a royal treasurer.
                  Ensure your champions are compensated fairly for their valor.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <Swords className="h-12 w-12 text-amber-400" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Build Your Empire?
            </h2>
            <p className="text-xl text-purple-200 mb-8">
              Join thousands of guild masters who have transformed their businesses
              into legendary enterprises.
            </p>
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg hover:from-amber-500 hover:to-amber-400 transition-all shadow-2xl shadow-amber-500/40 font-bold text-lg"
            >
              Start Your Adventure
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-purple-800/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="col-span-1 md:col-span-2">
                <div className="flex items-center space-x-2 mb-4">
                  <Shield className="h-6 w-6 text-amber-500" />
                  <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">
                    GuildTasks
                  </span>
                </div>
                <p className="text-purple-200 max-w-md">
                  Empowering businesses with legendary tools to manage their workforce,
                  track projects, and recruit talent in the modern realm.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Guild Hall</h4>
                <ul className="space-y-2">
                  <li>
                    <Link href="/signup" className="text-purple-200 hover:text-amber-400 transition-colors">
                      Join Guild
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="text-purple-200 hover:text-amber-400 transition-colors">
                      Member Login
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Support</h4>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-purple-200 hover:text-amber-400 transition-colors">
                      Contact
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-purple-200 hover:text-amber-400 transition-colors">
                      Help Center
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-purple-800/30 mt-8 pt-8 text-center text-purple-300">
              <p>&copy; 2025 GuildTasks. All rights reserved across all realms.</p>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // If user exists and still loading profile, show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
        <div className="text-xl text-white">Loading profile...</div>
      </div>
    )
  }

  // Fallback (shouldn't reach here due to useEffect redirect)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-8">
          <Shield className="h-12 w-12 text-amber-500" />
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-purple-400">
            GuildTasks
          </h1>
        </div>
        <p className="text-xl text-purple-200 mb-12">Forge your business into legend</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3 text-purple-200 hover:text-white transition-colors font-medium text-lg"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-lg hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-500/30 font-medium text-lg"
          >
            Join the Guild
          </Link>
        </div>
      </div>
    </div>
  )
}
