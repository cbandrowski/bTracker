# Payroll Time Entries Filter

## Overview

Added functionality to exclude time entries that are already in a payroll run from the Schedule & Time tabs. This prevents double-processing of time entries and provides a cleaner view of what still needs to be handled.

## Problem

Previously, all time entries were shown in the Time Entries and Approvals tabs regardless of whether they were already processed in a payroll run. This caused:

- **Confusion**: Owners couldn't easily see which entries still needed to be processed
- **Double-processing risk**: Entries already in payroll might be approved/edited again
- **Cluttered views**: Historical payroll entries mixed with active entries

## Solution

Added an `exclude_payroll` query parameter to the time entries API that filters out entries already assigned to a payroll run.

### How It Works

When fetching time entries, the API now checks if `exclude_payroll=true` is passed:
- ✅ If true: Only returns entries where `payroll_run_id IS NULL`
- ❌ If false/not specified: Returns all entries (backward compatible)

## Files Modified

### 1. `/app/api/time-entries/route.ts`

**Added:**
- `exclude_payroll` parameter to validation schema (line 17)
- Filter logic to exclude entries in payroll (lines 108-111)

```typescript
// Filter out entries already in payroll if requested
if (query.exclude_payroll === 'true') {
  dbQuery = dbQuery.is('payroll_run_id', null)
}
```

### 2. `/app/dashboard/owner/schedule-and-time/time-entries/page.tsx`

**Changed:**
- Added `exclude_payroll: 'true'` to API requests (line 87)
- Time entries tab now only shows entries NOT yet in payroll

### 3. `/app/dashboard/owner/schedule-and-time/approvals/page.tsx`

**Changed:**
- Added `exclude_payroll: 'true'` to all API requests (lines 80, 139, 175, 211)
- Approvals tab now only shows entries NOT yet in payroll
- Refresh operations after approve/reject/bulk actions maintain the filter

## User Experience

### Before
```
Time Entries Tab
├─ Entry #1 (Approved, in Payroll #5)
├─ Entry #2 (Approved, in Payroll #5)
├─ Entry #3 (Approved, not in payroll) ← Hard to find!
└─ Entry #4 (Pending approval)
```

### After
```
Time Entries Tab (Only shows unpaid entries)
├─ Entry #3 (Approved, not in payroll)
└─ Entry #4 (Pending approval)

Payroll Runs (View historical entries)
└─ Payroll #5
   ├─ Entry #1
   └─ Entry #2
```

## Workflow

### Normal Flow

1. **Employee clocks in/out**
   - Entry appears in Approvals tab

2. **Owner approves entry**
   - Entry moves to Time Entries tab
   - Available for payroll processing

3. **Owner creates payroll run**
   - Entry is assigned `payroll_run_id`
   - Entry removed from Time Entries tab
   - Entry removed from Approvals tab

4. **View historical entries**
   - Go to Payroll → View specific payroll run
   - All entries for that run are shown

### Key Points

✅ **Approvals Tab**: Only shows entries needing approval AND not yet in payroll
✅ **Time Entries Tab**: Only shows approved entries not yet in payroll
✅ **Payroll View**: Shows all entries for a specific payroll run (detailed breakdown)
✅ **Clean separation**: Active entries vs. processed entries

## Database Field

The `time_entries` table has a `payroll_run_id` field:
- `NULL`: Entry has not been processed in payroll yet
- `UUID`: Entry is part of the specified payroll run

```sql
SELECT
  id,
  employee_id,
  status,
  payroll_run_id,
  gross_pay
FROM time_entries
WHERE payroll_run_id IS NULL  -- Not yet in payroll
  AND status = 'approved';     -- Approved and ready
```

## API Usage

### Exclude entries in payroll
```typescript
fetch('/api/time-entries?exclude_payroll=true&status=approved')
```

### Include all entries (legacy behavior)
```typescript
fetch('/api/time-entries?status=approved')
// OR
fetch('/api/time-entries?exclude_payroll=false&status=approved')
```

## Benefits

1. **Clearer workflow**: Owners can see exactly what needs attention
2. **Prevents errors**: Can't accidentally re-process payroll entries
3. **Better organization**: Active work vs. historical records
4. **Easier auditing**: Payroll runs contain their entries, time tabs show active items
5. **Performance**: Fewer entries to load in active tabs

## Testing

To verify the filter works:

1. **Setup**:
   - Create some approved time entries
   - Note their IDs

2. **Before Payroll**:
   - Go to Time Entries tab
   - Verify approved entries appear
   - Note the count

3. **Create Payroll**:
   - Go to Payroll → New
   - Create payroll run for date range including those entries
   - Verify payroll created successfully

4. **After Payroll**:
   - Go back to Time Entries tab
   - Verify those entries are now gone
   - Count should be reduced

5. **View in Payroll**:
   - Go to Payroll tab
   - Click on the payroll run
   - Verify entries appear in the payroll breakdown

## Future Enhancements

Potential improvements:
- Add toggle in UI to show/hide payroll entries
- Add "View in Payroll" link for entries that are in payroll
- Show payroll run ID as a badge on entries
- Add filter to show only entries from specific payroll run
