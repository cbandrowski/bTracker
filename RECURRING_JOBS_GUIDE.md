# Recurring Jobs Feature

## Overview
The recurring jobs feature allows you to create multiple job instances that repeat weekly. Each job is created as a separate, independent record that can be tracked, assigned, and invoiced individually.

## How It Works

### Creating Recurring Jobs

1. **From Customer Actions Menu**:
   - Go to Customers page or Billing > Customers
   - Click the actions menu (⋮) for any customer
   - Select "Create Recurring Jobs"

2. **Configure the Job**:
   - **Job Title**: Enter a base title (e.g., "Weekly Lawn Maintenance")
     - Each instance will automatically append the date to the title
     - Example: "Weekly Lawn Maintenance (Jan 15, 2025)"

   - **Summary/Description**: Optional details about what needs to be done

   - **Estimated Amount**: Optional dollar amount for each job instance

   - **Priority**: Choose from Low, Medium, High, or Urgent

3. **Set Recurrence Pattern**:

   **Option 1: Weekly Until End of Month**
   - Creates jobs every week from the start date until the last day of that month
   - Example: Start date Jan 1 → creates jobs on Jan 1, 8, 15, 22, 29

   **Option 2: Weekly Until Specific Date**
   - Creates jobs every week until a date you specify
   - Example: Start date Jan 1, End date Feb 15 → creates 7 weekly jobs

4. **Preview**: The form shows how many jobs will be created before you submit

5. **Create**: Click the button to generate all job instances at once

### What Gets Created

Each recurring job instance is a complete, independent job with:
- Unique job ID
- Customer linkage
- Status (starts as "unassigned")
- Scheduled date (incremented weekly)
- All details from the template (title with date, summary, estimated amount, priority)

### Using Recurring Jobs

**Track Progress**:
- Each job appears in the Jobs board
- Can be assigned to workers independently
- Status can be updated (unassigned → assigned → in progress → done)

**Invoice Jobs**:
- When jobs are marked as "done", they appear in the Unbilled Jobs list
- Select multiple recurring job instances to include on one invoice
- Or create separate invoices for each occurrence
- Each job's estimated amount becomes the invoice line item

**Example Use Cases**:

1. **Weekly Maintenance Contract**:
   - Create "Weekly Lawn Service" recurring jobs for the entire month
   - As each week's job is completed, mark it done
   - At end of month, create one invoice with all 4 weeks

2. **Bi-weekly Services** (workaround):
   - Create weekly recurring jobs
   - Delete every other instance after creation
   - Or just use the "weekly until date" option with proper start dates

3. **Season Planning**:
   - Create "Snow Removal Service" for every week until March 31
   - Each occurrence can be independently marked done after completion
   - Track which weeks were serviced vs. skipped

## API Details

**Endpoint**: `POST /api/jobs/recurring`

**Request Body**:
```json
{
  "customerId": "uuid",
  "title": "Base job title",
  "summary": "Optional description",
  "estimated_amount": 150.00,
  "priority": "medium",
  "recurringType": "weekly_month_end" | "weekly_until_date",
  "startDate": "2025-01-15",
  "untilDate": "2025-02-15"  // Required if recurringType is "weekly_until_date"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Created 5 recurring job instances",
  "jobs": [
    {
      "id": "job-uuid-1",
      "title": "Weekly Lawn Maintenance (Jan 15, 2025)",
      "scheduled_date": "2025-01-15",
      "status": "unassigned"
    },
    // ... more jobs
  ],
  "count": 5
}
```

## Technical Implementation

### No Database Changes Required
- Uses existing `jobs` table structure
- No new columns or relationships needed
- Each recurring instance is just a regular job

### Components
- **CreateRecurringJobDrawer**: UI component for creating recurring jobs
  - Location: `/components/jobs/CreateRecurringJobDrawer.tsx`
  - Features: Form with validation, date calculations, preview

### Integration Points
- Added to CustomersTable actions menu
- Available in both Customers and Billing > Customers pages
- Jobs created appear immediately in Jobs board
- Completed jobs flow into invoice creation as normal

### Date Calculations
- Start date is the first occurrence
- Each subsequent job is +7 days
- End of month: Uses JavaScript Date to find last day of start month
- Until date: Continues creating jobs while date <= specified end date

## Future Enhancements (Not Implemented)

Potential features that could be added:
- Bi-weekly frequency option
- Monthly recurrence
- Custom days of week (e.g., every Monday and Thursday)
- Ability to bulk-edit all instances in a series
- Visual indication that jobs are part of a series
- Option to delete all future instances in a series
