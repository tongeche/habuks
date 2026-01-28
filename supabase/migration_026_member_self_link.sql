-- Migration 026: Allow invited members to link profiles on first login

-- Ensure RLS is enabled
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create their own member profile
DROP POLICY IF EXISTS "Members can insert own profile" ON public.members;
CREATE POLICY "Members can insert own profile" ON public.members
FOR INSERT
WITH CHECK (
  auth.uid() = auth_id
  AND email IS NOT NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Allow authenticated users to link an existing profile by matching email
DROP POLICY IF EXISTS "Members can link profile by email" ON public.members;
CREATE POLICY "Members can link profile by email" ON public.members
FOR UPDATE
USING (
  auth_id IS NULL
  AND email IS NOT NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
WITH CHECK (
  auth_id = auth.uid()
  AND email IS NOT NULL
  AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
