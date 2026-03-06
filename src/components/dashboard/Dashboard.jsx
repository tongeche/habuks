import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "./DashboardLayout.jsx";
import DashboardOverview from "./DashboardOverview.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import JppProjectPage from "./JppProjectPage.jsx";
import { JgfProjectPage } from "./JgfProjectPage.jsx";
import NewsPage from "./NewsPage.jsx";
import NotificationsPage from "./NotificationsPage.jsx";
import { MeetingsPage } from "./MeetingsPage.jsx";
import MembersPage from "./MembersPage.jsx";
import { FinanceRecordsPage } from "./FinanceRecordsPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import TemplatesPage from "./TemplatesPage.jsx";
import { TenantCurrencyProvider } from "./TenantCurrencyContext.jsx";
import { getCurrentMember, getProjectsWithMembership, getTenantMembershipForSlug } from "../../lib/dataService.js";
import { buildTenantBrand, buildTenantFeatures, buildTenantThemeVars } from "../../lib/tenantBranding.js";
import { getRoleAccess, isAdminRole } from "./roleAccess.js";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("overview");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessibleProjectModules, setAccessibleProjectModules] = useState([]);
  const [projectAccessLoaded, setProjectAccessLoaded] = useState(false);
  const [tenantRole, setTenantRole] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [activeJppProjectId, setActiveJppProjectId] = useState(null);
  const [activeJgfProjectId, setActiveJgfProjectId] = useState(null);
  const [settingsTabRequest, setSettingsTabRequest] = useState("my-settings");
  const navigate = useNavigate();
  const { slug } = useParams();
  const baseSiteData = useMemo(() => {
    if (typeof window !== "undefined" && typeof window.siteData === "function") {
      return window.siteData() || {};
    }
    return {};
  }, []);
  const activeTenantId = tenantInfo?.id || user?.tenant_id || null;

  useEffect(() => {
    async function loadUser() {
      try {
        const member = await getCurrentMember();
        if (!member) {
          // Not authenticated, redirect to login
          navigate("/login");
          return;
        }
        setUser(member);
      } catch (error) {
        console.error("Error loading user:", error);
        navigate("/login");
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const loadProjectAccess = async () => {
      try {
        const projects = await getProjectsWithMembership(user?.id, activeTenantId);
        const visibleProjects = isAdminRole(user?.role)
          ? projects || []
          : (projects || []).filter(
              (project) => project.membership || project.project_leader === user?.id
            );
        const moduleKeys = visibleProjects
          .map((project) => {
            const raw = project?.module_key || project?.code || "";
            const lower = String(raw).trim().toLowerCase();
            if (lower === "jpp" || lower === "jgf") return lower;
            const upper = String(raw).trim().toUpperCase();
            if (upper === "JPP") return "jpp";
            if (upper === "JGF") return "jgf";
            return null;
          })
          .filter(Boolean);
        setAccessibleProjectModules(Array.from(new Set(moduleKeys)));
      } catch (error) {
        console.error("Error loading project access:", error);
        setAccessibleProjectModules([]);
      } finally {
        setProjectAccessLoaded(true);
      }
    };
    loadProjectAccess();
  }, [user, activeTenantId]);

  useEffect(() => {
    if (!user || !slug) {
      setTenantRole(null);
      setTenantInfo(null);
      return;
    }

    const loadTenantRole = async () => {
      try {
        const membership = await getTenantMembershipForSlug(user.id, slug);
        setTenantRole(membership?.role || null);
        setTenantInfo(membership?.tenant || null);
      } catch (error) {
        console.error("Error loading tenant role:", error);
        setTenantRole(null);
        setTenantInfo(null);
      }
    };

    loadTenantRole();
  }, [user, slug]);

  useEffect(() => {
    const normalizedSlug = String(tenantInfo?.slug || slug || "").trim();
    if (!normalizedSlug || typeof window === "undefined") return;
    window.localStorage.setItem("lastTenantSlug", normalizedSlug);
  }, [tenantInfo?.slug, slug]);

  const tenantBrand = useMemo(
    () => buildTenantBrand(tenantInfo, baseSiteData),
    [tenantInfo, baseSiteData]
  );
  const tenantFeatures = useMemo(
    () => buildTenantFeatures(tenantInfo, baseSiteData),
    [tenantInfo, baseSiteData]
  );
  const tenantTheme = useMemo(
    () => buildTenantThemeVars(tenantInfo, baseSiteData),
    [tenantInfo, baseSiteData]
  );
  const dashboardTenant = useMemo(
    () => ({
      ...tenantBrand,
      id: tenantBrand?.id || activeTenantId || null,
    }),
    [tenantBrand, activeTenantId]
  );

  const access = useMemo(
    () =>
      getRoleAccess({
        role: tenantRole || user?.role,
        projectModules: accessibleProjectModules,
        features: tenantFeatures,
      }),
    [tenantRole, user?.role, accessibleProjectModules, tenantFeatures]
  );
  const workspaceClosureState = useMemo(() => {
    const siteData =
      tenantInfo?.site_data && typeof tenantInfo.site_data === "object" ? tenantInfo.site_data : {};
    const closure =
      siteData.workspace_closure && typeof siteData.workspace_closure === "object"
        ? siteData.workspace_closure
        : {};
    return closure;
  }, [tenantInfo?.site_data]);
  const workspaceClosureStatus = String(workspaceClosureState?.status || "").trim().toLowerCase();
  const isWorkspacePaused = workspaceClosureStatus === "paused";
  const rawEffectiveRole = String(tenantRole || user?.role || "").trim().toLowerCase();
  const normalizedEffectiveRole = rawEffectiveRole === "super_admin" ? "superadmin" : rawEffectiveRole;
  const isSuperAdminRole = normalizedEffectiveRole === "superadmin";
  const isAdminRoleForPause =
    normalizedEffectiveRole === "admin" ||
    normalizedEffectiveRole === "org_admin" ||
    normalizedEffectiveRole === "organization_admin";
  const normalizedUserEmail = String(user?.email || "").trim().toLowerCase();
  const normalizedWorkspaceEmail = String(tenantInfo?.contact_email || "").trim().toLowerCase();
  const isWorkspaceOwner =
    Boolean(normalizedUserEmail) &&
    Boolean(normalizedWorkspaceEmail) &&
    normalizedUserEmail === normalizedWorkspaceEmail;
  const canManagePausedWorkspace = isSuperAdminRole || (isAdminRoleForPause && isWorkspaceOwner);

  const handleSetActivePage = (nextPage) => {
    const normalizedPage = String(nextPage || "").trim().toLowerCase();
    if (isWorkspacePaused && !canManagePausedWorkspace) {
      return;
    }
    if (isWorkspacePaused && canManagePausedWorkspace && normalizedPage !== "settings") {
      return;
    }
    setActivePage(nextPage);
  };

  useEffect(() => {
    if (!user || !projectAccessLoaded) return;
    if (!access?.allowedPages?.has(activePage)) {
      setActivePage(access.defaultPage || "overview");
      return;
    }
    if (activePage === "projects-jpp" && !access.allowedProjectModules?.has("jpp")) {
      setActivePage(access.defaultPage || "projects");
    }
    if (activePage === "projects-jgf" && !access.allowedProjectModules?.has("jgf")) {
      setActivePage(access.defaultPage || "projects");
    }
  }, [activePage, access, user, projectAccessLoaded]);

  useEffect(() => {
    if (!isWorkspacePaused) return;
    if (canManagePausedWorkspace && activePage !== "settings") {
      setSettingsTabRequest("organization-settings:overview");
      setActivePage("settings");
      return;
    }
    if (!canManagePausedWorkspace && activePage !== "overview") {
      setActivePage("overview");
    }
  }, [activePage, canManagePausedWorkspace, isWorkspacePaused]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  const renderPage = () => {
    const safePage = access?.allowedPages?.has(activePage)
      ? activePage
      : access?.defaultPage || "overview";
    if (isWorkspacePaused && (!canManagePausedWorkspace || safePage !== "settings")) {
      const pauseExpiry = String(workspaceClosureState?.expires_at || "").trim();
      const pauseExpiryTimestamp = Date.parse(pauseExpiry);
      const pauseExpiryLabel = Number.isFinite(pauseExpiryTimestamp)
        ? new Date(pauseExpiryTimestamp).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : null;

      return (
        <section className="empty-state">
          <h3>Workspace is paused</h3>
          <p>
            {canManagePausedWorkspace
              ? "This workspace is currently paused. Open organization settings to resume or finalize closure."
              : "This workspace has been paused by the owner and is temporarily unavailable."}
          </p>
          {pauseExpiryLabel ? <p>Pause expires on {pauseExpiryLabel}.</p> : null}
          <div className="project-detail-section-head-actions">
            {canManagePausedWorkspace ? (
              <button
                type="button"
                className="project-detail-action"
                onClick={() => {
                  setSettingsTabRequest("organization-settings:overview");
                  setActivePage("settings");
                }}
              >
                Manage workspace lifecycle
              </button>
            ) : (
              <button
                type="button"
                className="project-detail-action"
                onClick={() => navigate("/select-tenant")}
              >
                Switch workspace
              </button>
            )}
          </div>
        </section>
      );
    }

    switch (safePage) {
      case "overview":
        return (
          <DashboardOverview
            user={user}
            tenantId={activeTenantId}
            tenantBrand={tenantBrand}
            tenantFeatures={tenantFeatures}
            access={access}
            setActivePage={handleSetActivePage}
            tenantRole={tenantRole}
          />
        );
      case "contributions":
        return (
          <FinanceRecordsPage
            user={user}
            tenantId={activeTenantId}
            initialType="contribution"
            activePage="contributions"
          />
        );
      case "payouts":
        return (
          <FinanceRecordsPage
            user={user}
            tenantId={activeTenantId}
            initialType="payout"
            activePage="payouts"
          />
        );
      case "welfare":
        return (
          <FinanceRecordsPage
            user={user}
            tenantId={activeTenantId}
            initialType="welfare"
            activePage="welfare"
          />
        );
      case "projects":
        return (
          <ProjectsPage
            user={user}
            tenantRole={tenantRole}
            access={access}
            setActivePage={handleSetActivePage}
            tenantId={activeTenantId}
            tenantBrand={tenantBrand}
            onManageProject={(project) => {
              const raw = project?.module_key || project?.code || "";
              const lower = String(raw).trim().toLowerCase();
              if (lower === "jpp" || String(raw).trim().toUpperCase() === "JPP") {
                setActiveJppProjectId(project?.id ?? null);
              }
              if (lower === "jgf" || String(raw).trim().toUpperCase() === "JGF") {
                setActiveJgfProjectId(project?.id ?? null);
              }
            }}
          />
        );
      case "projects-jpp":
        return (
          <JppProjectPage
            user={user}
            tenantRole={tenantRole}
            tenantId={activeTenantId}
            activeProjectId={activeJppProjectId}
            onProjectChange={setActiveJppProjectId}
          />
        );
      case "projects-jgf":
        return (
          <JgfProjectPage
            user={user}
            tenantRole={tenantRole}
            tenantId={activeTenantId}
            activeProjectId={activeJgfProjectId}
            onProjectChange={setActiveJgfProjectId}
          />
        );
      case "expenses":
        return (
          <FinanceRecordsPage
            user={user}
            tenantId={activeTenantId}
            initialType="expense"
            activePage="expenses"
            access={access}
            setActivePage={handleSetActivePage}
          />
        );
      case "notifications":
        return (
          <NotificationsPage
            tenantId={activeTenantId}
            user={user}
            setActivePage={handleSetActivePage}
          />
        );
      case "news":
        return <NewsPage user={user} tenantId={activeTenantId} />;
      case "documents":
        return (
          <FinanceRecordsPage
            user={user}
            tenantId={activeTenantId}
            initialType="all"
            activePage="documents"
          />
        );
      case "meetings":
        return (
          <MeetingsPage
            user={user}
            tenantId={activeTenantId}
          />
        );
      case "members":
        return (
          <MembersPage
            tenantInfo={tenantInfo}
            tenantId={activeTenantId}
            user={user}
            tenantRole={tenantRole}
            access={access}
            setActivePage={handleSetActivePage}
          />
        );
      case "settings":
        return (
          <SettingsPage
            user={user}
            onUserUpdate={setUser}
            tenantId={activeTenantId}
            tenant={tenantInfo}
            tenantRole={tenantRole}
            requestedTab={settingsTabRequest}
            onTenantUpdated={setTenantInfo}
            setActivePage={handleSetActivePage}
          />
        );
      case "templates":
        return (
          <TemplatesPage
            user={user}
            tenantRole={tenantRole}
            tenantId={activeTenantId}
            tenant={tenantInfo}
            onTenantUpdated={setTenantInfo}
            setActivePage={handleSetActivePage}
          />
        );
      default:
        return (
          <DashboardOverview
            user={user}
            tenantId={activeTenantId}
            tenantBrand={tenantBrand}
            tenantFeatures={tenantFeatures}
            access={access}
            setActivePage={handleSetActivePage}
            tenantRole={tenantRole}
          />
        );
    }
  };

  return (
    <TenantCurrencyProvider tenant={tenantInfo}>
      <DashboardLayout
        activePage={activePage}
        setActivePage={handleSetActivePage}
        user={user}
        access={access}
        tenant={dashboardTenant}
        tenantRole={tenantRole}
        tenantTheme={tenantTheme}
        onRequestSettingsTab={setSettingsTabRequest}
      >
        {renderPage()}
      </DashboardLayout>
    </TenantCurrencyProvider>
  );
}
