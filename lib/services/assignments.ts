import { SupabaseServerClient } from '@/lib/supabaseServer'
import {
  AssignmentStatus,
  CompanyEmployee,
  JobAssignment,
  JobWithCustomer,
  Profile,
} from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export interface AssignmentWithDetails extends JobAssignment {
  job?: JobWithCustomer
  employee?: (CompanyEmployee & { profile?: Profile | null }) | null
}

interface CreateAssignmentInput {
  company_id: string
  job_id: string
  employee_id: string
  service_start_at?: string | null
  service_end_at?: string | null
  notes?: string | null
}

const ASSIGNMENT_SELECT = `
  *,
  job:jobs(
    *,
    customer:customers(*)
  ),
  employee:company_employees(
    *,
    profile:profiles(*)
  )
`

const STATUS_FLOW: Record<AssignmentStatus, AssignmentStatus[]> = {
  assigned: ['in_progress'],
  in_progress: ['done'],
  done: [],
  cancelled: [],
}

interface AvailabilityWindow {
  startMinutes: number
  endMinutes: number
  dayOfWeek: number
}

function timeToMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new ServiceError('Invalid availability time format', 422)
  }

  return hours * 60 + minutes
}

function toMinutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function getAvailabilityWindow(
  startAt: string,
  endAt: string | null
): AvailabilityWindow {
  const startDate = new Date(startAt)
  if (Number.isNaN(startDate.getTime())) {
    throw new ServiceError('Invalid service_start_at value', 422)
  }

  const endDate = endAt ? new Date(endAt) : null
  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new ServiceError('Invalid service_end_at value', 422)
  }

  if (endDate && endDate <= startDate) {
    throw new ServiceError('service_end_at must be after service_start_at', 422)
  }

  if (endDate && endDate.getDay() !== startDate.getDay()) {
    throw new ServiceError(
      'Assignment spans multiple days; split it into separate assignments',
      422
    )
  }

  return {
    dayOfWeek: startDate.getDay(),
    startMinutes: toMinutesFromDate(startDate),
    endMinutes: endDate ? toMinutesFromDate(endDate) : toMinutesFromDate(startDate),
  }
}

async function assertEmployeeAvailability(
  supabase: SupabaseServerClient,
  companyId: string,
  employeeId: string,
  startAt: string | null,
  endAt: string | null
) {
  if (!startAt) {
    return
  }

  const window = getAvailabilityWindow(startAt, endAt)

  const { data, error } = await supabase
    .from('employee_availability')
    .select('is_available, start_time, end_time')
    .eq('company_id', companyId)
    .eq('company_employee_id', employeeId)
    .eq('day_of_week', window.dayOfWeek)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to check availability: ${error.message}`, 500)
  }

  if (!data || !data.is_available) {
    throw new ServiceError('Employee is unavailable on that day', 422)
  }

  if (!data.start_time || !data.end_time) {
    throw new ServiceError('Employee availability hours are not set', 422)
  }

  const availableStart = timeToMinutes(data.start_time)
  const availableEnd = timeToMinutes(data.end_time)

  if (window.startMinutes < availableStart || window.endMinutes > availableEnd) {
    throw new ServiceError('Assignment time is outside employee availability', 422)
  }
}

async function assertNoAssignmentConflicts(
  supabase: SupabaseServerClient,
  companyId: string,
  employeeId: string,
  startAt: string | null,
  endAt: string | null
) {
  if (!startAt || !endAt) {
    return
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select('id')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .in('assignment_status', ['assigned', 'in_progress'])
    .not('service_start_at', 'is', null)
    .not('service_end_at', 'is', null)
    .lt('service_start_at', endAt)
    .gt('service_end_at', startAt)
    .limit(1)

  if (error) {
    throw new ServiceError(`Failed to check assignment conflicts: ${error.message}`, 500)
  }

  if (data && data.length > 0) {
    throw new ServiceError('Employee already has a job during that time window', 409)
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
    throw new ServiceError(`Failed to load owner companies: ${error.message}`, 500)
  }

  return data?.map((row) => row.company_id) || []
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

async function getOwnerEmployeeId(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('company_employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .eq('employment_status', 'active')
    .eq('approval_status', 'approved')
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to resolve employee record: ${error.message}`, 500)
  }

  return data?.id || null
}

