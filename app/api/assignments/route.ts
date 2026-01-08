import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import {
  createAssignmentForOwner,
  listAssignmentsForOwner,
  ServiceError,
} from '@/lib/services/assignments'

const CreateAssignmentSchema = z.object({
  company_id: z.string().uuid().optional(),
  job_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  service_start_at: z.string().datetime().optional().nullable(),
  service_end_at: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/assignments - List all assignments for user's companies
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json([])
    }

    const assignments = await listAssignmentsForOwner(supabase, user.id)

    return NextResponse.json(assignments)
  } catch (error) {
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

// POST /api/assignments - Create a new assignment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = CreateAssignmentSchema.parse(await request.json())

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company found for user' },
        { status: 400 }
      )
    }

    const companyId = body.company_id ?? companyIds[0]

    const assignment = await createAssignmentForOwner(supabase, user.id, {
      ...body,
      company_id: companyId,
    })

    return NextResponse.json(assignment, { status: 201 })
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
