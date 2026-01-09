-- Migration 007: Add status column to welfare_transactions
-- Required for the new transactions table UI

-- Add status column
ALTER TABLE public.welfare_transactions
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Completed';

-- Update existing records to have 'Completed' status
UPDATE public.welfare_transactions
SET status = 'Completed'
WHERE status IS NULL;

-- Add constraint for valid statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'welfare_transactions_status_check'
      AND conrelid = 'public.welfare_transactions'::regclass
  ) THEN
    ALTER TABLE public.welfare_transactions
    ADD CONSTRAINT welfare_transactions_status_check
    CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled'));
  END IF;
END $$;

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_welfare_transactions_status
ON public.welfare_transactions(status);

-- Optional: Create a view for easier querying with member names
CREATE OR REPLACE VIEW public.welfare_transactions_view AS
SELECT 
  wt.id,
  wt.cycle_id,
  wt.member_id,
  m.name AS recipient,
  wt.date AS date_of_issue,
  wt.amount,
  wt.status,
  wt.transaction_type,
  wt.description
FROM public.welfare_transactions wt
LEFT JOIN public.members m ON wt.member_id = m.id
ORDER BY wt.date DESC;

COMMENT ON VIEW public.welfare_transactions_view IS 'Welfare transactions with recipient names for UI display';
