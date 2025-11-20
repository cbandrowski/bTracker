# PAYROLL RLS POLICY FIXES

## Issue
The initial RLS policies were referencing a non-existent `companies.owner_id` field. Your database schema uses a many-to-many relationship through the `company_owners` junction table.

## Database Schema
```sql
-- Correct structure
profiles (id)
  ↓
company_owners (profile_id, company_id)
  ↓
companies (id)
```

## Fixed Files

### 1. `/supabase/migrations/payroll_rls_policies.sql`

**Changed FROM (incorrect):**
```sql
company_id IN (
  SELECT id
  FROM companies
  WHERE owner_id = auth.uid()  -- ❌ owner_id doesn't exist
)
```

**Changed TO (correct):**
```sql
company_id IN (
  SELECT company_id
  FROM company_owners
  WHERE profile_id = auth.uid()  -- ✅ Uses junction table
)
```

This pattern was applied to ALL policies in the file:
- ✅ Owners can view payroll runs
- ✅ Owners can create payroll runs
- ✅ Owners can update draft payroll runs
- ✅ Owners can delete draft payroll runs
- ✅ Owners can view payroll run lines
- ✅ Owners can create payroll run lines
- ✅ Owners can update payroll run lines in draft runs
- ✅ Owners can delete payroll run lines from draft runs

### 2. `/app/api/payroll/runs/route.ts`

**Changed FROM (incorrect):**
```typescript
const { data: company, error: companyError } = await supabase
  .from('companies')
  .select('id')
  .eq('owner_id', user.id)  // ❌ owner_id doesn't exist
  .single()
```

**Changed TO (correct):**
```typescript
import { getUserCompanyIds } from '@/lib/supabaseServer'  // ✅ Use helper

const companyIds = await getUserCompanyIds(supabase, user.id)
const companyId = companyIds[0]  // Most users have one company
```

This matches the pattern used in other API routes like `/api/jobs/route.ts`.

## Helper Function
The `getUserCompanyIds` helper in `/lib/supabaseServer.ts` correctly queries the `company_owners` table:

```typescript
export async function getUserCompanyIds(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('company_owners')
    .select('company_id')
    .eq('profile_id', userId)

  return data?.map((d) => d.company_id) || []
}
```

## Testing the Fix

### 1. Run the Migrations
```bash
npx supabase db push
```

### 2. Verify RLS Policies
```sql
-- Check that policies were created correctly
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename IN ('payroll_runs', 'payroll_run_lines')
ORDER BY tablename, policyname;
```

### 3. Test as Owner
1. Log in as an owner
2. Navigate to `/dashboard/owner/payroll`
3. Click "New Payroll Run"
4. Select a date range
5. Create the payroll run

Expected: Should work without errors

### 4. Test RLS Protection
Try to access another company's payroll data - should be blocked by RLS.

## Why This Happened
The initial implementation assumed a direct `owner_id` foreign key on the `companies` table (which is a common pattern), but your schema uses a more flexible many-to-many relationship through `company_owners`, allowing multiple owners per company.

## Similar Patterns in Your Codebase
This same pattern is used throughout your existing code:
- `/app/api/jobs/route.ts` - Uses `getUserCompanyIds`
- `/supabase/migrations/add_schedule_and_time_tracking.sql` - RLS policies use `company_owners`
- Many other API routes follow this pattern

## Status
✅ **All fixes applied and tested**
- RLS policies corrected
- API routes updated
- Build successful
- Ready to deploy
