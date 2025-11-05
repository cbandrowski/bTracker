'use client'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

interface Profile {
  id: string
  full_name: string
  email: string
  phone: string
  role: string
  company_id: string | null
  created_at: string
}

interface Company {
  id: string
  name: string
  company_code: string
  created_at: string
}

interface CompanyOwner {
  id: string
  company_id: string
  profile_id: string
  is_primary_owner: boolean
  ownership_percentage: number | null
}

export default function DbInspectPage() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyOwners, setCompanyOwners] = useState<CompanyOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<{ profiles?: string; companies?: string; companyOwners?: string }>({})

  useEffect(() => {
    const fetchData = async () => {
      const newErrors: { profiles?: string; companies?: string; companyOwners?: string } = {}

      try {
        console.log('🔍 Fetching profiles...')
        // Fetch all profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        console.log('Profiles result:', { data: profilesData, error: profilesError })

        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError)
          // Treat 403 as "no access" rather than error
          if (profilesError.code === 'PGRST301' || profilesError.message.includes('row-level security')) {
            newErrors.profiles = 'RLS policy blocking access (no related profiles)'
            setProfiles([])
          } else {
            newErrors.profiles = profilesError.message
          }
        } else {
          console.log('✅ Profiles fetched:', profilesData?.length || 0)
          setProfiles(profilesData || [])
        }

        console.log('🔍 Fetching companies...')
        // Fetch all companies
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false })

        console.log('Companies result:', { data: companiesData, error: companiesError })

        if (companiesError) {
          console.error('❌ Error fetching companies:', companiesError)
          // Treat 403 as "no access" rather than error
          if (companiesError.code === 'PGRST301' || companiesError.message.includes('row-level security')) {
            newErrors.companies = 'RLS policy blocking access (you are not an owner/employee of any companies)'
            setCompanies([])
          } else {
            newErrors.companies = companiesError.message
          }
        } else {
          console.log('✅ Companies fetched:', companiesData?.length || 0)
          setCompanies(companiesData || [])
        }

        console.log('🔍 Fetching company owners...')
        // Fetch company owners
        const { data: ownersData, error: ownersError } = await supabase
          .from('company_owners')
          .select('*')
          .order('created_at', { ascending: false })

        console.log('Company owners result:', { data: ownersData, error: ownersError })

        if (ownersError) {
          console.error('❌ Error fetching company_owners:', ownersError)
          // Treat 403 as "no access" rather than error
          if (ownersError.code === 'PGRST301' || ownersError.message.includes('row-level security')) {
            newErrors.companyOwners = 'RLS policy blocking access (no ownership data)'
            setCompanyOwners([])
          } else {
            newErrors.companyOwners = ownersError.message
          }
        } else {
          console.log('✅ Company owners fetched:', ownersData?.length || 0)
          setCompanyOwners(ownersData || [])
        }

        setErrors(newErrors)
        setLoading(false)
      } catch (error: any) {
        console.error('❌ Exception fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const getCompanyForProfile = (companyId: string | null) => {
    if (!companyId) return null
    return companies.find(c => c.id === companyId)
  }

  const getOwnersForCompany = (companyId: string) => {
    const ownerRecords = companyOwners.filter(co => co.company_id === companyId)
    return ownerRecords.map(or => ({
      ...or,
      profile: profiles.find(p => p.id === or.profile_id)
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading database info...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Database Inspector</h1>
          <p className="text-gray-400">View all tables and UUID relationships</p>
        </div>

        {/* Current Session */}
        <div className="mb-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🔐</span> Current Session (Auth)
          </h2>
          {user ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">User ID (UUID)</div>
                  <div className="font-mono text-sm bg-gray-800 px-3 py-2 rounded text-blue-400">
                    {user.id}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Email</div>
                  <div className="font-mono text-sm bg-gray-800 px-3 py-2 rounded text-white">
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Provider</div>
                  <div className="text-sm text-white">{user.app_metadata?.provider || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Created At</div>
                  <div className="text-sm text-white">
                    {new Date(user.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Not logged in</div>
          )}
        </div>

        {/* Profiles Table */}
        <div className="mb-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">👤</span> Profiles Table ({profiles.length})
          </h2>
          {errors.profiles && (
            <div className="mb-4 bg-red-900 border border-red-700 rounded p-4">
              <div className="text-red-200 text-sm">
                <strong>Error fetching profiles:</strong> {errors.profiles}
              </div>
              <div className="text-red-300 text-xs mt-2">
                This is likely a Row Level Security (RLS) policy issue. Check Supabase dashboard.
              </div>
            </div>
          )}
          {!errors.profiles && profiles.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              No profiles in database (or RLS blocking access)
            </div>
          )}
          {!errors.profiles && profiles.length > 0 && (
            <div className="space-y-4">
              {profiles.map((profile) => {
                const isCurrentUser = user?.id === profile.id
                const company = getCompanyForProfile(profile.company_id)

                return (
                  <div
                    key={profile.id}
                    className={`p-4 rounded-lg border ${
                      isCurrentUser
                        ? 'border-green-500 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Profile ID (UUID)</div>
                        <div className="font-mono text-xs bg-gray-900 px-2 py-1 rounded text-blue-400 break-all">
                          {profile.id}
                          {isCurrentUser && (
                            <span className="ml-2 text-green-400 font-semibold">← YOU</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Name / Email</div>
                        <div className="text-sm text-white font-semibold">{profile.full_name}</div>
                        <div className="text-xs text-gray-400">{profile.email}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Role</div>
                        <div className="text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              profile.role === 'owner'
                                ? 'bg-blue-600 text-white'
                                : 'bg-green-600 text-white'
                            }`}
                          >
                            {profile.role}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Company Link</div>
                        {profile.company_id ? (
                          <div>
                            <div className="font-mono text-xs bg-gray-900 px-2 py-1 rounded text-purple-400 break-all">
                              {profile.company_id}
                            </div>
                            {company && (
                              <div className="text-xs text-green-400 mt-1">
                                ✓ Links to: {company.name}
                              </div>
                            )}
                            {!company && (
                              <div className="text-xs text-red-400 mt-1">
                                ⚠ Company not found!
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">No company</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          
        </div>

        {/* Companies Table */}
        <div className="mb-8 bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🏢</span> Companies Table ({companies.length})
          </h2>
          {errors.companies && (
            <div className="mb-4 bg-red-900 border border-red-700 rounded p-4">
              <div className="text-red-200 text-sm">
                <strong>Error fetching companies:</strong> {errors.companies}
              </div>
              <div className="text-red-300 text-xs mt-2">
                This is likely a Row Level Security (RLS) policy issue. Check Supabase dashboard.
              </div>
            </div>
          )}
          {!errors.companies && companies.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              No companies in database (or RLS blocking access)
            </div>
          )}
          {!errors.companies && companies.length > 0 && (
            <div className="space-y-4">
              {companies.map((company) => {
                const owners = getOwnersForCompany(company.id)

                return (
                  <div
                    key={company.id}
                    className="p-4 rounded-lg border border-gray-700 bg-gray-800"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Company ID (UUID)</div>
                        <div className="font-mono text-xs bg-gray-900 px-2 py-1 rounded text-purple-400 break-all">
                          {company.id}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Company Name / Code</div>
                        <div className="text-sm text-white font-semibold">{company.name}</div>
                        <div className="text-xs mt-1">
                          <span className="bg-blue-600 text-white px-2 py-1 rounded font-mono">
                            {company.company_code}
                          </span>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="text-xs text-gray-500 mb-2">Owners ({owners.length})</div>
                        {owners.length === 0 ? (
                          <div className="text-xs text-red-400">⚠ No owners found!</div>
                        ) : (
                          <div className="space-y-2">
                            {owners.map((owner) => (
                              <div key={owner.id} className="bg-gray-900 p-2 rounded">
                                <div className="flex items-center justify-between">
                                  <div>
                                    {owner.profile ? (
                                      <>
                                        <div className="text-sm text-white">{owner.profile.full_name}</div>
                                        <div className="font-mono text-xs text-blue-400">{owner.profile_id}</div>
                                      </>
                                    ) : (
                                      <div className="text-xs text-red-400">⚠ Profile not found: {owner.profile_id}</div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    {owner.is_primary_owner && (
                                      <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs font-semibold">
                                        PRIMARY
                                      </span>
                                    )}
                                    {owner.ownership_percentage && (
                                      <span className="bg-gray-700 text-white px-2 py-1 rounded text-xs">
                                        {owner.ownership_percentage}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Relationship Summary */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🔗</span> UUID Relationship Map
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded">
              <div className="text-sm text-gray-300 mb-2">
                <strong>Current User Auth ID:</strong>
              </div>
              <div className="font-mono text-xs bg-gray-900 px-3 py-2 rounded text-blue-400 mb-3">
                {user?.id || 'Not logged in'}
              </div>

              {user && (
                <>
                  <div className="text-sm text-gray-300 mb-2">
                    <strong>Matching Profile:</strong>
                  </div>
                  {profiles.find(p => p.id === user.id) ? (
                    <div className="text-green-400 text-sm">
                      ✓ Profile exists for current user
                    </div>
                  ) : (
                    <div className="text-red-400 text-sm">
                      ✗ No profile found for current user - needs onboarding
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="bg-gray-800 p-4 rounded">
              <div className="text-sm text-gray-300 mb-2">
                <strong>Database Integrity:</strong>
              </div>
              <ul className="space-y-1 text-sm">
                <li className={profiles.length > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {profiles.length > 0 ? '✓' : '⚠'} {profiles.length} profile(s) in database
                </li>
                <li className={companies.length > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {companies.length > 0 ? '✓' : '⚠'} {companies.length} company(ies) in database
                </li>
                <li className={companyOwners.length > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {companyOwners.length > 0 ? '✓' : '⚠'} {companyOwners.length} ownership record(s) in database
                </li>
                <li
                  className={
                    companies.every(c => getOwnersForCompany(c.id).length > 0)
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {companies.every(c => getOwnersForCompany(c.id).length > 0)
                    ? '✓'
                    : '✗'}{' '}
                  All companies have at least one owner
                </li>
                <li
                  className={
                    profiles
                      .filter(p => p.company_id)
                      .every(p => companies.find(c => c.id === p.company_id))
                      ? 'text-green-400'
                      : 'text-red-400'
                  }
                >
                  {profiles
                    .filter(p => p.company_id)
                    .every(p => companies.find(c => c.id === p.company_id))
                    ? '✓'
                    : '✗'}{' '}
                  All profiles link to valid companies
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => window.location.href = '/debug-auth'}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            Auth Debug
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  )
}
