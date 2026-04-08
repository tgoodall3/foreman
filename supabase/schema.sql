-- ═══════════════════════════════════════════════════════════════
-- FOREMAN — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Tenants (GC Businesses) ──────────────────────────────────────
create table tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  email text not null,
  phone text,
  address text,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'trial' check (plan in ('trial', 'pro')),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

-- ── Profiles (Users) ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('owner', 'worker', 'property_manager')),
  plan text not null default 'trial' check (plan in ('trial', 'pro')),
  phone text,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── Property Managers ─────────────────────────────────────────────
create table property_managers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  full_name text not null,
  email text not null,
  phone text,
  company text,
  portal_token text unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now()
);

-- ── Properties ────────────────────────────────────────────────────
create table properties (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  property_manager_id uuid references property_managers(id) on delete cascade not null,
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  notes text,
  created_at timestamptz default now()
);

-- ── Work Orders ───────────────────────────────────────────────────
create table work_orders (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  property_id uuid references properties(id) on delete cascade not null,
  property_manager_id uuid references property_managers(id) on delete cascade not null,
  title text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent', 'emergency')),
  photos jsonb default '[]',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  job_id uuid,
  created_at timestamptz default now()
);

-- ── Jobs ──────────────────────────────────────────────────────────
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  work_order_id uuid references work_orders(id) on delete set null,
  property_id uuid references properties(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'pending' check (status in ('pending','scheduled','in_progress','completed','invoiced','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','urgent','emergency')),
  scheduled_date date,
  scheduled_time time,
  estimated_hours numeric(5,2),
  actual_hours numeric(5,2),
  assigned_workers uuid[] default '{}',
  line_items jsonb default '[]',
  invoice_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Job Photos ────────────────────────────────────────────────────
create table job_photos (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  url text not null,
  caption text,
  uploaded_by uuid references profiles(id) on delete set null,
  type text not null default 'general' check (type in ('before','during','after','general')),
  created_at timestamptz default now()
);

-- ── Job Notes ─────────────────────────────────────────────────────
create table job_notes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  text text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ── Invoices ──────────────────────────────────────────────────────
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  job_id uuid references jobs(id) on delete cascade not null,
  property_manager_id uuid references property_managers(id) on delete cascade not null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue')),
  line_items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  due_date date not null,
  paid_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table property_managers enable row level security;
alter table properties enable row level security;
alter table work_orders enable row level security;
alter table jobs enable row level security;
alter table job_photos enable row level security;
alter table job_notes enable row level security;
alter table invoices enable row level security;

-- Helper function: get current user's tenant_id
create or replace function get_user_tenant_id()
returns uuid language sql security definer as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- Helper function: get current user's role
create or replace function get_user_role()
returns text language sql security definer as $$
  select role from profiles where id = auth.uid()
$$;

-- Tenants: users can only see their own tenant
create policy "Users see own tenant" on tenants
  for select using (id = get_user_tenant_id());

-- Profiles: users see profiles in their tenant
create policy "Users see tenant profiles" on profiles
  for select using (tenant_id = get_user_tenant_id());

create policy "Owners manage profiles" on profiles
  for all using (tenant_id = get_user_tenant_id() and get_user_role() = 'owner');

-- All other tables: tenant isolation
create policy "Tenant isolation" on property_managers
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on properties
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on work_orders
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on jobs
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on job_photos
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on job_notes
  for all using (tenant_id = get_user_tenant_id());

create policy "Tenant isolation" on invoices
  for all using (tenant_id = get_user_tenant_id());

-- ── Storage Bucket ────────────────────────────────────────────────
-- Run this in Supabase Dashboard → Storage → New Bucket
-- Name: "job-photos", Public: false

-- ── Triggers ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────
create index on jobs(tenant_id, status);
create index on jobs(tenant_id, scheduled_date);
create index on work_orders(tenant_id, status);
create index on job_photos(job_id);
create index on job_notes(job_id);
create index on invoices(tenant_id, status);
