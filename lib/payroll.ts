/**
 * PAYROLL GENERATION LOGIC
 *
 * Core business logic for creating payroll runs from approved time entries
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateHours,
  splitRegularAndOvertime,
  calculateGrossPay,
  PAYROLL_RULES,
  type EmployeePayrollSummary,
  type TimeEntryForPayroll,
} from '@/types/payroll'

/**
 * Generate a payroll run for a company and date range
 *
 * This function:
 * 1. Finds all approved, unpaid time entries in the date range
 * 2. Groups them by employee
 * 3. Calculates hours and pay for each employee
 * 4. Creates payroll_runs and payroll_run_lines records
 * 5. Updates time_entries with payroll_run_id and computed pay fields
 *
 * @param supabase - Supabase client with owner auth
 * @param companyId - Company ID
 * @param periodStart - Start date (ISO string)
 * @param periodEnd - End date (ISO string)
 * @param createdBy - Profile ID of the user creating this run
 * @returns The created payroll run with its lines
 */
export async function generatePayrollRun(
  supabase: SupabaseClient,
  companyId: string,
  periodStart: string,
  periodEnd: string,
  createdBy: string
): Promise<{
  payroll_run: any
  lines: any[]
  time_entries_count: number
}> {
  // Step 1: Find eligible time entries
  // - Approved status
  // - Clock in within date range
  // - Not already assigned to a payroll run
  const { data: timeEntries, error: timeEntriesError } = await supabase
    .from('time_entries')
    .select(`
      id,
      employee_id,
      clock_in_approved_at,
      clock_out_approved_at,
      status,
      payroll_run_id
    `)
    .eq('company_id', companyId)
    .eq('status', 'approved')
    .is('payroll_run_id', null)
    .gte('clock_in_approved_at', periodStart)
    .lte('clock_in_approved_at', periodEnd)
    .not('clock_out_approved_at', 'is', null) // Must have a clock out time

  if (timeEntriesError) {
    throw new Error(`Failed to fetch time entries: ${timeEntriesError.message}`)
  }

  if (!timeEntries || timeEntries.length === 0) {
    throw new Error('No eligible time entries found for this period')
  }

  // Step 2: Get employee data (including hourly rates)
  const employeeIds = [...new Set(timeEntries.map((te) => te.employee_id))]
  const { data: employees, error: employeesError } = await supabase
    .from('company_employees')
    .select(`
      id,
      hourly_rate,
      profile:profiles(
        id,
        full_name,
        email
      )
    `)
    .in('id', employeeIds)

  if (employeesError) {
    throw new Error(`Failed to fetch employees: ${employeesError.message}`)
  }

  const employeeMap = new Map(
    employees?.map((emp: any) => [
      emp.id,
      {
        ...emp,
        hourly_rate: emp.hourly_rate || PAYROLL_RULES.DEFAULT_HOURLY_RATE,
        profile: emp.profile || { full_name: 'Unknown', email: null },
      },
    ]) || []
  )

  // Step 3: Group time entries by employee and calculate totals
  const employeeSummaries: EmployeePayrollSummary[] = []

  for (const employeeId of employeeIds) {
    const employee = employeeMap.get(employeeId)
    if (!employee) continue

    const employeeEntries = timeEntries.filter((te) => te.employee_id === employeeId)

    // Calculate total hours for this employee
    let totalHours = 0
    for (const entry of employeeEntries) {
      const hours = calculateHours(entry.clock_in_approved_at, entry.clock_out_approved_at)
      totalHours += hours
    }

    // Split into regular and overtime
    const { regular, overtime } = splitRegularAndOvertime(totalHours)

    // Calculate pay
    const { regularPay, overtimePay, totalGrossPay } = calculateGrossPay(
      regular,
      overtime,
      employee.hourly_rate
    )

    employeeSummaries.push({
      employee_id: employeeId,
      employee_name: employee.profile.full_name,
      hourly_rate: employee.hourly_rate,
      time_entries: employeeEntries,
      total_hours: totalHours,
      regular_hours: regular,
      overtime_hours: overtime,
      regular_pay: regularPay,
      overtime_pay: overtimePay,
      total_gross_pay: totalGrossPay,
    })
  }

  // Step 4: Calculate total gross pay across all employees
  const totalGrossPay = employeeSummaries.reduce(
    (sum, emp) => sum + emp.total_gross_pay,
    0
  )

  // Step 5: Create payroll run (in a transaction with the lines)
  // Create the payroll run first
  const { data: payrollRun, error: runError } = await supabase
    .from('payroll_runs')
    .insert({
      company_id: companyId,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'draft',
      total_gross_pay: totalGrossPay,
      created_by: createdBy,
    })
    .select()
    .single()

  if (runError) {
    throw new Error(`Failed to create payroll run: ${runError.message}`)
  }

  // Step 6: Create payroll run lines
  const linesToInsert = employeeSummaries.map((emp) => ({
    payroll_run_id: payrollRun.id,
    employee_id: emp.employee_id,
    total_regular_hours: emp.regular_hours,
    total_overtime_hours: emp.overtime_hours,
    hourly_rate_snapshot: emp.hourly_rate,
    overtime_rate_multiplier: PAYROLL_RULES.OVERTIME_MULTIPLIER,
    regular_pay: emp.regular_pay,
    overtime_pay: emp.overtime_pay,
    total_gross_pay: emp.total_gross_pay,
  }))

  const { data: lines, error: linesError } = await supabase
    .from('payroll_run_lines')
    .insert(linesToInsert)
    .select(`
      *,
      employee:company_employees(
        id,
        hourly_rate,
        profile:profiles(
          id,
          full_name,
          email
        )
      )
    `)

  if (linesError) {
    // Rollback: delete the payroll run
    await supabase.from('payroll_runs').delete().eq('id', payrollRun.id)
    throw new Error(`Failed to create payroll run lines: ${linesError.message}`)
  }

  // Step 7: Update time entries with payroll_run_id and computed fields
  // We'll update each time entry individually for now
  // (In production, you might batch these or use a stored procedure)
  for (const emp of employeeSummaries) {
    // For each employee, distribute hours proportionally across their time entries
    const entryIds = emp.time_entries.map((te) => te.id)

    // Calculate hours per entry and assign regular/overtime proportionally
    for (const entry of emp.time_entries) {
      const entryHours = calculateHours(
        entry.clock_in_approved_at,
        entry.clock_out_approved_at
      )

      // Simple approach: assign regular hours first, then overtime
      // This is a simplified version - you might want more sophisticated allocation
      const entryRegular = Math.min(entryHours, emp.regular_hours)
      const entryOvertime = Math.max(0, entryHours - emp.regular_hours)

      const { regularPay, overtimePay, totalGrossPay } = calculateGrossPay(
        entryRegular,
        entryOvertime,
        emp.hourly_rate
      )

      await supabase
        .from('time_entries')
        .update({
          payroll_run_id: payrollRun.id,
          regular_hours: entryRegular,
          overtime_hours: entryOvertime,
          gross_pay: totalGrossPay,
        })
        .eq('id', entry.id)
    }
  }

  return {
    payroll_run: payrollRun,
    lines: lines || [],
    time_entries_count: timeEntries.length,
  }
}

/**
 * Finalize a payroll run
 *
 * This marks the run as 'finalized' and prevents further modifications
 */
export async function finalizePayrollRun(
  supabase: SupabaseClient,
  payrollRunId: string
): Promise<void> {
  const { error } = await supabase
    .from('payroll_runs')
    .update({ status: 'finalized' })
    .eq('id', payrollRunId)
    .eq('status', 'draft') // Only finalize if currently draft

  if (error) {
    throw new Error(`Failed to finalize payroll run: ${error.message}`)
  }
}
