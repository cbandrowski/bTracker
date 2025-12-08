import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

type CustomerStatus = 'active' | 'archived' | 'all'

// GET /api/customers - List all customers for user's companies
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const statusParam = searchParams.get('status')
    const status: CustomerStatus =
      statusParam === 'archived' ? 'archived' : statusParam === 'all' ? 'all' : 'active'

    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)

    if (companyIds.length === 0) {
      return NextResponse.json([])
    }

    let query = supabase
      .from('customers')
      .select('*')
      .in('company_id', companyIds)

    if (status !== 'all') {
      query = query.eq('archived', status === 'archived')
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
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

// POST /api/customers - Create a new customer
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
      .from('customers')
      .insert([{ company_id: companyId, ...body }])
      .select()
      .single()

    if (error) {
      console.error('Error creating customer:', error)
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
