create table if not exists public.company_business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  day_of_week smallint not null,
  is_open boolean not null default false,
  start_time time without time zone,
  end_time time without time zone,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_business_hours_day_of_week_check check (day_of_week >= 0 and day_of_week <= 6),
  constraint company_business_hours_time_valid check (
    (is_open = false and start_time is null and end_time is null)
    or (
      is_open = true
      and start_time is not null
      and end_time is not null
      and start_time < end_time
    )
  ),
  constraint company_business_hours_unique_day unique (company_id, day_of_week)
);

create index if not exists company_business_hours_company_idx
  on public.company_business_hours(company_id);

alter table public.company_business_hours enable row level security;

create policy "Owners can manage company business hours"
  on public.company_business_hours
  for all
  using (
    company_id in (
      select company_id
      from public.company_owners
      where profile_id = auth.uid()
    )
  )
  with check (
    company_id in (
      select company_id
      from public.company_owners
      where profile_id = auth.uid()
    )
  );

create policy "Employees can view company business hours"
  on public.company_business_hours
  for select
  using (
    company_id in (
      select company_id
      from public.company_employees
      where profile_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.company_business_hours to authenticated;
grant all on table public.company_business_hours to service_role;

create trigger update_company_business_hours_updated_at
  before update on public.company_business_hours
  for each row execute function public.update_updated_at_column();
