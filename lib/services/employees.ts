import { SupabaseServerClient } from '@/lib/supabaseServer'
import { CompanyEmployee, Profile } from '@/types/database'

const TABLE_NAME = 'company_employees'

export async function getEmployeeByProfileId(
  supabase: SupabaseServerClient,
  profileId: string
): Promise<CompanyEmployee | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, company_id, profile_id, hire_date, termination_date, job_title, department, employment_status, approval_status, work_status, is_manager, created_at, updated_at')
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
    .select('id, company_id, profile_id, hire_date, termination_date, job_title, department, employment_status, approval_status, work_status, is_manager, created_at, updated_at')
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

export async function getEmployeeWithProfile(
  supabase: SupabaseServerClient,
  employeeId: string
): Promise<EmployeeWithProfile | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select(
      `
        *,
        profile:profiles(*)
      `
    )
    .eq('id', employeeId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load employee detail: ${error.message}`)
  }

  return (data as EmployeeWithProfile) || null
}
