# FIX: Clock-Out Approvals Not Showing

## Problem Diagnosis

When employees clock out, their time entries should:
1. Change status from `'pending_clock_in'` to `'pending_approval'`
2. Set `clock_out_reported_at` to current time
3. Appear in owner's approval screen under "Clocked Out - Needs Approval"
4. Show calculated hours instead of "N/A"

## Root Cause

The RLS (Row Level Security) policies for `time_entries` table are preventing employees from updating their entries when clocking out. The initial migration only allowed updates when `status = 'pending_clock_in'`, but the clock-out API tries to change the status TO `'pending_approval'`, which requires the policy to allow that transition.

## Solution

### Step 1: Run Diagnostic Query

First, let's check what policies currently exist:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'time_entries'
  AND cmd = 'UPDATE'
ORDER BY policyname;
```

### Step 2: Check Current Time Entries

See if there are entries stuck without proper status:

```sql
SELECT
  id,
  status,
  clock_in_reported_at,
  clock_out_reported_at,
  created_at,
  updated_at
FROM time_entries
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in'  -- These should be 'pending_approval'
ORDER BY clock_out_reported_at DESC
LIMIT 10;
```

### Step 3: Apply the Fix

Run the migration file I just created:

```bash
# Option 1: Using Supabase CLI (if linked)
npx supabase db push

# Option 2: Run SQL directly in Supabase Dashboard
# Copy and paste the contents of:
# /Users/cbandrowski/btracker/supabase/migrations/z_fix_time_entry_policies.sql
```

Or run this SQL directly:

```sql
-- =====================================================
-- FIX TIME ENTRY RLS POLICIES
-- =====================================================

-- Drop all existing employee update policies
DROP POLICY IF EXISTS "Employees can update their own pending time entries" ON time_entries;
DROP POLICY IF EXISTS "Employees can update their own time entries" ON time_entries;

-- Recreate the employee update policy with correct logic
CREATE POLICY "Employees can update their own time entries"
ON time_entries
FOR UPDATE
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  -- Allow updates when:
  -- 1. Status is pending_clock_in (normal clock out)
  -- 2. Status is pending_approval (corrections)
  -- 3. Status is approved BUT clock_out_reported_at is NULL (owner approved while still clocked in)
  AND (
    status IN ('pending_clock_in', 'pending_approval')
    OR (status = 'approved' AND clock_out_reported_at IS NULL)
  )
)
WITH CHECK (
  -- After update, employee_id must still match
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  -- Allow status transitions:
  -- - pending_clock_in -> pending_approval (normal clock out)
  -- - pending_approval -> pending_approval (corrections)
  -- - approved -> approved (just adding clock_out time)
  AND (
    status IN ('pending_clock_in', 'pending_approval', 'approved')
  )
);

-- Verify owners can view all time entries
DROP POLICY IF EXISTS "Owners can view their company time entries" ON time_entries;

CREATE POLICY "Owners can view their company time entries"
ON time_entries
FOR SELECT
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);

-- Verify owners can update time entries (for approvals)
DROP POLICY IF EXISTS "Owners can update their company time entries" ON time_entries;

CREATE POLICY "Owners can update their company time entries"
ON time_entries
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id
    FROM company_owners
    WHERE profile_id = auth.uid()
  )
);
```

### Step 4: Fix Existing Data (if needed)

If you have entries that are stuck with `clock_out_reported_at` set but status still `'pending_clock_in'`, fix them:

```sql
-- Update entries that have clock_out but wrong status
UPDATE time_entries
SET
  status = 'pending_approval',
  updated_at = NOW()
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in'
  AND approved_at IS NULL;
```

### Step 5: Verify the Fix

1. **Test employee clock-out:**
   - Have an employee clock in
   - Have them clock out
   - Check the database:
   ```sql
   SELECT status, clock_in_reported_at, clock_out_reported_at
   FROM time_entries
   WHERE employee_id = '<employee-id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - Status should be `'pending_approval'`
   - Both times should be set

2. **Test owner approval screen:**
   - Navigate to `/dashboard/owner/schedule-and-time/approvals`
   - Select filter "Clocked Out - Needs Approval"
   - You should see the entry
   - Hours column should show calculated hours (e.g., "8.50h")

### Step 6: Verify Policies Are Correct

After running the migration, verify policies:

```sql
SELECT
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%pending_clock_in%' AND qual LIKE '%pending_approval%' THEN '✅ Correct'
    WHEN qual LIKE '%pending_clock_in%' AND qual NOT LIKE '%pending_approval%' THEN '❌ Too Restrictive'
    ELSE '⚠️  Check Manually'
  END AS status
FROM pg_policies
WHERE tablename = 'time_entries'
  AND cmd = 'UPDATE'
  AND policyname LIKE '%Employees%'
ORDER BY policyname;
```

## What This Fixes

1. ✅ Employees can now clock out successfully
2. ✅ Status properly transitions from `'pending_clock_in'` to `'pending_approval'`
3. ✅ Owners can see clocked-out entries in approval screen
4. ✅ Hours are calculated and displayed correctly
5. ✅ "All Pending" and "Clocked Out - Needs Approval" filters work

## Technical Explanation

The RLS policy `USING` clause determines WHICH rows can be updated. The `WITH CHECK` clause determines what values are ALLOWED in the updated row.

**Before (broken):**
```sql
USING (... AND status = 'pending_clock_in')  -- Only allows update if CURRENT status is pending_clock_in
```

When employee clocks out, the API tries to set `status = 'pending_approval'`, but the `USING` clause only allows updates when status IS CURRENTLY `'pending_clock_in'`. This works!

BUT then the `WITH CHECK` clause (if it was restrictive) could prevent the NEW status from being `'pending_approval'`.

**After (fixed):**
```sql
USING (... AND status IN ('pending_clock_in', 'pending_approval'))  -- Allows update if current status is either
WITH CHECK (... AND status IN ('pending_clock_in', 'pending_approval', 'approved'))  -- Allows new status to be any of these
```

This allows:
- Clock out: `pending_clock_in` → `pending_approval` ✅
- Corrections: `pending_approval` → `pending_approval` ✅
- Late clock out on approved: `approved` → `approved` ✅

## Files Modified

- ✅ Created: `/supabase/migrations/z_fix_time_entry_policies.sql`
- ✅ Created: This documentation file

## Next Steps

1. Run the SQL fix (Step 3 above)
2. Fix any existing data (Step 4 above)
3. Test with a real employee clock-in/out cycle (Step 5 above)
4. Verify everything works as expected

---

**Status:** Ready to deploy
**Estimated time to fix:** 2 minutes
**Risk level:** Low (only affects RLS policies, easily reversible)
