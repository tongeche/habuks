import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";
import { signOut } from "../../lib/dataService.js";

const adminRoles = ["admin", "superadmin"];
const baseMenuItems = [
  { key: "overview", label: "Dashboard", icon: "home" },
  {
    key: "welfare",
    label: "Welfare",
    icon: "heart",
    subItems: [
      { key: "payouts", label: "Payout Schedule", icon: "calendar" },
      { key: "contributions", label: "My Contributions", icon: "wallet" },
      { key: "documents", label: "Documents", icon: "folder" },
      { key: "meetings", label: "Meetings", icon: "users" },
    ],
  },
  {
    key: "projects",
    label: "IGA Projects",
    icon: "briefcase",
    subItems: [
      { key: "projects-jpp", label: "JPP Project", icon: "arrow-right" },
      { key: "projects-jgf", label: "JGF Project", icon: "arrow-right" },
    ],
  },
  { key: "expenses", label: "Expense", icon: "receipt" },
  { key: "news", label: "News & Updates", icon: "newspaper" },
  // { key: "meetings", label: "Meetings", icon: "users" },
  { key: "profile", label: "My Profile", icon: "user" },
];

export default function DashboardLayout({ activePage, setActivePage, children, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const menuItems = adminRoles.includes(user?.role)
    ? [...baseMenuItems, { key: "admin", label: "Admin Panel", icon: "users" }]
    : baseMenuItems;

  const flatMenuItems = menuItems.flatMap((item) =>
    item.subItems ? [item, ...item.subItems] : [item]
  );

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

  const toggleSection = (key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar${sidebarOpen ? " open" : ""}${
          isCollapsed ? " is-collapsed" : ""
        }`}
      >
        <div className="dashboard-sidebar-header">
          <a href="/" className="dashboard-logo">
            <img src="/assets/logo.png" alt="Jongol Foundation" />
            <span>JONGOL</span>
          </a>
          <div className="dashboard-sidebar-actions">
            <button
              className="dashboard-collapse-toggle"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name={isCollapsed ? "arrow-right" : "arrow-left"} size={18} />
            </button>
            <button
              className="dashboard-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
        </div>
        <nav className="dashboard-nav">
          <ul>
            {menuItems.map((item) => {
              const hasSubItems = Boolean(item.subItems?.length);
              const isActive =
                activePage === item.key || item.subItems?.some((sub) => sub.key === activePage);
              const isExpanded =
                hasSubItems && !isCollapsed && (openSections.has(item.key) || isActive);

              return (
                <li key={item.key}>
                  <button
                    className={`dashboard-nav-item${isActive ? " active" : ""}${
                      hasSubItems ? " has-children" : ""
                    }`}
                    onClick={() => {
                      if (isCollapsed && hasSubItems) {
                        setIsCollapsed(false);
                      }
                      if (hasSubItems) {
                        toggleSection(item.key);
                      }
                      setActivePage(item.key);
                      setSidebarOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="dashboard-nav-item-main">
                      <Icon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </span>
                    {hasSubItems && (
                      <span
                        className={`dashboard-nav-caret${isExpanded ? " is-open" : ""}`}
                        aria-hidden="true"
                      >
                        <Icon name="chevron" size={16} />
                      </span>
                    )}
                  </button>
                  {hasSubItems && isExpanded && (
                    <ul className="dashboard-nav-sublist">
                      {item.subItems.map((subItem) => (
                        <li key={subItem.key}>
                          <button
                            className={`dashboard-nav-subitem${
                              activePage === subItem.key ? " active" : ""
                            }`}
                            onClick={() => {
                              setActivePage(subItem.key);
                              setSidebarOpen(false);
                            }}
                            title={isCollapsed ? subItem.label : undefined}
                          >
                            <Icon name={subItem.icon} size={14} />
                            <span>{subItem.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="dashboard-sidebar-footer">
          <button
            className="dashboard-logout"
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
          >
            <Icon name="logout" size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`dashboard-main${isCollapsed ? " is-collapsed" : ""}`}>
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <button
              className="dashboard-menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <h1>{flatMenuItems.find((m) => m.key === activePage)?.label || "Dashboard"}</h1>
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
