// Zod validation schemas for billing/payment endpoints
import { z } from 'zod'

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const PaymentMethodSchema = z.enum([
  'cash',
  'check',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'other',
])

export const DepositTypeSchema = z.enum(['general', 'parts', 'supplies'])

export const CreatePaymentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  jobId: z.string().uuid('Invalid job ID').nullable().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  method: PaymentMethodSchema,
  depositType: DepositTypeSchema.optional(),
  memo: z.string().max(500).nullable().optional(),
})

export const EditPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0').optional(),
  depositType: DepositTypeSchema.optional(),
  memo: z.string().max(500).nullable().optional(),
})

// ============================================================================
// INVOICE SCHEMAS
// ============================================================================

export const InvoiceLineSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number(), // Can be negative for deposits
  taxRate: z.number().min(0).max(100).default(0), // Tax rate as percentage (0-100)
  lineType: z
    .enum(['service', 'parts', 'supplies', 'labor', 'deposit_applied', 'adjustment', 'other'])
    .default('service'),
  jobId: z.string().uuid().nullable().optional(), // Link to job if applicable
})

export const CreateInvoiceSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  jobIds: z.array(z.string().uuid()).optional().default([]),
  lines: z.array(InvoiceLineSchema).optional().default([]),
  depositIds: z.array(z.string().uuid()).optional().default([]),
  terms: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  issueNow: z.boolean().default(false),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)').nullable().optional(),
})

export const IssueInvoiceSchema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  terms: z.string().max(200).nullable().optional(),
})

// ============================================================================
// PAYMENT APPLICATION SCHEMA
// ============================================================================

export const CreatePaymentApplicationSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  invoiceId: z.string().uuid('Invalid invoice ID'),
  amount: z.number().positive('Amount must be greater than 0'),
})

// ============================================================================
// QUERY PARAMETER SCHEMAS
// ============================================================================

export const UnappliedPaymentsQuerySchema = z.object({
  depositType: DepositTypeSchema.optional(),
})

export const PaymentsIndexQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  depositType: DepositTypeSchema.optional(),
  applied: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
})

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>
export type EditPaymentInput = z.infer<typeof EditPaymentSchema>
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>
export type IssueInvoiceInput = z.infer<typeof IssueInvoiceSchema>
export type CreatePaymentApplicationInput = z.infer<typeof CreatePaymentApplicationSchema>
export type PaymentsIndexQuery = z.infer<typeof PaymentsIndexQuerySchema>
