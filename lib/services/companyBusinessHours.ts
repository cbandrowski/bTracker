import { SupabaseServerClient } from '@/lib/supabaseServer'
import { CompanyBusinessHours } from '@/types/database'

const TABLE_NAME = 'company_business_hours'
const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6]

export interface CompanyBusinessHoursInput {
  day_of_week: number
  is_open: boolean
  start_time: string | null
  end_time: string | null
}

async function fetchBusinessHours(
  supabase: SupabaseServerClient,
  companyId: string
): Promise<CompanyBusinessHours[]> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('company_id', companyId)
    .order('day_of_week', { ascending: true })

  if (error) {
    throw new Error(`Failed to load business hours: ${error.message}`)
  }

  return (data as CompanyBusinessHours[]) || []
}

async function insertMissingDays(
  supabase: SupabaseServerClient,
  companyId: string,
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
        day_of_week: day,
        is_open: false,
        start_time: null,
        end_time: null,
      }))
    )

  if (error) {
    throw new Error(`Failed to seed business hours: ${error.message}`)
  }
}

export async function getCompanyBusinessHoursWeek(
  supabase: SupabaseServerClient,
  companyId: string
): Promise<CompanyBusinessHours[]> {
  const records = await fetchBusinessHours(supabase, companyId)
  const existingDays = new Set(records.map((record) => record.day_of_week))
  const missingDays = WEEK_DAYS.filter((day) => !existingDays.has(day))

  if (missingDays.length === 0) {
    return records
  }

  await insertMissingDays(supabase, companyId, missingDays)
  return fetchBusinessHours(supabase, companyId)
}

export async function saveCompanyBusinessHoursWeek(
  supabase: SupabaseServerClient,
  companyId: string,
  entries: CompanyBusinessHoursInput[]
): Promise<CompanyBusinessHours[]> {
  const payload = entries.map((entry) => ({
    company_id: companyId,
    day_of_week: entry.day_of_week,
    is_open: entry.is_open,
    start_time: entry.is_open ? entry.start_time : null,
    end_time: entry.is_open ? entry.end_time : null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: 'company_id,day_of_week' })

  if (error) {
    throw new Error(`Failed to save business hours: ${error.message}`)
  }

  return getCompanyBusinessHoursWeek(supabase, companyId)
}
