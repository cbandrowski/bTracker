# Customer Billing Tab UI - Implementation Summary

## Overview
Implemented a comprehensive Billing tab for individual customers that allows owners to:
- View billing header metrics (Billed Balance, Unapplied Credit, Open Invoices)
- Select unpaid done jobs and create invoices
- Attach deposits to invoices as negative "Deposit Applied" lines
- Manage invoices and payments in one centralized location

## What Was Implemented

### 1. Custom Hooks (`/hooks/useCustomerBilling.ts`)

**`useCustomerBillingHeader(customerId)`**
- Fetches billing summary from `GET /api/customers/:id/billing-header`
- Returns: billedBalance, unappliedCredit, openInvoices
- Includes `refresh()` method for manual updates

**`useUnpaidJobs(customerId)`**
- Fetches unpaid done jobs from `GET /api/customers/:id/unpaid-done-jobs`
- Returns array of jobs with title, description, completed_at, estimated_amount
- Includes `refresh()` method

**`useUnappliedPayments(customerId, depositType?)`**
- Fetches unapplied payments from `GET /api/customers/:id/unapplied-payments`
- Supports optional depositType filter
- Returns items array and total unappliedCredit
- Includes `refresh()` method

**`useCreateInvoice()`**
- Hook for creating invoices via `POST /api/invoices`
- Supports idempotency keys
- Returns `createInvoice` function, loading state, and error

### 2. Toast Notifications

**Components:**
- `/components/ui/toast.tsx` - Toast UI primitives (Radix UI)
- `/hooks/useToast.tsx` - Toast state management
- `/components/ui/toaster.tsx` - Toast container
- Added `<Toaster />` to app layout

**Usage:**
```typescript
const { toast } = useToast()

toast({
  variant: 'success',
  title: 'Invoice Created',
  description: `Invoice ${invoiceNumber} created successfully`,
})
```

### 3. Unpaid Jobs Table (`/components/billing/UnpaidJobsTable.tsx`)

**Features:**
- Checkbox selection for multiple jobs
- "Select all" functionality
- Displays: Job title/description, Completed date, Estimated amount
- "Create Invoice" button (disabled when no selection)
- Keyboard accessible checkboxes
- Loading skeletons
- Empty state

**Interaction Flow:**
1. User selects one or more jobs via checkboxes
2. Clicks "Create Invoice (n)" button
3. Opens Invoice Builder Drawer with selected jobs

### 4. Deposits List (`/components/billing/DepositsList.tsx`)

**Features:**
- Checkbox toggles for selecting deposits
- Displays: Amount, deposit type (badge), date, related job, memo
- Info banner explaining deposit application
- Shows total selected amount
- Visual highlight for selected deposits
- Loading skeletons
- Empty state

**Info Banner:**
> "Selected deposits will be added as negative 'Deposit Applied' lines on the invoice"

### 5. Invoice Builder Drawer (`/components/billing/InvoiceBuilderDrawer.tsx`)

**Sections:**

**Selected Jobs**
- Lists all pre-selected jobs with estimated amounts
- Shows jobs total

**Additional Lines**
- Add/remove custom line items
- Fields: Description, Quantity, Unit Price, Tax Rate
- Grid layout with delete buttons

**Available Deposits**
- Checkbox list of unapplied deposits
- Scrollable if many deposits
- Shows deposit type and amount

**Terms & Issue**
- Payment Terms dropdown: Due on Receipt, Net 15, Net 30, Net 60
- Due Date picker
- "Issue invoice immediately" checkbox

**Totals Summary**
- Subtotal (jobs + lines)
- Tax (from line items)
- Total
- Deposit Applied (negative, in blue)
- Balance Due (bold)

**Validation:**
- Error if deposits exceed total
- Warning if no content (jobs or lines)
- Blocks submit if invalid
- Requires due date if issueNow=true (except "Due on Receipt")

