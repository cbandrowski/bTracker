'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { User, Building2, Users, Sparkles, Shield } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-slate-900 to-orange-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        <Sparkles className="absolute top-40 left-40 h-6 w-6 text-amber-400/30" />
        <Sparkles className="absolute bottom-40 right-40 h-4 w-4 text-orange-400/30" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mb-2">
            Establish Your Guild
          </h1>
          <p className="text-amber-200 text-lg">
            Let's forge your legend together
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md shadow-2xl rounded-xl border border-amber-500/30 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Profile Step */}
          {currentStep === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="h-6 w-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white">Tell us about yourself</h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">First Name *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                      placeholder="Your first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">Last Name *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                      placeholder="Your last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    placeholder="(555) 123-4567"
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
                  <label className="block text-sm font-medium text-amber-200 mb-2">Address Line 2</label>
                  <input
                    type="text"
                    value={profileData.address_line_2}
                    onChange={(e) => setProfileData({ ...profileData, address_line_2: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    placeholder="Apt, suite, etc."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">City</label>
                    <input
                      type="text"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">State</label>
                    <input
                      type="text"
                      value={profileData.state}
                      onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">Zipcode</label>
                    <input
                      type="text"
                      value={profileData.zipcode}
                      onChange={(e) => setProfileData({ ...profileData, zipcode: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/30"
              >
                {loading ? 'Saving...' : 'Continue Your Journey'}
              </button>
            </form>
          )}

          {/* Company Choice Step */}
          {currentStep === 'company-choice' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-white text-center mb-8">Choose Your Path</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => handleCompanyChoice('create')}
                  className="group p-8 border-2 border-amber-500/30 rounded-xl hover:border-amber-500 hover:bg-amber-500/10 transition-all backdrop-blur-sm"
                >
                  <Building2 className="h-12 w-12 text-amber-400 mb-4 mx-auto" />
                  <h3 className="font-bold text-xl mb-3 text-white">Forge a Guild</h3>
                  <p className="text-sm text-amber-200">Establish your own guild and recruit champions to your cause</p>
                </button>

                <button
                  onClick={() => handleCompanyChoice('join')}
                  className="group p-8 border-2 border-amber-500/30 rounded-xl hover:border-amber-500 hover:bg-amber-500/10 transition-all backdrop-blur-sm"
                >
                  <Users className="h-12 w-12 text-amber-400 mb-4 mx-auto" />
                  <h3 className="font-bold text-xl mb-3 text-white">Join a Guild</h3>
                  <p className="text-sm text-amber-200">Use an ancient code to join an existing guild as a warrior</p>
                </button>
              </div>
            </div>
          )}

          {/* Create Company Step */}
          {currentStep === 'create-company' && (
            <form onSubmit={handleCreateCompany} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="h-6 w-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white">Forge Your Guild</h2>
              </div>

              {/* Checkbox to use profile data */}
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4 backdrop-blur-sm">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProfileData}
                    onChange={(e) => handleUseProfileDataToggle(e.target.checked)}
                    className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-amber-300 rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-amber-100">Use my profile information for guild</span>
                    <p className="text-xs text-amber-200/80 mt-1">
                      Perfect for mobile guilds or home-based operations. Auto-fills your guild contact details.
                    </p>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Guild Name *</label>
                  <input
                    type="text"
                    required
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    placeholder="The Golden Dragon Company"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Guild Phone</label>
                  <input
                    type="tel"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Guild Email</label>
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Website</label>
                  <input
                    type="url"
                    value={companyData.website}
                    onChange={(e) => setCompanyData({ ...companyData, website: e.target.value })}
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                  />
                </div>

                <AddressAutocomplete
                  label="Guild Address"
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
                  placeholder="Start typing guild address..."
                />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">City</label>
                    <input
                      type="text"
                      value={companyData.city}
                      onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">State</label>
                    <input
                      type="text"
                      value={companyData.state}
                      onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-amber-200 mb-2">Zipcode</label>
                    <input
                      type="text"
                      value={companyData.zipcode}
                      onChange={(e) => setCompanyData({ ...companyData, zipcode: e.target.value })}
                      className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 backdrop-blur-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('company-choice')}
                  className="flex-1 py-3 px-4 border-2 border-amber-500/30 rounded-lg shadow-sm text-sm font-medium text-amber-200 bg-slate-900/50 hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 backdrop-blur-sm transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/30"
                >
                  {loading ? 'Forging Guild...' : 'Forge Guild'}
                </button>
              </div>
            </form>
          )}

          {/* Join Company Step */}
          {currentStep === 'join-company' && (
            <form onSubmit={handleJoinCompany} className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-6 w-6 text-amber-400" />
                <h2 className="text-2xl font-semibold text-white">Join a Guild</h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-amber-200 mb-2">Guild Code (Optional)</label>
                  <input
                    type="text"
                    value={companyCode}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase()
                      setCompanyCode(code)
                      lookupCompany(code)
                    }}
                    placeholder="Enter the ancient code from your guild master"
                    className="block w-full rounded-lg border border-amber-500/30 shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500 px-4 py-3 bg-slate-900/50 text-white placeholder-amber-400/50 uppercase font-mono backdrop-blur-sm"
                  />
                  <p className="mt-2 text-sm text-amber-200/80">
                    Leave blank to skip and join a guild later
                  </p>

                  {matchedCompanyName && (
                    <div className="mt-3 p-4 bg-green-900/50 border border-green-500/50 rounded-lg backdrop-blur-sm">
                      <p className="text-sm text-green-200">
                        <strong>Guild found:</strong> {matchedCompanyName}
                      </p>
                    </div>
                  )}

                  {companyCode && !matchedCompanyName && companyCode.length >= 3 && (
                    <div className="mt-3 p-4 bg-yellow-900/50 border border-yellow-500/50 rounded-lg backdrop-blur-sm">
                      <p className="text-sm text-yellow-200">
                        No guild found with this code. Please verify or leave blank to skip.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-amber-900/30 border border-amber-500/30 rounded-lg backdrop-blur-sm">
                  <p className="text-sm text-amber-100">
                    <strong>Note:</strong> Your enlistment date will be set to today ({new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). Your rank and division can be assigned by your guild master later.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep('company-choice')}
                  className="flex-1 py-3 px-4 border-2 border-amber-500/30 rounded-lg shadow-sm text-sm font-medium text-amber-200 bg-slate-900/50 hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 backdrop-blur-sm transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/30"
                >
                  {loading ? (companyCode ? 'Joining Guild...' : 'Continuing...') : (companyCode ? 'Join Guild' : 'Skip for Now')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
