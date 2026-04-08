-- ── Estimates ─────────────────────────────────────────────────────────────────
-- Run in: Supabase Dashboard → SQL Editor

create table if not exists estimates (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid references tenants(id) on delete cascade not null,
  property_manager_id uuid references property_managers(id) on delete cascade not null,
  property_id         uuid references properties(id) on delete set null,
  job_id              uuid references jobs(id) on delete set null,   -- set after convert
  estimate_number     text not null,
  status              text not null default 'draft'
                        check (status in ('draft','sent','approved','declined','converted')),
  title               text not null,
  description         text,
  line_items          jsonb not null default '[]',
  subtotal            numeric(10,2) not null default 0,
  tax_rate            numeric(5,2)  not null default 0,
  tax_amount          numeric(10,2) not null default 0,
  total               numeric(10,2) not null default 0,
  valid_until         date,
  notes               text,
  approval_token      text unique default encode(gen_random_bytes(24), 'hex'),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table estimates enable row level security;

create policy "Tenant isolation" on estimates
  for all using (tenant_id = get_user_tenant_id());

create index on estimates(tenant_id, status);
create index on estimates(tenant_id, created_at desc);

create trigger estimates_updated_at
  before update on estimates
  for each row execute function update_updated_at();
