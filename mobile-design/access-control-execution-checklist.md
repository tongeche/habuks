# Access Control Execution Checklist

Status: Ready for implementation  
Date: 2026-02-27  
Related strategy: [access-control-enforcement-plan.md](/home/tim/Projects/habuks/habuks/access-control-enforcement-plan.md)

## Scope

This checklist converts the enforcement strategy into executable phases, tickets, SQL migrations, and verification steps.

## Migrations Created

1. [migration_061_tenant_scoped_project_access_helpers.sql](/home/tim/Projects/habuks/habuks/supabase/migration_061_tenant_scoped_project_access_helpers.sql)
2. [migration_062_project_tables_rls_hardening.sql](/home/tim/Projects/habuks/habuks/supabase/migration_062_project_tables_rls_hardening.sql)
3. [migration_063_project_docs_storage_rls_hardening.sql](/home/tim/Projects/habuks/habuks/supabase/migration_063_project_docs_storage_rls_hardening.sql)
4. [migration_064_tenant_admin_manage_tenant_members.sql](/home/tim/Projects/habuks/habuks/supabase/migration_064_tenant_admin_manage_tenant_members.sql)
5. [migration_065_legacy_module_tenant_rls_hardening.sql](/home/tim/Projects/habuks/habuks/supabase/migration_065_legacy_module_tenant_rls_hardening.sql)
6. [migration_066_fix_legacy_module_tenant_policy_binding.sql](/home/tim/Projects/habuks/habuks/supabase/migration_066_fix_legacy_module_tenant_policy_binding.sql)

## Deployment Order

1. `061` helper functions
2. `062` project table RLS hardening
3. `063` storage policy hardening
4. `064` tenant member management policies
5. `065` legacy module tenant-only RLS hardening
6. `066` legacy module tenant policy binding fix

## Phase 1: Role Baseline

Ticket `AC-001`  
Title: Lock DB helper functions to tenant-aware roles  
Artifact: `migration_061_tenant_scoped_project_access_helpers.sql`  
Acceptance criteria:

- `can_access_iga_project(project_id)` allows read for active tenant members and assigned project users.
- `can_manage_iga_project(project_id)` allows writes only for tenant `admin/superadmin/project_manager`, project leader, or platform admin/superadmin.
- `is_tenant_admin(tenant_id)` requires active membership.

Ticket `AC-002`  
Title: Keep frontend effective role contract  
Artifact: [ProjectsPage.jsx](/home/tim/Projects/habuks/habuks/src/components/dashboard/ProjectsPage.jsx), [JppProjectPage.jsx](/home/tim/Projects/habuks/habuks/src/components/dashboard/JppProjectPage.jsx), [JgfProjectPage.jsx](/home/tim/Projects/habuks/habuks/src/components/dashboard/JgfProjectPage.jsx)  
Acceptance criteria:

- Tenant role (`tenantRole`) is used as primary authority in project tabs.
- Members are read-only in project content sections.
- UI actions map to backend policy outcomes (no false positive controls).

## Phase 2: Project Data RLS Hardening

Ticket `AC-003`  
Title: Remove permissive/legacy project table policies  
Artifact: `migration_062_project_tables_rls_hardening.sql`  
Acceptance criteria:

- All listed project/module tables enforce:
  - read: `can_access_iga_project(project_id)`
  - write: `can_manage_iga_project(project_id)`
- Legacy policies with `USING (true)` are removed.
- `project_notes.visibility = 'admins_only'` is hidden from read-only members.

Ticket `AC-004`  
Title: Regression checks for member write denial  
Artifact: SQL verification script (create in CI or `scripts/`)  
Acceptance criteria:

- Member cannot `insert/update/delete` on project tables via direct API/SQL context.
- Project manager/admin can mutate only in authorized tenant/project scope.

## Phase 3: Storage Security

Ticket `AC-005`  
Title: Enforce path-aware storage access  
Artifact: `migration_063_project_docs_storage_rls_hardening.sql`  
Acceptance criteria:

- Storage read validates `tenants/{tenantId}/projects/{projectId}/...` and project access.
- Storage write/delete validates project manage permission.
- Member can download allowed files but cannot upload/replace/delete without manage rights.

Ticket `AC-006`  
Title: Add storage abuse checks  
Artifact: Security test cases  
Acceptance criteria:

- Cross-tenant path access is denied.
- Invalid path patterns are denied.
- Upload to existing tenant but unauthorized project is denied.

## Phase 4: Tenant Admin Operations

Ticket `AC-007`  
Title: Enable tenant-admin membership management  
Artifact: `migration_064_tenant_admin_manage_tenant_members.sql`  
Acceptance criteria:

- Tenant admins can insert/update/delete tenant membership rows for their tenant.
- Non-admin members cannot manage tenant memberships.
- Existing bootstrap join flow still works for first admin creation.

Ticket `AC-008`  
Title: Add app flows for post-invite project assignment management  
Artifact: Organization settings/member management UI  
Acceptance criteria:

- Admin can assign/remove project access after invite acceptance.
- Changes are reflected immediately in member project visibility.

## Phase 5: Invite Reliability and Auditability

Ticket `AC-009`  
Title: Enforce invite acceptance invariants  
Artifact: Existing invite migrations + app flow (`057`, `058`)  
Acceptance criteria:

- Invite acceptance produces active tenant membership + scoped project membership.
- Recovery path handles partial failures safely and idempotently.
- Invited users bypass workspace creation flow when membership exists.

Ticket `AC-010`  
Title: Add security audit events  
Artifact: Audit log entries/events  
Acceptance criteria:

- Log role changes, tenant membership changes, project assignment changes, invite acceptance/recovery.
- Include actor, tenant, target record, action, timestamp.

## Phase 6: Validation and Release

Ticket `AC-011`  
Title: Role matrix E2E test suite  
Artifact: Automated tests  
Acceptance criteria:

- `member`: read-only in all project tabs.
- `project_manager`: can mutate project content within tenant scope.
- `admin/superadmin`: full tenant project management.

Ticket `AC-012`  
Title: Staged rollout + rollback plan  
Artifact: Release runbook  
Acceptance criteria:

- Migrations applied in non-prod first with test pass.
- Production rollout has pre/post checks and rollback steps.

## SQL Apply Commands

Use your deployment method, or direct `psql` sequence:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migration_061_tenant_scoped_project_access_helpers.sql
psql "$SUPABASE_DB_URL" -f supabase/migration_062_project_tables_rls_hardening.sql
psql "$SUPABASE_DB_URL" -f supabase/migration_063_project_docs_storage_rls_hardening.sql
psql "$SUPABASE_DB_URL" -f supabase/migration_064_tenant_admin_manage_tenant_members.sql
psql "$SUPABASE_DB_URL" -f supabase/migration_065_legacy_module_tenant_rls_hardening.sql
psql "$SUPABASE_DB_URL" -f supabase/migration_066_fix_legacy_module_tenant_policy_binding.sql
```

## Post-Deploy Verification (Minimum)

1. Member user:
   - Can open assigned projects.
   - Cannot create/edit/delete expenses/tasks/notes/documents.
2. Project manager user:
   - Can create/edit/delete project content within tenant.
3. Tenant admin user:
   - Can manage tenant member rows and project assignments.
4. Storage:
   - Unauthorized upload/delete in `project-docs` denied.
   - Authorized read/download works.
