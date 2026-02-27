# Access Control Enforcement Plan

Status: Draft v1  
Date: 2026-02-27  
System: Habuks multi-tenant dashboard (Supabase + React)

## 1. Purpose

Define and enforce a secure, tenant-aware role model for:

- `member`
- `project_manager`
- `admin`
- `superadmin`

This plan ensures role behavior is consistent across:

- Dashboard navigation and page visibility
- Project tabs (Projects, JPP, JGF)
- API/data service calls
- Supabase RLS and storage policies
- Invite onboarding and membership recovery

## 2. Security Goals

1. Enforce least privilege by default.
2. Prevent cross-tenant data leakage.
3. Prevent UI-only authorization (backend must block unauthorized writes).
4. Ensure invite acceptance reliably creates tenant and project membership.
5. Make every privilege change auditable.

## 3. Threat Model

Primary risks to defend against:

- A user bypasses UI and calls Supabase directly.
- Tenant slug or tenant context mismatch exposes wrong tenant data.
- A member escalates privileges via writable role fields.
- Invite acceptance partially succeeds (account created, membership missing).
- Storage object paths are read/written outside permitted tenant/project paths.

## 4. Role Definitions

### 4.1 member

- Scope: Assigned tenant + assigned/visible projects only.
- Project behavior: Read-only in project tabs.
- No create/edit/delete for project content.

### 4.2 project_manager

- Scope: Assigned tenant, project operations.
- Can create/update project records and project content.
- Cannot perform platform-level superadmin functions.

### 4.3 admin

- Scope: Full management within one tenant.
- Can manage tenant members, project access, tenant settings, and projects.

### 4.4 superadmin

- Scope: Platform-level operations.
- In tenant UI, treated as admin-equivalent.
- Platform-only actions should be isolated behind dedicated admin tooling.

## 5. View and Action Matrix

### 5.1 Navigation/Page Visibility (Tenant Context)

| Capability | member | project_manager | admin | superadmin |
|---|---:|---:|---:|---:|
| Dashboard pages allowed by roleAccess | Yes (restricted) | Yes (project-focused) | Yes | Yes |
| See Projects page | Yes | Yes | Yes | Yes |
| See JPP/JGF module pages | Only if module assigned | Only if module assigned | Yes (if module exists) | Yes (if module exists) |
| Access Admin page | No | No | Yes | Yes |

### 5.2 Projects Tab (Core)

| Action | member | project_manager | admin | superadmin |
|---|---:|---:|---:|---:|
| View accessible projects | Yes | Yes | Yes | Yes |
| Open project details | Yes | Yes | Yes | Yes |
| Create/Edit/Delete project | No | Yes | Yes | Yes |
| Hide/Show project | No | Yes | Yes | Yes |
| Manage project members from project editor | No | Yes | Yes | Yes |

### 5.3 Project Detail Sections (Expenses/Documents/Tasks/Notes)

| Action | member | project_manager | admin | superadmin |
|---|---:|---:|---:|---:|
| Read records | Yes | Yes | Yes | Yes |
| Export data/download docs | Yes | Yes | Yes | Yes |
| Add/Edit/Delete expenses | No | Yes | Yes | Yes |
| Upload/Emit/Rename/Delete documents | No | Yes | Yes | Yes |
| Add/Edit/Delete tasks | No | Yes | Yes | Yes |
| Add/Edit/Delete notes | No | Yes | Yes | Yes |

### 5.4 Organization Membership and Project Assignment

| Action | member | project_manager | admin | superadmin |
|---|---:|---:|---:|---:|
| View own membership | Yes | Yes | Yes | Yes |
| View all tenant members | No | No (unless explicitly granted) | Yes | Yes |
| Change member roles | No | No | Yes | Yes |
| Assign members to projects | No | Optional (tenant policy decision) | Yes | Yes |

## 6. Enforcement Architecture

Authorization must be enforced in all layers below.

### 6.1 Frontend (Visibility and UX)

Rules:

- Use tenant role as the effective role in tenant routes: `tenantRole || user.role`.
- Use centralized role access (`roleAccess.js`) for sidebar/page routing.
- Use local capability flags in pages, for example:
  - `canCreateProject`
  - `canManageProjectContent`
- For member role:
  - Render read-only project tabs.
  - Hide/disable create/edit/delete controls.
  - Keep view/download/export where allowed.

Current implementation direction is correct and should stay:

