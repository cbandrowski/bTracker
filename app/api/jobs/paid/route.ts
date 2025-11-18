/**
 * GET /api/jobs/paid - Get list of job IDs that have been fully paid
 *
 * Returns array of job IDs where:
 * - Job has invoice lines
 * - Invoice status is 'paid' (from v_invoice_summary computed_status)
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

    // Get all invoice lines with their job_id and invoice status from v_invoice_summary
    const { data: invoiceLines, error: linesError } = await supabase
      .from('invoice_lines')
      .select(`
        job_id,
        invoice_id
      `)
      .not('job_id', 'is', null)

    if (linesError) {
      console.error('Error fetching invoice lines:', linesError)
      return NextResponse.json({ error: 'Failed to fetch invoice lines' }, { status: 500 })
    }

    // Get unique invoice IDs
    const invoiceIds = [...new Set(invoiceLines?.map(line => line.invoice_id) || [])]

    if (invoiceIds.length === 0) {
      return NextResponse.json({ paidJobIds: [] })
    }

    // Get invoice statuses from v_invoice_summary
    const { data: invoiceSummaries, error: summaryError } = await supabase
      .from('v_invoice_summary')
      .select('invoice_id, computed_status')
      .in('invoice_id', invoiceIds)
      .in('company_id', companyIds)

    if (summaryError) {
      console.error('Error fetching invoice summaries:', summaryError)
      return NextResponse.json({ error: 'Failed to fetch invoice summaries' }, { status: 500 })
    }

    // Create a map of invoice_id -> computed_status
    const invoiceStatusMap = new Map(
      invoiceSummaries?.map(inv => [inv.invoice_id, inv.computed_status]) || []
    )

    // Find job IDs where all associated invoices are paid
    const jobInvoiceStatus = new Map<string, { total: number, paid: number }>()

    invoiceLines?.forEach(line => {
      if (!line.job_id) return

      const status = invoiceStatusMap.get(line.invoice_id)
      if (!status) return

      if (!jobInvoiceStatus.has(line.job_id)) {
        jobInvoiceStatus.set(line.job_id, { total: 0, paid: 0 })
      }

      const stats = jobInvoiceStatus.get(line.job_id)!
      stats.total++
      if (status === 'paid') {
        stats.paid++
      }
    })

    // Job is considered paid if all its invoices are paid
    const paidJobIds = Array.from(jobInvoiceStatus.entries())
      .filter(([_, stats]) => stats.total > 0 && stats.paid === stats.total)
      .map(([jobId, _]) => jobId)

    return NextResponse.json({ paidJobIds })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
