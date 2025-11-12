# Billing API - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Run Database Migrations

Open Supabase SQL Editor and run these in order:

```sql
-- 1. First, run the deposit & billing schema (if not already done)
-- Copy contents of deposit_billing_schema.sql and execute

-- 2. Then run the supporting tables migration
-- Copy contents of migrations/002_add_billing_support_tables.sql and execute
```

**Verify tables exist:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'payments',
  'invoices',
  'invoice_lines',
  'payment_applications',
  'request_idempotency',
  'company_invoice_counters'
);
```

Should return 6 rows.

### Step 2: Test Basic Endpoints

#### Get Billing Header (should work immediately)

```bash
# Replace with your customer UUID
curl http://localhost:3000/api/customers/YOUR-CUSTOMER-UUID/billing-header
```

**Expected:**
```json
{
  "billedBalance": 0,
  "unappliedCredit": 0,
  "openInvoices": 0
}
```

### Step 3: Create Your First Deposit

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "YOUR-CUSTOMER-UUID",
    "amount": 500,
    "method": "check",
    "depositType": "parts",
    "memo": "Test deposit"
  }'
```

**Expected:**
```json
{
  "paymentId": "new-uuid",
  "unappliedCredit": 500
}
```

### Step 4: Verify Deposit Shows Up

```bash
curl http://localhost:3000/api/customers/YOUR-CUSTOMER-UUID/unapplied-payments
```

**Expected:**
```json
{
  "items": [
    {
      "paymentId": "...",
      "date": "2025-11-11",
      "amount": 500,
      "depositType": "parts",
      "unappliedAmount": 500
    }
  ],
  "unappliedCredit": 500
}
```

### Step 5: Create Invoice with Deposit

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "YOUR-CUSTOMER-UUID",
    "lines": [
      {
        "description": "Test service",
        "quantity": 1,
        "unitPrice": 1000,
        "taxRate": 0
      }
    ],
    "depositIds": ["YOUR-PAYMENT-UUID"],
    "terms": "Net 30",
    "issueNow": true
  }'
```

**Expected:**
```json
{
  "invoiceId": "...",
  "invoiceNumber": "INV-10001",
  "summary": {
    "subtotal": 1000,
    "tax": 0,
    "total": 1000,
    "depositApplied": 500,
    "balance": 500
  }
}
```

### Step 6: Check Updated Billing Header

```bash
curl http://localhost:3000/api/customers/YOUR-CUSTOMER-UUID/billing-header
```

**Expected:**
```json
{
  "billedBalance": 500,
  "unappliedCredit": 0,
  "openInvoices": 1
}
```

## ✅ You're Done!

You've successfully:
- ✅ Created a deposit
- ✅ Applied it to an invoice
- ✅ Verified the billing balance

## 🎯 Next Steps

### Add to Frontend

```typescript
// Example React component
const CreateDeposit = () => {
  const handleSubmit = async (data) => {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        depositType: data.depositType,
        memo: data.memo,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      alert(`Deposit created: ${result.paymentId}`)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  )
}
```

### Common Operations

#### List All Payments
```bash
GET /api/payments?customerId=xxx
```

#### Edit Unapplied Deposit
```bash
PATCH /api/payments/:id
{ "amount": 600, "memo": "Updated" }
```

#### Get Unpaid Jobs
```bash
GET /api/customers/:id/unpaid-done-jobs
```

#### Issue Draft Invoice
```bash
POST /api/invoices/:id/issue
{ "dueDate": "2025-12-31" }
```

## 🐛 Troubleshooting

### "Unauthorized" on all requests
→ Check authentication cookies are being sent

### "Customer not found"
→ Verify customer belongs to your company
→ Check `company_owners` table

### "Payment has no unapplied balance"
→ Deposit already fully applied
→ Check `payment_applications` table

### Invoice numbers not sequential
→ Check `company_invoice_counters` table
→ Run: `SELECT * FROM company_invoice_counters WHERE company_id='...'`

## 📚 Full Documentation

See `BILLING_API_IMPLEMENTATION.md` for complete details on:
- All endpoints
- Request/response formats
- Business rules
- Security
- Error handling

Happy billing! 🎉
