/**
 * GET /api/billing/unbilled-jobs - Get all completed jobs that haven't been invoiced
 *
 * Returns list of done jobs across all customers that don't have invoice lines
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const user = await getCurrentUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyIds = await getUserCompanyIds(supabase, user.id)
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 400 })
    }
    const companyId = companyIds[0]

    // Get all done jobs for this company with customer info
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        summary,
        status,
        completed_at,
        updated_at,
        estimated_amount,
        customer_id,
        customers!inner (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('company_id', companyId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })

    console.log('Fetched jobs:', jobs?.length || 0, 'Error:', jobsError)

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }

    // For each job, check if it's been invoiced
    const unbilledJobs = await Promise.all(
      (jobs || []).map(async (job) => {
        // Check if job has any invoice lines referencing it
        const { data: invoiceLines } = await supabase
          .from('invoice_lines')
          .select('invoice_id, line_total')
          .eq('job_id', job.id)

        const isInvoiced = (invoiceLines?.length || 0) > 0

        if (!isInvoiced) {
          const customer = Array.isArray(job.customers) ? job.customers[0] : job.customers
          return {
            id: job.id,
            title: job.title,
            description: job.summary || null,
            completed_at: job.completed_at || job.updated_at,
            estimated_amount: Number(job.estimated_amount) || 0,
            customer_id: job.customer_id,
            customer_name: customer?.name || 'Unknown',
            customer_email: customer?.email || null,
            customer_phone: customer?.phone || null,
          }
        }
        return null
      })
    )

    const filteredJobs = unbilledJobs.filter((j) => j !== null)

    return NextResponse.json({
      jobs: filteredJobs,
      total: filteredJobs.length,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
