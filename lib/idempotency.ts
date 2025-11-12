// Idempotency handling for POST requests
import { createServerClient } from './supabaseServer'

/**
 * Check if a request with this idempotency key has been processed before
 * If yes, return the cached response
 * If no, return null to proceed with processing
 */
export async function checkIdempotency(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  companyId: string,
  idempotencyKey: string,
  route: string
): Promise<{ status: number; body: any } | null> {
  const { data, error } = await supabase
    .from('request_idempotency')
    .select('*')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .eq('idempotency_key', idempotencyKey)
    .eq('route', route)
    .single()

  if (error || !data) {
    return null
  }

  return {
    status: data.response_status,
    body: data.response_body,
  }
}

/**
 * Store idempotency record for future duplicate requests
 */
export async function storeIdempotency(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  companyId: string,
  idempotencyKey: string,
  route: string,
  responseStatus: number,
  responseBody: any
): Promise<void> {
  await supabase.from('request_idempotency').insert({
    user_id: userId,
    company_id: companyId,
    idempotency_key: idempotencyKey,
    route,
    response_status: responseStatus,
    response_body: responseBody,
  })
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKey(headers: Headers): string | null {
  return headers.get('Idempotency-Key') || headers.get('idempotency-key')
}
