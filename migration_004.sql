-- Migration 004: Enhance iga_projects table for volunteer page display
-- This adds fields needed to display projects on the public volunteer page
-- and allows admins to manage project information for recruitment

-- Add new columns to iga_projects for volunteer page display
ALTER TABLE iga_projects 
ADD COLUMN IF NOT EXISTS code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS tagline VARCHAR(200),
ADD COLUMN IF NOT EXISTS short_description TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS skills_needed TEXT[],
ADD COLUMN IF NOT EXISTS time_commitment VARCHAR(100),
ADD COLUMN IF NOT EXISTS team_size VARCHAR(50),
ADD COLUMN IF NOT EXISTS timeline_status VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Project goals table for detailed goals display
CREATE TABLE IF NOT EXISTS project_goals (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project volunteer roles - how volunteers can help
CREATE TABLE IF NOT EXISTS project_volunteer_roles (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    role_description TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project gallery for multiple images
CREATE TABLE IF NOT EXISTS project_gallery (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption VARCHAR(200),
    is_primary BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE project_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_volunteer_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_gallery ENABLE ROW LEVEL SECURITY;

-- Public read policies (anyone can view project info)
CREATE POLICY "Public can view project goals" ON project_goals
FOR SELECT USING (true);

CREATE POLICY "Public can view volunteer roles" ON project_volunteer_roles
FOR SELECT USING (true);

CREATE POLICY "Public can view project gallery" ON project_gallery
FOR SELECT USING (true);

-- Admin write policies (only admins can modify)
CREATE POLICY "Admins can manage project goals" ON project_goals
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM members 
        WHERE members.auth_id = auth.uid() 
        AND members.role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Admins can manage volunteer roles" ON project_volunteer_roles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM members 
        WHERE members.auth_id = auth.uid() 
        AND members.role IN ('admin', 'superadmin')
    )
);

CREATE POLICY "Admins can manage project gallery" ON project_gallery
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM members 
        WHERE members.auth_id = auth.uid() 
        AND members.role IN ('admin', 'superadmin')
    )
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp on iga_projects
DROP TRIGGER IF EXISTS update_iga_projects_timestamp ON iga_projects;
CREATE TRIGGER update_iga_projects_timestamp
    BEFORE UPDATE ON iga_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_project_timestamp();

-- ============================================
-- SEED DATA: Insert the two existing projects
-- ============================================

-- Insert Poultry Project (JPP)
INSERT INTO iga_projects (
    code,
    name,
    tagline,
    short_description,
    description,
    location,
    skills_needed,
    time_commitment,
    team_size,
    timeline_status,
    status,
    is_recruiting,
    is_visible,
    display_order
) VALUES (
    'JPP',
    'Poultry Incubation Initiative',
    'Sustainable poultry production & food security',
    'Sustainable poultry production & food security',
    'The Jongol Poultry Project (JPP) is our flagship agricultural initiative focused on sustainable poultry production. We incubate and raise layers and broilers, providing eggs and meat to local markets while creating employment opportunities for community members.',
    'Kosele, Homa Bay County',
    ARRAY['Farm hands', 'Record keeping', 'Marketing', 'Poultry health'],
    'Flexible, few hours per week',
    '10+ active volunteers',
    'Ongoing – join anytime',
    'active',
    true,
    true,
    1
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    location = EXCLUDED.location,
    skills_needed = EXCLUDED.skills_needed,
    time_commitment = EXCLUDED.time_commitment,
    team_size = EXCLUDED.team_size,
    timeline_status = EXCLUDED.timeline_status,
    updated_at = CURRENT_TIMESTAMP;

-- Insert Groundnut Foods Project (JGF)
INSERT INTO iga_projects (
    code,
    name,
    tagline,
    short_description,
    description,
    location,
    skills_needed,
    time_commitment,
    team_size,
    timeline_status,
    status,
    is_recruiting,
    is_visible,
    display_order
) VALUES (
    'JGF',
    'Groundnut Foods',
    'Value-addition agribusiness & nutrition',
    'Value-addition agribusiness & nutrition',
    'Jongol Groundnut Foods (JGF) is our value-addition agribusiness project transforming locally grown groundnuts into nutritious food products. We produce peanut butter, roasted nuts, and other groundnut-based products for local and regional markets.',
    'Kosele, Homa Bay County',
    ARRAY['Processing', 'Packaging', 'Distribution', 'Food safety'],
    'Project-based involvement',
    'Growing team',
    'Development phase – launching soon',
    'planning',
    true,
    true,
    2
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    location = EXCLUDED.location,
    skills_needed = EXCLUDED.skills_needed,
    time_commitment = EXCLUDED.time_commitment,
    team_size = EXCLUDED.team_size,
    timeline_status = EXCLUDED.timeline_status,
    updated_at = CURRENT_TIMESTAMP;

-- Insert goals for JPP
INSERT INTO project_goals (project_id, goal, display_order)
SELECT id, goal, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Produce 1,000+ eggs weekly for local distribution',
    'Train 50+ community members in poultry management',
    'Establish a sustainable feed production system',
    'Create income opportunities for youth and women'
]) WITH ORDINALITY AS t(goal, ord)
WHERE code = 'JPP'
ON CONFLICT DO NOTHING;

