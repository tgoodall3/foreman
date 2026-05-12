-- Worker hourly billing rate
alter table profiles add column if not exists hourly_rate numeric(10,2);

-- Link time entries to jobs (optional — workers may clock in without a job selected)
alter table time_entries add column if not exists job_id uuid references jobs(id) on delete set null;
create index if not exists time_entries_job_id_idx on time_entries(tenant_id, job_id) where job_id is not null;

-- Manual cost line items per job
create table job_costs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  job_id      uuid not null references jobs(id) on delete cascade,
  type        text not null check (type in ('material','subcontractor','equipment','other')),
  description text not null,
  amount      numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index on job_costs(tenant_id, job_id);

alter table job_costs enable row level security;

create policy "Owners manage job costs"
  on job_costs for all
  using (tenant_id = get_user_tenant_id() and get_user_role() = 'owner');
