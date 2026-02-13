import { Profile } from '@/types/database'

export type StatsPeriod = 'day' | 'week' | 'month' | 'year' | 'custom'
export type StatsViewMode = 'tables' | 'charts'

export interface StatsRange {
  period: StatsPeriod
  start: string
  end: string
  label: string
}

export interface EmployeeJobStat {
  employee_id: string
  profile: Profile | null
  jobs_completed: number
}

export interface EmployeeHoursStat {
  employee_id: string
  profile: Profile | null
  hours_total: number
  hours_regular: number
  hours_overtime: number
}

export interface OwnerActivityStat {
  owner_profile_id: string
  profile: Profile | null
  jobs_created: number
  jobs_assigned: number
  invoices_created: number
  invoice_updates: number
  payments_recorded: number
}

export interface CompanyOverviewStats {
  range: StatsRange
  totals: {
    jobs_completed: number
    hours_total: number
    invoices_created: number
    payments_recorded: number
  }
  jobs_by_employee: EmployeeJobStat[]
  hours_by_employee: EmployeeHoursStat[]
  owner_activity: OwnerActivityStat[]
}
