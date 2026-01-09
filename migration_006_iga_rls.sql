-- Migration 006: Add RLS policies for IGA projects tables

-- Enable RLS on iga_projects (if not already enabled)
ALTER TABLE iga_projects ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read projects
CREATE POLICY "Allow authenticated users to read projects"
ON iga_projects
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to insert/update/delete projects
CREATE POLICY "Allow admins to manage projects"
ON iga_projects
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members 
    WHERE members.auth_id = auth.uid() 
    AND members.role = 'admin'
  )
);

-- Enable RLS on iga_committee_members
ALTER TABLE iga_committee_members ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read project members
CREATE POLICY "Allow authenticated users to read project members"
ON iga_committee_members
FOR SELECT
TO authenticated
USING (true);

-- Allow users to join projects (insert their own membership)
CREATE POLICY "Allow users to join projects"
ON iga_committee_members
FOR INSERT
TO authenticated
WITH CHECK (
  member_id = (
    SELECT id FROM members WHERE auth_id = auth.uid()
  )
);

-- Allow users to leave projects (delete their own membership)
CREATE POLICY "Allow users to leave projects"
ON iga_committee_members
FOR DELETE
TO authenticated
USING (
  member_id = (
    SELECT id FROM members WHERE auth_id = auth.uid()
  )
);

-- Alternative: If you want to disable RLS entirely (simpler but less secure)
-- Uncomment these lines and comment out everything above:
-- ALTER TABLE iga_projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE iga_committee_members DISABLE ROW LEVEL SECURITY;
