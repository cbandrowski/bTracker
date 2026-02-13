import { SupabaseServerClient } from '@/lib/supabaseServer'
import {
  ApprovalDecision,
  ApprovalRequest,
  ApprovalRequestAction,
  ApprovalRequestStatus,
  JobWithCustomer,
  Profile,
} from '@/types/database'
import { UpdateInvoiceInput } from '@/lib/schemas/billing'
import { updateInvoice } from '@/lib/services/invoices'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const profileSelect = 'id, full_name, email, avatar_url'

export type ApprovalDecisionWithProfile = ApprovalDecision & {
  approver_profile?: Profile | null
}

export type ApprovalRequestWithDetails = ApprovalRequest & {
  requested_by_profile?: Profile | null
  approvals?: ApprovalDecisionWithProfile[]
}

export type ApprovalResult = {
  status: 'pending' | 'applied'
  approval?: ApprovalRequest
}

export type JobUpdatePayload = {
  title?: string
  summary?: string | null
  service_address?: string | null
  service_address_line_2?: string | null
  service_city?: string | null
  service_state?: string | null
  service_zipcode?: string | null
  service_country?: string | null
  tasks_to_complete?: string | null
  status?: 'upcoming' | 'in_progress' | 'done' | 'cancelled'
  planned_end_date?: string | null
  estimated_amount?: number | null
  arrival_window_start_time?: string | null
  arrival_window_end_time?: string | null
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

async function getOwnerCount(
  supabase: SupabaseServerClient,
  companyId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('company_owners')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)

  if (error) {
    throw new ServiceError(`Failed to load owner count: ${error.message}`, 500)
  }

  return count ?? 0
}

function buildSummary(action: ApprovalRequestAction, details: string) {
  switch (action) {
    case 'employee_pay_change':
      return `Pay change: ${details}`
    case 'job_update':
      return `Job edit: ${details}`
    case 'invoice_update':
      return `Invoice update: ${details}`
    default:
      return details
  }
}

async function applyApprovalRequest(
  supabase: SupabaseServerClient,
  request: ApprovalRequest,
  appliedBy: string
): Promise<unknown> {
  switch (request.action) {
    case 'employee_pay_change': {
      const payload = request.payload as { hourly_rate?: number | null }
      if (payload.hourly_rate === undefined) {
        throw new ServiceError('Missing hourly rate in approval payload', 422)
      }

      const { error } = await supabase
        .from('company_employees')
        .update({
          hourly_rate: payload.hourly_rate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.entity_id)
        .eq('company_id', request.company_id)

      if (error) {
        throw new ServiceError(`Failed to apply pay change: ${error.message}`, 500)
      }
      return null
    }
    case 'job_update': {
      const payload = request.payload as Record<string, unknown>
      const { error } = await supabase
        .from('jobs')
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.entity_id)
        .eq('company_id', request.company_id)

      if (error) {
        throw new ServiceError(`Failed to apply job update: ${error.message}`, 500)
      }
      return null
    }
    case 'invoice_update': {
      const payload = request.payload as UpdateInvoiceInput
      const result = await updateInvoice(
        supabase,
        request.entity_id,
        [request.company_id],
        appliedBy,
        payload
      )
      return result
    }
    default:
      throw new ServiceError('Unsupported approval action', 422)
  }
}

async function createApprovalRequest(
  supabase: SupabaseServerClient,
  input: {
    companyId: string
    requestedBy: string
    action: ApprovalRequestAction
    entityTable: string
    entityId: string
    entityLabel?: string | null
    summary?: string | null
    payload: Record<string, unknown>
  }
): Promise<{ request: ApprovalRequest; applied: boolean; applyResult?: unknown }> {
  const ownerCount = await getOwnerCount(supabase, input.companyId)
  const requiredApprovals = ownerCount > 1 ? 1 : 0
  const now = new Date().toISOString()
  const status: ApprovalRequestStatus = requiredApprovals === 0 ? 'approved' : 'pending'

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      company_id: input.companyId,
      action: input.action,
      entity_table: input.entityTable,
      entity_id: input.entityId,
      entity_label: input.entityLabel ?? null,
      summary: input.summary ?? null,
      payload: input.payload,
      requested_by: input.requestedBy,
      status,
      required_approvals: requiredApprovals,
      approved_at: status === 'approved' ? now : null,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new ServiceError(`Failed to create approval request: ${error?.message || 'Unknown error'}`, 500)
  }

  const request = data as ApprovalRequest

  if (status === 'approved') {
    try {
      const applyResult = await applyApprovalRequest(supabase, request, input.requestedBy)
      const { data: applied } = await supabase
        .from('approval_requests')
        .update({
          status: 'applied',
          applied_at: now,
          applied_by: input.requestedBy,
        })
        .eq('id', request.id)
        .select('*')
        .single()

      return {
        request: (applied as ApprovalRequest) || request,
        applied: true,
        applyResult,
      }
    } catch (err) {
      await supabase
        .from('approval_requests')
        .update({
          status: 'failed',
          applied_at: now,
          applied_by: input.requestedBy,
        })
        .eq('id', request.id)

      throw err
    }
  }

  return { request, applied: false }
}

