// Frontend service layer for API calls
// Provides type-safe methods for all backend API routes

import { api } from '../api'
import { Customer, Job, JobAssignment, CompanyEmployee, Company, JobWithCustomer, Profile } from '@/types/database'

// ============================================================================
// CUSTOMERS SERVICE
// ============================================================================

export const customersService = {
  // Get all customers
  async getAll() {
    return api.get<Customer[]>('/customers')
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

  // Delete a customer
  async delete(id: string) {
    return api.delete<{ success: boolean }>(`/customers/${id}`)
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
  async create(jobData: Omit<Job, 'id' | 'created_at' | 'updated_at'>) {
    return api.post<JobWithCustomer>('/jobs', jobData)
  },

  // Update a job
  async update(id: string, jobData: Partial<Job>) {
    return api.put<JobWithCustomer>(`/jobs/${id}`, jobData)
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
  employee?: CompanyEmployee & { profile?: any }
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
  async create(assignmentData: Omit<JobAssignment, 'id' | 'created_at' | 'updated_at'>) {
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
  async changeStatus(id: string, status: 'assigned' | 'in_progress' | 'done' | 'cancelled') {
    return this.update(id, { assignment_status: status })
  },
}

// ============================================================================
// EMPLOYEES SERVICE
// ============================================================================

export const employeesService = {
  // Get all employees
  async getAll() {
    return api.get<(CompanyEmployee & { profile?: any })[]>('/employees')
  },

  async getById(id: string) {
    return api.get<{ employee: CompanyEmployee & { profile?: Profile | null } }>(
      `/employees/${id}`
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
