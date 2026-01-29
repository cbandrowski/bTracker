'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCompanyContext } from '@/contexts/CompanyContext'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Company, CompanyBusinessHours, EmployeeAvailability } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Upload, Building2, User, Loader2, Save, Edit2, CreditCard, X } from 'lucide-react'

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
  const { memberships, activeCompanyId, loading: contextLoading } = useCompanyContext()
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

  const [paymentPreferences, setPaymentPreferences] = useState({
    paypal_handle: '',
    zelle_phone: '',
    zelle_email: '',
    check_payable_to: '',
    accept_cash: false,
    accept_credit_debit: false,
    late_fee_enabled: false,
    late_fee_days: 30,
    late_fee_amount: 25.00,
  })

  const [paymentEditMode, setPaymentEditMode] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [applyingLateFees, setApplyingLateFees] = useState(false)

  const [ownerAvailability, setOwnerAvailability] = useState<AvailabilityRow[]>(DEFAULT_AVAILABILITY)
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[]>(DEFAULT_BUSINESS_HOURS)
  const [ownerAvailabilityLoading, setOwnerAvailabilityLoading] = useState(true)
  const [businessHoursLoading, setBusinessHoursLoading] = useState(true)
  const [savingOwnerAvailability, setSavingOwnerAvailability] = useState(false)
  const [savingBusinessHours, setSavingBusinessHours] = useState(false)
  const [ownerHoursEditMode, setOwnerHoursEditMode] = useState(false)
  const [businessHoursEditMode, setBusinessHoursEditMode] = useState(false)

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

      setLoadingData(true)
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

        const ownerCompanyIds = memberships
          .filter((membership) => membership.roles.includes('owner'))
          .map((membership) => membership.company_id)

        if (ownerCompanyIds.length === 0) {
          console.log('Owner Dashboard: User is not an owner, redirecting to employee dashboard')
          router.push('/dashboard/employee')
          return
        }

        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .in('id', ownerCompanyIds)

        if (companiesError) {
          console.error('Owner Dashboard: Failed to load companies', companiesError)
        }

        const ownedCompanies = (companiesData ?? []) as Company[]
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

                // Load payment preferences
                setPaymentPreferences({
                  paypal_handle: data.company.paypal_handle || '',
                  zelle_phone: data.company.zelle_phone || '',
                  zelle_email: data.company.zelle_email || '',
                  check_payable_to: data.company.check_payable_to || '',
                  accept_cash: data.company.accept_cash || false,
                  accept_credit_debit: data.company.accept_credit_debit || false,
                  late_fee_enabled: data.company.late_fee_enabled || false,
                  late_fee_days: data.company.late_fee_days || 30,
                  late_fee_amount: Number(data.company.late_fee_amount ?? 25),
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

    if (profile && !contextLoading) {
      fetchCompanyData()
    }
  }, [profile, memberships, activeCompanyId, contextLoading, router])

  useEffect(() => {
    const fetchOwnerAvailability = async () => {
      setOwnerAvailabilityLoading(true)

      try {
        const response = await fetch('/api/employee-availability/me')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load work hours')
        }

        setOwnerAvailability(mapAvailabilityFromServer(payload?.availability))
      } catch (err) {
        console.error('Failed to load owner work hours', err)
        setError(err instanceof Error ? err.message : 'Failed to load work hours')
      } finally {
        setOwnerAvailabilityLoading(false)
      }
    }

    const fetchBusinessHours = async () => {
      setBusinessHoursLoading(true)

      try {
        const response = await fetch('/api/company/business-hours')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load business hours')
        }

        setBusinessHours(mapBusinessHoursFromServer(payload?.hours))
      } catch (err) {
        console.error('Failed to load business hours', err)
        setError(err instanceof Error ? err.message : 'Failed to load business hours')
      } finally {
        setBusinessHoursLoading(false)
      }
    }

    if (user) {
      fetchOwnerAvailability()
      fetchBusinessHours()
    }
  }, [user])

  const ownerAvailabilityErrors = useMemo(() => {
    const errors: Record<number, string | null> = {}
    ownerAvailability.forEach((row) => {
      errors[row.day_of_week] = validateAvailabilityRow(row)
    })
    return errors
  }, [ownerAvailability])

  const businessHoursErrors = useMemo(() => {
    const errors: Record<number, string | null> = {}
    businessHours.forEach((row) => {
      errors[row.day_of_week] = validateBusinessHoursRow(row)
    })
    return errors
  }, [businessHours])

  const hasOwnerAvailabilityErrors = useMemo(
    () => Object.values(ownerAvailabilityErrors).some((value) => Boolean(value)),
    [ownerAvailabilityErrors]
  )

  const hasBusinessHoursErrors = useMemo(
    () => Object.values(businessHoursErrors).some((value) => Boolean(value)),
    [businessHoursErrors]
  )

  const handleCompanyChange = (field: keyof typeof companyData, value: string | boolean) => {
    setCompanyData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAccountantChange = (field: keyof Accountant, value: string) => {
    setAccountant((prev) => ({ ...prev, [field]: value }))
  }

  const handleToggleOwnerAvailability = (dayOfWeek: number, isAvailable: boolean) => {
    setOwnerAvailability((prev) =>
      prev.map((row) =>
        row.day_of_week === dayOfWeek
          ? {
              ...row,
              is_available: isAvailable,
              start_time: isAvailable ? row.start_time : '',
              end_time: isAvailable ? row.end_time : '',
            }
          : row
      )
    )
  }

  const handleOwnerAvailabilityTimeChange = (
    dayOfWeek: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    setOwnerAvailability((prev) =>
      prev.map((row) =>
        row.day_of_week === dayOfWeek ? { ...row, [field]: value } : row
      )
    )
  }

  const handleToggleBusinessHours = (dayOfWeek: number, isOpen: boolean) => {
    setBusinessHours((prev) =>
      prev.map((row) =>
        row.day_of_week === dayOfWeek
          ? {
              ...row,
              is_open: isOpen,
              start_time: isOpen ? row.start_time : '',
              end_time: isOpen ? row.end_time : '',
            }
          : row
      )
    )
  }

  const handleBusinessHoursTimeChange = (
    dayOfWeek: number,
    field: 'start_time' | 'end_time',
    value: string
  ) => {
    setBusinessHours((prev) =>
      prev.map((row) =>
        row.day_of_week === dayOfWeek ? { ...row, [field]: value } : row
      )
    )
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

  const handleSaveOwnerAvailability = async () => {
    if (hasOwnerAvailabilityErrors) {
      setError('Fix work hour errors before saving.')
      return
    }

    setSavingOwnerAvailability(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/employee-availability/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          ownerAvailability.map((row) => ({
            day_of_week: row.day_of_week,
            is_available: row.is_available,
            start_time: row.is_available ? row.start_time || null : null,
            end_time: row.is_available ? row.end_time || null : null,
          }))
        ),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save work hours')
      }

      setOwnerAvailability(mapAvailabilityFromServer(payload?.availability))
      setSuccess('Owner work hours saved successfully!')
      setOwnerHoursEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save work hours')
    } finally {
      setSavingOwnerAvailability(false)
    }
  }

  const handleSaveBusinessHours = async () => {
    if (hasBusinessHoursErrors) {
      setError('Fix business hour errors before saving.')
      return
    }

    setSavingBusinessHours(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/company/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          businessHours.map((row) => ({
            day_of_week: row.day_of_week,
            is_open: row.is_open,
            start_time: row.is_open ? row.start_time || null : null,
            end_time: row.is_open ? row.end_time || null : null,
          }))
        ),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save business hours')
      }

      setBusinessHours(mapBusinessHoursFromServer(payload?.hours))
      setSuccess('Business hours saved successfully!')
      setBusinessHoursEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business hours')
    } finally {
      setSavingBusinessHours(false)
    }
  }

  const ownerHoursSummary = ownerAvailability.filter(
    (row) => row.is_available && row.start_time && row.end_time
  )
  const businessHoursSummary = businessHours.filter(
    (row) => row.is_open && row.start_time && row.end_time
  )

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

      const response = await fetch('/api/company/logo', {
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

  const handleSavePaymentPreferences = async () => {
    setSavingPayment(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/company/payment-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPreferences),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update payment preferences')
      }

      const data = await response.json()

      // Update companies state with the new payment preferences
      if (data.company) {
        setCompanies(prev =>
          prev.map(c => c.id === data.company.id ? data.company : c)
        )

        setPaymentPreferences({
          paypal_handle: data.company.paypal_handle || '',
          zelle_phone: data.company.zelle_phone || '',
          zelle_email: data.company.zelle_email || '',
          check_payable_to: data.company.check_payable_to || '',
          accept_cash: data.company.accept_cash || false,
          accept_credit_debit: data.company.accept_credit_debit || false,
          late_fee_enabled: data.company.late_fee_enabled || false,
          late_fee_days: Number(data.company.late_fee_days ?? 30),
          late_fee_amount: Number(data.company.late_fee_amount ?? 25),
        })
      }

      setSuccess('Payment preferences updated successfully!')
      setPaymentEditMode(false)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment preferences')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleApplyLateFees = async () => {
    setApplyingLateFees(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/invoices/late-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result: {
        invoicesChecked?: number
        invoicesUpdated?: number
        feesCreated?: number
        skippedReason?: string
        error?: string
      } = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to apply late fees')
      }

      if (result.feesCreated && result.feesCreated > 0) {
        setSuccess(`Applied ${result.feesCreated} late fee lines across ${result.invoicesUpdated ?? 0} invoices.`)
      } else {
        setSuccess(result.skippedReason || 'No late fees were added.')
      }

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply late fees')
    } finally {
      setApplyingLateFees(false)
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
      <div className="glass-surface shadow-lg rounded-lg p-6">
        <h2 className="text-lg font-semibold guild-heading mb-4">Your Profile</h2>

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

      {/* Owner Work Hours */}
      <div className="glass-surface shadow-lg rounded-lg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold guild-heading">Owner Work Hours</h2>
            <p className="text-sm text-gray-400">Set the hours you work as an employee.</p>
          </div>
          {ownerHoursEditMode ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setOwnerHoursEditMode(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={ownerAvailabilityLoading || savingOwnerAvailability || hasOwnerAvailabilityErrors}
                onClick={handleSaveOwnerAvailability}
              >
                {savingOwnerAvailability ? 'Saving...' : 'Save Work Hours'}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOwnerHoursEditMode(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {ownerAvailabilityLoading ? (
          <p className="text-sm text-gray-400">Loading work hours...</p>
        ) : ownerHoursEditMode ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Working?
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    End Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {ownerAvailability.map((day) => (
                  <tr key={day.day_of_week}>
                    <td className="px-4 py-3 text-sm text-white">{day.label}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={day.is_available}
                          onChange={(event) =>
                            handleToggleOwnerAvailability(day.day_of_week, event.target.checked)
                          }
                        />
                        <span>{day.is_available ? 'Working' : 'Off'}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 disabled:opacity-50"
                        value={day.start_time}
                        onChange={(event) =>
                          handleOwnerAvailabilityTimeChange(day.day_of_week, 'start_time', event.target.value)
                        }
                        disabled={!day.is_available}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <input
                          type="time"
                          className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 disabled:opacity-50"
                          value={day.end_time}
                          onChange={(event) =>
                            handleOwnerAvailabilityTimeChange(day.day_of_week, 'end_time', event.target.value)
                          }
                          disabled={!day.is_available}
                        />
                        {ownerAvailabilityErrors[day.day_of_week] && (
                          <p className="text-xs text-red-400">{ownerAvailabilityErrors[day.day_of_week]}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : ownerHoursSummary.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No work hours set yet.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-200">
            {ownerHoursSummary.map((day) => (
              <div key={day.day_of_week} className="flex flex-wrap gap-2">
                <span className="font-medium text-white">{day.label}:</span>
                <span>
                  {formatTimeValue(day.start_time)} - {formatTimeValue(day.end_time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Business Hours */}
      <div className="glass-surface shadow-lg rounded-lg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold guild-heading">Company Business Hours</h2>
            <p className="text-sm text-gray-400">Define when your business is open.</p>
          </div>
          {businessHoursEditMode ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBusinessHoursEditMode(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={businessHoursLoading || savingBusinessHours || hasBusinessHoursErrors}
                onClick={handleSaveBusinessHours}
              >
                {savingBusinessHours ? 'Saving...' : 'Save Business Hours'}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBusinessHoursEditMode(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {businessHoursLoading ? (
          <p className="text-sm text-gray-400">Loading business hours...</p>
        ) : businessHoursEditMode ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Open?
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    End Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {businessHours.map((day) => (
                  <tr key={day.day_of_week}>
                    <td className="px-4 py-3 text-sm text-white">{day.label}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={day.is_open}
                          onChange={(event) =>
                            handleToggleBusinessHours(day.day_of_week, event.target.checked)
                          }
                        />
                        <span>{day.is_open ? 'Open' : 'Closed'}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 disabled:opacity-50"
                        value={day.start_time}
                        onChange={(event) =>
                          handleBusinessHoursTimeChange(day.day_of_week, 'start_time', event.target.value)
                        }
                        disabled={!day.is_open}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <input
                          type="time"
                          className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 disabled:opacity-50"
                          value={day.end_time}
                          onChange={(event) =>
                            handleBusinessHoursTimeChange(day.day_of_week, 'end_time', event.target.value)
                          }
                          disabled={!day.is_open}
                        />
                        {businessHoursErrors[day.day_of_week] && (
                          <p className="text-xs text-red-400">{businessHoursErrors[day.day_of_week]}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : businessHoursSummary.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No business hours set yet.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-200">
            {businessHoursSummary.map((day) => (
              <div key={day.day_of_week} className="flex flex-wrap gap-2">
                <span className="font-medium text-white">{day.label}:</span>
                <span>
                  {formatTimeValue(day.start_time)} - {formatTimeValue(day.end_time)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Company Logo */}
      {companies.length > 0 && (
        <div className="glass-surface shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold guild-heading flex items-center gap-2">
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
            <div key={company.id} className="glass-surface shadow-lg rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold guild-heading flex items-center gap-2">
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

                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-400">Invoice Settings</dt>
                      <dd className="mt-1 text-sm text-white">
                        <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                          company.show_address_on_invoice
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {company.show_address_on_invoice ? '✓ Show address on invoices' : '✗ Hide address on invoices'}
                        </span>
                      </dd>
                    </div>
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
          <div className="glass-surface shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold guild-heading flex items-center gap-2">
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

          {/* Payment Preferences Section */}
          <div className="glass-surface shadow-lg rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Payment Preferences</h2>
              </div>
              {!paymentEditMode && (
                <Button
                  onClick={() => setPaymentEditMode(true)}
                  variant="outline"
                  size="sm"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {paymentEditMode && (
                <Button
                  onClick={() => {
                    setPaymentEditMode(false)
                    const currentCompany = companies[0]
                    if (!currentCompany) return
                    setPaymentPreferences({
                      paypal_handle: currentCompany.paypal_handle || '',
                      zelle_phone: currentCompany.zelle_phone || '',
                      zelle_email: currentCompany.zelle_email || '',
                      check_payable_to: currentCompany.check_payable_to || '',
                      accept_cash: currentCompany.accept_cash || false,
                      accept_credit_debit: currentCompany.accept_credit_debit || false,
                      late_fee_enabled: currentCompany.late_fee_enabled || false,
                      late_fee_days: Number(currentCompany.late_fee_days ?? 30),
                      late_fee_amount: Number(currentCompany.late_fee_amount ?? 25),
                    })
                  }}
                  variant="ghost"
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>

            {!paymentEditMode ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">PayPal Handle</label>
                    <p className="mt-1 text-base">
                      {paymentPreferences.paypal_handle ? `@${paymentPreferences.paypal_handle}` : <span className="text-muted-foreground">Not set</span>}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Zelle Phone</label>
                    <p className="mt-1 text-base">
                      {paymentPreferences.zelle_phone || <span className="text-muted-foreground">Not set</span>}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Zelle Email</label>
                    <p className="mt-1 text-base">
                      {paymentPreferences.zelle_email || <span className="text-muted-foreground">Not set</span>}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Check Payable To</label>
                    <p className="mt-1 text-base">
                      {paymentPreferences.check_payable_to || <span className="text-muted-foreground">Not set</span>}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Payment Methods Accepted</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${paymentPreferences.accept_cash ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm">Cash {paymentPreferences.accept_cash ? '✓' : '✗'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${paymentPreferences.accept_credit_debit ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm">Credit/Debit Cards {paymentPreferences.accept_credit_debit ? '✓' : '✗'}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Late Fee Policy</h4>
                  {paymentPreferences.late_fee_enabled ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Late fees start the day after the invoice due date. An additional <strong className="text-foreground">${paymentPreferences.late_fee_amount.toFixed(2)}</strong> is applied every <strong className="text-foreground">{paymentPreferences.late_fee_days} days</strong> after the due date until paid.
                      </p>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyLateFees}
                          disabled={applyingLateFees}
                        >
                          {applyingLateFees ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Applying late fees...
                            </>
                          ) : (
                            'Apply late fees to overdue invoices'
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No late fee policy configured</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paypal_handle">PayPal Handle</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">@</span>
                      <Input
                        id="paypal_handle"
                        placeholder="username"
                        value={paymentPreferences.paypal_handle}
                        onChange={(e) => setPaymentPreferences(prev => ({ ...prev, paypal_handle: e.target.value }))}
                        className="mt-1 flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Enter without @ symbol</p>
                  </div>

                  <div>
                    <Label htmlFor="zelle_phone">Zelle Phone</Label>
                    <Input
                      id="zelle_phone"
                      placeholder="(555) 123-4567"
                      value={paymentPreferences.zelle_phone}
                      onChange={(e) => setPaymentPreferences(prev => ({ ...prev, zelle_phone: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="zelle_email">Zelle Email</Label>
                    <Input
                      id="zelle_email"
                      type="email"
                      placeholder="email@example.com"
                      value={paymentPreferences.zelle_email}
                      onChange={(e) => setPaymentPreferences(prev => ({ ...prev, zelle_email: e.target.value }))}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="check_payable_to">Check Payable To</Label>
                    <Input
                      id="check_payable_to"
                      placeholder="Company Name"
                      value={paymentPreferences.check_payable_to}
                      onChange={(e) => setPaymentPreferences(prev => ({ ...prev, check_payable_to: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Payment Methods Accepted */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-semibold mb-4">Payment Methods Accepted</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="accept_cash">Accept Cash</Label>
                        <p className="text-xs text-muted-foreground">Show cash as accepted payment method on invoices</p>
                      </div>
                      <Switch
                        id="accept_cash"
                        checked={paymentPreferences.accept_cash}
                        onCheckedChange={(checked: boolean) => setPaymentPreferences(prev => ({ ...prev, accept_cash: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="accept_credit_debit">Accept Credit/Debit Cards</Label>
                        <p className="text-xs text-muted-foreground">Show credit/debit cards as accepted payment method on invoices</p>
                      </div>
                      <Switch
                        id="accept_credit_debit"
                        checked={paymentPreferences.accept_credit_debit}
                        onCheckedChange={(checked: boolean) => setPaymentPreferences(prev => ({ ...prev, accept_credit_debit: checked }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Late Fee Policy */}
                <div className="border-t pt-6">
                  <h4 className="text-sm font-semibold mb-4">Late Fee Policy</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="late_fee_enabled">Enable Late Fees</Label>
                        <p className="text-xs text-muted-foreground">Apply late fees to overdue invoices</p>
                      </div>
                      <Switch
                        id="late_fee_enabled"
                        checked={paymentPreferences.late_fee_enabled}
                        onCheckedChange={(checked: boolean) => setPaymentPreferences(prev => ({ ...prev, late_fee_enabled: checked }))}
                      />
                    </div>

                    {paymentPreferences.late_fee_enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-purple-500/30">
                        <div>
                          <Label htmlFor="late_fee_days">Late Fee Cadence (days after due date)</Label>
                          <Input
                            id="late_fee_days"
                            type="number"
                            min="1"
                            placeholder="30"
                            value={paymentPreferences.late_fee_days}
                            onChange={(e) => setPaymentPreferences(prev => ({ ...prev, late_fee_days: parseInt(e.target.value) || 30 }))}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">How often to apply the late fee after the invoice due date.</p>
                        </div>

                        <div>
                          <Label htmlFor="late_fee_amount">Late Fee Amount</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">$</span>
                            <Input
                              id="late_fee_amount"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="25.00"
                              value={paymentPreferences.late_fee_amount}
                              onChange={(e) => setPaymentPreferences(prev => ({ ...prev, late_fee_amount: parseFloat(e.target.value) || 0 }))}
                              className="mt-1 flex-1"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Fee charged on each cadence after the due date.</p>
                        </div>

                        {/* Live Preview */}
                        <div className="md:col-span-2 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                          <p className="text-xs font-semibold text-purple-300 mb-2">Preview on Invoice:</p>
                          <p className="text-sm text-purple-100">
                            Late fees start the day after the invoice due date. An additional <strong>${paymentPreferences.late_fee_amount.toFixed(2)}</strong> is applied every <strong>{paymentPreferences.late_fee_days} days</strong> after the due date until paid.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button for Payment Preferences */}
                <div className="flex justify-end mt-6">
                  <Button
                    onClick={handleSavePaymentPreferences}
                    disabled={savingPayment}
                    size="lg"
                  >
                    {savingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Payment Preferences
                      </>
                    )}
                  </Button>
                </div>
              </div>
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
        <div className="glass-surface shadow-lg rounded-lg p-6">
          <p className="text-muted-foreground">No company information available</p>
          <p className="text-muted-foreground text-sm mt-2">
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

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

type AvailabilityRow = {
  day_of_week: (typeof DAYS_OF_WEEK)[number]['value']
  label: string
  is_available: boolean
  start_time: string
  end_time: string
}

type BusinessHoursRow = {
  day_of_week: (typeof DAYS_OF_WEEK)[number]['value']
  label: string
  is_open: boolean
  start_time: string
  end_time: string
}

const DEFAULT_AVAILABILITY: AvailabilityRow[] = DAYS_OF_WEEK.map((day) => ({
  day_of_week: day.value,
  label: day.label,
  is_available: false,
  start_time: '',
  end_time: '',
}))

const DEFAULT_BUSINESS_HOURS: BusinessHoursRow[] = DAYS_OF_WEEK.map((day) => ({
  day_of_week: day.value,
  label: day.label,
  is_open: false,
  start_time: '',
  end_time: '',
}))

function mapAvailabilityFromServer(records?: EmployeeAvailability[]): AvailabilityRow[] {
  return DAYS_OF_WEEK.map((day) => {
    const record = records?.find((entry) => entry.day_of_week === day.value)
    return {
      day_of_week: day.value,
      label: day.label,
      is_available: record?.is_available ?? false,
      start_time: record?.start_time ? record.start_time.slice(0, 5) : '',
      end_time: record?.end_time ? record.end_time.slice(0, 5) : '',
    }
  })
}

function mapBusinessHoursFromServer(records?: CompanyBusinessHours[]): BusinessHoursRow[] {
  return DAYS_OF_WEEK.map((day) => {
    const record = records?.find((entry) => entry.day_of_week === day.value)
    return {
      day_of_week: day.value,
      label: day.label,
      is_open: record?.is_open ?? false,
      start_time: record?.start_time ? record.start_time.slice(0, 5) : '',
      end_time: record?.end_time ? record.end_time.slice(0, 5) : '',
    }
  })
}

function validateAvailabilityRow(row: AvailabilityRow): string | null {
  if (!row.is_available) {
    return null
  }

  if (!row.start_time || !row.end_time) {
    return 'Start and end times are required'
  }

  if (row.start_time >= row.end_time) {
    return 'Start time must be earlier than end time'
  }

  return null
}

function validateBusinessHoursRow(row: BusinessHoursRow): string | null {
  if (!row.is_open) {
    return null
  }

  if (!row.start_time || !row.end_time) {
    return 'Start and end times are required'
  }

  if (row.start_time >= row.end_time) {
    return 'Start time must be earlier than end time'
  }

  return null
}

function formatTimeValue(value: string) {
  if (!value) return '—'
  const [hoursStr, minutesStr] = value.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return '—'
  }
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
