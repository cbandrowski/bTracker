import { SupabaseServerClient } from '@/lib/supabaseServer'
import {
  CompanyOwner,
  OwnerChangeAction,
  OwnerChangeApproval,
  OwnerChangeDecision,
  OwnerChangeRequest,
  OwnerChangeStatus,
  Profile,
} from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

const profileSelect = 'id, full_name, email, avatar_url'

export interface OwnerWithProfile extends CompanyOwner {
  profile?: Profile | null
}

export interface OwnerChangeApprovalWithProfile extends OwnerChangeApproval {
  approver_profile?: Profile | null
}

export interface OwnerChangeRequestWithDetails extends OwnerChangeRequest {
  target_profile?: Profile | null
  created_by_profile?: Profile | null
  approvals?: OwnerChangeApprovalWithProfile[]
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

async function getCompanyOwners(
  supabase: SupabaseServerClient,
  companyId: string
): Promise<CompanyOwner[]> {
  const { data, error } = await supabase
    .from('company_owners')
    .select('id, company_id, profile_id, ownership_percentage, is_primary_owner, created_at, updated_at')
    .eq('company_id', companyId)

  if (error) {
    throw new ServiceError(`Failed to load company owners: ${error.message}`, 500)
  }

  return (data ?? []) as CompanyOwner[]
}

function computeRequiredApprovals(ownerCount: number): number {
  if (ownerCount <= 1) return 0
  return Math.ceil((ownerCount - 1) / 2)
}

async function getProfileByEmail(
  supabase: SupabaseServerClient,
  email: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new ServiceError(`Failed to find profile: ${error.message}`, 500)
  }

  return (data as Profile) || null
}

export async function listOwnersForCompany(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
): Promise<OwnerWithProfile[]> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const { data, error } = await supabase
    .from('company_owners')
    .select(`
      id,
      company_id,
      profile_id,
      ownership_percentage,
      is_primary_owner,
      created_at,
      updated_at,
      profile:profiles(${profileSelect})
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new ServiceError(`Failed to load owners: ${error.message}`, 500)
  }

  return (data ?? []) as OwnerWithProfile[]
}

export async function listOwnerChangeRequests(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string
): Promise<OwnerChangeRequestWithDetails[]> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const { data, error } = await supabase
    .from('owner_change_requests')
    .select(`
      id,
      company_id,
      action,
      target_profile_id,
      created_by,
      status,
      required_approvals,
      cooldown_hours,
      approved_at,
      effective_at,
      executed_at,
      rejected_at,
      cancelled_at,
      created_at,
      updated_at,
      target_profile:profiles!owner_change_requests_target_profile_id_fkey(${profileSelect}),
      created_by_profile:profiles!owner_change_requests_created_by_fkey(${profileSelect}),
      approvals:owner_change_approvals(
        id,
        request_id,
        approver_profile_id,
        decision,
        created_at,
        approver_profile:profiles!owner_change_approvals_approver_profile_id_fkey(${profileSelect})
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ServiceError(`Failed to load owner change requests: ${error.message}`, 500)
  }

  return (data ?? []) as OwnerChangeRequestWithDetails[]
}

export async function createOwnerChangeRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  action: OwnerChangeAction,
  targetProfileId: string
): Promise<OwnerChangeRequest> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const owners = await getCompanyOwners(supabase, companyId)
  const ownerCount = owners.length

  const targetIsOwner = owners.some((owner) => owner.profile_id === targetProfileId)

  if (action === 'add_owner' && targetIsOwner) {
    throw new ServiceError('Target user is already an owner', 400)
  }

  if (action === 'remove_owner' && !targetIsOwner) {
    throw new ServiceError('Target user is not an owner', 400)
  }

  if (action === 'remove_owner' && ownerCount <= 1) {
    throw new ServiceError('Cannot remove the last remaining owner', 400)
  }

  const requiredApprovals = computeRequiredApprovals(ownerCount)
  const cooldownHours = action === 'remove_owner' ? 24 : 0

  const shouldAutoApprove = action === 'add_owner' && requiredApprovals === 0
  const status: OwnerChangeStatus = shouldAutoApprove ? 'approved' : 'pending'
  const now = new Date().toISOString()

  const { data: request, error } = await supabase
    .from('owner_change_requests')
    .insert({
      company_id: companyId,
      action,
      target_profile_id: targetProfileId,
      created_by: profileId,
      status,
      required_approvals: requiredApprovals,
      cooldown_hours: cooldownHours,
      approved_at: shouldAutoApprove ? now : null,
      effective_at: null,
    })
    .select('*')
    .single()

  if (error || !request) {
    if (error?.code === '23505') {
      throw new ServiceError('A pending request already exists for this owner change', 409)
    }
    throw new ServiceError(`Failed to create owner change request: ${error?.message || 'Unknown error'}`, 500)
  }

  if (shouldAutoApprove && action === 'add_owner') {
    await insertOwnerFromApprovedRequest(supabase, companyId, targetProfileId)
    const executed = await markRequestExecuted(supabase, request.id)
    return executed
  }

  return request as OwnerChangeRequest
}

