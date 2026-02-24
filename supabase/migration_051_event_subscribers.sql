-- Migration 051: Event Subscribers Enhancement
-- Extend newsletter_subscribers table to support event attendees (non-members) for activities/meetings

-- Add missing columns to newsletter_subscribers if they don't exist
ALTER TABLE IF EXISTS public.newsletter_subscribers
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS contact TEXT,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'newsletter' CHECK (type IN ('event_attendee', 'newsletter', 'other')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS newsletter_subscribers_tenant_idx ON public.newsletter_subscribers(tenant_id);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_tenant_type_idx ON public.newsletter_subscribers(tenant_id, type);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_tenant_email_idx ON public.newsletter_subscribers(tenant_id, email);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.touch_newsletter_subscribers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_newsletter_subscribers_touch_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER trg_newsletter_subscribers_touch_updated_at
BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.touch_newsletter_subscribers_updated_at();

COMMENT ON COLUMN public.newsletter_subscribers.type IS 'Type of subscriber: event_attendee, newsletter, or other';
COMMENT ON COLUMN public.newsletter_subscribers.tenant_id IS 'Tenant ID for multi-tenant support';

