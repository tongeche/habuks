-- Migration 040: Newsletter Subscribers
-- A table to store newsletter email subscriptions

-- Newsletter Subscribers Table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'blog', -- Where they signed up from (blog, landing, footer, etc.)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS newsletter_email_idx ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS newsletter_status_idx ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS newsletter_source_idx ON newsletter_subscribers(source);

-- Enable RLS
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe (insert)
CREATE POLICY "Anyone can subscribe"
  ON newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can view subscribers
CREATE POLICY "Admins can view subscribers"
  ON newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.email = auth.jwt() ->> 'email'
      AND members.role IN ('super_admin', 'admin')
    )
  );

-- Only admins can manage subscribers
CREATE POLICY "Admins can manage subscribers"
  ON newsletter_subscribers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.email = auth.jwt() ->> 'email'
      AND members.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete subscribers"
  ON newsletter_subscribers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE members.email = auth.jwt() ->> 'email'
      AND members.role IN ('super_admin', 'admin')
    )
  );

COMMENT ON TABLE newsletter_subscribers IS 'Email subscribers for newsletters and updates';
