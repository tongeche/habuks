import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";
import { signOut } from "../../lib/dataService.js";

const adminRoles = ["admin", "superadmin"];
const baseMenuItems = [
  { key: "overview", label: "Dashboard", icon: "home" },
  { key: "contributions", label: "My Contributions", icon: "wallet" },
  { key: "payouts", label: "Payout Schedule", icon: "calendar" },
  { key: "welfare", label: "Welfare Account", icon: "heart" },
  { key: "projects", label: "IGA Projects", icon: "briefcase" },
  { key: "news", label: "News & Updates", icon: "newspaper" },
  { key: "documents", label: "Documents", icon: "folder" },
  { key: "meetings", label: "Meetings", icon: "users" },
  { key: "profile", label: "My Profile", icon: "user" },
];

export default function DashboardLayout({ activePage, setActivePage, children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const menuItems = adminRoles.includes(user?.role)
    ? [...baseMenuItems, { key: "admin", label: "Admin Panel", icon: "users" }]
    : baseMenuItems;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      // Force redirect even on error
      navigate("/login");
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="dashboard-sidebar-header">
          <a href="/" className="dashboard-logo">
            <img src="/assets/logo.png" alt="Jongol Foundation" />
            <span>JONGOL</span>
          </a>
          <button
            className="dashboard-sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <nav className="dashboard-nav">
          <ul>
            {menuItems.map((item) => (
              <li key={item.key}>
                <button
                  className={`dashboard-nav-item${activePage === item.key ? " active" : ""}`}
                  onClick={() => {
                    setActivePage(item.key);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="dashboard-sidebar-footer">
          <button className="dashboard-logout" onClick={handleLogout}>
            <Icon name="logout" size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <button
              className="dashboard-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <h1>{menuItems.find((m) => m.key === activePage)?.label || "Dashboard"}</h1>
          </div>
          <div className="dashboard-user">
            <span className="dashboard-user-name">{user?.name || "Member"}</span>
            <div className="dashboard-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : "M"}
            </div>
          </div>
        </header>
        <section className="dashboard-content">{children}</section>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="dashboard-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