async function assertEmployeeInCompany(
  supabase: SupabaseServerClient,
  employeeId: string,
  companyId: string
): Promise<
  Pick<CompanyEmployee, 'id' | 'employment_status' | 'approval_status' | 'work_status'>
> {
  const { data, error } = await supabase
    .from('company_employees')
    .select('id, employment_status, approval_status, work_status')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to verify employee: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Employee not found in company', 404)
  }

  return data as Pick<
    CompanyEmployee,
    'id' | 'employment_status' | 'approval_status' | 'work_status'
  >
}

async function assertJobInCompany(
  supabase: SupabaseServerClient,
  jobId: string,
  companyId: string
): Promise<{
  planned_end_date: string | null
  arrival_window_start_time: string | null
  arrival_window_end_time: string | null
}> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, planned_end_date, arrival_window_start_time, arrival_window_end_time')
    .eq('id', jobId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to verify job: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Job not found in company', 404)
  }

  return {
    planned_end_date: data.planned_end_date ?? null,
    arrival_window_start_time: data.arrival_window_start_time ?? null,
    arrival_window_end_time: data.arrival_window_end_time ?? null,
  }
}

function parseTimeParts(timeValue: string) {
  const [hoursStr, minutesStr, secondsStr] = timeValue.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  const seconds = Number(secondsStr ?? 0)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new ServiceError('Invalid arrival window time value', 422)
  }

  return { hours, minutes, seconds }
}

function combineDateAndTime(dateString: string, timeValue: string): string {
  const [yearStr, monthStr, dayStr] = dateString.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    dateString.length !== 10
  ) {
    throw new ServiceError('Invalid planned_end_date value', 422)
  }

  const { hours, minutes, seconds } = parseTimeParts(timeValue)
  const combined = new Date(year, month - 1, day, hours, minutes, seconds, 0)

  if (Number.isNaN(combined.getTime())) {
    throw new ServiceError('Invalid arrival window date/time combination', 422)
  }

  return combined.toISOString()
}

function resolveServiceWindow(
  input: CreateAssignmentInput,
  job: {
    planned_end_date: string | null
    arrival_window_start_time: string | null
    arrival_window_end_time: string | null
  }
) {
  let serviceStartAt = input.service_start_at ?? null
  let serviceEndAt = input.service_end_at ?? null

  if (
    !serviceStartAt &&
    !serviceEndAt &&
    job.planned_end_date &&
    job.arrival_window_start_time &&
    job.arrival_window_end_time
  ) {
    serviceStartAt = combineDateAndTime(
      job.planned_end_date,
      job.arrival_window_start_time
    )
    serviceEndAt = combineDateAndTime(
      job.planned_end_date,
      job.arrival_window_end_time
    )
  }

  return { serviceStartAt, serviceEndAt }
}

