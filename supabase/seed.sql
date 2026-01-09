-- Seed data for JONGOL FOUNDATION
-- 12 Members with payout schedule (FAMILY M.G.R-2025)
-- Using phone numbers as primary identifier (email is optional)

INSERT INTO members (name, email, password_hash, join_date, status, role, phone_number, date_of_birth)
VALUES
  ('Sipora Ouko', NULL, '', '2025-10-01', 'active', 'member', '+254700000001', NULL),
  ('Timothy Ongeche', NULL, '', '2025-10-01', 'active', 'member', '+254700000002', NULL),
  ('Helida Akoth', NULL, '', '2025-10-01', 'active', 'member', '+254700000003', NULL),
  ('Peres Atieno', NULL, '', '2025-10-01', 'active', 'member', '+254700000004', NULL),
  ('Shadrack Ouma', NULL, '', '2025-10-01', 'active', 'member', '+254700000005', NULL),
  ('Orpah', NULL, '', '2025-10-01', 'active', 'member', '+254700000006', NULL),
  ('Moses Oyugi', NULL, '', '2025-10-01', 'active', 'member', '+254700000007', NULL),
  ('Ketty Aoko', NULL, '', '2025-10-01', 'active', 'member', '+254700000008', NULL),
  ('Mitchell Wadoyi', NULL, '', '2025-10-01', 'active', 'member', '+254700000009', NULL),
  ('Quinter Odao', NULL, '', '2025-10-01', 'active', 'member', '+254700000010', NULL),
  ('Eunice Auma', NULL, '', '2025-10-01', 'active', 'member', '+254700000011', NULL),
  ('Rosa Silva', NULL, '', '2025-10-01', 'active', 'member', '+254700000012', NULL);

-- Payout schedule (Ksh. 500 to one member per cycle, based on FAMILY M.G.R-2025)
-- 1. Orpah - 15th December 2025
-- 2. Shadrack - 30th December 2025
-- 3. Ketty - 15th January 2026
-- 4. Eunice - 30th January 2026
-- 5. Helida - 15th February 2026
-- 6. Moses - 28th February 2026
-- 7. Sipora - 15th March 2026
-- 8. Timothy - 30th March 2026
-- 9. Peres - 15th April 2026
-- 10. Mitchell - 30th April 2026
-- 11. Rosa - 15th May 2026
-- 12. Quinter - 30th May 2026

INSERT INTO payouts (member_id, amount, date, cycle_number)
VALUES
  (6, 500, '2025-12-15', 1),   -- Orpah
  (5, 500, '2025-12-30', 2),   -- Shadrack
  (8, 500, '2026-01-15', 3),   -- Ketty
  (11, 500, '2026-01-30', 4),  -- Eunice
  (3, 500, '2026-02-15', 5),   -- Helida
  (7, 500, '2026-02-28', 6),   -- Moses
  (1, 500, '2026-03-15', 7),   -- Sipora
  (2, 500, '2026-03-30', 8),   -- Timothy
  (4, 500, '2026-04-15', 9),   -- Peres
  (9, 500, '2026-04-30', 10),  -- Mitchell
  (12, 500, '2026-05-15', 11), -- Rosa
  (10, 500, '2026-05-30', 12); -- Quinter

-- Welfare account
INSERT INTO welfare_accounts (name, description)
VALUES ('Main Welfare Fund', 'Group welfare savings for emergencies and member support');

-- Welfare cycles (Ksh. 1000 saved per cycle, starting Dec 15, 2025)
INSERT INTO welfare_cycles (start_date, end_date, cycle_number, total_contributed, total_disbursed)
VALUES
  ('2025-12-15', '2025-12-29', 1, 1000, 0),
  ('2025-12-30', '2026-01-14', 2, 1000, 0),
  ('2026-01-15', '2026-01-29', 3, 1000, 0),
  ('2026-01-30', '2026-02-14', 4, 1000, 0),
  ('2026-02-15', '2026-02-27', 5, 1000, 0),
  ('2026-02-28', '2026-03-14', 6, 1000, 0),
  ('2026-03-15', '2026-03-29', 7, 1000, 0),
  ('2026-03-30', '2026-04-14', 8, 1000, 0),
  ('2026-04-15', '2026-04-29', 9, 1000, 0),
  ('2026-04-30', '2026-05-14', 10, 1000, 0),
  ('2026-05-15', '2026-05-29', 11, 1000, 0),
  ('2026-05-30', '2026-06-14', 12, 1000, 0);

-- Welfare transactions (cycles 1-2 completed as of Jan 8, 2026)
INSERT INTO welfare_transactions (welfare_account_id, cycle_id, member_id, amount, transaction_type, date, description)
VALUES
  (1, 1, NULL, 1000, 'contribution', '2025-12-15', 'Cycle 1 savings'),
  (1, 2, NULL, 1000, 'contribution', '2025-12-30', 'Cycle 2 savings');

-- Welfare balances
INSERT INTO welfare_balances (welfare_account_id, cycle_id, balance)
VALUES
  (1, 1, 1000),
  (1, 2, 2000);

-- IGA Projects
INSERT INTO iga_projects (name, description, start_date, project_leader, objectives, expected_outcomes, beneficiaries, status, location)
VALUES
  ('JPP – Poultry Incubation Initiative', 'Sustainable poultry production through incubation, layers, and broilers farming.', '2025-08-01', 2, 'Establish reliable poultry incubation capacity, increase poultry stock sustainably, generate steady income for group members.', 'Direct income generation, improved food security, scalable model for future enterprise.', '12 members, local community', 'active', 'Kosele, Rachuonyo'),
  ('JGF – Jongol Groundnut Foods', 'Groundnut farming, processing, and peanut butter production.', '2025-09-15', 1, 'Increase value of groundnuts through processing, create a sustainable community food enterprise.', 'Improved household incomes and nutrition, skills in agro-processing.', '12 members, local market', 'development', 'Kosele, Rachuonyo');

-- Sample contributions (all 12 members for cycles 1 and 2)
-- Cycle 1: Dec 15, 2025
INSERT INTO contributions (member_id, amount, date, cycle_number)
VALUES
  (1, 500, '2025-12-15', 1),
  (2, 500, '2025-12-15', 1),
  (3, 500, '2025-12-15', 1),
  (4, 500, '2025-12-15', 1),
  (5, 500, '2025-12-15', 1),
  (6, 500, '2025-12-15', 1),
  (7, 500, '2025-12-15', 1),
  (8, 500, '2025-12-15', 1),
  (9, 500, '2025-12-15', 1),
  (10, 500, '2025-12-15', 1),
  (11, 500, '2025-12-15', 1),
  (12, 500, '2025-12-15', 1);

-- Cycle 2: Dec 30, 2025
INSERT INTO contributions (member_id, amount, date, cycle_number)
VALUES
  (1, 500, '2025-12-30', 2),
  (2, 500, '2025-12-30', 2),
  (3, 500, '2025-12-30', 2),
  (4, 500, '2025-12-30', 2),
  (5, 500, '2025-12-30', 2),
  (6, 500, '2025-12-30', 2),
  (7, 500, '2025-12-30', 2),
  (8, 500, '2025-12-30', 2),
  (9, 500, '2025-12-30', 2),
  (10, 500, '2025-12-30', 2),
  (11, 500, '2025-12-30', 2),
  (12, 500, '2025-12-30', 2);
