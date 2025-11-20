# PAYROLL SYSTEM DOCUMENTATION

This document describes the complete payroll system implementation for Btracker.

## OVERVIEW

The payroll system allows owners to:
- Create payroll runs for specific pay periods (weekly, monthly, custom)
- Automatically calculate regular and overtime hours from approved time entries
- Compute gross pay using employee hourly rates
- Track historical payroll runs and generate reports
- Finalize payroll runs to prevent modifications

## DATABASE SCHEMA

### New Tables

#### `payroll_runs`
Represents a payroll processing run for a specific pay period.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| company_id | uuid | FK to companies |
| period_start | date | Start of pay period |
| period_end | date | End of pay period |
| status | text | 'draft' or 'finalized' |
| total_gross_pay | numeric(10,2) | Total gross pay for this run |
| created_by | uuid | FK to profiles (owner who created) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Constraints:**
- Unique constraint on (company_id, period_start, period_end) to prevent overlapping periods

#### `payroll_run_lines`
Individual employee payroll details within a payroll run.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| payroll_run_id | uuid | FK to payroll_runs |
| employee_id | uuid | FK to company_employees |
| total_regular_hours | numeric(10,2) | Regular hours worked |
| total_overtime_hours | numeric(10,2) | Overtime hours worked |
| hourly_rate_snapshot | numeric(10,2) | Employee's hourly rate (snapshot) |
| overtime_rate_multiplier | numeric(3,2) | OT multiplier (default 1.5) |
| regular_pay | numeric(10,2) | Pay for regular hours |
| overtime_pay | numeric(10,2) | Pay for overtime hours |
| total_gross_pay | numeric(10,2) | Total gross pay |
| tax_withheld | numeric(10,2) | Tax withheld (nullable) |
| other_deductions | numeric(10,2) | Other deductions (nullable) |
| net_pay | numeric(10,2) | Net pay after deductions (nullable) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Constraints:**
- Unique constraint on (payroll_run_id, employee_id) - one line per employee per run

### Extended Tables

#### `time_entries` (new columns)
- `payroll_run_id` (uuid, nullable) - Links to payroll_runs
- `regular_hours` (numeric, nullable) - Regular hours for this entry
- `overtime_hours` (numeric, nullable) - Overtime hours for this entry
- `gross_pay` (numeric, nullable) - Gross pay for this entry

#### `company_employees` (new columns)
- `hourly_rate` (numeric, default 15.00) - Employee's hourly pay rate

## PAYROLL CALCULATION RULES

### Configurable Constants
Located in `/types/payroll.ts`:

```typescript
export const PAYROLL_RULES = {
  REGULAR_HOURS_THRESHOLD: 40,      // Weekly hours before OT
  OVERTIME_MULTIPLIER: 1.5,         // Time-and-a-half for OT
  DEFAULT_HOURLY_RATE: 15.00,       // Default if not set
}
```

### How Hours Are Calculated

1. **Find Eligible Time Entries**
   - Status = 'approved'
   - clock_in_approved_at within pay period
   - payroll_run_id IS NULL (not already processed)
   - clock_out_approved_at IS NOT NULL

2. **Calculate Total Hours Per Employee**
   - Sum all hours from approved time entries
   - Hours = (clock_out_approved_at - clock_in_approved_at)

3. **Split Regular vs Overtime**
   - Simple rule: First 40 hours = regular, rest = overtime
   - This can be modified in `splitRegularAndOvertime()` function

4. **Calculate Pay**
   - Regular Pay = regular_hours × hourly_rate
   - Overtime Pay = overtime_hours × hourly_rate × 1.5
   - Total Gross Pay = Regular Pay + Overtime Pay

### Customization Points

You can easily modify these rules by editing:
- `/types/payroll.ts` - Constants and calculation functions
- `/lib/payroll.ts` - Core payroll generation logic

## API ENDPOINTS

### POST /api/payroll/runs
Create a new payroll run.

**Request Body:**
```json
{
  "period_start": "2024-01-01",
  "period_end": "2024-01-07"
}
```

**Response:**
```json
{
  "payroll_run": { /* PayrollRun object */ },
  "lines": [ /* Array of PayrollRunLine objects */ ],
  "time_entries_count": 42,
  "message": "Payroll run created successfully"
}
```

**Errors:**
- 409: Overlapping payroll run already exists
- 422: Validation error (invalid dates, end before start)
- 500: No eligible time entries found

### GET /api/payroll/runs
List all payroll runs for the owner's company.

**Query Parameters:**
- `status` (optional): 'draft' or 'finalized'
- `from_date` (optional): Filter by period_start >= date
- `to_date` (optional): Filter by period_end <= date

**Response:**
```json
{
  "payroll_runs": [
    {
      "id": "uuid",
      "period_start": "2024-01-01",
      "period_end": "2024-01-07",
      "status": "finalized",
      "total_gross_pay": 1250.50,
      "lines": [{ "count": 3 }]
    }
  ]
}
```

