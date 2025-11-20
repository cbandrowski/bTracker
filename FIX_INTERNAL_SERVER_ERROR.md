# Fix Internal Server Error

## Problem

The site shows "Internal Server Error" because the `employee_availability` table hasn't been created in your database yet.

## Solution

You need to run the migration file to create the table and RLS policies.

### Option 1: Run Migration via Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project at https://supabase.com
   - Navigate to SQL Editor

2. **Copy Migration SQL**
   - Open: `/supabase/migrations/20251119213513_add_employee_availability.sql`
   - Copy all the SQL code

3. **Run Migration**
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message

4. **Verify Table Created**
   ```sql
   -- Run this to check:
   SELECT * FROM employee_availability LIMIT 1;

   -- Should return "0 rows" (not an error)
   ```

5. **Verify RLS Policies**
   ```sql
   -- Check policies exist:
   SELECT policyname FROM pg_policies
   WHERE tablename = 'employee_availability';

   -- Should show 6 policies
   ```

6. **Restart Your Dev Server**
   ```bash
   # Kill existing server
   pkill -f "next dev"

   # Start fresh
   npm run dev
   ```

### Option 2: Supabase CLI (If Installed)

```bash
# Push all pending migrations
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 3: Manual SQL Commands

If you have direct database access:

```bash
# Using psql
psql YOUR_DATABASE_URL < supabase/migrations/20251119213513_add_employee_availability.sql
```

## What the Migration Does

1. Creates `employee_availability` table
2. Adds indexes for performance
3. Enables Row Level Security (RLS)
4. Creates 6 RLS policies:
   - Employees can read/insert/update/delete their own availability
   - Owners can read all availability in their company
   - Owners can manage all availability

## After Running Migration

Your site should work again and you'll have:
- ✅ Employee availability tracking
- ✅ Proper security policies
- ✅ No more internal server errors

## If Still Having Issues

### Check for Other Errors

1. **Check Browser Console**
   - Open DevTools (F12)
   - Look for specific error messages

2. **Check Server Logs**
   ```bash
   # Restart dev server and watch logs
   npm run dev
   ```

3. **Check Database Connection**
   - Verify `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Common Issues

**Issue:** "relation employee_availability does not exist"
- **Fix:** Run the migration (see above)

**Issue:** "permission denied for table employee_availability"
- **Fix:** RLS policies not created, re-run migration with RLS section

**Issue:** "column does not exist"
- **Fix:** Migration not fully applied, drop table and re-run:
  ```sql
  DROP TABLE IF EXISTS employee_availability CASCADE;
  -- Then run migration again
  ```

## Quick Test After Fix

```bash
# 1. Check homepage loads
curl http://localhost:3000

# 2. Try team page
# Navigate to /dashboard/owner/team

# 3. Try API endpoint
curl http://localhost:3000/api/employees
```

## Prevention for Future

To avoid this in the future:
1. Always run migrations before deploying code that uses new tables
2. Test locally with the migration applied first
3. Use Supabase CLI to sync migrations automatically
4. Add migration status check to CI/CD

## Emergency Rollback

If you need to remove the table:

```sql
-- This will delete the table and all data
DROP TABLE IF EXISTS employee_availability CASCADE;

-- This will also remove the RLS policies automatically
```

Then restart your app - it will work but without availability features.
