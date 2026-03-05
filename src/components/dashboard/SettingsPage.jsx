import { useEffect, useState } from "react";
import { Icon } from "../icons.jsx";
import ProfilePage from "./ProfilePage.jsx";
import * as OrganizationPageModule from "./OrganizationPage.jsx";

const ADMIN_ROLES = ["admin", "superadmin", "project_manager", "supervisor"];
const ORGANIZATION_SETTINGS_TABS = new Set([
  "overview",
  "members",
  "documents",
  "activities",
  "partners",
  "templates",
]);
const OrganizationPage =
  OrganizationPageModule.OrganizationPage || OrganizationPageModule.default;

export default function SettingsPage({
  user,
  onUserUpdate,
  tenantId,
  tenant,
  tenantRole,
  requestedTab = "my-settings",
  onTenantUpdated,
  setActivePage,
}) {
  const effectiveRole = String(tenantRole || user?.role || "member").toLowerCase();
  const canAccessOrgSettings = ADMIN_ROLES.includes(effectiveRole);
  const resolveRequestedSettings = (tabKey) => {
    const normalizedTab = String(tabKey || "my-settings").trim().toLowerCase();
    if (normalizedTab.startsWith("organization-settings")) {
      if (!canAccessOrgSettings) {
        return { settingsTab: "my-settings", organizationTab: "overview" };
      }
      const [, requestedOrganizationTab = "overview"] = normalizedTab.split(":");
      return {
        settingsTab: "organization-settings",
        organizationTab: ORGANIZATION_SETTINGS_TABS.has(requestedOrganizationTab)
          ? requestedOrganizationTab
          : "overview",
      };
    }
    return { settingsTab: "my-settings", organizationTab: "overview" };
  };
  const resolveSettingsTab = (tabKey) => {
    return resolveRequestedSettings(tabKey).settingsTab;
  };
  const requestedOrganizationTab = resolveRequestedSettings(requestedTab).organizationTab;

  // Initialize to "my-settings" if user can't access org settings, otherwise "my-settings" by default
  const [activeSettingsTab, setActiveSettingsTab] = useState(() => resolveSettingsTab(requestedTab));

  useEffect(() => {
    setActiveSettingsTab(resolveSettingsTab(requestedTab));
  }, [requestedTab, canAccessOrgSettings]);

  const settingsTabs = [
    { key: "my-settings", label: "My Settings", icon: "user" },
    ...(canAccessOrgSettings
      ? [{ key: "organization-settings", label: "Organization Settings", icon: "building" }]
      : []),
  ];

  return (
    <div className="settings-page-container">
      {/* Settings Tab Navigation */}
      {settingsTabs.length > 1 && (
        <div className="settings-tabs-header">
          <div className="settings-tabs-container">
            {settingsTabs.map((tab) => (
              <button
                key={tab.key}
                className={`settings-tab-btn ${activeSettingsTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveSettingsTab(tab.key)}
              >
                <Icon name={tab.icon} size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings Content - Full Height Container */}
      <div className="settings-content-container">
        {activeSettingsTab === "my-settings" && (
          <ProfilePage user={user} onUserUpdate={onUserUpdate} />
        )}
        {activeSettingsTab === "organization-settings" && canAccessOrgSettings && (
          tenantId ? (
            <OrganizationPage
              user={user}
              tenantId={tenantId}
              tenant={tenant}
              requestedTab={requestedOrganizationTab}
              onTenantUpdated={onTenantUpdated}
              setActivePage={setActivePage}
            />
          ) : (
            <div className="project-expenses-loading org-shell-loading">
              <div className="loading-spinner" />
              <span>Loading organization workspace...</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