export async function createOwnerChangeRequestByEmail(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  action: OwnerChangeAction,
  targetEmail: string
): Promise<OwnerChangeRequest> {
  const profile = await getProfileByEmail(supabase, targetEmail)
  if (!profile) {
    throw new ServiceError('No user found with that email', 404)
  }

  return createOwnerChangeRequest(supabase, profileId, companyId, action, profile.id)
}

export async function approveOwnerChangeRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  requestId: string
): Promise<OwnerChangeRequest> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const request = await getOwnerChangeRequestById(supabase, companyId, requestId)

  if (request.status !== 'pending') {
    throw new ServiceError('Only pending requests can be approved', 400)
  }

  if (request.created_by && request.created_by === profileId) {
    throw new ServiceError('Request creator cannot approve their own request', 400)
  }

  const { error: insertError } = await supabase
    .from('owner_change_approvals')
    .insert({
      request_id: request.id,
      approver_profile_id: profileId,
      decision: 'approve' as OwnerChangeDecision,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return request as OwnerChangeRequest
    }
    throw new ServiceError(`Failed to record approval: ${insertError.message}`, 500)
  }

  return evaluateOwnerChangeRequest(supabase, request.id)
}

export async function rejectOwnerChangeRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  requestId: string
): Promise<OwnerChangeRequest> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const request = await getOwnerChangeRequestById(supabase, companyId, requestId)

  if (request.status !== 'pending') {
    throw new ServiceError('Only pending requests can be rejected', 400)
  }

  if (request.created_by && request.created_by === profileId) {
    throw new ServiceError('Request creator cannot reject their own request', 400)
  }

  const { error: insertError } = await supabase
    .from('owner_change_approvals')
    .insert({
      request_id: request.id,
      approver_profile_id: profileId,
      decision: 'reject' as OwnerChangeDecision,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return request as OwnerChangeRequest
    }
    throw new ServiceError(`Failed to record rejection: ${insertError.message}`, 500)
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('owner_change_requests')
    .update({ status: 'rejected', rejected_at: now })
    .eq('id', request.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw new ServiceError(`Failed to reject request: ${error?.message || 'Unknown error'}`, 500)
  }

  return updated as OwnerChangeRequest
}

export async function cancelOwnerChangeRequest(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  requestId: string
): Promise<OwnerChangeRequest> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const request = await getOwnerChangeRequestById(supabase, companyId, requestId)

  if (request.created_by !== profileId) {
    throw new ServiceError('Only the request creator can cancel this request', 403)
  }

  if (request.status !== 'pending' && request.status !== 'approved') {
    throw new ServiceError('Only pending or approved requests can be cancelled', 400)
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from('owner_change_requests')
    .update({ status: 'cancelled', cancelled_at: now })
    .eq('id', request.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw new ServiceError(`Failed to cancel request: ${error?.message || 'Unknown error'}`, 500)
  }

  return updated as OwnerChangeRequest
}

export async function finalizeOwnerRemoval(
  supabase: SupabaseServerClient,
  profileId: string,
  companyId: string,
  requestId: string
): Promise<OwnerChangeRequest> {
  await assertOwnerAccess(supabase, profileId, companyId)

  const request = await getOwnerChangeRequestById(supabase, companyId, requestId)

  if (request.action !== 'remove_owner') {
    throw new ServiceError('Only removal requests can be finalized here', 400)
  }

  if (request.status !== 'approved') {
    throw new ServiceError('Only approved requests can be finalized', 400)
  }

  if (request.effective_at) {
    const effectiveAt = new Date(request.effective_at).getTime()
    if (Number.isNaN(effectiveAt)) {
      throw new ServiceError('Invalid effective_at value on request', 500)
    }

    if (effectiveAt > Date.now()) {
      throw new ServiceError('Cooldown period has not completed yet', 400)
    }
  }

  const owners = await getCompanyOwners(supabase, companyId)
  if (owners.length <= 1) {
    throw new ServiceError('Cannot remove the last remaining owner', 400)
  }

  const { error: deleteError } = await supabase
    .from('company_owners')
    .delete()
    .eq('company_id', companyId)
    .eq('profile_id', request.target_profile_id)

  if (deleteError) {
    throw new ServiceError(`Failed to remove owner: ${deleteError.message}`, 500)
  }

  const executed = await markRequestExecuted(supabase, request.id)
  return executed
}

