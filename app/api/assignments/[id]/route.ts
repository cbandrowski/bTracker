import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

// GET /api/assignments/[id] - Get a single assignment
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
      .eq('id', id)
      .in('company_id', companyIds)
      .single()

    if (error) {
      console.error('Error fetching assignment:', error)
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

// PATCH /api/assignments/[id] - Update assignment (including status changes)
export async function PATCH(
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
    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Verify assignment belongs to user's company
    const { data: existing } = await supabase
      .from('job_assignments')
      .select('company_id')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Add timestamp for done status
    const updateData = {
      ...body,
      ...(body.assignment_status === 'done' && !body.worker_confirmed_done_at ? {
        worker_confirmed_done_at: new Date().toISOString()
      } : {})
    }

    const { data, error } = await supabase
      .from('job_assignments')
      .update(updateData)
      .eq('id', id)
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
      console.error('Error updating assignment:', error)
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

// DELETE /api/assignments/[id] - Delete an assignment
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

    // Verify assignment belongs to user's company
    const { data: existing } = await supabase
      .from('job_assignments')
      .select('company_id')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabase.from('job_assignments').delete().eq('id', id)

    if (error) {
      console.error('Error deleting assignment:', error)
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