export async function listApprovalRequests(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  status?: ApprovalRequestStatus
): Promise<ApprovalRequestWithDetails[]> {
  await assertOwnerAccess(supabase, profileId, companyId)

  let query = supabase
    .from('approval_requests')
    .select(
      `
        *,
        requested_by_profile:profiles(${profileSelect}),
        approvals:approval_decisions(
          id,
          decision,
          approver_profile_id,
          note,
          created_at,
          approver_profile:profiles(${profileSelect})
        )
      `
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw new ServiceError(`Failed to load approval requests: ${error.message}`, 500)
  }

  return (data as ApprovalRequestWithDetails[]) || []
}

export async function requestEmployeePayChange(
  supabase: SupabaseServerClient,
  profileId: string,
  employeeId: string,
  newRate: number | null
): Promise<{ approval: ApprovalRequest | null; applied: boolean }> {
  const { data: employee, error } = await supabase
    .from('company_employees')
    .select(
      `
        id,
        company_id,
        hourly_rate,
        profile:profiles(${profileSelect})
      `
    )
    .eq('id', employeeId)
    .single()

  if (error || !employee) {
    throw new ServiceError('Employee not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, employee.company_id)

  const currentRate = employee.hourly_rate
  const normalizedCurrent = currentRate === null ? null : Number(currentRate)
  const normalizedNew = newRate === null ? null : Number(newRate)

  if (normalizedCurrent === normalizedNew) {
    return { approval: null, applied: false }
  }

  const profile = Array.isArray(employee.profile) ? employee.profile[0] : employee.profile
  const label = profile?.full_name || profile?.email || null
  const summary = buildSummary(
    'employee_pay_change',
    `$${(normalizedCurrent ?? 0).toFixed(2)} → $${(normalizedNew ?? 0).toFixed(2)}`
  )

  const { request, applied } = await createApprovalRequest(supabase, {
    companyId: employee.company_id,
    requestedBy: profileId,
    action: 'employee_pay_change',
    entityTable: 'company_employees',
    entityId: employeeId,
    entityLabel: label,
    summary,
    payload: { hourly_rate: normalizedNew },
  })

  return { approval: request, applied }
}

export async function requestJobUpdate(
  supabase: SupabaseServerClient,
  profileId: string,
  jobId: string,
  updates: JobUpdatePayload
): Promise<{ approval: ApprovalRequest | null; applied: boolean; job: JobWithCustomer | null }> {
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, company_id, status, title')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    throw new ServiceError('Job not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, job.company_id)

  const updatePayload: Record<string, unknown> = {}
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      updatePayload[key] = value
    }
  })

  if (updates.status === 'done' && job.status !== 'done') {
    updatePayload.completed_at = new Date().toISOString()
  }

  const fetchJobWithCustomer = async () => {
    const { data: detailed } = await supabase
      .from('jobs')
      .select('*, customer:customers(*)')
      .eq('id', jobId)
      .single()
    return (detailed as JobWithCustomer) || null
  }

  if (Object.keys(updatePayload).length === 0) {
    return { approval: null, applied: false, job: await fetchJobWithCustomer() }
  }

  const changedFields = Object.keys(updatePayload).filter((field) => field !== 'completed_at')
  const summary = buildSummary('job_update', changedFields.join(', ') || 'updates')

  const { request, applied } = await createApprovalRequest(supabase, {
    companyId: job.company_id,
    requestedBy: profileId,
    action: 'job_update',
    entityTable: 'jobs',
    entityId: jobId,
    entityLabel: job.title,
    summary,
    payload: updatePayload,
  })

  const jobWithCustomer = await fetchJobWithCustomer()
  return { approval: request, applied, job: jobWithCustomer }
}

