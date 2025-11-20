/**
 * PAYROLL TYPES
 *
 * TypeScript interfaces for payroll tables and business logic
 */

export interface PayrollRun {
  id: string
  company_id: string
  period_start: string // ISO date
  period_end: string // ISO date
  status: 'draft' | 'finalized'
  total_gross_pay: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PayrollRunLine {
  id: string
  payroll_run_id: string
  employee_id: string
  total_regular_hours: number
  total_overtime_hours: number
  hourly_rate_snapshot: number
  overtime_rate_multiplier: number
  regular_pay: number
  overtime_pay: number
  total_gross_pay: number
  tax_withheld: number | null
  other_deductions: number | null
  net_pay: number | null
  created_at: string
  updated_at: string
}

export interface PayrollRunLineWithEmployee extends PayrollRunLine {
  employee: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  }
}

export interface PayrollRunWithLines extends PayrollRun {
  lines: PayrollRunLineWithEmployee[]
}

export interface TimeEntryForPayroll {
  id: string
  employee_id: string
  clock_in_approved_at: string
  clock_out_approved_at: string
  status: string
  payroll_run_id: string | null
}

export interface EmployeePayrollSummary {
  employee_id: string
  employee_name: string
  hourly_rate: number
  time_entries: TimeEntryForPayroll[]
  total_hours: number
  regular_hours: number
  overtime_hours: number
  regular_pay: number
  overtime_pay: number
  total_gross_pay: number
}

/**
 * PAYROLL CALCULATION RULES
 *
 * These rules can be easily modified to match your business requirements
 */
export const PAYROLL_RULES = {
  // Regular hours per week before overtime kicks in
  REGULAR_HOURS_THRESHOLD: 40,

  // Overtime pay multiplier (1.5 = time and a half)
  OVERTIME_MULTIPLIER: 1.5,

  // Default hourly rate if not set on employee
  DEFAULT_HOURLY_RATE: 15.00,
} as const

/**
 * Calculate hours between two ISO timestamps
 */
export function calculateHours(startTime: string, endTime: string): number {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

/**
 * Split total hours into regular and overtime
 *
 * Simple rule: First 40 hours are regular, anything over is overtime
 * You can modify this to be more sophisticated (daily overtime, etc)
 */
export function splitRegularAndOvertime(totalHours: number): {
  regular: number
  overtime: number
} {
  if (totalHours <= PAYROLL_RULES.REGULAR_HOURS_THRESHOLD) {
    return {
      regular: totalHours,
      overtime: 0,
    }
  }

  return {
    regular: PAYROLL_RULES.REGULAR_HOURS_THRESHOLD,
    overtime: totalHours - PAYROLL_RULES.REGULAR_HOURS_THRESHOLD,
  }
}

/**
 * Calculate gross pay for an employee
 */
export function calculateGrossPay(
  regularHours: number,
  overtimeHours: number,
  hourlyRate: number,
  overtimeMultiplier: number = PAYROLL_RULES.OVERTIME_MULTIPLIER
): {
  regularPay: number
  overtimePay: number
  totalGrossPay: number
} {
  const regularPay = regularHours * hourlyRate
  const overtimePay = overtimeHours * hourlyRate * overtimeMultiplier
  const totalGrossPay = regularPay + overtimePay

  return {
    regularPay: Math.round(regularPay * 100) / 100, // Round to 2 decimals
    overtimePay: Math.round(overtimePay * 100) / 100,
    totalGrossPay: Math.round(totalGrossPay * 100) / 100,
  }
}
