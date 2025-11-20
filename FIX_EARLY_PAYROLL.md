# How to Fix Your Early Payroll Run

## Quick Fix Steps

You created a payroll run too early and need to delete it so you can add more time entries. Here's how:

### Step 1: Navigate to Payroll
1. Go to `/dashboard/owner/payroll`
2. You should see your payroll run listed

### Step 2: Open the Payroll Run
1. Click on the payroll run you want to delete
2. You'll see the detailed view with employee breakdown

### Step 3: Delete the Payroll
1. Look for the **"Delete"** button (red button in top right)
2. Click it
3. Confirm the deletion when prompted

### Step 4: Verify
1. You'll be redirected back to the payroll list
2. The payroll run should be gone
3. Go to **Time Entries** tab
4. Your time entries should now appear again

## What Happens

When you delete the draft payroll:
- ✅ Time entries are **unlinked** from payroll
- ✅ They become available again in Time Entries tab
- ✅ You can approve more entries
- ✅ Later, create a new payroll run when period ends

## Important Notes

- ⚠️ You can **ONLY** delete **DRAFT** payrolls
- ⚠️ If you already clicked "Finalize", you **CANNOT** delete it
- ✅ Don't worry - deleting just unlinks entries, doesn't delete them

## After Deletion

### New Payroll Validation

From now on, the system will **prevent** creating payroll for periods that haven't ended:

**Example:**
- Today: December 1
- Try to create payroll for Nov 25 - Dec 5
- **Result:** ❌ Error - "Period must be in the past"

**Correct way:**
- Today: December 1
- Create payroll for Nov 1 - Nov 30
- **Result:** ✅ Success!

## Timeline for Next Payroll

1. **Wait until period ends** (e.g., Sunday night)
2. **Monday**: Review and approve any pending time entries
3. **Tuesday/Wednesday**: Create payroll run
4. **Thursday**: Review and finalize
5. **Friday**: Process payments

## If Delete Button Doesn't Work

### Check Payroll Status
The delete button only appears for **draft** payrolls. If you see:
- 🟢 **Green badge "Finalized"**: Cannot delete (contact support)
- 🟡 **Yellow badge "Draft"**: Can delete

### Manual SQL Fix (Last Resort)

**⚠️ Only if UI doesn't work:**

1. Get your payroll run ID from the URL or database
2. Run this in Supabase SQL editor:

```sql
-- First, check the payroll status
SELECT id, status, period_start, period_end, total_gross_pay
FROM payroll_runs
WHERE status = 'draft'
ORDER BY created_at DESC
LIMIT 5;

-- If you see your payroll and status is 'draft', note the ID
-- Then run this (replace 'your-payroll-id' with actual ID):

-- Step 1: Unlink time entries
UPDATE time_entries
SET
  payroll_run_id = NULL,
  regular_hours = NULL,
  overtime_hours = NULL,
  gross_pay = NULL
WHERE payroll_run_id = 'your-payroll-id';

-- Step 2: Delete the payroll run
DELETE FROM payroll_runs
WHERE id = 'your-payroll-id'
  AND status = 'draft';

-- Step 3: Verify it's gone
SELECT COUNT(*) FROM payroll_runs WHERE id = 'your-payroll-id';
-- Should return 0

-- Step 4: Verify entries are unlinked
SELECT COUNT(*) FROM time_entries WHERE payroll_run_id = 'your-payroll-id';
-- Should return 0
```

## Adding New Time Entries

After deleting the payroll:

1. **Employees can clock in/out** normally
2. **Approve their time entries** as usual
3. Entries will appear in Time Entries tab
4. **When period ends**, create new payroll run
5. New payroll will include ALL approved entries (old + new)

## Example Scenario

**What happened:**
- Created payroll for Nov 1 - Nov 30 on Nov 28
- Realized some employees still working
- Need to add their hours too

**How to fix:**
1. Delete the draft payroll (button in UI)
2. Wait until Dec 1 (period ends)
3. All hours from Nov 1-30 are now complete
4. Create new payroll run
5. Includes all hours (old entries you approved + new entries)

**Result:**
- ✅ Complete payroll with all hours
- ✅ No missing time entries
- ✅ Accurate pay calculations

## Prevention Going Forward

The system now enforces:
- 🚫 Cannot create payroll until period ends
- ✅ Must wait until day after period end
- ✅ Ensures all hours are in before running payroll

**Best Practice:**
- Weekly payroll: Run on Monday for previous week
- Bi-weekly payroll: Run on first business day after period ends
- Monthly payroll: Run on 1st-3rd of following month
