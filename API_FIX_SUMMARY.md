# API Routes Authentication Fix

## Problem
After migrating to API routes, pages were showing no data even though data existed in the database.

## Root Cause
The `createServerClient()` function in `/lib/supabaseServer.ts` was not properly configured to handle cookies in Next.js App Router. This meant:
- API routes couldn't access the user's authentication session
- All requests returned 401 Unauthorized
- No data was being fetched from the database

## Solution

### 1. Updated `/lib/supabaseServer.ts`

Changed from basic Supabase client to SSR-aware client with cookie handling:

**Before:**
```typescript
import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  })
}
```

**After:**
```typescript
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore errors from Server Components
          }
        },
      },
    }
  )
}
```

### 2. Updated All API Routes

Added `await` to all `createServerClient()` calls since it's now async:

**Before:**
```typescript
const supabase = createServerClient()
```

**After:**
```typescript
const supabase = await createServerClient()
```

**Updated files:**
- `/app/api/customers/route.ts`
- `/app/api/customers/[id]/route.ts`
- `/app/api/jobs/route.ts`
- `/app/api/jobs/[id]/route.ts`
- `/app/api/assignments/route.ts`
- `/app/api/assignments/[id]/route.ts`
- `/app/api/employees/route.ts`
- `/app/api/companies/route.ts`

## How It Works Now

1. **User logs in** → Session cookie is stored in browser
2. **Frontend makes API request** → Cookie is automatically sent with request
3. **API route receives request** → `createServerClient()` reads cookies
4. **Supabase client is created** → With user's session from cookies
5. **`getCurrentUser()` called** → Returns authenticated user
6. **Data is fetched** → Only for user's companies (security enforced)
7. **Response sent** → Data returned to frontend

## Testing

### Check if it's working:

1. **Open browser DevTools** → Network tab
2. **Navigate to Customers page**
3. **Look for request** to `/api/customers`
4. **Check response**:
   - ✅ Status 200 with data array = Working!
   - ❌ Status 401 = Still not authenticating
   - ❌ Empty array [] = No companies or no data

### Debug steps if still not working:

1. **Check environment variables:**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. **Check user is logged in:**
   - Open browser console
   - Should see user profile in AuthContext

3. **Check cookies:**
   - DevTools → Application → Cookies
   - Should see Supabase auth cookies

4. **Check API route logs:**
   - Terminal running `npm run dev`
   - Should see any errors from API routes

5. **Test API route directly:**
   ```bash
   # Get your session cookie from browser DevTools
   curl http://localhost:3000/api/customers \
     -H "Cookie: sb-xxxxx"
   ```

## Key Changes Summary

| File | Change | Reason |
|------|--------|--------|
| `lib/supabaseServer.ts` | Use `@supabase/ssr` with cookies | Proper session handling in API routes |
| All API routes | Add `await` to `createServerClient()` | Function is now async |
| Type signatures | Use `Awaited<ReturnType<...>>` | TypeScript compatibility |

## Dependencies

Make sure `@supabase/ssr` is installed:

```bash
npm install @supabase/ssr
```

If not installed, add it:
```bash
npm install @supabase/ssr@latest
```

## Common Errors Fixed

### Error: "Cannot read properties of undefined (reading 'auth')"
**Cause:** Not awaiting `createServerClient()`
**Fix:** Add `await` before `createServerClient()`

### Error: "401 Unauthorized"
**Cause:** Cookies not being read properly
**Fix:** Use `@supabase/ssr` with cookie handling

### Error: "Empty array returned"
**Cause:** User has no companies in database
**Fix:** Check `company_owners` table has entries for the user

## Verification

After the fix, you should see:
- ✅ Customers page loads data
- ✅ Jobs page loads data
- ✅ Assignments page loads data
- ✅ All API routes return 200 status
- ✅ User-specific data only (company isolation working)

## Next Steps

The API routes are now working correctly! You can:
1. Test all CRUD operations (Create, Read, Update, Delete)
2. Verify security (users can't see other companies' data)
3. Add error handling improvements
4. Add logging for monitoring
5. Add request validation
