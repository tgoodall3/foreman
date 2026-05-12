create table change_orders (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete cascade,
  property_manager_id uuid references property_managers(id) on delete set null,
  change_order_number text not null,
  title               text not null,
  description         text,
  line_items          jsonb not null default '[]',
  subtotal            numeric(10,2) not null default 0,
  tax_rate            numeric(5,2)  not null default 0,
  tax_amount          numeric(10,2) not null default 0,
  total               numeric(10,2) not null default 0,
  status              text not null default 'draft'
                        check (status in ('draft','sent','approved','declined')),
  approval_token      text unique,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on change_orders(tenant_id, job_id);
create index on change_orders(approval_token) where approval_token is not null;

alter table change_orders enable row level security;

create policy "Owners manage change orders"
  on change_orders for all
  using (tenant_id = get_user_tenant_id() and get_user_role() = 'owner');

create policy "Workers view change orders"
  on change_orders for select
  using (tenant_id = get_user_tenant_id() and get_user_role() = 'worker');

create policy "PMs view their change orders"
  on change_orders for select
  using (property_manager_id = get_pm_id());
