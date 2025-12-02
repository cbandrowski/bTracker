-- Payroll settings per company (pay period and auto-generation)
create table if not exists public.payroll_settings (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    period_start_day integer not null default 1, -- 0=Sun ... 6=Sat
    period_end_day integer not null default 0,
    auto_generate boolean not null default false,
    last_generated_end_date date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint payroll_settings_day_range check (period_start_day between 0 and 6 and period_end_day between 0 and 6)
);

create unique index if not exists payroll_settings_company_idx on public.payroll_settings(company_id);

create trigger update_payroll_settings_updated_at
before update on public.payroll_settings
for each row
execute function public.update_updated_at_column();
