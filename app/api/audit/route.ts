import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { listAuditLogs, ServiceError } from '@/lib/services/audit'

const AuditQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  entity_table: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = AuditQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = query.company_id ?? companyIds[0]

    if (!companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
    }

    const result = await listAuditLogs(supabase, {
      companyId,
      actorId: query.actor_id,
      entityTable: query.entity_table,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
