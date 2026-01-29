import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { listEmployeesForOwner, ServiceError } from '@/lib/services/employees'
import { z } from 'zod'

const EmployeesQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
})

// GET /api/employees - List all employees for user's companies
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = EmployeesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company found or you are not an owner' },
        { status: 403 }
      )
    }

    if (query.company_id && !companyIds.includes(query.company_id)) {
      return NextResponse.json(
        { error: 'Unauthorized company access' },
        { status: 403 }
      )
    }

    const employees = await listEmployeesForOwner(
      supabase,
      user.id,
      query.company_id
    )

    return NextResponse.json(employees)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 422 }
      )
    }

    if (error instanceof ServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }

    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
