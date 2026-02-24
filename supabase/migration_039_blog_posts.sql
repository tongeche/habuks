-- Migration 039: Blog Posts System
-- A proper blog/content management system with RLS policies

-- Drop the old blogs table if it exists and recreate with better structure
-- (keeping backward compatibility by checking first)

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#0f766e', -- For UI badge colors
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT, -- Markdown content
  category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  featured_image TEXT, -- URL to image in Supabase Storage
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT, -- Denormalized for display
  author_avatar TEXT,
  author_role TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  read_time_minutes INTEGER DEFAULT 5,
  meta_title TEXT, -- SEO
  meta_description TEXT, -- SEO
  tags TEXT[] DEFAULT '{}',
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts(category_id);
CREATE INDEX IF NOT EXISTS blog_posts_featured_idx ON blog_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS blog_posts_tags_idx ON blog_posts USING GIN(tags);

-- Enable RLS
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blog_categories
-- Anyone can read categories
CREATE POLICY "Public can read categories"
  ON blog_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only authenticated admins can manage categories
CREATE POLICY "Admins can manage categories"
  ON blog_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for blog_posts
-- Anyone can read published posts
CREATE POLICY "Public can read published posts"
  ON blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Admins can read all posts (including drafts)
CREATE POLICY "Admins can read all posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Admins can create/update/delete posts
CREATE POLICY "Admins can manage posts"
  ON blog_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS blog_posts_updated_at ON blog_posts;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_post_timestamp();

-- Function to increment view count (callable from client)
CREATE OR REPLACE FUNCTION increment_blog_view(post_slug TEXT)
RETURNS void AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE slug = post_slug AND is_published = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_blog_view(TEXT) TO anon, authenticated;

-- Seed default categories
INSERT INTO blog_categories (name, slug, description, color, sort_order) VALUES
  ('Product Updates', 'product', 'New features and improvements', '#3b82f6', 1),
  ('Community Stories', 'community', 'Success stories from our users', '#10b981', 2),
  ('Tips & Guides', 'tips', 'How-to articles and best practices', '#f59e0b', 3),
  ('Company News', 'news', 'Announcements and company updates', '#8b5cf6', 4)
ON CONFLICT (slug) DO NOTHING;

