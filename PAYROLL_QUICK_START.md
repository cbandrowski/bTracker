# PAYROLL SYSTEM - QUICK START GUIDE

## 🎯 What Was Built

A complete payroll system that:
- ✅ Calculates regular and overtime hours from approved time entries
- ✅ Computes gross pay using employee hourly rates
- ✅ Tracks payroll runs by pay period
- ✅ Prevents double-counting of time entries
- ✅ Provides owner UI for managing payroll
- ✅ Maintains historical payroll records

## 📁 Files Created

### Database Migrations (3 files)
- `supabase/migrations/add_employee_hourly_rate.sql` - Adds hourly_rate to employees
- `supabase/migrations/create_payroll_tables.sql` - Creates payroll_runs and payroll_run_lines tables
- `supabase/migrations/payroll_rls_policies.sql` - Security policies for payroll data

### TypeScript Types & Logic (2 files)
- `types/payroll.ts` - TypeScript interfaces and calculation rules
- `lib/payroll.ts` - Core payroll generation logic

### API Routes (3 routes)
- `app/api/payroll/runs/route.ts` - POST (create), GET (list)
- `app/api/payroll/runs/[id]/route.ts` - GET (details), DELETE
- `app/api/payroll/runs/[id]/finalize/route.ts` - POST (finalize)

### UI Pages (3 pages)
- `app/dashboard/owner/payroll/page.tsx` - List all payroll runs
- `app/dashboard/owner/payroll/new/page.tsx` - Create new payroll run
- `app/dashboard/owner/payroll/[id]/page.tsx` - View payroll run details

### Documentation (2 files)
- `PAYROLL_SYSTEM.md` - Complete system documentation
- `PAYROLL_QUICK_START.md` - This file

## 🚀 Setup Instructions

### Step 1: Run Database Migrations

**IMPORTANT:** The RLS policies have been fixed to work with your `company_owners` table structure. See `PAYROLL_RLS_FIXES.md` for details.

```bash
# Option A: Using Supabase CLI (recommended)
npx supabase db push

# Option B: Manual SQL execution (run in this order)
psql $DATABASE_URL -f supabase/migrations/add_employee_hourly_rate.sql
psql $DATABASE_URL -f supabase/migrations/create_payroll_tables.sql
psql $DATABASE_URL -f supabase/migrations/payroll_rls_policies.sql
```

### Step 2: Set Employee Hourly Rates

After running migrations, all employees will have a default hourly rate of $15.00. Update them:

```sql
-- Update individual employee rates
UPDATE company_employees
SET hourly_rate = 20.00
WHERE id = 'employee-uuid';

-- Or update all employees at once
UPDATE company_employees
SET hourly_rate = CASE
  WHEN first_name = 'John' THEN 25.00
  WHEN first_name = 'Jane' THEN 22.50
  ELSE 18.00
END;
```

### Step 3: Test the System

1. **Ensure you have approved time entries:**
   ```sql
   SELECT id, employee_id, status, clock_in_approved_at, clock_out_approved_at
   FROM time_entries
   WHERE status = 'approved'
     AND payroll_run_id IS NULL
   ORDER BY clock_in_approved_at DESC;
   ```

2. **Navigate to payroll section:**
   - Go to `/dashboard/owner/payroll`
   - Click "New Payroll Run"
   - Select a date range (or use quick select buttons)
   - Click "Create Payroll Run"

3. **Review the payroll run:**
   - View employee breakdown with hours and pay
   - Expand individual employees to see time entries
   - Verify calculations are correct

4. **Finalize when ready:**
   - Click "Finalize" button
   - Once finalized, the run cannot be modified
   - Time entries are locked to this run

## 📊 How It Works

### Payroll Calculation Flow

1. **Find eligible time entries:**
   - Status = 'approved'
   - clock_in_approved_at within pay period
   - Not already assigned to another payroll run
   - Has clock_out_approved_at (completed entries only)

2. **Calculate hours:**
   - Hours = clock_out_approved_at - clock_in_approved_at
   - Sum all hours per employee

3. **Split regular vs overtime:**
   - First 40 hours per week = regular
   - Anything over 40 hours = overtime

4. **Calculate pay:**
   - Regular Pay = regular_hours × hourly_rate
   - Overtime Pay = overtime_hours × hourly_rate × 1.5
   - Gross Pay = Regular Pay + Overtime Pay

