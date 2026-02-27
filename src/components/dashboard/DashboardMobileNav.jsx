import { useMemo } from "react";
import { Icon } from "../icons.jsx";

const DASHBOARD_MOBILE_NAV_ITEMS = [
  { key: "overview", label: "Home", icon: "home" },
  { key: "projects", label: "Projects", icon: "briefcase" },
  { key: "meetings", label: "Activity", icon: "flag" },
  { key: "expenses", label: "Expenses", icon: "receipt" },
  { key: "members", label: "People", icon: "users" },
  { key: "reports", label: "Reports", icon: "trending-up" },
  { key: "settings", label: "Settings", icon: "settings" },
];

const normalizeActivePage = (activePage) => {
  if (activePage === "projects-jpp" || activePage === "projects-jgf") {
    return "projects";
  }
  return String(activePage || "").trim().toLowerCase();
};

export const buildDashboardMobileNavItems = ({ access, activePage, limit = 5 }) => {
  const allowedPages = access?.allowedPages instanceof Set ? access.allowedPages : null;
  const normalizedActivePage = normalizeActivePage(activePage);
  const allowedItems = DASHBOARD_MOBILE_NAV_ITEMS.filter((item) =>
    allowedPages ? allowedPages.has(item.key) : true
  );

  if (!allowedItems.length) {
    return [];
  }

  const visibleItems = allowedItems.slice(0, limit);
  const activeItem = allowedItems.find((item) => item.key === normalizedActivePage);

  if (!activeItem || visibleItems.some((item) => item.key === activeItem.key)) {
    return visibleItems;
  }

  return [...visibleItems.slice(0, Math.max(0, limit - 1)), activeItem];
};

export default function DashboardMobileNav({
  activePage,
  access,
  setActivePage,
  ariaLabel = "Primary mobile navigation",
}) {
  const items = useMemo(
    () => buildDashboardMobileNavItems({ access, activePage }),
    [access, activePage]
  );
  const normalizedActivePage = normalizeActivePage(activePage);

  if (!setActivePage || items.length < 2) {
    return null;
  }

  return (
    <nav className="dashboard-mobile-nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={`dashboard-mobile-nav-${item.key}`}
          type="button"
          className={`dashboard-mobile-nav-btn${item.key === normalizedActivePage ? " active" : ""}`}
          onClick={() => setActivePage(item.key)}
          aria-current={item.key === normalizedActivePage ? "page" : undefined}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
