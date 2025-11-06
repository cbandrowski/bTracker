'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Company, CompanyEmployee } from '@/types/database'

export default function EmployeeDashboardPage() {
  const { user, profile } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [employeeData, setEmployeeData] = useState<CompanyEmployee | null>(null)

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!profile?.id) {
        setLoadingData(false)
        return
      }

      try {
        // Fetch employee data
        const { data: employeeData } = await supabase
          .from('company_employees')
          .select('*, company_id, companies(*)')
          .eq('profile_id', profile.id)
          .single()

        if (employeeData) {
          setEmployeeData(employeeData as any)
          setCompany(employeeData.companies as unknown as Company)
        }
      } catch (error) {
        console.error('Error fetching company data:', error)
      }

      setLoadingData(false)
    }

    if (profile) {
      fetchCompanyData()
    }
  }, [profile])

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
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
      {/* User Profile Info */}
      <div className="bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Your Profile</h2>

        {user?.user_metadata?.avatar_url && (
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
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    employeeData.employment_status === 'active'
                      ? 'bg-green-600 text-white'
                      : employeeData.employment_status === 'on_leave'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}>
                    {employeeData.employment_status}
                  </span>
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Company Info */}
      {company ? (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6">
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

          {employeeData && (
            <div className="mt-6 p-4 bg-green-900 rounded-md border border-green-700">
              <p className="text-sm text-green-100">
                <strong>Start Date:</strong> {employeeData.hire_date
                  ? new Date(employeeData.hire_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'Not set'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 shadow-lg rounded-lg p-6">
          <p className="text-gray-400">No company information available</p>
          <p className="text-gray-500 text-sm mt-2">
            It looks like you haven't joined a company yet.
          </p>
        </div>
      )}
    </div>
  )
}
