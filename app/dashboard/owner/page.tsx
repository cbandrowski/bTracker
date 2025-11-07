'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Company } from '@/types/database'

const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return 'N/A'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export default function OwnerDashboardPage() {
  const { user, profile, loading, hasProfile } = useAuth()
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    console.log('Owner Dashboard: Auth state check', {
      loading,
      user: !!user,
      userId: user?.id,
      hasProfile,
      profile: !!profile,
      profileId: profile?.id,
    })

    if (!loading) {
      if (!user) {
        console.log('Owner Dashboard: No user, redirecting to login')
        router.push('/login')
      } else if (!profile) {
        console.log('Owner Dashboard: No profile, redirecting to onboarding')
        router.push('/onboarding')
      }
    }
  }, [user, loading, profile, router, hasProfile])

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        const {
          data: { user: authUser },
          error: userError,
        } = await supabase.auth.getUser()

        console.log('Owner Dashboard: Auth check', {
          authUser: !!authUser,
          userId: authUser?.id,
          userError: userError?.message
        })

        if (userError || !authUser) {
          console.error('Owner Dashboard: User not authenticated', userError)
          router.push('/login')
          return
        }

        // Check if user is an owner
        const { data: ownerData } = await supabase
          .from('company_owners')
          .select('company_id, companies(*)')
          .eq('profile_id', profile.id)

        // If not an owner, redirect to employee dashboard
        if (!ownerData || ownerData.length === 0) {
          console.log('Owner Dashboard: User is not an owner, redirecting to employee dashboard')
          router.push('/dashboard/employee')
          return
        }

        const ownedCompanies = ownerData?.map(o => o.companies as unknown as Company) || []
        setCompanies(ownedCompanies.filter(Boolean) as Company[])
      } catch (error) {
        console.error('Error fetching company data:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchCompanyData()
    }
  }, [profile, router])

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  if (!user || !profile) {
    return null
  }

  return (
    <div className="space-y-6">
          {/* User Profile Info */}
          <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold text-white mb-4">Your Profile</h2>

            {user.user_metadata?.avatar_url && (
              <div className="mb-4 flex justify-center">
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="h-24 w-24 rounded-full"
                />
              </div>
            )}

            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-400">Name</dt>
                <dd className="mt-1 text-sm text-white">{profile.full_name || 'Not provided'}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-400">Email</dt>
                <dd className="mt-1 text-sm text-white">{user.email}</dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-400">Phone</dt>
                <dd className="mt-1 text-sm text-white">{formatPhoneNumber(profile.phone)}</dd>
              </div>

              {profile.address && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Address</dt>
                  <dd className="mt-1 text-sm text-white">
                    {profile.address}
                    {profile.address_line_2 && <><br />{profile.address_line_2}</>}
                    {profile.city && profile.state && (
                      <>
                        <br />
                        {profile.city}, {profile.state} {profile.zipcode}
                      </>
                    )}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-400">Role</dt>
                <dd className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                    Business Owner
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Company Info */}
          {companies.length > 0 ? (
            <>
              {companies.map((company) => (
                <div key={company.id} className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">Company Information</h2>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-400">Company Name</dt>
                      <dd className="mt-1 text-sm text-white font-semibold">{company.name}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-gray-400">Company Code</dt>
                      <dd className="mt-1">
                        <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono font-semibold bg-blue-600 text-white">
                          {company.company_code}
                        </span>
                      </dd>
                    </div>

                    {company.phone && (
                      <div>
                        <dt className="text-sm font-medium text-gray-400">Phone</dt>
                        <dd className="mt-1 text-sm text-white">{formatPhoneNumber(company.phone)}</dd>
                      </div>
                    )}

                    {company.email && (
                      <div>
                        <dt className="text-sm font-medium text-gray-400">Email</dt>
                        <dd className="mt-1 text-sm text-white">{company.email}</dd>
                      </div>
                    )}

                    {company.website && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-400">Website</dt>
                        <dd className="mt-1 text-sm text-white">
                          <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            {company.website}
                          </a>
                        </dd>
                      </div>
                    )}

                    {company.address && (
                      <div className="sm:col-span-2">
                        <dt className="text-sm font-medium text-gray-400">Address</dt>
                        <dd className="mt-1 text-sm text-white">
                          {company.address}
                          {company.address_line_2 && <><br />{company.address_line_2}</>}
                          {company.city && company.state && (
                            <>
                              <br />
                              {company.city}, {company.state} {company.zipcode}
                            </>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-6 p-4 bg-blue-900 rounded-md border border-blue-700">
                    <p className="text-sm text-blue-100">
                      <strong>Share your company code:</strong> Give the code <strong>{company.company_code}</strong> to your employees so they can join your company.
                    </p>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
              <p className="text-gray-400">No company information available</p>
              <p className="text-gray-500 text-sm mt-2">
                It looks like you haven't created a company yet.
              </p>
              <button
                onClick={() => router.push('/onboarding')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Company
              </button>
            </div>
          )}
    </div>
  )
}
