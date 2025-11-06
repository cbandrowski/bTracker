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

export interface Customer {
  id: string  // uuid
  company_id: string
  name: string
  phone: string | null
  email: string | null

  // Billing address
  billing_address: string | null
  billing_address_line_2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zipcode: string | null
  billing_country: string | null

  // Service address
  service_address: string | null
  service_address_line_2: string | null
  service_city: string | null
  service_state: string | null
  service_zipcode: string | null
  service_country: string | null

  same_as_billing: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CustomerContact {
  id: string  // uuid
  customer_id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export type JobStatus = 'upcoming' | 'in_progress' | 'done' | 'cancelled'

export interface Job {
  id: string  // uuid
  company_id: string
  customer_id: string

  // Job details
  title: string
  summary: string | null

  // Service info
  service_address: string | null
  service_address_line_2: string | null
  service_city: string | null
  service_state: string | null
  service_zipcode: string | null
  service_country: string | null

  // Tasks
  tasks_to_complete: string | null

  // Status
  status: JobStatus

  // Planned date
  planned_end_date: string | null  // date

  created_at: string
  updated_at: string
}

export type AssignmentStatus = 'assigned' | 'in_progress' | 'done' | 'cancelled'

export interface JobAssignment {
  id: string  // uuid
  company_id: string
  job_id: string
  employee_id: string

  // Service dates/times
  service_start_at: string | null  // timestamptz
  service_end_at: string | null  // timestamptz

  // Status
  assignment_status: AssignmentStatus

  // Confirmation
  worker_confirmed_done_at: string | null  // timestamptz

  notes: string | null
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

export interface CustomerWithContacts extends Customer {
  contacts?: CustomerContact[]
}

export interface JobWithCustomer extends Job {
  customer?: Customer
}

export interface JobAssignmentWithDetails extends JobAssignment {
  job?: Job
  employee?: CompanyEmployee & { profile?: Profile }
}
