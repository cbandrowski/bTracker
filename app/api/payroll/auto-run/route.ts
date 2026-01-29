import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getActiveCompanyContext, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { generatePayrollRun } from '@/lib/payroll'

const normalizeDate = (date: Date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const computePeriod = (today: Date, startDay: number, endDay: number) => {
  const endDate = normalizeDate(today)
  const diff = (endDate.getDay() - endDay + 7) % 7
  endDate.setDate(endDate.getDate() - diff)

  const length =
    startDay <= endDay ? endDay - startDay : (7 - startDay) + endDay

  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - length)

  return { startDate, endDate }
}

const CompanyQuerySchema = z.object({
  company_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = CompanyQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    )

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    let companyId = companyIds[0]
    if (query.company_id) {
      if (!companyIds.includes(query.company_id)) {
        return NextResponse.json({ error: 'Unauthorized company access' }, { status: 403 })
      }
      companyId = query.company_id
    } else {
      const context = await getActiveCompanyContext(supabase, user.id)
      if (
        context?.active_role === 'owner' &&
        context.active_company_id &&
        companyIds.includes(context.active_company_id)
      ) {
        companyId = context.active_company_id
      }
    }

    const { data: settings } = await supabase
      .from('payroll_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()

    const periodStartDay = settings?.period_start_day ?? 1
    const periodEndDay = settings?.period_end_day ?? 0
    const autoGenerate = settings?.auto_generate ?? false
    const lastGenerated = settings?.last_generated_end_date

    if (!autoGenerate) {
      return NextResponse.json({ status: 'skipped', reason: 'Auto-generate disabled' })
    }

    const today = normalizeDate(new Date())
    const { startDate, endDate } = computePeriod(today, periodStartDay, periodEndDay)
    const endDateIso = endDate.toISOString().split('T')[0]
    const startDateIso = startDate.toISOString()
    const endDateIsoFull = endDate.toISOString()

    if (lastGenerated && new Date(lastGenerated) >= endDate) {
      return NextResponse.json({ status: 'skipped', reason: 'Already generated for this period', period_end: endDateIso })
    }

    const { data: existingRuns } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('company_id', companyId)
      .eq('period_end', endDateIso)
      .limit(1)

    if (existingRuns && existingRuns.length > 0) {
      return NextResponse.json({ status: 'skipped', reason: 'Payroll already exists', period_end: endDateIso })
    }

    try {
      const result = await generatePayrollRun(
        supabase,
        companyId,
        startDateIso,
        endDateIsoFull,
        user.id
      )

      await supabase
        .from('payroll_settings')
        .upsert({
          company_id: companyId,
          period_start_day: periodStartDay,
          period_end_day: periodEndDay,
          auto_generate: autoGenerate,
          last_generated_end_date: endDateIso,
        }, { onConflict: 'company_id' })

      return NextResponse.json({
        status: 'created',
        payroll_run: result.payroll_run,
        period_start: startDate.toISOString().split('T')[0],
        period_end: endDateIso,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate payroll'
      return NextResponse.json({ status: 'error', error: message, period_end: endDateIso }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: err.issues }, { status: 422 })
    }
    console.error('Payroll auto-run error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
