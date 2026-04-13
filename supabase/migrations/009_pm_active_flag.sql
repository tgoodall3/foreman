-- Add is_active flag to property_managers so owners can revoke portal access
-- without deleting the PM record and losing their work order history.

alter table property_managers
  add column if not exists is_active boolean not null default true;

create index if not exists property_managers_tenant_active
  on property_managers(tenant_id, is_active);