export async function requestInvoiceUpdate(
  supabase: SupabaseServerClient,
  profileId: string,
  invoiceId: string,
  payload: UpdateInvoiceInput
): Promise<{ approval: ApprovalRequest | null; applied: boolean; result?: unknown }> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, company_id, invoice_number')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    throw new ServiceError('Invoice not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, invoice.company_id)

  const summary = buildSummary(
    'invoice_update',
    `${invoice.invoice_number} · ${payload.lines.length} lines`
  )

  const { request, applied, applyResult } = await createApprovalRequest(supabase, {
    companyId: invoice.company_id,
    requestedBy: profileId,
    action: 'invoice_update',
    entityTable: 'invoices',
    entityId: invoiceId,
    entityLabel: invoice.invoice_number,
    summary,
    payload: payload as Record<string, unknown>,
  })

  if (applied && applyResult) {
    return { approval: request, applied: true, result: applyResult }
  }

  return { approval: request, applied }
}

export async function approveApprovalRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  requestId: string
): Promise<ApprovalRequest> {
  const { data: request, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    throw new ServiceError('Approval request not found', 404)
  }

  const approvalRequest = request as ApprovalRequest

  await assertOwnerAccess(supabase, profileId, approvalRequest.company_id)

  if (approvalRequest.status !== 'pending') {
    return approvalRequest
  }

  if (approvalRequest.requested_by === profileId) {
    throw new ServiceError('Requesters cannot approve their own requests', 403)
  }

  const { error: insertError } = await supabase
    .from('approval_decisions')
    .insert({
      approval_id: requestId,
      approver_profile_id: profileId,
      decision: 'approve',
    })

  if (insertError) {
    throw new ServiceError(`Failed to record approval: ${insertError.message}`, 500)
  }

  const { data: decisions } = await supabase
    .from('approval_decisions')
    .select('decision')
    .eq('approval_id', requestId)

  const approvals = (decisions || []).filter((d) => d.decision === 'approve').length
  const rejections = (decisions || []).filter((d) => d.decision === 'reject').length

  if (rejections > 0) {
    const { data: rejected } = await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single()

    return (rejected as ApprovalRequest) || approvalRequest
  }

  if (approvals >= approvalRequest.required_approvals) {
    const approvedAt = new Date().toISOString()
    await supabase
      .from('approval_requests')
      .update({
        status: 'approved',
        approved_at: approvedAt,
      })
      .eq('id', requestId)

    try {
      await applyApprovalRequest(supabase, approvalRequest, profileId)
      const { data: applied } = await supabase
        .from('approval_requests')
        .update({
          status: 'applied',
          applied_at: approvedAt,
          applied_by: profileId,
        })
        .eq('id', requestId)
        .select('*')
        .single()

      return (applied as ApprovalRequest) || approvalRequest
    } catch (err) {
      await supabase
        .from('approval_requests')
        .update({
          status: 'failed',
          applied_at: approvedAt,
          applied_by: profileId,
        })
        .eq('id', requestId)

      throw err
    }
  }

  return approvalRequest
}

export async function rejectApprovalRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  requestId: string
): Promise<ApprovalRequest> {
  const { data: request, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    throw new ServiceError('Approval request not found', 404)
  }

  const approvalRequest = request as ApprovalRequest

  await assertOwnerAccess(supabase, profileId, approvalRequest.company_id)

  if (approvalRequest.status !== 'pending') {
    return approvalRequest
  }

  if (approvalRequest.requested_by === profileId) {
    throw new ServiceError('Requesters cannot reject their own requests', 403)
  }

  const { error: insertError } = await supabase
    .from('approval_decisions')
    .insert({
      approval_id: requestId,
      approver_profile_id: profileId,
      decision: 'reject',
    })

  if (insertError) {
    throw new ServiceError(`Failed to record rejection: ${insertError.message}`, 500)
  }

  const { data: rejected } = await supabase
    .from('approval_requests')
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()

  return (rejected as ApprovalRequest) || approvalRequest
}

export async function cancelApprovalRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  requestId: string
): Promise<ApprovalRequest> {
  const { data: request, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    throw new ServiceError('Approval request not found', 404)
  }

  const approvalRequest = request as ApprovalRequest

  await assertOwnerAccess(supabase, profileId, approvalRequest.company_id)

  if (approvalRequest.requested_by !== profileId) {
    throw new ServiceError('Only the requester can cancel this approval', 403)
  }

  if (approvalRequest.status !== 'pending') {
    return approvalRequest
  }

  const { data: cancelled } = await supabase
    .from('approval_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()

  return (cancelled as ApprovalRequest) || approvalRequest
}
