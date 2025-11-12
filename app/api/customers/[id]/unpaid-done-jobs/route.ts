/**
 * GET /api/customers/[id]/unpaid-done-jobs - Get completed jobs that haven't been fully invoiced
 *
 * Preconditions:
 * - User must be authenticated
 * - Customer must belong to user's company
 *
 * Postconditions:
 * - Returns list of done jobs without full invoices
 * - Each job includes completion date and estimate total
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { validateCompanyOwnership } from '@/lib/transactions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params
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

    // Validate customer belongs to company
    const customerValid = await validateCompanyOwnership(
      supabase,
      'customers',
      customerId,
      companyId
    )
    if (!customerValid) {
      return NextResponse.json(
        { error: 'Customer not found or unauthorized' },
        { status: 403 }
      )
    }

    // Get all done jobs for this customer
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, status, completed_at, updated_at, estimated_amount, summary')
      .eq('customer_id', customerId)
      .eq('company_id', companyId)
      .eq('status', 'done')
      .order('updated_at', { ascending: false })

    console.log('Customer unpaid jobs - Customer:', customerId, 'Jobs found:', jobs?.length || 0, 'Error:', jobsError)

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return NextResponse.json({ error: jobsError.message }, { status: 500 })
    }

    // For each job, check if it's been invoiced
    const unpaidJobs = await Promise.all(
      (jobs || []).map(async (job) => {
        // Check if job has any invoice lines referencing it
        const { data: invoiceLines } = await supabase
          .from('invoice_lines')
          .select('invoice_id, line_total')
          .eq('job_id', job.id)

        // Get invoice totals for this job
        const invoicedAmount = invoiceLines?.reduce(
          (sum, line) => sum + Number(line.line_total),
          0
        ) || 0

        // For now, we consider a job "unpaid" if it has no invoice lines
        // In a full implementation, you'd compare against job estimate/actual cost
        const isInvoiced = (invoiceLines?.length || 0) > 0

        if (!isInvoiced) {
          return {
            id: job.id,
            title: job.title,
            description: job.summary || null,
            completed_at: job.completed_at || job.updated_at,
            estimated_amount: Number(job.estimated_amount) || 0,
          }
        }
        return null
      })
    )

    const filteredJobs = unpaidJobs.filter((j) => j !== null)

    return NextResponse.json({
      jobs: filteredJobs,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