**Submit Flow:**
1. Validates all fields
2. Generates idempotency key: `invoice-${customerId}-${Date.now()}`
3. Calls `POST /api/invoices` with:
   - jobIds[]
   - lines[] (description, quantity, unitPrice, taxRate)
   - depositIds[]
   - terms
   - issueNow
   - dueDate (if applicable)
4. On success: shows toast, refreshes data, closes drawer
5. On error: displays error message in drawer

### 6. Invoices List (`/components/billing/InvoicesList.tsx`)

**Features:**
- Table with columns: Number, Status, Due Date, Total, Paid/Applied, Balance, Actions
- Status badges with colors:
  - Paid: default (blue)
  - Partial: outline
  - Issued/Draft: secondary (gray)
  - Void/Cancelled: destructive (red)
- Actions: View (eye icon), Download PDF (file icon)
- Loading skeletons
- Empty state

### 7. Main Billing Page (`/app/dashboard/owner/customers/[id]/billing/page.tsx`)

**Layout:**

**Header**
- Back button to customers list
- Customer name
- "Add Payment/Deposit" button (outline)
- "Create Invoice" button (primary)

**Billing Header Cards (3-up grid)**
1. **Billed Balance**
   - Large badge (red if positive, gray if zero)
   - Subtitle: "Total invoiced minus payments"

2. **Unapplied Credit**
   - Large badge (blue if > 0, gray if zero)
   - Subtitle: "Available to apply to invoices"

3. **Open Invoices**
   - Count number
   - Subtitle: "Unpaid or partially paid"

**Unpaid Done Jobs Card**
- Title: "Unpaid Done Jobs"
- UnpaidJobsTable component

**Deposits Available Card** (conditional)
- Only shown if unapplied deposits exist
- Title: "Deposits Available"
- DepositsList component

**Invoices List Card**
- Title: "Invoices"
- InvoicesList component

**Drawers:**
- InvoiceBuilderDrawer
- AddPaymentDrawer (reused from Customers tab)

**State Management:**
- Fetches customer name on mount
- Fetches billing header, unpaid jobs, deposits, invoices
- Manages selected job IDs and deposit IDs
- `refreshAllData()` method to reload everything after mutations

**Interaction Flows:**

**Create Invoice from Jobs:**
1. User selects jobs in UnpaidJobsTable
2. Clicks "Create Invoice"
3. Drawer opens with selected jobs
4. User optionally adds lines, selects deposits, sets terms
5. Clicks "Create Invoice"
6. Success toast: "Invoice #INV-10027 created successfully. Balance: $500.00"
7. All data refreshes (header, jobs list, deposits, invoices)

**Create Blank Invoice:**
1. User clicks header "Create Invoice" button
2. Drawer opens with no jobs selected
3. User adds manual lines, selects deposits, sets terms
4. Clicks "Create Invoice"
5. Same success flow

**Add Payment/Deposit:**
1. User clicks "Add Payment/Deposit"
2. AddPaymentDrawer opens
3. User fills form and submits
4. Success toast: "Payment/deposit has been recorded successfully"
5. All data refreshes

### 8. API Route (`/app/api/customers/[id]/invoices/route.ts`)

**GET /api/customers/:id/invoices**
- Fetches all invoices for customer
- Returns: id, invoice_number, status, due_date, total, paid_amount, created_at
- Ordered by created_at desc
- Verifies customer belongs to user's company

### 9. UI Components Added

**Checkbox** (`/components/ui/checkbox.tsx`)
- Radix UI checkbox with Tailwind styling
- Blue checked state
- Keyboard accessible
- Installed: `@radix-ui/react-checkbox`

**Toast** (`/components/ui/toast.tsx`)
- Radix UI toast primitives
- Variants: default, destructive, success
- Auto-dismiss after 5 seconds
- Swipe to dismiss
- Installed: `@radix-ui/react-toast`

## File Structure

