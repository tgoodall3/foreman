-- Audit log: immutable record of key business events per tenant.
-- Rows are never updated or deleted — append-only.

create table if not exists audit_log (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references tenants(id) on delete cascade not null,
  actor_id    uuid,                   -- profiles.id of the user who triggered it (null = system/cron)
  actor_name  text,
  entity_type text not null,          -- 'job', 'work_order', 'estimate', 'invoice', 'worker', 'pm'
  entity_id   uuid not null,
  entity_label text,                  -- human-readable name at time of event
  action      text not null,          -- 'status_changed', 'assigned', 'created', 'sent', 'paid', etc.
  metadata    jsonb default '{}',     -- e.g. { from: 'scheduled', to: 'completed' }
  created_at  timestamptz default now()
);

alter table audit_log enable row level security;

create policy "Tenant isolation" on audit_log
  for select using (tenant_id = get_user_tenant_id());

-- Owners can insert via service role only (no direct client inserts)
create index on audit_log(tenant_id, created_at desc);
create index on audit_log(tenant_id, entity_type, entity_id);
