-- Seed data for JONGOL FOUNDATION
-- Test seed with 1 member (Timothy Ongeche)
-- Auth ID: 73bba80a-05c8-49af-885b-28ec8ee008fa

-- Insert Timothy with auth_id
INSERT INTO members (name, email, phone_number, join_date, status, role, auth_id)
VALUES
  ('Timothy Ongeche', 'tongeche@gmail.com', '+351931608896', '2025-10-01', 'active', 'admin', '73bba80a-05c8-49af-885b-28ec8ee008fa');

-- Get Timothy's member ID for foreign key references
-- Assuming he's the first member inserted (id = 1)

-- Timothy's payout (turn #8 - March 30, 2026)
INSERT INTO payouts (member_id, amount, date, cycle_number)
VALUES
  ((SELECT id FROM members WHERE auth_id = '73bba80a-05c8-49af-885b-28ec8ee008fa'), 500, '2026-03-30', 8);

-- Welfare account (group shared)
INSERT INTO welfare_accounts (name, description)
VALUES ('Main Welfare Fund', 'Group welfare savings for emergencies and member support');

-- Timothy's contributions (Ksh. 500 every 2 weeks)
-- Cycle dates: Dec 15, Dec 30, Jan 15, Jan 30, Feb 15, Feb 28, Mar 15, Mar 30...
-- As of Jan 9, 2026: Cycles 1 and 2 completed
INSERT INTO contributions (member_id, amount, date, cycle_number)
VALUES
  ((SELECT id FROM members WHERE auth_id = '73bba80a-05c8-49af-885b-28ec8ee008fa'), 500, '2025-12-15', 1),
  ((SELECT id FROM members WHERE auth_id = '73bba80a-05c8-49af-885b-28ec8ee008fa'), 500, '2025-12-30', 2);

-- IGA Projects (Timothy as project leader)
INSERT INTO iga_projects (name, description, start_date, project_leader, objectives, status, location)
VALUES
  ('JPP – Poultry Incubation Initiative', 'Sustainable poultry production through incubation, layers, and broilers farming.', '2025-08-01', 
   (SELECT id FROM members WHERE auth_id = '73bba80a-05c8-49af-885b-28ec8ee008fa'), 
   'Establish reliable poultry incubation capacity, increase poultry stock sustainably.', 'active', 'Kosele, Rachuonyo'),
  ('JGF – Jongol Groundnut Foods', 'Groundnut farming, processing, and peanut butter production.', '2025-09-15', 
   (SELECT id FROM members WHERE auth_id = '73bba80a-05c8-49af-885b-28ec8ee008fa'), 
   'Increase value of groundnuts through processing.', 'development', 'Kosele, Rachuonyo');
