import { useCallback, useEffect, useMemo, useState } from "react";
import DataModal from "./DataModal.jsx";
import ResponseModal from "./ResponseModal.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import { Icon } from "../icons.jsx";
import {
  cancelMagicLinkInvite,
  createMagicLinkInvite,
  deleteTenantMembershipAdmin,
  getMembersAdmin,
  getProjectMemberAssignmentsSummary,
  getProjects,
  getTenantMemberAuditLog,
  getTenantMagicLinkInvites,
  resendMagicLinkInvite,
  updateMemberAdmin,
  updateTenantMembershipAdmin,
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

const MEMBER_ROLE_OPTIONS = ["member", "supervisor", "project_manager", "admin", "superadmin"];
const MEMBER_STATUS_OPTIONS = ["active", "pending", "inactive"];

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

const isAdminMembershipRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "superadmin";
};

const normalizeMembershipRole = (member) =>
  String(member?.tenant_role || member?.role || "member")
    .trim()
    .toLowerCase() || "member";

const normalizeMembershipStatus = (member) =>
  String(member?.tenant_status || member?.status || "active")
    .trim()
    .toLowerCase() || "active";

const createMemberEditorForm = (member = null) => ({
  name: String(member?.name || "").trim(),
  email: String(member?.email || "").trim(),
  phone_number: String(member?.phone_number || "").trim(),
  join_date: String(member?.join_date || "").trim() || new Date().toISOString().slice(0, 10),
  tenant_role: normalizeMembershipRole(member),
  tenant_status: normalizeMembershipStatus(member),
});

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

const formatDateTime = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "-";
  return new Date(timestamp).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

