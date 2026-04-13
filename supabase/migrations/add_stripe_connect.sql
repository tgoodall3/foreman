-- Add Stripe Connect fields to tenants
alter table tenants
  add column if not exists stripe_connect_id text,
  add column if not exists stripe_connect_enabled boolean not null default false;
