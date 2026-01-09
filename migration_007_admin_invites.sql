-- Migration 007: Admin member management + invite codes

-- Enable pgcrypto for gen_random_uuid if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper to avoid RLS recursion when checking admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members m
    WHERE m.auth_id = auth.uid()
    AND m.role IN ('admin', 'superadmin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin policies for members table
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all members" ON members;
CREATE POLICY "Admins can view all members" ON members
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert members" ON members;
CREATE POLICY "Admins can insert members" ON members
FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update members" ON members;
CREATE POLICY "Admins can update members" ON members
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete members" ON members;
CREATE POLICY "Admins can delete members" ON members
FOR DELETE
USING (public.is_admin());

-- Invite codes table
CREATE TABLE IF NOT EXISTS member_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone_number TEXT,
  role VARCHAR(50) DEFAULT 'member',
  status VARCHAR(30) DEFAULT 'pending',
  code_hash TEXT NOT NULL UNIQUE,
  code_prefix VARCHAR(12) NOT NULL,
  created_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by INTEGER REFERENCES members(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_member_invites_email ON member_invites(email);
CREATE INDEX IF NOT EXISTS idx_member_invites_code_prefix ON member_invites(code_prefix);

ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage member invites" ON member_invites;
CREATE POLICY "Admins can manage member invites" ON member_invites
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
