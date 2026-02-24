import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "./DashboardLayout.jsx";
import DashboardOverview from "./DashboardOverview.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import JppProjectPage from "./JppProjectPage.jsx";
import JgfProjectPage from "./JgfProjectPage.jsx";
import ReportsPage from "./ReportsPage.jsx";
import NewsPage from "./NewsPage.jsx";
import MeetingsPage from "./MeetingsPage.jsx";
import MembersPage from "./MembersPage.jsx";
import FinanceRecordsPage from "./FinanceRecordsPage.jsx";
import SettingsPage from "./SettingsPage.jsx";
import AdminPage from "./AdminPage.jsx";
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
  const navigate = useNavigate();
  const { slug } = useParams();
  const baseSiteData = useMemo(() => {
    if (typeof window !== "undefined" && typeof window.siteData === "function") {
      return window.siteData() || {};
    }
    return {};
  }, []);

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
        const projects = await getProjectsWithMembership(user?.id, tenantInfo?.id);
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
  }, [user, tenantInfo?.id]);

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

  const access = useMemo(
    () =>
      getRoleAccess({
        role: tenantRole || user?.role,
        projectModules: accessibleProjectModules,
        features: tenantFeatures,
      }),
    [tenantRole, user?.role, accessibleProjectModules, tenantFeatures]
  );

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
    switch (safePage) {
      case "overview":
        return (
          <DashboardOverview
            user={user}
            tenantId={tenantInfo?.id}
            tenantBrand={tenantBrand}
            tenantFeatures={tenantFeatures}
          />
        );
      case "contributions":
        return <FinanceRecordsPage user={user} tenantId={tenantInfo?.id} initialType="contribution" />;
      case "payouts":
        return <FinanceRecordsPage user={user} tenantId={tenantInfo?.id} initialType="payout" />;
      case "welfare":
        return <FinanceRecordsPage user={user} tenantId={tenantInfo?.id} initialType="welfare" />;
      case "projects":
        return (
          <ProjectsPage
            user={user}
            setActivePage={setActivePage}
            tenantId={tenantInfo?.id}
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
            tenantId={tenantInfo?.id}
            activeProjectId={activeJppProjectId}
            onProjectChange={setActiveJppProjectId}
          />
        );
      case "projects-jgf":
        return (
          <JgfProjectPage
            user={user}
            tenantId={tenantInfo?.id}
            activeProjectId={activeJgfProjectId}
            onProjectChange={setActiveJgfProjectId}
          />
        );
      case "expenses":
        return <FinanceRecordsPage user={user} tenantId={tenantInfo?.id} initialType="expense" />;
      case "reports":
        return <ReportsPage user={user} setActivePage={setActivePage} tenantId={tenantInfo?.id} />;
      case "news":
        return <NewsPage user={user} tenantId={tenantInfo?.id} />;
      case "documents":
        return <FinanceRecordsPage user={user} tenantId={tenantInfo?.id} initialType="all" />;
      case "meetings":
        return <MeetingsPage user={user} tenantId={tenantInfo?.id} />;
      case "members":
        return <MembersPage tenantInfo={tenantInfo} />;
      case "settings":
        return (
          <SettingsPage
            user={user}
            onUserUpdate={setUser}
            tenantId={tenantInfo?.id}
            tenant={tenantInfo}
            onTenantUpdated={setTenantInfo}
            setActivePage={setActivePage}
          />
        );
      case "admin":
        return (
          <AdminPage
            user={user}
            tenantId={tenantInfo?.id}
            tenantRole={tenantRole}
            onTenantUpdated={setTenantInfo}
          />
        );
      default:
        return <DashboardOverview user={user} tenantId={tenantInfo?.id} tenantBrand={tenantBrand} />;
    }
  };

  return (
    <DashboardLayout
      activePage={activePage}
      setActivePage={setActivePage}
      user={user}
      access={access}
      tenant={tenantBrand}
      tenantTheme={tenantTheme}
    >
      {renderPage()}
    </DashboardLayout>
  );
}
