-- Job photos table
CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  url          TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('before', 'during', 'after', 'general')),
  caption      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_photos_job_id_idx ON job_photos(job_id);
CREATE INDEX IF NOT EXISTS job_photos_tenant_id_idx ON job_photos(tenant_id);

-- RLS
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view job photos"
  ON job_photos FOR SELECT
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Workers and owners can insert job photos"
  ON job_photos FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can delete job photos"
  ON job_photos FOR DELETE
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'owner'
  );

-- Storage bucket policies (run after creating the bucket in Supabase dashboard)
-- Bucket name: job-photos (public bucket)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('job-photos', 'job-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload job photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-photos');

CREATE POLICY "Public can view job photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'job-photos');

CREATE POLICY "Owners can delete job photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'job-photos');
