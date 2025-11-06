# Owner Self-Assignment

This document explains how owners can assign themselves to jobs.

## Overview

With the `make_owners_employees.sql` migration, owners are automatically added to the `company_employees` table. This means:

- Every owner is also an employee
- Owners can be assigned to jobs just like regular employees
- The `job_assignments.employee_id` always points to `company_employees.id`

## Database Changes

### Automatic Employee Record Creation

When someone becomes an owner:
1. A trigger automatically creates a `company_employees` record
2. Default values for owners:
   - `job_title`: "Owner"
   - `employment_status`: 'active'
   - `approval_status`: 'approved' (auto-approved, no waiting)
   - `work_status`: 'available'
   - `is_manager`: true

### Helper Function

Use `get_my_employee_id(company_id)` to find your employee ID:

```sql
-- Example: Get my employee_id for a specific company
SELECT get_my_employee_id('your-company-uuid-here');
```

## Self-Assignment Flow (Frontend)

Here's how to implement owner self-assignment in your app:

### 1. Get Current User's Employee ID

```typescript
// In your React component or API route
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

async function getMyEmployeeId(companyId: string): Promise<string | null> {
  const supabase = createClientComponentClient()

  // Method 1: Use the helper function
  const { data, error } = await supabase.rpc('get_my_employee_id', {
    p_company_id: companyId
  })

  if (error) {
    console.error('Error getting employee ID:', error)
    return null
  }

  return data // Returns UUID or null
}
```

Alternatively, query directly:

```typescript
// Method 2: Query company_employees directly
async function getMyEmployeeId(companyId: string): Promise<string | null> {
  const supabase = createClientComponentClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('company_employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('employment_status', 'active')
    .eq('approval_status', 'approved')
    .single()

  if (error) {
    console.error('Error getting employee ID:', error)
    return null
  }

  return data?.id || null
}
```

### 2. Assign Yourself to a Job

```typescript
async function assignMyselfToJob(
  companyId: string,
  jobId: string,
  serviceStartAt?: Date,
  serviceEndAt?: Date
) {
  const supabase = createClientComponentClient()

  // Step 1: Get your employee_id
  const employeeId = await getMyEmployeeId(companyId)

  if (!employeeId) {
    throw new Error('You are not an employee of this company')
  }

  // Step 2: Create the job assignment
  const { data, error } = await supabase
    .from('job_assignments')
    .insert({
      company_id: companyId,
      job_id: jobId,
      employee_id: employeeId,
      service_start_at: serviceStartAt?.toISOString(),
      service_end_at: serviceEndAt?.toISOString(),
      assignment_status: 'assigned'
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating assignment:', error)
    throw error
  }

  return data
}
```

### 3. Example UI Component

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SelfAssignButtonProps {
  companyId: string
  jobId: string
  onAssigned?: () => void
}

export function SelfAssignButton({
  companyId,
  jobId,
  onAssigned
}: SelfAssignButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleSelfAssign = async () => {
    setLoading(true)
    try {
      await assignMyselfToJob(companyId, jobId)
      onAssigned?.()
    } catch (error) {
      console.error('Failed to self-assign:', error)
      alert('Failed to assign yourself to this job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSelfAssign}
      disabled={loading}
    >
      {loading ? 'Assigning...' : 'Assign to Me'}
    </Button>
  )
}
```

## Server-Side Example (API Route)

```typescript
// app/api/jobs/[jobId]/assign-me/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })
  const { companyId, serviceStartAt, serviceEndAt } = await request.json()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get employee_id using helper function
  const { data: employeeId, error: empError } = await supabase.rpc(
    'get_my_employee_id',
    { p_company_id: companyId }
  )

  if (empError || !employeeId) {
    return NextResponse.json(
      { error: 'Not an employee of this company' },
      { status: 403 }
    )
  }

  // Create assignment
  const { data, error } = await supabase
    .from('job_assignments')
    .insert({
      company_id: companyId,
      job_id: params.jobId,
      employee_id: employeeId,
      service_start_at: serviceStartAt,
      service_end_at: serviceEndAt,
      assignment_status: 'assigned'
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

## Key Points

1. **Owners are auto-approved**: No waiting for approval status
2. **Always use employee_id**: Job assignments reference `company_employees.id`, not `profiles.id`
3. **Check employment status**: Only assign to employees with `employment_status='active'` and `approval_status='approved'`
4. **Company context**: Always specify which company when looking up employee records (a user can be an employee/owner of multiple companies)

## Testing

To verify this works:

1. Create a company (or use existing)
2. Verify owner has employee record:
   ```sql
   SELECT * FROM company_employees
   WHERE profile_id = 'owner-profile-id'
   AND company_id = 'company-id';
   ```
3. Create a job
4. Self-assign using the flow above
5. Verify assignment:
   ```sql
   SELECT ja.*, ce.job_title, p.full_name
   FROM job_assignments ja
   JOIN company_employees ce ON ja.employee_id = ce.id
   JOIN profiles p ON ce.profile_id = p.id
   WHERE ja.job_id = 'your-job-id';
   ```
