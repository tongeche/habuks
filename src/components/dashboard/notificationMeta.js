export const NOTIFICATION_ICON_BY_TYPE = {
  task_assigned: "folder",
  task_updated: "folder",
  task_due_soon: "clock-alert",
  task_overdue: "alert",
  admin_overdue_tasks: "alert",
  meeting_invite: "calendar",
  meeting_reminder: "clock-alert",
  meeting_minutes_ready: "notes",
  admin_minutes_pending: "notes",
  news_update: "newspaper",
  admin_pending_invites: "mail",
};

export const REMINDER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export const formatRelativeNotificationTime = (value) => {
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

export const formatAbsoluteNotificationTime = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "No date";
  return new Date(timestamp).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getNotificationTypeKey = (notification) =>
  String(notification?.type || "notice").trim().toLowerCase();

export const getNotificationKindKey = (notification) =>
  String(notification?.kind || "system").trim().toLowerCase();

export const getNotificationGroupKey = (notification) => {
  const type = getNotificationTypeKey(notification);
  const kind = getNotificationKindKey(notification);

  if (type.startsWith("task_")) return "task";
  if (type.startsWith("meeting_")) return "meeting";
  if (type.startsWith("news_") || kind === "news") return "news";
  return "system";
};

export const getNotificationGroupLabel = (notification) => {
  const group = getNotificationGroupKey(notification);
  if (group === "task") return "Task";
  if (group === "meeting") return "Meeting";
  if (group === "news") return "Update";
  return "Notice";
};

export const buildNotificationReminderRefreshStorageKey = (tenantId, memberId) =>
  `habuks:notification-reminder-refresh:${tenantId}:${memberId}`;

const toDateObject = (value) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
};

const toDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const isSameCalendarDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const getNotificationDayLabel = (value) => {
  const date = toDateObject(value);
  if (!date) return "Earlier";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date, today)) return "Today";
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const groupNotificationsByDay = (notifications = []) => {
  const grouped = [];
  const groupMap = new Map();

  notifications.forEach((notification) => {
    const date = toDateObject(notification?.created_at);
    const key = date ? toDayKey(date) : "unknown";
    if (!groupMap.has(key)) {
      const section = {
        key,
        label: getNotificationDayLabel(notification?.created_at),
        timestamp: date ? date.getTime() : 0,
        items: [],
      };
      groupMap.set(key, section);
      grouped.push(section);
    }
    groupMap.get(key).items.push(notification);
  });

  return grouped.sort((left, right) => right.timestamp - left.timestamp);
};
