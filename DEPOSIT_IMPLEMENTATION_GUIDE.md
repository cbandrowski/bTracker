# Btracker Deposit & Billing Implementation Guide

## Overview

This guide explains how to implement and use the flexible deposit handling system for Btracker. The system allows business owners to:

- Take deposits (general, parts, or supplies) at job creation or any time
- Store deposits as unapplied payments
- Apply deposits to invoices (full or partial)
- Track customer billed balance globally
- Split deposits across multiple invoices

## Key Concepts

### 1. Deposits as Payments

Deposits are stored in the `payments` table with `is_deposit = true`. They represent cash received from customers that hasn't been applied to an invoice yet.

**Key fields:**
- `is_deposit`: Boolean flag marking this as a deposit
- `deposit_type`: Enum ('general', 'parts', 'supplies')
- `job_id`: Optional link to specific job
- `amount`: Deposit amount (always positive)

### 2. Deposit Application via Negative Lines

When applying a deposit to an invoice, we add a **negative line** to the invoice with:
- `line_type = 'deposit_applied'`
- `unit_price` is negative (e.g., -500.00)
- `applied_payment_id` references the deposit payment

This approach keeps the accounting clean and visible on the invoice.

### 3. Payment Applications Table

The `payment_applications` table tracks which payments have been applied to which invoices:
- Links `payment_id` to `invoice_id`
- Records `applied_amount`
- Optionally links to the invoice line via `invoice_line_id`

### 4. Customer Billed Balance

The global customer balance is calculated as:
```
Billed Balance = (Sum of all issued invoices) - (Sum of all payments)
```

This is independent of individual invoice statuses and provides a complete financial picture.

## Database Schema Summary

### Enums

```sql
deposit_type: 'general', 'parts', 'supplies'
payment_method: 'cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'other'
invoice_status: 'draft', 'issued', 'paid', 'partial', 'void', 'cancelled'
invoice_line_type: 'service', 'parts', 'supplies', 'labor', 'deposit_applied', 'adjustment', 'other'
```

### Core Tables

1. **payments** - All customer payments including deposits
2. **invoices** - Customer invoices
3. **invoice_lines** - Line items on invoices (including deposit applications)
4. **payment_applications** - Links payments to invoices

### Views

1. **v_customer_unapplied_payments** - Available credit per customer
2. **v_invoice_summary** - Complete invoice totals with payment status
3. **v_deposit_payments_by_customer_job** - Deposit history
4. **v_customer_billed_balance** - Global customer balance

## Common Workflows

### Workflow 1: Create Deposit at Job Creation

```sql
-- Owner creates a job and takes a parts deposit
INSERT INTO public.payments (
  company_id,
  customer_id,
  job_id,
  amount,
  payment_date,
  payment_method,
  is_deposit,
  deposit_type,
  memo,
  created_by
) VALUES (
  '...',  -- company_id
  '...',  -- customer_id
  '...',  -- job_id
  750.00,
  CURRENT_DATE,
  'check',
  true,
  'parts',
  'Parts deposit for kitchen remodel',
  '...'   -- profile_id of owner
);
```

**Result:** $750 deposit is stored as unapplied payment. Customer has $750 credit.

### Workflow 2: Check Available Deposits for Customer

```sql
-- When creating an invoice, show available deposits
SELECT
  payment_id,
  deposit_type,
  payment_amount,
  unapplied_amount,
  payment_date,
  memo,
  job_id
FROM public.v_customer_unapplied_payments
WHERE customer_id = '...'
  AND company_id = '...'
  AND has_unapplied_credit = true
ORDER BY payment_date ASC;
```

**UI Display:**
```
Available Deposits:
- $750.00 (Parts) - Kitchen remodel - Paid 2024-01-15
- $500.00 (General) - Paid 2024-01-20
```

### Workflow 3: Create Invoice and Apply Deposit

**Step 1: Create Invoice**

