'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useState } from 'react'

export default function DebugProfilePage() {
  const { user, profile, loading } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [checking, setChecking] = useState(false)

  const checkProfile = async () => {
    if (!user) return

    setChecking(true)

    // Try direct query
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    // Try query without maybeSingle to see all results
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)

    // Check auth user
    const { data: { session } } = await supabase.auth.getSession()

    setDebugInfo({
      userId: user.id,
      userEmail: user.email,
      sessionExists: !!session,
      profileFromContext: profile,
      directProfileQuery: {
        data: profileData,
        error: profileError
      },
      allProfilesQuery: {
        data: allProfiles,
        count: allProfiles?.length || 0,
        error: allError
      }
    })

    setChecking(false)
  }

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-4">Profile Debug Info</h1>

          {loading ? (
            <p className="text-gray-400">Loading auth state...</p>
          ) : !user ? (
            <p className="text-gray-400">Not logged in</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">Current State</h2>
                <div className="bg-gray-800 rounded p-4 text-sm">
                  <p className="text-gray-300">User ID: <span className="text-white font-mono">{user.id}</span></p>
                  <p className="text-gray-300">Email: <span className="text-white">{user.email}</span></p>
                  <p className="text-gray-300">Has Profile: <span className={profile ? "text-green-400" : "text-red-400"}>{profile ? 'YES' : 'NO'}</span></p>
                </div>
              </div>

              <button
                onClick={checkProfile}
                disabled={checking}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {checking ? 'Checking...' : 'Run Profile Check'}
              </button>

              {debugInfo && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-2">Debug Results</h2>
                  <pre className="bg-gray-800 rounded p-4 text-xs text-gray-300 overflow-auto max-h-96">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
