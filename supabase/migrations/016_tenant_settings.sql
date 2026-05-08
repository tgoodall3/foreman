-- Add business settings fields to tenants
alter table tenants
  add column if not exists invoice_footer text,
  add column if not exists tax_id text,
  add column if not exists website text;
