
CREATE OR REPLACE VIEW member_total_welfare AS
SELECT
  m.id AS id,
  m.name,
  m.email,
  m.phone_number,
  m.status,
  m.role,
  m.join_date,
  COALESCE(SUM(wt.amount), 0) AS total_welfare
FROM members m
LEFT JOIN welfare_transactions wt ON wt.member_id = m.id
GROUP BY m.id, m.name, m.email, m.phone_number, m.status, m.role;

-- To use: SELECT * FROM member_total_welfare;
