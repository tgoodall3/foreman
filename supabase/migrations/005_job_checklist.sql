-- ── Job Checklist Items ───────────────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor

create table if not exists job_checklist_items (
  id         uuid primary key default uuid_generate_v4(),
  job_id     uuid references jobs(id) on delete cascade not null,
  tenant_id  uuid references tenants(id) on delete cascade not null,
  text       text not null,
  position   int not null default 0,
  done       boolean not null default false,
  done_by    uuid references profiles(id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz default now()
);

alter table job_checklist_items enable row level security;

create policy "Tenant isolation" on job_checklist_items
  for all using (tenant_id = get_user_tenant_id());

create index on job_checklist_items(job_id);
