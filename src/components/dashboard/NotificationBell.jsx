import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  getMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
  refreshMemberNotificationReminders,
} from "../../lib/dataService.js";

const NOTIFICATION_ICON_BY_TYPE = {
  task_assigned: "folder",
  task_updated: "folder",
  task_due_soon: "clock-alert",
  task_overdue: "alert",
  meeting_invite: "calendar",
  meeting_reminder: "clock-alert",
  meeting_minutes_ready: "notes",
  news_update: "newspaper",
};

const REMINDER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const formatRelativeNotificationTime = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "";

  const elapsedMs = Date.now() - timestamp;
  const future = elapsedMs < 0;
  const absoluteMs = Math.abs(elapsedMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absoluteMs < minute) return future ? "in moments" : "just now";
  if (absoluteMs < hour) {
    const count = Math.round(absoluteMs / minute);
    return future ? `in ${count} min` : `${count} min ago`;
  }
  if (absoluteMs < day) {
    const count = Math.round(absoluteMs / hour);
    return future ? `in ${count} hr` : `${count} hr ago`;
  }
  const count = Math.round(absoluteMs / day);
  return future ? `in ${count} day${count === 1 ? "" : "s"}` : `${count} day${count === 1 ? "" : "s"} ago`;
};

export default function NotificationBell({ tenantId, user, setActivePage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef(null);

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
      const storageKey = `habuks:notification-reminder-refresh:${tenantId}:${user.id}`;
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
      const refreshed = await maybeRefreshReminderNotifications();
      if (refreshed && isMounted) {
        await loadNotifications();
      }
    };

    loadInbox();

    return () => {
      isMounted = false;
    };
  }, [loadNotifications, maybeRefreshReminderNotifications]);

  useEffect(() => {
    if (!tenantId || !user?.id) return undefined;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadNotifications, tenantId, user?.id]);

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

  const handleToggle = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      const refreshed = await maybeRefreshReminderNotifications();
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
        {unreadCount ? <span className="dashboard-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="dashboard-notification-panel">
          <div className="dashboard-notification-panel-header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
            </div>
            <button
              type="button"
              className="dashboard-notification-mark-all"
              onClick={handleMarkAllRead}
              disabled={!unreadCount || markingAll}
            >
              {markingAll ? "Working..." : "Mark all read"}
            </button>
          </div>

          {loading ? (
            <div className="dashboard-notification-empty">Loading notifications...</div>
          ) : error ? (
            <div className="dashboard-notification-empty">{error}</div>
          ) : notifications.length ? (
            <div className="dashboard-notification-list">
              {notifications.map((notification) => {
                const notificationId = String(notification?.id || "");
                const notificationType = String(notification?.type || "notice").trim().toLowerCase();
                const isUnread = String(notification?.status || "unread").trim().toLowerCase() === "unread";
                const iconName = NOTIFICATION_ICON_BY_TYPE[notificationType] || "bell";
                return (
                  <button
                    type="button"
                    key={notificationId || `${notificationType}-${notification?.created_at || ""}`}
                    className={`dashboard-notification-item${isUnread ? " is-unread" : ""}`}
                    onClick={() => handleNotificationClick(notification)}
                    disabled={busyId === notificationId}
                  >
                    <span className={`dashboard-notification-item-icon is-${String(notification?.kind || "system").toLowerCase()}`}>
                      <Icon name={iconName} size={16} />
                    </span>
                    <span className="dashboard-notification-item-copy">
                      <span className="dashboard-notification-item-head">
                        <strong>{notification?.title || "Notification"}</strong>
                        <small>{formatRelativeNotificationTime(notification?.created_at)}</small>
                      </span>
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
          ) : (
            <div className="dashboard-notification-empty">No reminders yet.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
