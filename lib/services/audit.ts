import { SupabaseServerClient } from '@/lib/supabaseServer'
import { AuditLog, Profile } from '@/types/database'

export class ServiceError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.statusCode = statusCode
  }
}

export interface AuditLogWithActor extends AuditLog {
  actor_profile?: Profile | null
}

export interface AuditLogQuery {
  companyId: string
  actorId?: string
  entityTable?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface AuditLogResult {
  logs: AuditLogWithActor[]
  total: number
}

const actorProfileSelect = 'id, full_name, email, avatar_url'

export async function listAuditLogs(
  supabase: SupabaseServerClient,
  query: AuditLogQuery
): Promise<AuditLogResult> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = Math.max(query.offset ?? 0, 0)

  let request = supabase
    .from('audit_logs')
    .select(
      `
        id,
        company_id,
        actor_profile_id,
        action,
        entity_table,
        entity_id,
        before,
        after,
        diff,
        metadata,
        created_at,
        actor_profile:profiles(${actorProfileSelect})
      `,
      { count: 'exact' }
    )
    .eq('company_id', query.companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (query.actorId) {
    request = request.eq('actor_profile_id', query.actorId)
  }

  if (query.entityTable) {
    request = request.eq('entity_table', query.entityTable)
  }

  if (query.from) {
    request = request.gte('created_at', query.from)
  }

  if (query.to) {
    request = request.lte('created_at', query.to)
  }

  const { data, error, count } = await request

  if (error) {
    throw new ServiceError(`Failed to load audit logs: ${error.message}`, 500)
  }

  const logs = (data ?? []).map((row) => {
    const actorProfile = Array.isArray(row.actor_profile)
      ? row.actor_profile[0] ?? null
      : row.actor_profile ?? null
    return {
      ...row,
      actor_profile: actorProfile,
    } as AuditLogWithActor
  })

  return {
    logs,
    total: count ?? 0,
  }
}

export function buildAuditLogCsv(logs: AuditLogWithActor[]): string {
  const headers = [
    'created_at',
    'actor_name',
    'actor_email',
    'action',
    'entity_table',
    'entity_id',
    'diff',
  ]

  const rows = logs.map((log) => {
    const actorName = log.actor_profile?.full_name ?? ''
    const actorEmail = log.actor_profile?.email ?? ''
    const diff = log.diff ? JSON.stringify(log.diff) : ''

    return [
      log.created_at,
      actorName,
      actorEmail,
      log.action,
      log.entity_table,
      log.entity_id ?? '',
      diff,
    ]
  })

  const escapeCsv = (value: string) => {
    const needsQuotes = /[",\n]/.test(value)
    const escaped = value.replace(/"/g, '""')
    return needsQuotes ? `"${escaped}"` : escaped
  }

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.map((value) => escapeCsv(String(value))).join(',')),
  ]

  return csvLines.join('\n')
}
