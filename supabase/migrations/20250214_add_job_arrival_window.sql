alter table public.jobs
  add column arrival_window_start_time time,
  add column arrival_window_end_time time;

alter table public.jobs
  add constraint jobs_arrival_window_time_check
  check (
    (arrival_window_start_time is null and arrival_window_end_time is null)
    or (
      arrival_window_start_time is not null
      and arrival_window_end_time is not null
      and arrival_window_start_time < arrival_window_end_time
    )
  );

comment on column public.jobs.arrival_window_start_time is 'Preferred arrival window start time';
comment on column public.jobs.arrival_window_end_time is 'Preferred arrival window end time';
