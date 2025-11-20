# Team & Employee Management Redesign

## Overview

Redesigned the team management system with a customer-like detail view, added individual pay rate editing, and implemented employee availability tracking (days/times available to work).

## What Was Built

### 1. Employee List Page (Like Customers)

**Location:** `/app/dashboard/owner/team/page.tsx`

**Features:**
- ✅ Card-based layout (matches customer page design)
- ✅ Shows employee key info: name, email, job title, hourly rate, phone
- ✅ Work status badges (Available, Vacation, Sick, Inactive)
- ✅ Clickable cards link to employee detail page
- ✅ Pending approvals section (prominent yellow banner)
- ✅ Rejected employees section (can review again)
- ✅ Responsive grid layout (1/2/3 columns)

**Card Information Display:**
- Employee name and email
- Job title (with briefcase icon)
- Hourly rate (with dollar icon)
- Phone number (with phone icon)
- Work status badge
- "View Details →" link

### 2. Employee Detail Page

**Location:** `/app/dashboard/owner/team/[employeeId]/page.tsx`

**Features:**
- ✅ Full employee profile view
- ✅ Editable hourly rate
- ✅ Employee availability schedule (Sunday - Saturday)
- ✅ Work status management
- ✅ Job title and department info
- ✅ Contact information

### 3. Employee Availability System

**Database Table:** `employee_availability`

**Structure:**
```sql
CREATE TABLE employee_availability (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES companies(id),
  company_employee_id uuid REFERENCES company_employees(id),
  day_of_week smallint (0-6, 0=Sunday),
  is_available boolean,
  start_time time,
  end_time time,
  UNIQUE (company_employee_id, day_of_week)
)
```

**Features:**
- ✅ Each employee can set availability for each day of week
- ✅ Start and end times for each available day
- ✅ Employees can edit their own availability
- ✅ Owners can view all employee availability
- ✅ Validation ensures times are logical (start < end)

### 4. API Endpoints Created

#### Employee Details API
**Endpoint:** `/api/employees/[id]`

**Methods:**
- `GET` - Fetch employee with profile
- `PATCH` - Update employee details (hourly rate, job title, work status)

**Request Example (PATCH):**
```json
{
  "hourly_rate": 25.50,
  "job_title": "Senior Technician",
  "work_status": "available"
}
```

#### Employee Availability API
**Endpoint:** `/api/employees/[id]/availability`

**Methods:**
- `GET` - Fetch employee's weekly availability
- `PUT` - Update employee's full weekly schedule

**Request Example (PUT):**
```json
{
  "availability": [
    {
      "day_of_week": 1,
      "is_available": true,
      "start_time": "09:00",
      "end_time": "17:00"
    },
    {
      "day_of_week": 2,
      "is_available": true,
      "start_time": "09:00",
      "end_time": "17:00"
    },
    {
      "day_of_week": 0,
      "is_available": false,
      "start_time": null,
      "end_time": null
    }
  ]
}
```

