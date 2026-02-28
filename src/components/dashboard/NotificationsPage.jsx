import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  getMemberNotifications,
  markAllMemberNotificationsRead,
  markMemberNotificationRead,
  refreshMemberNotificationReminders,
} from "../../lib/dataService.js";
import {
  buildNotificationReminderRefreshStorageKey,
  formatAbsoluteNotificationTime,
  formatRelativeNotificationTime,
  getNotificationGroupKey,
  getNotificationGroupLabel,
  getNotificationTypeKey,
  groupNotificationsByDay,
  NOTIFICATION_ICON_BY_TYPE,
  REMINDER_REFRESH_INTERVAL_MS,
} from "./notificationMeta.js";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const GROUP_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "task", label: "Tasks" },
  { key: "meeting", label: "Meetings" },
  { key: "news", label: "Updates" },
  { key: "system", label: "Other" },
];

const includesText = (value, query) => String(value || "").toLowerCase().includes(query);

export default function NotificationsPage({ tenantId, user, setActivePage }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!tenantId || !user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await getMemberNotifications(tenantId);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("NotificationsPage: failed to load notifications", loadError);
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
        console.error("NotificationsPage: failed to refresh reminders", refreshError);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await maybeRefreshReminderNotifications(true);
      await loadNotifications();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleRead = async (notification, nextReadState) => {
    const notificationId = String(notification?.id || "");
    if (!notificationId) return;

    try {
      setBusyId(notificationId);
      const updated = await markMemberNotificationRead(notificationId, nextReadState);
      if (updated) {
        setNotifications((prev) =>
          prev.map((entry) => (String(entry?.id || "") === notificationId ? updated : entry))
        );
      }
    } catch (markError) {
      console.error("NotificationsPage: failed to update notification state", markError);
      setError(markError?.message || "Failed to update notification state.");
    } finally {
      setBusyId("");
    }
  };

  const handleOpenNotification = async (notification) => {
    if (String(notification?.status || "unread").toLowerCase() === "unread") {
      await handleToggleRead(notification, true);
    }

    const targetPage = String(notification?.action_page || "").trim().toLowerCase();
    if (targetPage) {
      setActivePage(targetPage);
    }
  };

  const handleMarkAllRead = async () => {
    if (!tenantId) return;
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
      console.error("NotificationsPage: failed to mark all notifications read", markError);
      setError(markError?.message || "Failed to update notifications.");
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => String(item?.status || "unread").toLowerCase() === "unread").length,
    [notifications]
  );

  const groupedCounts = useMemo(
    () =>
      notifications.reduce(
        (summary, notification) => {
          const groupKey = getNotificationGroupKey(notification);
          summary[groupKey] = (summary[groupKey] || 0) + 1;
          return summary;
        },
        { task: 0, meeting: 0, news: 0, system: 0 }
      ),
    [notifications]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const status = String(notification?.status || "unread").toLowerCase();
        const groupKey = getNotificationGroupKey(notification);

        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (groupFilter !== "all" && groupKey !== groupFilter) return false;
        if (!normalizedQuery) return true;

        return (
          includesText(notification?.title, normalizedQuery) ||
          includesText(notification?.body, normalizedQuery) ||
          includesText(notification?.action_label, normalizedQuery) ||
          includesText(notification?.category, normalizedQuery) ||
          includesText(notification?.type, normalizedQuery)
        );
      }),
    [notifications, statusFilter, groupFilter, normalizedQuery]
  );
  const notificationSections = useMemo(
    () => groupNotificationsByDay(filteredNotifications),
    [filteredNotifications]
  );

  return (
    <div className="notifications-page">
      <div className="notifications-layout">
        <aside className="notifications-sidebar">
          <div className="notifications-sidebar-card notifications-sidebar-card--hero">
            <span className="notifications-page-kicker">Inbox</span>
            <h2>Notifications</h2>
            <p>Track what needs your attention across tasks, meetings, and workspace updates.</p>
            <div className="notifications-sidebar-highlight">
              <strong>{unreadCount}</strong>
              <span>Unread now</span>
            </div>
          </div>

          <div className="notifications-sidebar-card notifications-sidebar-card--metrics">
            <div className="notifications-sidebar-metric">
              <span>Assignments</span>
              <strong>{groupedCounts.task}</strong>
            </div>
            <div className="notifications-sidebar-metric">
              <span>Meetings</span>
              <strong>{groupedCounts.meeting}</strong>
            </div>
            <div className="notifications-sidebar-metric">
              <span>Updates</span>
              <strong>{groupedCounts.news}</strong>
            </div>
            <div className="notifications-sidebar-metric">
              <span>Total</span>
              <strong>{notifications.length}</strong>
            </div>
          </div>

          <div className="notifications-sidebar-card">
            <label className="notifications-search" htmlFor="notifications-search">
              <Icon name="search" size={16} />
              <input
                id="notifications-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, message, or action"
              />
            </label>
          </div>

          <div className="notifications-sidebar-card">
            <div className="notifications-filter-block">
              <small>Status</small>
              <div className="notifications-filter-group">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`notifications-filter-chip${statusFilter === filter.key ? " is-active" : ""}`}
                    onClick={() => setStatusFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="notifications-filter-block">
              <small>Type</small>
              <div className="notifications-filter-group">
                {GROUP_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`notifications-filter-chip${groupFilter === filter.key ? " is-active" : ""}`}
                    onClick={() => setGroupFilter(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="notifications-sidebar-card notifications-sidebar-card--actions">
            <button
              type="button"
              className="notifications-page-button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <Icon name="refresh-cw" size={15} />
              <span>{refreshing ? "Refreshing..." : "Refresh inbox"}</span>
            </button>
            <button
              type="button"
              className="notifications-page-button notifications-page-button--primary"
              onClick={handleMarkAllRead}
              disabled={!unreadCount || markingAll}
            >
              <Icon name="check-circle" size={15} />
              <span>{markingAll ? "Working..." : "Mark all read"}</span>
            </button>
          </div>
        </aside>

        <section className="notifications-main">
          <div className="notifications-main-header">
            <div>
              <strong>{filteredNotifications.length} shown</strong>
              <span>
                {normalizedQuery
                  ? `Results for "${searchQuery.trim()}"`
                  : unreadCount
                    ? `${unreadCount} unread notifications waiting`
                    : "Everything is up to date"}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="notifications-empty-state">Loading notifications...</div>
          ) : error ? (
            <div className="notifications-empty-state">{error}</div>
          ) : notificationSections.length ? (
            <div className="notifications-feed">
              {notificationSections.map((section) => (
                <section className="notifications-day-group" key={section.key}>
                  <div className="notifications-day-label">{section.label}</div>
                  <div className="notifications-day-list">
                    {section.items.map((notification) => {
                      const notificationId = String(notification?.id || "");
                      const notificationType = getNotificationTypeKey(notification);
                      const notificationGroup = getNotificationGroupKey(notification);
                      const iconName = NOTIFICATION_ICON_BY_TYPE[notificationType] || "bell";
                      const isUnread =
                        String(notification?.status || "unread").toLowerCase() === "unread";
                      const canOpen = Boolean(String(notification?.action_page || "").trim());
                      const actionLabel = String(notification?.action_label || "").trim() || "Open";

                      return (
                        <article
                          key={notificationId || `${notificationType}-${notification?.created_at || ""}`}
                          className={`notifications-feed-item${isUnread ? " is-unread" : ""}`}
                        >
                          <div className="notifications-feed-rail" aria-hidden="true">
                            <span className={`dashboard-notification-item-dot is-${notificationGroup}`} />
                            <div className={`dashboard-notification-item-icon is-${notificationGroup}`}>
                              <Icon name={iconName} size={16} />
                            </div>
                          </div>

                          <div className="notifications-feed-copy">
                            <div className="notifications-feed-head">
                              <div>
                                <div className="notifications-feed-labels">
                                  <span className={`notifications-kind-chip is-${notificationGroup}`}>
                                    {getNotificationGroupLabel(notification)}
                                  </span>
                                  <span className="notifications-feed-time">
                                    {formatRelativeNotificationTime(notification?.created_at)}
                                  </span>
                                </div>
                                <h3>{notification?.title || "Notification"}</h3>
                              </div>
                              {isUnread ? <span className="notifications-unread-dot" aria-label="Unread" /> : null}
                            </div>

                            {notification?.body ? <p>{notification.body}</p> : null}

                            <div className="notifications-feed-meta">
                              <span>{formatAbsoluteNotificationTime(notification?.created_at)}</span>
                              {notification?.category ? <span>{String(notification.category)}</span> : null}
                              {notification?.priority ? <span>{String(notification.priority)}</span> : null}
                            </div>
                          </div>

                          <div className="notifications-feed-actions">
                            <button
                              type="button"
                              className="notifications-row-button"
                              onClick={() => handleToggleRead(notification, !isUnread)}
                              disabled={busyId === notificationId}
                            >
                              {isUnread ? "Mark read" : "Mark unread"}
                            </button>
                            {canOpen ? (
                              <button
                                type="button"
                                className="notifications-row-button notifications-row-button--primary"
                                onClick={() => handleOpenNotification(notification)}
                                disabled={busyId === notificationId}
                              >
                                {actionLabel}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="notifications-empty-state">
              {notifications.length
                ? "No notifications match the current filters."
                : "No notifications yet. Assigned tasks, meeting reminders, and updates will appear here."}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
