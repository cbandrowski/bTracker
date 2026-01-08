/**
 * Type definitions for Customer Details view
 */
import { CustomerServiceAddress } from './database'

export interface Customer {
  id: string
  company_id: string
  name: string
  phone: string | null
  email: string | null
  billing_address: string | null
  billing_address_line_2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zipcode: string | null
  billing_country: string | null
  service_address: string | null
  service_address_line_2: string | null
  service_city: string | null
  service_state: string | null
  service_zipcode: string | null
  service_country: string | null
  same_as_billing: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CustomerJob {
  id: string
  company_id: string
  customer_id: string
  title: string
  summary: string | null
  service_address: string | null
  service_address_line_2: string | null
  service_city: string | null
  service_state: string | null
  service_zipcode: string | null
  service_country: string | null
  tasks_to_complete: string | null
  status: 'upcoming' | 'in_progress' | 'done' | 'cancelled'
  planned_end_date: string | null
  arrival_window_start_time: string | null
  arrival_window_end_time: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  estimated_amount: number
  // Joined data
  assigned_employee?: {
    id: string
    full_name: string
  } | null
}

export interface CustomerInvoice {
  id: string
  company_id: string
  customer_id: string
  job_id: string | null
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'void' | 'cancelled'
  total_amount: number
  balance_due: number
  issued_at: string | null
  paid_at: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
}

export interface CustomerPayment {
  id: string
  company_id: string
  customer_id: string
  job_id: string | null
  amount: number
  payment_date: string
  payment_method: 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'other'
  reference_number: string | null
  memo: string | null
  is_deposit: boolean
  deposit_type: 'retainer' | 'down_payment' | 'prepayment' | null
  created_at: string
  updated_at: string
}

export interface CustomerStats {
  totalJobs: number
  openJobs: number
  completedJobs: number
  totalInvoiced: number
  totalPaid: number
  outstandingBalance: number
  lastActivity: string | null
}

export interface CustomerDetailsData {
  customer: Customer
  jobs: CustomerJob[]
  invoices: CustomerInvoice[]
  payments: CustomerPayment[]
  stats: CustomerStats
  serviceAddresses: CustomerServiceAddress[]
}

export interface UpdateCustomerInput {
  name?: string
  phone?: string | null
  email?: string | null
  billing_address?: string | null
  billing_address_line_2?: string | null
  billing_city?: string | null
  billing_state?: string | null
  billing_zipcode?: string | null
  billing_country?: string | null
  service_address?: string | null
  service_address_line_2?: string | null
  service_city?: string | null
  service_state?: string | null
  service_zipcode?: string | null
  service_country?: string | null
  same_as_billing?: boolean
  notes?: string | null
}