export async function listAssignmentsForOwner(
  supabase: SupabaseServerClient,
  profileId: string
): Promise<AssignmentWithDetails[]> {
  const companyIds = await getOwnerCompanyIds(supabase, profileId)
  if (companyIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select(ASSIGNMENT_SELECT)
    .in('company_id', companyIds)
    .neq('assignment_status', 'cancelled')

  if (error) {
    throw new ServiceError(`Failed to fetch assignments: ${error.message}`, 500)
  }

  return (data as AssignmentWithDetails[]) || []
}

export async function getAssignmentForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  assignmentId: string
): Promise<AssignmentWithDetails | null> {
  const companyIds = await getOwnerCompanyIds(supabase, profileId)
  if (companyIds.length === 0) {
    return null
  }

  const { data, error } = await supabase
    .from('job_assignments')
    .select(ASSIGNMENT_SELECT)
    .eq('id', assignmentId)
    .in('company_id', companyIds)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to fetch assignment: ${error.message}`, 500)
  }

  return (data as AssignmentWithDetails) || null
}

export async function createAssignmentForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  input: CreateAssignmentInput
): Promise<AssignmentWithDetails> {
  await assertOwnerAccess(supabase, profileId, input.company_id)
  const employee = await assertEmployeeInCompany(
    supabase,
    input.employee_id,
    input.company_id
  )
  const job = await assertJobInCompany(supabase, input.job_id, input.company_id)

  const { serviceStartAt, serviceEndAt } = resolveServiceWindow(input, job)

  if (employee.employment_status !== 'active') {
    throw new ServiceError('Employee is not active', 422)
  }

  if (employee.approval_status !== 'approved') {
    throw new ServiceError('Employee is not approved', 422)
  }

  if (employee.work_status !== 'available') {
    throw new ServiceError('Employee is not available for work', 422)
  }

  await assertEmployeeAvailability(
    supabase,
    input.company_id,
    input.employee_id,
    serviceStartAt,
    serviceEndAt
  )

  await assertNoAssignmentConflicts(
    supabase,
    input.company_id,
    input.employee_id,
    serviceStartAt,
    serviceEndAt
  )

  const { data, error } = await supabase
    .from('job_assignments')
    .insert({
      company_id: input.company_id,
      job_id: input.job_id,
      employee_id: input.employee_id,
      service_start_at: serviceStartAt,
      service_end_at: serviceEndAt,
      notes: input.notes ?? null,
      assignment_status: 'assigned',
    })
    .select(ASSIGNMENT_SELECT)
    .single()

  if (error) {
    throw new ServiceError(`Failed to create assignment: ${error.message}`, 500)
  }

  return data as AssignmentWithDetails
}

export async function updateAssignmentStatusForOwnerEmployee(
  supabase: SupabaseServerClient,
  profileId: string,
  assignmentId: string,
  nextStatus: AssignmentStatus
): Promise<AssignmentWithDetails> {
  const { data: existing, error } = await supabase
    .from('job_assignments')
    .select('id, company_id, employee_id, assignment_status')
    .eq('id', assignmentId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to load assignment: ${error.message}`, 500)
  }

  if (!existing) {
    throw new ServiceError('Assignment not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, existing.company_id)

  const ownerEmployeeId = await getOwnerEmployeeId(
    supabase,
    profileId,
    existing.company_id
  )

  if (!ownerEmployeeId || ownerEmployeeId !== existing.employee_id) {
    throw new ServiceError('Unauthorized: cannot update other employees', 403)
  }

  if (nextStatus === existing.assignment_status) {
    const current = await getAssignmentForOwner(supabase, profileId, assignmentId)
    if (!current) {
      throw new ServiceError('Assignment not found', 404)
    }
    return current
  }

  const allowedNext = STATUS_FLOW[existing.assignment_status] || []
  if (!allowedNext.includes(nextStatus)) {
    throw new ServiceError('Invalid status transition', 422)
  }

  const updatePayload: Partial<JobAssignment> = {
    assignment_status: nextStatus,
  }

  if (nextStatus === 'done') {
    updatePayload.worker_confirmed_done_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('job_assignments')
    .update(updatePayload)
    .eq('id', assignmentId)
    .select(ASSIGNMENT_SELECT)
    .single()

  if (updateError) {
    throw new ServiceError(`Failed to update assignment: ${updateError.message}`, 500)
  }

  return updated as AssignmentWithDetails
}

export async function deleteAssignmentForOwner(
  supabase: SupabaseServerClient,
  profileId: string,
  assignmentId: string
) {
  const { data, error } = await supabase
    .from('job_assignments')
    .select('company_id')
    .eq('id', assignmentId)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to load assignment: ${error.message}`, 500)
  }

  if (!data) {
    throw new ServiceError('Assignment not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, data.company_id)

  const { error: deleteError } = await supabase
    .from('job_assignments')
    .delete()
    .eq('id', assignmentId)

  if (deleteError) {
    throw new ServiceError(`Failed to delete assignment: ${deleteError.message}`, 500)
  }
}
