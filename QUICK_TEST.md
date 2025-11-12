# Quick Test Guide

## Test Your API Routes Are Working

### 1. Start the dev server
```bash
npm run dev
```

### 2. Open the application
```
http://localhost:3000
```

### 3. Login to your account

### 4. Test Each Page

#### Customers Page
1. Go to: `http://localhost:3000/dashboard/owner/customers`
2. **Expected:** You should see your customers list
3. **If empty:** Check browser DevTools → Console for errors

#### Jobs Page
1. Go to: `http://localhost:3000/dashboard/owner/jobs`
2. **Expected:** You should see jobs in columns (Upcoming, In Progress, Done)
3. **If empty:** Check browser DevTools → Console for errors

#### Assignments Page
1. Go to: `http://localhost:3000/dashboard/owner/assignments`
2. **Expected:** You should see assignments board with 4 columns
3. **If empty:** Check browser DevTools → Console for errors

### 5. Check Network Tab

1. Open DevTools → Network tab
2. Refresh the page
3. Look for API requests:
   - `/api/customers` - Should return 200 with JSON data
   - `/api/jobs` - Should return 200 with JSON data
   - `/api/assignments` - Should return 200 with JSON data
   - `/api/companies` - Should return 200 with JSON data

### 6. Test Creating a Customer

1. Go to Customers page
2. Click "+ Add Customer"
3. Fill in the form
4. Click "Create Customer"
5. **Expected:** Customer appears in the list
6. **Check Network:** POST to `/api/customers` returns 201

### 7. Test Creating a Job

1. Go to Customers page
2. Click "Create Job" on any customer
3. Fill in job details
4. Click "Create Job"
5. **Expected:** Redirected to Jobs page with new job
6. **Check Network:** POST to `/api/jobs` returns 201

### 8. Test Creating an Assignment

1. Go to Assignments page
2. Find an unassigned job
3. Click "+ Assign"
4. Select employee and dates
5. Click "Assign"
6. **Expected:** Job moves to Assigned column
7. **Check Network:** POST to `/api/assignments` returns 201

## Troubleshooting

### If you see "Loading..." forever

**Check Console for errors:**
```
Unauthorized
```
→ Authentication issue, see API_FIX_SUMMARY.md

```
Error fetching customers: <error message>
```
→ API route error, check terminal logs

### If you see empty lists but no errors

1. **Check database:**
   - Open Supabase dashboard
   - Go to Table Editor
   - Verify you have data in:
     - `company_owners` (your user is an owner)
     - `customers` (some customers exist)
     - `jobs` (some jobs exist)

2. **Check company ownership:**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM company_owners WHERE profile_id = '<your-user-id>';
   ```

3. **Check API response:**
   - DevTools → Network → `/api/customers`
   - Click on the request
   - Check Response tab
   - Should show array of customers

### If API returns 401 Unauthorized

**Authentication not working:**
1. Check you're logged in (see user in top nav)
2. Check cookies exist (DevTools → Application → Cookies)
3. Restart dev server: `Ctrl+C` then `npm run dev`
4. Clear cookies and login again

### If API returns empty array []

**No data or no companies:**
1. **Check you own a company:**
   - Open Supabase
   - Go to `company_owners` table
   - Verify your `profile_id` exists

2. **Create test data:**
   - Go to Companies in Supabase
   - Manually insert a company
   - Link it to your user in `company_owners`

## Expected Console Output

### Success (No Errors)
```
# Should see NO errors in console
# Network tab shows:
GET /api/companies   200 OK
GET /api/customers   200 OK
GET /api/jobs        200 OK
GET /api/assignments 200 OK
```

### If You See Errors
```javascript
Error fetching customers: Unauthorized
→ Authentication issue

Error fetching customers: Internal server error
→ Check terminal for API route errors

Failed to create customer: <error>
→ Check form validation or API logs
```

## Quick Database Check

If pages are empty, check your database:

```sql
-- Check if you're a company owner
SELECT * FROM company_owners
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'your-email@example.com');

-- Check if you have customers
SELECT c.* FROM customers c
JOIN company_owners co ON c.company_id = co.company_id
WHERE co.profile_id = (SELECT id FROM profiles WHERE email = 'your-email@example.com');

-- Check if you have jobs
SELECT j.* FROM jobs j
JOIN company_owners co ON j.company_id = co.company_id
WHERE co.profile_id = (SELECT id FROM profiles WHERE email = 'your-email@example.com');
```

## All Working? ✅

If all pages show data and CRUD operations work, you're good to go!

Next steps:
- Test all features thoroughly
- Add more customers, jobs, assignments
- Test edge cases (empty states, errors, etc.)
- Enjoy your API-powered application! 🎉
