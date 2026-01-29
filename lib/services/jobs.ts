import { SupabaseServerClient } from '@/lib/supabaseServer'
import { Job, JobWithCustomer } from '@/types/database'

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

export async function setJobBillingHold(
  supabase: SupabaseServerClient,
  profileId: string,
  jobId: string,
  billingHold: boolean
): Promise<JobWithCustomer> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id, status')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError) {
    throw new ServiceError(`Failed to load job: ${jobError.message}`, 500)
  }

  const typedJob = job as Pick<Job, 'company_id' | 'status'> | null
  if (!typedJob) {
    throw new ServiceError('Job not found', 404)
  }

  await assertOwnerAccess(supabase, profileId, typedJob.company_id)

  if (typedJob.status !== 'done') {
    throw new ServiceError('Job must be done before changing billing hold', 422)
  }

  const { data: updated, error: updateError } = await supabase
    .from('jobs')
    .update({ billing_hold: billingHold })
    .eq('id', jobId)
    .select(`
      *,
      customer:customers(*)
    `)
    .single()

  if (updateError) {
    throw new ServiceError(`Failed to update job: ${updateError.message}`, 500)
  }

  return updated as JobWithCustomer
}