```sql
INSERT INTO public.invoices (
  company_id,
  customer_id,
  job_id,
  invoice_number,
  invoice_date,
  due_date,
  status,
  terms,
  created_by
) VALUES (
  '...',
  '...',
  '...',
  'INV-2024-001',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  'issued',
  'Net 30',
  '...'
) RETURNING id;
```

**Step 2: Add Service/Parts Lines**

```sql
INSERT INTO public.invoice_lines (
  invoice_id,
  line_number,
  line_type,
  description,
  quantity,
  unit_price,
  taxable,
  tax_rate
) VALUES
(invoice_id, 1, 'labor', 'Kitchen cabinet installation', 16, 85.00, true, 0.0825),
(invoice_id, 2, 'parts', 'Custom cabinets', 1, 4500.00, true, 0.0825);
```

**Step 3: Add Deposit Applied Line**

```sql
-- Apply the $750 parts deposit
INSERT INTO public.invoice_lines (
  invoice_id,
  line_number,
  line_type,
  description,
  quantity,
  unit_price,
  applied_payment_id,
  taxable
) VALUES (
  invoice_id,
  3,
  'deposit_applied',
  'Parts Deposit Applied',
  1,
  -750.00,  -- NEGATIVE amount
  deposit_payment_id,
  false
) RETURNING id;
```

**Step 4: Record Payment Application**

```sql
INSERT INTO public.payment_applications (
  payment_id,
  invoice_id,
  applied_amount,
  invoice_line_id,
  applied_by
) VALUES (
  deposit_payment_id,
  invoice_id,
  750.00,  -- POSITIVE amount applied
  deposit_line_id,
  profile_id
);
```

**Invoice Display:**

```
Invoice #INV-2024-001

Line Items:
1. Kitchen cabinet installation (16 hrs @ $85.00)    $1,360.00
2. Custom cabinets                                   $4,500.00
3. Parts Deposit Applied                              -$750.00
                                                     ----------
Subtotal:                                            $5,110.00
Tax (8.25%):                                           $421.58
TOTAL:                                               $5,531.58

Amount Paid:                                           $750.00
Balance Due:                                         $4,781.58
```

### Workflow 4: Partial Deposit Application

Split a $1,000 general deposit across two invoices:

**Invoice A - Apply $400:**

```sql
-- Add deposit line to Invoice A
INSERT INTO public.invoice_lines (
  invoice_id, line_number, line_type, description,
  quantity, unit_price, applied_payment_id, taxable
) VALUES (
  invoice_a_id, 10, 'deposit_applied', 'General Deposit Applied (Partial)',
  1, -400.00, deposit_id, false
);

-- Record application
INSERT INTO public.payment_applications (
  payment_id, invoice_id, applied_amount
) VALUES (deposit_id, invoice_a_id, 400.00);
```

**Invoice B - Apply $600:**

```sql
-- Add deposit line to Invoice B
INSERT INTO public.invoice_lines (
  invoice_id, line_number, line_type, description,
  quantity, unit_price, applied_payment_id, taxable
) VALUES (
  invoice_b_id, 5, 'deposit_applied', 'General Deposit Applied (Partial)',
  1, -600.00, deposit_id, false
);

-- Record application
INSERT INTO public.payment_applications (
  payment_id, invoice_id, applied_amount
) VALUES (deposit_id, invoice_b_id, 600.00);
```

**Result:** $1,000 deposit fully applied across two invoices.

### Workflow 5: Edit Deposit (Before Application)

```sql
-- Check if deposit can be edited
SELECT public.can_edit_deposit(deposit_id);
-- Returns: true (if unapplied) or false (if applied)

-- Update deposit amount, type, or memo
UPDATE public.payments
SET
  amount = 850.00,
  deposit_type = 'general',
  memo = 'Updated to general deposit',
  updated_at = now()
WHERE id = deposit_id
  AND public.can_edit_deposit(id) = true;
```

**Rule:** Deposits can only be edited if they have NOT been applied to any invoice.

### Workflow 6: Check Customer Billed Balance

