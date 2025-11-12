'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function DebugAuthPage() {
  const { user, profile, session } = useAuth()
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [userEmails, setUserEmails] = useState<string[]>([])

  useEffect(() => {
    const fetchDebugInfo = async () => {
      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')

      setAllProfiles(profiles || [])
    }

    fetchDebugInfo()
  }, [])

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Auth Debug Page</h1>

        {/* Current User Info */}
        <div className="bg-gray-900 p-6 rounded-lg mb-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4">Current Session</h2>
          <div className="space-y-2 font-mono text-sm">
            <div className="text-gray-400">
              <span className="text-blue-400">User ID:</span> {user?.id || 'Not logged in'}
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400">Email:</span> {user?.email || 'N/A'}
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400">Auth Provider:</span> {user?.app_metadata?.provider || 'N/A'}
            </div>
            <div className="text-gray-400">
              <span className="text-blue-400">Has Profile:</span> {profile ? 'Yes' : 'No'}
            </div>
            {profile && (
              <div className="text-gray-400">
                <span className="text-blue-400">Profile ID:</span> {profile.id}
              </div>
            )}
          </div>
        </div>

        {/* All Profiles */}
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4">All Profiles in Database</h2>
          {allProfiles.length === 0 ? (
            <p className="text-gray-400">No profiles found</p>
          ) : (
            <div className="space-y-4">
              {allProfiles.map((p) => (
                <div
                  key={p.id}
                  className={`p-4 rounded border ${
                    p.id === user?.id
                      ? 'border-green-500 bg-green-900/20'
                      : 'border-gray-700 bg-gray-800'
                  }`}
                >
                  <div className="font-mono text-sm space-y-1">
                    <div className="text-white font-semibold">{p.full_name}</div>
                    <div className="text-gray-400">ID: {p.id}</div>
                    <div className="text-gray-400">Email: {p.email}</div>
                    <div className="text-gray-400">Role: {p.role}</div>
                    <div className="text-gray-400">Company ID: {p.company_id || 'None'}</div>
                    {p.id === user?.id && (
                      <div className="text-green-400 font-semibold mt-2">✓ Current User</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-4">
          <div className="bg-yellow-900 border border-yellow-700 p-4 rounded-lg">
            <h3 className="text-yellow-200 font-semibold mb-2">Diagnosis</h3>
            <p className="text-yellow-100 text-sm">
              {!user && "You're not logged in."}
              {user && !profile && allProfiles.length === 0 && (
                <>
                  No profiles exist in the database. You need to complete the onboarding process.
                  <br /><br />
                  <strong>Current Email:</strong> {user.email}
                  <br />
                  <strong>Action:</strong> Either go through onboarding with this account, or sign out and sign in with a different account if you have an existing profile.
                </>
              )}
              {user && !profile && allProfiles.length > 0 && (
                <>
                  Your user ID ({user.id}) doesn't match any profile in the database.
                  You might be logged in with a different account than the one used to create the profile.
                  <br /><br />
                  <strong>Solution:</strong> Sign out and sign in with the account that has the profile (email: {allProfiles[0]?.email}).
                </>
              )}
              {user && profile && "Everything looks good! Your profile is loaded correctly."}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = '/onboarding'}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Go to Onboarding
            </button>

            <button
              onClick={async () => {
                // Use supabase directly to sign out
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>

          {profile && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
