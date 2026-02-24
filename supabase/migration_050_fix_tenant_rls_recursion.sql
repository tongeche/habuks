-- Migration 050: Fix RLS infinite recursion between tenant_members ↔ tenants
--
-- Root cause: INSERT on tenant_members triggers "Tenant owner can self-join"
-- → that policy queries tenants → triggers "Tenant admins read tenants" SELECT
-- → that policy queries tenant_members → infinite recursion (42P17)
--
-- Fix: SECURITY DEFINER helpers (same pattern as is_admin() in migration_007)
-- that run with row_security=off, breaking every link in the cycle.

-- ─── Helper 1: is tenant admin? ───────────────────────────────────────────
-- Replaces the inline join in "Tenant admins read/update tenants" (migration_035)
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_members tm
    JOIN members m ON m.id = tm.member_id
    WHERE tm.tenant_id = p_tenant_id
      AND tm.role IN ('admin', 'superadmin')
      AND m.auth_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

-- ─── Helper 2: tenant contact_email lookup ────────────────────────────────
-- Replaces the tenants subquery in "Tenant owner can self-join" (migration_036)
-- Avoids querying tenants table under RLS, which would re-trigger the cycle
CREATE OR REPLACE FUNCTION public.get_tenant_contact_email(p_tenant_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT contact_email FROM tenants WHERE id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_contact_email(uuid) TO authenticated;

-- ─── Helper 3: does tenant already have members? ──────────────────────────
-- Replaces the self-referencing NOT EXISTS in "Bootstrap tenant admin" (migration_029)
-- Avoids reading tenant_members within an INSERT policy on the same table
CREATE OR REPLACE FUNCTION public.tenant_has_members(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members WHERE tenant_id = p_tenant_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_members(uuid) TO authenticated;

-- ─── Rebuild tenants policies (migration_035) ─────────────────────────────
DROP POLICY IF EXISTS "Tenant admins read tenants" ON tenants;
CREATE POLICY "Tenant admins read tenants"
ON tenants FOR SELECT TO authenticated
USING (public.is_tenant_admin(id));

DROP POLICY IF EXISTS "Tenant admins update tenants" ON tenants;
CREATE POLICY "Tenant admins update tenants"
ON tenants FOR UPDATE TO authenticated
USING (public.is_tenant_admin(id))
WITH CHECK (public.is_tenant_admin(id));

-- ─── Rebuild "Tenant owner can self-join" (migration_036) ─────────────────
-- contact_email check now goes through get_tenant_contact_email() — no RLS
DROP POLICY IF EXISTS "Tenant owner can self-join" ON tenant_members;
CREATE POLICY "Tenant owner can self-join"
ON tenant_members FOR INSERT TO authenticated
WITH CHECK (
  role = 'admin'
  AND member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  AND lower(public.get_tenant_contact_email(tenant_id))
      = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- ─── Rebuild "Bootstrap tenant admin" (migration_029) ─────────────────────
-- NOT EXISTS self-reference replaced with tenant_has_members() helper
DROP POLICY IF EXISTS "Bootstrap tenant admin" ON tenant_members;
CREATE POLICY "Bootstrap tenant admin"
ON tenant_members FOR INSERT TO authenticated
WITH CHECK (
  member_id = (SELECT id FROM members WHERE auth_id = auth.uid())
  AND role = 'admin'
  AND NOT public.tenant_has_members(tenant_id)
);

