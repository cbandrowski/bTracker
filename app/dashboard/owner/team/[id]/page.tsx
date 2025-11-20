'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { CompanyEmployee, EmployeeAvailability, Profile } from '@/types/database'
import Image from 'next/image'

interface EmployeeWithProfile extends CompanyEmployee {
  profile: Profile
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params?.id as string

  const [employee, setEmployee] = useState<EmployeeWithProfile | null>(null)
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (!employeeId) return

      try {
        // Fetch employee with profile
        const { data: employeeData, error: employeeError } = await supabase
          .from('company_employees')
          .select(`
            *,
            profile:profiles(*)
          `)
          .eq('id', employeeId)
          .single()

        if (employeeError) {
          console.error('Error fetching employee:', employeeError)
          setError('Failed to load employee details')
          setLoading(false)
          return
        }

        setEmployee(employeeData as any)

        // Fetch availability
        const response = await fetch(`/api/employees/${employeeId}/availability`)
        if (response.ok) {
          const data = await response.json()
          setAvailability(data.availability || [])
        }
      } catch (err) {
        console.error('Error:', err)
        setError('Failed to load employee details')
      } finally {
        setLoading(false)
      }
    }

    fetchEmployeeDetails()
  }, [employeeId])

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A'
    return time.slice(0, 5)
  }

  const getEmploymentStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-600 text-white'
      case 'on_leave':
        return 'bg-yellow-600 text-white'
      case 'terminated':
        return 'bg-red-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  const getWorkStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-900 bg-opacity-50 text-green-200 border border-green-700'
      case 'inactive':
        return 'bg-gray-700 text-gray-300 border border-gray-600'
      case 'vacation':
        return 'bg-blue-900 bg-opacity-50 text-blue-200 border border-blue-700'
      case 'sick':
        return 'bg-orange-900 bg-opacity-50 text-orange-200 border border-orange-700'
      default:
        return 'bg-gray-700 text-gray-300 border border-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-6">
          <p className="text-red-400">{error || 'Employee not found'}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-400 hover:text-white"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Team
        </button>
      </div>

      {/* Profile Information */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <div className="flex items-start gap-6">
          {employee.profile?.avatar_url && (
            <Image
              src={employee.profile.avatar_url}
              alt="Profile"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-full object-cover"
            />
          )}

          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {employee.profile?.full_name || 'Unknown'}
                </h1>
                <p className="text-gray-400 mt-1">{employee.profile?.email}</p>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded ${getWorkStatusColor(employee.work_status)}`}>
                  {employee.work_status}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getEmploymentStatusColor(employee.employment_status)}`}>
                  {employee.employment_status}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-400">Phone</dt>
                <dd className="mt-1 text-sm text-white">{formatPhoneNumber(employee.profile?.phone || null)}</dd>
              </div>

              {employee.job_title && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Job Title</dt>
                  <dd className="mt-1 text-sm text-white">{employee.job_title}</dd>
                </div>
              )}

              {employee.department && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Department</dt>
                  <dd className="mt-1 text-sm text-white">{employee.department}</dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-gray-400">Hire Date</dt>
                <dd className="mt-1 text-sm text-white">
                  {new Date(employee.hire_date).toLocaleDateString()}
                </dd>
              </div>

              {employee.termination_date && (
                <div>
                  <dt className="text-sm font-medium text-gray-400">Termination Date</dt>
                  <dd className="mt-1 text-sm text-white">
                    {new Date(employee.termination_date).toLocaleDateString()}
                  </dd>
                </div>
              )}

              {employee.profile?.address && (
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-400">Address</dt>
                  <dd className="mt-1 text-sm text-white">
                    {employee.profile.address}
                    {employee.profile.address_line_2 && (
                      <>
                        <br />
                        {employee.profile.address_line_2}
                      </>
                    )}
                    {employee.profile.city && employee.profile.state && (
                      <>
                        <br />
                        {employee.profile.city}, {employee.profile.state} {employee.profile.zipcode}
                      </>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Availability Section */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Weekly Availability</h2>

        {availability.length === 0 ? (
          <p className="text-gray-400 text-sm">No availability set</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {DAYS_OF_WEEK.map((day) => {
                  const dayAvailability = availability.find(a => a.day_of_week === day.value)
                  const isAvailable = dayAvailability?.is_available || false

                  return (
                    <tr key={day.value}>
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {day.label}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {isAvailable ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 bg-opacity-50 text-green-200 border border-green-700">
                            Available
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
                            Not Available
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {isAvailable && dayAvailability ? (
                          <span>
                            {formatTime(dayAvailability.start_time)} - {formatTime(dayAvailability.end_time)}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
