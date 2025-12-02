import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: payStubId } = await params

    const { data: stub, error } = await supabase
      .from('pay_stubs')
      .select(`
        *,
        payroll_runs!inner(company_id, period_start, period_end),
        employee:company_employees(
          id,
          hourly_rate,
          profile:profiles(
            full_name,
            email
          )
        ),
        entries:pay_stub_entries(*)
      `)
      .eq('id', payStubId)
      .in('payroll_runs.company_id', companyIds)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!stub) {
      return NextResponse.json({ error: 'Pay stub not found' }, { status: 404 })
    }

    return NextResponse.json(stub)
  } catch (err) {
    console.error('Pay stub GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