-- Seed sample blog posts
INSERT INTO blog_posts (
  slug, title, excerpt, content, category_id, 
  featured_image, author_name, author_avatar, author_role,
  is_featured, is_published, published_at, read_time_minutes
) VALUES
(
  'project-management-module',
  'Introducing the New Project Management Module',
  'Streamline your community projects with our powerful new tools. Track milestones, assign tasks, and monitor budgets all in one place.',
  '# Introducing the New Project Management Module

We''re excited to announce the launch of our most requested feature: the **Project Management Module**. This powerful addition to Habuks helps community groups plan, execute, and track their projects with unprecedented clarity.

## Why We Built This

Community groups don''t just save money—they invest it. Whether it''s buying land, starting a business, or funding community initiatives, groups need tools to manage these projects effectively.

## Key Features

### 1. Project Dashboard
Get a bird''s eye view of all your group''s projects with budget utilization and upcoming deadlines.

### 2. Milestone Tracking
Break down projects into manageable milestones with target dates and completion tracking.

### 3. Task Assignment
Assign responsibilities to members with due dates and automatic reminders.

### 4. Budget Management
Keep finances on track with real-time expense tracking and planned vs. actual spending reports.

---

*Ready to streamline your group''s projects? [Start your free trial](/get-started) today.*',
  (SELECT id FROM blog_categories WHERE slug = 'product'),
  '/assets/blog-featured.jpg',
  'Sarah Kimani',
  '/assets/avatar-1.webp',
  'Product Lead',
  true,
  true,
  now() - interval '3 days',
  5
),
(
  'mwangaza-success-story',
  'How Mwangaza Group Increased Savings by 40%',
  'Discover how this Nairobi-based chama transformed their financial management using Habuks.',
  '# How Mwangaza Group Transformed Their Financial Management

When Mary Wanjiru first joined Mwangaza Investment Group in 2023, the group was struggling with inconsistent contributions and a lack of transparency.

## The Challenge

Like many community savings groups across Kenya, Mwangaza faced common challenges:
- Manual record-keeping that led to errors
- Difficulty tracking who had paid and who hadn''t
- No clear visibility into the group''s total savings

## The Results

After six months of using Habuks, Mwangaza saw remarkable improvements:
- **40% increase in savings** due to automated reminders
- **100% contribution compliance** for three consecutive months
- **Zero disputes** about financial records

---

*Interested in transforming your group''s financial management? [Get started with Habuks today](/get-started).*',
  (SELECT id FROM blog_categories WHERE slug = 'community'),
  '/assets/blog-1.jpg',
  'James Ochieng',
  '/assets/avatar-2.webp',
  NULL,
  false,
  true,
  now() - interval '5 days',
  4
),
(
  'contribution-best-practices',
  '5 Best Practices for Managing Group Contributions',
  'Learn proven strategies to ensure consistent contributions and build trust within your group.',
  '# 5 Best Practices for Managing Group Contributions

Managing contributions in a community savings group can be challenging. Here are five proven strategies that successful groups use.

## 1. Set Clear Expectations from Day One

Define the contribution amount, payment schedule, and penalties before your first collection.

## 2. Use Automated Reminders

Don''t rely on manual follow-ups. Automated systems ensure no one forgets.

## 3. Offer Multiple Payment Options

The easier you make it to pay, the more likely members will contribute on time.

## 4. Maintain Transparent Records

Every contribution should be recorded immediately and visible to all members.

## 5. Celebrate Consistency

Recognize members with perfect attendance and mark milestone celebrations.

---

*Ready to implement these best practices? [Try Habuks free for 30 days](/get-started).*',
  (SELECT id FROM blog_categories WHERE slug = 'tips'),
  '/assets/blog-2.jpg',
  'Grace Wanjiku',
  '/assets/avatar-3.webp',
  NULL,
  false,
  true,
  now() - interval '8 days',
  6
),
(
  'android-app-launch',
  'Mobile App: Now Available for Android',
  'Access your group''s financial data on the go with our brand new Android application.',
  '# Mobile App: Now Available for Android

We''re thrilled to announce that Habuks is now available on Android devices!

## Why Mobile Matters

Our data shows that **78% of our users** access Habuks from mobile devices.

## What''s New in the App

### Instant Notifications
Never miss contribution reminders, payment confirmations, or group announcements.

### Offline Access
Check your records even without internet—view contribution history, access contacts, and more.

### Faster Performance
Quick loading times, smooth animations, and low data usage.

## How to Download

1. Open the Google Play Store
2. Search for "Habuks"
3. Tap "Install"
4. Sign in with your existing account

---

*Download the Habuks Android app today and take your group finances with you wherever you go.*',
  (SELECT id FROM blog_categories WHERE slug = 'product'),
  '/assets/blog-3.jpg',
  'Sarah Kimani',
  '/assets/avatar-1.webp',
  'Product Lead',
  false,
  true,
  now() - interval '13 days',
  3
)
ON CONFLICT (slug) DO NOTHING;

-- Create a view for easy querying with category info
CREATE OR REPLACE VIEW blog_posts_with_category AS
SELECT 
  bp.*,
  bc.name as category_name,
  bc.slug as category_slug,
  bc.color as category_color
FROM blog_posts bp
LEFT JOIN blog_categories bc ON bp.category_id = bc.id;

-- Grant access to the view
GRANT SELECT ON blog_posts_with_category TO anon, authenticated;

COMMENT ON TABLE blog_posts IS 'Blog posts for the Habuks website';
COMMENT ON TABLE blog_categories IS 'Categories for organizing blog posts';
