import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { getCompanyOverviewStats, ServiceError } from '@/lib/services/stats'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

const StatsQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  period: z.enum(['day', 'week', 'month', 'year', 'custom']).optional(),
  anchor_date: z.string().regex(dateRegex).optional(),
  start_date: z.string().regex(dateRegex).optional(),
  end_date: z.string().regex(dateRegex).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = StatsQuerySchema.parse(
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

    const stats = await getCompanyOverviewStats(supabase, {
      companyId,
      profileId: user.id,
      period: query.period,
      anchorDate: query.anchor_date,
      startDate: query.start_date,
      endDate: query.end_date,
      limit: query.limit,
    })

    return NextResponse.json(stats)
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
