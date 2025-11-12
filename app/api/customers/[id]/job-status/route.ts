import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'

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

    // Verify customer belongs to user's company
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .in('company_id', companyIds)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get all jobs for customer
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('customer_id', customerId)
      .in('company_id', companyIds)

    if (error) {
      console.error('Error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    // Count jobs by status
    const statusCounts: Record<string, number> = {}
    let hasActiveJobs = false

    jobs?.forEach(job => {
      const status = job.status || 'unassigned'
      statusCounts[status] = (statusCounts[status] || 0) + 1

      // Consider job active if not done, cancelled, or void
      if (!['done', 'cancelled', 'void'].includes(status)) {
        hasActiveJobs = true
      }
    })

    return NextResponse.json({
      hasActiveJobs,
      statusCounts,
      totalJobs: jobs?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
