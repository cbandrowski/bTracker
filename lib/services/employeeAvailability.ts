import { SupabaseServerClient } from '@/lib/supabaseServer'
import { EmployeeAvailability } from '@/types/database'

const TABLE_NAME = 'employee_availability'
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]

export interface EmployeeAvailabilityInput {
  day_of_week: number
  is_available: boolean
  start_time: string | null
  end_time: string | null
}

async function fetchAvailabilityRecords(
  supabase: SupabaseServerClient,
  companyId: string,
  companyEmployeeId: string
): Promise<EmployeeAvailability[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('company_id', companyId)
    .eq('company_employee_id', companyEmployeeId)
    .order('day_of_week', { ascending: true })

  if (error) {
    throw new Error(`Failed to load availability: ${error.message}`)
  }

  return (data as EmployeeAvailability[]) || []
}

async function insertMissingDays(
  supabase: SupabaseServerClient,
  companyId: string,
  companyEmployeeId: string,
  missingDays: number[]
) {
  if (missingDays.length === 0) {
    return
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .insert(
      missingDays.map((day) => ({
        company_id: companyId,
        company_employee_id: companyEmployeeId,
        day_of_week: day,
        is_available: false,
        start_time: null,
        end_time: null,
      }))
    )

  if (error) {
    throw new Error(`Failed to seed missing availability: ${error.message}`)
  }
}

export async function getEmployeeAvailabilityWeek(
  supabase: SupabaseServerClient,
  companyId: string,
  companyEmployeeId: string
): Promise<EmployeeAvailability[]> {
  const records = await fetchAvailabilityRecords(supabase, companyId, companyEmployeeId)

  const existingDays = new Set(records.map((record) => record.day_of_week))
  const missingDays = WEEK_DAYS.filter((day) => !existingDays.has(day))

  if (missingDays.length === 0) {
    return records
  }

  await insertMissingDays(supabase, companyId, companyEmployeeId, missingDays)
  return fetchAvailabilityRecords(supabase, companyId, companyEmployeeId)
}

export async function saveEmployeeAvailabilityWeek(
  supabase: SupabaseServerClient,
  companyId: string,
  companyEmployeeId: string,
  entries: EmployeeAvailabilityInput[]
): Promise<EmployeeAvailability[]> {
  const payload = entries.map((entry) => ({
    company_id: companyId,
    company_employee_id: companyEmployeeId,
    day_of_week: entry.day_of_week,
    is_available: entry.is_available,
    start_time: entry.is_available ? entry.start_time : null,
    end_time: entry.is_available ? entry.end_time : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'company_employee_id,day_of_week' })

  if (error) {
    throw new Error(`Failed to save availability: ${error.message}`)
  }

  return getEmployeeAvailabilityWeek(supabase, companyId, companyEmployeeId)
}
