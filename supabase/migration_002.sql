-- Migration 002: Add date_of_birth to members, auth_id, and create policies

-- Add date_of_birth to members table (phone_number is already in schema.sql)
ALTER TABLE members
ADD COLUMN date_of_birth DATE;

-- Add auth_id UUID column to members table (links to Supabase auth.users)
ALTER TABLE members
ADD COLUMN auth_id UUID UNIQUE;

-- Example Supabase RLS (Row Level Security) Policies
-- Enable RLS for members
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view their own profile
DROP POLICY IF EXISTS "Members can view own profile" ON members;
CREATE POLICY "Members can view own profile" ON members
FOR SELECT USING (auth.uid() = auth_id);

-- Policy: Members can update their own profile
DROP POLICY IF EXISTS "Members can update own profile" ON members;
CREATE POLICY "Members can update own profile" ON members
FOR UPDATE USING (auth.uid() = auth_id);

-- Enable RLS for contributions
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view their own contributions
DROP POLICY IF EXISTS "Members can view own contributions" ON contributions;
CREATE POLICY "Members can view own contributions" ON contributions
FOR SELECT USING (auth.uid() = (SELECT auth_id FROM members WHERE id = member_id));

-- Policy: Admins can view all contributions (example, requires admin role setup)
-- DROP POLICY IF EXISTS "Admins can view all contributions" ON contributions;
-- CREATE POLICY "Admins can view all contributions" ON contributions
-- FOR SELECT USING (EXISTS (SELECT 1 FROM members WHERE auth_id = auth.uid() AND role = 'admin'));

-- Enable RLS for payouts
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view their own payouts
DROP POLICY IF EXISTS "Members can view own payouts" ON payouts;
CREATE POLICY "Members can view own payouts" ON payouts
FOR SELECT USING (auth.uid() = (SELECT auth_id FROM members WHERE id = member_id));

-- Enable RLS for welfare_transactions
ALTER TABLE welfare_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view their own welfare transactions
DROP POLICY IF EXISTS "Members can view own welfare transactions" ON welfare_transactions;
CREATE POLICY "Members can view own welfare transactions" ON welfare_transactions
FOR SELECT USING (auth.uid() = (SELECT auth_id FROM members WHERE id = member_id));

-- Enable RLS for blogs
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view all blogs
DROP POLICY IF EXISTS "Members can view all blogs" ON blogs;
CREATE POLICY "Members can view all blogs" ON blogs
FOR SELECT USING (true);

-- Policy: Members can insert their own blogs
DROP POLICY IF EXISTS "Members can insert own blogs" ON blogs;
CREATE POLICY "Members can insert own blogs" ON blogs
FOR INSERT WITH CHECK (auth.uid() = (SELECT auth_id FROM members WHERE id = author_id));

-- Add more policies as needed for other tables and roles.
-- Remember to backfill auth_id for existing members after migration.
