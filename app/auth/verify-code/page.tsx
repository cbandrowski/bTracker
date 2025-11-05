'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Verify your email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We've sent a 6-digit verification code to
          </p>
          <p className="text-center text-sm font-medium text-gray-900">
            {email}
          </p>
          <p className="mt-2 text-center text-xs text-gray-500">
            Check your email and enter the code below
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleVerify}>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Verification Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(value)
              }}
              className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-center text-3xl tracking-[0.5em] font-mono"
              placeholder="000000"
              maxLength={6}
              autoComplete="off"
            />
            <p className="mt-2 text-xs text-gray-500 text-center">
              Enter the 6-digit code from your email
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {resendSuccess && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Verification code resent successfully! Check your email.
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </div>

          <div className="text-center space-y-3">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resending}
              className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50 font-medium"
            >
              {resending ? 'Resending...' : "Didn't receive the code? Resend"}
            </button>
            <div>
              <Link
                href="/signup"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Back to signup
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function VerifyCodePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    }>
      <VerifyCodeContent />
    </Suspense>
  )
}
