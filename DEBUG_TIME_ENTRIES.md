# Debug Time Entries Issue

## Problem Description
When filtering by "Pending Approval" in the owner's approval page, entries are not showing up correctly.

## Expected Behavior
- **"Clocked Out - Needs Approval" (pending_approval)**: Should show time entries where:
  - Employee has clocked IN (has `clock_in_reported_at`)
  - Employee has clocked OUT (has `clock_out_reported_at`)
  - Status is `pending_approval`
  - Needs owner approval

- **"Currently Clocked In" (pending_clock_in)**: Should show time entries where:
  - Employee has clocked IN (has `clock_in_reported_at`)
  - Employee has NOT clocked OUT yet (`clock_out_reported_at` is NULL)
  - Status is `pending_clock_in`
  - Employee is still working

## How to Debug

### 1. Check Database Directly
Run this SQL in Supabase SQL Editor:

```sql
-- See all time entries with their status
SELECT
  id,
  employee_id,
  clock_in_reported_at,
  clock_out_reported_at,
  status,
  created_at
FROM time_entries
ORDER BY clock_in_reported_at DESC
LIMIT 20;
```

### 2. Check for Status Mismatch
Look for entries where the status doesn't match the clock out state:

```sql
-- Entries that have clock_out but still show as pending_clock_in
SELECT
  id,
  employee_id,
  clock_in_reported_at,
  clock_out_reported_at,
  status
FROM time_entries
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in';

-- Should show entries with status = 'pending_approval'
```

### 3. Fix Mismatched Statuses
If you find entries with `clock_out_reported_at` that are still marked as `pending_clock_in`, run:

```sql
-- Fix entries that were clocked out but status wasn't updated
UPDATE time_entries
SET status = 'pending_approval'
WHERE clock_out_reported_at IS NOT NULL
  AND status = 'pending_clock_in';
```

### 4. Test the Clock-Out API
1. As an employee, clock in
2. As the same employee, clock out
3. Check the database to verify status changed to `pending_approval`
4. As an owner, go to Approvals page and filter by "Clocked Out - Needs Approval"
5. Verify the entry appears

## API Endpoints

### Employee Clock Out
`POST /api/employee/time-entries/clock-out`

This should:
1. Find open time entry (clock_out_reported_at IS NULL)
2. Set `clock_out_reported_at = NOW()`
3. Set `status = 'pending_approval'`

### Owner View Approvals
`GET /api/time-entries?status=pending_approval`

This should return entries where `status = 'pending_approval'`

## Possible Issues

1. **Database has old entries**: Time entries created before clock-out API was implemented
2. **Status not being set**: Clock-out API not properly setting status to `pending_approval`
3. **RLS policy issue**: Row Level Security preventing entries from showing
4. **Frontend filter issue**: UI filter not sending correct status parameter
