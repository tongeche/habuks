-- Migration 038: Shared tenant website templates

create table if not exists tenant_site_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tenant_site_templates_active_idx
  on tenant_site_templates (is_active);

alter table tenant_site_templates enable row level security;

create policy "Public read active templates"
  on tenant_site_templates
  for select
  to anon, authenticated
  using (is_active = true);

-- Seed shared templates
insert into tenant_site_templates (key, label, description, data)
values
  (
    'minimal-hero-v1',
    'Minimalist Hero',
    'Full-bleed hero image with left-aligned content and CTA.',
    jsonb_build_object(
      'heroTemplate', 'minimal',
      'heroBackgroundImage', '/assets/hero-saas-2.svg',
      'heroHeadline', 'Building power together',
      'heroIntro', jsonb_build_array(
        'We support community-led programs that create sustainable change.'
      ),
      'cta', jsonb_build_array(
        jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#get-involved', 'style', 'primary')
      ),
      'heroSecondaryLink', jsonb_build_object(
        'prefix', 'Already a member?',
        'label', 'Login',
        'href', '/login'
      ),
      'impactStrip', jsonb_build_object(
        'id', 'impact',
        'kicker', 'IMPACTS',
        'title', 'Community impact at a glance',
        'description', 'Key indicators from the work on the ground.',
        'items', jsonb_build_array(
          jsonb_build_object('value', '120+', 'label', 'Members supported'),
          jsonb_build_object('value', '6', 'label', 'Active programs'),
          jsonb_build_object('value', '18', 'label', 'Community leaders trained'),
          jsonb_build_object('value', 'KSh 1.2M', 'label', 'Tracked contributions')
        )
      ),
      'programsSection', jsonb_build_object(
        'id', 'programs',
        'kicker', 'PROGRAMS',
        'title', 'Programs led by the community',
        'description', 'Each program is tailored to local needs and owned by members.',
        'items', jsonb_build_array(
          jsonb_build_object(
            'title', 'Poultry Incubation Initiative',
            'description', 'Incubation, brooding, and poultry sales tracking.',
            'tag', 'Income Activity',
            'status', 'Active',
            'highlights', jsonb_build_array('Incubation capacity', 'Egg production', 'Market sales'),
            'cta', jsonb_build_object('label', 'Learn more', 'href', '#contact')
          ),
          jsonb_build_object(
            'title', 'Groundnut Foods Program',
            'description', 'Value addition through processing and local distribution.',
            'tag', 'Value Addition',
            'status', 'Scaling',
            'highlights', jsonb_build_array('Processing', 'Packaging', 'Market access'),
            'cta', jsonb_build_object('label', 'Explore program', 'href', '#contact')
          )
        )
      ),
      'objectivesSection', jsonb_build_object(
        'id', 'about',
        'kicker', 'ABOUT',
        'title', 'Objectives & goals',
        'description', 'Why we exist and what we are building toward.',
        'objectivesTitle', 'Objectives',
        'goalsTitle', 'Goals',
        'objectives', jsonb_build_array(
          'Build reliable income streams',
          'Strengthen member collaboration',
          'Track progress transparently'
        ),
        'goals', jsonb_build_array(
          'Expand market access',
          'Grow member savings',
          'Scale community enterprises'
        )
      ),
      'testimonialsSection', jsonb_build_object(
        'id', 'testimonials',
        'kicker', 'STORIES',
        'title', 'What members say',
        'description', 'Stories from members and partners.',
        'items', jsonb_build_array(
          jsonb_build_object('quote', 'Habuks keeps our team aligned and accountable.', 'name', 'Mary Akinyi', 'role', 'Project Lead'),
          jsonb_build_object('quote', 'We finally have clarity on contributions and welfare.', 'name', 'John Ochieng', 'role', 'Treasurer')
        )
      ),
      'ctaBanner', jsonb_build_object(
        'id', 'get-involved',
        'kicker', 'GET INVOLVED',
        'title', 'Support the mission',
        'description', 'Partner with us or join a local program.',
        'cta', jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#contact')
      ),
      'contact', jsonb_build_object(
        'id', 'contact',
        'title', 'Contact us',
        'intro', 'Tell us about your organization and how we can collaborate.',
        'kicker', 'CONTACT',
        'panelTitle', 'Ready to collaborate?',
        'panelDescription', 'We respond within two business days.',
        'actions', jsonb_build_array(
          jsonb_build_object('label', 'Email us', 'href', 'mailto:hello@example.com', 'style', 'primary'),
          jsonb_build_object('label', 'Member Login', 'href', '/login', 'style', 'ghost')
        )
      ),
      'tenantNav', jsonb_build_array(
        jsonb_build_object('label', 'Home', 'href', '#top'),
        jsonb_build_object('label', 'About', 'href', '#about'),
        jsonb_build_object('label', 'Programs', 'href', '#programs'),
        jsonb_build_object('label', 'Impacts', 'href', '#impact'),
        jsonb_build_object('label', 'Get involved', 'href', '#get-involved'),
        jsonb_build_object('label', 'Contact us', 'href', '#contact')
      ),
      'tenantCta', jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#get-involved')
    )
  ),
  (
    'classic-hero-v1',
    'Classic Hero',
    'Structured hero with image carousel and supporting panel.',
    jsonb_build_object(
      'heroHeadline', 'Building power together',
      'heroIntro', jsonb_build_array(
        'We support community-led programs that create sustainable change.'
      ),
      'heroImages', jsonb_build_array(
        jsonb_build_object('src', '/assets/hero-saas-1.svg', 'alt', 'Community members working together.')
      ),
      'cta', jsonb_build_array(
        jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#get-involved', 'style', 'primary')
      ),
      'impactStrip', jsonb_build_object(
        'id', 'impact',
        'kicker', 'IMPACTS',
        'title', 'Community impact at a glance',
        'description', 'Key indicators from the work on the ground.',
        'items', jsonb_build_array(
          jsonb_build_object('value', '120+', 'label', 'Members supported'),
          jsonb_build_object('value', '6', 'label', 'Active programs'),
          jsonb_build_object('value', '18', 'label', 'Community leaders trained'),
          jsonb_build_object('value', 'KSh 1.2M', 'label', 'Tracked contributions')
        )
      ),
      'programsSection', jsonb_build_object(
        'id', 'programs',
        'kicker', 'PROGRAMS',
        'title', 'Programs led by the community',
        'description', 'Each program is tailored to local needs and owned by members.',
        'items', jsonb_build_array(
          jsonb_build_object(
            'title', 'Poultry Incubation Initiative',
            'description', 'Incubation, brooding, and poultry sales tracking.',
            'tag', 'Income Activity',
            'status', 'Active',
            'highlights', jsonb_build_array('Incubation capacity', 'Egg production', 'Market sales'),
            'cta', jsonb_build_object('label', 'Learn more', 'href', '#contact')
          )
        )
      ),
      'objectivesSection', jsonb_build_object(
        'id', 'about',
        'kicker', 'ABOUT',
        'title', 'Objectives & goals',
        'description', 'Why we exist and what we are building toward.',
        'objectivesTitle', 'Objectives',
        'goalsTitle', 'Goals',
        'objectives', jsonb_build_array(
          'Build reliable income streams',
          'Strengthen member collaboration',
          'Track progress transparently'
        ),
        'goals', jsonb_build_array(
          'Expand market access',
          'Grow member savings',
          'Scale community enterprises'
        )
      ),
      'testimonialsSection', jsonb_build_object(
        'id', 'testimonials',
        'kicker', 'STORIES',
        'title', 'What members say',
        'description', 'Stories from members and partners.',
        'items', jsonb_build_array(
          jsonb_build_object('quote', 'Habuks keeps our team aligned and accountable.', 'name', 'Mary Akinyi', 'role', 'Project Lead')
        )
      ),
      'ctaBanner', jsonb_build_object(
        'id', 'get-involved',
        'kicker', 'GET INVOLVED',
        'title', 'Support the mission',
        'description', 'Partner with us or join a local program.',
        'cta', jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#contact')
      ),
      'contact', jsonb_build_object(
        'id', 'contact',
        'title', 'Contact us',
        'intro', 'Tell us about your organization and how we can collaborate.',
        'kicker', 'CONTACT',
        'panelTitle', 'Ready to collaborate?',
        'panelDescription', 'We respond within two business days.',
        'actions', jsonb_build_array(
          jsonb_build_object('label', 'Email us', 'href', 'mailto:hello@example.com', 'style', 'primary'),
          jsonb_build_object('label', 'Member Login', 'href', '/login', 'style', 'ghost')
        )
      ),
      'tenantNav', jsonb_build_array(
        jsonb_build_object('label', 'Home', 'href', '#top'),
        jsonb_build_object('label', 'About', 'href', '#about'),
        jsonb_build_object('label', 'Programs', 'href', '#programs'),
        jsonb_build_object('label', 'Impacts', 'href', '#impact'),
        jsonb_build_object('label', 'Get involved', 'href', '#get-involved'),
        jsonb_build_object('label', 'Contact us', 'href', '#contact')
      ),
      'tenantCta', jsonb_build_object('label', 'Donate / Join / Partner', 'href', '#get-involved')
    )
  )
on conflict (key) do update
set label = excluded.label,
    description = excluded.description,
    data = excluded.data,
    is_active = excluded.is_active;