export default function MembersPage({ tenantInfo, tenantId, user, tenantRole, access, setActivePage }) {
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectAssignments, setProjectAssignments] = useState([]);
  const [inviteRows, setInviteRows] = useState([]);
  const [memberAuditRows, setMemberAuditRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState(null);
  const [inviteForm, setInviteForm] = useState(() => createInviteForm());
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberEditorForm, setMemberEditorForm] = useState(() => createMemberEditorForm());
  const [responseData, setResponseData] = useState({
    type: "success",
    title: "",
    message: "",
    code: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [membershipActionBusy, setMembershipActionBusy] = useState(false);
  const [inviteActionBusyId, setInviteActionBusyId] = useState("");

  const effectiveTenantId = tenantId || tenantInfo?.id || null;
  const roleKey = normalizeRoleKey(tenantRole || user?.role || "member");
  const isAdmin = ["admin", "superadmin", "super_admin"].includes(roleKey);
  const canAdministerMembers = isAdmin;
  const canInviteMember = isAdmin;

  const loadPeopleData = useCallback(async () => {
    if (!effectiveTenantId) {
      setMembers([]);
      setProjects([]);
      setProjectAssignments([]);
      setInviteRows([]);
      setMemberAuditRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [membersResult, projectsResult, assignmentsResult, invitesResult, auditResult] = await Promise.allSettled([
        getMembersAdmin(effectiveTenantId),
        getProjects(effectiveTenantId),
        getProjectMemberAssignmentsSummary(effectiveTenantId),
        canInviteMember ? getTenantMagicLinkInvites(effectiveTenantId, { limit: 50 }) : Promise.resolve([]),
        canAdministerMembers ? getTenantMemberAuditLog(effectiveTenantId, { limit: 80 }) : Promise.resolve([]),
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

      if (auditResult.status === "fulfilled") {
        setMemberAuditRows(Array.isArray(auditResult.value) ? auditResult.value : []);
      } else {
        setMemberAuditRows([]);
        if (canAdministerMembers) {
          loadErrors.push("member audit");
          console.error("People page: failed to load member audit", auditResult.reason);
        }
      }

      if (loadErrors.length) {
        setError(`Some data could not be loaded (${loadErrors.join(", ")}).`);
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId, canAdministerMembers, canInviteMember]);

  useEffect(() => {
    loadPeopleData();
  }, [loadPeopleData]);

  useEffect(() => {
    const availableIds = new Set(
      members
        .map((member) => Number.parseInt(String(member?.id || ""), 10))
        .filter((memberId) => Number.isInteger(memberId) && memberId > 0)
    );
    setSelectedMemberIds((prev) => prev.filter((memberId) => availableIds.has(memberId)));
  }, [members]);

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

  const memberById = useMemo(
    () =>
      new Map(
        members
          .map((member) => {
            const memberId = Number.parseInt(String(member?.id || ""), 10);
            if (!Number.isInteger(memberId) || memberId <= 0) return null;
            return [memberId, member];
          })
          .filter(Boolean)
      ),
    [members]
  );

  const selectedMembers = useMemo(
    () => selectedMemberIds.map((memberId) => memberById.get(memberId)).filter(Boolean),
    [memberById, selectedMemberIds]
  );

  const memberAuditByMemberId = useMemo(() => {
    const auditMap = new Map();
    memberAuditRows.forEach((entry) => {
      const memberId = Number.parseInt(String(entry?.member_id || ""), 10);
      if (!Number.isInteger(memberId) || memberId <= 0) return;
      const existing = auditMap.get(memberId) || [];
      existing.push(entry);
      auditMap.set(memberId, existing);
    });
    return auditMap;
  }, [memberAuditRows]);

  const activeAdminCount = useMemo(
    () =>
      members.filter(
        (member) =>
          normalizeMembershipStatus(member) === "active" && isAdminMembershipRole(normalizeMembershipRole(member))
      ).length,
    [members]
  );

  const filteredMembers = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const haystack = [
        member?.name,
        member?.email,
        member?.phone_number,
        normalizeMembershipRole(member),
        normalizeMembershipStatus(member),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [members, searchQuery]);

  const stats = useMemo(() => {
    const activeCount = members.filter((member) => normalizeMembershipStatus(member) === "active").length;
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

  const recentAuditEntries = useMemo(() => memberAuditRows.slice(0, 6), [memberAuditRows]);

  const selectedMemberAuditEntries = useMemo(() => {
    const selectedMemberId = Number.parseInt(String(selectedMemberDetail?.member?.id || ""), 10);
    if (!Number.isInteger(selectedMemberId) || selectedMemberId <= 0) {
      return [];
    }
    return memberAuditByMemberId.get(selectedMemberId) || [];
  }, [memberAuditByMemberId, selectedMemberDetail]);

  const peopleStatCards = useMemo(
    () => [
      { key: "total", label: "Total members", value: stats.total, icon: "users", tone: "teal" },
      { key: "active", label: "Active", value: stats.active, icon: "check-circle", tone: "green" },
      { key: "without-project", label: "Without project", value: stats.withoutProjects, icon: "folder", tone: "amber" },
      {
        key: "pending-invites",
        label: "Pending invites",
        value: canInviteMember ? stats.pendingInvites : "-",
        icon: "mail",
        tone: "blue",
      },
    ],
    [canInviteMember, stats]
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
        toLabel(normalizeMembershipRole(member), "Member"),
        toLabel(normalizeMembershipStatus(member), "Active"),
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

  const getMemberSummary = useCallback(
    (member) => {
      const memberId = Number.parseInt(String(member?.id || ""), 10);
      const summary = projectSummaryByMemberId.get(memberId) || null;
      const projectNames = summary ? Array.from(summary.projectNames) : [];
      const safeStatus = normalizeMembershipStatus(member).replace(/[^a-z0-9_]+/g, "_");
      return {
        member,
        projectCount: summary?.count || 0,
        projectNames,
        safeStatus,
      };
    },
    [projectSummaryByMemberId]
  );

  const openMemberDetail = useCallback(
    (member) => {
      if (!member) return;
      setSelectedMemberDetail(getMemberSummary(member));
    },
    [getMemberSummary]
  );

  const openMemberEditor = useCallback((member) => {
    if (!member) return;
    setSelectedMemberDetail(null);
    setEditingMemberId(member.id || null);
    setMemberEditorForm(createMemberEditorForm(member));
    setShowEditMemberModal(true);
  }, []);

  const toggleSelectedMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const toggleAllVisibleMembers = () => {
    const visibleIds = filteredMembers
      .map((member) => Number.parseInt(String(member?.id || ""), 10))
      .filter((memberId) => Number.isInteger(memberId) && memberId > 0);
    if (!visibleIds.length) return;
    setSelectedMemberIds((prev) => {
      const allSelected = visibleIds.every((memberId) => prev.includes(memberId));
      if (allSelected) {
        return prev.filter((memberId) => !visibleIds.includes(memberId));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const ensureMembershipActionAllowed = useCallback(
    (member, nextRole, nextStatus, actionLabel) => {
      const memberId = Number.parseInt(String(member?.id || ""), 10);
      const currentRole = normalizeMembershipRole(member);
      const currentStatus = normalizeMembershipStatus(member);
      const willRemainAdmin = isAdminMembershipRole(nextRole ?? currentRole);
      const willRemainActive = String(nextStatus || currentStatus).trim().toLowerCase() === "active";
      const targetsCurrentUser =
        Number.isInteger(memberId) &&
        memberId > 0 &&
        String(memberId) === String(user?.id || "");

      if (targetsCurrentUser && (!willRemainAdmin || !willRemainActive)) {
        throw new Error("You cannot terminate, dismiss, or demote your own active admin access here.");
      }

      if (
        currentStatus === "active" &&
        isAdminMembershipRole(currentRole) &&
        (!willRemainAdmin || !willRemainActive) &&
        activeAdminCount <= 1
      ) {
        throw new Error(`Cannot ${actionLabel}. The workspace must retain at least one active admin.`);
      }
    },
    [activeAdminCount, user?.id]
  );

  const applyMembershipAction = useCallback(
    async (membersToUpdate, action) => {
      if (!canAdministerMembers) {
        throw new Error("Only workspace admins can manage members.");
      }

      const safeMembers = Array.isArray(membersToUpdate) ? membersToUpdate.filter(Boolean) : [];
      if (!safeMembers.length) {
        return;
      }

      const selectedActiveAdminCount = safeMembers.filter(
        (member) =>
          normalizeMembershipStatus(member) === "active" && isAdminMembershipRole(normalizeMembershipRole(member))
      ).length;
      if ((action === "dismiss" || action === "remove") && selectedActiveAdminCount >= activeAdminCount) {
        throw new Error("Cannot terminate or dismiss all active admins from the workspace.");
      }

      setMembershipActionBusy(true);
      setError("");
      setNotice("");
      try {
        if (action === "give_admin") {
          for (const member of safeMembers) {
            const membershipId = member?.tenant_membership_id;
            if (!membershipId) {
              throw new Error(`Missing tenant membership for ${member?.name || "member"}.`);
            }
            await updateTenantMembershipAdmin(membershipId, { role: "admin" });
          }
          setNotice(
            safeMembers.length === 1
              ? "Member is now an admin."
              : `${safeMembers.length} members are now admins.`
          );
        }

        if (action === "dismiss") {
          for (const member of safeMembers) {
            const membershipId = member?.tenant_membership_id;
            if (!membershipId) {
              throw new Error(`Missing tenant membership for ${member?.name || "member"}.`);
            }
            ensureMembershipActionAllowed(member, normalizeMembershipRole(member), "inactive", "dismiss member");
            await updateTenantMembershipAdmin(membershipId, { status: "inactive" });
          }
          setNotice(
            safeMembers.length === 1 ? "Member dismissed." : `${safeMembers.length} members dismissed.`
          );
        }

        if (action === "reinstate") {
          for (const member of safeMembers) {
            const membershipId = member?.tenant_membership_id;
            if (!membershipId) {
              throw new Error(`Missing tenant membership for ${member?.name || "member"}.`);
            }
            await updateTenantMembershipAdmin(membershipId, { status: "active" });
          }
          setNotice(
            safeMembers.length === 1
              ? "Member reinstated."
              : `${safeMembers.length} members reinstated.`
          );
        }

        if (action === "remove") {
          for (const member of safeMembers) {
            const membershipId = member?.tenant_membership_id;
            if (!membershipId) {
              throw new Error(`Missing tenant membership for ${member?.name || "member"}.`);
            }
            ensureMembershipActionAllowed(member, normalizeMembershipRole(member), "inactive", "terminate member");
            await deleteTenantMembershipAdmin(membershipId);
          }
          setNotice(
            safeMembers.length === 1
              ? "Member terminated from the organization."
              : `${safeMembers.length} members terminated from the organization.`
          );
        }

        setSelectedMemberIds((prev) =>
          prev.filter((memberId) => !safeMembers.some((member) => String(member?.id || "") === String(memberId)))
        );
        setSelectedMemberDetail((prev) => {
          if (!prev?.member?.id) return prev;
          return safeMembers.some((member) => String(member?.id || "") === String(prev.member.id)) ? null : prev;
        });
        await loadPeopleData();
      } catch (actionError) {
        await loadPeopleData();
        throw actionError;
      } finally {
        setMembershipActionBusy(false);
      }
    },
    [canAdministerMembers, ensureMembershipActionAllowed, loadPeopleData]
  );

  const confirmAndApplyMembershipAction = async (membersToUpdate, action) => {
    const count = Array.isArray(membersToUpdate) ? membersToUpdate.filter(Boolean).length : 0;
    if (!count) return;

    const actionLabel =
      action === "give_admin"
        ? "make admin"
        : action === "dismiss"
          ? "dismiss"
          : action === "reinstate"
            ? "reinstate"
            : "terminate";
    const prompt =
      action === "remove"
        ? `Terminate ${count === 1 ? "this member" : `${count} members`} from the organization?`
        : `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)} ${count === 1 ? "this member" : `${count} members`}?`;

    if (!window.confirm(prompt)) {
      return;
    }

    try {
      await applyMembershipAction(membersToUpdate, action);
    } catch (actionError) {
      setError(actionError?.message || "Could not update member access.");
    }
  };

  const handleSaveMemberEdit = async (event) => {
    event.preventDefault();
    if (!editingMemberId) {
      return;
    }

    const member = memberById.get(Number.parseInt(String(editingMemberId || ""), 10));
    if (!member) {
      setError("That member could not be found.");
      return;
    }

    if (!String(memberEditorForm.name || "").trim()) {
      setError("Member name is required.");
      return;
    }

    if (!member?.tenant_membership_id) {
      setError("Tenant membership is missing for this member.");
      return;
    }

    try {
      setSavingMember(true);
      setError("");
      setNotice("");
      ensureMembershipActionAllowed(
        member,
        memberEditorForm.tenant_role,
        memberEditorForm.tenant_status,
        "save member changes"
      );
      await updateMemberAdmin(editingMemberId, {
        name: memberEditorForm.name,
        email: memberEditorForm.email,
        phone_number: memberEditorForm.phone_number,
        join_date: memberEditorForm.join_date,
      });
      await updateTenantMembershipAdmin(member.tenant_membership_id, {
        role: memberEditorForm.tenant_role,
        status: memberEditorForm.tenant_status,
      });
      setNotice("Member updated successfully.");
      setShowEditMemberModal(false);
      setEditingMemberId(null);
      await loadPeopleData();
      setSelectedMemberDetail(null);
    } catch (saveError) {
      setError(saveError?.message || "Failed to update member.");
    } finally {
      setSavingMember(false);
    }
  };

  const isInviteExpired = useCallback((invite) => {
    const expiresAt = Date.parse(String(invite?.expires_at || ""));
    return Number.isFinite(expiresAt) && expiresAt < Date.now();
  }, []);

  const handleResendInvite = async (invite) => {
    if (!canInviteMember || !invite?.id) {
      return;
    }

    try {
      setInviteActionBusyId(String(invite.id));
      setError("");
      setNotice("");
      const updatedInvite = await resendMagicLinkInvite(invite.id);
      await loadPeopleData();
      setResponseData({
        type: "success",
        title: "Invite ready to share",
        message: `Share this invite number with ${updatedInvite?.email || "the invited member"}. It is now active again.`,
        code: updatedInvite?.invite_number || null,
      });
      setShowResponseModal(true);
      setNotice(`Invite reissued for ${updatedInvite?.email || "the invited member"}.`);
    } catch (inviteError) {
      setError(inviteError?.message || "Could not resend that invite.");
    } finally {
      setInviteActionBusyId("");
    }
  };

  const handleCancelInvite = async (invite) => {
    if (!canInviteMember || !invite?.id) {
      return;
    }

    const email = invite?.email || "this invited member";
    if (!window.confirm(`Cancel the invite for ${email}?`)) {
      return;
    }

    try {
      setInviteActionBusyId(String(invite.id));
      setError("");
      setNotice("");
      await cancelMagicLinkInvite(invite.id);
      await loadPeopleData();
      setNotice(`Invite canceled for ${email}.`);
    } catch (inviteError) {
      setError(inviteError?.message || "Could not cancel that invite.");
    } finally {
      setInviteActionBusyId("");
    }
  };

  const inviteRoleIsAdmin = isInviteAdminRole(inviteForm.role);
  const inviteProjectScope = inviteRoleIsAdmin
    ? "all"
    : normalizeInviteProjectScope(inviteForm.project_access_scope);
  const inviteProjectIds = normalizeInviteProjectIds(inviteForm.project_ids);
  const allVisibleMemberIds = filteredMembers
    .map((member) => Number.parseInt(String(member?.id || ""), 10))
    .filter((memberId) => Number.isInteger(memberId) && memberId > 0);
  const allVisibleSelected =
    allVisibleMemberIds.length > 0 &&
    allVisibleMemberIds.every((memberId) => selectedMemberIds.includes(memberId));

  return (
    <div className="members-shell dashboard-mobile-shell">
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
              <Icon name="settings" size={15} />
              My settings
            </button>
            <button
              type="button"
              className="members-shell-btn members-shell-btn--ghost"
              onClick={handleExportCsv}
              disabled={loading || !filteredMembers.length}
            >
              <Icon name="download" size={15} />
              Export
            </button>
            {canInviteMember ? (
              <button
                type="button"
                className="members-shell-btn members-shell-btn--primary members-shell-btn--invite"
                onClick={() => setShowInviteModal(true)}
                disabled={!effectiveTenantId}
              >
                <Icon name="mail" size={15} />
                Invite member
              </button>
            ) : null}
          </div>
        </header>

        {notice ? <p className="projects-notice projects-notice--success">{notice}</p> : null}
        {error ? <p className="projects-notice projects-notice--warning">{error}</p> : null}
        {!canAdministerMembers ? (
          <p className="projects-notice projects-notice--warning">
            You are in read-only mode. Workspace admins manage organization members here; project roles stay inside project tabs.
          </p>
        ) : null}

        <div className="members-shell-kpis">
          {peopleStatCards.map((card) => (
            <article className={`members-shell-kpi tone-${card.tone}`} key={card.key}>
              <span className="members-shell-kpi-icon" aria-hidden="true">
                <Icon name={card.icon} size={16} />
              </span>
              <div className="members-shell-kpi-copy">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </div>
            </article>
          ))}
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

            {canAdministerMembers && selectedMembers.length ? (
              <div className="members-shell-selection-bar">
                <strong>{selectedMembers.length} selected</strong>
                <div className="members-shell-selection-actions">
                  <button
                    type="button"
                    className="members-shell-btn members-shell-btn--ghost members-shell-action-icon is-admin"
                    onClick={() => confirmAndApplyMembershipAction(selectedMembers, "give_admin")}
                    disabled={membershipActionBusy}
                    aria-label="Make admin"
                    title="Make admin"
                  >
                    <Icon name="shield" size={16} />
                    <span className="members-shell-action-tooltip">Make admin</span>
                  </button>
                  <button
                    type="button"
                    className="members-shell-btn members-shell-btn--ghost members-shell-action-icon is-dismiss"
                    onClick={() => confirmAndApplyMembershipAction(selectedMembers, "dismiss")}
                    disabled={membershipActionBusy}
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    <Icon name="user-minus" size={16} />
                    <span className="members-shell-action-tooltip">Dismiss</span>
                  </button>
                  <button
                    type="button"
                    className="members-shell-btn members-shell-btn--ghost members-shell-action-icon is-reinstate"
                    onClick={() => confirmAndApplyMembershipAction(selectedMembers, "reinstate")}
                    disabled={membershipActionBusy}
                    aria-label="Reinstate"
                    title="Reinstate"
                  >
                    <Icon name="refresh-cw" size={16} />
                    <span className="members-shell-action-tooltip">Reinstate</span>
                  </button>
                  <button
                    type="button"
                    className="members-shell-btn members-shell-btn--ghost members-shell-action-icon is-terminate"
                    onClick={() => confirmAndApplyMembershipAction(selectedMembers, "remove")}
                    disabled={membershipActionBusy}
                    aria-label="Terminate"
                    title="Terminate"
                  >
                    <Icon name="trash" size={16} />
                    <span className="members-shell-action-tooltip">Terminate</span>
                  </button>
                  <button
                    type="button"
                    className="members-shell-btn members-shell-btn--ghost members-shell-action-icon is-clear"
                    onClick={() => setSelectedMemberIds([])}
                    disabled={membershipActionBusy}
                    aria-label="Clear selection"
                    title="Clear selection"
                  >
                    <Icon name="x" size={16} />
                    <span className="members-shell-action-tooltip">Clear</span>
                  </button>
                </div>
              </div>
            ) : null}

            <div
              className={`members-shell-table-head members-shell-table-head--live${canAdministerMembers ? " is-selectable" : ""}`}
            >
              {canAdministerMembers ? (
                <label className="members-shell-checkbox-head">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisibleMembers}
                    aria-label="Select visible members"
                  />
                </label>
              ) : null}
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
                  const safeStatus = normalizeMembershipStatus(member).replace(/[^a-z0-9_]+/g, "_");
                  return (
                    <div
                      className={`members-shell-row members-shell-row--live${canAdministerMembers ? " is-selectable" : ""}`}
                      key={`member-${member?.id || member?.email}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openMemberDetail(member)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openMemberDetail(member);
                        }
                      }}
                    >
                      {canAdministerMembers ? (
                        <label
                          className="members-shell-checkbox-cell"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(memberId)}
                            onChange={() => toggleSelectedMember(memberId)}
                            aria-label={`Select ${member?.name || "member"}`}
                          />
                        </label>
                      ) : null}
                      <div className="members-shell-cell-main">
                        <span className="members-shell-cell-label">Name</span>
                        <strong>{member?.name || `Member #${member?.id || "-"}`}</strong>
                        <small>Joined {formatDate(member?.join_date)}</small>
                      </div>
                      <div className="members-shell-role-cell">
                        <span className="members-shell-cell-label">Org role</span>
                        <span className="members-shell-pill">
                          {toLabel(normalizeMembershipRole(member), "Member")}
                        </span>
                      </div>
                      <div className="members-shell-status-cell">
                        <span className="members-shell-cell-label">Status</span>
                        <span className={`members-shell-pill is-status is-${safeStatus}`}>
                          {toLabel(normalizeMembershipStatus(member), "Active")}
                        </span>
                      </div>
                      <div className="members-shell-projects-cell">
                        <span className="members-shell-cell-label">Projects</span>
                        <strong>{projectCount}</strong>
                        <small>
                          {projectNames.length ? projectNames.slice(0, 2).join(", ") : "No project assignment"}
                          {projectNames.length > 2 ? ` +${projectNames.length - 2}` : ""}
                        </small>
                      </div>
                      <div className="members-shell-contact-cell">
                        <span className="members-shell-cell-label">Contact</span>
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
                        <div className="members-shell-invite-copy">
                          <strong>{invite?.email || "No email"}</strong>
                          <small>
                            #{invite?.invite_number || "-"} · {toLabel(invite?.role, "Member")}
                            {invite?.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : ""}
                          </small>
                          {isInviteExpired(invite) ? (
                            <small className="members-shell-invite-expired">Expired. Resend to refresh access.</small>
                          ) : null}
                        </div>
                        <div className="members-shell-invite-meta">
                          <span>{formatDate(invite?.created_at)}</span>
                          <div className="members-shell-invite-actions">
                            <button
                              type="button"
                              className="members-shell-link-btn"
                              onClick={() => handleResendInvite(invite)}
                              disabled={inviteActionBusyId === String(invite?.id || "")}
                            >
                              {inviteActionBusyId === String(invite?.id || "") ? "Working..." : "Resend"}
                            </button>
                            <button
                              type="button"
                              className="members-shell-link-btn is-danger"
                              onClick={() => handleCancelInvite(invite)}
                              disabled={inviteActionBusyId === String(invite?.id || "")}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
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
                <h3>Access notes</h3>
                <span className="members-shell-chip">{canAdministerMembers ? recentAuditEntries.length : "Admin only"}</span>
              </div>
              {canAdministerMembers ? (
                recentAuditEntries.length ? (
                  <div className="members-shell-audit-list">
                    {recentAuditEntries.map((entry) => (
                      <div className="members-shell-audit-item" key={entry?.id || `${entry?.member_id}-${entry?.occurred_at}`}>
                        <strong>{entry?.note || "Membership updated."}</strong>
                        <small>
                          {entry?.member_name || "Member"} · {entry?.actor_name || "System"} ·{" "}
                          {formatDateTime(entry?.occurred_at)}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="members-shell-muted">No access notes recorded yet.</p>
                )
              ) : (
                <p className="members-shell-muted">Access notes are visible to workspace admins only.</p>
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

      <DataModal
        open={Boolean(selectedMemberDetail)}
        onClose={() => setSelectedMemberDetail(null)}
        title={selectedMemberDetail?.member?.name || "Member details"}
        subtitle="Organization member details and assignment summary."
        icon="users"
      >
        {selectedMemberDetail ? (
          <div className="members-detail-modal">
            <div className="members-detail-grid">
              <div className="members-detail-field">
                <span>Name</span>
                <strong>{selectedMemberDetail.member?.name || "-"}</strong>
              </div>
              <div className="members-detail-field">
                <span>Org role</span>
                <strong>{toLabel(normalizeMembershipRole(selectedMemberDetail.member), "Member")}</strong>
              </div>
              <div className="members-detail-field">
                <span>Status</span>
                <strong>{toLabel(normalizeMembershipStatus(selectedMemberDetail.member), "Active")}</strong>
              </div>
              <div className="members-detail-field">
                <span>Joined</span>
                <strong>{formatDate(selectedMemberDetail.member?.join_date)}</strong>
              </div>
              <div className="members-detail-field">
                <span>Email</span>
                <strong>{selectedMemberDetail.member?.email || "No email"}</strong>
              </div>
              <div className="members-detail-field">
                <span>Phone</span>
                <strong>{selectedMemberDetail.member?.phone_number || "No phone"}</strong>
              </div>
            </div>

            <div className="members-detail-projects">
              <span>Projects</span>
              <strong>{selectedMemberDetail.projectCount}</strong>
              <p>
                {selectedMemberDetail.projectNames.length
                  ? selectedMemberDetail.projectNames.join(", ")
                  : "No project assignment yet."}
              </p>
            </div>

            {canAdministerMembers ? (
              <div className="members-detail-history">
                <span>Access history</span>
                {selectedMemberAuditEntries.length ? (
                  <div className="members-detail-history-list">
                    {selectedMemberAuditEntries.slice(0, 8).map((entry) => (
                      <div
                        className="members-detail-history-item"
                        key={entry?.id || `${entry?.member_id}-${entry?.occurred_at}`}
                      >
                        <strong>{entry?.note || "Membership updated."}</strong>
                        <small>
                          {entry?.actor_name || "System"} · {formatDateTime(entry?.occurred_at)}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="members-shell-muted">No access notes recorded yet for this member.</p>
                )}
              </div>
            ) : null}

            {canAdministerMembers ? (
              <div className="members-detail-actions">
                <button
                  type="button"
                  className="data-modal-btn"
                  onClick={() => openMemberEditor(selectedMemberDetail.member)}
                  disabled={savingMember || membershipActionBusy}
                >
                  Edit member
                </button>
                {!isAdminMembershipRole(normalizeMembershipRole(selectedMemberDetail.member)) ? (
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() =>
                      confirmAndApplyMembershipAction([selectedMemberDetail.member], "give_admin")
                    }
                    disabled={membershipActionBusy}
                  >
                    Make admin
                  </button>
                ) : null}
                {normalizeMembershipStatus(selectedMemberDetail.member) === "inactive" ? (
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() =>
                      confirmAndApplyMembershipAction([selectedMemberDetail.member], "reinstate")
                    }
                    disabled={membershipActionBusy}
                  >
                    Reinstate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() =>
                      confirmAndApplyMembershipAction([selectedMemberDetail.member], "dismiss")
                    }
                    disabled={membershipActionBusy}
                  >
                    Dismiss
                  </button>
                )}
                <button
                  type="button"
                  className="data-modal-btn data-modal-btn--danger"
                  onClick={() => confirmAndApplyMembershipAction([selectedMemberDetail.member], "remove")}
                  disabled={membershipActionBusy}
                >
                  Terminate
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DataModal>

      <DataModal
        open={showEditMemberModal}
        onClose={() => {
          setShowEditMemberModal(false);
          setEditingMemberId(null);
          setMemberEditorForm(createMemberEditorForm());
        }}
        title="Edit member"
        subtitle="Update profile details and organization access."
        icon="users"
      >
        <form className="data-modal-form" onSubmit={handleSaveMemberEdit}>
          <div className="data-modal-grid">
            <label className="data-modal-field data-modal-field--full">
              Name *
              <input
                type="text"
                value={memberEditorForm.name}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, name: event.target.value }))
                }
                required
              />
            </label>
            <label className="data-modal-field">
              E-mail
              <input
                type="email"
                value={memberEditorForm.email}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </label>
            <label className="data-modal-field">
              Phone
              <input
                type="tel"
                value={memberEditorForm.phone_number}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, phone_number: event.target.value }))
                }
              />
            </label>
            <label className="data-modal-field">
              Org role
              <select
                value={memberEditorForm.tenant_role}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, tenant_role: event.target.value }))
                }
              >
                {MEMBER_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {toLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Org status
              <select
                value={memberEditorForm.tenant_status}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, tenant_status: event.target.value }))
                }
              >
                {MEMBER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {toLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field data-modal-field--full">
              Join date
              <input
                type="date"
                value={memberEditorForm.join_date}
                onChange={(event) =>
                  setMemberEditorForm((prev) => ({ ...prev, join_date: event.target.value }))
                }
              />
            </label>
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => {
                setShowEditMemberModal(false);
                setEditingMemberId(null);
                setMemberEditorForm(createMemberEditorForm());
              }}
              disabled={savingMember}
            >
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingMember}>
              {savingMember ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </DataModal>

      {canInviteMember ? (
        <button
          type="button"
          className="dashboard-page-fab"
          onClick={() => setShowInviteModal(true)}
          disabled={!effectiveTenantId}
          aria-label="Invite member"
        >
          <Icon name="plus" size={20} />
        </button>
      ) : null}

      <DashboardMobileNav activePage="members" access={access} setActivePage={setActivePage} />
    </div>
  );
}
