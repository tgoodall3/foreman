create table work_order_comments (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade not null,
  work_order_id   uuid references work_orders(id) on delete cascade not null,
  created_by_pm   uuid references property_managers(id) on delete cascade not null,
  message         text not null,
  created_at      timestamptz default now()
);

alter table work_order_comments enable row level security;

-- Tenant isolation
create policy "Tenant isolation on work_order_comments" on work_order_comments
  for all using (tenant_id = get_user_tenant_id());

-- Portal PMs can read their tenant comments
create policy "PMs can select work_order_comments" on work_order_comments
  for select using (tenant_id = get_user_tenant_id());

-- Portal PMs can insert comments for their tenant
create policy "PMs can insert work_order_comments" on work_order_comments
  for insert with check (tenant_id = get_user_tenant_id());

-- Portal PMs can update their own tenant comments (optional; keep for edits)
create policy "PMs can update work_order_comments" on work_order_comments
  for update using (tenant_id = get_user_tenant_id()) with check (tenant_id = get_user_tenant_id());

create index if not exists idx_work_order_comments_wo on work_order_comments(work_order_id);
create index if not exists idx_work_order_comments_created on work_order_comments(created_at);
