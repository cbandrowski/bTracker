'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Step = 'profile' | 'company-choice' | 'create-company' | 'join-company'

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('profile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Profile form data
  const [profileData, setProfileData] = useState({
    full_name: '',
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

  // Join company data
  const [companyCode, setCompanyCode] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0])

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
          ...profileData,
        })

      if (profileError) throw profileError

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

      // Create employee relationship
      const { error: employeeError } = await supabase
        .from('company_employees')
        .insert({
          company_id: company.id,
          profile_id: userId!,
          hire_date: hireDate,
          job_title: jobTitle || null,
          department: department || null,
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={profileData.full_name}
                    onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    value={companyData.address}
                    onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

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
                  <label className="block text-sm font-medium text-gray-700">Company Code *</label>
                  <input
                    type="text"
                    required
                    value={companyCode}
                    onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                    placeholder="Enter the code provided by your employer"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Hire Date</label>
                  <input
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 border"
                  />
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
                  {loading ? 'Joining...' : 'Join Company'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
