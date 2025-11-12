import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

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
    const companyIds = await getUserCompanyIds(supabase, user.id)

    // Verify job belongs to user's company
    const { data: existing } = await supabase
      .from('jobs')
      .select('company_id, status')
      .eq('id', id)
      .single()

    if (!existing || !companyIds.includes(existing.company_id)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // If status is being changed to 'done', set completed_at timestamp
    const updateData = { ...body }
    if (body.status === 'done' && existing.status !== 'done') {
      updateData.completed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer:customers(*)
      `)
      .single()

    if (error) {
      console.error('Error updating job:', error)
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
