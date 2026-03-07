import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Icon } from "../icons.jsx";
import {
  cancelAdminShellCommand,
  cancelAdminTenantMagicLinkInvite,
  getAdminShellHistory,
  getAdminActingTenantId,
  getAdminActivityLogs,
  getAdminTenantMagicLinkInvites,
  getAdminTenantMembers,
  getAdminTenantOverview,
  getAdminTenantProfile,
  getAdminTenantProjects,
  getAdminTenantTransactions,
  getAdminTenants,
  getCurrentMember,
  getInternalAdminAccess,
  inputAdminShellCommand,
  runAdminShellCommand,
  startAdminShellSession,
  resendAdminTenantMagicLinkInvite,
  setAdminTenantWorkspacePause,
  setAdminActingTenantId,
  signOut,
  updateAdminTenantMembership,
  updateAdminTenantProfile,
} from "../../lib/dataService.js";

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

const formatCount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-US") : "0";
};

const formatAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  });
};

const toRoleLabel = (value) =>
  String(value || "support")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getNavActiveKey = (pathname) => {
  if (pathname.startsWith("/admin/tenant/")) return "tenants";
  if (pathname.startsWith("/admin/members")) return "members";
  if (pathname.startsWith("/admin/logs")) return "logs";
  if (pathname.startsWith("/admin/ops/")) return "ops";
  return "tenants";
};

const INTERNAL_ADMIN_SIDEBAR_COLLAPSED_KEY = "internal-admin-sidebar-collapsed";
const INTERNAL_ADMIN_SHELL_MAX_LINES = 350;
const INTERNAL_ADMIN_SHELL_POLL_MS = 2500;
const INTERNAL_ADMIN_SHELL_HEIGHT_KEY = "internal-admin-shell-height";
const INTERNAL_ADMIN_SHELL_MIN_HEIGHT = 230;
const INTERNAL_ADMIN_SHELL_DEFAULT_HEIGHT = 320;
const INTERNAL_ADMIN_SHELL_MAX_VIEWPORT_RATIO = 0.86;
const INTERNAL_ADMIN_SHELL_LAYOUT_KEY = "internal-admin-shell-layout";
const INTERNAL_ADMIN_SHELL_TERMINALS_KEY = "internal-admin-shell-terminals";
const INTERNAL_ADMIN_SHELL_ACTIVE_TERMINAL_KEY = "internal-admin-shell-active-terminal";
const INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT = 230;
const INTERNAL_ADMIN_SHELL_RIGHT_MIN = 180;
const INTERNAL_ADMIN_SHELL_TERMINAL_MIN = 520;
const INTERNAL_ADMIN_SHELL_SPLITTER_WIDTH = 6;
const INTERNAL_ADMIN_SHELL_MAX_TERMINALS = 16;

const readStoredActiveShellTerminalId = () => {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem(INTERNAL_ADMIN_SHELL_ACTIVE_TERMINAL_KEY) || "").trim();
};

const readStoredShellTerminals = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      String(window.localStorage.getItem(INTERNAL_ADMIN_SHELL_TERMINALS_KEY) || "[]")
    );
    if (!Array.isArray(parsed)) return [];
    const seenSessionIds = new Set();
    const normalized = [];
    parsed.forEach((terminal) => {
      const sessionId = String(terminal?.sessionId || terminal?.id || "").trim();
      if (!sessionId || seenSessionIds.has(sessionId)) return;
      seenSessionIds.add(sessionId);
      normalized.push({
        id: sessionId,
        sessionId,
        label: String(terminal?.label || "bash").trim() || "bash",
        status: String(terminal?.status || "open").trim().toLowerCase(),
        createdAt: terminal?.createdAt || "",
        lastSyncAt: terminal?.lastSyncAt || "",
        latestCommand: String(terminal?.latestCommand || "").trim(),
        latestStatus: String(terminal?.latestStatus || "").trim().toLowerCase(),
      });
    });
    return normalized.slice(-INTERNAL_ADMIN_SHELL_MAX_TERMINALS);
  } catch {
    return [];
  }
};

const normalizeShellCommandStatus = (value) => String(value || "").trim().toLowerCase();

const isShellCommandActive = (command) => {
  const status = normalizeShellCommandStatus(command?.status);
  return status === "running" || status === "queued";
};

const TENANT_HUB_NAV_ITEMS = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    route: "/admin/ops/home",
    title: "Tenant Hub Home",
    hint: "Cross-tenant snapshot of tiers, activity, and operational signals.",
    focusLabel: "Snapshot",
  },
  {
    key: "deployments",
    label: "Deployments",
    icon: "notes",
    route: "/admin/ops/deployments",
    title: "Tenant Deployments",
    hint: "Track rollout pressure using project volume and active transaction flow.",
    focusLabel: "Deployment Signal",
  },
  {
    key: "health",
    label: "Health & troubleshooting",
    icon: "alert",
    route: "/admin/ops/health",
    title: "Tenant Health & Troubleshooting",
    hint: "Prioritize workspaces that need follow-up based on health scores and event velocity.",
    focusLabel: "Health Signal",
  },
  {
    key: "optimization",
    label: "Optimization",
    icon: "trending-up",
    route: "/admin/ops/optimization",
    title: "Tenant Optimization",
    hint: "Spot underutilized workspaces and suggest next best support actions.",
    focusLabel: "Optimization Insight",
  },
  {
    key: "quotas",
    label: "Quotas & reservations",
    icon: "layers",
    route: "/admin/ops/quotas",
    title: "Tenant Quotas & Reservations",
    hint: "Estimate tenant load against operational tier capacity to flag near-limit workspaces.",
    focusLabel: "Quota Usage",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    icon: "calendar",
    route: "/admin/ops/maintenance",
    title: "Tenant Maintenance",
    hint: "Review quiet or stale workspaces that may require maintenance outreach.",
    focusLabel: "Maintenance State",
  },
  {
    key: "support",
    label: "Support",
    icon: "mail",
    route: "/admin/ops/support",
    title: "Tenant Support Queue",
    hint: "Surface tenants with the heaviest recent operational event activity.",
    focusLabel: "Support Load",
  },
];

const resolveTenantHubSectionKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "home";
  const match = TENANT_HUB_NAV_ITEMS.find((item) => item.key === normalized);
  return match ? match.key : "home";
};

const getActiveTenantHubKey = (pathname) => {
  if (!pathname.startsWith("/admin/ops/")) return "";
  const section = String(pathname.split("/")[3] || "").trim().toLowerCase();
  return resolveTenantHubSectionKey(section);
};

const TENANT_TIER_LIMITS = {
  foundation: { label: "Foundation", members: 20, projects: 8, transactions: 500 },
  growth: { label: "Growth", members: 60, projects: 25, transactions: 2500 },
  scale: { label: "Scale", members: 150, projects: 60, transactions: 6000 },
  enterprise: { label: "Enterprise", members: 300, projects: 120, transactions: 12000 },
};

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTenantOperationalTier = ({ members, projects, transactions }) => {
  const loadScore = members + projects * 3 + Math.ceil(transactions / 40);
  if (loadScore >= 260) return "enterprise";
  if (loadScore >= 120) return "scale";
  if (loadScore >= 45) return "growth";
  return "foundation";
};

const getTenantHealthSignal = ({ members, projects, transactions, recentEvents }) => {
  let score = 0;
  if (members > 0) score += 25;
  if (projects > 0) score += 25;
  if (transactions >= 10) score += 25;
  else if (transactions > 0) score += 15;
  if (recentEvents >= 5) score += 25;
  else if (recentEvents > 0) score += 15;

  if (score >= 70) {
    return { score, label: "Healthy", tone: "is-good" };
  }
  if (score >= 40) {
    return { score, label: "Watch", tone: "is-warning" };
  }
  return { score, label: "Needs Attention", tone: "is-critical" };
};

function AdminTenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = String(searchParams.get("q") || "").trim();
  const [rows, setRows] = useState([]);
  const [queryInput, setQueryInput] = useState(urlQuery);
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQueryInput(urlQuery);
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tenants = await getAdminTenants({ search: searchQuery, limit: 200 });
      setRows(Array.isArray(tenants) ? tenants : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || "Failed to load tenants.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Tenant Search</h3>
        <button type="button" className="btn-secondary" onClick={loadTenants} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className="admin-help">
        Search workspaces quickly and open a full tenant support view with members, projects, and transactions.
      </p>

      <form
        className="admin-search admin-search--top"
        onSubmit={(event) => {
          event.preventDefault();
          const nextQuery = String(queryInput || "").trim();
          setSearchQuery(nextQuery);
          const nextSearchParams = new URLSearchParams(searchParams);
          if (nextQuery) {
            nextSearchParams.set("q", nextQuery);
          } else {
            nextSearchParams.delete("q");
          }
          setSearchParams(nextSearchParams, { replace: true });
        }}
      >
        <Icon name="search" size={16} />
        <input
          type="search"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Search by workspace name, slug, or email"
          aria-label="Search tenants"
        />
      </form>

      {error ? <div className="admin-alert is-error">{error}</div> : null}
      {loading ? (
        <p className="admin-help">Loading tenants...</p>
      ) : (
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Workspace</span>
            <span>Slug</span>
            <span>Created</span>
            <span>Members</span>
            <span>Projects</span>
            <span>Actions</span>
          </div>
          {rows.length ? (
            rows.map((tenant) => (
              <div className="admin-table-row" key={tenant.tenant_id}>
                <span>
                  <strong>{tenant.tenant_name}</strong>
                  <small>{tenant.contact_email || "-"}</small>
                </span>
                <span>{tenant.slug || "-"}</span>
                <span>{formatDate(tenant.created_at)}</span>
                <span>{formatCount(tenant.active_members_count)}</span>
                <span>{formatCount(tenant.projects_count)}</span>
                <span>
                  <Link className="link-button" to={`/admin/tenant/${tenant.tenant_id}`}>
                    Open Overview
                  </Link>
                </span>
              </div>
            ))
          ) : (
            <p className="admin-help">No tenants matched your search.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminTenantOperationsPage() {
  const { opsSection } = useParams();
  const sectionKey = resolveTenantHubSectionKey(opsSection);
  const sectionMeta =
    TENANT_HUB_NAV_ITEMS.find((item) => item.key === sectionKey) || TENANT_HUB_NAV_ITEMS[0];

  const [tenantRows, setTenantRows] = useState([]);
  const [logRows, setLogRows] = useState([]);
  const [queryInput, setQueryInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [sortMode, setSortMode] = useState(sectionKey === "health" ? "health" : "signal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOperationRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tenantsResult, logsResult] = await Promise.all([
        getAdminTenants({ search: searchQuery, limit: 350 }),
        getAdminActivityLogs({ limit: 800 }),
      ]);
      setTenantRows(Array.isArray(tenantsResult) ? tenantsResult : []);
      setLogRows(Array.isArray(logsResult) ? logsResult : []);
    } catch (loadError) {
      setTenantRows([]);
      setLogRows([]);
      setError(loadError?.message || "Failed to load tenant operational data.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadOperationRows();
  }, [loadOperationRows]);

  useEffect(() => {
    setHealthFilter("all");
    setSortMode(sectionKey === "health" ? "health" : "signal");
  }, [sectionKey]);

  const recentLogSignals = useMemo(() => {
    const map = new Map();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    logRows.forEach((row) => {
      const tenantId = String(row?.tenant_id || "").trim();
      if (!tenantId) return;
      const occurredAt = Date.parse(String(row?.created_at || ""));
      const current = map.get(tenantId) || { total: 0, recent: 0, latestAt: null };
      current.total += 1;
      if (Number.isFinite(occurredAt) && occurredAt >= weekAgo) {
        current.recent += 1;
      }
      if (!current.latestAt || (Number.isFinite(occurredAt) && occurredAt > Date.parse(current.latestAt))) {
        current.latestAt = row?.created_at || current.latestAt;
      }
      map.set(tenantId, current);
    });

    return map;
  }, [logRows]);

  const operationalRows = useMemo(() => {
    const mapped = tenantRows.map((tenant) => {
      const members = toSafeNumber(tenant?.active_members_count);
      const projects = toSafeNumber(tenant?.projects_count);
      const transactions = toSafeNumber(tenant?.transactions_count);
      const tierKey = getTenantOperationalTier({ members, projects, transactions });
      const tier = TENANT_TIER_LIMITS[tierKey] || TENANT_TIER_LIMITS.foundation;
      const signal = recentLogSignals.get(String(tenant?.tenant_id || "").trim()) || {
        total: 0,
        recent: 0,
        latestAt: null,
      };
      const quotaUsage = Math.min(
        100,
        Math.round(
          (
            (members / Math.max(tier.members, 1)) * 100 +
            (projects / Math.max(tier.projects, 1)) * 100 +
            (transactions / Math.max(tier.transactions, 1)) * 100
          ) / 3
        )
      );
      const health = getTenantHealthSignal({
        members,
        projects,
        transactions,
        recentEvents: signal.recent,
      });

      let focusValue = `${members} members, ${projects} projects`;
      if (sectionKey === "deployments") {
        focusValue = `${projects} active projects`;
      } else if (sectionKey === "health") {
        focusValue = `${health.score}/100`;
      } else if (sectionKey === "optimization") {
        focusValue = transactions < 20 ? "Needs activation plan" : "Usage trending stable";
      } else if (sectionKey === "quotas") {
        focusValue = `${quotaUsage}%`;
      } else if (sectionKey === "maintenance") {
        focusValue = signal.recent === 0 ? "No recent events" : "Monitor in progress";
      } else if (sectionKey === "support") {
        focusValue = `${signal.recent} events (7d)`;
      }

      return {
        ...tenant,
        members,
        projects,
        transactions,
        tier,
        health,
        quotaUsage,
        recentEvents: signal.recent,
        latestActivityAt: signal.latestAt,
        focusValue,
      };
    });

    if (sectionKey === "deployments") {
      return mapped.sort((a, b) => b.projects - a.projects);
    }
    if (sectionKey === "health") {
      return mapped.sort((a, b) => a.health.score - b.health.score);
    }
    if (sectionKey === "optimization") {
      return mapped.sort((a, b) => a.transactions - b.transactions);
    }
    if (sectionKey === "quotas") {
      return mapped.sort((a, b) => b.quotaUsage - a.quotaUsage);
    }
    if (sectionKey === "maintenance") {
      return mapped.sort((a, b) => a.recentEvents - b.recentEvents);
    }
    if (sectionKey === "support") {
      return mapped.sort((a, b) => b.recentEvents - a.recentEvents);
    }
    return mapped.sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""));
  }, [recentLogSignals, sectionKey, tenantRows]);

  const summary = useMemo(() => {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    operationalRows.forEach((row) => {
      if (row.health.tone === "is-good") healthy += 1;
      else if (row.health.tone === "is-warning") warning += 1;
      else critical += 1;
    });
    return {
      total: operationalRows.length,
      healthy,
      warning,
      critical,
    };
  }, [operationalRows]);

  const filteredOperationalRows = useMemo(() => {
    let rows = operationalRows;
    if (healthFilter === "healthy") {
      rows = rows.filter((row) => row.health.tone === "is-good");
    } else if (healthFilter === "watch") {
      rows = rows.filter((row) => row.health.tone === "is-warning");
    } else if (healthFilter === "attention") {
      rows = rows.filter((row) => row.health.tone === "is-critical");
    }

    if (sortMode === "signal") return rows;

    const next = [...rows];
    if (sortMode === "health") {
      next.sort((a, b) => a.health.score - b.health.score || b.recentEvents - a.recentEvents);
      return next;
    }
    if (sortMode === "activity") {
      next.sort((a, b) => b.recentEvents - a.recentEvents || b.transactions - a.transactions);
      return next;
    }
    if (sortMode === "name") {
      next.sort((a, b) =>
        String(a.tenant_name || "").localeCompare(String(b.tenant_name || ""), undefined, {
          sensitivity: "base",
        })
      );
      return next;
    }
    return next;
  }, [healthFilter, operationalRows, sortMode]);

  return (
    <div className="admin-card">
      <div className="admin-ops-toolbar">
        <form
          className="admin-search admin-search--top"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchQuery(String(queryInput || "").trim());
          }}
        >
          <Icon name="search" size={16} />
          <input
            type="search"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="Filter rows in this view by workspace name, slug, or email"
            aria-label="Filter tenant operations"
          />
        </form>
        <div className="admin-ops-toolbar-actions">
          <label htmlFor="admin-ops-sort">Sort</label>
          <select
            id="admin-ops-sort"
            value={sortMode}
            onChange={(event) => setSortMode(String(event.target.value || "signal"))}
          >
            <option value="signal">By signal</option>
            <option value="health">By health risk</option>
            <option value="activity">By activity</option>
            <option value="name">By name</option>
          </select>
          <button type="button" className="btn-secondary" onClick={loadOperationRows} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-finance-summary">
        <div className="admin-finance-card">
          <span>Total tenants</span>
          <strong>{formatCount(summary.total)}</strong>
        </div>
        <div className="admin-finance-card">
          <span>Healthy</span>
          <strong>{formatCount(summary.healthy)}</strong>
        </div>
        <div className="admin-finance-card">
          <span>Watch</span>
          <strong>{formatCount(summary.warning)}</strong>
        </div>
        <div className="admin-finance-card">
          <span>Needs attention</span>
          <strong>{formatCount(summary.critical)}</strong>
        </div>
      </div>

      <div className="admin-ops-filter-chips" role="tablist" aria-label="Health filters">
        <button
          type="button"
          className={`admin-ops-filter-chip ${healthFilter === "all" ? "is-active" : ""}`}
          onClick={() => setHealthFilter("all")}
        >
          All <strong>{formatCount(summary.total)}</strong>
        </button>
        <button
          type="button"
          className={`admin-ops-filter-chip ${healthFilter === "healthy" ? "is-active is-good" : "is-good"}`}
          onClick={() => setHealthFilter("healthy")}
        >
          Healthy <strong>{formatCount(summary.healthy)}</strong>
        </button>
        <button
          type="button"
          className={`admin-ops-filter-chip ${healthFilter === "watch" ? "is-active is-warning" : "is-warning"}`}
          onClick={() => setHealthFilter("watch")}
        >
          Watch <strong>{formatCount(summary.warning)}</strong>
        </button>
        <button
          type="button"
          className={`admin-ops-filter-chip ${
            healthFilter === "attention" ? "is-active is-critical" : "is-critical"
          }`}
          onClick={() => setHealthFilter("attention")}
        >
          Needs attention <strong>{formatCount(summary.critical)}</strong>
        </button>
      </div>

      {error ? <div className="admin-alert is-error">{error}</div> : null}
      {loading ? (
        <p className="admin-help">Loading tenant operational view...</p>
      ) : (
        <div className="admin-overview-table-wrap">
          <div className="admin-table admin-table--tenant-ops">
            <div className="admin-table-row admin-table-head">
              <span>Workspace</span>
              <span>Tier</span>
              <span>Health</span>
              <span>Members</span>
              <span>Projects</span>
              <span>Transactions</span>
              <span>{sectionMeta.focusLabel}</span>
              <span>Actions</span>
            </div>
            {filteredOperationalRows.length ? (
              filteredOperationalRows.map((row) => (
                <div className="admin-table-row" key={row.tenant_id}>
                  <span>
                    <strong>{row.tenant_name || "-"}</strong>
                    <small>{row.contact_email || "-"}</small>
                  </span>
                  <span>{row.tier.label}</span>
                  <span>
                    <span className={`internal-admin-ops-chip ${row.health.tone}`}>{row.health.label}</span>
                    <small>{row.latestActivityAt ? formatDateTime(row.latestActivityAt) : "No activity logs"}</small>
                  </span>
                  <span>{formatCount(row.members)}</span>
                  <span>{formatCount(row.projects)}</span>
                  <span>{formatCount(row.transactions)}</span>
                  <span>{row.focusValue}</span>
                  <span className="admin-table-actions admin-ops-actions">
                    <Link className="link-button admin-ops-action-primary" to={`/admin/tenant/${row.tenant_id}`}>
                      Open tenant
                    </Link>
                    <Link className="link-button" to={`/admin/logs?tenantId=${row.tenant_id}`}>
                      Logs
                    </Link>
                  </span>
                </div>
              ))
            ) : (
              <p className="admin-help">No tenants matched this filter.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTenantOverviewPage({ actingTenantId, onSetActingTenantId }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [profile, setProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [profileForm, setProfileForm] = useState({
    name: "",
    tagline: "",
    location: "",
    contact_email: "",
    contact_phone: "",
    is_public: true,
  });
  const [membershipEdits, setMembershipEdits] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMembershipId, setSavingMembershipId] = useState("");
  const [updatingInviteId, setUpdatingInviteId] = useState("");
  const [updatingInviteAction, setUpdatingInviteAction] = useState("");
  const [updatingWorkspaceState, setUpdatingWorkspaceState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTenantSection, setActiveTenantSection] = useState("controls");
  const [collapsedOverviewRows, setCollapsedOverviewRows] = useState({
    controls: false,
    members: false,
    invites: true,
    projects: true,
    transactions: true,
  });

  const isActingThisTenant = Boolean(tenantId && actingTenantId && String(tenantId) === String(actingTenantId));
  const workspaceClosure = profile?.site_data?.workspace_closure || {};
  const workspaceStatus = String(workspaceClosure?.status || "").trim().toLowerCase();
  const isWorkspacePaused = workspaceStatus === "paused";

  const normalizeMemberEdit = (member, sourceEdits = membershipEdits) => {
    const membershipId = String(member?.tenant_membership_id || "").trim();
    const saved = sourceEdits[membershipId] || {};
    return {
      role: String(saved.role || member?.tenant_role || "member").trim().toLowerCase(),
      status: String(saved.status || member?.tenant_status || "active").trim().toLowerCase(),
    };
  };

  const loadTenantOverview = useCallback(async () => {
    if (!tenantId) {
      setError("Tenant ID is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [
        overviewResult,
        profileResult,
        membersResult,
        invitesResult,
        projectsResult,
        transactionsResult,
      ] = await Promise.all([
        getAdminTenantOverview(tenantId),
        getAdminTenantProfile(tenantId),
        getAdminTenantMembers(tenantId, { limit: 100 }),
        getAdminTenantMagicLinkInvites(tenantId, { limit: 200 }),
        getAdminTenantProjects(tenantId, { limit: 80 }),
        getAdminTenantTransactions(tenantId, { limit: 120 }),
      ]);
      setOverview(overviewResult || null);
      setProfile(profileResult || null);
      setProfileForm({
        name: String(profileResult?.tenant_name || overviewResult?.tenant_name || "").trim(),
        tagline: String(profileResult?.tagline || "").trim(),
        location: String(profileResult?.location || overviewResult?.location || "").trim(),
        contact_email: String(profileResult?.contact_email || overviewResult?.contact_email || "").trim(),
        contact_phone: String(profileResult?.contact_phone || "").trim(),
        is_public: profileResult?.is_public !== false,
      });
      setMembers(Array.isArray(membersResult) ? membersResult : []);
      setInvites(Array.isArray(invitesResult) ? invitesResult : []);
      setProjects(Array.isArray(projectsResult) ? projectsResult : []);
      setTransactions(Array.isArray(transactionsResult) ? transactionsResult : []);
      const nextMembershipEdits = {};
      (Array.isArray(membersResult) ? membersResult : []).forEach((member) => {
        const membershipId = String(member?.tenant_membership_id || "").trim();
        if (!membershipId) return;
        nextMembershipEdits[membershipId] = {
          role: String(member?.tenant_role || "member").trim().toLowerCase(),
          status: String(member?.tenant_status || "active").trim().toLowerCase(),
        };
      });
      setMembershipEdits(nextMembershipEdits);
    } catch (loadError) {
      setOverview(null);
      setProfile(null);
      setMembers([]);
      setInvites([]);
      setProjects([]);
      setTransactions([]);
      setError(loadError?.message || "Failed to load tenant overview.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadTenantOverview();
  }, [loadTenantOverview]);

  const handleSaveTenantProfile = async (event) => {
    event.preventDefault();
    if (!tenantId) return;
    setSavingProfile(true);
    setError("");
    setNotice("");
    try {
      await updateAdminTenantProfile(tenantId, {
        name: profileForm.name,
        tagline: profileForm.tagline,
        location: profileForm.location,
        contact_email: profileForm.contact_email,
        contact_phone: profileForm.contact_phone,
        is_public: Boolean(profileForm.is_public),
      });
      setNotice("Tenant profile updated.");
      await loadTenantOverview();
    } catch (saveError) {
      setError(saveError?.message || "Failed to update tenant profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleWorkspacePause = async (pauseValue) => {
    if (!tenantId) return;
    setUpdatingWorkspaceState(true);
    setError("");
    setNotice("");
    try {
      if (pauseValue) {
        await setAdminTenantWorkspacePause(tenantId, {
          pause: true,
          pause_days: 30,
          reason: "Paused by internal admin support",
        });
        setNotice("Workspace paused for 30 days.");
      } else {
        await setAdminTenantWorkspacePause(tenantId, {
          pause: false,
          reason: "Resumed by internal admin support",
        });
        setNotice("Workspace resumed.");
      }
      await loadTenantOverview();
    } catch (stateError) {
      setError(stateError?.message || "Failed to update workspace state.");
    } finally {
      setUpdatingWorkspaceState(false);
    }
  };

  const handleSaveMembership = async (member) => {
    const membershipId = String(member?.tenant_membership_id || "").trim();
    if (!membershipId) return;
    const nextValues = normalizeMemberEdit(member);
    const currentRole = String(member?.tenant_role || "member").trim().toLowerCase();
    const currentStatus = String(member?.tenant_status || "active").trim().toLowerCase();
    if (nextValues.role === currentRole && nextValues.status === currentStatus) {
      return;
    }

    setSavingMembershipId(membershipId);
    setError("");
    setNotice("");
    try {
      await updateAdminTenantMembership(membershipId, {
        tenant_role: nextValues.role,
        tenant_status: nextValues.status,
      });
      setNotice(`Updated member access for ${member?.member_name || "member"}.`);
      await loadTenantOverview();
    } catch (membershipError) {
      setError(membershipError?.message || "Failed to update member access.");
    } finally {
      setSavingMembershipId("");
    }
  };

  const handleResendInvite = async (invite) => {
    const inviteId = String(invite?.id || "").trim();
    if (!inviteId) return;
    setUpdatingInviteId(inviteId);
    setUpdatingInviteAction("resend");
    setError("");
    setNotice("");
    try {
      await resendAdminTenantMagicLinkInvite(inviteId, { expiresInDays: 7 });
      await loadTenantOverview();
      setNotice(`Invite reissued for ${invite?.email || "member"}.`);
    } catch (inviteError) {
      setError(inviteError?.message || "Failed to resend invite.");
    } finally {
      setUpdatingInviteId("");
      setUpdatingInviteAction("");
    }
  };

  const handleRevokeInvite = async (invite) => {
    const inviteId = String(invite?.id || "").trim();
    if (!inviteId) return;
    setUpdatingInviteId(inviteId);
    setUpdatingInviteAction("revoke");
    setError("");
    setNotice("");
    try {
      await cancelAdminTenantMagicLinkInvite(inviteId);
      await loadTenantOverview();
      setNotice(`Invite revoked for ${invite?.email || "member"}.`);
    } catch (inviteError) {
      setError(inviteError?.message || "Failed to revoke invite.");
    } finally {
      setUpdatingInviteId("");
      setUpdatingInviteAction("");
    }
  };

  const toggleOverviewRow = (rowKey) => {
    setCollapsedOverviewRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
  };

  const tenantSectionLinks = useMemo(
    () => [
      {
        key: "controls",
        id: "tenant-section-controls",
        label: "Tenant Controls",
        meta: isWorkspacePaused ? "Paused" : "Active",
      },
      {
        key: "members",
        id: "tenant-section-members",
        label: "Members",
        meta: formatCount(members.length),
      },
      {
        key: "invites",
        id: "tenant-section-invites",
        label: "Magic Link Invites",
        meta: formatCount(invites.length),
      },
      {
        key: "projects",
        id: "tenant-section-projects",
        label: "Projects",
        meta: formatCount(projects.length),
      },
      {
        key: "transactions",
        id: "tenant-section-transactions",
        label: "Transactions",
        meta: formatCount(transactions.length),
      },
    ],
    [invites.length, isWorkspacePaused, members.length, projects.length, transactions.length]
  );

  const handleJumpToTenantSection = (section) => {
    if (!section?.id) return;
    const target = document.getElementById(section.id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveTenantSection(section.key);
  };

  useEffect(() => {
    if (!overview?.tenant_id) return;
    setActiveTenantSection("controls");
  }, [overview?.tenant_id]);

  useEffect(() => {
    if (typeof window === "undefined" || !overview?.tenant_id) return;
    const idToKey = new Map(tenantSectionLinks.map((section) => [section.id, section.key]));
    const sectionElements = tenantSectionLinks
      .map((section) => document.getElementById(section.id))
      .filter(Boolean);
    if (!sectionElements.length) return;

    const scrollRoot = document.querySelector(".internal-admin-main");
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const nextId = visibleEntries[0]?.target?.id;
        if (!nextId) return;
        const nextKey = idToKey.get(nextId);
        if (!nextKey) return;
        setActiveTenantSection(nextKey);
      },
      {
        root: scrollRoot || null,
        rootMargin: "-15% 0px -60% 0px",
        threshold: [0.1, 0.35, 0.65],
      }
    );

    sectionElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [overview?.tenant_id, tenantSectionLinks]);

  return (
    <div className="admin-panel">
      <div className="admin-card">
        <div className="admin-card-header">
          <h3>Tenant Overview</h3>
          <div className="admin-card-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/admin/tenants")}>
              Back to Tenants
            </button>
            <button type="button" className="btn-secondary" onClick={loadTenantOverview} disabled={loading}>
              Refresh
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!tenantId}
              onClick={() => navigate(`/admin/logs?tenantId=${tenantId}`)}
            >
              View Logs
            </button>
            {isActingThisTenant ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onSetActingTenantId(null);
                  setNotice("Impersonation context cleared. You are back in admin mode.");
                }}
              >
                Return to Admin
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={!overview?.tenant_id}
                onClick={() => {
                  if (!overview?.tenant_id) return;
                  onSetActingTenantId(overview.tenant_id);
                  if (overview?.slug) {
                    navigate(`/tenant/${overview.slug}/dashboard`);
                    return;
                  }
                  setNotice("Impersonation context saved. Open a workspace dashboard to continue.");
                }}
              >
                Login as Tenant
              </button>
            )}
          </div>
        </div>

        {notice ? <div className="admin-alert">{notice}</div> : null}
        {error ? <div className="admin-alert is-error">{error}</div> : null}
        {loading ? <p className="admin-help">Loading tenant details...</p> : null}

        {!loading && overview ? (
          <>
            <div className="admin-finance-summary">
              <div className="admin-finance-card">
                <span>Active members</span>
                <strong>{formatCount(overview.active_members_count)}</strong>
              </div>
              <div className="admin-finance-card">
                <span>Projects</span>
                <strong>{formatCount(overview.projects_count)}</strong>
              </div>
              <div className="admin-finance-card">
                <span>Transactions</span>
                <strong>{formatCount(overview.transactions_count)}</strong>
              </div>
              <div className="admin-finance-card">
                <span>Documents</span>
                <strong>{formatCount(overview.documents_count)}</strong>
              </div>
            </div>

            <div className="admin-form-grid">
              <div className="admin-form-field">
                <label>Tenant name</label>
                <input value={overview.tenant_name || "-"} readOnly />
              </div>
              <div className="admin-form-field">
                <label>Location</label>
                <input value={overview.location || "-"} readOnly />
              </div>
              <div className="admin-form-field">
                <label>Created date</label>
                <input value={formatDate(overview.created_at)} readOnly />
              </div>
              <div className="admin-form-field">
                <label>Contact email</label>
                <input value={overview.contact_email || "-"} readOnly />
              </div>
              <div className="admin-form-field">
                <label>Workspace status</label>
                <input value={isWorkspacePaused ? "Paused" : "Active"} readOnly />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {!loading && overview ? (
        <div className="admin-overview-layout">
          <aside className="admin-overview-helper">
            <div className="admin-overview-helper-head">
              <h4>Tenant Sections</h4>
              <p>Jump to any support block for this workspace.</p>
            </div>
            <div className="admin-overview-helper-list">
              {tenantSectionLinks.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className={`admin-overview-helper-link ${
                    activeTenantSection === section.key ? "is-active" : ""
                  }`}
                  onClick={() => handleJumpToTenantSection(section)}
                >
                  <span>{section.label}</span>
                  <strong>{section.meta}</strong>
                </button>
              ))}
            </div>
          </aside>

          <div className="admin-grid admin-overview-rows">
          <div id="tenant-section-controls" className="admin-card admin-overview-row-card">
            <div className="admin-card-header">
              <h3>Tenant Controls</h3>
              <div className="internal-admin-row-head-meta">
                <span className="internal-admin-row-status">{isWorkspacePaused ? "Paused" : "Active"}</span>
                <button
                  type="button"
                  className="internal-admin-row-toggle"
                  aria-expanded={!collapsedOverviewRows.controls}
                  onClick={() => toggleOverviewRow("controls")}
                >
                  <Icon
                    name="chevron"
                    size={13}
                    className={`internal-admin-row-toggle-icon ${
                      collapsedOverviewRows.controls ? "is-collapsed" : ""
                    }`}
                  />
                  <span>{collapsedOverviewRows.controls ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!collapsedOverviewRows.controls ? (
              <div className="internal-admin-row-body">
                <p className="admin-help">
                  Edit workspace profile details and control pause/resume state for support operations.
                </p>
                <form className="admin-form" onSubmit={handleSaveTenantProfile}>
                  <div className="admin-form-grid">
                    <div className="admin-form-field">
                      <label>Workspace name</label>
                      <input
                        value={profileForm.name}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Tagline</label>
                      <input
                        value={profileForm.tagline}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, tagline: event.target.value }))
                        }
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Location</label>
                      <input
                        value={profileForm.location}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, location: event.target.value }))
                        }
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Contact email</label>
                      <input
                        type="email"
                        value={profileForm.contact_email}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, contact_email: event.target.value }))
                        }
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Contact phone</label>
                      <input
                        value={profileForm.contact_phone}
                        onChange={(event) =>
                          setProfileForm((prev) => ({ ...prev, contact_phone: event.target.value }))
                        }
                      />
                    </div>
                    <div className="admin-form-field">
                      <label>Public workspace</label>
                      <select
                        value={profileForm.is_public ? "public" : "private"}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            is_public: String(event.target.value) === "public",
                          }))
                        }
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                  </div>
                  <div className="admin-form-actions">
                    <button type="submit" className="btn-primary" disabled={savingProfile}>
                      {savingProfile ? "Saving..." : "Save workspace details"}
                    </button>
                    {isWorkspacePaused ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={updatingWorkspaceState}
                        onClick={() => handleToggleWorkspacePause(false)}
                      >
                        {updatingWorkspaceState ? "Updating..." : "Resume workspace"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={updatingWorkspaceState}
                        onClick={() => handleToggleWorkspacePause(true)}
                      >
                        {updatingWorkspaceState ? "Updating..." : "Pause workspace (30 days)"}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          <div id="tenant-section-members" className="admin-card admin-overview-row-card">
            <div className="admin-card-header">
              <h3>Members</h3>
              <div className="internal-admin-row-head-meta">
                <span className="internal-admin-row-status">{formatCount(members.length)}</span>
                <button
                  type="button"
                  className="internal-admin-row-toggle"
                  aria-expanded={!collapsedOverviewRows.members}
                  onClick={() => toggleOverviewRow("members")}
                >
                  <Icon
                    name="chevron"
                    size={13}
                    className={`internal-admin-row-toggle-icon ${
                      collapsedOverviewRows.members ? "is-collapsed" : ""
                    }`}
                  />
                  <span>{collapsedOverviewRows.members ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!collapsedOverviewRows.members ? (
              <div className="internal-admin-row-body">
                <div className="admin-overview-table-wrap">
                  <div className="admin-table admin-table--members-overview">
                    <div className="admin-table-row admin-table-head">
                      <span>Name</span>
                      <span>Email</span>
                      <span>Phone</span>
                      <span>Role</span>
                      <span>Status</span>
                      <span>Joined</span>
                      <span>Actions</span>
                    </div>
                    {members.slice(0, 30).map((member) => (
                      <div className="admin-table-row" key={member.tenant_membership_id || member.member_id}>
                        <span>{member.member_name || "-"}</span>
                        <span>{member.email || "-"}</span>
                        <span>{member.phone_number || "-"}</span>
                        <span>
                          <select
                            value={normalizeMemberEdit(member).role}
                            onChange={(event) => {
                              const membershipId = String(member?.tenant_membership_id || "").trim();
                              if (!membershipId) return;
                              setMembershipEdits((prev) => ({
                                ...prev,
                                [membershipId]: {
                                  ...normalizeMemberEdit(member, prev),
                                  role: String(event.target.value || "member").trim().toLowerCase(),
                                },
                              }));
                            }}
                          >
                            <option value="member">member</option>
                            <option value="supervisor">supervisor</option>
                            <option value="project_manager">project_manager</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        </span>
                        <span>
                          <select
                            value={normalizeMemberEdit(member).status}
                            onChange={(event) => {
                              const membershipId = String(member?.tenant_membership_id || "").trim();
                              if (!membershipId) return;
                              setMembershipEdits((prev) => ({
                                ...prev,
                                [membershipId]: {
                                  ...normalizeMemberEdit(member, prev),
                                  status: String(event.target.value || "active").trim().toLowerCase(),
                                },
                              }));
                            }}
                          >
                            <option value="active">active</option>
                            <option value="pending">pending</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </span>
                        <span>{formatDate(member.joined_at)}</span>
                        <span>
                          <button
                            type="button"
                            className="link-button"
                            disabled={savingMembershipId === String(member?.tenant_membership_id || "")}
                            onClick={() => handleSaveMembership(member)}
                          >
                            {savingMembershipId === String(member?.tenant_membership_id || "")
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div id="tenant-section-invites" className="admin-card admin-overview-row-card">
            <div className="admin-card-header">
              <h3>Magic Link Invites</h3>
              <div className="internal-admin-row-head-meta">
                <span className="internal-admin-row-status">{formatCount(invites.length)}</span>
                <button
                  type="button"
                  className="internal-admin-row-toggle"
                  aria-expanded={!collapsedOverviewRows.invites}
                  onClick={() => toggleOverviewRow("invites")}
                >
                  <Icon
                    name="chevron"
                    size={13}
                    className={`internal-admin-row-toggle-icon ${
                      collapsedOverviewRows.invites ? "is-collapsed" : ""
                    }`}
                  />
                  <span>{collapsedOverviewRows.invites ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!collapsedOverviewRows.invites ? (
              <div className="internal-admin-row-body">
                <p className="admin-help">
                  Review pending and historical invite codes, then resend or revoke them from support.
                </p>
                <div className="admin-overview-table-wrap">
                  <div className="admin-table admin-table--invites-overview">
                    <div className="admin-table-row admin-table-head">
                      <span>Email</span>
                      <span>Role</span>
                      <span>Status</span>
                      <span>Invite #</span>
                      <span>Sent</span>
                      <span>Expires</span>
                      <span>Actions</span>
                    </div>
                    {invites.length ? (
                      invites.slice(0, 40).map((invite) => {
                        const inviteId = String(invite?.id || "").trim();
                        const inviteStatus = String(invite?.status || "pending").trim().toLowerCase();
                        const inviteBusy = inviteId && inviteId === updatingInviteId;
                        const canResend = inviteStatus !== "used";
                        const canRevoke = inviteStatus !== "used" && inviteStatus !== "revoked";
                        return (
                          <div className="admin-table-row" key={inviteId || invite?.invite_number || invite?.email}>
                            <span>
                              <strong>{invite?.email || "-"}</strong>
                              <small>{invite?.phone_number || "-"}</small>
                            </span>
                            <span>{toRoleLabel(invite?.role || "member")}</span>
                            <span>{toRoleLabel(invite?.status || "pending")}</span>
                            <span>{invite?.invite_number || "-"}</span>
                            <span>{formatDateTime(invite?.sent_at || invite?.created_at)}</span>
                            <span>{formatDateTime(invite?.expires_at)}</span>
                            <span className="admin-table-actions">
                              <button
                                type="button"
                                className="link-button"
                                disabled={!canResend || inviteBusy}
                                onClick={() => handleResendInvite(invite)}
                              >
                                {inviteBusy && updatingInviteAction === "resend" ? "Resending..." : "Resend"}
                              </button>
                              <button
                                type="button"
                                className="link-button is-danger"
                                disabled={!canRevoke || inviteBusy}
                                onClick={() => handleRevokeInvite(invite)}
                              >
                                {inviteBusy && updatingInviteAction === "revoke" ? "Revoking..." : "Revoke"}
                              </button>
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="admin-help">No invites found for this workspace.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div id="tenant-section-projects" className="admin-card admin-overview-row-card">
            <div className="admin-card-header">
              <h3>Projects</h3>
              <div className="internal-admin-row-head-meta">
                <span className="internal-admin-row-status">{formatCount(projects.length)}</span>
                <button
                  type="button"
                  className="internal-admin-row-toggle"
                  aria-expanded={!collapsedOverviewRows.projects}
                  onClick={() => toggleOverviewRow("projects")}
                >
                  <Icon
                    name="chevron"
                    size={13}
                    className={`internal-admin-row-toggle-icon ${
                      collapsedOverviewRows.projects ? "is-collapsed" : ""
                    }`}
                  />
                  <span>{collapsedOverviewRows.projects ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!collapsedOverviewRows.projects ? (
              <div className="internal-admin-row-body">
                <div className="admin-overview-table-wrap">
                  <div className="admin-table">
                    <div className="admin-table-row admin-table-head">
                      <span>Name</span>
                      <span>Module</span>
                      <span>Status</span>
                      <span>Start</span>
                      <span>Created</span>
                      <span>ID</span>
                    </div>
                    {projects.slice(0, 30).map((project) => (
                      <div className="admin-table-row" key={project.project_id}>
                        <span>{project.project_name || "-"}</span>
                        <span>{project.module_key || "-"}</span>
                        <span>{project.status || "-"}</span>
                        <span>{formatDate(project.start_date)}</span>
                        <span>{formatDate(project.created_at)}</span>
                        <span>{project.project_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div id="tenant-section-transactions" className="admin-card admin-overview-row-card">
            <div className="admin-card-header">
              <h3>Transactions</h3>
              <div className="internal-admin-row-head-meta">
                <span className="internal-admin-row-status">{formatCount(transactions.length)}</span>
                <button
                  type="button"
                  className="internal-admin-row-toggle"
                  aria-expanded={!collapsedOverviewRows.transactions}
                  onClick={() => toggleOverviewRow("transactions")}
                >
                  <Icon
                    name="chevron"
                    size={13}
                    className={`internal-admin-row-toggle-icon ${
                      collapsedOverviewRows.transactions ? "is-collapsed" : ""
                    }`}
                  />
                  <span>{collapsedOverviewRows.transactions ? "Expand" : "Collapse"}</span>
                </button>
              </div>
            </div>
            {!collapsedOverviewRows.transactions ? (
              <div className="internal-admin-row-body">
                <div className="admin-overview-table-wrap">
                  <div className="admin-table">
                    <div className="admin-table-row admin-table-head">
                      <span>Type</span>
                      <span>Amount</span>
                      <span>Occurred</span>
                      <span>Project</span>
                      <span>Member</span>
                      <span>Details</span>
                    </div>
                    {transactions.slice(0, 40).map((row) => (
                      <div className="admin-table-row" key={`${row.source}-${row.transaction_id}`}>
                        <span>{row.source || "-"}</span>
                        <span>{formatAmount(row.amount)}</span>
                        <span>{formatDateTime(row.occurred_at)}</span>
                        <span>{row.project_id || "-"}</span>
                        <span>{row.member_id || "-"}</span>
                        <span>{row.details || "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminMembersPage() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [rows, setRows] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadTenants = async () => {
      setLoadingTenants(true);
      setError("");
      try {
        const tenantRows = await getAdminTenants({ limit: 300 });
        if (!active) return;
        setTenants(Array.isArray(tenantRows) ? tenantRows : []);
        if (Array.isArray(tenantRows) && tenantRows.length) {
          setSelectedTenantId((current) => current || String(tenantRows[0].tenant_id || ""));
        }
      } catch (loadError) {
        if (!active) return;
        setTenants([]);
        setError(loadError?.message || "Failed to load tenant options.");
      } finally {
        if (active) setLoadingTenants(false);
      }
    };
    loadTenants();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMembers = async () => {
      if (!selectedTenantId) {
        setRows([]);
        setLoadingMembers(false);
        return;
      }
      setLoadingMembers(true);
      setError("");
      try {
        const memberRows = await getAdminTenantMembers(selectedTenantId, { limit: 300 });
        if (!active) return;
        setRows(Array.isArray(memberRows) ? memberRows : []);
      } catch (loadError) {
        if (!active) return;
        setRows([]);
        setError(loadError?.message || "Failed to load members.");
      } finally {
        if (active) setLoadingMembers(false);
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [selectedTenantId]);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Members</h3>
        <span>{formatCount(rows.length)}</span>
      </div>
      <p className="admin-help">Browse member records for any tenant workspace.</p>

      <div className="admin-form-grid">
        <div className="admin-form-field">
          <label>Workspace</label>
          <select
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(String(event.target.value || ""))}
            disabled={loadingTenants}
          >
            {!tenants.length ? <option value="">No workspaces found</option> : null}
            {tenants.map((tenant) => (
              <option key={tenant.tenant_id} value={tenant.tenant_id}>
                {tenant.tenant_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="admin-alert is-error">{error}</div> : null}
      {loadingMembers ? (
        <p className="admin-help">Loading members...</p>
      ) : (
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Phone</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
          </div>
          {rows.length ? (
            rows.map((member) => (
              <div className="admin-table-row" key={member.tenant_membership_id || member.member_id}>
                <span>{member.member_name || "-"}</span>
                <span>{member.email || "-"}</span>
                <span>{member.phone_number || "-"}</span>
                <span>{member.tenant_role || "-"}</span>
                <span>{member.tenant_status || "-"}</span>
                <span>{formatDate(member.joined_at)}</span>
              </div>
            ))
          ) : (
            <p className="admin-help">No members found for this workspace.</p>
          )}
        </div>
      )}
    </div>
  );
}

function AdminLogsPage() {
  const [searchParams] = useSearchParams();
  const [tenants, setTenants] = useState([]);
  const [tenantFilter, setTenantFilter] = useState(() =>
    String(searchParams.get("tenantId") || "").trim()
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadTenants = async () => {
      try {
        const tenantRows = await getAdminTenants({ limit: 300 });
        if (!active) return;
        setTenants(Array.isArray(tenantRows) ? tenantRows : []);
      } catch {
        if (!active) return;
        setTenants([]);
      }
    };
    loadTenants();
    return () => {
      active = false;
    };
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const logRows = await getAdminActivityLogs({
        tenant_id: tenantFilter || null,
        limit: 250,
      });
      setRows(Array.isArray(logRows) ? logRows : []);
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || "Failed to load logs.");
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h3>Activity Logs</h3>
        <button type="button" className="btn-secondary" onClick={loadLogs} disabled={loading}>
          Refresh
        </button>
      </div>
      <p className="admin-help">
        Audit trail of key events such as member creation, expense capture, project setup, and document uploads.
      </p>

      <div className="admin-form-grid">
        <div className="admin-form-field">
          <label>Filter by workspace</label>
          <select value={tenantFilter} onChange={(event) => setTenantFilter(String(event.target.value || ""))}>
            <option value="">All workspaces</option>
            {tenants.map((tenant) => (
              <option key={tenant.tenant_id} value={tenant.tenant_id}>
                {tenant.tenant_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <div className="admin-alert is-error">{error}</div> : null}
      {loading ? (
        <p className="admin-help">Loading logs...</p>
      ) : (
        <div className="admin-table">
          <div className="admin-table-row admin-table-head">
            <span>Time</span>
            <span>Workspace</span>
            <span>Action</span>
            <span>Entity</span>
            <span>Actor</span>
            <span>ID</span>
          </div>
          {rows.length ? (
            rows.map((log) => (
              <div className="admin-table-row" key={log.log_id}>
                <span>{formatDateTime(log.created_at)}</span>
                <span>{log.tenant_name || "-"}</span>
                <span>{log.action || "-"}</span>
                <span>{log.entity || "-"}</span>
                <span>{log.actor_name || "System"}</span>
                <span>{log.entity_id || "-"}</span>
              </div>
            ))
          ) : (
            <p className="admin-help">No activity logs yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function InternalAdminPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const shellDrawerRef = useRef(null);
  const shellConsoleRef = useRef(null);
  const shellInputRef = useRef(null);
  const shellMenuRef = useRef(null);
  const shellBootstrappedRef = useRef(false);
  const shellHistoryInFlightRef = useRef(false);
  const shellResizeRef = useRef({
    active: false,
    startY: 0,
    startHeight: INTERNAL_ADMIN_SHELL_DEFAULT_HEIGHT,
  });
  const shellColumnResizeRef = useRef({
    active: false,
    startX: 0,
    startRight: INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT,
  });
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [access, setAccess] = useState({ allowed: false, role: null, email: null });
  const [error, setError] = useState("");
  const [actingTenantId, setActingTenantId] = useState(() => getAdminActingTenantId());
  const [globalSearchInput, setGlobalSearchInput] = useState("");
  const [isShellDrawerOpen, setIsShellDrawerOpen] = useState(false);
  const [shellSession, setShellSession] = useState(null);
  const [shellSessionId, setShellSessionId] = useState(() => readStoredActiveShellTerminalId());
  const [shellOutputRows, setShellOutputRows] = useState([]);
  const [shellCommands, setShellCommands] = useState([]);
  const [shellAfterId, setShellAfterId] = useState(0);
  const [shellInput, setShellInput] = useState("");
  const [shellHistoryCursor, setShellHistoryCursor] = useState(-1);
  const [shellHistoryDraft, setShellHistoryDraft] = useState("");
  const [shellLastSyncAt, setShellLastSyncAt] = useState("");
  const [shellStarting, setShellStarting] = useState(false);
  const [shellRefreshing, setShellRefreshing] = useState(false);
  const [shellRunning, setShellRunning] = useState(false);
  const [shellCancellingCommandId, setShellCancellingCommandId] = useState("");
  const [shellError, setShellError] = useState("");
  const [shellNotice, setShellNotice] = useState("");
  const [shellHiddenBeforeOutputId, setShellHiddenBeforeOutputId] = useState(0);
  const [shellTerminals, setShellTerminals] = useState(() => readStoredShellTerminals());
  const [activeShellTerminalId, setActiveShellTerminalId] = useState(() =>
    readStoredActiveShellTerminalId()
  );
  const [isShellMenuOpen, setIsShellMenuOpen] = useState(false);
  const [shellDrawerHeight, setShellDrawerHeight] = useState(() => {
    if (typeof window === "undefined") return INTERNAL_ADMIN_SHELL_DEFAULT_HEIGHT;
    const storedHeight = Number.parseInt(
      String(window.localStorage.getItem(INTERNAL_ADMIN_SHELL_HEIGHT_KEY) || ""),
      10
    );
    if (!Number.isFinite(storedHeight) || storedHeight < INTERNAL_ADMIN_SHELL_MIN_HEIGHT) {
      return INTERNAL_ADMIN_SHELL_DEFAULT_HEIGHT;
    }
    return storedHeight;
  });
  const [shellIsResizing, setShellIsResizing] = useState(false);
  const [shellIsColumnResizing, setShellIsColumnResizing] = useState(false);
  const [shellLayout, setShellLayout] = useState(() => {
    if (typeof window === "undefined") {
      return {
        right: INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT,
      };
    }
    try {
      const parsed = JSON.parse(
        String(window.localStorage.getItem(INTERNAL_ADMIN_SHELL_LAYOUT_KEY) || "{}")
      );
      const right = Number.parseInt(String(parsed?.right || ""), 10);
      return {
        right:
          Number.isFinite(right) && right >= INTERNAL_ADMIN_SHELL_RIGHT_MIN
            ? right
            : INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT,
      };
    } catch {
      return {
        right: INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT,
      };
    }
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return String(window.localStorage.getItem(INTERNAL_ADMIN_SIDEBAR_COLLAPSED_KEY) || "") === "1";
  });

  useEffect(() => {
    let active = true;
    const loadAdminContext = async () => {
      setLoading(true);
      setError("");
      try {
        const [currentMember, adminAccess] = await Promise.all([
          getCurrentMember(),
          getInternalAdminAccess(),
        ]);
        if (!active) return;
        setMember(currentMember || null);
        setAccess(adminAccess || { allowed: false, role: null, email: null });
      } catch (loadError) {
        if (!active) return;
        setMember(null);
        setAccess({ allowed: false, role: null, email: null });
        setError(loadError?.message || "Failed to verify admin access.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAdminContext();
    return () => {
      active = false;
    };
  }, []);

  const activeNavKey = useMemo(() => getNavActiveKey(location.pathname), [location.pathname]);
  const activeTenantHubKey = useMemo(
    () => getActiveTenantHubKey(location.pathname),
    [location.pathname]
  );
  const activeTenantHubMeta = useMemo(() => {
    if (!activeTenantHubKey) return null;
    return TENANT_HUB_NAV_ITEMS.find((item) => item.key === activeTenantHubKey) || null;
  }, [activeTenantHubKey]);
  const activeSectionTitle = useMemo(() => {
    if (location.pathname.startsWith("/admin/ops/")) {
      return activeTenantHubMeta?.title || "Tenant Operations";
    }
    if (location.pathname.startsWith("/admin/tenant/")) return "Tenant Overview";
    if (activeNavKey === "members") return "Members";
    if (activeNavKey === "logs") return "Activity Logs";
    return "Tenants";
  }, [activeNavKey, activeTenantHubMeta, location.pathname]);
  const activeSectionHint = useMemo(() => {
    if (location.pathname.startsWith("/admin/ops/")) {
      return (
        activeTenantHubMeta?.hint ||
        "Cross-tenant operations view for workspace health, quota posture, and support signals."
      );
    }
    if (location.pathname.startsWith("/admin/tenant/")) {
      return "Support controls for one workspace: profile, members, invites, projects, and transactions.";
    }
    if (activeNavKey === "members") {
      return "Cross-tenant member lookup and role visibility.";
    }
    if (activeNavKey === "logs") {
      return "System-wide operational audit events.";
    }
    return "Search, filter, and open workspace support pages.";
  }, [activeNavKey, activeTenantHubMeta, location.pathname]);

  const clampShellDrawerHeight = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return INTERNAL_ADMIN_SHELL_DEFAULT_HEIGHT;
    }
    if (typeof window === "undefined") {
      return Math.max(INTERNAL_ADMIN_SHELL_MIN_HEIGHT, Math.round(numeric));
    }
    const viewportLimit = Math.max(
      INTERNAL_ADMIN_SHELL_MIN_HEIGHT,
      Math.floor(window.innerHeight * INTERNAL_ADMIN_SHELL_MAX_VIEWPORT_RATIO)
    );
    return Math.max(INTERNAL_ADMIN_SHELL_MIN_HEIGHT, Math.min(viewportLimit, Math.round(numeric)));
  }, []);

  const clampShellLayout = useCallback((layout) => {
    const nextRight = Number(layout?.right);
    let right = Number.isFinite(nextRight) ? Math.round(nextRight) : INTERNAL_ADMIN_SHELL_RIGHT_DEFAULT;

    right = Math.max(INTERNAL_ADMIN_SHELL_RIGHT_MIN, right);

    if (typeof window !== "undefined") {
      const availableWidth = Math.max(960, window.innerWidth - 24);
      const splitters = INTERNAL_ADMIN_SHELL_SPLITTER_WIDTH;
      const requiredMinimum =
        INTERNAL_ADMIN_SHELL_TERMINAL_MIN + INTERNAL_ADMIN_SHELL_RIGHT_MIN + splitters;

      if (availableWidth <= requiredMinimum) {
        return {
          right: INTERNAL_ADMIN_SHELL_RIGHT_MIN,
        };
      }

      const maxRight = Math.max(
        INTERNAL_ADMIN_SHELL_RIGHT_MIN,
        availableWidth - INTERNAL_ADMIN_SHELL_TERMINAL_MIN - splitters
      );
      if (right > maxRight) {
        right = maxRight;
      }
    }

    return { right };
  }, []);

  const visibleShellOutputRows = useMemo(
    () =>
      shellOutputRows.filter((row) => {
        const id = Number(row?.id || 0);
        return id > shellHiddenBeforeOutputId;
      }),
    [shellHiddenBeforeOutputId, shellOutputRows]
  );

  const activeShellTerminal = useMemo(() => {
    const targetId = String(activeShellTerminalId || shellSessionId || "").trim();
    if (!targetId) return null;
    return shellTerminals.find((terminal) => String(terminal?.sessionId || "") === targetId) || null;
  }, [activeShellTerminalId, shellSessionId, shellTerminals]);
  const shellCommandHistory = useMemo(() => {
    const seen = new Set();
    const rows = [];
    shellCommands.forEach((command) => {
      const value = String(command?.command_text || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      rows.push(value);
    });
    return rows;
  }, [shellCommands]);

  const runningShellCommand = useMemo(
    () => shellCommands.find((command) => isShellCommandActive(command)) || null,
    [shellCommands]
  );
  const latestShellCommand = useMemo(() => (shellCommands.length ? shellCommands[0] : null), [shellCommands]);
  const shellConnectionLabel = shellSessionId ? "Connected" : shellStarting ? "Connecting" : "Offline";
  const shellConnectionToneClass = shellSessionId
    ? "is-connected"
    : shellStarting
      ? "is-connecting"
      : "is-offline";
  const shellPromptLabel = useMemo(() => {
    const email = String(member?.email || access?.email || "admin@habuks.com")
      .trim()
      .toLowerCase();
    const identity = email.split("@")[0] || "admin";
    return `${identity}@habuks:~$`;
  }, [access?.email, member?.email]);

  const resetShellHistoryNavigation = useCallback(() => {
    setShellHistoryCursor(-1);
    setShellHistoryDraft("");
  }, []);

  const mergeShellOutput = useCallback((rows, options = {}) => {
    const replace = options?.replace === true;
    const normalizedRows = (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        id: Number(row?.id || 0),
        command_id: row?.command_id || null,
        stream: String(row?.stream || "system").trim().toLowerCase(),
        content: String(row?.content || ""),
        created_at: row?.created_at || null,
      }))
      .filter((row) => row.id > 0);

    setShellOutputRows((prevRows) => {
      const map = new Map();
      if (!replace) {
        prevRows.forEach((row) => {
          const id = Number(row?.id || 0);
          if (id > 0) map.set(id, row);
        });
      }
      normalizedRows.forEach((row) => {
        map.set(row.id, row);
      });
      const merged = Array.from(map.values()).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
      return merged.slice(-INTERNAL_ADMIN_SHELL_MAX_LINES);
    });

    if (replace && !normalizedRows.length) {
      setShellAfterId(0);
      return;
    }

    const maxIncomingId = normalizedRows.reduce((maxId, row) => Math.max(maxId, Number(row.id || 0)), 0);
    if (maxIncomingId > 0) {
      setShellAfterId((prev) => (maxIncomingId > prev ? maxIncomingId : prev));
    }
  }, []);

  const mergeShellCommands = useCallback((commands, options = {}) => {
    const replace = options?.replace === true;
    const incoming = (Array.isArray(commands) ? commands : []).filter(Boolean);
    setShellCommands((prevRows) => {
      const map = new Map();
      const baseRows = replace ? [] : prevRows;
      baseRows.forEach((command) => {
        const id = String(command?.id || "").trim();
        if (id) map.set(id, command);
      });
      incoming.forEach((command) => {
        const id = String(command?.id || "").trim();
        if (!id) return;
        map.set(id, command);
      });
      return Array.from(map.values()).sort(
        (a, b) => Date.parse(String(b?.created_at || "")) - Date.parse(String(a?.created_at || ""))
      );
    });
  }, []);

  const upsertShellTerminal = useCallback((sessionId, patch = {}) => {
    const safeSessionId = String(sessionId || "").trim();
    if (!safeSessionId) return;
    setShellTerminals((previous) => {
      const index = previous.findIndex(
        (terminal) => String(terminal?.sessionId || "").trim() === safeSessionId
      );
      if (index >= 0) {
        const next = [...previous];
        next[index] = {
          ...next[index],
          ...patch,
          id: safeSessionId,
          sessionId: safeSessionId,
        };
        return next;
      }
      const nextTerminal = {
        id: safeSessionId,
        sessionId: safeSessionId,
        label: "bash",
        status: "open",
        createdAt: new Date().toISOString(),
        lastSyncAt: "",
        latestCommand: "",
        latestStatus: "",
        ...patch,
      };
      return [...previous, nextTerminal].slice(-INTERNAL_ADMIN_SHELL_MAX_TERMINALS);
    });
  }, []);

  const bootstrapShellSession = useCallback(
    async ({ forceNew = false } = {}) => {
      if (shellStarting) {
        return shellSessionId;
      }

      setShellStarting(true);
      setShellError("");
      setShellNotice("");

      if (forceNew) {
        setShellSession(null);
        setShellSessionId("");
        setShellAfterId(0);
        setShellHiddenBeforeOutputId(0);
        resetShellHistoryNavigation();
        mergeShellOutput([], { replace: true });
        mergeShellCommands([], { replace: true });
      }

      try {
        const started = await startAdminShellSession({
          sessionId: forceNew ? null : shellSessionId || null,
          tenantId: actingTenantId || null,
          title: "Internal admin console",
        });
        const nextSession = started?.session || null;
        const nextSessionId = String(nextSession?.id || "").trim();
        if (!nextSessionId) {
          throw new Error("Shell session did not return a session id.");
        }

        setShellSession(nextSession);
        setShellSessionId(nextSessionId);
        mergeShellOutput(started?.output, { replace: forceNew });

        const history = await getAdminShellHistory({
          sessionId: nextSessionId,
          afterId: 0,
          limit: INTERNAL_ADMIN_SHELL_MAX_LINES,
        });

        if (history?.session) {
          setShellSession(history.session);
        }
        mergeShellCommands(history?.commands, { replace: true });
        mergeShellOutput(history?.output, { replace: true });
        const nextAfterId = Number(history?.next_after_id || 0);
        if (Number.isFinite(nextAfterId) && nextAfterId >= 0) {
          setShellAfterId(nextAfterId);
        }
        const syncedAt = new Date().toISOString();
        setShellLastSyncAt(syncedAt);
        upsertShellTerminal(nextSessionId, {
          status: String(history?.session?.status || nextSession?.status || "open")
            .trim()
            .toLowerCase(),
          lastSyncAt: syncedAt,
          latestCommand: String(history?.commands?.[0]?.command_text || "").trim(),
          latestStatus: String(history?.commands?.[0]?.status || "").trim().toLowerCase(),
        });
        setActiveShellTerminalId(nextSessionId);
        setShellNotice(forceNew ? "Started a fresh shell session." : "Shell session connected.");
        return nextSessionId;
      } catch (sessionError) {
        setShellError(sessionError?.message || "Failed to start shell session.");
        return "";
      } finally {
        setShellStarting(false);
      }
    },
    [
      actingTenantId,
      mergeShellCommands,
      mergeShellOutput,
      resetShellHistoryNavigation,
      shellSessionId,
      shellStarting,
      upsertShellTerminal,
    ]
  );

  const refreshShellHistory = useCallback(
    async ({ silent = false } = {}) => {
      if (!shellSessionId || shellHistoryInFlightRef.current) {
        return;
      }
      shellHistoryInFlightRef.current = true;
      if (!silent) {
        setShellRefreshing(true);
        setShellError("");
      }
      try {
        const history = await getAdminShellHistory({
          sessionId: shellSessionId,
          afterId: shellAfterId,
          limit: 120,
        });
        if (history?.session) {
          setShellSession(history.session);
        }
        mergeShellCommands(history?.commands, { replace: true });
        mergeShellOutput(history?.output);
        const nextAfterId = Number(history?.next_after_id || 0);
        if (Number.isFinite(nextAfterId) && nextAfterId >= 0) {
          setShellAfterId((prev) => (nextAfterId > prev ? nextAfterId : prev));
        }
        const syncedAt = new Date().toISOString();
        setShellLastSyncAt(syncedAt);
        upsertShellTerminal(shellSessionId, {
          status: String(history?.session?.status || "open")
            .trim()
            .toLowerCase(),
          lastSyncAt: syncedAt,
          latestCommand: String(history?.commands?.[0]?.command_text || "").trim(),
          latestStatus: String(history?.commands?.[0]?.status || "").trim().toLowerCase(),
        });
      } catch (historyError) {
        if (!silent) {
          setShellError(historyError?.message || "Failed to refresh shell history.");
        }
      } finally {
        if (!silent) {
          setShellRefreshing(false);
        }
        shellHistoryInFlightRef.current = false;
      }
    },
    [mergeShellCommands, mergeShellOutput, shellAfterId, shellSessionId, upsertShellTerminal]
  );

  useEffect(() => {
    if (!location.pathname.startsWith("/admin/tenants")) return;
    const params = new URLSearchParams(location.search);
    setGlobalSearchInput(String(params.get("q") || "").trim());
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      INTERNAL_ADMIN_SIDEBAR_COLLAPSED_KEY,
      isSidebarCollapsed ? "1" : "0"
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(INTERNAL_ADMIN_SHELL_HEIGHT_KEY, String(shellDrawerHeight));
  }, [shellDrawerHeight]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      INTERNAL_ADMIN_SHELL_LAYOUT_KEY,
      JSON.stringify(shellLayout)
    );
  }, [shellLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shellTerminals.length) {
      window.localStorage.removeItem(INTERNAL_ADMIN_SHELL_TERMINALS_KEY);
      return;
    }
    const serialized = shellTerminals
      .slice(-INTERNAL_ADMIN_SHELL_MAX_TERMINALS)
      .map((terminal) => ({
        id: String(terminal?.sessionId || terminal?.id || "").trim(),
        sessionId: String(terminal?.sessionId || terminal?.id || "").trim(),
        label: String(terminal?.label || "bash").trim() || "bash",
        status: String(terminal?.status || "open").trim().toLowerCase(),
        createdAt: terminal?.createdAt || "",
        lastSyncAt: terminal?.lastSyncAt || "",
        latestCommand: String(terminal?.latestCommand || "").trim(),
        latestStatus: String(terminal?.latestStatus || "").trim().toLowerCase(),
      }))
      .filter((terminal) => terminal.sessionId);
    window.localStorage.setItem(INTERNAL_ADMIN_SHELL_TERMINALS_KEY, JSON.stringify(serialized));
  }, [shellTerminals]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferredId = String(activeShellTerminalId || shellSessionId || "").trim();
    if (!preferredId) {
      window.localStorage.removeItem(INTERNAL_ADMIN_SHELL_ACTIVE_TERMINAL_KEY);
      return;
    }
    window.localStorage.setItem(INTERNAL_ADMIN_SHELL_ACTIVE_TERMINAL_KEY, preferredId);
  }, [activeShellTerminalId, shellSessionId]);

  useEffect(() => {
    if (!shellSessionId) return;
    setActiveShellTerminalId((previous) => (previous ? previous : shellSessionId));
    upsertShellTerminal(shellSessionId, {
      status: String(shellSession?.status || "open")
        .trim()
        .toLowerCase(),
    });
  }, [shellSession?.status, shellSessionId, upsertShellTerminal]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleWindowResize = () => {
      setShellDrawerHeight((previous) => clampShellDrawerHeight(previous));
      setShellLayout((previous) => clampShellLayout(previous));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [clampShellDrawerHeight, clampShellLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePointerMove = (event) => {
      const state = shellResizeRef.current;
      if (!state.active) return;
      const delta = state.startY - event.clientY;
      setShellDrawerHeight(clampShellDrawerHeight(state.startHeight + delta));
    };
    const stopResize = () => {
      if (!shellResizeRef.current.active) return;
      shellResizeRef.current = {
        active: false,
        startY: 0,
        startHeight: shellDrawerHeight,
      };
      setShellIsResizing(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [clampShellDrawerHeight, shellDrawerHeight]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!shellIsResizing && !shellIsColumnResizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = shellIsColumnResizing ? "col-resize" : "ns-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [shellIsColumnResizing, shellIsResizing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePointerMove = (event) => {
      const state = shellColumnResizeRef.current;
      if (!state.active) return;
      const delta = event.clientX - state.startX;
      setShellLayout((previous) =>
        clampShellLayout({
          ...previous,
          right: state.startRight - delta,
        })
      );
    };
    const stopResize = () => {
      if (!shellColumnResizeRef.current.active) return;
      shellColumnResizeRef.current = {
        active: false,
        startX: 0,
        startRight: shellLayout.right,
      };
      setShellIsColumnResizing(false);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [clampShellLayout, shellLayout.right]);

  useEffect(() => {
    if (!isShellMenuOpen || typeof window === "undefined") return;
    const handlePointerDown = (event) => {
      if (shellMenuRef.current?.contains(event.target)) return;
      setIsShellMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isShellMenuOpen]);

  useEffect(() => {
    if (!isShellDrawerOpen) {
      shellBootstrappedRef.current = false;
      shellResizeRef.current = {
        active: false,
        startY: 0,
        startHeight: shellDrawerHeight,
      };
      shellColumnResizeRef.current = {
        active: false,
        startX: 0,
        startRight: shellLayout.right,
      };
      setShellIsResizing(false);
      setShellIsColumnResizing(false);
      setIsShellMenuOpen(false);
      return;
    }
    if (shellBootstrappedRef.current) {
      return;
    }
    shellBootstrappedRef.current = true;
    if (!shellSessionId) {
      bootstrapShellSession();
      return;
    }
    refreshShellHistory();
  }, [
    bootstrapShellSession,
    isShellDrawerOpen,
    refreshShellHistory,
    shellSessionId,
    shellDrawerHeight,
    shellLayout.right,
  ]);

  useEffect(() => {
    if (!isShellDrawerOpen || !shellSessionId || typeof window === "undefined") return undefined;
    const intervalId = window.setInterval(() => {
      refreshShellHistory({ silent: true });
    }, INTERNAL_ADMIN_SHELL_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [isShellDrawerOpen, refreshShellHistory, shellSessionId]);

  useEffect(() => {
    if (!isShellDrawerOpen) return;
    const consoleNode = shellConsoleRef.current;
    if (!consoleNode) return;
    consoleNode.scrollTop = consoleNode.scrollHeight;
  }, [isShellDrawerOpen, visibleShellOutputRows.length]);

  useEffect(() => {
    if (!isShellDrawerOpen || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      shellInputRef.current?.focus();
    });
  }, [activeShellTerminalId, isShellDrawerOpen]);

  useEffect(() => {
    if (!isShellDrawerOpen || typeof window === "undefined") return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (isShellMenuOpen) {
          setIsShellMenuOpen(false);
          return;
        }
        setIsShellDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isShellDrawerOpen, isShellMenuOpen]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin workspace...</p>
      </div>
    );
  }

  if (!member) {
    return <Navigate to="/login" replace />;
  }

  if (!access?.allowed) {
    return (
      <div className="dashboard-layout" style={{ "--dashboard-sidebar-width": "0px" }}>
        <main className="dashboard-main" style={{ marginLeft: 0 }}>
          <section className="dashboard-content" style={{ paddingTop: "2rem" }}>
            <div className="admin-card">
              <h3>Admin access required</h3>
              <p className="admin-help">
                Your account is signed in but is not allowlisted in <code>admin_users</code>.
              </p>
              {error ? <div className="admin-alert is-error">{error}</div> : null}
              <div className="admin-form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const lastSlug =
                      typeof window !== "undefined"
                        ? String(window.localStorage.getItem("lastTenantSlug") || "").trim()
                        : "";
                    navigate(lastSlug ? `/tenant/${lastSlug}/dashboard` : "/dashboard");
                  }}
                >
                  Go to Dashboard
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={async () => {
                    await signOut();
                    navigate("/login");
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const setActingTenant = (tenantId) => {
    setAdminActingTenantId(tenantId);
    setActingTenantId(getAdminActingTenantId());
  };

  const getShellLineClassName = (stream) => {
    const normalized = String(stream || "system").trim().toLowerCase();
    if (normalized === "stdin") return "internal-admin-shell-line is-stdin";
    if (normalized === "stdout") return "internal-admin-shell-line is-stdout";
    if (normalized === "stderr") return "internal-admin-shell-line is-stderr";
    return "internal-admin-shell-line is-system";
  };

  const handleShellResizePointerDown = (event) => {
    if (!isShellDrawerOpen) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    event.preventDefault();
    shellResizeRef.current = {
      active: true,
      startY: event.clientY,
      startHeight: shellDrawerHeight,
    };
    setShellIsResizing(true);
  };

  const handleShellColumnResizePointerDown = (event) => {
    if (!isShellDrawerOpen) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    event.preventDefault();
    shellColumnResizeRef.current = {
      active: true,
      startX: event.clientX,
      startRight: shellLayout.right,
    };
    setShellIsColumnResizing(true);
  };

  const handleShellCreateTerminal = async () => {
    resetShellHistoryNavigation();
    setShellInput("");
    await bootstrapShellSession({ forceNew: true });
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        shellInputRef.current?.focus();
      });
    }
  };

  const handleShellSwitchTerminal = async (terminalSessionId) => {
    const nextSessionId = String(terminalSessionId || "").trim();
    if (!nextSessionId || shellStarting) return;
    if (nextSessionId === shellSessionId) return;

    resetShellHistoryNavigation();
    setShellInput("");
    setActiveShellTerminalId(nextSessionId);
    setShellStarting(true);
    setShellRefreshing(true);
    setShellError("");
    setShellNotice("");
    setShellHiddenBeforeOutputId(0);

    try {
      const started = await startAdminShellSession({ sessionId: nextSessionId });
      const resolvedSession = started?.session || null;
      const resolvedSessionId = String(resolvedSession?.id || nextSessionId).trim();
      if (!resolvedSessionId) {
        throw new Error("Unable to resolve terminal session.");
      }

      setShellSession(resolvedSession);
      setShellSessionId(resolvedSessionId);
      mergeShellCommands([], { replace: true });
      mergeShellOutput([], { replace: true });

      const history = await getAdminShellHistory({
        sessionId: resolvedSessionId,
        afterId: 0,
        limit: INTERNAL_ADMIN_SHELL_MAX_LINES,
      });
      if (history?.session) {
        setShellSession(history.session);
      }
      mergeShellCommands(history?.commands, { replace: true });
      mergeShellOutput(history?.output, { replace: true });
      const nextAfterId = Number(history?.next_after_id || 0);
      setShellAfterId(Number.isFinite(nextAfterId) && nextAfterId >= 0 ? nextAfterId : 0);
      const syncedAt = new Date().toISOString();
      setShellLastSyncAt(syncedAt);
      upsertShellTerminal(resolvedSessionId, {
        status: String(history?.session?.status || "open")
          .trim()
          .toLowerCase(),
        lastSyncAt: syncedAt,
        latestCommand: String(history?.commands?.[0]?.command_text || "").trim(),
        latestStatus: String(history?.commands?.[0]?.status || "").trim().toLowerCase(),
      });
      setActiveShellTerminalId(resolvedSessionId);
      setShellNotice("Switched terminal session.");
    } catch (switchError) {
      setShellError(switchError?.message || "Failed to switch terminal.");
    } finally {
      setShellStarting(false);
      setShellRefreshing(false);
    }
  };

  const handleShellRefresh = async () => {
    setShellNotice("");
    setShellError("");
    if (!shellSessionId) {
      await bootstrapShellSession();
      return;
    }
    await refreshShellHistory();
  };

  const handleShellMenuAction = async (action) => {
    setIsShellMenuOpen(false);
    if (action === "refresh") {
      await handleShellRefresh();
      return;
    }
    if (action === "cancel") {
      await handleShellCancel();
    }
  };

  const handleShellInputChange = (event) => {
    const value = String(event?.target?.value || "");
    setShellInput(value);
    if (shellHistoryCursor !== -1) {
      resetShellHistoryNavigation();
    }
  };

  const handleShellInputKeyDown = (event) => {
    if (shellRunning || shellStarting) return;
    if (!shellCommandHistory.length) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextCursor = Math.min(shellHistoryCursor + 1, shellCommandHistory.length - 1);
      if (nextCursor === shellHistoryCursor) return;
      if (shellHistoryCursor === -1) {
        setShellHistoryDraft(shellInput);
      }
      setShellHistoryCursor(nextCursor);
      setShellInput(shellCommandHistory[nextCursor] || "");
      return;
    }

    if (event.key === "ArrowDown") {
      if (shellHistoryCursor === -1) return;
      event.preventDefault();
      const nextCursor = shellHistoryCursor - 1;
      setShellHistoryCursor(nextCursor);
      if (nextCursor === -1) {
        setShellInput(shellHistoryDraft);
        setShellHistoryDraft("");
        return;
      }
      setShellInput(shellCommandHistory[nextCursor] || "");
    }
  };

  const handleShellSubmit = async (event) => {
    event.preventDefault();
    if (shellRunning || shellStarting) {
      return;
    }

    const inputValue = String(shellInput || "").trim();
    const normalizedInput = inputValue.toLowerCase().replace(/\s+/g, " ");
    const isClearCommand = normalizedInput === "clear" || normalizedInput === "cls";
    if (!inputValue) {
      return;
    }

    resetShellHistoryNavigation();

    let resolvedSessionId = shellSessionId;
    if (!resolvedSessionId) {
      resolvedSessionId = await bootstrapShellSession();
    }
    if (!resolvedSessionId) {
      return;
    }

    setShellRunning(true);
    setShellError("");
    setShellNotice("");

    try {
      const inputResult = await inputAdminShellCommand({
        sessionId: resolvedSessionId,
        input: inputValue,
      });
      if (inputResult?.session) {
        setShellSession(inputResult.session);
      }
      mergeShellCommands(inputResult?.command ? [inputResult.command] : [], { replace: false });
      mergeShellOutput(inputResult?.output);

      const commandId = String(inputResult?.command?.id || "").trim();
      const runResult = await runAdminShellCommand(
        commandId
          ? {
              sessionId: resolvedSessionId,
              commandId,
            }
          : {
              sessionId: resolvedSessionId,
              input: inputValue,
            }
      );
      if (runResult?.session) {
        setShellSession(runResult.session);
      }
      mergeShellCommands(runResult?.command ? [runResult.command] : [], { replace: false });
      mergeShellOutput(runResult?.output);
      setShellInput("");
      const syncedAt = new Date().toISOString();
      setShellLastSyncAt(syncedAt);
      upsertShellTerminal(resolvedSessionId, {
        status: String(runResult?.session?.status || "open")
          .trim()
          .toLowerCase(),
        lastSyncAt: syncedAt,
        latestCommand: String(runResult?.command?.command_text || inputValue).trim(),
        latestStatus: String(runResult?.command?.status || "").trim().toLowerCase(),
      });

      if (isClearCommand) {
        const runMaxOutputId = (Array.isArray(runResult?.output) ? runResult.output : []).reduce(
          (maxId, row) => Math.max(maxId, Number(row?.id || 0)),
          0
        );
        const currentMaxOutputId =
          shellOutputRows.length > 0 ? Number(shellOutputRows[shellOutputRows.length - 1]?.id || 0) : 0;
        const boundaryId = Math.max(shellAfterId, runMaxOutputId, currentMaxOutputId);
        setShellHiddenBeforeOutputId(boundaryId);
        setShellNotice("Console cleared.");
        return;
      }

      const commandStatus = normalizeShellCommandStatus(runResult?.command?.status);
      if (commandStatus === "failed") {
        setShellNotice("Command failed. Review stderr output.");
      } else if (commandStatus === "cancelled") {
        setShellNotice("Command cancelled.");
      } else {
        setShellNotice("Command completed.");
      }
      await refreshShellHistory({ silent: true });
    } catch (runError) {
      setShellError(runError?.message || "Failed to execute shell command.");
    } finally {
      setShellRunning(false);
    }
  };

  const handleShellCancel = async () => {
    const commandId = String(runningShellCommand?.id || "").trim();
    if (!shellSessionId || !commandId) {
      return;
    }
    if (shellCancellingCommandId) {
      return;
    }

    setShellCancellingCommandId(commandId);
    setShellError("");
    setShellNotice("");

    try {
      const result = await cancelAdminShellCommand({
        sessionId: shellSessionId,
        commandId,
      });
      mergeShellCommands(result?.command ? [result.command] : [], { replace: false });
      mergeShellOutput(result?.output);
      const syncedAt = new Date().toISOString();
      setShellLastSyncAt(syncedAt);
      upsertShellTerminal(shellSessionId, {
        status: String(shellSession?.status || "open")
          .trim()
          .toLowerCase(),
        lastSyncAt: syncedAt,
        latestCommand: String(result?.command?.command_text || latestShellCommand?.command_text || "").trim(),
        latestStatus: String(result?.command?.status || latestShellCommand?.status || "")
          .trim()
          .toLowerCase(),
      });
      setShellNotice("Cancel request sent.");
      await refreshShellHistory({ silent: true });
    } catch (cancelError) {
      setShellError(cancelError?.message || "Failed to cancel shell command.");
    } finally {
      setShellCancellingCommandId("");
    }
  };

  const handleGlobalSearchSubmit = (event) => {
    event.preventDefault();
    const query = String(globalSearchInput || "").trim();
    const normalized = query.toLowerCase();
    if (!query) {
      navigate("/admin/tenants");
      return;
    }
    if (normalized === "members" || normalized === "member") {
      navigate("/admin/members");
      return;
    }
    if (normalized === "logs" || normalized === "log" || normalized === "activity") {
      navigate("/admin/logs");
      return;
    }
    if (normalized.includes("health") || normalized.includes("troubleshoot")) {
      navigate("/admin/ops/health");
      return;
    }
    if (normalized.includes("quota") || normalized.includes("reservation")) {
      navigate("/admin/ops/quotas");
      return;
    }
    if (normalized.includes("optimiz")) {
      navigate("/admin/ops/optimization");
      return;
    }
    if (normalized.includes("maintenance")) {
      navigate("/admin/ops/maintenance");
      return;
    }
    if (normalized.includes("support")) {
      navigate("/admin/ops/support");
      return;
    }
    if (normalized.includes("deployment")) {
      navigate("/admin/ops/deployments");
      return;
    }
    if (normalized === "tenants" || normalized === "tenant") {
      navigate("/admin/tenants");
      return;
    }
    const isUuidQuery =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query);
    if (isUuidQuery) {
      navigate(`/admin/tenant/${query}`);
      return;
    }
    navigate(`/admin/tenants?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="dashboard-layout" style={{ "--dashboard-sidebar-width": "0px" }}>
      <main className="dashboard-main" style={{ marginLeft: 0 }}>
        <section className="dashboard-content internal-admin-shell">
          <header className="internal-admin-topbar">
            <button
              type="button"
              className="internal-admin-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name="menu" size={16} />
            </button>

            <div className="internal-admin-brand">
              <span className="internal-admin-brand-mark">
                <Icon name="layers" size={16} />
              </span>
              <div className="internal-admin-brand-copy">
                <strong>Habuks Console</strong>
                <small>Internal Admin</small>
              </div>
            </div>

            <form className="internal-admin-global-search" onSubmit={handleGlobalSearchSubmit}>
              <Icon name="search" size={16} />
              <input
                type="search"
                value={globalSearchInput}
                onChange={(event) => setGlobalSearchInput(event.target.value)}
                placeholder="Search tenants, route names, or tenant UUID"
                aria-label="Global search"
              />
              <button type="submit" className="btn-secondary">
                Search
              </button>
            </form>

            <div className="internal-admin-topbar-actions">
              {actingTenantId ? (
                <button type="button" className="btn-secondary" onClick={() => setActingTenant(null)}>
                  Exit Impersonation
                </button>
              ) : null}
              <button
                type="button"
                className={`btn-secondary internal-admin-shell-launch ${
                  isShellDrawerOpen ? "is-active" : ""
                }`}
                aria-controls="internal-admin-shell-drawer"
                aria-expanded={isShellDrawerOpen}
                onClick={() => setIsShellDrawerOpen((prev) => !prev)}
                title={isShellDrawerOpen ? "Close shell" : "Open shell"}
              >
                <Icon name="terminal" size={15} />
                <span>Shell</span>
              </button>
              <button type="button" className="btn-secondary" onClick={() => navigate("/select-tenant")}>
                Workspace App
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  await signOut();
                  navigate("/login");
                }}
              >
                Sign out
              </button>
            </div>
          </header>

          <div className={`internal-admin-workspace ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
            <aside className={`internal-admin-sidebar ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
              <nav className="internal-admin-nav">
                <p className="internal-admin-nav-section-title">Core</p>
                <Link
                  to="/admin/tenants"
                  className={`internal-admin-nav-link ${activeNavKey === "tenants" ? "is-active" : ""}`}
                  title="Tenants"
                >
                  <Icon name="layers" size={16} />
                  <span className="internal-admin-nav-label">Tenants</span>
                </Link>
                <Link
                  to="/admin/members"
                  className={`internal-admin-nav-link ${activeNavKey === "members" ? "is-active" : ""}`}
                  title="Members"
                >
                  <Icon name="users" size={16} />
                  <span className="internal-admin-nav-label">Members</span>
                </Link>
                <Link
                  to="/admin/logs"
                  className={`internal-admin-nav-link ${activeNavKey === "logs" ? "is-active" : ""}`}
                  title="Activity Logs"
                >
                  <Icon name="clock" size={16} />
                  <span className="internal-admin-nav-label">Activity Logs</span>
                </Link>
                <button
                  type="button"
                  className="internal-admin-nav-link"
                  onClick={() => navigate("/select-tenant")}
                  title="Workspace App"
                >
                  <Icon name="globe" size={16} />
                  <span className="internal-admin-nav-label">Workspace App</span>
                </button>

                <p className="internal-admin-nav-section-title">Tenant Health Hub</p>
                {TENANT_HUB_NAV_ITEMS.map((item) => (
                  <Link
                    key={item.key}
                    to={item.route}
                    className={`internal-admin-nav-link ${
                      activeTenantHubKey === item.key ? "is-active" : ""
                    }`}
                    title={item.title}
                  >
                    <Icon name={item.icon} size={16} />
                    <span className="internal-admin-nav-label">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="internal-admin-sidebar-meta">
                <p>{member?.email || access?.email || "admin"}</p>
                <span className="internal-admin-sidebar-role">{toRoleLabel(access?.role)}</span>
                {actingTenantId ? (
                  <button type="button" className="link-button" onClick={() => setActingTenant(null)}>
                    Clear impersonation
                  </button>
                ) : (
                  <span className="internal-admin-sidebar-inline">No active impersonation</span>
                )}
              </div>
            </aside>

            <section className="internal-admin-main">
              <div className="internal-admin-page-head">
                <h2>{activeSectionTitle}</h2>
                <p>{activeSectionHint}</p>
              </div>

              {error ? <div className="admin-alert is-error">{error}</div> : null}

              <Routes>
                <Route index element={<Navigate to="tenants" replace />} />
                <Route path="tenants" element={<AdminTenantsPage />} />
                <Route path="ops" element={<Navigate to="ops/home" replace />} />
                <Route path="ops/:opsSection" element={<AdminTenantOperationsPage />} />
                <Route
                  path="tenant/:tenantId"
                  element={
                    <AdminTenantOverviewPage
                      actingTenantId={actingTenantId}
                      onSetActingTenantId={setActingTenant}
                    />
                  }
                />
                <Route path="members" element={<AdminMembersPage />} />
                <Route path="logs" element={<AdminLogsPage />} />
                <Route path="*" element={<Navigate to="tenants" replace />} />
              </Routes>
            </section>
          </div>

          <section
            ref={shellDrawerRef}
            id="internal-admin-shell-drawer"
            className={`internal-admin-shell-drawer ${isShellDrawerOpen ? "is-open" : ""}`}
            aria-hidden={!isShellDrawerOpen}
            style={{
              height: `${shellDrawerHeight}px`,
              maxHeight: "none",
              transition: shellIsResizing ? "none" : undefined,
            }}
          >
            <div
              className={`internal-admin-shell-resize-handle ${shellIsResizing ? "is-resizing" : ""}`}
              onPointerDown={handleShellResizePointerDown}
              role="separator"
              aria-label="Resize shell drawer"
              aria-orientation="horizontal"
            />
            <div className="internal-admin-shell-drawer-head">
              <div className="internal-admin-shell-drawer-title">
                <Icon name="terminal" size={16} />
                <strong>Terminal Workbench</strong>
                <span className={`internal-admin-shell-connection-chip ${shellConnectionToneClass}`}>
                  {shellConnectionLabel}
                </span>
              </div>
              <div className="internal-admin-shell-drawer-head-actions">
                <span className="internal-admin-shell-head-hint">
                  {activeShellTerminal?.sessionId
                    ? `Active: ${activeShellTerminal.sessionId.slice(0, 8)}`
                    : "No active terminal"}
                </span>
                <div className="internal-admin-shell-head-menu" ref={shellMenuRef}>
                  <button
                    type="button"
                    className="internal-admin-shell-head-menu-toggle"
                    aria-label="Shell actions"
                    aria-haspopup="menu"
                    aria-expanded={isShellMenuOpen}
                    onClick={() => setIsShellMenuOpen((prev) => !prev)}
                  >
                    <Icon name="more-horizontal" size={15} />
                  </button>
                  {isShellMenuOpen ? (
                    <div className="internal-admin-shell-head-menu-popover" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleShellMenuAction("refresh")}
                        disabled={shellRefreshing || shellStarting}
                      >
                        <Icon name="refresh-cw" size={13} />
                        {shellRefreshing ? "Refreshing..." : "Refresh"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleShellMenuAction("cancel")}
                        disabled={
                          !runningShellCommand ||
                          Boolean(shellCancellingCommandId) ||
                          shellStarting ||
                          shellRunning
                        }
                      >
                        <Icon name="x" size={13} />
                        {shellCancellingCommandId ? "Canceling..." : "Cancel"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="internal-admin-shell-close"
                  onClick={() => setIsShellDrawerOpen(false)}
                  aria-label="Close shell drawer"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>

            <div
              className="internal-admin-shell-drawer-body internal-admin-shell-vs-layout"
              style={{
                "--internal-admin-shell-right-width": `${shellLayout.right}px`,
              }}
            >
              <section className="internal-admin-shell-pane internal-admin-shell-pane-terminal">
                <header className="internal-admin-shell-pane-head">
                  <strong>Terminal</strong>
                </header>
                <div className="internal-admin-shell-pane-meta">
                  <span>Session: {shellSessionId ? shellSessionId.slice(0, 8) : "-"}</span>
                  <span>Status: {String(shellSession?.status || "closed").trim().toLowerCase() || "-"}</span>
                  <span>Lines: {formatCount(visibleShellOutputRows.length)}</span>
                </div>
                {shellError ? <p className="internal-admin-shell-message is-error">{shellError}</p> : null}
                {shellNotice ? <p className="internal-admin-shell-message is-notice">{shellNotice}</p> : null}
                <div className="internal-admin-shell-console">
                  <div className="internal-admin-shell-stream" ref={shellConsoleRef}>
                    {visibleShellOutputRows.length ? (
                      visibleShellOutputRows.map((line) => (
                        <p key={line.id} className={getShellLineClassName(line.stream)}>
                          <span className="internal-admin-shell-line-content">{line.content}</span>
                        </p>
                      ))
                    ) : (
                      <p className="internal-admin-shell-line is-muted">
                        No shell output yet. Run <code>help</code> to view available commands.
                      </p>
                    )}
                  </div>

                  <form className="internal-admin-shell-prompt" onSubmit={handleShellSubmit}>
                    <span>{shellPromptLabel}</span>
                    <input
                      ref={shellInputRef}
                      type="text"
                      value={shellInput}
                      onChange={handleShellInputChange}
                      onKeyDown={handleShellInputKeyDown}
                      placeholder={
                        shellSessionId ? "Try: tenants list --limit=10" : "Opening shell session..."
                      }
                      disabled={shellStarting || shellRunning}
                    />
                    <button
                      type="submit"
                      className="btn-secondary internal-admin-shell-run-btn"
                      aria-label={shellRunning ? "Command running" : "Run command"}
                      title={shellRunning ? "Command running" : "Run command (Enter)"}
                      disabled={shellStarting || shellRunning || !String(shellInput || "").trim()}
                    >
                      <Icon name="arrow-right" size={14} />
                    </button>
                  </form>
                </div>
              </section>

              <div
                className={`internal-admin-shell-col-resizer ${shellIsColumnResizing ? "is-resizing" : ""}`}
                onPointerDown={handleShellColumnResizePointerDown}
                role="separator"
                aria-label="Resize terminal and sessions panels"
                aria-orientation="vertical"
              />

              <aside className="internal-admin-shell-pane internal-admin-shell-pane-sessions">
                <header className="internal-admin-shell-pane-head">
                  <strong>Terminals</strong>
                  <div className="internal-admin-shell-pane-head-actions">
                    <button
                      type="button"
                      className="internal-admin-shell-icon-btn"
                      onClick={handleShellCreateTerminal}
                      title="New terminal"
                      aria-label="New terminal"
                      disabled={shellStarting}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </header>
                <div className="internal-admin-shell-session-list">
                  {shellTerminals.length ? (
                    shellTerminals.map((terminal, index) => {
                      const sessionId = String(terminal?.sessionId || "").trim();
                      const isActive = sessionId && sessionId === String(activeShellTerminalId || shellSessionId);
                      return (
                        <button
                          key={sessionId || `terminal-${index}`}
                          type="button"
                          className={`internal-admin-shell-session-item ${isActive ? "is-active" : ""}`}
                          onClick={() => handleShellSwitchTerminal(sessionId)}
                          disabled={!sessionId || shellStarting}
                        >
                          <span className="internal-admin-shell-session-item-title">
                            <Icon name="terminal" size={13} />
                            <strong>{terminal?.label || "bash"}</strong>
                            <small>#{index + 1}</small>
                          </span>
                          <span className="internal-admin-shell-session-item-meta">
                            {terminal?.latestStatus || "idle"}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="internal-admin-shell-line is-muted">No terminals yet. Click + to open one.</p>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
