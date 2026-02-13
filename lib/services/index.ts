// Frontend service layer for API calls
// Provides type-safe methods for all backend API routes

import { api } from '../api'
import { ApprovalRequestAction, ApprovalRequestStatus, ApprovalStatus, AssignmentStatus, Company, CompanyEmployee, Customer, CustomerServiceAddress, InvoiceStatus, Job, JobAssignment, JobWithCustomer, Profile, Supplier, WorkStatus } from '@/types/database'

type CustomerStatus = 'active' | 'archived' | 'all'

type InvoiceLineType = 'service' | 'parts' | 'supplies' | 'labor' | 'deposit_applied' | 'adjustment' | 'other'

export interface InvoiceUpdateLine {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  lineType: InvoiceLineType
  jobId?: string | null
  appliedPaymentId?: string | null
}

export interface UpdateInvoicePayload {
  invoiceDate?: string
  dueDate?: string | null
  terms?: string | null
  notes?: string | null
  status?: Extract<InvoiceStatus, 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled' | 'void'>
  lines: InvoiceUpdateLine[]
}

export interface CustomerServiceAddressPayload {
  label: string
  address?: string | null
  address_line_2?: string | null
  city?: string | null
  state?: string | null
  zipcode?: string | null
  country?: string | null
}

// ============================================================================
// CUSTOMERS SERVICE
// ============================================================================

export const customersService = {
  // Get all customers
  async getAll(status: CustomerStatus = 'active') {
    return api.get<Customer[]>(`/customers?status=${status}`)
  },

  // Get a single customer
  async getById(id: string) {
    return api.get<Customer>(`/customers/${id}`)
  },

  // Create a new customer
  async create(customerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<Customer>('/customers', customerData)
  },

  // Update a customer
  async update(id: string, customerData: Partial<Customer>) {
    return api.put<Customer>(`/customers/${id}`, customerData)
  },

  async setArchived(id: string, archived: boolean) {
    return api.put<Customer>(`/customers/${id}`, { archived })
  },

  // Delete a customer
  async delete(id: string) {
    return api.delete<{ success: boolean }>(`/customers/${id}`)
  },
}

// ============================================================================ 
// CUSTOMER SERVICE ADDRESSES
// ============================================================================

export const customerAddressesService = {
  async list(customerId: string) {
    return api.get<CustomerServiceAddress[]>(`/customers/${customerId}/service-addresses`)
  },
  async create(customerId: string, payload: CustomerServiceAddressPayload) {
    return api.post<CustomerServiceAddress>(`/customers/${customerId}/service-addresses`, payload)
  },
  async update(customerId: string, addressId: string, payload: CustomerServiceAddressPayload) {
    return api.put<CustomerServiceAddress>(`/customers/${customerId}/service-addresses/${addressId}`, payload)
  },
  async delete(customerId: string, addressId: string) {
    return api.delete<{ success: boolean }>(`/customers/${customerId}/service-addresses/${addressId}`)
  },
}

// ============================================================================
// SUPPLIERS SERVICE
// ============================================================================

export const suppliersService = {
  async getAll() {
    return api.get<Supplier[]>('/suppliers')
  },

  async create(supplierData: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<Supplier>('/suppliers', supplierData)
  },

  async update(id: string, supplierData: Partial<Omit<Supplier, 'id' | 'company_id' | 'created_at' | 'updated_at'>>) {
    return api.patch<Supplier>(`/suppliers/${id}`, supplierData)
  },
}

// ============================================================================
// JOBS SERVICE
// ============================================================================

