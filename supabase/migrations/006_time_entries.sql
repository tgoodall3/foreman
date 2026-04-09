-- ── Time Entries (worker clock-in / clock-out) ───────────────────

create table time_entries (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid references tenants(id) on delete cascade not null,
  worker_id      uuid references profiles(id) on delete cascade not null,
  clocked_in_at  timestamptz not null default now(),
  clocked_out_at timestamptz,
  notes          text,
  created_at     timestamptz default now()
);

alter table time_entries enable row level security;

create policy "Tenant isolation on time_entries" on time_entries
  for all using (tenant_id = get_user_tenant_id());

create index on time_entries(tenant_id, worker_id);
create index on time_entries(tenant_id, clocked_in_at);