```
/Users/cbandrowski/btracker/
├── app/
│   ├── api/customers/[id]/
│   │   └── invoices/route.ts                 # NEW: Get customer invoices
│   ├── dashboard/owner/customers/[id]/
│   │   └── billing/page.tsx                   # NEW: Main billing page
│   └── layout.tsx                             # UPDATED: Added Toaster
├── components/
│   ├── billing/
│   │   ├── UnpaidJobsTable.tsx                # NEW
│   │   ├── DepositsList.tsx                   # NEW
│   │   ├── InvoiceBuilderDrawer.tsx           # NEW
│   │   └── InvoicesList.tsx                   # NEW
│   └── ui/
│       ├── checkbox.tsx                       # NEW
│       ├── toast.tsx                          # NEW
│       └── toaster.tsx                        # NEW
└── hooks/
    ├── useCustomerBilling.ts                  # NEW
    └── useToast.tsx                           # NEW
```

## Dependencies Added

```bash
npm install @radix-ui/react-checkbox @radix-ui/react-toast
```

## Acceptance Criteria Met

✅ I can select jobs, attach deposits, and create an invoice in one step
✅ The new invoice shows negative "Deposit Applied" lines and correct balance
✅ Header metrics update immediately after the action
✅ Validation prevents deposits from exceeding total
✅ Cannot create invoice with no content (jobs or lines)
✅ Issue now requires due date or defaults to terms
✅ Table checkboxes are keyboard accessible
✅ Drawer has proper focus management
✅ Toast notifications for success/error states (ARIA live region)
✅ Loading skeletons during data fetch
✅ Empty states for all lists
✅ Batch select functionality for jobs

## Additional Features Implemented

Beyond the requirements:
- **Idempotency**: Uses idempotency keys for invoice creation
- **Real-time totals**: Drawer calculates and displays subtotal, tax, total, deposit applied, balance
- **Visual feedback**: Selected deposits highlighted in blue
- **Responsive layout**: Grid layout adapts to screen size
- **Error handling**: Comprehensive error messages and validation
- **Additional lines**: Support for adding custom line items beyond jobs
- **Tax calculation**: Per-line tax rate support
- **Back navigation**: Easy return to customers list
- **Refresh pattern**: All data refreshes after mutations

## User Flows

### Flow 1: Create Invoice from Unpaid Jobs with Deposit

1. Navigate to customer billing page
2. See 3 header cards showing current balances
3. Scroll to "Unpaid Done Jobs" section
4. Select 2 jobs using checkboxes
5. Click "Create Invoice (2)"
6. Drawer opens showing:
   - Selected jobs with amounts
   - Available deposits section
7. Select a $500 deposit
8. Set terms to "Net 30"
9. Pick due date
10. Check "Issue invoice immediately"
11. Review totals:
    - Subtotal: $1,000
    - Tax: $0
    - Total: $1,000
    - Deposit Applied: -$500
    - Balance Due: $500
12. Click "Create Invoice"
13. See toast: "Invoice #INV-10027 created successfully. Balance: $500.00"
14. Drawer closes
15. See invoice appear in "Invoices" list with status "issued"
16. Jobs removed from "Unpaid Done Jobs" list
17. Deposit removed from "Deposits Available" list
18. Header cards update:
    - Billed Balance increases by $500
    - Unapplied Credit decreases by $500
    - Open Invoices increases by 1

### Flow 2: Add Payment/Deposit

1. Click "Add Payment/Deposit" button
2. AddPaymentDrawer opens
3. Enter amount: $1,000
4. Select payment method: Check
5. Select deposit type: Parts
6. Enter memo: "Down payment for job #123"
7. Click "Create Payment"
8. See toast: "Payment/deposit has been recorded successfully"
9. Drawer closes
10. Header cards update:
    - Unapplied Credit increases by $1,000
11. New deposit appears in "Deposits Available" list

### Flow 3: Error - Deposits Exceed Total

1. Select 1 job worth $200
2. Click "Create Invoice"
3. Select deposit worth $500
4. See red error banner: "Selected deposits ($500.00) exceed invoice total ($200.00)"
5. "Create Invoice" button disabled
6. User either:
   - Deselects deposit, OR
   - Adds more jobs/lines to increase total
