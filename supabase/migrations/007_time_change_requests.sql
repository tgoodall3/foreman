-- Time change requests from workers to owners

-- Create table safely if it doesn't already exist
create table if not exists time_change_requests (
  id                       uuid primary key default uuid_generate_v4(),
  tenant_id                uuid references tenants(id) on delete cascade not null,
  worker_id                uuid references profiles(id) on delete cascade not null,
  time_entry_id            uuid references time_entries(id) on delete cascade,
  requested_date           date not null,
  requested_clocked_in_at  timestamptz,
  requested_clocked_out_at timestamptz,
  reason                   text not null,
  status                   text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at               timestamptz default now()
);

alter table time_change_requests enable row level security;

-- Select: anyone in the tenant (owner + workers)
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'Select time_change_requests by tenant') then
    create policy "Select time_change_requests by tenant" on time_change_requests
      for select using (tenant_id = get_user_tenant_id());
  end if;
end$$;

-- Workers can insert their own requests
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'Workers can insert change requests') then
    create policy "Workers can insert change requests" on time_change_requests
      for insert with check (
        tenant_id = get_user_tenant_id()
        and worker_id = auth.uid()
      );
  end if;
end$$;

-- Owners can update status (approve/decline)
do $$
begin
  if not exists (select 1 from pg_policy where polname = 'Owners can update change requests') then
    create policy "Owners can update change requests" on time_change_requests
      for update using (
        tenant_id = get_user_tenant_id()
        and get_user_role() = 'owner'
      ) with check (tenant_id = get_user_tenant_id());
  end if;
end$$;

-- Indexes with stable names; IF NOT EXISTS avoids failures on re-run
create index if not exists idx_time_change_requests_tenant_worker
  on time_change_requests(tenant_id, worker_id);

create index if not exists idx_time_change_requests_tenant_date
  on time_change_requests(tenant_id, requested_date);
