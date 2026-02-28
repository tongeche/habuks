import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";
import { signOut } from "../../lib/dataService.js";

const QUIET_MODE_OPTIONS = [
  { value: "off", label: "Never" },
  { value: "1h", label: "For 1 hour" },
  { value: "tonight", label: "Until tonight" },
  { value: "week", label: "For 7 days" },
];

const resolveQuietModeUntil = (option) => {
  const now = new Date();
  if (option === "1h") {
    return now.getTime() + 60 * 60 * 1000;
  }
  if (option === "tonight") {
    const tonight = new Date(now);
    tonight.setHours(23, 59, 59, 999);
    return tonight.getTime();
  }
  if (option === "week") {
    return now.getTime() + 7 * 24 * 60 * 60 * 1000;
  }
  return null;
};

const getQuietModeSelectValue = (quietModeUntil) => {
  const until = Number(quietModeUntil);
  if (!Number.isFinite(until) || until <= Date.now()) {
    return "off";
  }
  const remaining = until - Date.now();
  if (remaining <= 65 * 60 * 1000) {
    return "1h";
  }
  const tonight = new Date();
  tonight.setHours(23, 59, 59, 999);
  if (until <= tonight.getTime()) {
    return "tonight";
  }
  if (remaining <= 7 * 24 * 60 * 60 * 1000) {
    return "week";
  }
  return "off";
};

const formatQuietModeHint = (quietModeUntil) => {
  const until = Number(quietModeUntil);
  if (!Number.isFinite(until) || until <= Date.now()) {
    return "Pause badge refresh and notification interruptions when you need focus.";
  }
  return `Quiet mode is active until ${new Date(until).toLocaleString()}.`;
};

const formatRoleLabel = (role) =>
  String(role || "member")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Member";

const getInitials = (user) => {
  const name = String(user?.name || "").trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }
  const email = String(user?.email || "").trim();
  return email ? email.charAt(0).toUpperCase() : "M";
};

const getUserDrawerThemeVars = (isDarkMode) =>
  isDarkMode
    ? {
        "--dashboard-border-strong": "rgba(71, 85, 105, 0.72)",
        "--dashboard-border-soft": "rgba(71, 85, 105, 0.52)",
        "--dashboard-border-muted": "rgba(51, 65, 85, 0.72)",
        "--dashboard-text-primary": "#e8f1ff",
        "--dashboard-text-secondary": "#d2deef",
        "--dashboard-text-muted": "#9eb0cb",
        "--dashboard-text-soft": "#7f93b2",
        "--dashboard-control-surface": "rgba(11, 24, 44, 0.92)",
        "--dashboard-control-border": "rgba(71, 85, 105, 0.78)",
        "--dashboard-icon-surface": "rgba(10, 20, 38, 0.9)",
        "--dashboard-icon-border": "rgba(71, 85, 105, 0.72)",
      }
    : {
        "--dashboard-border-strong": "#dbe5f2",
        "--dashboard-border-soft": "#e6ecf5",
        "--dashboard-border-muted": "#edf2f7",
        "--dashboard-text-primary": "#0f172a",
        "--dashboard-text-secondary": "#334155",
        "--dashboard-text-muted": "#64748b",
        "--dashboard-text-soft": "#7c8aa5",
        "--dashboard-control-surface": "#f6f8fc",
        "--dashboard-control-border": "#d7e0eb",
        "--dashboard-icon-surface": "#f3f6fb",
        "--dashboard-icon-border": "#d7e0eb",
      };

