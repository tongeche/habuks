-- Seed data for JONGOL Poultry Incubation Initiative (JPP)
-- Based on poltry_brief.txt content
-- Run this after migration_004.sql

-- First, update or insert the main project record with full details
INSERT INTO iga_projects (
    code,
    name,
    tagline,
    short_description,
    description,
    objectives,
    expected_outcomes,
    beneficiaries,
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
    'Hatching livelihoods, one household at a time.',
    'A practical, community-led project helping rural families earn more and improve food security through reliable chick production, farmer training, and market access.',
    E'The Poultry Incubation Initiative (JPP) strengthens poultry production by combining:\n\n• Incubation support (reliable hatching capacity)\n• Brooding support (stronger chick survival)\n• Farmer training (housing, feeding, hygiene, disease prevention)\n• Market linkages (helping farmers sell chicks, growers, eggs, and mature birds)\n\nJPP is designed to start strong at a manageable scale, then expand as the model becomes self-sustaining through reinvestment.\n\nThe Challenge:\nFor many smallholder households, poultry is one of the fastest and most affordable ways to generate income. But traditional hatching methods often lead to low hatch rates, high chick mortality, limited access to training and animal health guidance, and inconsistent markets with poor pricing. This keeps flock sizes small and profits unpredictable.',
    E'1. Incubation & Brooding: Run structured hatch cycles with clear hygiene and quality procedures (egg selection, candling, cleaning, temperature control). Support chicks through proper brooding practices to reduce early losses.\n\n2. Farmer Training: Train participating households in practical skills including improved housing, predator control, feeding routines, brooding techniques, hygiene, biosecurity, record keeping, and marketing strategies.\n\n3. Distribution & Follow-Up: Provide chicks through community models (subsidised pricing, revolving approach) with guidance visits and peer learning.\n\n4. Livelihood & Market Growth: Connect farmers to local buyers and encourage collective selling for better pricing.',
    E'• Hatch rate and chick survival rate improvement\n• Number of households trained and supported\n• Flock size growth at household level\n• Income generated through sales (chicks, eggs, birds)\n• Lessons learned to improve each cycle\n\nOver time, JPP aims to grow into a stable community enterprise that can reach more households and villages.',
    E'• Women-led households\n• Youth (18–35) building livelihoods\n• Low-income smallholder farmers ready to participate and learn\n\nThe project strengthens both income and nutrition, supporting families to become more resilient over time.',
    'Kosele, Homa Bay County, Kenya',
    ARRAY['Training support', 'Operations support', 'Monitoring & Evaluation', 'Communications', 'Market support', 'Animal health', 'Data collection'],
    'Flexible – varies by role (few hours per week to project-based)',
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
    objectives = EXCLUDED.objectives,
    expected_outcomes = EXCLUDED.expected_outcomes,
    beneficiaries = EXCLUDED.beneficiaries,
    location = EXCLUDED.location,
    skills_needed = EXCLUDED.skills_needed,
    time_commitment = EXCLUDED.time_commitment,
    team_size = EXCLUDED.team_size,
    timeline_status = EXCLUDED.timeline_status,
    updated_at = CURRENT_TIMESTAMP;

-- Delete existing goals for JPP to replace with new ones
DELETE FROM project_goals WHERE project_id = (SELECT id FROM iga_projects WHERE code = 'JPP');

-- Insert detailed project goals
INSERT INTO project_goals (project_id, goal, display_order)
SELECT id, goal, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Improve hatch rates through proper incubation procedures and quality control',
    'Reduce chick mortality through structured brooding support',
    'Train participating households in practical poultry management skills',
    'Connect farmers to local buyers for consistent market access',
    'Support collective selling for better pricing power',
    'Grow into a stable, self-sustaining community enterprise',
    'Expand reach to more households and villages over time',
    'Document lessons learned to improve each production cycle'
]) WITH ORDINALITY AS t(goal, ord)
WHERE code = 'JPP';

