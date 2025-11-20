# Fix: Route Slug Conflict Error

## Error

```
Error: You cannot use different slug names for the same dynamic path ('employeeId' !== 'id').
```

## Root Cause

Next.js doesn't allow multiple dynamic route segments with different names in the same location. We had:
- `/app/dashboard/owner/team/[employeeId]/page.tsx`
- `/app/dashboard/owner/team/[id]/page.tsx`

This creates ambiguity - Next.js can't determine which one to use.

## Solution

Removed all `[employeeId]` directories and standardized on `[id]` to match the rest of the app (customers, jobs, etc.).

### Files Removed

1. `/app/dashboard/owner/team/[employeeId]/` - Removed (conflicted with `[id]`)
2. `/app/api/employees/[employeeId]/` - Removed (replaced by `[id]` version)
3. `/app/api/employee-availability/[employeeId]/` - Removed (replaced by nested under `[id]`)

### Files Kept

1. ✅ `/app/dashboard/owner/team/[id]/page.tsx` - Employee detail page
2. ✅ `/app/api/employees/[id]/route.ts` - Employee API
3. ✅ `/app/api/employees/[id]/availability/route.ts` - Availability API

## URL Structure

### Before (Broken)
```
/dashboard/owner/team/[employeeId]  ← Conflict!
/dashboard/owner/team/[id]          ← Conflict!
```

### After (Fixed)
```
/dashboard/owner/team/[id]          ← Single, clear route
```

## API Endpoints

### Before (Had Duplicates)
```
GET /api/employees/[employeeId]
GET /api/employees/[id]
GET /api/employee-availability/[employeeId]
```

### After (Consolidated)
```
GET /api/employees/[id]
PATCH /api/employees/[id]
GET /api/employees/[id]/availability
PUT /api/employees/[id]/availability
```

## Consistent Naming Convention

Now all dynamic routes in the app use `[id]`:

| Route | Pattern |
|-------|---------|
| Customer Details | `/dashboard/owner/customers/[id]` |
| Employee Details | `/dashboard/owner/team/[id]` |
| Job Details | `/dashboard/owner/jobs/[id]` |
| Invoice Details | `/dashboard/owner/invoices/[id]` |
| Payroll Details | `/dashboard/owner/payroll/[id]` |

## How to Prevent This

1. **Stick to one naming convention** - Use `[id]` for all detail pages
2. **Check before creating** - Look for existing dynamic routes
3. **Use nested routes** - For sub-resources like `/employees/[id]/availability`
4. **Clean up old files** - Remove deprecated routes immediately

## Testing After Fix

```bash
# 1. Build should succeed
npm run build

# 2. Dev server should start
npm run dev

# 3. Visit team page
# Navigate to /dashboard/owner/team

# 4. Click on employee card
# Should go to /dashboard/owner/team/[id]

# 5. Test API
curl http://localhost:3000/api/employees/EMPLOYEE_UUID
```

## Related Changes

Since we removed the old routes, any code referencing `[employeeId]` was updated:
- Team list page now links to `/team/${employee.id}` ✅
- APIs updated to use `[id]` parameter ✅
- All route handlers use `params: Promise<{ id: string }>` ✅

## Status

✅ **Fixed** - Build successful
✅ **Routes cleaned** - No more conflicts
✅ **Consistent naming** - All use `[id]`
✅ **APIs working** - Properly namespaced

You can now run the app without the slug conflict error!