function UserDropdown({
  user,
  tenant,
  tenantRole,
  canInviteMembers = false,
  canManageWorkspace = false,
  canOpenAdminConsole = false,
  themeMode = "light",
  onThemeModeChange,
  quietModeUntil = null,
  onQuietModeUntilChange,
  onOpenInviteModal,
  onOpenProfileSettings,
  onOpenWorkspaceSettings,
  onOpenAdminConsole,
  onOpenNotifications,
  onSwitchWorkspace,
  workspaceAppItems = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const navigate = useNavigate();
  const initials = useMemo(() => getInitials(user), [user]);
  const roleLabel = useMemo(() => formatRoleLabel(tenantRole || user?.role), [tenantRole, user?.role]);
  const quietModeValue = getQuietModeSelectValue(quietModeUntil);
  const isDarkMode = themeMode === "dark";
  const drawerThemeVars = useMemo(() => getUserDrawerThemeVars(isDarkMode), [isDarkMode]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      navigate("/login");
    }
  };

  const runAction = (callback) => {
    setIsOpen(false);
    callback?.();
  };

  const quickActions = [
    canInviteMembers
      ? {
          key: "invite",
          icon: "mail",
          title: "Invite member",
          description: "Add a new person to this workspace.",
          onClick: () => runAction(onOpenInviteModal),
        }
      : null,
    {
      key: "account",
      icon: "user",
      title: "My account",
      description: "Update your profile and preferences.",
      onClick: () => runAction(onOpenProfileSettings),
    },
    canManageWorkspace
      ? {
          key: "workspace",
          icon: "settings",
          title: "Workspace settings",
          description: "Manage the organization profile and templates.",
          onClick: () => runAction(onOpenWorkspaceSettings),
        }
      : null,
    {
      key: "notifications",
      icon: "bell",
      title: "Notifications",
      description: "Open your full reminder inbox.",
      onClick: () => runAction(onOpenNotifications),
    },
    canOpenAdminConsole
      ? {
          key: "admin",
          icon: "shield",
          title: "Admin console",
          description: "Open roles, permissions, and admin controls.",
          onClick: () => runAction(onOpenAdminConsole),
        }
      : null,
    {
      key: "switch",
      icon: "layers",
      title: "Switch workspace",
      description: "Move between organizations quickly.",
      onClick: () => runAction(onSwitchWorkspace),
    },
  ].filter(Boolean);

  return (
    <div className="user-dropdown">
      <button
        className={`user-dropdown-trigger${isOpen ? " is-open" : ""}${isDarkMode ? " is-dark" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open account drawer"
        aria-expanded={isOpen}
        type="button"
      >
        <div className="dashboard-avatar">{initials}</div>
      </button>

      {isOpen && portalReady
        ? createPortal(
            <>
              <button
                type="button"
                className={`user-dropdown-backdrop${isDarkMode ? " is-dark" : ""}`}
                aria-label="Close account drawer"
                onClick={() => setIsOpen(false)}
              />
              <aside
                className={`user-drawer${isDarkMode ? " is-dark" : ""}`}
                style={drawerThemeVars}
                role="dialog"
                aria-modal="true"
                aria-label="Account drawer"
              >
                <div className="user-drawer-header">
                  <button
                    type="button"
                    className="user-drawer-close"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close account drawer"
                  >
                    ×
                  </button>
                  <div className="user-drawer-profile">
                    <div className="user-drawer-avatar-wrap">
                      <div className="user-drawer-avatar">{initials}</div>
                      <span className="user-drawer-presence" aria-hidden="true" />
                    </div>
                    <strong>{user?.name || "Member"}</strong>
                    <span>{user?.email || ""}</span>
                    <div className="user-drawer-badges">
                      <span>{roleLabel}</span>
                      <span>{tenant?.name || "Current workspace"}</span>
                    </div>
                  </div>
                </div>

                <div className="user-drawer-body">
                  <section className="user-drawer-section">
                    <div className="user-drawer-section-head">
                      <small>Quick Actions</small>
                      <span>Shortcuts you will actually use.</span>
                    </div>
                    <div className="user-drawer-action-grid">
                      {quickActions.map((action) => (
                        <button
                          type="button"
                          key={action.key}
                          className="user-drawer-action-card"
                          onClick={action.onClick}
                        >
                          <span className="user-drawer-action-icon">
                            <Icon name={action.icon} size={18} />
                          </span>
                          <span className="user-drawer-action-copy">
                            <strong>{action.title}</strong>
                            <small>{action.description}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="user-drawer-section">
                    <div className="user-drawer-section-head">
                      <small>Workspace Mode</small>
                      <span>Control the way this dashboard feels.</span>
                    </div>
                    <div className="user-drawer-theme-toggle">
                      <button
                        type="button"
                        className={`user-drawer-theme-chip${themeMode === "light" ? " is-active" : ""}`}
                        onClick={() => onThemeModeChange?.("light")}
                      >
                        <Icon name="sun" size={16} />
                        <span>Light</span>
                      </button>
                      <button
                        type="button"
                        className={`user-drawer-theme-chip${themeMode === "dark" ? " is-active" : ""}`}
                        onClick={() => onThemeModeChange?.("dark")}
                      >
                        <Icon name="moon" size={16} />
                        <span>Dark</span>
                      </button>
                    </div>
                    <label className="user-drawer-field">
                      <span>Pause notifications</span>
                      <select
                        value={quietModeValue}
                        onChange={(event) =>
                          onQuietModeUntilChange?.(resolveQuietModeUntil(event.target.value))
                        }
                      >
                        {QUIET_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="user-drawer-help">{formatQuietModeHint(quietModeUntil)}</p>
                  </section>

                  <section className="user-drawer-section">
                    <div className="user-drawer-section-head">
                      <small>Current Workspace</small>
                      <span>Keep the important context visible.</span>
                    </div>
                    <div className="user-drawer-workspace-card">
                      <strong>{tenant?.name || "Workspace"}</strong>
                      <p>
                        {tenant?.tagline ||
                          "Manage your team, meetings, documents, and reporting from one place."}
                      </p>
                      <div className="user-drawer-workspace-meta">
                        <span>{roleLabel}</span>
                        <span>{themeMode === "dark" ? "Dark mode" : "Light mode"}</span>
                      </div>
                    </div>
                  </section>

                  {workspaceAppItems.length ? (
                    <section className="user-drawer-section">
                      <div className="user-drawer-section-head">
                        <small>Workspace Apps</small>
                        <span>Jump into the core tools in this organization.</span>
                      </div>
                      <div className="user-drawer-app-grid">
                        {workspaceAppItems.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            className={`user-drawer-app-card tone-${item.tone || "blue"}`}
                            onClick={() => runAction(item.onClick)}
                          >
                            <span className={`user-drawer-app-icon tone-${item.tone || "blue"}`}>
                              <Icon name={item.icon} size={20} />
                            </span>
                            <span className="user-drawer-app-label">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                <div className="user-drawer-footer">
                  <button
                    type="button"
                    className="user-drawer-logout"
                    onClick={() => runAction(handleLogout)}
                  >
                    <Icon name="logout" size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              </aside>
            </>,
            document.body
          )
        : null}
    </div>
  );
}

export { UserDropdown };
export default UserDropdown;
