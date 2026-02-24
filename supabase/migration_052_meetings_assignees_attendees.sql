-- Migration 052: Separate assignees and attendees in meetings table
-- Rename attendees to assignees (responsible members)
-- Add new attendees field for event attendees (members or subscribers)

-- Add new columns
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS assignees INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attendees_data JSONB DEFAULT '[]';

-- Migrate existing attendees to assignees
UPDATE public.meetings
SET assignees = attendees
WHERE attendees IS NOT NULL AND attendees != '{}';

-- Drop the old attendees column
ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS attendees;

-- Create index for assignees
CREATE INDEX IF NOT EXISTS meetings_assignees_idx ON public.meetings USING GIN(assignees);

-- Add comment
COMMENT ON COLUMN public.meetings.assignees IS 'Array of member IDs responsible for the activity';
COMMENT ON COLUMN public.meetings.attendees_data IS 'JSON array of attendees: {type: "member"|"subscriber", id: integer}';