export const jobsService = {
  // Get all jobs
  async getAll() {
    return api.get<JobWithCustomer[]>('/jobs')
  },

  // Get a single job
  async getById(id: string) {
    return api.get<JobWithCustomer>(`/jobs/${id}`)
  },

  // Create a new job
  async create(jobData: Omit<Job, 'id' | 'created_at' | 'updated_at' | 'billing_hold'>) {
    return api.post<JobWithCustomer>('/jobs', jobData)
  },

  // Update a job
  async update(id: string, jobData: Partial<Job>) {
    return api.put<{
      status?: 'applied' | 'pending'
      job?: JobWithCustomer
      approval?: { id: string; status: ApprovalRequestStatus; action: ApprovalRequestAction } | null
      message?: string
    }>(`/jobs/${id}`, jobData)
  },

  async setBillingHold(id: string, billingHold: boolean) {
    return api.patch<{ job: JobWithCustomer }>(`/jobs/${id}/billing-hold`, {
      billing_hold: billingHold,
    })
  },

  // Delete a job
  async delete(id: string) {
    return api.delete<{ success: boolean }>(`/jobs/${id}`)
  },
}

// ============================================================================
// ASSIGNMENTS SERVICE
// ============================================================================

interface AssignmentWithDetails extends JobAssignment {
  job?: JobWithCustomer
  employee?: CompanyEmployee & { profile?: Profile | null }
}

type AssignmentCreateInput = {
  company_id: string
  job_id: string
  employee_id: string
  service_start_at?: string | null
  service_end_at?: string | null
  assignment_status?: AssignmentStatus
  notes?: string | null
}

export const assignmentsService = {
  // Get all assignments
  async getAll() {
    return api.get<AssignmentWithDetails[]>('/assignments')
  },

  // Get a single assignment
  async getById(id: string) {
    return api.get<AssignmentWithDetails>(`/assignments/${id}`)
  },

  // Create a new assignment
  async create(assignmentData: AssignmentCreateInput) {
    return api.post<AssignmentWithDetails>('/assignments', assignmentData)
  },

  // Update an assignment (including status changes)
  async update(id: string, assignmentData: Partial<JobAssignment>) {
    return api.patch<AssignmentWithDetails>(`/assignments/${id}`, assignmentData)
  },

  // Delete an assignment
  async delete(id: string) {
    return api.delete<{ success: boolean }>(`/assignments/${id}`)
  },

  // Convenience method for changing status
  async changeStatus(id: string, status: AssignmentStatus) {
    return this.update(id, { assignment_status: status })
  },
}

// ============================================================================
// EMPLOYEES SERVICE
// ============================================================================

export const employeesService = {
  // Get all employees
  async getAll(companyId?: string) {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : ''
    return api.get<(CompanyEmployee & { profile?: Profile | null })[]>(`/employees${query}`)
  },

  async getById(id: string) {
    return api.get<{ employee: CompanyEmployee & { profile?: Profile | null } }>(
      `/employees/${id}`
    )
  },

  async update(
    id: string,
    payload: {
      job_title?: string | null
      hourly_rate?: number | null
      work_status?: WorkStatus
      approval_status?: ApprovalStatus
      department?: string | null
    }
  ) {
    return api.patch<{
      employee: CompanyEmployee & { profile?: Profile | null }
      approval?: { id: string; status: ApprovalRequestStatus; action: ApprovalRequestAction } | null
      approval_applied?: boolean
      message?: string
    }>(
      `/employees/${id}`,
      payload
    )
  },
}

// ============================================================================
// COMPANIES SERVICE
// ============================================================================

export const companiesService = {
  // Get all companies owned by user
  async getAll() {
    return api.get<Company[]>('/companies')
  },
}

// ============================================================================
// INVOICES SERVICE
// ============================================================================

export interface InvoiceUpdateResponse {
  status?: 'applied' | 'pending'
  approval?: { id: string; status: ApprovalRequestStatus; action: ApprovalRequestAction } | null
  message?: string
  invoiceId?: string
  invoiceNumber?: string
  summary?: {
    subtotal: number
    tax: number
    total: number
    balance: number
  }
}

export const invoicesService = {
  async update(id: string, payload: UpdateInvoicePayload) {
    return api.patch<InvoiceUpdateResponse>(`/invoices/${id}`, payload)
  },
  async delete(id: string) {
    return api.delete<{ success: boolean }>(`/invoices/${id}`)
  },
}
