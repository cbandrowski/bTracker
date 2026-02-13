import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { listApprovalRequests, ServiceError } from '@/lib/services/approvals'

const QuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'applied', 'failed']).optional(),
  company_id: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = QuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams))

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const companyId = query.company_id ?? companyIds[0]
    if (!companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
    }

    const approvals = await listApprovalRequests(supabase, user.id, companyId, query.status)
    return NextResponse.json({ approvals })
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
