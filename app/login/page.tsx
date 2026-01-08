'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Swords, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check for errors in URL
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [])

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        console.log('✅ [Login] Existing session found, redirecting...')
        router.push('/dashboard')
      }
    }
    checkSession()
  }, [router])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('🔵 [Login] Attempting email login...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ [Login] Email login successful')

      // Check if profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (profile) {
        router.push('/dashboard')
      } else {
        router.push('/onboarding')
      }
    } catch (err: any) {
      console.error('🔴 [Login] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setLoading(true)

    try {
      console.log('🔵 [Login] Initiating Google OAuth...')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) throw error

      console.log('✅ [Login] Google OAuth initiated')
      // Browser will redirect to Google
    } catch (err: any) {
      console.error('🔴 [Login] Google OAuth error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    setError(null)
    setLoading(true)

    try {
      console.log('🔵 [Login] Initiating Apple OAuth...')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      console.log('✅ [Login] Apple OAuth initiated')
      // Browser will redirect to Apple
    } catch (err: any) {
      console.error('🔴 [Login] Apple OAuth error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-blue-950 flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center text-blue-200 hover:text-blue-100 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Guild Hall
        </Link>

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Shield className="h-16 w-16 text-blue-400" />
              <Swords className="h-8 w-8 text-cyan-400 absolute top-4 left-4" />
              <div className="absolute inset-0 blur-xl bg-blue-400/30"></div>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">
            Welcome Back, Warrior
          </h2>
          <p className="text-blue-200 text-base sm:text-lg mb-2">
            Return to your guild and continue your quest
          </p>
          <p className="text-sm text-blue-300">
            New to the guild?{' '}
            <Link href="/signup" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
              Join the Adventure
            </Link>
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-900/50 border border-red-500/50 p-4 backdrop-blur-sm">
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-blue-500/30 p-8 shadow-2xl">
          <div className="space-y-6">
            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-3 px-4 border-2 border-blue-400/50 text-sm font-medium rounded-lg text-white bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {/* Apple Sign In */}
            <button
              onClick={handleAppleLogin}
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-3 px-4 border-2 border-blue-400/50 text-sm font-medium rounded-lg text-white bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              {loading ? 'Signing in...' : 'Continue with Apple'}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-blue-500/30" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-800/50 text-blue-300">Or enter with credentials</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-200 mb-2">
                  Guild Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-blue-500/30 placeholder-blue-400/50 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm backdrop-blur-sm"
                  placeholder="warrior@guildtasks.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-blue-200 mb-2">
                  Secret Passphrase
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-blue-500/30 placeholder-blue-400/50 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm backdrop-blur-sm"
                  placeholder="Enter your passphrase"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
              >
                {loading ? 'Entering Guild Hall...' : 'Enter Guild Hall'}
              </button>

              <div className="text-center mt-3">
                <Link
                  href="/resend-confirmation"
                  className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Lost your verification scroll?
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-blue-300/70">
          Protected by ancient guild magic and modern encryption
        </p>
      </div>
    </div>
  )
}
