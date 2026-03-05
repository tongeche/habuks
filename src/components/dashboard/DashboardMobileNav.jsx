import { useMemo } from "react";
import { Icon } from "../icons.jsx";

const DASHBOARD_MOBILE_NAV_ITEMS = [
  { key: "overview", label: "Home", icon: "home" },
  { key: "projects", label: "Projects", icon: "briefcase" },
  { key: "finance", label: "Records", icon: "wallet" },
  { key: "members", label: "People", icon: "users" },
  { key: "more", label: "More", icon: "menu" },
];

const FINANCE_PAGE_PRIORITY = ["expenses", "contributions", "documents", "welfare", "payouts"];
const MORE_PAGE_PRIORITY = ["settings", "notifications", "reports", "news", "admin", "meetings"];

const resolveFirstAllowedPage = (allowedPages, candidates) => {
  if (!(allowedPages instanceof Set)) return candidates[0] || null;
  return candidates.find((candidate) => allowedPages.has(candidate)) || null;
};

const normalizeActivePage = (activePage) => {
  if (activePage === "projects-jpp" || activePage === "projects-jgf") {
    return "projects";
  }
  const normalized = String(activePage || "").trim().toLowerCase();
  if (FINANCE_PAGE_PRIORITY.includes(normalized)) {
    return "finance";
  }
  if (MORE_PAGE_PRIORITY.includes(normalized)) {
    return "more";
  }
  return normalized;
};

const buildFixedMobileItems = (allowedPages) => {
  const hasOverview = !(allowedPages instanceof Set) || allowedPages.has("overview");
  const hasProjects = !(allowedPages instanceof Set) || allowedPages.has("projects");
  const hasMembers = !(allowedPages instanceof Set) || allowedPages.has("members");
  const financeTarget = resolveFirstAllowedPage(allowedPages, FINANCE_PAGE_PRIORITY);
  const moreTarget = resolveFirstAllowedPage(allowedPages, MORE_PAGE_PRIORITY);

  return DASHBOARD_MOBILE_NAV_ITEMS.filter((item) => {
    if (item.key === "overview") return hasOverview;
    if (item.key === "projects") return hasProjects;
    if (item.key === "finance") return Boolean(financeTarget);
    if (item.key === "members") return hasMembers;
    if (item.key === "more") return true;
    return false;
  }).map((item) => {
    if (item.key === "finance") {
      return { ...item, targetPage: financeTarget };
    }
    if (item.key === "more") {
      return { ...item, targetPage: moreTarget };
    }
    return { ...item, targetPage: item.key };
  });
};

const normalizeCurrentKey = (activePage, items) => {
  const normalizedActivePage = normalizeActivePage(activePage);
  if (items.some((item) => item.key === normalizedActivePage)) {
    return normalizedActivePage;
  }

  const targetMatch = items.find((item) => item.targetPage === String(activePage || "").trim().toLowerCase());
  if (targetMatch) {
    return targetMatch.key;
  }

  return String(activePage || "").trim().toLowerCase();
};

export const buildDashboardMobileNavItems = ({ access, activePage }) => {
  const allowedPages = access?.allowedPages instanceof Set ? access.allowedPages : null;
  const fixedItems = buildFixedMobileItems(allowedPages);
  if (!fixedItems.length) {
    return [];
  }
  const normalizedCurrentKey = normalizeCurrentKey(activePage, fixedItems);
  return fixedItems.map((item) => ({
    ...item,
    isCurrent: item.key === normalizedCurrentKey,
  }));
};

export default function DashboardMobileNav({
  activePage,
  access,
  setActivePage,
  onMoreTap,
  ariaLabel = "Primary mobile navigation",
}) {
  const items = useMemo(
    () => buildDashboardMobileNavItems({ access, activePage }),
    [access, activePage]
  );

  if (!setActivePage || items.length < 2) {
    return null;
  }

  return (
    <nav className="dashboard-mobile-nav" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={`dashboard-mobile-nav-${item.key}`}
          type="button"
          className={`dashboard-mobile-nav-btn${item.isCurrent ? " active" : ""}`}
          onClick={() => {
            if (item.key === "more" && onMoreTap) {
              onMoreTap();
              return;
            }
            if (!item.targetPage) return;
            setActivePage(item.targetPage);
          }}
          aria-current={item.isCurrent ? "page" : undefined}
          disabled={!item.targetPage && !(item.key === "more" && onMoreTap)}
        >
          <Icon name={item.icon} size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
