import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  getMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
  refreshMemberNotificationReminders,
} from "../../lib/dataService.js";
import {
  buildNotificationReminderRefreshStorageKey,
  formatRelativeNotificationTime,
  getNotificationGroupLabel,
  getNotificationGroupKey,
  getNotificationTypeKey,
  groupNotificationsByDay,
  NOTIFICATION_ICON_BY_TYPE,
  REMINDER_REFRESH_INTERVAL_MS,
} from "./notificationMeta.js";

export default function NotificationBell({ tenantId, user, setActivePage, quietModeUntil = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);
  const quietModeActive = Number.isFinite(Number(quietModeUntil)) && Number(quietModeUntil) > Date.now();

  const loadNotifications = useCallback(async () => {
    if (!tenantId || !user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await getMemberNotifications(tenantId, { limit: 12 });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("NotificationBell: failed to load notifications", loadError);
      setError(loadError?.message || "Failed to load notifications.");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, user?.id]);

  const maybeRefreshReminderNotifications = useCallback(
    async (force = false) => {
      if (!tenantId || !user?.id) return false;
      const storageKey = buildNotificationReminderRefreshStorageKey(tenantId, user.id);
      const lastRefresh = Number.parseInt(localStorage.getItem(storageKey) || "", 10);
      if (!force && Number.isFinite(lastRefresh) && Date.now() - lastRefresh < REMINDER_REFRESH_INTERVAL_MS) {
        return false;
      }

      try {
        await refreshMemberNotificationReminders(tenantId);
        localStorage.setItem(storageKey, String(Date.now()));
        return true;
      } catch (refreshError) {
        console.error("NotificationBell: failed to refresh reminder notifications", refreshError);
        return false;
      }
    },
    [tenantId, user?.id]
  );

  useEffect(() => {
    let isMounted = true;

    const loadInbox = async () => {
      await loadNotifications();
      const refreshed = quietModeActive ? false : await maybeRefreshReminderNotifications();
      if (refreshed && isMounted) {
        await loadNotifications();
      }
    };

    loadInbox();

    return () => {
      isMounted = false;
    };
  }, [loadNotifications, maybeRefreshReminderNotifications, quietModeActive]);

  useEffect(() => {
    if (!tenantId || !user?.id || quietModeActive) return undefined;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, tenantId, user?.id, quietModeActive]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return undefined;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => String(item?.status || "unread").toLowerCase() === "unread").length,
    [notifications]
  );
  const displayedUnreadCount = quietModeActive ? 0 : unreadCount;
  const notificationSections = useMemo(
    () => groupNotificationsByDay(notifications),
    [notifications]
  );

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      const refreshed = quietModeActive ? false : await maybeRefreshReminderNotifications();
      if (refreshed) {
        await loadNotifications();
        return;
      }
      await loadNotifications();
    }
  };

  const handleNotificationClick = async (notification) => {
    const notificationId = String(notification?.id || "");
    const targetPage = String(notification?.action_page || "").trim().toLowerCase();

    try {
      if (notificationId && String(notification?.status || "unread").toLowerCase() === "unread") {
        setBusyId(notificationId);
        const updated = await markMemberNotificationRead(notificationId, true);
        if (updated) {
          setNotifications((prev) =>
            prev.map((entry) => (String(entry?.id || "") === notificationId ? updated : entry))
          );
        }
      }
    } catch (markError) {
      console.error("NotificationBell: failed to mark notification read", markError);
    } finally {
      setBusyId("");
    }

    if (targetPage) {
      setActivePage(targetPage);
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (!unreadCount) return;

    try {
      setMarkingAll(true);
      await markAllMemberNotificationsRead(tenantId);
      setNotifications((prev) =>
        prev.map((entry) => ({
          ...entry,
          status: "read",
          read_at: entry?.read_at || new Date().toISOString(),
        }))
      );
    } catch (markError) {
      console.error("NotificationBell: failed to mark all notifications read", markError);
      setError(markError?.message || "Failed to update notifications.");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleViewAll = () => {
    setActivePage("notifications");
    setIsOpen(false);
  };

  return (
    <div className="dashboard-notification-bell" ref={panelRef}>
      <button
        className={`dashboard-icon-btn${isOpen ? " active" : ""}`}
        type="button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <Icon name="bell" size={18} />
        {displayedUnreadCount ? (
          <span className="dashboard-notification-badge">
            {displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="dashboard-notification-panel">
          <div className="dashboard-notification-panel-header">
            <div className="dashboard-notification-panel-heading">
              <strong>Notifications</strong>
              <span>Tasks, meetings, and workspace updates</span>
            </div>
            <div className="dashboard-notification-panel-actions">
              <span className="dashboard-notification-panel-count">
                {quietModeActive
                  ? "Quiet mode active"
                  : unreadCount
                    ? `${unreadCount} unread`
                    : "All caught up"}
              </span>
              <button
                type="button"
                className="dashboard-notification-mark-all"
                onClick={handleMarkAllRead}
                disabled={!unreadCount || markingAll}
              >
                {markingAll ? "Working..." : "Mark all read"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="dashboard-notification-empty">Loading notifications...</div>
          ) : error ? (
            <div className="dashboard-notification-empty">{error}</div>
          ) : notifications.length ? (
            <div className="dashboard-notification-list">
              {notificationSections.map((section) => (
                <section className="dashboard-notification-section" key={section.key}>
                  <div className="dashboard-notification-section-label">{section.label}</div>
                  <div className="dashboard-notification-section-items">
                    {section.items.map((notification) => {
                      const notificationId = String(notification?.id || "");
                      const notificationType = getNotificationTypeKey(notification);
                      const notificationGroup = getNotificationGroupKey(notification);
                      const isUnread =
                        String(notification?.status || "unread").trim().toLowerCase() === "unread";
                      const iconName = NOTIFICATION_ICON_BY_TYPE[notificationType] || "bell";
                      return (
                        <button
                          type="button"
                          key={notificationId || `${notificationType}-${notification?.created_at || ""}`}
                          className={`dashboard-notification-item${isUnread ? " is-unread" : ""}`}
                          onClick={() => handleNotificationClick(notification)}
                          disabled={busyId === notificationId}
                        >
                          <span className="dashboard-notification-item-rail" aria-hidden="true">
                            <span className={`dashboard-notification-item-dot is-${notificationGroup}`} />
                            <span className={`dashboard-notification-item-icon is-${notificationGroup}`}>
                              <Icon name={iconName} size={16} />
                            </span>
                          </span>
                          <span className="dashboard-notification-item-copy">
                            <span className="dashboard-notification-item-head">
                              <span className="dashboard-notification-item-tags">
                                <em className={`dashboard-notification-item-kind is-${notificationGroup}`}>
                                  {getNotificationGroupLabel(notification)}
                                </em>
                                <small>{formatRelativeNotificationTime(notification?.created_at)}</small>
                              </span>
                              {isUnread ? <i className="dashboard-notification-item-unread" /> : null}
                            </span>
                            <strong>{notification?.title || "Notification"}</strong>
                            {notification?.body ? <span>{notification.body}</span> : null}
                            <span className="dashboard-notification-item-meta">
                              {notification?.action_label || "Open"}
                              {isUnread ? <em>New</em> : null}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="dashboard-notification-empty">No reminders yet.</div>
          )}

          <div className="dashboard-notification-panel-footer">
            <button type="button" className="dashboard-notification-view-all" onClick={handleViewAll}>
              Open full inbox
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
