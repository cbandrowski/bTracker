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
  logo_url: string | null
  show_address_on_invoice: boolean
  // Payment preferences
  paypal_handle: string | null
  zelle_phone: string | null
  zelle_email: string | null
  check_payable_to: string | null
  accept_cash: boolean
  accept_credit_debit: boolean
  // Late fee settings
  late_fee_enabled: boolean
  late_fee_days: number
  late_fee_amount: number
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

export type CompanyRole = 'owner' | 'employee'

export interface ProfileCompanyContext {
  profile_id: string
  active_company_id: string | null
  active_role: CompanyRole | null
  created_at: string
  updated_at: string
}

export interface CompanyMembership {
  company_id: string
  company_name: string | null
  company_logo_url: string | null
  roles: CompanyRole[]
  owner_id: string | null
  employee_id: string | null
  approval_status: ApprovalStatus | null
  work_status: WorkStatus | null
  is_primary_owner: boolean | null
}

export type EmploymentStatus = 'active' | 'terminated' | 'on_leave'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type WorkStatus = 'available' | 'inactive' | 'vacation' | 'sick'
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'void' | 'cancelled'
export type InvoiceAuditAction = 'edit' | 'delete'
export type CountryCode = 'USA' | string

export interface CompanyEmployee {
  id: string  // uuid
  company_id: string
  profile_id: string
  hire_date: string  // date
  termination_date: string | null  // date
  job_title: string | null
  department: string | null
  employment_status: EmploymentStatus
  approval_status: ApprovalStatus
  work_status: WorkStatus
  hourly_rate: number | null
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
  archived: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Supplier {
  id: string  // uuid
  company_id: string
  label: string | null
  name: string
  phone: string | null
  address: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: CountryCode | null
  account_number: string | null
  created_at: string
  updated_at: string
}

export interface CustomerServiceAddress {
  id: string
  customer_id: string
  company_id: string
  label: string
  address: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  country: CountryCode | null
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
  billing_hold: boolean

  // Planned date
  planned_end_date: string | null  // date
  arrival_window_start_time: string | null  // time
  arrival_window_end_time: string | null  // time

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

// =====================================================
// SCHEDULE & TIME TRACKING TYPES
// =====================================================

export type ScheduleStatus = 'scheduled' | 'cancelled' | 'completed'
export type TimeEntryStatus = 'pending_clock_in' | 'pending_approval' | 'approved' | 'rejected'

export interface EmployeeSchedule {
  id: string
  company_id: string
  employee_id: string
  job_id: string | null

  // Time fields
  start_planned: string  // timestamptz
  end_planned: string    // timestamptz

  // Status and notes
  status: ScheduleStatus
  notes: string | null

  // Metadata
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  company_id: string
  employee_id: string
  schedule_id: string | null

  // Employee-reported times
  clock_in_reported_at: string   // timestamptz
  clock_out_reported_at: string | null

  // Owner-approved times
  clock_in_approved_at: string | null
  clock_out_approved_at: string | null

  // Status workflow
  status: TimeEntryStatus

  // Approval tracking
  approved_by: string | null  // profile id
  approved_at: string | null

  // Edit tracking
  edit_reason: string | null

  // Metadata
  created_at: string
  updated_at: string
}

// Extended types with joined data
export interface EmployeeScheduleWithDetails extends EmployeeSchedule {
  employee?: CompanyEmployee & { profile?: Profile }
  job?: Job & { customer?: Customer }
  employee_name?: string
  employee_email?: string
  job_title?: string
  customer_name?: string
}

export interface TimeEntryWithDetails extends TimeEntry {
  employee?: CompanyEmployee & { profile?: Profile }
  schedule?: EmployeeSchedule
  job?: Job & { customer?: Customer }
  employee_name?: string
  employee_email?: string
  job_title?: string
  customer_name?: string
  approver?: Profile
}

export interface EmployeeAvailability {
  id: string
  company_id: string
  company_employee_id: string
  day_of_week: number
  is_available: boolean
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
}

export interface CompanyBusinessHours {
  id: string
  company_id: string
  day_of_week: number
  is_open: boolean
  start_time: string | null
  end_time: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceAuditDiffLine {
  line_type: string
  description: string | null
  quantity: number
  unit_price: number
  tax_rate: number
  applied_payment_id: string | null
}

export interface InvoiceAuditSnapshot {
  status: InvoiceStatus
  invoice_date: string | null
  due_date: string | null
  terms: string | null
  notes: string | null
  total_amount: number
  balance_due: number
  lines: InvoiceAuditDiffLine[]
}

export interface InvoiceAuditLog {
  id: string
  invoice_id: string
  company_id: string
  user_id: string | null
  action: InvoiceAuditAction
  diff: {
    before?: InvoiceAuditSnapshot
    after?: InvoiceAuditSnapshot
  } | null
  created_at: string
}