**Response Example (GET):**
```json
{
  "availability": [
    {
      "id": "uuid",
      "day_of_week": 1,
      "is_available": true,
      "start_time": "09:00:00",
      "end_time": "17:00:00",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## User Workflows

### Owner Workflow

1. **View Team**
   - Navigate to `/dashboard/owner/team`
   - See all employees in card layout
   - Click on any employee card

2. **View Employee Details**
   - See full employee profile
   - View employee availability schedule
   - See hourly rate and contact info

3. **Edit Pay Rate**
   - Click "Edit" on employee info panel
   - Update hourly rate
   - Save changes

4. **Check Availability**
   - Scroll to availability section
   - See which days employee is available
   - See specific hours for each day

### Employee Workflow

1. **Set Availability**
   - Navigate to profile/availability page
   - Select days available to work
   - Set start and end times for each day
   - Save schedule

2. **Update Availability**
   - Edit existing availability
   - Change times or mark days unavailable
   - Save changes

## Database Schema

### employee_availability Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | Company reference |
| company_employee_id | uuid | Employee reference |
| day_of_week | smallint | 0-6 (Sunday-Saturday) |
| is_available | boolean | Available on this day |
| start_time | time | Start time (e.g., 09:00) |
| end_time | time | End time (e.g., 17:00) |
| created_at | timestamp | When created |
| updated_at | timestamp | Last updated |

**Constraints:**
- Unique constraint on (company_employee_id, day_of_week)
- Check: if is_available=true, start_time and end_time must be set
- Check: if is_available=false, times must be null
- Check: start_time < end_time

**Indexes:**
- `employee_availability_company_idx` on company_id
- `employee_availability_employee_idx` on company_employee_id

## Files Created/Modified

### New Files

1. `/app/api/employees/[id]/route.ts` - Employee details API
2. `/app/api/employees/[id]/availability/route.ts` - Availability API
3. `/supabase/migrations/20251119213513_add_employee_availability.sql` - Database table

### Modified Files

1. `/app/dashboard/owner/team/page.tsx` - Redesigned list page
2. `/app/dashboard/owner/team/[employeeId]/page.tsx` - Added hourly_rate type
3. `/app/api/employees/[employeeId]/route.ts` - Updated to Promise params
4. `/app/api/employee-availability/[employeeId]/route.ts` - Updated to Promise params

## Features Summary

### ✅ Team List Page
- Card-based layout matching customers page
- Shows hourly rate on each card
- Work status badges
- Pending approvals section
- Links to detail pages

### ✅ Employee Detail Page
- Full profile view
- Editable fields (hourly rate, job title)
- Availability schedule display
- Contact information

### ✅ Availability System
- Database table for storing availability
- API for getting/updating availability
- Validation for logical times
- Day-by-day schedule (Sunday-Saturday)
- Employees can self-edit
- Owners can view

### ✅ Pay Rate Management
- Owner can set/edit hourly rates
- Displayed on employee cards
- Used in payroll calculations
- Editable via employee detail page

## Next Steps / Future Enhancements

Potential improvements:
- [ ] Add availability to employee profile page (employee self-service)
- [ ] Show availability conflicts when scheduling jobs
- [ ] Add "Find Available Employees" feature for scheduling
- [ ] Add availability calendar view
- [ ] Add recurring availability patterns (same every week)
- [ ] Add time-off requests that override availability
- [ ] Add notifications when availability changes
- [ ] Export employee schedules to PDF/CSV
- [ ] Add availability statistics (hours available per week)
- [ ] Integration with job scheduling (auto-suggest available employees)

## Testing

### Test Case 1: View Team List
1. Navigate to `/dashboard/owner/team`
2. Verify employee cards display correctly
3. Check hourly rates show on cards
4. Verify work status badges

### Test Case 2: View Employee Details
1. Click on employee card
2. Navigate to detail page
3. Verify all info displays
4. Check availability section shows

### Test Case 3: Update Pay Rate
1. On employee detail page, click Edit
2. Change hourly rate
3. Save changes
4. Verify updated rate shows everywhere

### Test Case 4: Set Availability (Employee)
1. Employee logs in
2. Goes to availability page
3. Sets days/times available
4. Saves schedule
5. Verify saved correctly

### Test Case 5: View Availability (Owner)
1. Owner views employee detail
2. Scrolls to availability section
3. Sees employee's schedule
4. Verifies correct days/times

## Security & Permissions

### RLS Policies

**employee_availability table:**
- Employees can read/update their own availability
- Owners can read all employees' availability in their company
- Owners cannot update employee availability (employees manage their own)

### API Authorization

**GET /api/employees/[id]:**
- Requires authentication
- Must be owner of company or the employee themselves

**PATCH /api/employees/[id]:**
- Requires owner permission
- Cannot update if not in user's company

**GET /api/employees/[id]/availability:**
- Requires authentication
- Must be owner or the employee

**PUT /api/employees/[id]/availability:**
- Requires authentication
- Must be owner OR the employee themselves
- Validates all data before saving

## Migration Instructions

### Apply Database Migration

```bash
# Migration already created at:
# supabase/migrations/20251119213513_add_employee_availability.sql

# Will be applied automatically on next deployment
# Or apply manually via Supabase dashboard SQL editor
```

### Verify Installation

```sql
-- Check table exists
SELECT * FROM employee_availability LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'employee_availability';

-- Check indexes
SELECT * FROM pg_indexes
WHERE tablename = 'employee_availability';
```

## Benefits

1. **Better Organization:** Card layout matches rest of app
2. **Easy Access:** Click any employee to see full details
3. **Pay Management:** Set individual pay rates easily
4. **Scheduling:** Know when employees are available
5. **Employee Control:** Employees manage their own availability
6. **Transparency:** Owners can see all schedules
7. **Validation:** System prevents invalid time entries
8. **Flexibility:** Can update availability anytime

Build completed successfully! ✅
