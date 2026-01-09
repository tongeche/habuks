-- Seed data for JONGOL FOUNDATION Welfare System
-- 
-- THE MATH:
-- - 12 members contribute Ksh. 500 each per cycle (biweekly)
-- - Total collected per cycle: 12 × 500 = Ksh. 6,000
-- - Payout to 1 member: Ksh. 5,000
-- - Welfare contribution: Ksh. 1,000 per cycle
-- - After 12 cycles: Welfare fund = 12 × 1,000 = Ksh. 12,000
--
-- Cycle Schedule (starting Dec 15, 2025):
-- Cycle 1:  Dec 15, 2025 - Orpah gets Ksh. 5,000, Welfare = Ksh. 1,000
-- Cycle 2:  Dec 30, 2025 - Shadrack gets Ksh. 5,000, Welfare = Ksh. 2,000
-- Cycle 3:  Jan 15, 2026 - Ketty gets Ksh. 5,000, Welfare = Ksh. 3,000
-- Cycle 4:  Jan 30, 2026 - Eunice gets Ksh. 5,000, Welfare = Ksh. 4,000
-- Cycle 5:  Feb 15, 2026 - Helida gets Ksh. 5,000, Welfare = Ksh. 5,000
-- Cycle 6:  Feb 28, 2026 - Moses gets Ksh. 5,000, Welfare = Ksh. 6,000
-- Cycle 7:  Mar 15, 2026 - Sipora gets Ksh. 5,000, Welfare = Ksh. 7,000
-- Cycle 8:  Mar 30, 2026 - Timothy gets Ksh. 5,000, Welfare = Ksh. 8,000
-- Cycle 9:  Apr 15, 2026 - Peres gets Ksh. 5,000, Welfare = Ksh. 9,000
-- Cycle 10: Apr 30, 2026 - Mitchell gets Ksh. 5,000, Welfare = Ksh. 10,000
-- Cycle 11: May 15, 2026 - Rosa gets Ksh. 5,000, Welfare = Ksh. 11,000
-- Cycle 12: May 30, 2026 - Quinter gets Ksh. 5,000, Welfare = Ksh. 12,000

-- =====================================================
-- WELFARE ACCOUNTS
-- =====================================================

INSERT INTO welfare_accounts (id, name, description)
VALUES (1, 'Main Welfare Fund', 'Group welfare savings - Ksh. 1,000 per cycle from contributions')
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- =====================================================
-- WELFARE CYCLES (All 12 cycles)
-- =====================================================
-- Each cycle: Ksh. 6,000 collected, Ksh. 5,000 payout, Ksh. 1,000 to welfare

INSERT INTO welfare_cycles (id, start_date, end_date, cycle_number, total_contributed, total_disbursed)
VALUES 
  (1, '2025-12-15', '2025-12-29', 1, 6000.00, 5000.00),
  (2, '2025-12-30', '2026-01-14', 2, 6000.00, 5000.00),
  (3, '2026-01-15', '2026-01-29', 3, 6000.00, 5000.00),
  (4, '2026-01-30', '2026-02-14', 4, 6000.00, 5000.00),
  (5, '2026-02-15', '2026-02-27', 5, 6000.00, 5000.00),
  (6, '2026-02-28', '2026-03-14', 6, 6000.00, 5000.00),
  (7, '2026-03-15', '2026-03-29', 7, 6000.00, 5000.00),
  (8, '2026-03-30', '2026-04-14', 8, 6000.00, 5000.00),
  (9, '2026-04-15', '2026-04-29', 9, 6000.00, 5000.00),
  (10, '2026-04-30', '2026-05-14', 10, 6000.00, 5000.00),
  (11, '2026-05-15', '2026-05-29', 11, 6000.00, 5000.00),
  (12, '2026-05-30', '2026-06-14', 12, 6000.00, 5000.00)
ON CONFLICT (id) DO UPDATE SET
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  cycle_number = EXCLUDED.cycle_number,
  total_contributed = EXCLUDED.total_contributed,
  total_disbursed = EXCLUDED.total_disbursed;

-- =====================================================
-- WELFARE TRANSACTIONS (Automated per cycle)
-- =====================================================
-- Ksh. 1,000 welfare contribution per cycle

INSERT INTO welfare_transactions (welfare_account_id, cycle_id, member_id, amount, transaction_type, date, description)
VALUES
  -- Cycle 1: Dec 15, 2025 - Welfare = Ksh. 1,000
  (1, 1, NULL, 1000.00, 'contribution', '2025-12-15', 'Welfare contribution from Cycle 1 (Orpah payout)'),
  -- Cycle 2: Dec 30, 2025 - Welfare = Ksh. 2,000
  (1, 2, NULL, 1000.00, 'contribution', '2025-12-30', 'Welfare contribution from Cycle 2 (Shadrack payout)')
ON CONFLICT DO NOTHING;

-- As of today (Jan 9, 2026), cycles 1 & 2 are complete, cycle 3 is upcoming
-- Current welfare balance = Ksh. 2,000

-- =====================================================
-- WELFARE BALANCES (Running totals)
-- =====================================================

INSERT INTO welfare_balances (id, welfare_account_id, cycle_id, balance)
VALUES
  (1, 1, 1, 1000.00),   -- After cycle 1
  (2, 1, 2, 2000.00)    -- After cycle 2 (current)
ON CONFLICT (id) DO UPDATE SET
  balance = EXCLUDED.balance;

-- =====================================================
-- HELPER FUNCTION: Auto-calculate welfare for any cycle
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_welfare_balance(target_cycle INTEGER)
RETURNS NUMERIC AS $$
BEGIN
  -- Welfare = cycles_completed × 1000
  RETURN target_cycle * 1000.00;
END;
$$ LANGUAGE plpgsql;

-- Example usage: SELECT calculate_welfare_balance(8);  -- Returns 8000 (after Timothy's payout)

-- =====================================================
-- HELPER FUNCTION: Get current welfare status
-- =====================================================

CREATE OR REPLACE FUNCTION get_current_welfare_status()
RETURNS TABLE (
  completed_cycles INTEGER,
  welfare_balance NUMERIC,
  next_cycle_date DATE,
  final_welfare_amount NUMERIC
) AS $$
DECLARE
  current_cycle INTEGER;
BEGIN
  -- Find the last completed cycle (based on current date)
  SELECT COALESCE(MAX(cycle_number), 0) INTO current_cycle
  FROM welfare_cycles
  WHERE end_date <= CURRENT_DATE;
  
  RETURN QUERY
  SELECT 
    current_cycle,
    (current_cycle * 1000.00)::NUMERIC,
    (SELECT start_date FROM welfare_cycles WHERE cycle_number = current_cycle + 1),
    12000.00::NUMERIC;  -- Final amount after all 12 cycles
END;
$$ LANGUAGE plpgsql;

-- Example usage: SELECT * FROM get_current_welfare_status();

-- =====================================================
-- VIEW: Welfare Summary
-- =====================================================

CREATE OR REPLACE VIEW welfare_summary AS
SELECT 
  wc.cycle_number,
  wc.start_date AS payout_date,
  wc.total_contributed,
  wc.total_disbursed AS payout_amount,
  1000.00 AS welfare_added,
  (wc.cycle_number * 1000.00) AS welfare_running_total,
  CASE 
    WHEN wc.end_date <= CURRENT_DATE THEN 'Completed'
    WHEN wc.start_date <= CURRENT_DATE THEN 'In Progress'
    ELSE 'Upcoming'
  END AS status
FROM welfare_cycles wc
ORDER BY wc.cycle_number;

-- Example usage: SELECT * FROM welfare_summary;
