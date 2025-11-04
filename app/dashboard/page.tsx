'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome back! Here's your profile information.
              </p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Sign Out
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-6">
              {/* Profile Picture */}
              {user.user_metadata?.avatar_url && (
                <div className="flex items-center space-x-4">
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="h-24 w-24 rounded-full"
                  />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {user.user_metadata?.full_name || user.email}
                    </h2>
                  </div>
                </div>
              )}

              {/* User Details Grid */}
              <div className="border-t border-gray-200 pt-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.user_metadata?.full_name || 'Not provided'}
                    </dd>
                  </div>

                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.email || 'Not provided'}
                    </dd>
                  </div>

                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Provider</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.app_metadata?.provider || 'Unknown'}
                    </dd>
                  </div>

                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">User ID</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">
                      {user.id}
                    </dd>
                  </div>

                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.email_confirmed_at ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-yellow-600">No</span>
                      )}
                    </dd>
                  </div>

                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Last Sign In</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString()
                        : 'Unknown'}
                    </dd>
                  </div>

                  {/* Additional Google Data */}
                  {user.user_metadata?.avatar_url && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Profile Picture URL</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-all">
                        {user.user_metadata.avatar_url}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Raw User Metadata (for debugging) */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Raw User Metadata
                </h3>
                <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(user.user_metadata, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
