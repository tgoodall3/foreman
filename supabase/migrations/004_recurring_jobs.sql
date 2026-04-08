-- ── Recurring Jobs ────────────────────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor

alter table jobs
  add column if not exists recurrence      text default 'none'
    check (recurrence in ('none','daily','weekly','biweekly','monthly')),
  add column if not exists parent_job_id   uuid references jobs(id) on delete set null;

create index if not exists jobs_parent_job_id on jobs(parent_job_id);
