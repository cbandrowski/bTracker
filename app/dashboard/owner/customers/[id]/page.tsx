import { notFound } from 'next/navigation'
import { createServerClient, getCurrentUser, getUserCompanyIds } from '@/lib/supabaseServer'
import { Customer, CustomerJob, CustomerInvoice, CustomerPayment, CustomerStats } from '@/types/customer-details'
import { CustomerDetailsClient } from '@/components/customers/CustomerDetailsClient'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getCustomerDetails(customerId: string) {
  const supabase = await createServerClient()
  const user = await getCurrentUser(supabase)

  if (!user) {
    throw new Error('Unauthorized')
  }

  const companyIds = await getUserCompanyIds(supabase, user.id)

  // Fetch customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .in('company_id', companyIds)
    .single()

  if (customerError || !customer) {
    return null
  }

  // Fetch jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      job_assignments (
        employee_id,
        company_employees!inner (
          id,
          profile_id,
          profiles!inner (
            id,
            full_name
          )
        )
      )
    `)
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })

  // Transform jobs to include assigned employee
  const transformedJobs: CustomerJob[] = (jobs || []).map(job => ({
    ...job,
    assigned_employee: job.job_assignments?.[0]?.company_employees?.profiles
      ? {
          id: job.job_assignments[0].company_employees.id,
          full_name: job.job_assignments[0].company_employees.profiles.full_name,
        }
      : null,
  }))

  // Fetch invoices with balance_due from v_invoice_summary
  const { data: invoices } = await supabase
    .from('v_invoice_summary')
    .select(`
      invoice_id,
      company_id,
      customer_id,
      invoice_number,
      invoice_date,
      due_date,
      computed_status,
      total_amount,
      balance_due,
      issued_at,
      paid_at,
      voided_at,
      created_at,
      updated_at
    `)
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })

  // Transform invoices to match expected interface
  const transformedInvoices: CustomerInvoice[] = (invoices || []).map(inv => ({
    id: inv.invoice_id,
    company_id: inv.company_id,
    customer_id: inv.customer_id,
    job_id: null, // Not included in view, can be added if needed
    invoice_number: inv.invoice_number,
    invoice_date: inv.invoice_date,
    due_date: inv.due_date,
    status: inv.computed_status as CustomerInvoice['status'],
    total_amount: Number(inv.total_amount),
    balance_due: Number(inv.balance_due),
    issued_at: inv.issued_at,
    paid_at: inv.paid_at,
    voided_at: inv.voided_at,
    created_at: inv.created_at,
    updated_at: inv.updated_at,
  }))

  // Fetch payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .in('company_id', companyIds)
    .order('payment_date', { ascending: false })

  const transformedPayments: CustomerPayment[] = (payments || []).map(p => ({
    ...p,
    amount: Number(p.amount),
  }))

  // Calculate stats
  const totalJobs = transformedJobs.length
  const openJobs = transformedJobs.filter(j =>
    j.status === 'upcoming' || j.status === 'in_progress'
  ).length
  const completedJobs = transformedJobs.filter(j => j.status === 'done').length

  const totalInvoiced = transformedInvoices
    .filter(inv => inv.status !== 'void' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.total_amount, 0)

  const totalPaid = transformedPayments
    .filter(p => !p.is_deposit)
    .reduce((sum, p) => sum + p.amount, 0)

  const outstandingBalance = transformedInvoices
    .filter(inv => inv.status !== 'void' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + inv.balance_due, 0)

  // Find last activity date
  const dates: Date[] = []
  if (transformedJobs.length > 0) {
    dates.push(new Date(transformedJobs[0].created_at))
  }
  if (transformedInvoices.length > 0) {
    dates.push(new Date(transformedInvoices[0].created_at))
  }
  if (transformedPayments.length > 0) {
    dates.push(new Date(transformedPayments[0].created_at))
  }

  const lastActivity = dates.length > 0
    ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString()
    : null

  const stats: CustomerStats = {
    totalJobs,
    openJobs,
    completedJobs,
    totalInvoiced,
    totalPaid,
    outstandingBalance,
    lastActivity,
  }

  return {
    customer: customer as Customer,
    jobs: transformedJobs,
    invoices: transformedInvoices,
    payments: transformedPayments,
    stats,
  }
}

export default async function CustomerDetailsPage({ params }: PageProps) {
  const { id } = await params
  const data = await getCustomerDetails(id)

  if (!data) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <CustomerDetailsClient
          customer={data.customer}
          jobs={data.jobs}
          invoices={data.invoices}
          payments={data.payments}
          stats={data.stats}
        />
      </div>
    </div>
  )
}
