import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout.jsx";
import DashboardOverview from "./DashboardOverview.jsx";
import ContributionsPage from "./ContributionsPage.jsx";
import WelfarePage from "./WelfarePage.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import JppProjectPage from "./JppProjectPage.jsx";
import JgfProjectPage from "./JgfProjectPage.jsx";
import ExpensesPage from "./ExpensesPage.jsx";
import ReportsPage from "./ReportsPage.jsx";
import NewsPage from "./NewsPage.jsx";
import DocumentsPage from "./DocumentsPage.jsx";
import MeetingsPage from "./MeetingsPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import AdminPage from "./AdminPage.jsx";
import { getCurrentMember, getProjectsWithMembership } from "../../lib/dataService.js";
import { getRoleAccess, isAdminRole } from "./roleAccess.js";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("overview");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessibleProjectCodes, setAccessibleProjectCodes] = useState([]);
  const [projectAccessLoaded, setProjectAccessLoaded] = useState(false);
  const navigate = useNavigate();

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
      if (isAdminRole(user?.role)) {
        setAccessibleProjectCodes(["JPP", "JGF"]);
        setProjectAccessLoaded(true);
        return;
      }
      try {
        const projects = await getProjectsWithMembership(user?.id);
        const codes = (projects || [])
          .filter((project) => project.membership || project.project_leader === user?.id)
          .map((project) => String(project.code || "").trim().toUpperCase())
          .filter(Boolean);
        setAccessibleProjectCodes(codes);
      } catch (error) {
        console.error("Error loading project access:", error);
        setAccessibleProjectCodes([]);
      } finally {
        setProjectAccessLoaded(true);
      }
    };
    loadProjectAccess();
  }, [user]);

  const access = useMemo(
    () => getRoleAccess({ role: user?.role, projectCodes: accessibleProjectCodes }),
    [user?.role, accessibleProjectCodes]
  );

  useEffect(() => {
    if (!user || !projectAccessLoaded) return;
    if (!access?.allowedPages?.has(activePage)) {
      setActivePage(access.defaultPage || "overview");
      return;
    }
    if (activePage === "projects-jpp" && !access.allowedProjectCodes?.has("JPP")) {
      setActivePage(access.defaultPage || "projects");
    }
    if (activePage === "projects-jgf" && !access.allowedProjectCodes?.has("JGF")) {
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
        return <DashboardOverview user={user} />;
      case "contributions":
        return <ContributionsPage user={user} />;
      case "payouts":
        return <WelfarePage user={user} initialTab="payouts" />;
      case "welfare":
        return <WelfarePage user={user} initialTab="overview" />;
      case "projects":
        return <ProjectsPage user={user} setActivePage={setActivePage} />;
      case "projects-jpp":
        return <JppProjectPage user={user} />;
      case "projects-jgf":
        return <JgfProjectPage user={user} />;
      case "expenses":
        return <ExpensesPage user={user} />;
      case "reports":
        return <ReportsPage user={user} setActivePage={setActivePage} />;
      case "news":
        return <NewsPage user={user} />;
      case "documents":
        return <DocumentsPage user={user} />;
      case "meetings":
        return <MeetingsPage user={user} />;
      case "profile":
        return <ProfilePage user={user} />;
      case "admin":
        return <AdminPage user={user} />;
      default:
        return <DashboardOverview user={user} />;
    }
  };

  return (
    <DashboardLayout
      activePage={activePage}
      setActivePage={setActivePage}
      user={user}
      access={access}
    >
      {renderPage()}
    </DashboardLayout>
  );
}
