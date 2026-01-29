import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser } from '@/lib/supabaseServer'
import { getActiveEmployeeRecord, ServiceError } from '@/lib/services/companyContext'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { employee } = await getActiveEmployeeRecord(supabase, user.id)

    const { data: stubs, error } = await supabase
      .from('pay_stubs')
      .select('*, entries:pay_stub_entries(*)')
      .eq('employee_id', employee.id)
      .order('period_end', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pay_stubs: stubs || [] })
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }
    console.error('Employee pay stubs error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
