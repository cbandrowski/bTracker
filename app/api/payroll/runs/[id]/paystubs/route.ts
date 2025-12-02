import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { calculateHours } from '@/types/payroll'

const normalizeDate = (iso: string) => iso.split('T')[0]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) return NextResponse.json({ error: 'No company' }, { status: 404 })

    const { id: payrollRunId } = await params

    const { data: run } = await supabase
      .from('payroll_runs')
      .select('company_id, period_start, period_end')
      .eq('id', payrollRunId)
      .in('company_id', companyIds)
      .maybeSingle()

    if (!run) return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })

    const { data: stubs, error } = await supabase
      .from('pay_stubs')
      .select(`
        *,
        employee:company_employees(
          id,
          profile:profiles(
            full_name,
            email
          )
        ),
        entries:pay_stub_entries(*)
      `)
      .eq('payroll_run_id', payrollRunId)
      .order('work_date', { referencedTable: 'pay_stub_entries', ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pay_stubs: stubs || [], period_start: run.period_start, period_end: run.period_end })
  } catch (err) {
    console.error('Pay stub GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) return NextResponse.json({ error: 'No company' }, { status: 404 })

    const { id: payrollRunId } = await params

    const { data: run, error: runErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('id', payrollRunId)
      .in('company_id', companyIds)
      .maybeSingle()

    if (runErr || !run) {
      return NextResponse.json({ error: 'Payroll run not found' }, { status: 404 })
    }

    const { data: lines, error: linesErr } = await supabase
      .from('payroll_run_lines')
      .select('*')
      .eq('payroll_run_id', payrollRunId)

    if (linesErr) {
      return NextResponse.json({ error: 'Failed to fetch payroll lines' }, { status: 500 })
    }

    const { data: timeEntries, error: teErr } = await supabase
      .from('time_entries')
      .select('id, employee_id, clock_in_approved_at, clock_out_approved_at, regular_hours, overtime_hours, gross_pay')
      .eq('payroll_run_id', payrollRunId)

    if (teErr) {
      return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
    }

    // Build stubs payloads
    const stubPayloads: any[] = []
    const stubEntries: any[] = []

    for (const line of lines || []) {
      const entries = (timeEntries || []).filter((te) => te.employee_id === line.employee_id)
      const regularHours = entries.reduce((sum, e) => sum + (e.regular_hours || 0), 0)
      const overtimeHours = entries.reduce((sum, e) => sum + (e.overtime_hours || 0), 0)
      const totalHours = regularHours + overtimeHours
      const grossPay = entries.reduce((sum, e) => sum + (e.gross_pay || 0), 0)

      stubPayloads.push({
        payroll_run_id: payrollRunId,
        employee_id: line.employee_id,
        period_start: run.period_start,
        period_end: run.period_end,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        total_hours: totalHours,
        hourly_rate: line.hourly_rate_snapshot,
        gross_pay: grossPay || line.total_gross_pay,
      })

      const daily = new Map<string, { regular: number; overtime: number; gross: number }>()
      for (const entry of entries) {
        const day = normalizeDate(entry.clock_in_approved_at)
        if (!daily.has(day)) {
          daily.set(day, { regular: 0, overtime: 0, gross: 0 })
        }
        const current = daily.get(day)!
        const hours = calculateHours(entry.clock_in_approved_at, entry.clock_out_approved_at)
        current.regular += entry.regular_hours ?? Math.min(hours, regularHours)
        current.overtime += entry.overtime_hours ?? Math.max(0, hours - regularHours)
        current.gross += entry.gross_pay || 0
      }

      for (const [work_date, values] of daily.entries()) {
        stubEntries.push({
          work_date,
          regular_hours: values.regular,
          overtime_hours: values.overtime,
          gross_pay: values.gross,
          employee_id: line.employee_id, // temp for matching after insert
        })
      }
    }

    // Upsert stubs
    const { data: upserted, error: stubErr } = await supabase
      .from('pay_stubs')
      .upsert(stubPayloads, { onConflict: 'payroll_run_id,employee_id' })
      .select('id, employee_id')

    if (stubErr) {
      return NextResponse.json({ error: 'Failed to create pay stubs' }, { status: 500 })
    }

    // Map inserted ids for entries
    const stubIdMap = new Map<string, string>()
    for (const stub of upserted || []) {
      stubIdMap.set(stub.employee_id, stub.id)
    }

    const entriesToInsert = stubEntries
      .map((entry) => {
        const stubId = stubIdMap.get(entry.employee_id)
        if (!stubId) return null
        return {
          pay_stub_id: stubId,
          work_date: entry.work_date,
          regular_hours: entry.regular_hours,
          overtime_hours: entry.overtime_hours,
          gross_pay: entry.gross_pay,
        }
      })
      .filter(Boolean) as any[]

    if (entriesToInsert.length > 0) {
      await supabase.from('pay_stub_entries').delete().in('pay_stub_id', Array.from(stubIdMap.values()))
      await supabase.from('pay_stub_entries').insert(entriesToInsert)
    }

    return NextResponse.json({ status: 'created', pay_stub_count: upserted?.length || 0 })
  } catch (err) {
    console.error('Pay stub POST error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
