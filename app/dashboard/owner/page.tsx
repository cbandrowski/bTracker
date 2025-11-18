'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Company } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, Building2, User, Loader2, Save, Edit2 } from 'lucide-react'

interface Accountant {
  id?: string
  company_id?: string
  accountant_name: string
  accountant_email: string
  accountant_phone: string
  accountant_address: string
  accountant_address_line_2: string
  accountant_city: string
  accountant_state: string
  accountant_zipcode: string
  accountant_country: string
}

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
  const [editMode, setEditMode] = useState(false)
  const [accountantEditMode, setAccountantEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingAccountant, setSavingAccountant] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [companyData, setCompanyData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    address_line_2: '',
    city: '',
    state: '',
    zipcode: '',
    logo_url: null as string | null,
    show_address_on_invoice: true,
  })

  const [accountant, setAccountant] = useState<Accountant>({
    accountant_name: '',
    accountant_email: '',
    accountant_phone: '',
    accountant_address: '',
    accountant_address_line_2: '',
    accountant_city: '',
    accountant_state: '',
    accountant_zipcode: '',
    accountant_country: 'USA',
  })

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

        // Fetch accountant data if we have companies
        if (ownedCompanies.length > 0) {
          try {
            const response = await fetch('/api/accountant')
            if (response.ok) {
              const data = await response.json()

              if (data.company) {
                console.log('Company logo_url from API:', data.company.logo_url)
                setCompanyData({
                  name: data.company.name || '',
                  email: data.company.email || '',
                  phone: data.company.phone || '',
                  address: data.company.address || '',
                  address_line_2: data.company.address_line_2 || '',
                  city: data.company.city || '',
                  state: data.company.state || '',
                  zipcode: data.company.zipcode || '',
                  logo_url: data.company.logo_url || null,
                  show_address_on_invoice: data.company.show_address_on_invoice ?? true,
                })
              }

              if (data.accountant) {
                setAccountant(data.accountant)
              }
            }
          } catch (err) {
            console.error('Error fetching accountant data:', err)
          }
        }
      } catch (error) {
        console.error('Error fetching company data:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchCompanyData()
    }
  }, [profile, router])

  const handleCompanyChange = (field: keyof typeof companyData, value: string | boolean) => {
    setCompanyData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAccountantChange = (field: keyof Accountant, value: string) => {
    setAccountant((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/accountant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: {
            name: companyData.name,
            email: companyData.email,
            phone: companyData.phone,
            address: companyData.address,
            address_line_2: companyData.address_line_2,
            city: companyData.city,
            state: companyData.state,
            zipcode: companyData.zipcode,
            show_address_on_invoice: companyData.show_address_on_invoice,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save company')
      }

      const data = await response.json()

      if (data.company) {
        setCompanyData({
          name: data.company.name || '',
          email: data.company.email || '',
          phone: data.company.phone || '',
          address: data.company.address || '',
          address_line_2: data.company.address_line_2 || '',
          city: data.company.city || '',
          state: data.company.state || '',
          zipcode: data.company.zipcode || '',
          logo_url: data.company.logo_url || null,
          show_address_on_invoice: data.company.show_address_on_invoice ?? true,
        })
      }

      setSuccess('Company information saved successfully!')
      setEditMode(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAccountant = async () => {
    setSavingAccountant(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/accountant', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountant: {
            accountant_name: accountant.accountant_name,
            accountant_email: accountant.accountant_email,
            accountant_phone: accountant.accountant_phone,
            accountant_address: accountant.accountant_address,
            accountant_address_line_2: accountant.accountant_address_line_2,
            accountant_city: accountant.accountant_city,
            accountant_state: accountant.accountant_state,
            accountant_zipcode: accountant.accountant_zipcode,
            accountant_country: accountant.accountant_country,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save accountant')
      }

      const data = await response.json()
      if (data.accountant) {
        setAccountant(data.accountant)
      }

      setSuccess('Accountant information saved successfully!')
      setAccountantEditMode(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save accountant')
    } finally {
      setSavingAccountant(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/accountant/logo', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload logo')
      }

      const data = await response.json()

      console.log('Logo upload response:', data)
      console.log('New logo URL:', data.logo_url)

      // Add cache buster to force reload
      const urlWithCacheBuster = data.logo_url + '?t=' + Date.now()
      setCompanyData((prev) => ({ ...prev, logo_url: urlWithCacheBuster }))
      setSuccess('Logo uploaded successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setUploadingLogo(false)
    }
  }

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
      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm text-green-800 dark:text-green-300">{success}</p>
        </div>
      )}

      {/* Company Logo */}
      {companies.length > 0 && (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Logo
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Current Logo Display */}
            <div className="flex-shrink-0 space-y-2">
              {companyData.logo_url ? (
                <>
                  <div className="w-32 h-32 border-2 border-gray-600 rounded-lg bg-white flex items-center justify-center p-2">
                    <img
                      src={companyData.logo_url}
                      alt="Company Logo"
                      className="max-w-full max-h-full object-contain"
                      onLoad={() => {
                        console.log('✅ Logo loaded successfully!')
                      }}
                      onError={(e) => {
                        console.error('❌ Logo failed to load:', companyData.logo_url)
                        console.error('Image element:', e.currentTarget)
                      }}
                    />
                  </div>
                  <a
                    href={companyData.logo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline block"
                  >
                    Open logo directly
                  </a>
                </>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-gray-600 rounded-lg bg-gray-900 flex items-center justify-center">
                  <p className="text-xs text-gray-500 text-center px-2">No logo uploaded</p>
                </div>
              )}
            </div>

            {/* Upload Section */}
            <div className="flex-1">
              <Label htmlFor="logo-upload" className="text-white">
                {companyData.logo_url ? 'Update Logo' : 'Upload Logo'}
              </Label>
              <div className="mt-2">
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('logo-upload')?.click()}
                  disabled={uploadingLogo}
                  className="w-full sm:w-auto"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-1">
                  PNG, JPEG, WEBP, or SVG. Max 5MB.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company Info */}
      {companies.length > 0 ? (
        <>
          {companies.map((company) => (
            <div key={company.id} className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? (
                    <>Cancel</>
                  ) : (
                    <>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </Button>
              </div>

              {!editMode ? (
                <>
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
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company-name" className="text-white">
                        Company Name
                      </Label>
                      <Input
                        id="company-name"
                        value={companyData.name}
                        onChange={(e) => handleCompanyChange('name', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-email" className="text-white">
                        Email
                      </Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={companyData.email}
                        onChange={(e) => handleCompanyChange('email', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-phone" className="text-white">
                        Phone
                      </Label>
                      <Input
                        id="company-phone"
                        value={companyData.phone}
                        onChange={(e) => handleCompanyChange('phone', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-address" className="text-white">
                        Address
                      </Label>
                      <Input
                        id="company-address"
                        value={companyData.address}
                        onChange={(e) => handleCompanyChange('address', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-address-2" className="text-white">
                        Address Line 2
                      </Label>
                      <Input
                        id="company-address-2"
                        value={companyData.address_line_2}
                        onChange={(e) => handleCompanyChange('address_line_2', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-city" className="text-white">
                        City
                      </Label>
                      <Input
                        id="company-city"
                        value={companyData.city}
                        onChange={(e) => handleCompanyChange('city', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-state" className="text-white">
                        State
                      </Label>
                      <Input
                        id="company-state"
                        value={companyData.state}
                        onChange={(e) => handleCompanyChange('state', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="company-zipcode" className="text-white">
                        Zip Code
                      </Label>
                      <Input
                        id="company-zipcode"
                        value={companyData.zipcode}
                        onChange={(e) => handleCompanyChange('zipcode', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Invoice Settings */}
                  <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-3">Invoice Settings</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-address-on-invoice"
                        checked={companyData.show_address_on_invoice}
                        onCheckedChange={(checked) =>
                          handleCompanyChange('show_address_on_invoice', checked as boolean)
                        }
                      />
                      <Label
                        htmlFor="show-address-on-invoice"
                        className="text-sm text-gray-300 cursor-pointer"
                      >
                        Show company address on invoices
                      </Label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Accountant Information - Always Visible and Separate */}
          <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Accountant Information (Optional)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccountantEditMode(!accountantEditMode)}
              >
                {accountantEditMode ? (
                  <>Cancel</>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            </div>

            {!accountantEditMode ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accountant.accountant_name && (
                  <div>
                    <dt className="text-sm font-medium text-gray-400">Name</dt>
                    <dd className="mt-1 text-sm text-white">{accountant.accountant_name}</dd>
                  </div>
                )}

                {accountant.accountant_email && (
                  <div>
                    <dt className="text-sm font-medium text-gray-400">Email</dt>
                    <dd className="mt-1 text-sm text-white">{accountant.accountant_email}</dd>
                  </div>
                )}

                {accountant.accountant_phone && (
                  <div>
                    <dt className="text-sm font-medium text-gray-400">Phone</dt>
                    <dd className="mt-1 text-sm text-white">{formatPhoneNumber(accountant.accountant_phone)}</dd>
                  </div>
                )}

                {accountant.accountant_address && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-400">Address</dt>
                    <dd className="mt-1 text-sm text-white">
                      {accountant.accountant_address}
                      {accountant.accountant_address_line_2 && <><br />{accountant.accountant_address_line_2}</>}
                      {accountant.accountant_city && accountant.accountant_state && (
                        <>
                          <br />
                          {accountant.accountant_city}, {accountant.accountant_state} {accountant.accountant_zipcode}
                        </>
                      )}
                      {accountant.accountant_country && accountant.accountant_country !== 'USA' && (
                        <>
                          <br />
                          {accountant.accountant_country}
                        </>
                      )}
                    </dd>
                  </div>
                )}

                {!accountant.accountant_name && !accountant.accountant_email && !accountant.accountant_phone && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-gray-400 italic">No accountant information added yet. Click Edit to add.</p>
                  </div>
                )}
              </dl>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountant-name" className="text-white">
                      Accountant Name
                    </Label>
                    <Input
                      id="accountant-name"
                      value={accountant.accountant_name}
                      onChange={(e) => handleAccountantChange('accountant_name', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-email" className="text-white">
                      Email
                    </Label>
                    <Input
                      id="accountant-email"
                      type="email"
                      value={accountant.accountant_email}
                      onChange={(e) => handleAccountantChange('accountant_email', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-phone" className="text-white">
                      Phone
                    </Label>
                    <Input
                      id="accountant-phone"
                      value={accountant.accountant_phone}
                      onChange={(e) => handleAccountantChange('accountant_phone', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-address" className="text-white">
                      Address
                    </Label>
                    <Input
                      id="accountant-address"
                      value={accountant.accountant_address}
                      onChange={(e) => handleAccountantChange('accountant_address', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-address-2" className="text-white">
                      Address Line 2
                    </Label>
                    <Input
                      id="accountant-address-2"
                      value={accountant.accountant_address_line_2}
                      onChange={(e) => handleAccountantChange('accountant_address_line_2', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-city" className="text-white">
                      City
                    </Label>
                    <Input
                      id="accountant-city"
                      value={accountant.accountant_city}
                      onChange={(e) => handleAccountantChange('accountant_city', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-state" className="text-white">
                      State
                    </Label>
                    <Input
                      id="accountant-state"
                      value={accountant.accountant_state}
                      onChange={(e) => handleAccountantChange('accountant_state', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-zipcode" className="text-white">
                      Zip Code
                    </Label>
                    <Input
                      id="accountant-zipcode"
                      value={accountant.accountant_zipcode}
                      onChange={(e) => handleAccountantChange('accountant_zipcode', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="accountant-country" className="text-white">
                      Country
                    </Label>
                    <Input
                      id="accountant-country"
                      value={accountant.accountant_country}
                      onChange={(e) => handleAccountantChange('accountant_country', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Save Button for Accountant */}
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={handleSaveAccountant}
                    disabled={savingAccountant}
                    size="lg"
                  >
                    {savingAccountant ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Accountant Info
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Save Button for Company */}
          {editMode && (
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Company Info
                  </>
                )}
              </Button>
            </div>
          )}
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
