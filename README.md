# BizJobBoard&Tracker

A modern workforce, scheduling, billing, and operations platform built with **Next.js**, **Supabase**, and a modular API-first architecture. BTracker is designed for small businesses that need clean tools for employee management, time tracking, job scheduling, invoicing, and customer management — without the clutter found in traditional enterprise systems.

---

## 🚀 Overview

BizJobBoard&Tracker is a unified platform for owners, employees, and accountants. It centralizes scheduling, time approvals, job assignments, customer data, invoice handling, and payments under one clean ecosystem.

The goal: **Provide a reliable, scalable, and human‑friendly business tracking system** ready for real production use and professional engineering review.

---

## ✨ Core Features

### **Employee Management**

* Employee profiles, availability, and work preferences
* Owner‑view access to availability under each employee's details
* Interactive scheduling for weekly or custom hours
* Clock‑in/clock‑out with approval flow

### **Scheduling & Operations**

* Job creation and assignment
* Calendar‑based scheduling UI
* Job date auto‑linked to assignment to avoid duplicate date inputs
* Owner approval of submitted time entries

### **Billing & Invoicing**

* Invoice creation, line items, and customer‑linked balances
* Deposits and payment tracking (general, parts, or supply deposits)
* Automatic PDF generation for invoices
* Email sending options (owner, accountant, customer, or single‑use email input)

### **Payments System**

* Saved payments (unapplied)
* Apply deposits to invoices using negative "Deposit Applied" lines
* Customer balance tracking across invoices

### **Customer Management**

* Editable customer profiles
* Customer stats page with lifetime value, overdue invoices, payments history
* Linked jobs, invoices, and activity logs

---

## 🏗️ Tech Stack

### **Frontend**

* Next.js 14 (App Router)
* React Server Components
* TailwindCSS UI system
* ShadCN components

### **Backend / Database**

* Supabase (PostgreSQL + row‑level security)
* Edge functions for sensitive operations
* API routes with Zod validation and strong typing
* Transactions for billing, payments, and scheduling logic

### **Infrastructure**

* Vercel (Primary hosting)
* Supabase storage (e.g., company logos bucket)
* Optional domain for email providers (Resend, Postmark, etc.)

---

## 🗂️ Project Structure

```
root/
 ├─ app/                 # Next.js routes
 │   └─ dashboard/       # Owner & employee dashboards
 ├─ components/          # Shared UI components
 ├─ lib/                 # Utils, Supabase client, helpers
 ├─ types/               # Domain types & validators
 ├─ supabase/
 │   └─ migrations/      # db.sql + incremental schema updates
 ├─ docs/                # Developer docs
 └─ agent.md             # Codegen & dev-agent instructions
```

---

## 📦 Key Implementations

### **API Architecture**

* Modular route handlers grouped by domain
* Every route uses:

  * Zod schemas
  * Typed responses
  * Transaction safety for multi‑step operations
  * Idempotency for payment endpoints

### **PDF & Email System**

* Invoice PDFs named using `invoiceNumber_customerName.pdf`
* Emails sent through programmable providers with domain authentication

### **Authentication (Web + Apple)**

* Password, OAuth, and Apple Sign‑In
* macOS app integration with Apple Account Services

---

## 🧪 Development

### Local Commands

```
pm install
npm run dev
```

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EMAIL_PROVIDER_KEY=
DOMAIN_URL=
```

---

## 📈 Scaling & Data Strategy

* Millions of records supported via Postgres indexing
* Archived tables for aging historical rows
* Background jobs for invoice email processing or heavy summaries
* Avoids data loss by using:

  * Soft deletes
  * Versioned migrations
  * Strict foreign keys / cascade rules

---

## 🔒 Security

* Row-Level Security for all profile, job, and billing tables
* Server-side authorization checks
* Input validation on every API endpoint
* Secure storage for invoices, logos, and document uploads

---

## 🎯 Roadmap

* Payroll & tax calculation module
* Mobile-native apps (iOS first)
* Advanced analytics dashboards
* Real-time updates via Supabase Realtime

---

## 👤 About the Developer

This project demonstrates modern full‑stack engineering, scalable architecture design, strong database modeling, and production‑grade UI systems — suitable for professional engineering roles, startup environments, and SaaS platform development.

---

## 📝 License

Proprietary — all rights reserved.

---

For more information or collaboration requests, feel free to reach out.
