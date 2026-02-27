import { useCallback, useEffect, useMemo, useState } from "react";
import DataModal from "./DataModal.jsx";
import ResponseModal from "./ResponseModal.jsx";
import { Icon } from "../icons.jsx";
import {
  createMagicLinkInvite,
  getMembersAdmin,
  getProjectMemberAssignmentsSummary,
  getProjects,
  getTenantMagicLinkInvites,
} from "../../lib/dataService.js";

const createInviteForm = () => ({
  name: "",
  email: "",
  phone_number: "",
  role: "member",
  notes: "",
  project_access_scope: "selected",
  project_ids: [],
});

const normalizeInviteProjectScope = (scope) => {
  const normalized = String(scope || "").trim().toLowerCase();
  if (normalized === "all" || normalized === "selected" || normalized === "none") {
    return normalized;
  }
  return "none";
};

const normalizeInviteProjectIds = (projectIds) => {
  if (!Array.isArray(projectIds)) {
    return [];
  }
  return Array.from(
    new Set(
      projectIds
        .map((projectId) => Number.parseInt(String(projectId || ""), 10))
        .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
    )
  );
};

const isInviteAdminRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "superadmin";
};

const normalizeRoleKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const formatDate = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "-";
  return new Date(timestamp).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const toLabel = (value, fallback = "-") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const buildCsvValue = (value) => {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

export default function MembersPage({ tenantInfo, tenantId, user, tenantRole, setActivePage }) {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectAssignments, setProjectAssignments] = useState([]);
  const [inviteRows, setInviteRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [inviteForm, setInviteForm] = useState(() => createInviteForm());
  const [responseData, setResponseData] = useState({
    type: "success",
    title: "",
    message: "",
    code: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const effectiveTenantId = tenantId || tenantInfo?.id || null;
  const roleKey = normalizeRoleKey(tenantRole || user?.role || "member");
  const isAdmin = ["admin", "superadmin", "super_admin"].includes(roleKey);
  const canManagePeople =
    isAdmin ||
    ["project_manager", "coordinator", "project_coordinator", "cordinator", "supervisor"].includes(
      roleKey
    );
  const canInviteMember = isAdmin;

  const loadPeopleData = useCallback(async () => {
    if (!effectiveTenantId) {
      setMembers([]);
      setProjects([]);
      setProjectAssignments([]);
      setInviteRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [membersResult, projectsResult, assignmentsResult, invitesResult] = await Promise.allSettled([
        getMembersAdmin(effectiveTenantId),
        getProjects(effectiveTenantId),
        getProjectMemberAssignmentsSummary(effectiveTenantId),
        canInviteMember ? getTenantMagicLinkInvites(effectiveTenantId, { limit: 50 }) : Promise.resolve([]),
      ]);

      const loadErrors = [];

      if (membersResult.status === "fulfilled") {
        setMembers(Array.isArray(membersResult.value) ? membersResult.value : []);
      } else {
        setMembers([]);
        loadErrors.push("members");
        console.error("People page: failed to load members", membersResult.reason);
      }

      if (projectsResult.status === "fulfilled") {
        setProjects(Array.isArray(projectsResult.value) ? projectsResult.value : []);
      } else {
        setProjects([]);
        loadErrors.push("projects");
        console.error("People page: failed to load projects", projectsResult.reason);
      }

      if (assignmentsResult.status === "fulfilled") {
        setProjectAssignments(Array.isArray(assignmentsResult.value) ? assignmentsResult.value : []);
      } else {
        setProjectAssignments([]);
        loadErrors.push("project assignments");
        console.error("People page: failed to load project assignments", assignmentsResult.reason);
      }

      if (invitesResult.status === "fulfilled") {
        setInviteRows(Array.isArray(invitesResult.value) ? invitesResult.value : []);
      } else {
        setInviteRows([]);
        if (canInviteMember) {
          loadErrors.push("invites");
          console.error("People page: failed to load invites", invitesResult.reason);
        }
      }

      if (loadErrors.length) {
        setError(`Some data could not be loaded (${loadErrors.join(", ")}).`);
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId, canInviteMember]);

  useEffect(() => {
    loadPeopleData();
  }, [loadPeopleData]);

  const projectSummaryByMemberId = useMemo(() => {
    const summaryMap = new Map();
    projectAssignments.forEach((assignment) => {
      const memberId = Number.parseInt(String(assignment?.member_id || ""), 10);
      if (!Number.isInteger(memberId) || memberId <= 0) return;
      const current =
        summaryMap.get(memberId) ||
        {
          count: 0,
          projectNames: new Set(),
        };
      current.count += 1;
      const projectName = String(assignment?.project_name || "").trim();
      if (projectName) {
        current.projectNames.add(projectName);
      }
      summaryMap.set(memberId, current);
    });
    return summaryMap;
  }, [projectAssignments]);

  const filteredMembers = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const haystack = [
        member?.name,
        member?.email,
        member?.phone_number,
        member?.role,
        member?.status,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [members, searchQuery]);

  const stats = useMemo(() => {
    const activeCount = members.filter(
      (member) => String(member?.status || "active").trim().toLowerCase() === "active"
    ).length;
    const withoutProjectsCount = members.filter((member) => {
      const memberId = Number.parseInt(String(member?.id || ""), 10);
      if (!Number.isInteger(memberId) || memberId <= 0) return true;
      const summary = projectSummaryByMemberId.get(memberId);
      return !summary || summary.count === 0;
    }).length;
    const pendingInviteCount = inviteRows.filter((invite) => {
      const status = String(invite?.status || "pending").trim().toLowerCase();
      return status === "pending" || status === "sent";
    }).length;
    return {
      total: members.length,
      active: activeCount,
      withoutProjects: withoutProjectsCount,
      pendingInvites: pendingInviteCount,
      projects: projects.length,
    };
  }, [members, inviteRows, projectSummaryByMemberId, projects.length]);

  const pendingInvites = useMemo(
    () =>
      inviteRows
        .filter((invite) => {
          const status = String(invite?.status || "pending").trim().toLowerCase();
          return status === "pending" || status === "sent";
        })
        .slice(0, 6),
    [inviteRows]
  );

  const handleExportCsv = () => {
    if (!filteredMembers.length) {
      setNotice("No visible members to export.");
      return;
    }

    const header = ["Name", "Org role", "Status", "Projects", "Email", "Phone", "Joined"];
    const rows = filteredMembers.map((member) => {
      const memberId = Number.parseInt(String(member?.id || ""), 10);
      const projectSummary = projectSummaryByMemberId.get(memberId) || null;
      const projectCount = projectSummary?.count || 0;
      return [
        member?.name || "",
        toLabel(member?.role, "Member"),
        toLabel(member?.status, "Active"),
        projectCount,
        member?.email || "",
        member?.phone_number || "",
        formatDate(member?.join_date),
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((value) => buildCsvValue(value)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${String(tenantInfo?.slug || "people").replace(/[^a-z0-9-]+/gi, "-")}-people-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setNotice("Export complete.");
  };

  const handleInviteFormChange = (field, value) => {
    setInviteForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role") {
        if (isInviteAdminRole(value)) {
          next.project_access_scope = "all";
          next.project_ids = [];
        } else {
          const currentScope = normalizeInviteProjectScope(prev.project_access_scope);
          next.project_access_scope = currentScope === "all" ? "selected" : currentScope;
        }
      }
      if (field === "project_access_scope") {
        const normalizedScope = normalizeInviteProjectScope(value);
        next.project_access_scope = normalizedScope;
        if (normalizedScope !== "selected") {
          next.project_ids = [];
        }
      }
      return next;
    });
  };

  const handleInviteProjectToggle = (projectId) => {
    const parsedProjectId = Number.parseInt(String(projectId || ""), 10);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
      return;
    }
    setInviteForm((prev) => {
      const current = normalizeInviteProjectIds(prev.project_ids);
      const hasProject = current.includes(parsedProjectId);
      return {
        ...prev,
        project_ids: hasProject
          ? current.filter((id) => id !== parsedProjectId)
          : [...current, parsedProjectId],
      };
    });
  };

  const handleInviteSubmit = async (event) => {
    event.preventDefault();
    if (!canInviteMember) {
      setResponseData({
        type: "error",
        title: "Not allowed",
        message: "Only workspace admins can send organization-level invites.",
        code: null,
      });
      setShowResponseModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!inviteForm.email.trim()) {
        throw new Error("Please enter an email address for the member.");
      }
      if (!effectiveTenantId) {
        throw new Error("Workspace context is missing.");
      }

      const role = String(inviteForm.role || "member").trim().toLowerCase();
      const adminInvite = isInviteAdminRole(role);
      const projectAccessScope = adminInvite
        ? "all"
        : normalizeInviteProjectScope(inviteForm.project_access_scope || "selected");
      const selectedProjectIds =
        projectAccessScope === "selected"
          ? normalizeInviteProjectIds(inviteForm.project_ids)
          : [];

      if (!adminInvite && projectAccessScope === "selected" && projects.length > 0 && selectedProjectIds.length === 0) {
        throw new Error("Select at least one project or choose a different project access scope.");
      }

      const payload = {
        email: inviteForm.email,
        phone_number: inviteForm.phone_number || null,
        role: role || "member",
        notes: inviteForm.notes || null,
        tenant_id: effectiveTenantId,
        project_access_scope: projectAccessScope,
        project_ids: selectedProjectIds,
      };

      const result = await createMagicLinkInvite(payload);
      setResponseData({
        type: "success",
        title: "Invite Created",
        message: `Share this invite number with ${inviteForm.email}. They can join at /register (or /join).`,
        code: result?.inviteNumber,
      });
      setShowResponseModal(true);
      setInviteForm(createInviteForm());
      setShowInviteModal(false);

      try {
        const refreshed = await getTenantMagicLinkInvites(effectiveTenantId, { limit: 50 });
        setInviteRows(Array.isArray(refreshed) ? refreshed : []);
      } catch (refreshError) {
        console.error("People page: failed to refresh invites", refreshError);
      }
    } catch (submitError) {
      setResponseData({
        type: "error",
        title: "Failed to Create Invite",
        message: submitError?.message || "Something went wrong. Please try again.",
        code: null,
      });
      setShowResponseModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inviteRoleIsAdmin = isInviteAdminRole(inviteForm.role);
  const inviteProjectScope = inviteRoleIsAdmin
    ? "all"
    : normalizeInviteProjectScope(inviteForm.project_access_scope);
  const inviteProjectIds = normalizeInviteProjectIds(inviteForm.project_ids);

  return (
    <div className="members-shell">
      <section className="members-shell-card">
        <header className="members-shell-header">
          <div>
            <h2>People</h2>
            <p>
              Organization directory and project assignment coverage. Member editing is centralized here to avoid
              duplication across settings and project tabs.
            </p>
          </div>
          <div className="members-shell-actions">
            <button
              type="button"
              className="members-shell-btn members-shell-btn--ghost"
              onClick={() => setActivePage?.("settings")}
            >
              My settings
            </button>
            <button
              type="button"
              className="members-shell-btn members-shell-btn--ghost"
              onClick={handleExportCsv}
              disabled={loading || !filteredMembers.length}
            >
              Export
            </button>
            {canInviteMember ? (
              <button
                type="button"
                className="members-shell-btn members-shell-btn--primary"
                onClick={() => setShowInviteModal(true)}
                disabled={!effectiveTenantId}
              >
                Invite member
              </button>
            ) : null}
          </div>
        </header>

        {notice ? <p className="projects-notice projects-notice--success">{notice}</p> : null}
        {error ? <p className="projects-notice projects-notice--warning">{error}</p> : null}
        {!canManagePeople ? (
          <p className="projects-notice projects-notice--warning">
            You are in read-only mode. Admins manage organization members; project roles are managed inside project tabs.
          </p>
        ) : null}

        <div className="members-shell-kpis">
          <article className="members-shell-kpi">
            <span>Total members</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="members-shell-kpi">
            <span>Active</span>
            <strong>{stats.active}</strong>
          </article>
          <article className="members-shell-kpi">
            <span>Without project</span>
            <strong>{stats.withoutProjects}</strong>
          </article>
          <article className="members-shell-kpi">
            <span>Pending invites</span>
            <strong>{canInviteMember ? stats.pendingInvites : "-"}</strong>
          </article>
        </div>

        <div className="members-shell-grid">
          <article className="members-shell-panel members-shell-panel--table">
            <div className="members-shell-panel-header">
              <h3>Organization directory</h3>
              <span className="members-shell-chip">{filteredMembers.length} shown</span>
            </div>

            <label className="members-shell-search-live">
              <Icon name="search" size={15} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, role, email, phone"
              />
            </label>

            <div className="members-shell-table-head members-shell-table-head--live">
              <span>Name</span>
              <span>Org role</span>
              <span>Status</span>
              <span>Projects</span>
              <span>Contact</span>
            </div>

            <div className="members-shell-table-body">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div className="members-shell-row" key={`members-loading-${index}`}>
                    <span className="members-shell-line members-shell-line--name" />
                    <span className="members-shell-line members-shell-line--role" />
                    <span className="members-shell-line members-shell-line--status" />
                  </div>
                ))
              ) : filteredMembers.length ? (
                filteredMembers.map((member) => {
                  const memberId = Number.parseInt(String(member?.id || ""), 10);
                  const summary = projectSummaryByMemberId.get(memberId) || null;
                  const projectNames = summary ? Array.from(summary.projectNames) : [];
                  const projectCount = summary?.count || 0;
                  const safeStatus = String(member?.status || "active")
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9_]+/g, "_");
                  return (
                    <div className="members-shell-row members-shell-row--live" key={`member-${member?.id || member?.email}`}>
                      <div className="members-shell-cell-main">
                        <strong>{member?.name || `Member #${member?.id || "-"}`}</strong>
                        <small>Joined {formatDate(member?.join_date)}</small>
                      </div>
                      <div>
                        <span className="members-shell-pill">{toLabel(member?.role, "Member")}</span>
                      </div>
                      <div>
                        <span className={`members-shell-pill is-status is-${safeStatus}`}>
                          {toLabel(member?.status, "Active")}
                        </span>
                      </div>
                      <div className="members-shell-projects-cell">
                        <strong>{projectCount}</strong>
                        <small>
                          {projectNames.length ? projectNames.slice(0, 2).join(", ") : "No project assignment"}
                          {projectNames.length > 2 ? ` +${projectNames.length - 2}` : ""}
                        </small>
                      </div>
                      <div className="members-shell-contact-cell">
                        <strong>{member?.email || "No email"}</strong>
                        <small>{member?.phone_number || "No phone"}</small>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="members-shell-empty-state">
                  <Icon name="users" size={20} />
                  <span>No members found for this search.</span>
                </div>
              )}
            </div>
          </article>

          <aside className="members-shell-side">
            <article className="members-shell-panel">
              <div className="members-shell-panel-header">
                <h3>Pending invites</h3>
                <span className="members-shell-chip">{canInviteMember ? pendingInvites.length : "Admin only"}</span>
              </div>
              {canInviteMember ? (
                pendingInvites.length ? (
                  <div className="members-shell-invite-list">
                    {pendingInvites.map((invite) => (
                      <div className="members-shell-invite-item" key={invite?.id || invite?.invite_number}>
                        <div>
                          <strong>{invite?.email || "No email"}</strong>
                          <small>
                            #{invite?.invite_number || "-"} · {toLabel(invite?.role, "Member")}
                          </small>
                        </div>
                        <span>{formatDate(invite?.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="members-shell-muted">No pending invites right now.</p>
                )
              ) : (
                <p className="members-shell-muted">
                  Organization-level invites are admin-only. Use project tabs for scoped invites.
                </p>
              )}
            </article>

            <article className="members-shell-panel">
              <div className="members-shell-panel-header">
                <h3>Simplified structure</h3>
              </div>
              <ul className="members-shell-checklist">
                <li>People page: organization member directory and invite flow.</li>
                <li>Project pages: assignment and project-scoped access only.</li>
                <li>My Settings: each member manages own profile and account details.</li>
              </ul>
            </article>
          </aside>
        </div>
      </section>

      <DataModal
        open={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteForm(createInviteForm());
        }}
        title="Invite member"
        subtitle="Send an invite and assign a role before they join."
        icon="mail"
      >
        <form className="data-modal-form" onSubmit={handleInviteSubmit}>
          <div className="data-modal-grid">
            <label className="data-modal-field data-modal-field--full">
              E-mail *
              <input
                type="email"
                name="email"
                value={inviteForm.email}
                onChange={(event) => handleInviteFormChange("email", event.target.value)}
                placeholder="member@group.org"
                required
              />
            </label>

            <label className="data-modal-field">
              Phone number
              <input
                type="tel"
                name="phone_number"
                value={inviteForm.phone_number}
                onChange={(event) => handleInviteFormChange("phone_number", event.target.value)}
                placeholder="+254 700 000 000"
              />
            </label>

            <label className="data-modal-field">
              Role
              <select
                name="role"
                value={inviteForm.role}
                onChange={(event) => handleInviteFormChange("role", event.target.value)}
              >
                <option value="member">Member</option>
                <option value="supervisor">Supervisor</option>
                <option value="project_manager">Project Manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            {!inviteRoleIsAdmin ? (
              <label className="data-modal-field data-modal-field--full">
                Project access
                <select
                  value={inviteProjectScope}
                  onChange={(event) => handleInviteFormChange("project_access_scope", event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="selected">Selected projects</option>
                  <option value="all">All projects</option>
                  <option value="none">No project access yet</option>
                </select>
              </label>
            ) : null}

            {!inviteRoleIsAdmin && inviteProjectScope === "selected" ? (
              <label className="data-modal-field data-modal-field--full">
                Projects
                <div className="data-modal-checkbox-list">
                  {projects.length ? (
                    projects.map((project) => {
                      const projectId = Number.parseInt(String(project?.id || ""), 10);
                      if (!Number.isInteger(projectId) || projectId <= 0) return null;
                      const checked = inviteProjectIds.includes(projectId);
                      return (
                        <label key={projectId} className="data-modal-checkbox-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleInviteProjectToggle(projectId)}
                            disabled={isSubmitting}
                          />
                          <span>{project?.name || `Project ${projectId}`}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="data-modal-hint">No projects available in this workspace yet.</p>
                  )}
                </div>
              </label>
            ) : null}

            <label className="data-modal-field data-modal-field--full">
              Invite note (optional)
              <textarea
                rows="4"
                name="notes"
                value={inviteForm.notes}
                onChange={(event) => handleInviteFormChange("notes", event.target.value)}
                placeholder="Add a short welcome or role instructions."
              />
            </label>
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => {
                setShowInviteModal(false);
                setInviteForm(createInviteForm());
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </DataModal>

      <ResponseModal
        open={showResponseModal}
        onClose={() => setShowResponseModal(false)}
        type={responseData.type}
        title={responseData.title}
        message={responseData.message}
        code={responseData.code}
        codeLabel="Invite Number"
        onCopyCode={() => {
          if (!responseData.code) return;
          navigator.clipboard.writeText(responseData.code);
        }}
      />
    </div>
  );
}
