# Todo

## Pages To Hide
- `/volunteer` (legacy community recruitment flow)
- `/projects/:projectCode` (legacy public project detail view)

## Dev Notes
```sql
delete from tenant_members
where member_id = (select id from members where lower(email)=lower('tongeche@gmail.com'));
```

- TODO: Implement newsletter unsubscribe flow for the footer signup link.

- TODO: Build a proper document generator pipeline for emitted project docs.
  Current PDF engine is lightweight and single-page style; long sections are truncated to fit.
  Upgrade later to multi-page branded PDFs (or DOCX/PDF server-side via Supabase Edge Function).
- TODO: Add a custom date-range mode (start/end) in project Overview charts for donor/reporting use cases.
- Implemented 2026-02-28: Uploaded phase 1 global organization templates with
  `npm run templates:upload`, and verified the batch updated `public.organization_templates.file_path`
  for `activity-work-plan-template`, `budget-expense-tracker-template`, `cbo-constitution-template`,
  `meeting-minutes-template`, `monthly-financial-report-template`, `procurement-request-template`,
  and `project-presentation-template`.
- TODO: Remove temporary template uploader/staging artifacts after full rollout:
  `scripts/upload-organization-templates.mjs` and local staging files under
  `template-uploads/organization-templates/`.
  
- Implemented full dashboard Notifications page on 2026-02-28 so users can browse
  older inbox items beyond the bell dropdown.
- Implemented phase 3 admin watchlist notifications on 2026-02-28 for pending invites,
  overdue tenant tasks, and meetings waiting for finalized minutes.
- Applied `supabase/migration_035_tenant_admin_policy.sql` via pooler on 2026-02-19.
- Added `supabase/migration_038_tenant_site_templates.sql` for shared tenant website templates.

Fixed 2026-02-28: Organization Settings now uses the tenant-scoped role in the dashboard, so tenant admins/supervisors see the org settings tab correctly on desktop and mobile. The settings shell also waits for tenant context before mounting the organization workspace, which avoids the false "Tenant context is missing" load error while the dashboard is still resolving the active workspace.

Fixed 2026-02-28: The dashboard bell now receives the real tenant id again, so unread counts and the notification panel load correctly instead of always showing "All caught up."

TODO: Prepare the next organization template batch by adding
  `partner-donor-register-template.xlsx` and `member-attendance-register-template.xlsx` to
  `template-uploads/organization-templates/`, then decide whether the deferred
  `monthly-financial-report-template.xlsx` needs its own template key before upload.


//TODO #5
Description: Mobile People page with a darkened overlay. The floating “+” button at the bottom right is highlighted with a soft glow. A centered rounded modal appears with a short title (“Invite new members”), a brief explanation, a primary “Got it” button, a step indicator (1 / 2 with dots), and a “Skip” option. Background content is blurred and inactive.
// Implement first-time user tour on People page.
// - After 2 seconds on initial page load, show onboarding modal.
// - Dim and blur background.
// - Highlight floating "+" button with spotlight effect.
// - Modal should include: title, short description, primary action button, step indicator, and skip option.
// - Persist completion state per user (do not show again after completed or dismissed).
// - Only trigger for admins.
