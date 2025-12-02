import { SupabaseServerClient } from '@/lib/supabaseServer'
import { EmployeeSchedule } from '@/types/database'

export type RecurringShiftDuration = '1week' | '2weeks' | '3weeks' | '4weeks' | 'month'

export interface DayHourConfig {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface RecurringShiftInput {
  companyId: string
  employeeId: string
  startTime: string // HH:MM
  endTime: string // HH:MM
  daysOfWeek: number[] // 0=Sunday, 6=Saturday
  duration: RecurringShiftDuration
  startDate: string // YYYY-MM-DD
  notes?: string | null
  dayHours?: DayHourConfig[]
}

const MAX_RECURRING_SHIFTS = 120

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

async function assertEmployeeInCompany(
  supabase: SupabaseServerClient,
  employeeId: string,
  companyId: string
) {
  const { data, error } = await supabase
    .from('company_employees')
    .select('id')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to verify employee: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Employee not found in company', 404)
  }
}

function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    dateString.length !== 10
  ) {
    throw new ServiceError('Invalid start_date format', 422)
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) {
    throw new ServiceError('Invalid start_date value', 422)
  }

  return date
}

function combineDateAndTimeUTC(date: Date, time: string): Date {
  const [hoursStr, minutesStr] = time.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new ServiceError('Invalid time format. Use HH:MM (24h).', 422)
  }

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes
    )
  )
}

function calculateEndDate(startDate: Date, duration: RecurringShiftDuration): Date {
  if (duration === 'month') {
    return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 0))
  }

  const weeks = Number.parseInt(duration.replace('weeks', '').replace('week', ''), 10)
  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + weeks * 7)
  return endDate
}

function generateShiftPayloads(input: RecurringShiftInput) {
  const dayHourMap = new Map<number, { startTime: string; endTime: string }>()
  if (input.dayHours) {
    input.dayHours.forEach(({ dayOfWeek, startTime, endTime }) => {
      validateTimeOrder(startTime, endTime, `day ${dayOfWeek}`)
      dayHourMap.set(dayOfWeek, { startTime, endTime })
    })
  }

  const startDate = parseDateOnly(input.startDate)
  const endDate = calculateEndDate(startDate, input.duration)

  validateTimeOrder(input.startTime, input.endTime, 'default')

  const payloads: Omit<EmployeeSchedule, 'id' | 'created_at' | 'updated_at'>[] = []
  let cursor = new Date(startDate)

  while (cursor <= endDate) {
    const dayOfWeek = cursor.getUTCDay()
    if (input.daysOfWeek.includes(dayOfWeek)) {
      const dayConfig = dayHourMap.get(dayOfWeek)
      const startTime = dayConfig?.startTime ?? input.startTime
      const endTime = dayConfig?.endTime ?? input.endTime
      validateTimeOrder(startTime, endTime, `day ${dayOfWeek}`)

      const shiftStart = combineDateAndTimeUTC(cursor, startTime)
      const shiftEnd = combineDateAndTimeUTC(cursor, endTime)

      payloads.push({
        company_id: input.companyId,
        employee_id: input.employeeId,
        job_id: null,
        start_planned: shiftStart.toISOString(),
        end_planned: shiftEnd.toISOString(),
        status: 'scheduled',
        notes: input.notes ?? 'Recurring shift',
      })
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return payloads
}

function timeToMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(':')
  return Number(hoursStr) * 60 + Number(minutesStr)
}

function validateTimeOrder(startTime: string, endTime: string, label: string) {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    throw new ServiceError(`Invalid time provided for ${label}`, 422)
  }

  if (endMinutes <= startMinutes) {
    throw new ServiceError(`end_time must be after start_time (${label})`, 422)
  }
}

export async function createRecurringShifts(
  supabase: SupabaseServerClient,
  profileId: string,
  input: RecurringShiftInput
): Promise<EmployeeSchedule[]> {
  await assertOwnerAccess(supabase, profileId, input.companyId)
  await assertEmployeeInCompany(supabase, input.employeeId, input.companyId)

  const payloads = generateShiftPayloads(input)

  if (payloads.length === 0) {
    throw new ServiceError('No dates match the selected pattern', 400)
  }

  if (payloads.length > MAX_RECURRING_SHIFTS) {
    throw new ServiceError(
      `Too many shifts generated (${payloads.length}). Reduce the date range.`,
      400
    )
  }

  const { data, error } = await supabase
    .from('employee_schedules')
    .insert(payloads)
    .select('*')

  if (error) {
    throw new ServiceError(`Failed to create shifts: ${error.message}`, 500)
  }

  return (data as EmployeeSchedule[]) || []
}
