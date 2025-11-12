import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

// GET /api/employees - List all employees for user's companies
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
      .from('company_employees')
      .select(`
        *,
        profile:profiles(*)
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching employees:', error)
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
