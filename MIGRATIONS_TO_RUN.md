# Database Migrations to Run

Run these SQL migration files in your Supabase SQL Editor in the following order:

## 1. Fix Invoice Total Calculation (fix-invoice-total-calculation.sql)
This migration:
- Converts `total_amount` and `subtotal` from generated columns to regular columns
- Creates a trigger function to automatically calculate invoice totals when lines change
- Updates existing invoices with correct totals
- **Key Fix**: Properly calculates total as `subtotal + tax` (not just sum of all lines)

## 2. Fix Invoice Summary View (fix-invoice-summary-view.sql)
This migration:
- Updates the `v_invoice_summary` view to properly exclude deposit lines from subtotal
- Calculates tax only on non-deposit lines
- Tracks deposit applications separately
- Calculates balance as `total - deposits - payments`
- **Key Fix**: Ensures all balance calculations across the system are consistent

## 3. Fix Customer Billed Balance View (fix-customer-billed-balance-view.sql)
This migration:
- Updates the `v_customer_billed_balance` view to properly sum invoice balances
- Uses the corrected `balance_due` from `v_invoice_summary` (which already includes deposits and payments)
- **Key Fix**: Customer billed balance now shows the sum of all invoice remaining balances (after deposits and payments applied)

## Why These Fixes Are Needed

Previously, the invoice totals were incorrectly calculated by:
1. The `total_amount` in the invoices table was including deposit lines in the sum
2. The `v_invoice_summary` view was including deposit lines in the subtotal
3. Tax was not being added to create the proper total

After these migrations:
1. **Subtotal** = Sum of non-deposit lines (excludes deposit_applied lines)
2. **Tax** = Tax calculated only on non-deposit lines
3. **Total** = Subtotal + Tax
4. **Deposits Applied** = Tracked separately as negative amounts
5. **Payments Applied** = Tracked separately
6. **Balance** = Total - Deposits - Payments

This ensures the invoice view page, customer billing page, and all other pages show the same correct totals.

## How to Run

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `fix-invoice-total-calculation.sql` and run it
4. Copy and paste the contents of `fix-invoice-summary-view.sql` and run it
5. Copy and paste the contents of `fix-customer-billed-balance-view.sql` and run it
6. Refresh your application to see the corrected totals
