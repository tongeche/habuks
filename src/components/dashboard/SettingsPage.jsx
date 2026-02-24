import { useState } from "react";
import { Icon } from "../icons.jsx";
import ProfilePage from "./ProfilePage.jsx";
import OrganizationPage from "./OrganizationPage.jsx";

const ADMIN_ROLES = ["admin", "superadmin", "project_manager", "supervisor"];

export default function SettingsPage({
  user,
  onUserUpdate,
  tenantId,
  tenant,
  onTenantUpdated,
  setActivePage,
}) {
  const userRole = String(user?.role || "member").toLowerCase();
  const canAccessOrgSettings = ADMIN_ROLES.includes(userRole);

  // Initialize to "my-settings" if user can't access org settings, otherwise "my-settings" by default
  const [activeSettingsTab, setActiveSettingsTab] = useState("my-settings");

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
          <OrganizationPage
            user={user}
            tenantId={tenantId}
            tenant={tenant}
            onTenantUpdated={onTenantUpdated}
            setActivePage={setActivePage}
          />
        )}
      </div>
    </div>
  );
}

