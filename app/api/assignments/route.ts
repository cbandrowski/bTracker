import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

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

    const { data, error } = await supabase
      .from('job_assignments')
      .select(`
        *,
        job:jobs(
          *,
          customer:customers(*)
        ),
        employee:company_employees(
          *,
          profile:profiles(*)
        )
      `)
      .in('company_id', companyIds)
      .neq('assignment_status', 'cancelled')

    if (error) {
      console.error('Error fetching assignments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
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

// POST /api/assignments - Create a new assignment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json(
        { error: 'No company found for user' },
        { status: 400 }
      )
    }

    // Use first company or company_id from body if provided
    const companyId = body.company_id || companyIds[0]

    // Verify user owns this company
    if (!companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('job_assignments')
      .insert([{
        company_id: companyId,
        assignment_status: 'assigned',
        ...body
      }])
      .select(`
        *,
        job:jobs(
          *,
          customer:customers(*)
        ),
        employee:company_employees(
          *,
          profile:profiles(*)
        )
      `)
      .single()

    if (error) {
      console.error('Error creating assignment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
