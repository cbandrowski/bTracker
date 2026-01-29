import { SupabaseServerClient } from '@/lib/supabaseServer'
import { calculateHours } from '@/types/payroll'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export type PayrollCurrentSummary = {
  period_start: string
  period_end: string
  period_complete: boolean
  status: 'run_exists' | 'in_progress' | 'ready' | 'pending_approval' | 'no_hours'
  approved_hours: number
  approved_entries: number
  pending_entries: number
  employees_with_hours: number
  jobs_completed: number
  existing_run_id?: string
  existing_run_status?: 'draft' | 'finalized'
}

type ApprovedEntry = {
  id: string
  employee_id: string
  clock_in_approved_at: string
  clock_out_approved_at: string | null
}

type PendingEntry = {
  id: string
}

type AssignmentDoneRow = {
  job_id: string
  worker_confirmed_done_at: string | null
  updated_at: string
}

type PayrollRunRow = {
  id: string
  status: 'draft' | 'finalized'
}

const normalizeDate = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const computeCurrentPeriod = (today: Date, startDay: number, endDay: number) => {
  const endDate = normalizeDate(today)
  const diffToEnd = (endDate.getDay() - endDay + 7) % 7
  endDate.setDate(endDate.getDate() - diffToEnd)

  if (diffToEnd !== 0) {
    endDate.setDate(endDate.getDate() + 7)
  }

  const length =
    startDay <= endDay ? endDay - startDay : (7 - startDay) + endDay

  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - length)

  return { startDate, endDate }
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

export async function getCurrentPayrollSummary(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
): Promise<PayrollCurrentSummary> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const { data: settings, error: settingsError } = await supabase
    .from('payroll_settings')
    .select('period_start_day, period_end_day')
    .eq('company_id', companyId)
    .maybeSingle()

  if (settingsError) {
    throw new ServiceError(`Failed to load payroll settings: ${settingsError.message}`, 500)
  }

  const periodStartDay = settings?.period_start_day ?? 1
  const periodEndDay = settings?.period_end_day ?? 0
  const today = normalizeDate(new Date())
  const { startDate, endDate } = computeCurrentPeriod(today, periodStartDay, periodEndDay)

  const periodStartAt = new Date(startDate)
  periodStartAt.setHours(0, 0, 0, 0)
  const periodEndAt = new Date(endDate)
  periodEndAt.setHours(23, 59, 59, 999)

  const periodStartIso = periodStartAt.toISOString()
  const periodEndIso = periodEndAt.toISOString()
  const periodStartLabel = startDate.toISOString().split('T')[0]
  const periodEndLabel = endDate.toISOString().split('T')[0]

  const { data: approvedEntries, error: approvedError } = await supabase
    .from('time_entries')
    .select('id, employee_id, clock_in_approved_at, clock_out_approved_at')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .is('payroll_run_id', null)
    .gte('clock_in_approved_at', periodStartIso)
    .lte('clock_in_approved_at', periodEndIso)
    .not('clock_out_approved_at', 'is', null)

  if (approvedError) {
    throw new ServiceError(`Failed to load time entries: ${approvedError.message}`, 500)
  }

  const typedApproved = (approvedEntries as ApprovedEntry[]) || []
  const employeeIds = new Set<string>()
  let totalHours = 0

  typedApproved.forEach((entry) => {
    if (!entry.clock_out_approved_at) {
      return
    }
    const hours = calculateHours(entry.clock_in_approved_at, entry.clock_out_approved_at)
    if (!Number.isNaN(hours) && hours > 0) {
      totalHours += hours
      employeeIds.add(entry.employee_id)
    }
  })

  const roundedHours = Math.round(totalHours * 100) / 100

  const { data: pendingEntries, error: pendingError } = await supabase
    .from('time_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'pending_approval')
    .is('payroll_run_id', null)
    .gte('clock_in_reported_at', periodStartIso)
    .lte('clock_in_reported_at', periodEndIso)

  if (pendingError) {
    throw new ServiceError(`Failed to load pending approvals: ${pendingError.message}`, 500)
  }

  const typedPending = (pendingEntries as PendingEntry[]) || []

  const { data: doneAssignments, error: doneError } = await supabase
    .from('job_assignments')
    .select('job_id, worker_confirmed_done_at, updated_at')
    .eq('company_id', companyId)
    .eq('assignment_status', 'done')
    .or(
      `and(worker_confirmed_done_at.gte.${periodStartIso},worker_confirmed_done_at.lte.${periodEndIso}),and(worker_confirmed_done_at.is.null,updated_at.gte.${periodStartIso},updated_at.lte.${periodEndIso})`
    )

  if (doneError) {
    throw new ServiceError(`Failed to load completed jobs: ${doneError.message}`, 500)
  }

  const typedAssignments = (doneAssignments as AssignmentDoneRow[]) || []
  const jobIds = new Set<string>()
  typedAssignments.forEach((assignment) => {
    if (assignment.job_id) {
      jobIds.add(assignment.job_id)
    }
  })

  const { data: existingRun } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .eq('company_id', companyId)
    .lte('period_start', periodEndIso)
    .gte('period_end', periodStartIso)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()

  const typedExisting = existingRun as PayrollRunRow | null
  const periodComplete = endDate < today

  let status: PayrollCurrentSummary['status'] = 'in_progress'

  if (typedExisting) {
    status = 'run_exists'
  } else if (!periodComplete) {
    status = 'in_progress'
  } else if (roundedHours === 0) {
    status = 'no_hours'
  } else if (typedPending.length > 0) {
    status = 'pending_approval'
  } else {
    status = 'ready'
  }

  return {
    period_start: periodStartLabel,
    period_end: periodEndLabel,
    period_complete: periodComplete,
    status,
    approved_hours: roundedHours,
    approved_entries: typedApproved.length,
    pending_entries: typedPending.length,
    employees_with_hours: employeeIds.size,
    jobs_completed: jobIds.size,
    existing_run_id: typedExisting?.id,
    existing_run_status: typedExisting?.status,
  }
}