- `Dashboard.jsx` passes `tenantRole` to `ProjectsPage`, `JppProjectPage`, `JgfProjectPage`.
- Project pages derive capability from `tenantRole`.

### 6.2 Service Layer (dataService)

Rules:

- Every mutating operation must include `tenantId` and `projectId` context where relevant.
- Avoid client-side “trust” checks only; assume calls can be forged.
- Prefer RPCs/functions that enforce role checks server-side for sensitive workflows.
- Ensure list queries are tenant-scoped and membership-scoped.

### 6.3 Supabase RLS (Source of Truth)

Use helper predicates consistently:

- `public.is_tenant_member(tenant_id)`
- `public.is_tenant_admin(tenant_id)`
- `public.can_access_iga_project(project_id)`
- `public.can_manage_iga_project(project_id)`

Policy baseline:

1. All project data tables: `SELECT` requires `can_access_iga_project(project_id)`.
2. All project mutations: `INSERT/UPDATE/DELETE` require `can_manage_iga_project(project_id)`.
3. `WITH CHECK` clauses must mirror `USING` for mutations.
4. `tenant_members`:
   - self-read policy
   - tenant admin read policy
   - tenant admin manage policy
5. Storage policies:
   - object path must map to tenant/project scope
   - manage permissions require project manage predicate
   - read permissions require project access predicate

### 6.4 Invite Flow Integrity

Required invariant:

- Invite acceptance must atomically produce a valid active tenant membership and project assignment (if invite scope includes projects).

Flow requirements:

1. Verify invite is pending/sent, unexpired, and email-bound.
2. Upsert `tenant_members` active membership.
3. Apply project scope via `apply_magic_link_invite_project_access`.
4. Mark invite accepted with actor and timestamp.
5. Make operation idempotent (safe retry).
6. If partial failure occurs, run recovery function and return actionable status.

## 7. Implementation Plan (Phased)

### Phase 1: Role Baseline and Capability Contract

- Finalize role matrix (this document as source of truth).
- Freeze effective role rule: tenant context role always wins.
- Add role constants shared across UI and service layer.

### Phase 2: RLS Hardening

- Audit all project-related tables and verify they use project access/manage helpers.
- Add missing admin/member policies where needed.
- Add regression SQL checks for unauthorized writes and cross-tenant reads.
- Validate storage bucket policies for tenant/project path enforcement.

### Phase 3: Invite and Membership Reliability

- Validate invite verification and assignment functions.
- Add a post-login membership repair pass for invited users when needed.
- Ensure “Get Started” is skipped when active tenant membership exists.

### Phase 4: UI Consistency by Role

- Keep member project views read-only across Projects/JPP/JGF.
- Keep project_manager/admin/superadmin edit controls enabled.
- Add clear read-only badge or hint where actions are hidden.

### Phase 5: Auditing and Monitoring

- Audit events for:
  - role changes
  - tenant membership changes
  - project assignment changes
  - invite acceptance/recovery
- Add alerting for repeated authorization denials and invite recovery failures.

### Phase 6: Test Coverage and Release

- Role-based E2E tests by tenant context:
  - member cannot mutate project content
  - project_manager can mutate only allowed scopes
  - admin manages tenant membership and project assignment
- SQL policy tests for negative and cross-tenant scenarios.
- Staged rollout with feature flag if needed.

## 8. Migration and Ticket Checklist

Suggested work items:

1. RLS audit script for all project tables and storage policies.
2. Migration for any missing `can_access`/`can_manage` policy alignment.
3. Migration for tenant-admin manage policies on `tenant_members` if gaps remain.
4. Invite acceptance transaction hardening and idempotency checks.
5. UI read-only indicators for member role in project tabs.
6. E2E role matrix test suite.

## 9. Definition of Done

This effort is complete when:

1. A member cannot create/update/delete any project content, even with direct API calls.
2. A project_manager/admin/superadmin can perform allowed mutations within tenant scope.
3. Tenant admins can reliably view and manage tenant members and project assignment.
4. Invited members land directly in the invited tenant and see assigned projects.
5. Authorization failures are logged and test-covered.

## 10. Non-Negotiable Security Invariants

1. UI hiding alone is never considered authorization.
2. Every sensitive write path must be protected by RLS predicate checks.
3. Every read query must be tenant-scoped.
4. Superadmin behavior in tenant UI must not bypass tenant scoping unintentionally.
5. Role and assignment changes must be auditable.
