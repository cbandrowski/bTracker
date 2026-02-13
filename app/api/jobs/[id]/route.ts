import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { requestJobUpdate, ServiceError } from '@/lib/services/approvals'

// GET /api/jobs/[id] - Get a single job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', id)
      .in('company_id', companyIds)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/jobs/[id] - Update a job
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const JobUpdateSchema = z.object({
      title: z.string().min(1).optional(),
      summary: z.string().nullable().optional(),
      service_address: z.string().nullable().optional(),
      service_address_line_2: z.string().nullable().optional(),
      service_city: z.string().nullable().optional(),
      service_state: z.string().nullable().optional(),
      service_zipcode: z.string().nullable().optional(),
      service_country: z.string().nullable().optional(),
      tasks_to_complete: z.string().nullable().optional(),
      status: z.enum(['upcoming', 'in_progress', 'done', 'cancelled']).optional(),
      planned_end_date: z.string().nullable().optional(),
      estimated_amount: z.number().min(0).nullable().optional(),
      arrival_window_start_time: z.string().nullable().optional(),
      arrival_window_end_time: z.string().nullable().optional(),
    })

    const validation = JobUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 422 }
      )
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    const result = await requestJobUpdate(supabase, user.id, id, validation.data)

    if (result.approval && !result.applied) {
      return NextResponse.json(
        {
          status: 'pending',
          approval: result.approval,
          job: result.job,
          message: 'Job update submitted for approval',
        },
        { status: 202 }
      )
    }

    return NextResponse.json({
      status: 'applied',
      job: result.job,
    })
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

// DELETE /api/jobs/[id] - Delete a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Verify job belongs to user's company
    const { data: existing } = await supabase
      .from('jobs')
      .select('company_id')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase.from('jobs').delete().eq('id', id)

    if (error) {
      console.error('Error deleting job:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
