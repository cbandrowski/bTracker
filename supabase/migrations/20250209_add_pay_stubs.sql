-- Pay stubs per payroll run and employee
create table if not exists public.pay_stubs (
    id uuid primary key default gen_random_uuid(),
    payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
    employee_id uuid not null references public.company_employees(id) on delete cascade,
    period_start date not null,
    period_end date not null,
    regular_hours numeric not null default 0,
    overtime_hours numeric not null default 0,
    total_hours numeric not null default 0,
    hourly_rate numeric not null default 0,
    gross_pay numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint pay_stubs_unique_run_employee unique (payroll_run_id, employee_id)
);

create table if not exists public.pay_stub_entries (
    id uuid primary key default gen_random_uuid(),
    pay_stub_id uuid not null references public.pay_stubs(id) on delete cascade,
    work_date date not null,
    regular_hours numeric not null default 0,
    overtime_hours numeric not null default 0,
    gross_pay numeric not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_pay_stub_entries_pay_stub_id on public.pay_stub_entries(pay_stub_id);