-- Insert goals for JGF
INSERT INTO project_goals (project_id, goal, display_order)
SELECT id, goal, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Process 500kg of groundnuts monthly',
    'Develop 5 unique groundnut-based products',
    'Partner with 20+ local farmers for sourcing',
    'Establish distribution channels across the county'
]) WITH ORDINALITY AS t(goal, ord)
WHERE code = 'JGF'
ON CONFLICT DO NOTHING;

-- Insert volunteer roles for JPP
INSERT INTO project_volunteer_roles (project_id, role_description, display_order)
SELECT id, role, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Help with daily feeding and egg collection',
    'Assist with record keeping and inventory',
    'Support marketing and sales activities',
    'Contribute technical expertise in poultry health'
]) WITH ORDINALITY AS t(role, ord)
WHERE code = 'JPP'
ON CONFLICT DO NOTHING;

-- Insert volunteer roles for JGF
INSERT INTO project_volunteer_roles (project_id, role_description, display_order)
SELECT id, role, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Assist with product processing and packaging',
    'Help develop marketing materials and branding',
    'Support distribution and sales efforts',
    'Contribute expertise in food safety and quality'
]) WITH ORDINALITY AS t(role, ord)
WHERE code = 'JGF'
ON CONFLICT DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_iga_projects_code ON iga_projects(code);
CREATE INDEX IF NOT EXISTS idx_iga_projects_visible ON iga_projects(is_visible, is_recruiting);
CREATE INDEX IF NOT EXISTS idx_project_goals_project ON project_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_volunteer_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_project_gallery_project ON project_gallery(project_id);

-- View for public project display (combines all related data)
CREATE OR REPLACE VIEW public_projects AS
SELECT 
    p.id,
    p.code,
    p.name,
    p.tagline,
    p.short_description,
    p.description,
    p.location,
    p.skills_needed,
    p.time_commitment,
    p.team_size,
    p.timeline_status,
    p.status,
    p.is_recruiting,
    p.display_order,
    p.image_url,
    COALESCE(
        (SELECT json_agg(json_build_object('id', g.id, 'goal', g.goal) ORDER BY g.display_order)
         FROM project_goals g WHERE g.project_id = p.id),
        '[]'::json
    ) AS goals,
    COALESCE(
        (SELECT json_agg(json_build_object('id', r.id, 'role', r.role_description) ORDER BY r.display_order)
         FROM project_volunteer_roles r WHERE r.project_id = p.id),
        '[]'::json
    ) AS volunteer_roles,
    COALESCE(
        (SELECT json_agg(json_build_object('id', i.id, 'url', i.image_url, 'caption', i.caption) ORDER BY i.display_order)
         FROM project_gallery i WHERE i.project_id = p.id),
        '[]'::json
    ) AS gallery
FROM iga_projects p
WHERE p.is_visible = true
ORDER BY p.display_order;