async function getOwnerChangeRequestById(
  supabase: SupabaseServerClient,
  companyId: string,
  requestId: string
): Promise<OwnerChangeRequest> {
  const { data, error } = await supabase
    .from('owner_change_requests')
    .select('*')
    .eq('id', requestId)
    .eq('company_id', companyId)
    .single()

  if (error || !data) {
    throw new ServiceError('Owner change request not found', 404)
  }

  return data as OwnerChangeRequest
}

async function insertOwnerFromApprovedRequest(
  supabase: SupabaseServerClient,
  companyId: string,
  targetProfileId: string
) {
  const { error } = await supabase
    .from('company_owners')
    .insert({
      company_id: companyId,
      profile_id: targetProfileId,
      is_primary_owner: false,
      ownership_percentage: null,
    })

  if (error) {
    throw new ServiceError(`Failed to add owner: ${error.message}`, 500)
  }
}

async function markRequestExecuted(
  supabase: SupabaseServerClient,
  requestId: string
): Promise<OwnerChangeRequest> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('owner_change_requests')
    .update({ status: 'executed', executed_at: now })
    .eq('id', requestId)
    .select('*')
    .single()

  if (error || !data) {
    throw new ServiceError(`Failed to update request status: ${error?.message || 'Unknown error'}`, 500)
  }

  return data as OwnerChangeRequest
}

async function evaluateOwnerChangeRequest(
  supabase: SupabaseServerClient,
  requestId: string
): Promise<OwnerChangeRequest> {
  const { data: request, error } = await supabase
    .from('owner_change_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !request) {
    throw new ServiceError('Owner change request not found', 404)
  }

  if (request.status !== 'pending') {
    return request as OwnerChangeRequest
  }

  const { data: approvals, error: approvalsError } = await supabase
    .from('owner_change_approvals')
    .select('approver_profile_id, decision')
    .eq('request_id', requestId)

  if (approvalsError) {
    throw new ServiceError(`Failed to load approvals: ${approvalsError.message}`, 500)
  }

  const approvalsList = approvals ?? []
  const approvalCount = approvalsList.filter((approval) => approval.decision === 'approve').length
  const rejectionCount = approvalsList.filter((approval) => approval.decision === 'reject').length

  if (rejectionCount > 0) {
    const now = new Date().toISOString()
    const { data: rejected, error: rejectError } = await supabase
      .from('owner_change_requests')
      .update({ status: 'rejected', rejected_at: now })
      .eq('id', requestId)
      .select('*')
      .single()

    if (rejectError || !rejected) {
      throw new ServiceError(`Failed to mark request rejected: ${rejectError?.message || 'Unknown error'}`, 500)
    }

    return rejected as OwnerChangeRequest
  }

  const targetApprovalRequired =
    request.action === 'remove_owner' && request.target_profile_id !== request.created_by

  const hasTargetApproval = approvalsList.some(
    (approval) =>
      approval.decision === 'approve' && approval.approver_profile_id === request.target_profile_id
  )

  const meetsApprovals = approvalCount >= Number(request.required_approvals || 0)

  if (!meetsApprovals || (targetApprovalRequired && !hasTargetApproval)) {
    return request as OwnerChangeRequest
  }

  const approvedAt = new Date()
  const approvedAtIso = approvedAt.toISOString()

  if (request.action === 'add_owner') {
    const { data: updated, error: updateError } = await supabase
      .from('owner_change_requests')
      .update({ status: 'approved', approved_at: approvedAtIso })
      .eq('id', requestId)
      .select('*')
      .single()

    if (updateError || !updated) {
      throw new ServiceError(`Failed to approve request: ${updateError?.message || 'Unknown error'}`, 500)
    }

    const { data: ownerExists } = await supabase
      .from('company_owners')
      .select('id')
      .eq('company_id', request.company_id)
      .eq('profile_id', request.target_profile_id)
      .maybeSingle()

    if (!ownerExists) {
      await insertOwnerFromApprovedRequest(supabase, request.company_id, request.target_profile_id)
    }

    return markRequestExecuted(supabase, requestId)
  }

  const cooldownHours = Number(request.cooldown_hours || 0)
  const effectiveAt = new Date(approvedAt.getTime() + cooldownHours * 60 * 60 * 1000)

  const { data: approved, error: approveError } = await supabase
    .from('owner_change_requests')
    .update({
      status: 'approved',
      approved_at: approvedAtIso,
      effective_at: effectiveAt.toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()

  if (approveError || !approved) {
    throw new ServiceError(`Failed to approve request: ${approveError?.message || 'Unknown error'}`, 500)
  }

  return approved as OwnerChangeRequest
}