### GET /api/payroll/runs/[id]
Get a single payroll run with full details.

**Response:**
```json
{
  "payroll_run": { /* PayrollRun object */ },
  "lines": [
    {
      "id": "uuid",
      "employee": {
        "first_name": "John",
        "last_name": "Doe"
      },
      "total_regular_hours": 40.0,
      "total_overtime_hours": 5.0,
      "hourly_rate_snapshot": 15.00,
      "total_gross_pay": 712.50
    }
  ],
  "time_entries": [ /* Array of time entries */ ]
}
```

### POST /api/payroll/runs/[id]/finalize
Finalize a draft payroll run.

**Response:**
```json
{
  "message": "Payroll run finalized successfully",
  "payroll_run_id": "uuid"
}
```

**Notes:**
- Once finalized, the run cannot be modified or deleted
- Time entries in finalized runs cannot be reassigned

### DELETE /api/payroll/runs/[id]
Delete a draft payroll run.

**Notes:**
- Only draft runs can be deleted
- Time entries are unlinked (payroll_run_id set to NULL)
- Payroll lines are cascade deleted

## USER INTERFACE

### Pages

1. **Payroll List** (`/dashboard/owner/payroll`)
   - Lists all payroll runs
   - Filters by status (all, draft, finalized)
   - Shows period, status, employee count, total gross pay
   - Click row to view details

2. **New Payroll Run** (`/dashboard/owner/payroll/new`)
   - Quick select buttons: Last Week, This Week, Last Month, This Month
   - Manual date range selection
   - Shows what will happen when created
   - Creates run and redirects to details

3. **Payroll Run Details** (`/dashboard/owner/payroll/[id]`)
   - Summary stats: Total employees, hours, gross pay
   - Employee breakdown table with hours and pay
   - Expandable time entries per employee
   - Actions: Finalize (if draft), Delete (if draft)

## SECURITY (RLS POLICIES)

### Payroll Runs
- **SELECT**: Owners can view runs for their company
- **INSERT**: Owners can create runs for their company
- **UPDATE**: Owners can update draft runs only
- **DELETE**: Owners can delete draft runs only

### Payroll Run Lines
- **SELECT**:
  - Owners can view lines for their company's runs
  - Employees can view their own lines
- **INSERT/UPDATE/DELETE**: Owners only, and only for draft runs

### Time Entries (Extended)
- Existing policies remain unchanged
- Time entries linked to finalized runs are protected from modification

## MIGRATION INSTRUCTIONS

### 1. Run Database Migrations

```bash
# In order:
psql $DATABASE_URL -f supabase/migrations/add_employee_hourly_rate.sql
psql $DATABASE_URL -f supabase/migrations/create_payroll_tables.sql
psql $DATABASE_URL -f supabase/migrations/payroll_rls_policies.sql
```

Or using Supabase CLI:
```bash
npx supabase db push
```

### 2. Update Employee Hourly Rates

After running migrations, set hourly rates for your employees:

```sql
UPDATE company_employees
SET hourly_rate = 20.00
WHERE id = 'employee-uuid';
```

### 3. Test the System

1. Approve some time entries
2. Create a test payroll run
3. Verify calculations are correct
4. Finalize the run
5. Check that time entries are locked

## FUTURE ENHANCEMENTS

These features are designed to be easily added:

### Tax Calculation
- Modify `/lib/payroll.ts` to compute tax_withheld
- Update payroll_run_lines with tax amounts
- Display in UI

### Pay Stubs
- Create PDF generation endpoint
- Include all line details
- Email to employees

### Direct Deposit Integration
- Add bank account fields to company_employees
- Integrate with payment processor
- Track payment status

### Multi-State Tax Support
- Add state field to company_employees
- Implement state-specific tax rules
- Generate state tax reports

### Reporting
- Weekly/monthly/yearly payroll reports
- Export to CSV/Excel
- Tax form generation (W-2, 1099)

## TROUBLESHOOTING

### "No eligible time entries found"
- Ensure time entries are approved
- Check that clock_in_approved_at is within the pay period
- Verify entries aren't already assigned to another payroll run

### "A payroll run already exists for this period"
- Check for overlapping date ranges
- Delete or modify the existing run if it's still a draft

### Incorrect hour calculations
- Verify clock_in_approved_at and clock_out_approved_at are set
- Check PAYROLL_RULES constants in `/types/payroll.ts`
- Review `splitRegularAndOvertime()` logic

### RLS policy errors
- Ensure user is an owner (not employee)
- Check that company_id matches
- Verify payroll_run status is 'draft' for modifications

## SUPPORT

For questions or issues:
1. Check this documentation
2. Review code comments in `/lib/payroll.ts` and `/types/payroll.ts`
3. Check server logs for detailed error messages
4. Verify database constraints and indexes are in place
