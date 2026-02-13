'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmployeeAvailability } from '@/types/database'

const formatPhoneNumber = (phone: string | null) => {
  if (!phone) return 'N/A'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export default function OwnerProfilePage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [ownerAvailability, setOwnerAvailability] = useState<AvailabilityRow[]>(DEFAULT_AVAILABILITY)
  const [ownerAvailabilityLoading, setOwnerAvailabilityLoading] = useState(true)
  const [savingOwnerAvailability, setSavingOwnerAvailability] = useState(false)
  const [ownerHoursEditMode, setOwnerHoursEditMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push('/login')
      return
    }

    if (!profile) {
      router.push('/onboarding')
    }
  }, [user, profile, loading, router])

  useEffect(() => {
    if (!user) return

    const fetchOwnerAvailability = async () => {
      setOwnerAvailabilityLoading(true)
      setError(null)

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

    fetchOwnerAvailability()
  }, [user])

  const ownerAvailabilityErrors = useMemo(() => {
    const errors: Record<number, string | null> = {}
    ownerAvailability.forEach((row) => {
      errors[row.day_of_week] = validateAvailabilityRow(row)
    })
    return errors
  }, [ownerAvailability])

  const hasOwnerAvailabilityErrors = useMemo(
    () => Object.values(ownerAvailabilityErrors).some((value) => Boolean(value)),
    [ownerAvailabilityErrors]
  )

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
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save work hours')
    } finally {
      setSavingOwnerAvailability(false)
    }
  }

  const ownerHoursSummary = ownerAvailability.filter(
    (row) => row.is_available && row.start_time && row.end_time
  )

  if (loading) {
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
