import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../icons.jsx";
import {
  getAdminActingTenantId,
  getAdminActivityLogs,
  getAdminTenantMembers,
  getAdminTenantOverview,
  getAdminTenantProjects,
  getAdminTenantTransactions,
  getAdminTenants,
  getCurrentMember,
  getInternalAdminAccess,
  setAdminActingTenantId,
  signOut,
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
  return "tenants";
};

function AdminTenantsPage() {
  const [rows, setRows] = useState([]);
  const [queryInput, setQueryInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          setSearchQuery(String(queryInput || "").trim());
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

function AdminTenantOverviewPage({ actingTenantId, onSetActingTenantId }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isActingThisTenant = Boolean(tenantId && actingTenantId && String(tenantId) === String(actingTenantId));

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
      const [overviewResult, membersResult, projectsResult, transactionsResult] = await Promise.all([
        getAdminTenantOverview(tenantId),
        getAdminTenantMembers(tenantId, { limit: 100 }),
        getAdminTenantProjects(tenantId, { limit: 80 }),
        getAdminTenantTransactions(tenantId, { limit: 120 }),
      ]);
      setOverview(overviewResult || null);
      setMembers(Array.isArray(membersResult) ? membersResult : []);
      setProjects(Array.isArray(projectsResult) ? projectsResult : []);
      setTransactions(Array.isArray(transactionsResult) ? transactionsResult : []);
    } catch (loadError) {
      setOverview(null);
      setMembers([]);
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
            </div>
          </>
        ) : null}
      </div>

      {!loading && overview ? (
        <div className="admin-grid">
          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Members</h3>
              <span>{formatCount(members.length)}</span>
            </div>
            <div className="admin-table">
              <div className="admin-table-row admin-table-head">
                <span>Name</span>
                <span>Email</span>
                <span>Phone</span>
                <span>Role</span>
                <span>Status</span>
                <span>Joined</span>
              </div>
              {members.slice(0, 30).map((member) => (
                <div className="admin-table-row" key={member.tenant_membership_id || member.member_id}>
                  <span>{member.member_name || "-"}</span>
                  <span>{member.email || "-"}</span>
                  <span>{member.phone_number || "-"}</span>
                  <span>{member.tenant_role || "-"}</span>
                  <span>{member.tenant_status || "-"}</span>
                  <span>{formatDate(member.joined_at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Projects</h3>
              <span>{formatCount(projects.length)}</span>
            </div>
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

          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Transactions</h3>
              <span>{formatCount(transactions.length)}</span>
            </div>
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
  const [tenants, setTenants] = useState([]);
  const [tenantFilter, setTenantFilter] = useState("");
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
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [access, setAccess] = useState({ allowed: false, role: null, email: null });
  const [error, setError] = useState("");
  const [actingTenantId, setActingTenantId] = useState(() => getAdminActingTenantId());

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

  return (
    <div className="dashboard-layout" style={{ "--dashboard-sidebar-width": "0px" }}>
      <main className="dashboard-main" style={{ marginLeft: 0 }}>
        <section className="dashboard-content" style={{ paddingTop: "2rem" }}>
          <div className="admin-panel">
            <div className="admin-header">
              <div>
                <h2>Internal Admin Panel</h2>
                <p>
                  Signed in as {member?.email || access?.email || "admin"} ({toRoleLabel(access?.role)}).
                </p>
              </div>
              <div className="admin-header-actions">
                {actingTenantId ? (
                  <button type="button" className="btn-secondary" onClick={() => setActingTenant(null)}>
                    Exit Impersonation
                  </button>
                ) : null}
                <button type="button" className="btn-secondary" onClick={() => navigate("/select-tenant")}>
                  Workspaces
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

            <div className="admin-launchpad-grid">
              <Link
                to="/admin/tenants"
                className={`admin-launchpad-card ${activeNavKey === "tenants" ? "is-open" : ""}`}
              >
                <span className="admin-launchpad-icon tone-indigo">
                  <Icon name="layers" size={18} />
                </span>
                <span className="admin-launchpad-content">
                  <span className="admin-launchpad-title">Tenants</span>
                  <span className="admin-launchpad-desc">Search and inspect workspaces.</span>
                  <span className="admin-launchpad-meta">/admin/tenants</span>
                </span>
              </Link>

              <Link
                to="/admin/members"
                className={`admin-launchpad-card ${activeNavKey === "members" ? "is-open" : ""}`}
              >
                <span className="admin-launchpad-icon tone-teal">
                  <Icon name="users" size={18} />
                </span>
                <span className="admin-launchpad-content">
                  <span className="admin-launchpad-title">Members</span>
                  <span className="admin-launchpad-desc">Cross-tenant member support view.</span>
                  <span className="admin-launchpad-meta">/admin/members</span>
                </span>
              </Link>

              <Link
                to="/admin/logs"
                className={`admin-launchpad-card ${activeNavKey === "logs" ? "is-open" : ""}`}
              >
                <span className="admin-launchpad-icon tone-amber">
                  <Icon name="clock" size={18} />
                </span>
                <span className="admin-launchpad-content">
                  <span className="admin-launchpad-title">Logs</span>
                  <span className="admin-launchpad-desc">System audit events and support traces.</span>
                  <span className="admin-launchpad-meta">/admin/logs</span>
                </span>
              </Link>
            </div>

            <Routes>
              <Route index element={<Navigate to="tenants" replace />} />
              <Route path="tenants" element={<AdminTenantsPage />} />
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
          </div>
        </section>
      </main>
    </div>
  );
}
