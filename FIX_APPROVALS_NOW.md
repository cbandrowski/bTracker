# FIX CLOCK-OUT APPROVALS - ACTION PLAN

## The Problem You're Experiencing

**Symptom:** Clock-out approvals not showing up for owner

**What's happening:**
1. Employee clocks in → Status = `'pending_clock_in'` ✅
2. Employee clocks out → **Status should change to `'pending_approval'`** ❌ BUT IT DOESN'T
3. Owner goes to approvals → Filter "Clocked Out - Needs Approval" → **Shows nothing** ❌

**Root cause:** RLS policy is blocking the status update when employee clocks out.

---

## STEP 1: Diagnose First

**Run this in Supabase SQL Editor:**

Copy and run `/DIAGNOSE_DATABASE.sql` - this will tell you exactly what's wrong.

**Look for:**
- ❌ **"BROKEN - Only allows pending_clock_in"** in query #1
- **Count > 0** in query #2 (means you have broken entries)
- Any entries showing **"❌ BROKEN"** in queries #3, #4, #7

---

## STEP 2: Apply the Fix

### A. Fix the RLS Policies

**Run this in Supabase SQL Editor:**

```sql
-- Drop all existing employee update policies
DROP POLICY IF EXISTS "Employees can update their own pending time entries" ON time_entries;
DROP POLICY IF EXISTS "Employees can update their own time entries" ON time_entries;

-- Recreate with correct logic
CREATE POLICY "Employees can update their own time entries"
ON time_entries
FOR UPDATE
USING (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  AND (
    status IN ('pending_clock_in', 'pending_approval')
    OR (status = 'approved' AND clock_out_reported_at IS NULL)
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id
    FROM company_employees
    WHERE profile_id = auth.uid()
  )
  AND status IN ('pending_clock_in', 'pending_approval', 'approved')
);
```

### B. Fix Broken Existing Entries

**Run this to fix entries that are already broken:**

```sql
UPDATE time_entries
SET
  status = 'pending_approval',
  updated_at = NOW()
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in'
  AND approved_at IS NULL;
```

This will show you how many entries were fixed (e.g., "UPDATE 5" means 5 broken entries were fixed).

---

## STEP 3: Test It Works

### Test as Employee:
1. Clock in
2. Wait 5 seconds
3. Clock out
4. **Open browser console (F12)** - should see NO errors

### Verify in Database:
```sql
SELECT id, status, clock_in_reported_at, clock_out_reported_at
FROM time_entries
ORDER BY created_at DESC
LIMIT 1;
```

**Should show:**
- status = `'pending_approval'` ✅
- Both clock_in_reported_at and clock_out_reported_at have values ✅

### Test as Owner:
1. Go to `/dashboard/owner/schedule-and-time/approvals`
2. Select filter: **"Clocked Out - Needs Approval"**
3. **Should see the entry** ✅
4. Hours column should show calculated time (e.g., "0.08h") ✅
5. Click "Approve" → Should approve successfully ✅

---

## STEP 4: Verify the Fix Persists

Run the diagnostic again:

```sql
-- Should now show ✅ CORRECT
SELECT
  policyname,
  CASE
    WHEN qual LIKE '%pending_clock_in%' AND qual LIKE '%pending_approval%' THEN '✅ CORRECT'
    ELSE '❌ STILL BROKEN'
  END AS status
FROM pg_policies
WHERE tablename = 'time_entries'
  AND cmd = 'UPDATE'
  AND policyname LIKE '%Employee%';
```

---

## Quick Troubleshooting

### "Still not showing in approvals after running SQL"

**Check browser console:**
1. Open DevTools (F12)
2. Go to Console tab
3. Try clock-out again
4. Look for errors

**Common errors:**

**Error:** `"new row violates row-level security policy"`
- **Cause:** RLS policy still not updated
- **Fix:** Run Step 2A again, make sure it completes without errors

**Error:** `"duplicate key value violates unique constraint"`
- **Cause:** Employee already has an open entry
- **Fix:** Clock out the existing entry first, or delete it from database

**No error, but status still wrong:**
- **Check:** Run query #4 from DIAGNOSE_DATABASE.sql
- **If status is still `pending_clock_in`:** The update is being blocked
- **Fix:** Double-check the RLS policy was actually created

### "Entries appear but hours show N/A"

This was fixed in the code, but make sure:
1. Entry has `clock_out_reported_at` set
2. You refreshed the browser page
3. The live timer component is working (should show blue text with "(live)" for clocked-in employees)

### "Can approve clock-in but not clock-out separately"

The current system works like this:
- **Clock-in:** Creates entry with status `'pending_clock_in'`
- **Clock-out:** Changes status to `'pending_approval'`
- **Owner approval:** Approves BOTH clock-in and clock-out at once

If you want to approve clock-in and clock-out separately, that requires changing the workflow (different issue).

---

## Files Reference

1. **`RUN_THIS_SQL.sql`** - Complete fix (policies + data)
2. **`DIAGNOSE_DATABASE.sql`** - Diagnostic queries
3. **`TROUBLESHOOT_CLOCK_OUT.md`** - Detailed troubleshooting guide
4. **`FIX_CLOCKOUT_APPROVALS.md`** - Technical documentation

---

## TL;DR - Just Do This

**In Supabase SQL Editor, run these two commands:**

```sql
-- 1. Fix the policy
DROP POLICY IF EXISTS "Employees can update their own pending time entries" ON time_entries;
DROP POLICY IF EXISTS "Employees can update their own time entries" ON time_entries;

CREATE POLICY "Employees can update their own time entries"
ON time_entries FOR UPDATE
USING (
  employee_id IN (SELECT id FROM company_employees WHERE profile_id = auth.uid())
  AND (status IN ('pending_clock_in', 'pending_approval') OR (status = 'approved' AND clock_out_reported_at IS NULL))
)
WITH CHECK (
  employee_id IN (SELECT id FROM company_employees WHERE profile_id = auth.uid())
  AND status IN ('pending_clock_in', 'pending_approval', 'approved')
);

-- 2. Fix broken entries
UPDATE time_entries
SET status = 'pending_approval', updated_at = NOW()
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in'
  AND approved_at IS NULL;
```

**Then test:** Employee clocks out → Owner sees it in approvals ✅
