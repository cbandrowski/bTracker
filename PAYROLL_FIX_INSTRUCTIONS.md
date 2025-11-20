# Fix Employee Payroll Access

## Problem
Employees cannot see their payroll data because Row Level Security (RLS) policies are missing on the `payroll_runs` and `payroll_run_lines` tables.

## How Payroll Data is Stored

When you create a payroll run with multiple employees:

1. **One `payroll_runs` record** is created for the entire company pay period
   - Contains: period_start, period_end, total_gross_pay, status (draft/finalized)

2. **Multiple `payroll_run_lines` records** are created (one per employee)
   - Each line contains: employee_id, hours worked, pay calculated for that specific employee
   - Links back to the payroll_run via `payroll_run_id`

## The Fix

You need to apply RLS policies so that:
- **Owners** can see ALL payroll runs and lines for their company
- **Employees** can see ONLY their own payroll run lines

## Steps to Fix

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard:
   - URL: https://chrdcugzkuidvcfydsub.supabase.co

2. Navigate to: **SQL Editor**

3. Open the file `FIX_PAYROLL_RLS.sql` in this directory

4. Copy the entire contents

5. Paste into the SQL Editor

6. Click **Run** (or press Cmd/Ctrl + Enter)

7. You should see a success message and a list of the created policies

### Option 2: Via Supabase CLI

If you have Supabase CLI installed and linked:

```bash
npx supabase db push
```

This will apply the migration file: `supabase/migrations/20251119_add_payroll_rls.sql`

## Verify the Fix

After applying the SQL:

1. Log in as an employee
2. Navigate to the Payroll page
3. You should now see your payroll history and current period data

## What the Policies Do

### For `payroll_run_lines` (most important for employees):

```sql
-- Employees can view their own payroll run lines
CREATE POLICY "Employees can view their own payroll run lines"
  ON public.payroll_run_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_employees ce
      WHERE ce.id = payroll_run_lines.employee_id
        AND ce.profile_id = auth.uid()
    )
  );
```

This allows employees to see their own payroll lines by checking:
- The `employee_id` in the payroll line matches their employee record
- Their `profile_id` matches the authenticated user

### For `payroll_runs`:

Owners can view/create/update/delete payroll runs for their companies.

## Testing

After applying the fix, test with:

1. **As Owner**: Create a new payroll run with multiple employees
2. **As Employee**: Log in and check the Payroll page - you should see your pay history
3. **Verify**: Each employee only sees their own payroll data, not other employees' data

## Troubleshooting

If employees still can't see data:

1. Check that the employee has an approved `company_employees` record
2. Verify the `employee_id` in `payroll_run_lines` matches their `company_employees.id`
3. Check the browser console for any API errors
4. Verify RLS is enabled: Run in SQL Editor:
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE tablename IN ('payroll_runs', 'payroll_run_lines');
   ```
   Both should show `rowsecurity = true`
