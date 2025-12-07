import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { applyLateFeesForCompany } from '@/lib/services/billing'

const requestSchema = z.object({
  // Optional override to run the calculation as-of a specific date (ISO string)
  asOfDate: z.coerce.date().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json()
      : {}

    const validated = requestSchema.parse(body)
    const asOfDate = validated.asOfDate || new Date()

    const result = await applyLateFeesForCompany(supabase, companyIds[0], asOfDate)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    console.error('Error applying late fees:', error)
    return NextResponse.json(
      { error: 'Failed to apply late fees' },
      { status: 500 }
    )
  }
}
