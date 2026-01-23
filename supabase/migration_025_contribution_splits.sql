-- Migration 025: Contribution split ledger (welfare + lending)

CREATE TABLE IF NOT EXISTS public.contribution_splits (
  id SERIAL PRIMARY KEY,
  contribution_id INTEGER NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES public.members(id),
  cycle_number INTEGER,
  date DATE NOT NULL,
  split_type VARCHAR(32) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contribution_id, split_type)
);

ALTER TABLE public.contribution_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own contribution splits" ON public.contribution_splits;
CREATE POLICY "Members can view own contribution splits" ON public.contribution_splits
FOR SELECT USING (auth.uid() = (SELECT auth_id FROM public.members WHERE id = member_id));

DROP POLICY IF EXISTS "Admins can view all contribution splits" ON public.contribution_splits;
CREATE POLICY "Admins can view all contribution splits" ON public.contribution_splits
FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_contribution_split()
RETURNS TRIGGER AS $$
DECLARE
  welfare_amount NUMERIC(12,2);
  lending_amount NUMERIC(12,2);
BEGIN
  welfare_amount := round(NEW.amount / 6.0, 2);
  lending_amount := round(NEW.amount - welfare_amount, 2);

  INSERT INTO public.contribution_splits
    (contribution_id, member_id, cycle_number, date, split_type, amount)
  VALUES
    (NEW.id, NEW.member_id, NEW.cycle_number, NEW.date, 'lending_contribution', lending_amount),
    (NEW.id, NEW.member_id, NEW.cycle_number, NEW.date, 'welfare_savings', welfare_amount)
  ON CONFLICT (contribution_id, split_type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contribution_split ON public.contributions;
CREATE TRIGGER trg_contribution_split
AFTER INSERT ON public.contributions
FOR EACH ROW
EXECUTE FUNCTION public.handle_contribution_split();

-- Backfill splits for existing contributions (safe to re-run)
INSERT INTO public.contribution_splits
  (contribution_id, member_id, cycle_number, date, split_type, amount)
SELECT
  c.id,
  c.member_id,
  c.cycle_number,
  c.date,
  'lending_contribution',
  round(c.amount - round(c.amount / 6.0, 2), 2)
FROM public.contributions c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contribution_splits s
  WHERE s.contribution_id = c.id AND s.split_type = 'lending_contribution'
);

INSERT INTO public.contribution_splits
  (contribution_id, member_id, cycle_number, date, split_type, amount)
SELECT
  c.id,
  c.member_id,
  c.cycle_number,
  c.date,
  'welfare_savings',
  round(c.amount / 6.0, 2)
FROM public.contributions c
WHERE NOT EXISTS (
  SELECT 1 FROM public.contribution_splits s
  WHERE s.contribution_id = c.id AND s.split_type = 'welfare_savings'
);
