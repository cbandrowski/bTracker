import { SupabaseServerClient } from '@/lib/supabaseServer'
import {
  ApprovalStatus,
  CompanyMembership,
  CompanyRole,
  WorkStatus,
} from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.statusCode = statusCode
  }
}

export interface CompanyContext {
  company_id: string
  role: CompanyRole
}

interface OwnerRow {
  id: string
  company_id: string
  is_primary_owner: boolean | null
}

interface EmployeeRow {
  id: string
  company_id: string
  approval_status: ApprovalStatus
  work_status: WorkStatus
  job_title?: string | null
  hourly_rate?: number | null
}

interface CompanyRow {
  id: string
  name: string
  logo_url: string | null
}

const buildMemberships = (
  owners: OwnerRow[],
  employees: EmployeeRow[],
  companies: CompanyRow[]
) => {
  const companyMap = new Map<string, CompanyRow>(
    companies.map((company) => [company.id, company])
  )
  const memberships = new Map<string, CompanyMembership>()

  const ensureMembership = (companyId: string) => {
    const existing = memberships.get(companyId)
    if (existing) return existing

    const company = companyMap.get(companyId)
    const membership: CompanyMembership = {
      company_id: companyId,
      company_name: company?.name ?? null,
      company_logo_url: company?.logo_url ?? null,
      roles: [],
      owner_id: null,
      employee_id: null,
      approval_status: null,
      work_status: null,
      is_primary_owner: null,
    }

    memberships.set(companyId, membership)
    return membership
  }

  owners.forEach((owner) => {
    const membership = ensureMembership(owner.company_id)
    if (!membership.roles.includes('owner')) {
      membership.roles = [...membership.roles, 'owner']
    }
    membership.owner_id = owner.id
    membership.is_primary_owner = owner.is_primary_owner ?? null
  })

  employees.forEach((employee) => {
    const membership = ensureMembership(employee.company_id)
    if (!membership.roles.includes('employee')) {
      membership.roles = [...membership.roles, 'employee']
    }
    membership.employee_id = employee.id
    membership.approval_status = employee.approval_status
    membership.work_status = employee.work_status
  })

  return Array.from(memberships.values()).sort((left, right) => {
    const leftName = left.company_name ?? ''
    const rightName = right.company_name ?? ''
    return leftName.localeCompare(rightName)
  })
}

const pickDefaultContext = (memberships: CompanyMembership[]): CompanyContext => {
  const ownerMemberships = memberships.filter((membership) =>
    membership.roles.includes('owner')
  )

  if (ownerMemberships.length > 0) {
    const primaryOwner = ownerMemberships.find((membership) => membership.is_primary_owner)
    const selected = primaryOwner ?? ownerMemberships[0]
    return { company_id: selected.company_id, role: 'owner' }
  }

  const approvedEmployees = memberships.filter(
    (membership) =>
      membership.roles.includes('employee') &&
      membership.approval_status === 'approved'
  )

  if (approvedEmployees.length > 0) {
    return { company_id: approvedEmployees[0].company_id, role: 'employee' }
  }

  const fallback = memberships[0]
  const fallbackRole: CompanyRole = fallback.roles.includes('owner') ? 'owner' : 'employee'
  return { company_id: fallback.company_id, role: fallbackRole }
}

export const getMemberships = async (
  supabase: SupabaseServerClient,
  profileId: string
): Promise<CompanyMembership[]> => {
  const { data: ownerRows, error: ownerError } = await supabase
    .from('company_owners')
    .select('id, company_id, is_primary_owner')
    .eq('profile_id', profileId)

  if (ownerError) {
    throw new ServiceError(`Failed to load owner memberships: ${ownerError.message}`, 500)
  }

  const { data: employeeRows, error: employeeError } = await supabase
    .from('company_employees')
    .select('id, company_id, approval_status, work_status')
    .eq('profile_id', profileId)

  if (employeeError) {
    throw new ServiceError(`Failed to load employee memberships: ${employeeError.message}`, 500)
  }

  const owners = (ownerRows ?? []) as OwnerRow[]
  const employees = (employeeRows ?? []) as EmployeeRow[]
  const companyIds = Array.from(
    new Set([
      ...owners.map((owner) => owner.company_id),
      ...employees.map((employee) => employee.company_id),
    ])
  )

  let companies: CompanyRow[] = []
  if (companyIds.length > 0) {
    const { data: companyRows, error: companyError } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .in('id', companyIds)

    if (companyError) {
      throw new ServiceError(`Failed to load companies: ${companyError.message}`, 500)
    }

    companies = (companyRows ?? []) as CompanyRow[]
  }

  return buildMemberships(owners, employees, companies)
}

export const getActiveContext = async (
  supabase: SupabaseServerClient,
  profileId: string
): Promise<CompanyContext | null> => {
  const memberships = await getMemberships(supabase, profileId)
  if (memberships.length === 0) {
    return null
  }

  const { data: contextRow, error: contextError } = await supabase
    .from('profile_company_context')
    .select('active_company_id, active_role')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (contextError) {
    throw new ServiceError(`Failed to load company context: ${contextError.message}`, 500)
  }

  const activeCompanyId = contextRow?.active_company_id ?? null
  const activeRole = (contextRow?.active_role ?? null) as CompanyRole | null

  const matchingMembership = activeCompanyId
    ? memberships.find((membership) => membership.company_id === activeCompanyId)
    : null

  if (matchingMembership && activeRole && matchingMembership.roles.includes(activeRole)) {
    return { company_id: activeCompanyId, role: activeRole }
  }

  const nextContext = pickDefaultContext(memberships)
  const { error: upsertError } = await supabase
    .from('profile_company_context')
    .upsert(
      {
        profile_id: profileId,
        active_company_id: nextContext.company_id,
        active_role: nextContext.role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    )

  if (upsertError) {
    throw new ServiceError(`Failed to update company context: ${upsertError.message}`, 500)
  }

  return nextContext
}

export const setActiveContext = async (
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  role?: CompanyRole
): Promise<CompanyContext> => {
  const memberships = await getMemberships(supabase, profileId)
  if (memberships.length === 0) {
    throw new ServiceError('No company memberships found', 404)
  }

  const membership = memberships.find((entry) => entry.company_id === companyId)
  if (!membership) {
    throw new ServiceError('Not a member of the selected company', 404)
  }

  const selectedRole: CompanyRole =
    role ?? (membership.roles.includes('owner') ? 'owner' : 'employee')

  if (!membership.roles.includes(selectedRole)) {
    throw new ServiceError('Not authorized for the selected role', 403)
  }

  const { error: upsertError } = await supabase
    .from('profile_company_context')
    .upsert(
      {
        profile_id: profileId,
        active_company_id: companyId,
        active_role: selectedRole,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' }
    )

  if (upsertError) {
    throw new ServiceError(`Failed to update company context: ${upsertError.message}`, 500)
  }

  return { company_id: companyId, role: selectedRole }
}

export const getActiveEmployeeRecord = async (
  supabase: SupabaseServerClient,
  profileId: string
) => {
  const context = await getActiveContext(supabase, profileId)
  if (!context) {
    throw new ServiceError('No company membership found', 404)
  }

  if (context.role !== 'employee') {
    throw new ServiceError('Active role is not employee', 403)
  }

  const { data: employee, error } = await supabase
    .from('company_employees')
    .select('id, company_id, approval_status, work_status, job_title, hourly_rate')
    .eq('profile_id', profileId)
    .eq('company_id', context.company_id)
    .single()

  if (error || !employee) {
    throw new ServiceError('Employee record not found for active company', 404)
  }

  return { context, employee: employee as EmployeeRow }
}
