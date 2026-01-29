import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getActiveCompanyContext, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { getCurrentPayrollSummary, ServiceError } from '@/lib/services/payroll'

const CurrentSummaryQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
}).passthrough()

// GET /api/payroll/current-summary - Summary for the active payroll period
export async function GET(request: NextRequest) {
  try {
    const query = CurrentSummaryQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    let companyId = companyIds[0]
    if (query.company_id) {
      if (!companyIds.includes(query.company_id)) {
        return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
      }
      companyId = query.company_id
    } else {
      const context = await getActiveCompanyContext(supabase, user.id)
      if (
        context?.active_role === 'owner' &&
        context.active_company_id &&
        companyIds.includes(context.active_company_id)
      ) {
        companyId = context.active_company_id
      }
    }
    const summary = await getCurrentPayrollSummary(supabase, user.id, companyId)

    return NextResponse.json(summary)
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
