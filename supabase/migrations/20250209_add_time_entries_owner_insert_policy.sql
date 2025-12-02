-- Allow owners to insert manual time entries for their company
create policy "owners_insert_time_entries"
on public.time_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.company_owners co
    where co.company_id = time_entries.company_id
      and co.profile_id = auth.uid()
  )
);
