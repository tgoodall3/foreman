-- Restrict job-photos bucket: only owners/workers of the tenant may read;
-- public anonymous read is removed.

-- Drop any existing permissive policy first
drop policy if exists "Public read job-photos" on storage.objects;
drop policy if exists "Anyone can view job photos" on storage.objects;

-- Owners and workers of the tenant can read photos in their tenant's folder
create policy "Tenant members read job-photos"
  on storage.objects for select
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- Owners and workers can upload to their tenant's folder
create policy "Tenant members upload job-photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = get_user_tenant_id()::text
  );

-- Owners can delete their tenant's photos
create policy "Owners delete job-photos"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = get_user_tenant_id()::text
    and get_user_role() = 'owner'
  );
