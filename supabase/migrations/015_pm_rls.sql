-- ─────────────────────────────────────────────────────────────────────────────
-- 015: PM-scoped RLS + retire portal_token auto-generation
--
-- Before this migration every authenticated PM could read (and in some cases
-- write) any row in the tenant because the existing "Tenant isolation" policies
-- only checked tenant_id, not role. PMs now have real auth accounts so those
-- broad policies apply to them too.
--
-- After this migration:
--   • owners/workers  → same access as before
--   • property managers → read-only access to their own records only
--   • portal_token column → default removed (no longer used for auth)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Retire portal_token auto-generation ───────────────────────────────────
-- The column stays so existing rows are not broken, but new PM records will no
-- longer receive a token. It can be dropped entirely in a future migration once
-- existing tokens are confirmed unused.
ALTER TABLE property_managers ALTER COLUMN portal_token DROP DEFAULT;


-- ── 2. Helper: resolve property_manager.id for the current auth user ─────────
CREATE OR REPLACE FUNCTION get_pm_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT id FROM property_managers WHERE profile_id = auth.uid() LIMIT 1
$$;


-- ── 3. property_managers ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON property_managers;

-- Owners can do everything with PM records in their tenant.
CREATE POLICY "Owners manage property managers"
  ON property_managers FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

-- Workers can read PM contact info (needed when viewing job/work-order detail).
CREATE POLICY "Workers view property managers"
  ON property_managers FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- A PM can read their own record only.
CREATE POLICY "PM views own record"
  ON property_managers FOR SELECT TO authenticated
  USING (profile_id = auth.uid());


-- ── 4. properties ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON properties;

CREATE POLICY "Owners manage properties"
  ON properties FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers view properties"
  ON properties FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- PM can read properties assigned to them.
CREATE POLICY "PM views own properties"
  ON properties FOR SELECT TO authenticated
  USING (property_manager_id = get_pm_id());

-- PM can add new properties linked to themselves.
CREATE POLICY "PM inserts own properties"
  ON properties FOR INSERT TO authenticated
  WITH CHECK (
    property_manager_id = get_pm_id()
    AND tenant_id = (SELECT tenant_id FROM property_managers WHERE profile_id = auth.uid() LIMIT 1)
  );


-- ── 5. work_orders ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON work_orders;

CREATE POLICY "Owners manage work orders"
  ON work_orders FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers view work orders"
  ON work_orders FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- PM can read their own work orders.
CREATE POLICY "PM views own work orders"
  ON work_orders FOR SELECT TO authenticated
  USING (property_manager_id = get_pm_id());

-- PM can submit new work orders for their own properties.
CREATE POLICY "PM inserts own work orders"
  ON work_orders FOR INSERT TO authenticated
  WITH CHECK (
    property_manager_id = get_pm_id()
    AND tenant_id = (SELECT tenant_id FROM property_managers WHERE profile_id = auth.uid() LIMIT 1)
  );


-- ── 6. jobs ──────────────────────────────────────────────────────────────────
-- PMs have no direct access to jobs (internal operational data).
DROP POLICY IF EXISTS "Tenant isolation" ON jobs;

CREATE POLICY "Owners manage jobs"
  ON jobs FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers manage jobs"
  ON jobs FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');


-- ── 7. job_photos ────────────────────────────────────────────────────────────
-- Replace the broad migration-013 policies with role-aware ones.
DROP POLICY IF EXISTS "Tenant members can view job photos"    ON job_photos;
DROP POLICY IF EXISTS "Workers and owners can insert job photos" ON job_photos;
DROP POLICY IF EXISTS "Owners can delete job photos"          ON job_photos;

CREATE POLICY "Staff view job photos"
  ON job_photos FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner', 'worker')
  );

CREATE POLICY "Staff insert job photos"
  ON job_photos FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('owner', 'worker')
  );

CREATE POLICY "Owners delete job photos"
  ON job_photos FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');


-- ── 8. job_notes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON job_notes;

CREATE POLICY "Owners manage job notes"
  ON job_notes FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers manage job notes"
  ON job_notes FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');


-- ── 9. invoices ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON invoices;

CREATE POLICY "Owners manage invoices"
  ON invoices FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers view invoices"
  ON invoices FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- PM can read their own invoices only.
CREATE POLICY "PM views own invoices"
  ON invoices FOR SELECT TO authenticated
  USING (property_manager_id = get_pm_id());


-- ── 10. estimates ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation" ON estimates;

CREATE POLICY "Owners manage estimates"
  ON estimates FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers view estimates"
  ON estimates FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- PM can read their own estimates only.
CREATE POLICY "PM views own estimates"
  ON estimates FOR SELECT TO authenticated
  USING (property_manager_id = get_pm_id());


-- ── 11. work_order_comments ──────────────────────────────────────────────────
-- The migration-008 policies are too broad — replace them all.
DROP POLICY IF EXISTS "Tenant isolation on work_order_comments" ON work_order_comments;
DROP POLICY IF EXISTS "PMs can select work_order_comments"      ON work_order_comments;
DROP POLICY IF EXISTS "PMs can insert work_order_comments"      ON work_order_comments;
DROP POLICY IF EXISTS "PMs can update work_order_comments"      ON work_order_comments;

CREATE POLICY "Owners manage work order comments"
  ON work_order_comments FOR ALL TO authenticated
  USING  (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
  WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner');

CREATE POLICY "Workers view work order comments"
  ON work_order_comments FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'worker');

-- PM can read comments on their own work orders only.
CREATE POLICY "PM views own work order comments"
  ON work_order_comments FOR SELECT TO authenticated
  USING (
    work_order_id IN (
      SELECT id FROM work_orders WHERE property_manager_id = get_pm_id()
    )
  );

-- PM can add comments to their own work orders only.
CREATE POLICY "PM inserts own work order comments"
  ON work_order_comments FOR INSERT TO authenticated
  WITH CHECK (
    created_by_pm = get_pm_id()
    AND tenant_id = (SELECT tenant_id FROM property_managers WHERE profile_id = auth.uid() LIMIT 1)
    AND work_order_id IN (
      SELECT id FROM work_orders WHERE property_manager_id = get_pm_id()
    )
  );
