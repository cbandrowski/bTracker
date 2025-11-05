// Database types based on the new schema

export interface Profile {
  id: string  // uuid, matches auth.users(id)
  full_name: string
  phone: string | null
  email: string | null
  address: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: string | null
  avatar_url: string | null
  timezone: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string  // uuid
  name: string
  address: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: string | null
  company_code: string  // unique code for invites
  phone: string | null
  email: string | null
  website: string | null
  created_at: string
  updated_at: string
}

export interface CompanyOwner {
  id: string  // uuid
  company_id: string
  profile_id: string
  ownership_percentage: number | null
  is_primary_owner: boolean
  created_at: string
  updated_at: string
}

export type EmploymentStatus = 'active' | 'terminated' | 'on_leave'

export interface CompanyEmployee {
  id: string  // uuid
  company_id: string
  profile_id: string
  hire_date: string  // date
  termination_date: string | null  // date
  job_title: string | null
  department: string | null
  employment_status: EmploymentStatus
  is_manager: boolean
  created_at: string
  updated_at: string
}

// Extended types for UI with joined data
export interface ProfileWithCompanies extends Profile {
  owned_companies?: (CompanyOwner & { company: Company })[]
  employed_at?: (CompanyEmployee & { company: Company })[]
}

export interface CompanyWithMembers extends Company {
  owners?: (CompanyOwner & { profile: Profile })[]
  employees?: (CompanyEmployee & { profile: Profile })[]
}
