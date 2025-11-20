# Payroll Period Validation

## Overview

Added validation to prevent creating payroll runs for time periods that haven't ended yet. This ensures all hours for the period are complete before running payroll.

## Problem

Previously, users could create payroll runs for any date range, including:
- Current week (still in progress)
- Future dates
- Periods where employees are still working

This caused issues:
- **Incomplete data**: Missing hours from employees still working
- **Wrong calculations**: Payroll run without all the hours
- **Manual fixes needed**: Had to delete and recreate payroll runs
- **Time entry confusion**: Entries locked in payroll when they shouldn't be

## Solution

Added server-side validation that checks:
1. ✅ Period end date must be **before** the current date
2. ✅ User-friendly error message explaining why
3. ✅ Cannot bypass this validation

## How It Works

### Validation Logic

```typescript
const today = new Date()
today.setHours(0, 0, 0, 0) // Reset to start of day

if (endDate >= today) {
  return error: "Cannot create payroll for a period that has not ended yet"
}
```

### Examples

**Today's Date: December 1, 2024**

| Period Start | Period End | Result |
|-------------|-----------|--------|
| Nov 1, 2024 | Nov 30, 2024 | ✅ **Allowed** - Period ended yesterday |
| Nov 25, 2024 | Dec 1, 2024 | ❌ **Blocked** - Period includes today |
| Nov 25, 2024 | Dec 5, 2024 | ❌ **Blocked** - Period in the future |
| Dec 1, 2024 | Dec 7, 2024 | ❌ **Blocked** - Period hasn't started |

## File Modified

### `/app/api/payroll/runs/route.ts`

**Lines 67-87:** Added period validation

```typescript
// Prevent creating payroll for periods that haven't ended yet
// The period end date must be before today
if (endDate >= today) {
  return NextResponse.json({
    error: 'Cannot create payroll for a period that has not ended yet',
    details: 'The period end date must be in the past. Wait until the pay period is complete before running payroll.',
  }, { status: 422 })
}
```

## Fixing Mistakes (Deleting Early Payroll Runs)

If you created a payroll run too early by mistake, here's how to fix it:

### Option 1: Delete via UI

1. **Navigate to Payroll**: `/dashboard/owner/payroll`
2. **Click on the payroll run** you created by mistake
3. **Click "Delete" button** (only available for draft payrolls)
4. **Confirm deletion**
5. Time entries are automatically unlinked and available again

### Option 2: Delete via API

```bash
curl -X DELETE https://your-app.com/api/payroll/runs/{payroll_run_id}
```

### What Happens When Deleted

When you delete a draft payroll run:

1. ✅ All time entries are **unlinked** from the payroll
2. ✅ `payroll_run_id` set back to `NULL`
3. ✅ `regular_hours`, `overtime_hours`, `gross_pay` cleared
4. ✅ Payroll run lines are deleted
5. ✅ Time entries appear back in Time Entries tab
6. ✅ You can create a new payroll run after the period ends

### Important Notes

- ⚠️ **Only DRAFT payrolls** can be deleted
- ⚠️ **Finalized payrolls** cannot be deleted (prevents tampering with records)
- ✅ Deleting is safe - it just unlinks entries, doesn't delete them

## Recommended Payroll Workflow

### Weekly Payroll

**Week ending Sunday, Nov 30:**

1. ⏰ **Monday, Dec 1** (earliest): All hours are in, period has ended
2. 👍 **Monday - Wednesday**: Review and approve any pending time entries
3. 💰 **Wednesday/Thursday**: Create payroll run
4. ✅ **Thursday/Friday**: Review payroll, finalize
5. 💸 **Friday**: Process payments

### Bi-Weekly Payroll

**Pay period: Nov 15 - Nov 30:**

1. ⏰ **Monday, Dec 1**: Period ended, can create payroll
2. 👍 **Dec 1-2**: Approve pending entries
3. 💰 **Dec 3**: Create and review payroll
4. ✅ **Dec 4**: Finalize payroll
5. 💸 **Dec 5**: Process payments

## User Experience

### Before Fix
```
User: Creates payroll for Nov 25 - Dec 1
System: ✅ Payroll created!
User: Wait... today is Nov 28, people are still working!
User: Now what? 😰
```

### After Fix
```
User: Tries to create payroll for Nov 25 - Dec 1
System: ❌ Error: "Cannot create payroll for a period that has not ended yet"
User: Oh right, I need to wait until Dec 2! ✅
```

## Error Messages

### When Period Hasn't Ended

**Error:**
```json
{
  "error": "Cannot create payroll for a period that has not ended yet",
  "details": "The period end date must be in the past. Wait until the pay period is complete before running payroll."
}
```

**HTTP Status:** `422 Unprocessable Entity`

### Other Validations (Still Apply)

**End date before start date:**
```json
{
  "error": "period_end must be after period_start"
}
```

**Overlapping payroll run:**
```json
{
  "error": "A payroll run already exists for this period or overlaps with it",
  "existing_runs": [...]
}
```

## SQL to Find Current Payroll Runs

If you need to check what payroll runs exist:

```sql
-- Find all payroll runs
SELECT
  id,
  period_start,
  period_end,
  status,
  total_gross_pay,
  created_at
FROM payroll_runs
ORDER BY period_start DESC;

-- Find draft payrolls (can be deleted)
SELECT *
FROM payroll_runs
WHERE status = 'draft';

-- Find time entries in a specific payroll
SELECT
  te.id,
  te.employee_id,
  ce.profile_id,
  p.full_name,
  te.clock_in_approved_at,
  te.clock_out_approved_at,
  te.regular_hours,
  te.overtime_hours,
  te.gross_pay
FROM time_entries te
JOIN company_employees ce ON te.employee_id = ce.id
JOIN profiles p ON ce.profile_id = p.id
WHERE te.payroll_run_id = 'your-payroll-run-id'
ORDER BY te.clock_in_approved_at;
```

## SQL to Manually Fix a Payroll Run

**⚠️ Only use if UI deletion doesn't work:**

```sql
-- 1. First, unlink time entries
UPDATE time_entries
SET
  payroll_run_id = NULL,
  regular_hours = NULL,
  overtime_hours = NULL,
  gross_pay = NULL
WHERE payroll_run_id = 'your-payroll-run-id';

-- 2. Then delete the payroll run
DELETE FROM payroll_runs
WHERE id = 'your-payroll-run-id'
  AND status = 'draft'; -- Safety check
```

## Testing

### Test Case 1: Try to create payroll for current week
1. Navigate to Payroll → New
2. Select period_start = last Monday
3. Select period_end = this Sunday (in the future)
4. Click "Generate Payroll"
5. **Expected**: Error message about period not ended
6. **Verify**: No payroll created

### Test Case 2: Create payroll for past week
1. Navigate to Payroll → New
2. Select period_start = 2 weeks ago Monday
3. Select period_end = 2 weeks ago Sunday (in the past)
4. Click "Generate Payroll"
5. **Expected**: Payroll created successfully
6. **Verify**: Time entries removed from Time Entries tab

### Test Case 3: Delete draft payroll
1. Go to Payroll tab
2. Click on a draft payroll
3. Click "Delete" button
4. Confirm deletion
5. **Expected**: Redirected to payroll list, run deleted
6. **Verify**: Time entries reappear in Time Entries tab

## Future Enhancements

Potential improvements:
- Add warning in UI when selecting dates (before submission)
- Pre-select common date ranges (last week, last 2 weeks)
- Show calendar with highlighted pay periods
- Add "Estimated completion date" for current period
- Allow "draft preview" mode that doesn't lock entries
