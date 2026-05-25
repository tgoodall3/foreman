-- Allow invoices to be created for direct clients (not just property managers)
-- property_manager_id stays nullable; new client_name / client_email hold ad-hoc recipient info

alter table invoices
  alter column property_manager_id drop not null;

alter table invoices
  add column if not exists client_name  text,
  add column if not exists client_email text;
