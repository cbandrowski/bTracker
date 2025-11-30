'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Sparkles } from 'lucide-react'

function VerifyCodeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
  }, [searchParams])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup'
    })

    console.log('Verification result:', { data, error })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      // Successfully verified, redirect to onboarding for new users
      console.log('✅ [VerifyCode] Email verified successfully, redirecting to onboarding')
      router.push('/onboarding')
    } else {
      setError('Verification failed. Please try again.')
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError(null)
    setResending(true)
    setResendSuccess(false)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (error) {
      setError(error.message)
    } else {
      setResendSuccess(true)
    }
    setResending(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-slate-900 to-violet-950 flex items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl"></div>
        <Sparkles className="absolute top-32 right-32 h-6 w-6 text-purple-400/30" />
        <Sparkles className="absolute bottom-32 left-32 h-4 w-4 text-violet-400/30" />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Back to signup */}
        <Link
          href="/signup"
          className="inline-flex items-center text-purple-200 hover:text-purple-100 transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to signup
        </Link>

        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <Mail className="h-16 w-16 text-purple-400" />
              <div className="absolute inset-0 blur-xl bg-purple-400/30"></div>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">
            Verify Your Scroll
          </h2>
          <p className="text-purple-200 text-lg mb-2">
            We've sent a mystical code to
          </p>
          <p className="text-purple-100 font-medium text-lg mb-2">
            {email}
          </p>
          <p className="text-sm text-purple-300">
            Check your messages and enter the code below
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-xl border border-purple-500/30 p-8 shadow-2xl">
          <form className="space-y-6" onSubmit={handleVerify}>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-purple-200 mb-2 text-center">
                Verification Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                required
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setCode(value)
                }}
                className="appearance-none relative block w-full px-4 py-4 border border-purple-500/30 placeholder-purple-400/50 text-white bg-slate-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-3xl tracking-widest font-mono backdrop-blur-sm"
                placeholder="Enter code"
                autoComplete="off"
              />
              <p className="mt-2 text-xs text-purple-300 text-center">
                Enter the code from your email
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-900/50 border border-red-500/50 p-4 backdrop-blur-sm">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            {resendSuccess && (
              <div className="rounded-lg bg-green-900/50 border border-green-500/50 p-4 backdrop-blur-sm">
                <p className="text-sm text-green-200">
                  Verification code resent successfully! Check your email.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length === 0}
              className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/30"
            >
              {loading ? 'Verifying Scroll...' : 'Verify Email'}
            </button>

            <div className="text-center space-y-3">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resending}
                className="text-sm text-purple-300 hover:text-purple-200 disabled:opacity-50 font-medium transition-colors"
              >
                {resending ? 'Resending...' : "Didn't receive the code? Resend"}
              </button>
            </div>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-purple-300/70">
          Your verification code is protected by ancient magic
        </p>
      </div>
    </div>
  )
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-slate-900 to-violet-950">
        <div className="text-xl text-purple-200">Loading...</div>
      </div>
    }>
      <VerifyCodeContent />
    </Suspense>
  )
}
