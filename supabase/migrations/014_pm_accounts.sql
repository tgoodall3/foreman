alter table property_managers
  add column if not exists profile_id uuid references profiles(id) on delete set null,
  add column if not exists setup_token text unique,
  add column if not exists setup_token_expires_at timestamptz,
  add column if not exists is_active boolean not null default true;

create unique index if not exists property_managers_profile_id_unique
  on property_managers(profile_id)
  where profile_id is not null;

create index if not exists property_managers_setup_token_expires_idx
  on property_managers(setup_token_expires_at);
