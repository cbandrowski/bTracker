Btracker – Master Agent Rules (agent.md)

These rules govern all code generation for this repository.
Follow them strictly for every new feature, fix, migration, component, hook, API route, or service.

⸻

1. Database & Migrations

1.1 Schema Source of Truth
	•	The only authoritative schema file is:

supabase/migrations/db.sql


	•	All table names, fields, relationships, RLS, triggers, and enums must match exactly what is defined in db.sql.

1.2 Modifying the Schema
	•	Never change or rewrite db.sql.
	•	Instead, create new delta migrations:

supabase/migrations/<timestamp>_<change_name>.sql


	•	Migration files must:
	•	Contain only the changes (ALTER TABLE, CREATE TABLE, etc.)
	•	Follow consistent naming (20250201_add_timesheets.sql)

1.3 Type Updates
	•	After schema changes, update or regenerate:

types/database.ts


	•	All queries and responses must use database types (never any).

⸻

2. Architecture Overview

This project must remain modular, role-separated, and API-first.

Use this folder layout:

app/
  dashboard/
    owner/*
    employee/*
  api/<resource>/

components/<Feature>/*
contexts/
hooks/
lib/
  services/<domain>.ts
  supabaseClient.ts
  utils.ts

supabase/
  migrations/
    db.sql      ← master schema
    *.sql       ← new changes only

types/
docs/
public/


⸻

3. Role Separation: Owner vs Employee (MANDATORY)

3.1 Never mix the roles

Every feature must be split into two separate UIs:

app/dashboard/owner/<feature>/page.tsx
app/dashboard/employee/<feature>/page.tsx

Shared UI code goes to:

components/<Feature>/*

Shared logic goes to:

hooks/useSomething.ts
lib/services/<domain>.ts

3.2 Enforce Role Checks
	•	UI separation is not enough.
	•	All role validation must also happen in:
	•	API routes
	•	service functions
	•	Supabase RLS policies

⸻

4. API-First Development (Critical)

4.1 Never place business logic inside UI components

UI must only:
	•	render data
	•	call hooks
	•	call API routes

4.2 All real operations must go through API routes

Use the App Router API format:

app/api/<resource>/route.ts
app/api/<resource>/<action>/route.ts

Each route must include:
	1.	Zod validation
	2.	Auth + role checks
	3.	Service-layer calls
	4.	Typed JSON responses
	5.	No inline SQL

4.3 Service Layer (Domain Logic)

Service functions must live in:

lib/services/<domain>.ts

Examples:

lib/services/schedule.ts
lib/services/billing.ts
lib/services/employees.ts

They must:
	•	Contain all business rules
	•	Query Supabase
	•	Return typed results
	•	Not contain UI code

⸻

5. Coding Standards & Conventions

5.1 TypeScript
	•	100% TypeScript.
	•	Never use any.
	•	Use DB-backed types for rows, enums, and results.

5.2 Naming Conventions

Components

PascalCase

components/Schedule/ScheduleTable.tsx
components/Invoices/InvoiceCard.tsx

Hooks

use<Feature><Action>.ts

useScheduleData.ts
useInvoiceCreator.ts
useEmployeeClockIn.ts

Services

<domain>.ts

billing.ts
schedule.ts
employees.ts
inviteEmployees.ts

API routes

RESTful structure:

app/api/invoices/create/route.ts
app/api/payments/apply/route.ts
app/api/schedule/update/route.ts

Utilities

camelCase

formatMoney.ts
calculateTotals.ts
sanitizePhone.ts

Database

Tables: snake_case
Columns: snake_case
Enums: lowercase_underscore

5.3 UI
	•	Tailwind CSS only.
	•	Two-space indentation.
	•	Small components.
	•	No business logic in them.

⸻

6. Anti-Patterns (NEVER DO THESE)

❌ 6.1 NEVER modify db.sql directly

This file is read-only.

❌ 6.2 NEVER write inline SQL in UI or API routes

Forbidden:

await supabase.from("jobs").insert(...)

Allowed:
	•	Service layer ONLY.

❌ 6.3 NEVER interact with Supabase directly in client components

Always go through:

API → Service → Supabase

❌ 6.4 NEVER put owner and employee code in one file

Always separate pages and logic.

❌ 6.5 NEVER perform billing or money math in the UI

All calculations must be done in:

lib/services/billing.ts

❌ 6.6 NEVER create bloated components

Split into:
	•	UI components
	•	Hooks
	•	Service functions
	•	API routes

❌ 6.7 NEVER add new top-level folders

Use existing structure unless given explicit permission.

⸻

7. Feature-Specific Rules

7.1 Scheduling & Time Tracking
	•	Employee:
	•	Clock-in/out via API only
	•	Cannot override timestamps client-side
	•	Owner:
	•	Approves or rejects employee clock events
	•	Views hours, schedules, and daily logs
	•	Timestamps:
	•	Recorded server-side
	•	Aggregation done in services, not UI

7.2 Billing, Payments, Invoices
	•	All invoice, line item, and payment logic must use:

lib/services/billing.ts


	•	UI cannot compute totals.
	•	API endpoints handle creating, updating, applying payments.
	•	Exporting PDF/emailing invoices must use backend logic.

⸻

8. How the Agent Must Respond to Any Task

When generating code or planning changes:

✔️ 1. Read schema only from db.sql

✔️ 2. If schema needs to change → create new migration

✔️ 3. Provide:
	•	File paths
	•	Modularity
	•	Role-separated pages
	•	API routes
	•	Service functions
	•	Type updates

✔️ 4. Follow naming conventions

✔️ 5. Follow anti-pattern rules

✔️ 6. Keep code minimal, clean, typed, and modular

⸻

9. Response Format (Required for the Agent)

When generating solutions, responses must include:
	1.	Updated or new file paths
	2.	Exact content of each file
	3.	Notes about migrations (if needed)
	4.	Where to place components/hooks/services
	5.	Any required commands (npm run dev, migrate, etc.)