```sql
SELECT
  customer_name,
  total_invoiced,
  total_payments,
  billed_balance,
  unapplied_credit
FROM public.v_customer_billed_balance
WHERE customer_id = '...';
```

**Example Output:**

```
customer_name: "ABC Construction Co"
total_invoiced: $15,750.00  (sum of all issued/active invoices)
total_payments: $8,250.00   (sum of ALL payments including deposits)
billed_balance: $7,500.00   (what customer owes)
unapplied_credit: $500.00   (deposits not yet applied to invoices)
```

## UI Implementation Guidelines

### Customer Billing Header

Display the following on customer detail pages:

```
Customer: ABC Construction Co
─────────────────────────────────────────
Total Invoiced:       $15,750.00
Total Payments:        $8,250.00
Billed Balance:        $7,500.00
Unapplied Credit:        $500.00
```

### Job Creation - Deposit Section

```
┌─ Deposit (Optional) ────────────────────┐
│ □ Collect deposit                        │
│                                          │
│ Deposit Type: [General ▼]               │
│               General / Parts / Supplies │
│                                          │
│ Amount: [$________]                      │
│                                          │
│ Payment Method: [Check ▼]               │
│ Reference #: [________]                  │
│ Memo: [____________________________]     │
└──────────────────────────────────────────┘
```

### Invoice Creation - Apply Deposits

```
┌─ Available Deposits ─────────────────────┐
│ ☑ $750.00 - Parts - Kitchen remodel      │
│   Paid: 2024-01-15 | Apply: [$750.00]   │
│                                          │
│ □ $500.00 - General - Paid: 2024-01-20  │
│   Apply: [$______]                       │
│                                          │
│ Total to Apply: $750.00                  │
└──────────────────────────────────────────┘
```

When deposits are selected:
1. Automatically add negative "Deposit Applied" line(s) to invoice
2. Update invoice total
3. Create payment_applications records

### Deposit Management View

```
Deposits for Customer: ABC Construction Co
─────────────────────────────────────────────────────────────
Date       | Type    | Job           | Amount  | Applied | Available
─────────────────────────────────────────────────────────────
2024-01-15 | Parts   | Kitchen       | $750.00 | $750.00 | $0.00
2024-01-20 | General | -             | $500.00 | $0.00   | $500.00
2024-02-01 | Parts   | Bathroom      | $400.00 | $200.00 | $200.00
─────────────────────────────────────────────────────────────
                       Total Available Credit: $700.00
```

## Accounting Notes

### How It Works

1. **Deposit Received:** Cash-in event recorded as payment
   - Debit: Cash $500
   - Credit: Customer Deposits (liability) $500

2. **Deposit Applied to Invoice:** Reduces invoice total
   - Invoice shows negative line "Deposit Applied: -$500"
   - Invoice total is reduced by $500
   - Payment application recorded

3. **Customer Pays Remaining Balance:** Another payment
   - Debit: Cash $remaining
   - Credit: Accounts Receivable $remaining

4. **Final State:**
   - Invoice fully paid (via deposit + payment)
   - Customer Deposits liability reduced to $0
   - Cash account reflects all money received

### Why Negative Lines?

Using negative invoice lines for deposit applications:
- Makes deposits visible on printed invoices
- Clearly shows the reduction in amount due
- Simplifies invoice total calculations
- Maintains clean audit trail
- Familiar to most accounting systems

### Consistency with payment_applications

Both mechanisms work together:
- **Negative lines:** Display on invoice, reduce total
- **payment_applications:** Track which payments applied to which invoices

This dual approach ensures:
- Accurate totals in views (v_invoice_summary)
- Clear audit trail (payment_applications)
- Professional invoice presentation (negative lines)

## Edge Cases & Validation

### 1. Prevent Over-Application

```sql
-- Before applying deposit, check available amount
SELECT public.get_available_deposit_amount(deposit_id);

-- Ensure applied_amount <= available amount
-- Implement in application logic or trigger
```

### 2. Prevent Editing Applied Deposits