5. **Create payroll records:**
   - One `payroll_runs` record for the period
   - One `payroll_run_lines` record per employee
   - Update `time_entries` with payroll_run_id

## 🎨 UI Overview

### Payroll List Page
- Shows all payroll runs
- Filter by status (all, draft, finalized)
- Displays period, employees, total gross pay
- Click row to view details

### New Payroll Run Page
- Quick select: Last Week, This Week, Last Month, This Month
- Manual date range selection
- Shows what will happen when created
- Creates and redirects to details

### Payroll Run Details Page
- Summary: Total employees, hours, gross pay
- Employee breakdown table
- Expandable time entries per employee
- Actions: Finalize, Delete (draft only)

## ⚙️ Customization

### Change Overtime Rules
Edit `types/payroll.ts`:

```typescript
export const PAYROLL_RULES = {
  REGULAR_HOURS_THRESHOLD: 40,    // Change this
  OVERTIME_MULTIPLIER: 1.5,       // Or this
  DEFAULT_HOURLY_RATE: 15.00,
}
```

### Daily Overtime Instead of Weekly
Edit `types/payroll.ts` → `splitRegularAndOvertime()` function:

```typescript
// Example: 8 hours per day, then overtime
export function splitRegularAndOvertime(totalHours: number): {
  regular: number
  overtime: number
} {
  const DAILY_REGULAR_HOURS = 8
  if (totalHours <= DAILY_REGULAR_HOURS) {
    return { regular: totalHours, overtime: 0 }
  }
  return {
    regular: DAILY_REGULAR_HOURS,
    overtime: totalHours - DAILY_REGULAR_HOURS,
  }
}
```

### Add Tax Calculation
Edit `lib/payroll.ts` → `generatePayrollRun()`:

```typescript
// After calculating gross pay, compute tax
const taxRate = 0.15 // 15% tax
const taxWithheld = totalGrossPay * taxRate
const netPay = totalGrossPay - taxWithheld

// Add to linesToInsert
linesToInsert.push({
  // ... existing fields
  tax_withheld: taxWithheld,
  net_pay: netPay,
})
```

## 🔒 Security

### Row Level Security (RLS)
- ✅ Owners can only see their company's payroll data
- ✅ Employees can view their own payroll lines (optional)
- ✅ Only draft runs can be modified or deleted
- ✅ Finalized runs are protected from changes

### Data Integrity
- ✅ Unique constraint prevents overlapping pay periods
- ✅ One payroll line per employee per run
- ✅ Time entries can't be double-counted
- ✅ Hourly rates are snapshotted (historical accuracy)

## 📈 Next Steps

### Immediate
1. Run migrations
2. Set employee hourly rates
3. Create a test payroll run
4. Verify calculations

### Future Enhancements
- Tax calculation and withholding
- Pay stub PDF generation
- Email notifications to employees
- Direct deposit integration
- State-specific tax rules
- Export to accounting software
- Year-end tax form generation (W-2, 1099)

## 🆘 Troubleshooting

### "No eligible time entries found"
**Check:**
- Time entries have status = 'approved'
- clock_in_approved_at is within date range
- clock_out_approved_at is not NULL
- payroll_run_id is NULL

**Query to check:**
```sql
SELECT COUNT(*), employee_id
FROM time_entries
WHERE company_id = 'your-company-id'
  AND status = 'approved'
  AND clock_in_approved_at >= '2024-01-01'
  AND clock_in_approved_at <= '2024-01-07'
  AND payroll_run_id IS NULL
  AND clock_out_approved_at IS NOT NULL
GROUP BY employee_id;
```

### "Overlapping payroll run exists"
**Solution:**
- Check existing runs: `SELECT * FROM payroll_runs WHERE company_id = 'your-id'`
- Delete draft run if needed
- Or choose a different date range

### Incorrect calculations
**Verify:**
1. Employee hourly rates: `SELECT first_name, last_name, hourly_rate FROM company_employees`
2. Time entry hours: Check approved times are correct
3. Overtime threshold: Review `PAYROLL_RULES` in `types/payroll.ts`

### Can't modify payroll run
**Reason:** Run is finalized
**Solution:** Only draft runs can be modified. Create a new run or delete and recreate.

## 📞 Support

For issues or questions:
1. Check `PAYROLL_SYSTEM.md` for detailed documentation
2. Review code comments in `/lib/payroll.ts`
3. Check server logs for error details
4. Verify RLS policies are correct

---

**Build successful!** ✅
All files created, TypeScript compiled, ready to use.
