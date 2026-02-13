import { SupabaseServerClient } from '@/lib/supabaseServer'
import { ApprovalRequest, ApprovalStatus, CompanyEmployee, Profile, WorkStatus } from '@/types/database'
import { requestEmployeePayChange } from '@/lib/services/approvals'

const TABLE_NAME = 'company_employees'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

async function assertOwnerAccess(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
) {
  const { data, error } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', profileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to verify owner access: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Unauthorized: not an owner for this company', 403)
  }
}

async function getOwnerCompanyIds(
  supabase: SupabaseServerClient,
  profileId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', profileId)

  if (error) {
    throw new ServiceError(`Failed to verify owner access: ${error.message}`, 500)
  }

  const companyIds = data?.map((row) => row.company_id) ?? []

  if (companyIds.length === 0) {
    throw new ServiceError('Unauthorized: not an owner for any company', 403)
  }

  return companyIds
}

export async function getEmployeeByProfileId(
  supabase: SupabaseServerClient,
  profileId: string
): Promise<CompanyEmployee | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, company_id, profile_id, hire_date, termination_date, job_title, department, employment_status, approval_status, work_status, hourly_rate, is_manager, created_at, updated_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load employee record: ${error.message}`)
  }

  return (data as CompanyEmployee) || null
}

export async function getEmployeeById(
  supabase: SupabaseServerClient,
  employeeId: string
): Promise<CompanyEmployee | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, company_id, profile_id, hire_date, termination_date, job_title, department, employment_status, approval_status, work_status, hourly_rate, is_manager, created_at, updated_at')
    .eq('id', employeeId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load employee: ${error.message}`)
  }

  return (data as CompanyEmployee) || null
}

export interface EmployeeWithProfile extends CompanyEmployee {
  profile?: Profile | null
}

export type EmployeeUpdatePayload = {
  job_title?: string | null
  hourly_rate?: number | null
  work_status?: WorkStatus
  approval_status?: ApprovalStatus
  department?: string | null
}

export type EmployeeUpdateResult = {
  employee: EmployeeWithProfile
  approval?: ApprovalRequest
  approval_applied?: boolean
}

const profileSelect = `
  id,
  full_name,
  email,
  phone,
  address,
  address_line_2,
  city,
  state,
  zipcode,
  country,
  avatar_url,
  timezone,
  created_at,
  updated_at
`

export async function listEmployeesForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId?: string
): Promise<EmployeeWithProfile[]> {
  const ownerCompanyIds = await getOwnerCompanyIds(supabase, profileId)

  if (companyId && !ownerCompanyIds.includes(companyId)) {
    throw new ServiceError('Unauthorized: not an owner for this company', 403)
  }

  let query = supabase
    .from(TABLE_NAME)
    .select(
      `
        *,
        profile:profiles(${profileSelect})
      `
    )
    .order('created_at', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  } else {
    query = query.in('company_id', ownerCompanyIds)
  }

  const { data, error } = await query

  if (error) {
    throw new ServiceError(`Failed to load employees: ${error.message}`, 500)
  }

  return (data as EmployeeWithProfile[]) || []
}

export async function getEmployeeWithProfile(
  supabase: SupabaseServerClient,
  employeeId: string
): Promise<EmployeeWithProfile | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      `
        *,
        profile:profiles(${profileSelect})
      `
    )
    .eq('id', employeeId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load employee detail: ${error.message}`)
  }

  return (data as EmployeeWithProfile) || null
}

export async function getEmployeeWithProfileForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  employeeId: string
): Promise<EmployeeWithProfile> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      `
        *,
        profile:profiles(${profileSelect})
      `
    )
    .eq('id', employeeId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to load employee detail: ${error.message}`, 500)
  }

  const employee = (data as EmployeeWithProfile) || null

  if (!employee) {
    throw new ServiceError('Employee not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, employee.company_id)

  return employee
}

export async function updateEmployeeForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  employeeId: string,
  updates: EmployeeUpdatePayload
): Promise<EmployeeUpdateResult> {
  const employee = await getEmployeeById(supabase, employeeId)

  if (!employee) {
    throw new ServiceError('Employee not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, employee.company_id)

  const { hourly_rate, ...rest } = updates
  const updateFields = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined)
  )

  let updatedEmployee: EmployeeWithProfile | null = null

  if (Object.keys(updateFields).length > 0) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        ...updateFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', employeeId)
      .select(
        `
          *,
          profile:profiles(${profileSelect})
        `
      )
      .single()

    if (error) {
      throw new ServiceError(`Failed to update employee: ${error.message}`, 500)
    }

    updatedEmployee = data as EmployeeWithProfile
  } else {
    updatedEmployee = await getEmployeeWithProfileForOwner(supabase, profileId, employeeId)
  }

  let approval: ApprovalRequest | undefined
  let approvalApplied = false

  if (hourly_rate !== undefined) {
    const result = await requestEmployeePayChange(
      supabase,
      profileId,
      employeeId,
      hourly_rate ?? null
    )
    approval = result.approval ?? undefined
    approvalApplied = result.applied

    if (approvalApplied) {
      updatedEmployee = await getEmployeeWithProfileForOwner(supabase, profileId, employeeId)
    }
  }

  if (!updatedEmployee) {
    throw new ServiceError('Failed to load employee after update', 500)
  }

  return {
    employee: updatedEmployee,
    approval,
    approval_applied: approvalApplied,
  }
}
