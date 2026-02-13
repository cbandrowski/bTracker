import { SupabaseServerClient } from '@/lib/supabaseServer'
import { CompanyOverviewStats, StatsPeriod, StatsRange } from '@/types/stats'
import { Profile } from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const profileSelect = 'id, full_name, email, avatar_url'

interface StatsOptions {
  companyId: string
  profileId: string
  period?: StatsPeriod
  anchorDate?: string
  startDate?: string
  endDate?: string
  limit?: number
}

interface EmployeeRow {
  id: string
  profile: Profile | null
}

interface OwnerRow {
  profile_id: string
  profile: Profile | null
}

function parseDateOnly(value?: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function resolveRange(
  period: StatsPeriod,
  anchorDate?: string,
  startDate?: string,
  endDate?: string
): StatsRange {
  const startOverride = parseDateOnly(startDate)
  const endOverride = parseDateOnly(endDate)

  if (startOverride) {
    const endInclusive = endOverride ?? startOverride
    const endExclusive = addDays(endInclusive, 1)
    return {
      period: 'custom',
      start: startOverride.toISOString(),
      end: endExclusive.toISOString(),
      label: `${formatDateLabel(startOverride)} - ${formatDateLabel(endInclusive)}`,
    }
  }

  const anchor = parseDateOnly(anchorDate) ?? new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ))

  switch (period) {
    case 'day': {
      const start = anchor
      const end = addDays(start, 1)
      return {
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatDateLabel(start),
      }
    }
    case 'week': {
      const day = anchor.getUTCDay()
      const offset = (day + 6) % 7
      const start = addDays(anchor, -offset)
      const end = addDays(start, 7)
      return {
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        label: `Week of ${formatDateLabel(start)}`,
      }
    }
    case 'year': {
      const start = new Date(Date.UTC(anchor.getUTCFullYear(), 0, 1))
      const end = new Date(Date.UTC(anchor.getUTCFullYear() + 1, 0, 1))
      return {
        period,
        start: start.toISOString(),
        end: end.toISOString(),
        label: `${anchor.getUTCFullYear()}`,
      }
    }
    case 'month':
    default: {
      const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
      const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
      const label = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(start)
      return {
        period: 'month',
        start: start.toISOString(),
        end: end.toISOString(),
        label,
      }
    }
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

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

export async function getCompanyOverviewStats(
  supabase: SupabaseServerClient,
  options: StatsOptions
): Promise<CompanyOverviewStats> {
  const { companyId, profileId, period = 'month', anchorDate, startDate, endDate } = options
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)

  await assertOwnerAccess(supabase, profileId, companyId)

  const range = resolveRange(period, anchorDate, startDate, endDate)

  const { data: employeeRows, error: employeeError } = await supabase
    .from('company_employees')
    .select(`id, profile:profiles(${profileSelect})`)
    .eq('company_id', companyId)

  if (employeeError) {
    throw new ServiceError(`Failed to load employees: ${employeeError.message}`, 500)
  }

  const employees = (employeeRows ?? []) as unknown as EmployeeRow[]
  const employeeProfileMap = new Map<string, Profile | null>()
  employees.forEach((employee) => {
    employeeProfileMap.set(employee.id, employee.profile ?? null)
  })

  const { data: ownerRows, error: ownerError } = await supabase
    .from('company_owners')
    .select(`profile_id, profile:profiles(${profileSelect})`)
    .eq('company_id', companyId)

  if (ownerError) {
    throw new ServiceError(`Failed to load owners: ${ownerError.message}`, 500)
  }

  const owners = (ownerRows ?? []) as unknown as OwnerRow[]
  const ownerProfileMap = new Map<string, Profile | null>()
  owners.forEach((owner) => {
    ownerProfileMap.set(owner.profile_id, owner.profile ?? null)
  })

  const completionFilter = `and(completed_at.gte.${range.start},completed_at.lt.${range.end}),and(completed_at.is.null,updated_at.gte.${range.start},updated_at.lt.${range.end})`

  const { data: jobRows, error: jobError } = await supabase
    .from('jobs')
    .select('id, completed_at, updated_at')
    .eq('company_id', companyId)
    .eq('status', 'done')
    .or(completionFilter)

  if (jobError) {
    throw new ServiceError(`Failed to load jobs: ${jobError.message}`, 500)
  }

  const jobIds = (jobRows ?? []).map((job) => job.id)
  const jobIdSet = new Set(jobIds)

  const jobsByEmployee = new Map<string, Set<string>>()
  if (jobIds.length > 0) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from('job_assignments')
      .select('employee_id, job_id')
      .eq('company_id', companyId)
      .in('job_id', jobIds)

    if (assignmentError) {
      throw new ServiceError(`Failed to load job assignments: ${assignmentError.message}`, 500)
    }

    ;(assignmentRows ?? []).forEach((assignment) => {
      const employeeId = assignment.employee_id as string
      const jobId = assignment.job_id as string
      if (!employeeId || !jobId) return
      const existing = jobsByEmployee.get(employeeId) ?? new Set<string>()
      existing.add(jobId)
      jobsByEmployee.set(employeeId, existing)
    })
  }

  const jobsByEmployeeList = Array.from(jobsByEmployee.entries())
    .map(([employeeId, jobSet]) => ({
      employee_id: employeeId,
      profile: employeeProfileMap.get(employeeId) ?? null,
      jobs_completed: jobSet.size,
    }))
    .sort((a, b) => b.jobs_completed - a.jobs_completed)
    .slice(0, limit)

  const { data: timeRows, error: timeError } = await supabase
    .from('time_entries')
    .select('employee_id, clock_in_approved_at, clock_out_approved_at, regular_hours, overtime_hours')
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .gte('clock_in_approved_at', range.start)
    .lt('clock_in_approved_at', range.end)

  if (timeError) {
    throw new ServiceError(`Failed to load time entries: ${timeError.message}`, 500)
  }

  const hoursByEmployee = new Map<string, { regular: number; overtime: number }>()

  ;(timeRows ?? []).forEach((entry) => {
    const employeeId = entry.employee_id as string
    if (!employeeId) return

    let regularHours = entry.regular_hours as number | null
    let overtimeHours = entry.overtime_hours as number | null

    if (regularHours === null && overtimeHours === null) {
      const clockIn = entry.clock_in_approved_at
      const clockOut = entry.clock_out_approved_at
      if (clockIn && clockOut) {
        const duration = new Date(clockOut).getTime() - new Date(clockIn).getTime()
        const hours = Math.max(duration / (1000 * 60 * 60), 0)
        regularHours = Number(hours.toFixed(2))
        overtimeHours = 0
      }
    }

    regularHours = regularHours ?? 0
    overtimeHours = overtimeHours ?? 0

    const existing = hoursByEmployee.get(employeeId) ?? { regular: 0, overtime: 0 }
    existing.regular += regularHours
    existing.overtime += overtimeHours
    hoursByEmployee.set(employeeId, existing)
  })

  const hoursByEmployeeList = Array.from(hoursByEmployee.entries())
    .map(([employeeId, hours]) => ({
      employee_id: employeeId,
      profile: employeeProfileMap.get(employeeId) ?? null,
      hours_regular: Number(hours.regular.toFixed(2)),
      hours_overtime: Number(hours.overtime.toFixed(2)),
      hours_total: Number((hours.regular + hours.overtime).toFixed(2)),
    }))
    .sort((a, b) => b.hours_total - a.hours_total)
    .slice(0, limit)

  const { data: invoiceRows, error: invoiceError } = await supabase
    .from('invoices')
    .select('created_by')
    .eq('company_id', companyId)
    .gte('created_at', range.start)
    .lt('created_at', range.end)

  if (invoiceError) {
    throw new ServiceError(`Failed to load invoices: ${invoiceError.message}`, 500)
  }

  const { data: paymentRows, error: paymentError } = await supabase
    .from('payments')
    .select('created_by')
    .eq('company_id', companyId)
    .gte('created_at', range.start)
    .lt('created_at', range.end)

  if (paymentError) {
    throw new ServiceError(`Failed to load payments: ${paymentError.message}`, 500)
  }

  const { data: auditRows, error: auditError } = await supabase
    .from('audit_logs')
    .select('actor_profile_id, entity_table, action')
    .eq('company_id', companyId)
    .in('entity_table', ['jobs', 'job_assignments', 'invoices'])
    .in('action', ['insert', 'update'])
    .gte('created_at', range.start)
    .lt('created_at', range.end)

  if (auditError) {
    throw new ServiceError(`Failed to load audit logs: ${auditError.message}`, 500)
  }

  const ownerActivityMap = new Map<string, {
    jobs_created: number
    jobs_assigned: number
    invoices_created: number
    invoice_updates: number
    payments_recorded: number
  }>()

  owners.forEach((owner) => {
    ownerActivityMap.set(owner.profile_id, {
      jobs_created: 0,
      jobs_assigned: 0,
      invoices_created: 0,
      invoice_updates: 0,
      payments_recorded: 0,
    })
  })

  ;(auditRows ?? []).forEach((row) => {
    const actorId = row.actor_profile_id as string | null
    if (!actorId || !ownerActivityMap.has(actorId)) return

    const stats = ownerActivityMap.get(actorId)!
    if (row.entity_table === 'jobs' && row.action === 'insert') {
      stats.jobs_created += 1
    }
    if (row.entity_table === 'job_assignments' && row.action === 'insert') {
      stats.jobs_assigned += 1
    }
    if (row.entity_table === 'invoices' && row.action === 'update') {
      stats.invoice_updates += 1
    }
  })

  ;(invoiceRows ?? []).forEach((row) => {
    const creator = row.created_by as string | null
    if (!creator || !ownerActivityMap.has(creator)) return
    ownerActivityMap.get(creator)!.invoices_created += 1
  })

  ;(paymentRows ?? []).forEach((row) => {
    const creator = row.created_by as string | null
    if (!creator || !ownerActivityMap.has(creator)) return
    ownerActivityMap.get(creator)!.payments_recorded += 1
  })

  const ownerActivity = Array.from(ownerActivityMap.entries())
    .map(([ownerId, stats]) => ({
      owner_profile_id: ownerId,
      profile: ownerProfileMap.get(ownerId) ?? null,
      ...stats,
    }))
    .sort((a, b) => {
      const leftTotal = a.jobs_created + a.jobs_assigned + a.invoices_created + a.payments_recorded
      const rightTotal = b.jobs_created + b.jobs_assigned + b.invoices_created + b.payments_recorded
      return rightTotal - leftTotal
    })

  const totals = {
    jobs_completed: jobIdSet.size,
    hours_total: Number(sumNumbers(hoursByEmployeeList.map((row) => row.hours_total)).toFixed(2)),
    invoices_created: (invoiceRows ?? []).length,
    payments_recorded: (paymentRows ?? []).length,
  }

  return {
    range,
    totals,
    jobs_by_employee: jobsByEmployeeList,
    hours_by_employee: hoursByEmployeeList,
    owner_activity: ownerActivity,
  }
}
