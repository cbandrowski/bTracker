'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type Step = 'profile' | 'company-choice' | 'create-company' | 'join-company'

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('profile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Profile form data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileData, setProfileData] = useState({
    phone: '',
    email: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
  })

  // Saved profile data (after form submission)
  const [savedProfileData, setSavedProfileData] = useState({
    phone: '',
    email: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
  })

  // Company form data
  const [companyData, setCompanyData] = useState({
    name: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'USA',
    phone: '',
    email: '',
    website: '',
  })

  // Use profile data for company checkbox
  const [useProfileData, setUseProfileData] = useState(false)

  // Join company data
  const [companyCode, setCompanyCode] = useState('')
  const [matchedCompanyName, setMatchedCompanyName] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      // Pre-fill email from auth
      if (session.user.email) {
        setProfileData(prev => ({ ...prev, email: session.user.email! }))
      }

      // Check if profile already exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (profile) {
        // Profile exists, check if they're part of a company
        const { data: ownership } = await supabase
          .from('company_owners')
          .select('company_id')
          .eq('profile_id', session.user.id)
          .maybeSingle()

        const { data: employment } = await supabase
          .from('company_employees')
          .select('company_id')
          .eq('profile_id', session.user.id)
          .maybeSingle()

        if (ownership || employment) {
          // Already has company, go to dashboard
          router.push('/dashboard')
        } else {
          // Has profile but no company, skip to company choice
          setCurrentStep('company-choice')
        }
      }
    }

    checkAuth()
  }, [router])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Verify user is authenticated before creating profile
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('🔐 Create Profile: Auth check', {
        user: !!user,
        userId: user?.id,
        userError: userError?.message
      })

      if (userError || !user) {
        console.error('❌ Create Profile: User not authenticated', userError)
        setError('Authentication required. Please log in again.')
        router.push('/login')
        return
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId!,
          full_name: `${firstName} ${lastName}`.trim(),
          ...profileData,
        })

      if (profileError) throw profileError

      // Save the profile data for later use when creating company
      setSavedProfileData(profileData)

      setCurrentStep('company-choice')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCompanyChoice = (choice: 'create' | 'join') => {
    if (choice === 'create') {
      setCurrentStep('create-company')
    } else {
      setCurrentStep('join-company')
    }
  }

  const generateCompanyCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Verify user is authenticated before creating company
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('🔐 Create Company: Auth check', {
        user: !!user,
        userId: user?.id,
        userError: userError?.message
      })

      if (userError || !user) {
        console.error('❌ Create Company: User not authenticated', userError)
        setError('Authentication required. Please log in again.')
        router.push('/login')
        return
      }

      const companyCode = generateCompanyCode()

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          ...companyData,
          company_code: companyCode,
        })
        .select()
        .single()

      if (companyError) throw companyError

      // Create ownership relationship
      const { error: ownerError } = await supabase
        .from('company_owners')
        .insert({
          company_id: company.id,
          profile_id: userId!,
          is_primary_owner: true,
          ownership_percentage: 100,
        })

      if (ownerError) throw ownerError

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUseProfileDataToggle = (checked: boolean) => {
    setUseProfileData(checked)

    if (checked) {
      // Copy saved profile data to company data
      setCompanyData({
        ...companyData,
        address: savedProfileData.address,
        address_line_2: savedProfileData.address_line_2,
        city: savedProfileData.city,
        state: savedProfileData.state,
        zipcode: savedProfileData.zipcode,
        country: savedProfileData.country,
        phone: savedProfileData.phone,
        email: savedProfileData.email,
      })
    } else {
      // Clear the copied fields (but keep company name and website)
      setCompanyData({
        ...companyData,
        address: '',
        address_line_2: '',
        city: '',
        state: '',
        zipcode: '',
        country: 'USA',
        phone: '',
        email: '',
      })
    }
  }

  const lookupCompany = async (code: string) => {
    if (!code || code.length < 3) {
      setMatchedCompanyName(null)
      return
    }

    try {
      const { data: company, error } = await supabase
        .from('companies')
        .select('name')
        .eq('company_code', code.toUpperCase())
        .maybeSingle()

      if (error) {
        console.error('Error looking up company:', error)
        setMatchedCompanyName(null)
        return
      }

      if (company) {
        setMatchedCompanyName(company.name)
      } else {
        setMatchedCompanyName(null)
      }
    } catch (err) {
      console.error('Error looking up company:', err)
      setMatchedCompanyName(null)
    }
  }

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Verify user is authenticated before joining company
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('🔐 Join Company: Auth check', {
        user: !!user,
        userId: user?.id,
        userError: userError?.message
      })

      if (userError || !user) {
        console.error('❌ Join Company: User not authenticated', userError)
        setError('Authentication required. Please log in again.')
        router.push('/login')
        return
      }

      // If company code is empty, skip and go to dashboard
      if (!companyCode.trim()) {
        router.push('/dashboard')
        return
      }

      // Find company by code
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', companyCode.toUpperCase())
        .maybeSingle()

      if (companyError) throw companyError
      if (!company) {
        setError('Invalid company code')
        setLoading(false)
        return
      }

      // Create employee relationship with today's date as hire date
      const { error: employeeError } = await supabase
        .from('company_employees')
        .insert({
          company_id: company.id,
          profile_id: userId!,
          hire_date: new Date().toISOString().split('T')[0],
          job_title: null,
          department: null,
          employment_status: 'active',
          is_manager: false,
        })

      if (employeeError) throw employeeError

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome! Let's get you set up</h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Profile Step */}
          {currentStep === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Tell us about yourself</h2>

              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <AddressAutocomplete
                  label="Address"
                  value={profileData.address}
                  onChange={(value) => setProfileData({ ...profileData, address: value })}
                  onPlaceSelected={(components) => {
                    setProfileData({
                      ...profileData,
                      address: components.address,
                      city: components.city,
                      state: components.state,
                      zipcode: components.zipcode,
                      country: components.country,
                    })
                  }}
                  placeholder="Start typing your address..."
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
                  <input
                    type="text"
                    value={profileData.address_line_2}
                    onChange={(e) => setProfileData({ ...profileData, address_line_2: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input
                      type="text"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State</label>
                    <input
                      type="text"
                      value={profileData.state}
                      onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Zipcode</label>
                    <input
                      type="text"
                      value={profileData.zipcode}
                      onChange={(e) => setProfileData({ ...profileData, zipcode: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </form>
          )}

          {/* Company Choice Step */}
          {currentStep === 'company-choice' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">What would you like to do?</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleCompanyChoice('create')}
                  className="p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-4xl mb-2">🏢</div>
                  <h3 className="font-semibold text-lg mb-2">Create a Company</h3>
                  <p className="text-sm text-gray-600">Start your own company and invite team members</p>
                </button>

                <button
                  onClick={() => handleCompanyChoice('join')}
                  className="p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-4xl mb-2">👥</div>
                  <h3 className="font-semibold text-lg mb-2">Join a Company</h3>
                  <p className="text-sm text-gray-600">Use a company code to join an existing company</p>
                </button>
              </div>
            </div>
          )}

          {/* Create Company Step */}
          {currentStep === 'create-company' && (
            <form onSubmit={handleCreateCompany} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Create Your Company</h2>

              {/* Checkbox to use profile data */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProfileData}
                    onChange={(e) => handleUseProfileDataToggle(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Use my profile information for company</span>
                    <p className="text-xs text-gray-600 mt-1">
                      Perfect for mobile businesses or home-based companies. This will auto-fill your company contact details with your personal information.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Phone</label>
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Email</label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Website</label>
                  <input
                    type="url"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <AddressAutocomplete
                  label="Address"
                  value={companyData.address}
                  onChange={(value) => setCompanyData({ ...companyData, address: value })}
                  onPlaceSelected={(components) => {
                    setCompanyData({
                      ...companyData,
                      address: components.address,
                      city: components.city,
                      state: components.state,
                      zipcode: components.zipcode,
                      country: components.country,
                    })
                  }}
                  placeholder="Start typing company address..."
                />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input
                      type="text"
                      value={companyData.city}
                      onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State</label>
                    <input
                      type="text"
                      value={companyData.state}
                      onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Zipcode</label>
                    <input
                      type="text"
                      value={companyData.zipcode}
                      onChange={(e) => setCompanyData({ ...companyData, zipcode: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('company-choice')}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          )}

          {/* Join Company Step */}
          {currentStep === 'join-company' && (
            <form onSubmit={handleJoinCompany} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Join a Company</h2>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Code (Optional)</label>
                  <input
                    type="text"
                    value={companyCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase()
                      setCompanyCode(code)
                      lookupCompany(code)
                    }}
                    placeholder="Enter the code provided by your employer"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border uppercase font-mono"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave blank to skip this step and add company information later
                  </p>

                  {matchedCompanyName && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800">
                        <strong>Company found:</strong> {matchedCompanyName}
                      </p>
                    </div>
                  )}

                  {companyCode && !matchedCompanyName && companyCode.length >= 3 && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-sm text-yellow-800">
                        No company found with this code. Please check the code or leave blank to skip.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Your start date will automatically be set to today ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). Job title and department can be assigned by your employer later.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('company-choice')}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (companyCode ? 'Joining...' : 'Continuing...') : (companyCode ? 'Join Company' : 'Skip for Now')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
