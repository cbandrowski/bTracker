# Payroll Employee Name Fix

## Problem

When creating or viewing payroll runs, the system was trying to query `first_name` and `last_name` columns from the `company_employees` table, which don't exist. This caused the error:

```
Failed to fetch employees: column company_employees.first_name does not exist
```

## Root Cause

The `company_employees` table doesn't have `first_name`, `last_name`, or `email` columns directly. Instead, it has:
- `profile_id` → links to `profiles` table
- `profiles` table contains: `full_name` and `email`

The payroll system was incorrectly trying to select these fields directly from `company_employees`.

## Solution

Updated all payroll-related queries to properly join through the `profiles` table:

### Before (Incorrect)
```typescript
.select('id, first_name, last_name, email, hourly_rate')
.from('company_employees')
```

### After (Correct)
```typescript
.select(`
  id,
  hourly_rate,
  profile:profiles(
    id,
    full_name,
    email
  )
`)
.from('company_employees')
```

## Files Modified

### 1. `/lib/payroll.ts`

**Line 76-87:** Fixed employee data fetch
- Changed from selecting `first_name, last_name, email` directly
- Now properly joins to `profiles` table
- Updated employee mapping to use `profile.full_name`

**Line 131:** Fixed employee name usage
- Changed from `${employee.first_name} ${employee.last_name}`
- Now uses `employee.profile.full_name`

**Line 181-195:** Fixed payroll lines selection
- Updated the `.select()` after inserting lines
- Properly joins through profiles table

### 2. `/app/api/payroll/runs/[id]/route.ts`

**Line 42-57:** Fixed payroll run lines query
- Changed employee select to join through profiles
- Removed direct `first_name`, `last_name`, `email` selection
- Added proper nested profile selection

### 3. `/app/dashboard/owner/payroll/[id]/page.tsx`

**Line 24-43:** Updated PayrollLine interface
- Changed employee structure to include nested profile
- Updated from flat `first_name, last_name, email`
- Now has `employee.profile.full_name` and `employee.profile.email`

**Line 293-297:** Updated display logic
- Changed from `{line.employee.first_name} {line.employee.last_name}`
- Now displays `{line.employee.profile.full_name}`
- Updated email display to use `line.employee.profile.email`

## Database Schema Reference

### company_employees table
```sql
CREATE TABLE company_employees (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  profile_id uuid REFERENCES profiles(id),
  hourly_rate numeric DEFAULT 15.00,
  hire_date date,
  job_title text,
  ...
);
```

### profiles table
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  ...
);
```

## Testing

To verify the fix:

1. **Navigate to Payroll**: `/dashboard/owner/payroll/new`
2. **Create a new payroll run**:
   - Select a date range with approved time entries
   - Click "Generate Payroll"
3. **Verify**:
   - Employee names display correctly (using full_name from profiles)
   - No database errors occur
   - Payroll run shows all employees with approved hours
4. **View payroll details**: Click on a payroll run
   - Employee names should display properly
   - Time entries should be grouped by employee
   - Pay calculations should be correct

## Expected Behavior After Fix

✅ Payroll generation works without database errors
✅ Employee names display correctly using `full_name` from profiles table
✅ Email addresses display when available
✅ All payroll queries properly join through the profiles table
✅ Separate paystubs are created for each employee with their hours
✅ Available hours for payroll are correctly calculated and displayed
