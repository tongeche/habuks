import { useState, useEffect } from "react";
import { updateMemberProfile, signOut } from "../../lib/dataService.js";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";

const DEFAULT_NOTIFICATION_SETTINGS = {
  in_app_notifications: true,
  email_notifications: true,
  sms_notifications: true,
  task_notifications: true,
  contribution_reminders: true,
  meeting_reminders: true,
  payout_alerts: true,
  news_updates: true,
};

export default function ProfilePage({ user, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState("account");
  const [formData, setFormData] = useState({
    // Account fields
    name: "",
    email: "",
    phone_number: "",
    date_of_birth: "",
    // Personal info fields
    gender: "",
    national_id: "",
    occupation: "",
    address: "",
    county: "",
    sub_county: "",
    // Emergency contact
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
  });
  const [privacySettings, setPrivacySettings] = useState({
    show_phone: true,
    show_email: false,
    show_contributions: true,
    profile_visible: true,
  });
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();

  // Only initialize form data once when user first loads, not on every re-render
  useEffect(() => {
    if (user && !initialized) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        date_of_birth: user.date_of_birth || "",
        gender: user.gender || "",
        national_id: user.national_id || "",
        occupation: user.occupation || "",
        address: user.address || "",
        county: user.county || "",
        sub_county: user.sub_county || "",
        emergency_contact_name: user.emergency_contact_name || "",
        emergency_contact_phone: user.emergency_contact_phone || "",
        emergency_contact_relationship: user.emergency_contact_relationship || "",
      });
      if (user.privacy_settings) {
        setPrivacySettings(user.privacy_settings);
      }
      if (user.notification_settings) {
        setNotificationSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...user.notification_settings,
        });
      }
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(false);
  };

  const handlePrivacyChange = (key) => {
    setPrivacySettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setError(null);
    setSuccess(false);
  };

  const handleNotificationChange = (key) => {
    setNotificationSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updateData = {
        ...formData,
        email: formData.email || null,
        date_of_birth: formData.date_of_birth || null,
        privacy_settings: privacySettings,
        notification_settings: notificationSettings,
      };
      
      const updated = await updateMemberProfile(user.id, updateData);
      
      setSuccess(true);
      setEditing(false);
      
      if (onUserUpdate) {
        onUserUpdate(updated);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone_number: user.phone_number || "",
        date_of_birth: user.date_of_birth || "",
        gender: user.gender || "",
        national_id: user.national_id || "",
        occupation: user.occupation || "",
        address: user.address || "",
        county: user.county || "",
        sub_county: user.sub_county || "",
        emergency_contact_name: user.emergency_contact_name || "",
        emergency_contact_phone: user.emergency_contact_phone || "",
        emergency_contact_relationship: user.emergency_contact_relationship || "",
      });
      if (user.privacy_settings) {
        setPrivacySettings(user.privacy_settings);
      }
      if (user.notification_settings) {
        setNotificationSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...user.notification_settings,
        });
      }
    }
    setEditing(false);
    setError(null);
    setSuccess(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const nameParts = formData.name.split(' ');
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(' ') || "";

  const menuItems = [
    { key: "account", label: "Account Settings", icon: "user" },
    { key: "personal", label: "Personal Information", icon: "member" },
    { key: "privacy", label: "Privacy", icon: "folder" },
    { key: "notifications", label: "Notifications", icon: "newspaper" },
  ];
  const isPersonalTab = activeTab === "personal";
  const personalEditable = editing || isPersonalTab;

  const getTabTitle = () => {
    switch (activeTab) {
      case "account": return "Account Settings";
      case "personal": return "Personal Information";
      case "privacy": return "Privacy Settings";
      case "notifications": return "Notification Preferences";
      default: return "Settings";
    }
  };

  const renderAccountSettings = () => (
    <div className="profile-form-grid">
      <div className="profile-form-field">
        <label>First name</label>
        <div className="input-wrapper">
          <input
            type="text"
            value={firstName}
            onChange={(e) => {
              const newName = `${e.target.value} ${lastName}`.trim();
              setFormData({ ...formData, name: newName });
              setError(null);
              setSuccess(false);
            }}
            disabled={!editing}
            placeholder="First name"
          />
        </div>
      </div>
      
      <div className="profile-form-field">
        <label>Last name</label>
        <div className="input-wrapper">
          <input
            type="text"
            value={lastName}
            onChange={(e) => {
              const newName = `${firstName} ${e.target.value}`.trim();
              setFormData({ ...formData, name: newName });
              setError(null);
              setSuccess(false);
            }}
            disabled={!editing}
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="profile-form-field">
        <label>E-mail</label>
        <div className="input-wrapper">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={!editing}
            placeholder="email@example.com"
          />
        </div>
      </div>

      <div className="profile-form-field">
        <label>Phone number</label>
        <div className="input-wrapper">
          <input
            type="tel"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            disabled={!editing}
            placeholder="+254 700 000 000"
          />
        </div>
      </div>

      <div className="profile-form-field">
        <label>Date of Birth</label>
        <div className="input-wrapper">
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth}
            onChange={handleChange}
            disabled={!editing}
          />
        </div>
      </div>

      <div className="profile-form-field">
        <label>Member Role</label>
        <div className="input-wrapper">
          <input
            type="text"
            value={user?.role || "member"}
            disabled
            className="input-readonly"
          />
        </div>
      </div>
    </div>
  );

  const renderPersonalInfo = () => (
    <>
      <div className="profile-form-grid">
        <div className="profile-form-field">
          <label>Gender</label>
          <div className="input-wrapper">
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              disabled={!personalEditable}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="profile-form-field">
          <label>National ID</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="national_id"
              value={formData.national_id}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="12345678"
            />
          </div>
        </div>

        <div className="profile-form-field">
          <label>Occupation</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="e.g. Farmer, Teacher"
            />
          </div>
        </div>

        <div className="profile-form-field profile-form-field--full">
          <label>Address</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="Street address"
            />
          </div>
        </div>

        <div className="profile-form-field">
          <label>County</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="county"
              value={formData.county}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="e.g. Homa Bay"
            />
          </div>
        </div>

        <div className="profile-form-field">
          <label>Sub-County</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="sub_county"
              value={formData.sub_county}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="e.g. Rachuonyo"
            />
          </div>
        </div>
      </div>

      <h3 className="profile-section-title">
        <Icon name="heart" size={18} />
        Emergency Contact
      </h3>
      <div className="profile-form-grid">
        <div className="profile-form-field">
          <label>Contact Name</label>
          <div className="input-wrapper">
            <input
              type="text"
              name="emergency_contact_name"
              value={formData.emergency_contact_name}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="Full name"
            />
          </div>
        </div>

        <div className="profile-form-field">
          <label>Contact Phone</label>
          <div className="input-wrapper">
            <input
              type="tel"
              name="emergency_contact_phone"
              value={formData.emergency_contact_phone}
              onChange={handleChange}
              disabled={!personalEditable}
              placeholder="+254 700 000 000"
            />
          </div>
        </div>

        <div className="profile-form-field">
          <label>Relationship</label>
          <div className="input-wrapper">
            <select
              name="emergency_contact_relationship"
              value={formData.emergency_contact_relationship}
              onChange={handleChange}
              disabled={!personalEditable}
            >
              <option value="">Select relationship</option>
              <option value="spouse">Spouse</option>
              <option value="parent">Parent</option>
              <option value="sibling">Sibling</option>
              <option value="child">Child</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );

  const renderPrivacySettings = () => (
    <div className="settings-list">
      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Show Phone Number</h4>
          <p>Allow other members to see your phone number</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={privacySettings.show_phone}
            onChange={() => handlePrivacyChange('show_phone')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Show Email Address</h4>
          <p>Allow other members to see your email</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={privacySettings.show_email}
            onChange={() => handlePrivacyChange('show_email')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Show Contributions</h4>
          <p>Allow other members to see your contribution history</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={privacySettings.show_contributions}
            onChange={() => handlePrivacyChange('show_contributions')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Profile Visible</h4>
          <p>Make your profile visible to other members</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={privacySettings.profile_visible}
            onChange={() => handlePrivacyChange('profile_visible')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="settings-list">
      <div className="settings-item">
        <div className="settings-item-info">
          <h4>In-App Notifications</h4>
          <p>Show reminders and updates inside the dashboard bell</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.in_app_notifications}
            onChange={() => handleNotificationChange('in_app_notifications')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Email Notifications</h4>
          <p>Receive notifications via email</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.email_notifications}
            onChange={() => handleNotificationChange('email_notifications')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>SMS Notifications</h4>
          <p>Receive notifications via SMS</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.sms_notifications}
            onChange={() => handleNotificationChange('sms_notifications')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Task Notifications</h4>
          <p>Get alerted when work is assigned or updated for you</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.task_notifications}
            onChange={() => handleNotificationChange('task_notifications')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Contribution Reminders</h4>
          <p>Get reminded before contribution due dates</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.contribution_reminders}
            onChange={() => handleNotificationChange('contribution_reminders')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Meeting Reminders</h4>
          <p>Get notified about upcoming meetings</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.meeting_reminders}
            onChange={() => handleNotificationChange('meeting_reminders')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>Payout Alerts</h4>
          <p>Get notified when payouts are made</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.payout_alerts}
            onChange={() => handleNotificationChange('payout_alerts')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>

      <div className="settings-item">
        <div className="settings-item-info">
          <h4>News & Updates</h4>
          <p>Receive group news and announcements</p>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={notificationSettings.news_updates}
            onChange={() => handleNotificationChange('news_updates')}
            disabled={!editing}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return renderAccountSettings();
      case "personal":
        return renderPersonalInfo();
      case "privacy":
        return renderPrivacySettings();
      case "notifications":
        return renderNotificationSettings();
      default:
        return renderAccountSettings();
    }
  };

  return (
    <div className="profile-page-modern">
      {/* Left Sidebar */}
      <div className="profile-sidebar">
        <div className="profile-sidebar-avatar">
          <div className="avatar-circle">
            {formData.name ? formData.name.charAt(0).toUpperCase() : "M"}
          </div>
          <button className="avatar-edit-btn" title="Change photo">
            <Icon name="check" size={12} />
          </button>
        </div>
        <h3 className="profile-sidebar-name">{formData.name || "Member"}</h3>
        
        <nav className="profile-sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.key}
              className={`profile-nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.key); setEditing(false); }}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="profile-signout-btn" onClick={handleSignOut}>
          <Icon name="logout" size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Right Content */}
      <div className="profile-content">
        <h2 className="profile-content-title">{getTabTitle()}</h2>
        
        {editing && (
          <div className="profile-alert profile-alert--editing">
            <Icon name="check" size={16} />
            <span>Edit mode active — make your changes and click Save</span>
          </div>
        )}
        {error && <div className="profile-alert profile-alert--error">{error}</div>}
        {success && <div className="profile-alert profile-alert--success">Profile updated successfully!</div>}

        <form className="profile-form-modern" onSubmit={handleSave}>
          {renderTabContent()}

          {activeTab === "account" && (
            <div className="profile-meta-info">
              <div className="meta-item">
                <Icon name="calendar" size={16} />
                <span>Member since: {user?.join_date ? new Date(user.join_date).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}</span>
              </div>
              <div className="meta-item">
                <Icon name="check-circle" size={16} />
                <span>Status: <strong className="status-active">{user?.status || "Active"}</strong></span>
              </div>
            </div>
          )}

          <div className="profile-form-actions">
            {editing || isPersonalTab ? (
              <>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                <Icon name="check" size={16} />
                Edit {activeTab === "account" ? "Profile" : activeTab === "personal" ? "Information" : "Settings"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
