'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCompanyContext } from '@/contexts/CompanyContext'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Company, CompanyEmployee, EmployeeAvailability } from '@/types/database'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import Image from 'next/image'

export default function EmployeeProfilePage() {
  const { user, profile } = useAuth()
  const { activeEmployeeId, activeCompanyId, memberships, loading: contextLoading } = useCompanyContext()
  const [company, setCompany] = useState<Company | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [employeeData, setEmployeeData] = useState<CompanyEmployee | null>(null)
  const [availability, setAvailability] = useState<AvailabilityRow[]>(DEFAULT_AVAILABILITY)
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [availabilityEditMode, setAvailabilityEditMode] = useState(false)
  const { toast } = useToast()
  const [joiningCompany, setJoiningCompany] = useState(false)
  const [companyCode, setCompanyCode] = useState('')
  const [matchedCompanyName, setMatchedCompanyName] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!activeEmployeeId || !activeCompanyId) {
        if (!contextLoading) {
          setLoadingData(false)
        }
        return
      }

      setLoadingData(true)
      try {
        const { data: employeeData } = await supabase
          .from('company_employees')
          .select('*, company_id, companies(*)')
          .eq('id', activeEmployeeId)
          .eq('company_id', activeCompanyId)
          .single()

        if (employeeData) {
          const typedEmployee = employeeData as CompanyEmployee & { companies: Company }
          setEmployeeData(typedEmployee)
          setCompany(typedEmployee.companies)
        }
      } catch (error) {
        console.error('Error fetching company data:', error)
      }

      setLoadingData(false)
    }

    if (activeEmployeeId && activeCompanyId) {
      fetchCompanyData()
    } else if (!contextLoading) {
      setLoadingData(false)
    }
  }, [activeEmployeeId, activeCompanyId, contextLoading])

  useEffect(() => {
    const fetchAvailability = async () => {
      setAvailabilityLoading(true)

      try {
        const response = await fetch('/api/employee-availability/me')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load availability')
        }

        setAvailability(mapAvailabilityFromServer(payload?.availability))
      } catch (error) {
        console.error('Failed to load availability', error)
        toast({
          title: 'Failed to load availability',
          description: error instanceof Error ? error.message : 'Please try again.',
          variant: 'destructive',
        })
      } finally {
        setAvailabilityLoading(false)
      }
    }

    if (user) {
      fetchAvailability()
    }
  }, [user, toast])

  const availabilityErrors = useMemo(() => {
    const errors: Record<number, string | null> = {}
    availability.forEach((row) => {
      errors[row.day_of_week] = validateAvailabilityRow(row)
    })
    return errors
  }, [availability])

  const hasAvailabilityErrors = useMemo(
    () => Object.values(availabilityErrors).some((error) => Boolean(error)),
    [availabilityErrors]
  )
  const availabilitySummary = useMemo(
    () => availability.filter((row) => row.is_available),
    [availability]
  )

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const handleToggleAvailability = (dayOfWeek: number, isAvailable: boolean) => {
    setAvailability((prev) =>
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

  const handleTimeChange = (dayOfWeek: number, field: 'start_time' | 'end_time', value: string) => {
    setAvailability((prev) =>
      prev.map((row) =>
        row.day_of_week === dayOfWeek ? { ...row, [field]: value } : row
      )
    )
  }

  const handleCopyMondayToWeekdays = () => {
    setAvailability((prev) => {
      const monday = prev.find((row) => row.day_of_week === 1)
      if (!monday) {
        return prev
      }

      return prev.map((row) => {
        if (row.day_of_week >= 1 && row.day_of_week <= 5) {
          return {
            ...row,
            is_available: monday.is_available,
            start_time: monday.start_time,
            end_time: monday.end_time,
          }
        }
        return row
      })
    })

    toast({
      title: 'Copied Monday availability',
      description: 'Weekday availability has been updated.',
      variant: 'success',
    })
  }

  const handleSaveAvailability = async () => {
    if (hasAvailabilityErrors) {
      toast({
        title: 'Fix availability errors',
        description: 'Please resolve validation issues before saving.',
        variant: 'destructive',
      })
      return
    }

    setSavingAvailability(true)

    try {
      const response = await fetch('/api/employee-availability/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          availability.map((row) => ({
            day_of_week: row.day_of_week,
            is_available: row.is_available,
            start_time: row.is_available ? row.start_time || null : null,
            end_time: row.is_available ? row.end_time || null : null,
          }))
        ),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save availability')
      }

      setAvailability(mapAvailabilityFromServer(payload?.availability))
      setAvailabilityEditMode(false)

      toast({
        title: 'Availability saved',
        description: 'Your weekly availability was updated.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Failed to save availability', error)
      toast({
        title: 'Failed to save availability',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSavingAvailability(false)
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
    setJoiningCompany(true)

    try {
      const response = await fetch('/api/employee/join-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_code: companyCode }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to join company')
      }

      toast({
        title: 'Successfully joined company',
        description: `You've joined ${payload.company.name}. Awaiting approval from the guild master.`,
        variant: 'success',
      })

      setCompanyCode('')
      setMatchedCompanyName(null)

      // Refresh company context
      window.location.reload()
    } catch (error) {
      console.error('Failed to join company', error)
      toast({
        title: 'Failed to join company',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setJoiningCompany(false)
    }
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Your Profile</h2>

        {user?.user_metadata?.avatar_url && (
          <div className="mb-4 flex justify-center">
            <Image
              src={user.user_metadata.avatar_url}
              alt="Profile"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-full object-cover"
            />
          </div>
        )}

        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-400">Name</dt>
            <dd className="mt-1 text-sm text-white">{profile?.full_name || 'Not provided'}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-400">Email</dt>
            <dd className="mt-1 text-sm text-white">{user?.email}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-400">Phone</dt>
            <dd className="mt-1 text-sm text-white">{formatPhoneNumber(profile?.phone || null)}</dd>
          </div>

          {profile?.address && (
            <div>
              <dt className="text-sm font-medium text-gray-400">Address</dt>
              <dd className="mt-1 text-sm text-white">
                {profile.address}
                {profile.address_line_2 && (
                  <>
                    <br />
                    {profile.address_line_2}
                  </>
                )}
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
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-600 text-white">
                Employee
              </span>
            </dd>
          </div>

          {employeeData && (
            <>
              {employeeData.job_title && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Job Title</dt>
                  <dd className="mt-1 text-sm text-white">{employeeData.job_title}</dd>
                </div>
              )}

              {employeeData.department && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Department</dt>
                  <dd className="mt-1 text-sm text-white">{employeeData.department}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-400">Employment Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employeeData.employment_status === 'active'
                        ? 'bg-green-600 text-white'
                        : employeeData.employment_status === 'on_leave'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {employeeData.employment_status}
                  </span>
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">My Companies</h2>
        <p className="text-sm text-gray-400 mb-4">
          Companies you're part of. Use the dropdown in the sidebar to switch between them.
        </p>

        {memberships.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No company memberships found.</p>
        ) : (
          <div className="space-y-3">
            {memberships.map((membership) => (
              <div
                key={membership.company_id}
                className={`p-4 rounded-lg border ${
                  membership.company_id === activeCompanyId
                    ? 'bg-cyan-900/30 border-cyan-500/50'
                    : 'bg-gray-900/50 border-gray-600/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">
                        {membership.company_name || 'Unknown Company'}
                      </h3>
                      {membership.company_id === activeCompanyId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-600 text-white">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {membership.roles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            role === 'owner'
                              ? 'bg-amber-600 text-white'
                              : 'bg-green-600 text-white'
                          }`}
                        >
                          {role === 'owner' ? 'Guild Master' : 'Warrior'}
                        </span>
                      ))}

                      {membership.approval_status && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            membership.approval_status === 'approved'
                              ? 'bg-green-600 text-white'
                              : membership.approval_status === 'pending'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {membership.approval_status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {company ? (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
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
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
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
                  {company.address_line_2 && (
                    <>
                      <br />
                      {company.address_line_2}
                    </>
                  )}
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
        </div>
      ) : (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white">Company Information</h2>
          <p className="text-sm text-gray-400 mt-2">No company information available.</p>
        </div>
      )}

      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Join Additional Companies</h2>
        <p className="text-sm text-gray-400 mb-4">
          Enter a company code to join another guild. You can work for multiple companies and switch between them using the dropdown in the sidebar.
        </p>

        <form onSubmit={handleJoinCompany} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Company Code</label>
            <input
              type="text"
              value={companyCode}
              onChange={(e) => {
                const code = e.target.value.toUpperCase()
                setCompanyCode(code)
                lookupCompany(code)
              }}
              placeholder="Enter company code"
              className="block w-full rounded-lg border border-gray-600 shadow-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 px-4 py-2 bg-gray-900 text-white placeholder-gray-500 uppercase font-mono"
              disabled={joiningCompany}
            />

            {matchedCompanyName && (
              <div className="mt-3 p-3 bg-green-900/50 border border-green-500/50 rounded-lg">
                <p className="text-sm text-green-200">
                  <strong>Guild found:</strong> {matchedCompanyName}
                </p>
              </div>
            )}

            {companyCode && !matchedCompanyName && companyCode.length >= 3 && (
              <div className="mt-3 p-3 bg-yellow-900/50 border border-yellow-500/50 rounded-lg">
                <p className="text-sm text-yellow-200">
                  No guild found with this code. Please verify the code.
                </p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={joiningCompany || !companyCode || !matchedCompanyName}
            className="w-full"
          >
            {joiningCompany ? 'Joining Guild...' : 'Join Guild'}
          </Button>

          <p className="text-xs text-gray-400 italic">
            Note: Your request will be pending until approved by the guild master.
          </p>
        </form>
      </div>

      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Availability (Weekly)</h2>
            <p className="text-sm text-gray-400">Share when you are available to work.</p>
          </div>

          {availabilityEditMode ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingAvailability}
                onClick={() => setAvailabilityEditMode(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={availabilityLoading || savingAvailability}
                onClick={handleCopyMondayToWeekdays}
              >
                Copy Monday to weekdays
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={availabilityLoading || savingAvailability || hasAvailabilityErrors}
                onClick={handleSaveAvailability}
              >
                {savingAvailability ? 'Saving...' : 'Save Availability'}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAvailabilityEditMode(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {availabilityLoading ? (
          <p className="text-sm text-gray-400">Loading availability...</p>
        ) : availabilityEditMode ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Available?
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
                {availability.map((day) => (
                  <tr key={day.day_of_week}>
                    <td className="px-4 py-3 text-sm text-white">{day.label}</td>
                    <td className="px-4 py-3 text-sm text-white">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={day.is_available}
                          onChange={(event) =>
                            handleToggleAvailability(day.day_of_week, event.target.checked)
                          }
                        />
                        <span>{day.is_available ? 'Available' : 'Not available'}</span>
                      </label>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="w-full rounded-md bg-gray-900 border border-gray-700 text-white px-3 py-2 disabled:opacity-50"
                        value={day.start_time}
                        onChange={(event) =>
                          handleTimeChange(day.day_of_week, 'start_time', event.target.value)
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
                            handleTimeChange(day.day_of_week, 'end_time', event.target.value)
                          }
                          disabled={!day.is_available}
                        />
                        {availabilityErrors[day.day_of_week] && (
                          <p className="text-xs text-red-400">{availabilityErrors[day.day_of_week]}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : availabilitySummary.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No availability set yet.</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-200">
            {availabilitySummary.map((day) => (
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

const DEFAULT_AVAILABILITY: AvailabilityRow[] = DAYS_OF_WEEK.map((day) => ({
  day_of_week: day.value,
  label: day.label,
  is_available: false,
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

function formatTimeValue(value: string) {
  if (!value) return 'N/A'
  const [hoursStr, minutesStr] = value.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 'N/A'
  }
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