7. Error clears when deposits ≤ total
8. Button becomes enabled

## Testing Recommendations

### Manual Testing

**Happy Path:**
1. Create customer
2. Create job and mark as done
3. Navigate to customer billing page
4. Verify job appears in unpaid jobs
5. Create deposit via "Add Payment/Deposit"
6. Verify deposit appears in available deposits
7. Select job, attach deposit, create invoice
8. Verify invoice created, metrics updated, toast shown

**Edge Cases:**
- Try to create invoice with no jobs or lines
- Try to attach deposits exceeding total
- Create invoice without issuing (issueNow=false)
- Create invoice with multiple jobs and multiple deposits
- Add custom line items with tax
- Test keyboard navigation in tables
- Test with no unpaid jobs
- Test with no deposits

### Automated Testing (Future)

```typescript
describe('Billing Tab', () => {
  it('should create invoice from selected jobs', async () => {
    // Setup: customer with 2 unpaid jobs
    // Action: select jobs, open drawer, submit
    // Assert: invoice created, jobs removed from list
  })

  it('should prevent deposits from exceeding total', () => {
    // Setup: job worth $200, deposit worth $500
    // Action: select both
    // Assert: error banner shown, submit disabled
  })

  it('should refresh all data after invoice creation', () => {
    // Setup: customer with unpaid job and deposit
    // Action: create invoice
    // Assert: header metrics updated, lists refreshed
  })
})
```

## API Endpoints Used

### GET Endpoints
- `GET /api/customers/:id/billing-header` - Billing summary
- `GET /api/customers/:id/unpaid-done-jobs` - Jobs ready to invoice
- `GET /api/customers/:id/unapplied-payments` - Available deposits
- `GET /api/customers/:id/invoices` - Customer invoices list
- `GET /api/customers/:id` - Customer details (name)

### POST Endpoints
- `POST /api/invoices` - Create invoice with jobs, lines, deposits
- `POST /api/payments` - Create payment/deposit
- `POST /api/invoices/:id/issue` - Issue draft invoice (optional)

## Database Views Used

- **`v_customer_billed_balance`**: Calculates billed balance and unapplied credit
- **`v_invoice_summary`**: Invoice totals including deposit applications

## Security

- All API calls authenticated via Supabase session
- Company ownership verified for all resources
- RLS policies enforced on database
- Idempotency keys prevent duplicate invoice creation
- Input validation on client and server

## Performance Considerations

- Batch data fetching via custom hooks
- Parallel API calls where possible
- Loading skeletons for better perceived performance
- Optimistic UI updates (close drawer before full refresh)
- Conditional rendering (deposits section only if deposits exist)

## Accessibility

- Keyboard navigation for all checkboxes and buttons
- ARIA labels for all interactive elements
- ARIA live regions for toast notifications
- Focus management in drawer
- Semantic HTML (table, form elements)
- Color contrast for all text and badges

## Known Limitations

1. **PDF Download**: Not yet implemented (placeholder button)
2. **Invoice Editing**: Cannot edit draft invoices from this page
3. **Deposit Filtering**: No UI for filtering deposits by type in deposits list
4. **Job Details**: Limited job information shown (no customer name, address)
5. **Pagination**: No pagination for large invoice lists
6. **Sorting**: Invoices list not sortable by column

## Future Enhancements

1. Add deposit type filter tabs in deposits list
2. Implement PDF generation and download
3. Add invoice editing capability
4. Add pagination/infinite scroll for invoices
5. Add sorting to invoices table
6. Add search/filter for invoices
7. Add bulk actions (select multiple invoices, mark as paid)
8. Add invoice preview before creation
9. Add email invoice functionality
10. Add payment history timeline view

## Documentation References

- Billing API: `BILLING_API_IMPLEMENTATION.md`
- Quick Start: `BILLING_QUICK_START.md`
- Deposit Schema: `deposit_billing_schema.sql`
- API Migration: `API_MIGRATION_SUMMARY.md`

Happy billing! 🎉
