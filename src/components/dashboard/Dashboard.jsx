import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout.jsx";
import DashboardOverview from "./DashboardOverview.jsx";
import ContributionsPage from "./ContributionsPage.jsx";
import PayoutsPage from "./PayoutsPage.jsx";
import WelfarePage from "./WelfarePage.jsx";
import ProjectsPage from "./ProjectsPage.jsx";
import NewsPage from "./NewsPage.jsx";
import DocumentsPage from "./DocumentsPage.jsx";
import MeetingsPage from "./MeetingsPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import AdminPage from "./AdminPage.jsx";
import { getCurrentMember, isAdminUser } from "../../lib/dataService.js";

export default function Dashboard() {
  const [activePage, setActivePage] = useState("overview");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
    if (activePage === "admin" && user && !isAdminUser(user)) {
      setActivePage("overview");
    }
  }, [activePage, user]);

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
    switch (activePage) {
      case "overview":
        return <DashboardOverview user={user} />;
      case "contributions":
        return <ContributionsPage user={user} />;
      case "payouts":
        return <PayoutsPage user={user} />;
      case "welfare":
        return <WelfarePage user={user} />;
      case "projects":
        return <ProjectsPage user={user} />;
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
    <DashboardLayout activePage={activePage} setActivePage={setActivePage} user={user}>
      {renderPage()}
    </DashboardLayout>
  );
}