-- Delete existing volunteer roles for JPP to replace with new ones
DELETE FROM project_volunteer_roles WHERE project_id = (SELECT id FROM iga_projects WHERE code = 'JPP');

-- Insert detailed volunteer roles based on the brief
INSERT INTO project_volunteer_roles (project_id, role_description, display_order)
SELECT id, role, ord FROM iga_projects, 
UNNEST(ARRAY[
    'Training Support: Help deliver farmer training sessions and demonstrations on housing, feeding, brooding, and hygiene',
    'Operations Support: Assist with logs, checklists, scheduling, and day-to-day incubation operations',
    'Monitoring & Evaluation: Collect data on hatch rates, chick survival, and household outcomes for learning and reporting',
    'Communications: Capture stories, photos, and short impact updates to share with supporters',
    'Market Support: Help with buyer outreach, pricing strategies, and connecting farmers to markets',
    'Animal Health Guidance: Provide basic biosecurity and health support for participating farmers',
    'Record Keeping: Help farmers track costs, mortality rates, and sales for better decision-making'
]) WITH ORDINALITY AS t(role, ord)
WHERE code = 'JPP';

-- Create table for project FAQ if not exists
CREATE TABLE IF NOT EXISTS project_faq (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for FAQ
ALTER TABLE project_faq ENABLE ROW LEVEL SECURITY;

-- Public read policy for FAQ
DROP POLICY IF EXISTS "Public can view project FAQ" ON project_faq;
CREATE POLICY "Public can view project FAQ" ON project_faq
FOR SELECT USING (true);

-- Insert FAQ for JPP
DELETE FROM project_faq WHERE project_id = (SELECT id FROM iga_projects WHERE code = 'JPP');

INSERT INTO project_faq (project_id, question, answer, display_order)
SELECT id, question, answer, ord FROM iga_projects, 
(VALUES
    ('Where does the donation money go?', 
     'Your support funds incubators and essential equipment, brooding supplies (feeders, drinkers, heat source, bedding), starter feed and vitamins for early cycles, training sessions and farmer follow-ups, and animal health guidance tools.', 
     1),
    ('How do you choose which farmers participate?', 
     'JPP prioritises women-led households, youth aged 18-35 building livelihoods, and low-income smallholder farmers who are ready to participate and learn. We work with community leaders to identify families who would benefit most.', 
     2),
    ('How often are hatch cycles run?', 
     'We run structured hatch cycles following clear hygiene and quality procedures. The frequency depends on capacity and demand, typically every 21 days (the natural incubation period for chicken eggs).', 
     3),
    ('What training do farmers receive?', 
     'Farmers learn practical, everyday skills including improved housing and predator control, feeding and clean water routines, brooding techniques and temperature management, hygiene and biosecurity basics, record keeping, and simple marketing strategies.', 
     4),
    ('How do you measure success?', 
     'We track measurable progress through hatch rate and chick survival rate, number of households trained, flock size growth at household level, income generated through sales, and lessons learned each cycle.', 
     5),
    ('Can I volunteer remotely?', 
     'Some roles like communications, data analysis, and market research can be done remotely. Training support and operations roles require on-site presence in Kosele, Homa Bay County.', 
     6)
) AS t(question, answer, ord)
WHERE code = 'JPP';

-- Create table for project activities/what we do sections
CREATE TABLE IF NOT EXISTS project_activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE project_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project activities" ON project_activities;
CREATE POLICY "Public can view project activities" ON project_activities
FOR SELECT USING (true);

-- Insert What We Do activities for JPP
DELETE FROM project_activities WHERE project_id = (SELECT id FROM iga_projects WHERE code = 'JPP');

INSERT INTO project_activities (project_id, title, description, icon, display_order)
SELECT p.id, t.act_title, t.act_description, t.act_icon, t.ord FROM iga_projects p,
(VALUES
    ('Incubation & Brooding', 
     'We run structured hatch cycles, following clear hygiene and quality procedures (egg selection, candling, cleaning, temperature control). Chicks are then supported through proper brooding practices to reduce early losses.', 
     'egg',
     1),
    ('Farmer Training', 
     'We train participating households in practical, everyday skills: improved housing and predator control, feeding and clean water routines, brooding techniques, hygiene and biosecurity basics, record keeping, and simple marketing strategies.', 
     'book',
     2),
    ('Distribution & Follow-Up', 
     'Farmers access chicks through an agreed community model (subsidised pricing, revolving approach, or group support). We follow up with guidance visits and peer learning to help farmers apply what they learn.', 
     'truck',
     3),
    ('Market & Livelihood Growth', 
     'As farmers grow their flocks, we support connections to local buyers and encourage collective selling for better pricing and consistent demand.', 
     'trending-up',
     4)
) AS t(act_title, act_description, act_icon, ord)
WHERE p.code = 'JPP';

-- Create table for donation items/impact
CREATE TABLE IF NOT EXISTS project_donation_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    item VARCHAR(200) NOT NULL,
    description TEXT,
    estimated_cost NUMERIC(10,2),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE project_donation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view donation items" ON project_donation_items;
CREATE POLICY "Public can view donation items" ON project_donation_items
FOR SELECT USING (true);

-- Insert donation items for JPP
DELETE FROM project_donation_items WHERE project_id = (SELECT id FROM iga_projects WHERE code = 'JPP');

INSERT INTO project_donation_items (project_id, item, description, estimated_cost, display_order)
SELECT p.id, t.item_name, t.item_desc, t.cost, t.ord FROM iga_projects p,
(VALUES
    ('Incubator & Equipment', 'Essential hatching equipment for reliable egg incubation', 15000.00, 1),
    ('Brooding Supplies', 'Feeders, drinkers, heat source, and bedding materials', 5000.00, 2),
    ('Starter Feed & Vitamins', 'Nutritional supplies for early production cycles', 3000.00, 3),
    ('Training Sessions', 'Materials and facilitation for farmer training workshops', 2500.00, 4),
    ('Farmer Follow-ups', 'Transport and supplies for guidance visits', 1500.00, 5),
    ('Biosecurity Tools', 'Basic animal health and hygiene equipment', 2000.00, 6)
) AS t(item_name, item_desc, cost, ord)
WHERE p.code = 'JPP';

-- Create indexes for new tables
CREATE INDEX IF NOT EXISTS idx_project_faq_project ON project_faq(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities(project_id);
CREATE INDEX IF NOT EXISTS idx_project_donation_items_project ON project_donation_items(project_id);

-- Update the public_projects view to include new data
DROP VIEW IF EXISTS public_projects;
CREATE VIEW public_projects AS
SELECT 
    p.id,
    p.code,
    p.name,
    p.tagline,
    p.short_description,
    p.description,
    p.objectives,
    p.expected_outcomes,
    p.beneficiaries,
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
    ) AS gallery,
    COALESCE(
        (SELECT json_agg(json_build_object('id', f.id, 'question', f.question, 'answer', f.answer) ORDER BY f.display_order)
         FROM project_faq f WHERE f.project_id = p.id),
        '[]'::json
    ) AS faq,
    COALESCE(
        (SELECT json_agg(json_build_object('id', a.id, 'title', a.title, 'description', a.description, 'icon', a.icon) ORDER BY a.display_order)
         FROM project_activities a WHERE a.project_id = p.id),
        '[]'::json
    ) AS activities,
    COALESCE(
        (SELECT json_agg(json_build_object('id', d.id, 'item', d.item, 'description', d.description, 'cost', d.estimated_cost) ORDER BY d.display_order)
         FROM project_donation_items d WHERE d.project_id = p.id),
        '[]'::json
    ) AS donation_items
FROM iga_projects p
WHERE p.is_visible = true
ORDER BY p.display_order;