```sql
-- Use can_edit_deposit() function
UPDATE public.payments
SET amount = new_amount
WHERE id = deposit_id
  AND public.can_edit_deposit(id) = true;
```

### 3. Handle Voided Invoices

When an invoice is voided:
- Update invoice status to 'void'
- Consider: Reverse payment_applications (un-apply deposits)
- Make deposits available again for other invoices

```sql
-- Option 1: Delete payment applications
DELETE FROM public.payment_applications
WHERE invoice_id = voided_invoice_id;

-- Option 2: Keep for audit trail, exclude from views
-- (Views already exclude void invoices from totals)
```

### 4. Deposit Refunds

If a deposit needs to be refunded:

```sql
-- Create a negative payment (refund)
INSERT INTO public.payments (
  company_id,
  customer_id,
  amount,
  payment_date,
  payment_method,
  is_deposit,
  deposit_type,
  memo
) VALUES (
  company_id,
  customer_id,
  -500.00,  -- Negative for refund
  CURRENT_DATE,
  'check',
  true,
  'general',
  'Refund of deposit - job cancelled'
);
```

**Note:** May need to adjust schema to allow negative amounts for refunds.

## Performance Considerations

### Indexes

All necessary indexes are created:
- `idx_payments_customer_id` - Fast customer payment lookups
- `idx_payments_is_deposit` - Filter deposits quickly
- `idx_invoice_lines_invoice_id` - Invoice line aggregations
- `idx_payment_applications_payment_id` - Payment application totals

### View Performance

Views use aggregations efficiently:
- `v_customer_unapplied_payments`: Groups by payment
- `v_invoice_summary`: Groups by invoice
- `v_customer_billed_balance`: Groups by customer

For large datasets (10,000+ invoices), consider:
- Materialized views with refresh schedule
- Caching computed totals in application layer
- Pagination in UI queries

## RLS (Row Level Security) Considerations

Add RLS policies to ensure:
- Users can only see their company's data
- Employees can view but not modify
- Owners can create/edit deposits and invoices

```sql
-- Example RLS policy for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_company_isolation ON public.payments
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_owners WHERE profile_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_employees WHERE profile_id = auth.uid()
    )
  );
```

## Migration Path

If you have existing invoices without this system:

1. **Deploy schema:** Run `deposit_billing_schema.sql`
2. **Migrate existing data:**
   - Create invoices from existing jobs
   - Mark historical payments (if any)
3. **Test workflows:** Create test deposits and invoices
4. **Train users:** Show owners how to use deposit features
5. **Go live:** Enable in production

## Testing Checklist

- [ ] Create deposit at job creation
- [ ] Create deposit without a job
- [ ] View available deposits for customer
- [ ] Apply full deposit to invoice
- [ ] Apply partial deposit to invoice
- [ ] Split deposit across multiple invoices
- [ ] Edit unapplied deposit
- [ ] Prevent editing applied deposit
- [ ] View customer billed balance
- [ ] View invoice summary with deposits
- [ ] Check deposit history by customer/job
- [ ] Verify payment_applications records
- [ ] Test with multiple deposit types
- [ ] Void invoice and check deposit availability

## Support & Questions

For questions about this implementation:
1. Review the SQL schema: `deposit_billing_schema.sql`
2. Check example queries in schema comments
3. Test with sample data in development environment
4. Refer to views for pre-built queries

## Next Steps

1. **Deploy Schema:** Execute `deposit_billing_schema.sql` in Supabase
2. **Build UI Components:**
   - Deposit creation form (job creation + standalone)
   - Available deposits selector (invoice creation)
   - Customer billing header (billed balance display)
   - Deposit management table
3. **Add RLS Policies:** Secure tables with row-level security
4. **Create API Endpoints:**
   - `POST /deposits` - Create deposit
   - `GET /deposits/customer/:id` - List customer deposits
   - `POST /invoices` - Create invoice with deposit application
   - `GET /customers/:id/balance` - Get billed balance
5. **Test End-to-End:** Complete workflows from UI to database
