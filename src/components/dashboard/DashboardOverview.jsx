import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import {
  getMeetings,
  getMembersAdmin,
  getProjectExpensesForProjects,
  getProjectMemberAssignmentsSummary,
  getProjectSalesForProjects,
  getProjectsWithMembership,
  getTenantById,
  getTenantMagicLinkInvites,
} from "../../lib/dataService.js";
import { isAdminRole } from "./roleAccess.js";

const PROJECT_STATUS_PRIORITY = {
  active: 0,
  planning: 1,
  completed: 2,
  paused: 3,
};

const OVERVIEW_ANALYTICS_MONTHS = 6;
const OVERVIEW_RING_RADIUS = 34;
const OVERVIEW_RING_CIRCUMFERENCE = 2 * Math.PI * OVERVIEW_RING_RADIUS;
const OVERVIEW_CATEGORY_COLORS = ["#2563eb", "#0f766e", "#f97316", "#8b5cf6", "#e11d48"];
const OVERVIEW_MINI_DONUT_RADIUS = 22;
const OVERVIEW_MINI_DONUT_CIRCUMFERENCE = 2 * Math.PI * OVERVIEW_MINI_DONUT_RADIUS;
const FIGURE_DONUT_RADIUS = 16;
const FIGURE_DONUT_CIRCUMFERENCE = 2 * Math.PI * FIGURE_DONUT_RADIUS;
const FIGURE_VISUAL_PALETTES = {
  green: {
    line: "#58b99d",
    fill: "rgba(88, 185, 157, 0.18)",
    top: "#96d8c1",
    bottom: "#58b99d",
    track: "#dff3ec",
  },
  rose: {
    line: "#de8ea0",
    fill: "rgba(222, 142, 160, 0.18)",
    top: "#f2bcc9",
    bottom: "#de8ea0",
    track: "#fbe5ea",
  },
  blue: {
    line: "#7ca8ea",
    fill: "rgba(124, 168, 234, 0.18)",
    top: "#b9d0f7",
    bottom: "#7ca8ea",
    track: "#e3edfb",
  },
  amber: {
    line: "#e7a05d",
    fill: "rgba(231, 160, 93, 0.18)",
    top: "#f4c99d",
    bottom: "#e7a05d",
    track: "#fae9d8",
  },
  neutral: {
    line: "#94a3b8",
    fill: "rgba(148, 163, 184, 0.18)",
    top: "#cbd5e1",
    bottom: "#94a3b8",
    track: "#e2e8f0",
  },
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatLabel = (value, fallback = "Unknown") => {
  const raw = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ");
  if (!raw) return fallback;
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (value, options = {}) => {
  if (!value) return "No date";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "No date";
  return parsed.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "No time";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "No time";
  return parsed.toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCurrency = (value, compact = false) => {
  const numeric = toNumber(value);
  if (!compact) {
    return `KES ${numeric.toLocaleString("en-KE")}`;
  }
  const absolute = Math.abs(numeric);
  if (absolute >= 1000000) {
    const millions = absolute / 1000000;
    const label = `${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}`.replace(/\.0$/, "");
    return `KES ${numeric < 0 ? "-" : ""}${label}M`;
  }
  if (absolute >= 1000) {
    const thousands = absolute / 1000;
    const label = `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}`.replace(/\.0$/, "");
    return `KES ${numeric < 0 ? "-" : ""}${label}K`;
  }
  return `KES ${numeric.toLocaleString("en-KE")}`;
};

const formatPercent = (value) => `${Math.round(toNumber(value))}%`;

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(toNumber(value))));

const getMonthKey = (value) => {
  const parsed = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
};

const buildMonthFrames = (count = OVERVIEW_ANALYTICS_MONTHS) => {
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0);
  anchor.setDate(1);

  return Array.from({ length: count }, (_, index) => {
    const frameDate = new Date(anchor.getFullYear(), anchor.getMonth() - (count - 1 - index), 1);
    return {
      key: getMonthKey(frameDate),
      label: frameDate.toLocaleDateString("en-KE", { month: "short" }),
      longLabel: frameDate.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
    };
  });
};

const formatDeltaLabel = (current, previous) => {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (!currentValue && !previousValue) return "Flat vs last month";
  if (!previousValue) return currentValue > 0 ? "New this month" : "Flat vs last month";

  const deltaPercent = Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 100);
  if (deltaPercent === 0) return "Flat vs last month";
  return `${deltaPercent > 0 ? "+" : ""}${deltaPercent}% vs last month`;
};

const buildLineChart = (values, width = 320, height = 160, maxValue = null) => {
  const safeValues = values.length
    ? values.map((value) => Math.max(0, toNumber(value)))
    : [0];
  const limit = Number.isFinite(maxValue) ? toNumber(maxValue) : 0;
  const max = Math.max(1, limit, ...safeValues);
  const topPadding = 12;
  const bottomPadding = 22;
  const sidePadding = 14;
  const innerWidth = Math.max(1, width - sidePadding * 2);
  const innerHeight = Math.max(1, height - topPadding - bottomPadding);

  const points = safeValues.map((value, index) => {
    const x =
      sidePadding +
      (safeValues.length === 1 ? innerWidth / 2 : (index * innerWidth) / (safeValues.length - 1));
    const y = topPadding + innerHeight - (value / max) * innerHeight;
    return { x, y, value };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const baseY = topPadding + innerHeight;
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`
    : "";

  return {
    width,
    height,
    points,
    linePath,
    areaPath,
    baseY,
    lastPoint: points[points.length - 1] || null,
  };
};

const summarizeText = (value, maxLength = 120) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
};

const formatHandleLabel = (value, fallback = "Workspace") => {
  const raw = String(value || "")
    .trim()
    .split("@")[0]
    .replace(/[._-]+/g, " ");
  return formatLabel(raw, fallback);
};

const getInitials = (value, fallback = "WS") => {
  const text = String(value || "")
    .trim()
    .replace(/[._-]+/g, " ");
  if (!text) return fallback;
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const parseTimestamp = (value) => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getRoleSummary = (role, workspaceName, canViewAllProjects) => {
  if (role === "superadmin" || role === "admin") {
    return `Full workspace view for ${workspaceName} across organization health, project delivery, and finance.`;
  }
  if (role === "supervisor") {
    return `Operational view for ${workspaceName} across delivery, reports, and spending trends.`;
  }
  if (role === "project_manager") {
    return `Project-led view for ${workspaceName} focused on the teams, programs, and finances you manage.`;
  }
  if (!canViewAllProjects) {
    return `Assigned-project view for ${workspaceName}. Project and finance signals below reflect the work you can access.`;
  }
  return `Workspace summary for ${workspaceName}.`;
};

const normalizeProjectStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "active" || normalized === "ongoing" || normalized === "in_progress") {
    return "active";
  }
  if (normalized === "planning" || normalized === "draft" || normalized === "pending") {
    return "planning";
  }
  if (normalized === "completed" || normalized === "closed" || normalized === "done") {
    return "completed";
  }
  if (normalized === "paused" || normalized === "on_hold" || normalized === "hold") {
    return "paused";
  }
  return normalized || "active";
};

const getProjectStatusTone = (value) => {
  const normalized = normalizeProjectStatus(value);
  if (normalized === "active") return "green";
  if (normalized === "planning") return "amber";
  if (normalized === "completed") return "blue";
  if (normalized === "paused") return "neutral";
  return "neutral";
};

const getMeetingTitle = (meeting) =>
  String(
    meeting?.title || meeting?.agenda || meeting?.subject || meeting?.type || "Activity"
  ).trim();

const normalizeMeetingStatus = (meeting) => {
  const explicit = String(meeting?.status || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (explicit === "in_progress") return "in_progress";
  if (explicit === "completed" || explicit === "done") return "completed";
  if (explicit === "cancelled" || explicit === "canceled") return "cancelled";
  const timestamp = parseTimestamp(meeting?.date || meeting?.meeting_date);
  if (!timestamp) return "scheduled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetingDay = new Date(timestamp);
  meetingDay.setHours(0, 0, 0, 0);
  if (meetingDay.getTime() < today.getTime()) return "completed";
  if (meetingDay.getTime() === today.getTime()) return "today";
  return "upcoming";
};

const getMeetingStatusLabel = (meeting) => {
  const normalized = normalizeMeetingStatus(meeting);
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "today") return "Today";
  return formatLabel(normalized, "Scheduled");
};

const getMeetingTone = (meeting) => {
  const normalized = normalizeMeetingStatus(meeting);
  if (normalized === "completed") return "green";
  if (normalized === "today" || normalized === "in_progress") return "blue";
  if (normalized === "cancelled") return "neutral";
  return "amber";
};

const getSaleTotal = (sale) => {
  if (!sale) return 0;
  if (sale.total_amount !== undefined && sale.total_amount !== null) {
    return toNumber(sale.total_amount);
  }
  const units = toNumber(sale.quantity_units);
  const kg = toNumber(sale.quantity_kg);
  const unitPrice = toNumber(sale.unit_price);
  return units * unitPrice || kg * unitPrice;
};

const getCurrencyDirectionTone = (value) => {
  if (value > 0) return "green";
  if (value < 0) return "rose";
  return "neutral";
};

const normalizeVisualValues = (values, minLength = 5) => {
  const safeValues = Array.isArray(values) && values.length
    ? values.map((value) => Math.max(0, toNumber(value)))
    : [0];

  if (safeValues.length >= minLength) return safeValues;
  return [...safeValues, ...Array.from({ length: minLength - safeValues.length }, () => 0)];
};

const FigureVisual = ({ variant = "bars", values, tone = "blue", percent = 0 }) => {
  const palette = FIGURE_VISUAL_PALETTES[tone] || FIGURE_VISUAL_PALETTES.blue;
  const safeValues = normalizeVisualValues(values);

  if (variant === "area") {
    const chart = buildLineChart(safeValues, 110, 58);
    return (
      <div className="overview-home-figure-visual overview-home-figure-visual--area" aria-hidden="true">
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none">
          <path d={chart.areaPath} fill={palette.fill} />
          <path d={chart.linePath} stroke={palette.line} strokeWidth="2.4" fill="none" />
          {chart.lastPoint ? <circle cx={chart.lastPoint.x} cy={chart.lastPoint.y} r="3.5" fill={palette.line} /> : null}
        </svg>
      </div>
    );
  }

  if (variant === "donut") {
    const value = clampPercent(percent);
    const dash = (value / 100) * FIGURE_DONUT_CIRCUMFERENCE;
    return (
      <div className="overview-home-figure-visual overview-home-figure-visual--donut" aria-hidden="true">
        <svg viewBox="0 0 48 48" className="overview-home-figure-donut-svg">
          <circle cx="24" cy="24" r={FIGURE_DONUT_RADIUS} stroke={palette.track} strokeWidth="6" fill="none" />
          <circle
            cx="24"
            cy="24"
            r={FIGURE_DONUT_RADIUS}
            stroke={palette.line}
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
            style={{
              strokeDasharray: `${dash} ${FIGURE_DONUT_CIRCUMFERENCE}`,
              transform: "rotate(-90deg)",
              transformOrigin: "24px 24px",
            }}
          />
        </svg>
        <span style={{ color: palette.line }}>{value}%</span>
      </div>
    );
  }

  const visualValues = variant === "capsules" ? safeValues.slice(-3) : safeValues.slice(-5);
  const max = Math.max(1, ...visualValues);

  return (
    <div
      className={`overview-home-figure-visual overview-home-figure-visual--${variant}`}
      aria-hidden="true"
    >
      {visualValues.map((value, index) => {
        const height = Math.max(value > 0 ? (variant === "capsules" ? 18 : 14) : 10, (value / max) * 100);
        return (
          <span
            key={`${variant}-${index}-${value}`}
            style={{
              height: `${height}%`,
              background: `linear-gradient(180deg, ${palette.top}, ${palette.bottom})`,
              boxShadow: `inset 0 0 0 1px ${palette.fill}`,
            }}
          />
        );
      })}
    </div>
  );
};

const MiniDonut = ({ value, tone = "blue" }) => {
  const percent = clampPercent(value);
  const dash = (percent / 100) * OVERVIEW_MINI_DONUT_CIRCUMFERENCE;

  return (
    <div className={`overview-home-mini-donut tone-${tone}`} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="overview-home-mini-donut-svg">
        <circle className="overview-home-mini-donut-bg" cx="32" cy="32" r={OVERVIEW_MINI_DONUT_RADIUS} />
        <circle
          className="overview-home-mini-donut-fill"
          cx="32"
          cy="32"
          r={OVERVIEW_MINI_DONUT_RADIUS}
          style={{
            strokeDasharray: `${dash} ${OVERVIEW_MINI_DONUT_CIRCUMFERENCE}`,
          }}
        />
      </svg>
      <span>{percent}%</span>
    </div>
  );
};

const buildRecentTimeline = ({
  meetings,
  expenses,
  sales,
  invites,
  projectNameById,
  canSeeInvites,
  memberNameById,
}) => {
  const activityItems = (meetings || []).slice(0, 6).map((meeting) => {
    const actor =
      memberNameById.get(Number(meeting?.owner_member_id)) ||
      memberNameById.get(Number(meeting?.assignees?.[0])) ||
      "Program lead";
    const projectLabel = meeting?.project_id
      ? projectNameById.get(Number(meeting.project_id)) || "Project"
      : "Workspace";
    const timestampValue = meeting?.date || meeting?.meeting_date || meeting?.created_at;

    return {
      id: `meeting-${meeting?.id || getMeetingTitle(meeting)}`,
      icon: "calendar",
      tone: getMeetingTone(meeting),
      actor,
      action: getMeetingTitle(meeting),
      detail: `${getMeetingStatusLabel(meeting)} • ${projectLabel}`,
      timestampLabel: formatTimeLabel(timestampValue),
      dateLabel: formatDate(timestampValue, { month: "short", day: "numeric" }),
      timestamp: parseTimestamp(timestampValue),
    };
  });

  const expenseItems = (expenses || []).slice(0, 6).map((expense) => {
    const projectLabel = projectNameById.get(Number(expense?.project_id)) || "Project";
    return {
      id: `expense-${expense?.id || expense?.expense_date || expense?.description}`,
      icon: "receipt",
      tone: "amber",
      actor: formatLabel(expense?.category, "Finance desk"),
      action: expense?.description || "Expense logged",
      detail: `${projectLabel} • ${formatCurrency(expense?.amount, true)}`,
      timestampLabel: formatTimeLabel(expense?.expense_date || expense?.created_at),
      dateLabel: formatDate(expense?.expense_date || expense?.created_at, { month: "short", day: "numeric" }),
      timestamp: parseTimestamp(expense?.expense_date || expense?.created_at),
    };
  });

  const saleItems = (sales || []).slice(0, 6).map((sale) => {
    const projectLabel = projectNameById.get(Number(sale?.project_id)) || "Project";
    const actor = sale?.customer_name || "Revenue desk";
    return {
      id: `sale-${sale?.id || sale?.sale_date || sale?.customer_name}`,
      icon: "wallet",
      tone: "green",
      actor,
      action: sale?.customer_name ? "Payment received and posted" : "Revenue posted",
      detail: `${projectLabel} • ${formatCurrency(getSaleTotal(sale), true)}`,
      timestampLabel: formatTimeLabel(sale?.sale_date || sale?.created_at),
      dateLabel: formatDate(sale?.sale_date || sale?.created_at, { month: "short", day: "numeric" }),
      timestamp: parseTimestamp(sale?.sale_date || sale?.created_at),
    };
  });

  const inviteItems = canSeeInvites
    ? (invites || []).slice(0, 6).map((invite) => ({
        id: `invite-${invite?.id || invite?.email || invite?.created_at}`,
        icon: "mail",
        tone: "blue",
        actor: formatHandleLabel(invite?.email, "Team admin"),
        action: invite?.email ? `Invite created for ${invite.email}` : "Member invite created",
        detail: `${formatLabel(invite?.role, "Member")} • ${formatLabel(invite?.status, "Pending")}`,
        timestampLabel: formatTimeLabel(invite?.created_at),
        dateLabel: formatDate(invite?.created_at, { month: "short", day: "numeric" }),
        timestamp: parseTimestamp(invite?.created_at),
      }))
    : [];

  return [...activityItems, ...expenseItems, ...saleItems, ...inviteItems]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 7)
    .map((item) => ({
      ...item,
      initials: getInitials(item.actor, formatLabel(item.icon, "WS").slice(0, 2).toUpperCase()),
    }));
};

const buildSignals = ({
  totalProjects,
  activeProjects,
  pendingInvites,
  membersWithoutProjects,
  netPosition,
  visibleProjects,
  totalMeetings,
  upcomingMeetings,
  topRevenueProject,
  canSeeInvites,
  canViewAllProjects,
}) => {
  const signals = [];

  if (!totalProjects) {
    signals.push({
      icon: "briefcase",
      tone: "neutral",
      title: "No projects in this workspace yet",
      body: "Project delivery metrics will populate once the first program is created.",
    });
  } else if (activeProjects < totalProjects) {
    signals.push({
      icon: "flag",
      tone: "amber",
      title: `${totalProjects - activeProjects} projects need status attention`,
      body: `${activeProjects} of ${totalProjects} projects are currently active or planning.`,
    });
  }

  if (canSeeInvites && pendingInvites > 0) {
    signals.push({
      icon: "mail",
      tone: "blue",
      title: `${pendingInvites} member invites still pending`,
      body: "Onboarding remains incomplete for part of the workspace team.",
    });
  }

  if (canViewAllProjects && membersWithoutProjects > 0) {
    signals.push({
      icon: "users",
      tone: "amber",
      title: `${membersWithoutProjects} members are not assigned to a project`,
      body: "They are part of the organization directory but not yet attached to program delivery.",
    });
  }

  if (netPosition < 0) {
    signals.push({
      icon: "alert",
      tone: "rose",
      title: "Spending is ahead of recorded income",
      body: `Net position is ${formatCurrency(netPosition)} across the visible projects.`,
    });
  } else if (topRevenueProject) {
    signals.push({
      icon: "trending-up",
      tone: "green",
      title: `${topRevenueProject.name} leads current revenue`,
      body: `${formatCurrency(topRevenueProject.revenue)} collected so far.`,
    });
  }

  if (totalProjects > 0 && visibleProjects < totalProjects) {
    signals.push({
      icon: "globe",
      tone: "blue",
      title: `${visibleProjects} of ${totalProjects} projects are public`,
      body: "Some programs are still hidden from the public website profile.",
    });
  }

  if (totalMeetings > 0 && upcomingMeetings === 0) {
    signals.push({
      icon: "calendar",
      tone: "neutral",
      title: "No upcoming activities are scheduled",
      body: "The activity board only shows completed items right now.",
    });
  }

  return signals.slice(0, 4);
};

const renderLoadingCards = () => (
  <>
    <section className="overview-home-kpis overview-home-kpis--loading" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <div key={`overview-loading-kpi-${index}`} className="overview-home-skeleton overview-home-skeleton--card" />
      ))}
    </section>
    <section className="overview-home-analytics" aria-hidden="true">
      <div className="overview-home-skeleton overview-home-skeleton--panel overview-home-skeleton--wide" />
      <div className="overview-home-skeleton overview-home-skeleton--panel" />
      <div className="overview-home-skeleton overview-home-skeleton--panel" />
    </section>
    <section className="overview-home-columns" aria-hidden="true">
      <div className="overview-home-column">
        <div className="overview-home-skeleton overview-home-skeleton--panel" />
        <div className="overview-home-skeleton overview-home-skeleton--panel" />
      </div>
      <div className="overview-home-column">
        <div className="overview-home-skeleton overview-home-skeleton--panel" />
        <div className="overview-home-skeleton overview-home-skeleton--panel" />
      </div>
    </section>
  </>
);

export default function DashboardOverview({
  user,
  tenantId,
  tenantBrand,
  tenantFeatures,
  access,
  setActivePage,
  tenantRole,
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tenantRecord, setTenantRecord] = useState(null);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [invites, setInvites] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);

  const normalizedRole = String(tenantRole || user?.role || "member").trim().toLowerCase();
  const canViewAllProjects = isAdminRole(normalizedRole) || normalizedRole === "supervisor";
  const canSeeInvites = isAdminRole(normalizedRole);
  const canLoadProjects = tenantFeatures?.projects !== false;
  const canLoadActivities = tenantFeatures?.meetings !== false;
  const canLoadFinance = tenantFeatures?.expenses !== false || tenantFeatures?.reports !== false;

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      if (!tenantId || !user?.id) {
        if (!cancelled) {
          setLoading(false);
          setLoadError("Workspace context is missing.");
          setTenantRecord(null);
          setMembers([]);
          setProjects([]);
          setMeetings([]);
          setInvites([]);
          setAssignments([]);
          setExpenses([]);
          setSales([]);
        }
        return;
      }

      setLoading(true);
      setLoadError("");

      const [
        tenantResult,
        membersResult,
        projectsResult,
        meetingsResult,
        invitesResult,
        assignmentsResult,
      ] = await Promise.allSettled([
        getTenantById(tenantId),
        getMembersAdmin(tenantId),
        canLoadProjects ? getProjectsWithMembership(user.id, tenantId) : Promise.resolve([]),
        canLoadActivities ? getMeetings(tenantId) : Promise.resolve([]),
        canSeeInvites ? getTenantMagicLinkInvites(tenantId, { limit: 50 }) : Promise.resolve([]),
        canLoadProjects ? getProjectMemberAssignmentsSummary(tenantId) : Promise.resolve([]),
      ]);

      if (cancelled) return;

      const errors = [];

      const nextTenant = tenantResult.status === "fulfilled" ? tenantResult.value || null : null;
      if (tenantResult.status !== "fulfilled") {
        errors.push("Organization profile could not be fully loaded.");
        console.error("Overview tenant load error:", tenantResult.reason);
      }

      const nextMembers =
        membersResult.status === "fulfilled" && Array.isArray(membersResult.value)
          ? membersResult.value
          : [];
      if (membersResult.status !== "fulfilled") {
        errors.push("Members data is incomplete.");
        console.error("Overview members load error:", membersResult.reason);
      }

      const scopedProjects =
        projectsResult.status === "fulfilled" && Array.isArray(projectsResult.value)
          ? (projectsResult.value || []).filter((project) => {
              if (canViewAllProjects) return true;
              return Boolean(project?.membership) || String(project?.project_leader || "") === String(user?.id || "");
            })
          : [];
      if (projectsResult.status !== "fulfilled") {
        errors.push("Projects data is incomplete.");
        console.error("Overview projects load error:", projectsResult.reason);
      }

      const nextMeetings =
        meetingsResult.status === "fulfilled" && Array.isArray(meetingsResult.value)
          ? meetingsResult.value
          : [];
      if (meetingsResult.status !== "fulfilled" && canLoadActivities) {
        errors.push("Activities data is incomplete.");
        console.error("Overview meetings load error:", meetingsResult.reason);
      }

      const nextInvites =
        invitesResult.status === "fulfilled" && Array.isArray(invitesResult.value)
          ? invitesResult.value
          : [];
      if (invitesResult.status !== "fulfilled" && canSeeInvites) {
        errors.push("Invite metrics are incomplete.");
        console.error("Overview invites load error:", invitesResult.reason);
      }

      const nextAssignments =
        assignmentsResult.status === "fulfilled" && Array.isArray(assignmentsResult.value)
          ? assignmentsResult.value
          : [];
      if (assignmentsResult.status !== "fulfilled" && canLoadProjects) {
        console.error("Overview assignment summary load error:", assignmentsResult.reason);
      }

      const scopedProjectIds = scopedProjects.map((project) => Number(project?.id)).filter(Boolean);

      let nextExpenses = [];
      let nextSales = [];
      if (canLoadFinance && scopedProjectIds.length) {
        const [expensesResult, salesResult] = await Promise.allSettled([
          getProjectExpensesForProjects(scopedProjectIds, tenantId),
          getProjectSalesForProjects(scopedProjectIds, tenantId),
        ]);

        if (cancelled) return;

        if (expensesResult.status === "fulfilled" && Array.isArray(expensesResult.value)) {
          nextExpenses = expensesResult.value;
        } else if (canLoadFinance) {
          errors.push("Expense metrics are incomplete.");
          console.error("Overview expenses load error:", expensesResult.reason);
        }

        if (salesResult.status === "fulfilled" && Array.isArray(salesResult.value)) {
          nextSales = salesResult.value;
        } else if (canLoadFinance) {
          errors.push("Income metrics are incomplete.");
          console.error("Overview sales load error:", salesResult.reason);
        }
      }

      setTenantRecord(nextTenant);
      setMembers(nextMembers);
      setProjects(scopedProjects);
      setMeetings(nextMeetings);
      setInvites(nextInvites);
      setAssignments(nextAssignments);
      setExpenses(nextExpenses);
      setSales(nextSales);
      setLoadError(errors.join(" "));
      setLoading(false);
    };

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [
    tenantId,
    user?.id,
    normalizedRole,
    canLoadActivities,
    canLoadFinance,
    canLoadProjects,
    canSeeInvites,
    canViewAllProjects,
  ]);

  const workspaceName = tenantBrand?.name || tenantRecord?.name || "Workspace";
  const workspaceTagline =
    String(tenantBrand?.tagline || tenantRecord?.tagline || "").trim() ||
    getRoleSummary(normalizedRole, workspaceName, canViewAllProjects);

  const projectIds = useMemo(
    () => new Set(projects.map((project) => Number(project?.id)).filter(Boolean)),
    [projects]
  );

  const projectNameById = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => {
      const parsedId = Number(project?.id);
      if (!parsedId) return;
      map.set(parsedId, project?.name || `Project ${parsedId}`);
    });
    return map;
  }, [projects]);

  const memberNameById = useMemo(() => {
    const map = new Map();
    members.forEach((member) => {
      const parsedId = Number(member?.id);
      if (!parsedId) return;
      map.set(parsedId, String(member?.name || "").trim() || `Member ${parsedId}`);
    });
    return map;
  }, [members]);

  const meetingStats = useMemo(() => {
    let completed = 0;
    let upcoming = 0;
    let today = 0;

    meetings.forEach((meeting) => {
      const normalized = normalizeMeetingStatus(meeting);
      if (normalized === "completed") {
        completed += 1;
        return;
      }
      if (normalized === "today" || normalized === "in_progress") {
        today += 1;
        upcoming += 1;
        return;
      }
      if (normalized === "cancelled") {
        return;
      }
      upcoming += 1;
    });

    return {
      total: meetings.length,
      completed,
      upcoming,
      today,
    };
  }, [meetings]);

  const memberStats = useMemo(() => {
    const active = members.filter(
      (member) => String(member?.status || "active").trim().toLowerCase() === "active"
    ).length;
    return {
      total: members.length,
      active,
      inactive: Math.max(0, members.length - active),
    };
  }, [members]);

  const projectStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((project) => {
      const status = normalizeProjectStatus(project?.status);
      return status === "active" || status === "planning";
    }).length;
    const visible = projects.filter((project) => project?.is_visible !== false).length;
    const budgetTotal = projects.reduce((sum, project) => sum + Math.max(0, toNumber(project?.budget_total)), 0);
    const expectedRevenue = projects.reduce(
      (sum, project) => sum + Math.max(0, toNumber(project?.expected_revenue)),
      0
    );
    return {
      total,
      active,
      visible,
      budgetTotal,
      expectedRevenue,
    };
  }, [projects]);

  const assignmentsInScope = useMemo(() => {
    if (!projectIds.size) return [];
    return assignments.filter((assignment) => projectIds.has(Number(assignment?.project_id)));
  }, [assignments, projectIds]);

  const assignedMemberIds = useMemo(
    () =>
      new Set(
        assignmentsInScope
          .map((assignment) => Number(assignment?.member_id))
          .filter((memberId) => Number.isInteger(memberId) && memberId > 0)
      ),
    [assignmentsInScope]
  );

  const expenseByProject = useMemo(() => {
    const map = new Map();
    expenses.forEach((expense) => {
      const projectId = Number(expense?.project_id);
      if (!projectId) return;
      map.set(projectId, (map.get(projectId) || 0) + toNumber(expense?.amount));
    });
    return map;
  }, [expenses]);

  const salesByProject = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const projectId = Number(sale?.project_id);
      if (!projectId) return;
      map.set(projectId, (map.get(projectId) || 0) + getSaleTotal(sale));
    });
    return map;
  }, [sales]);

  const financeStats = useMemo(() => {
    const income = sales.reduce((sum, sale) => sum + getSaleTotal(sale), 0);
    const expensesTotal = expenses.reduce((sum, expense) => sum + toNumber(expense?.amount), 0);
    const net = income - expensesTotal;
    const budgetUsePercent =
      projectStats.budgetTotal > 0 ? clampPercent((expensesTotal / projectStats.budgetTotal) * 100) : 0;
    const revenueProgressPercent =
      projectStats.expectedRevenue > 0
        ? clampPercent((income / projectStats.expectedRevenue) * 100)
        : 0;
    return {
      income,
      expenses: expensesTotal,
      net,
      budgetUsePercent,
      revenueProgressPercent,
    };
  }, [sales, expenses, projectStats.budgetTotal, projectStats.expectedRevenue]);

  const expenseCategoryRows = useMemo(() => {
    const categories = new Map();

    expenses.forEach((expense) => {
      const label = formatLabel(expense?.category, "Uncategorized");
      const existing = categories.get(label) || { label, value: 0, count: 0 };
      existing.value += toNumber(expense?.amount);
      existing.count += 1;
      categories.set(label, existing);
    });

    const total = Array.from(categories.values()).reduce((sum, item) => sum + item.value, 0);

    return Array.from(categories.values())
      .sort((left, right) => right.value - left.value)
      .slice(0, 5)
      .map((item, index) => ({
        ...item,
        percent: total > 0 ? clampPercent((item.value / total) * 100) : 0,
        color: OVERVIEW_CATEGORY_COLORS[index % OVERVIEW_CATEGORY_COLORS.length],
      }));
  }, [expenses]);

  const projectStatusRows = useMemo(() => {
    const statuses = new Map();

    projects.forEach((project) => {
      const normalized = normalizeProjectStatus(project?.status);
      const label = formatLabel(normalized, "Active");
      const existing = statuses.get(label) || { label, value: 0, tone: getProjectStatusTone(normalized) };
      existing.value += 1;
      statuses.set(label, existing);
    });

    return Array.from(statuses.values())
      .sort((left, right) => right.value - left.value)
      .map((item) => ({
        ...item,
        percent: projects.length > 0 ? clampPercent((item.value / projects.length) * 100) : 0,
      }));
  }, [projects]);

  const projectCards = useMemo(() => {
    return [...projects]
      .sort((left, right) => {
        const leftStatus = normalizeProjectStatus(left?.status);
        const rightStatus = normalizeProjectStatus(right?.status);
        const statusWeight =
          (PROJECT_STATUS_PRIORITY[leftStatus] ?? 99) - (PROJECT_STATUS_PRIORITY[rightStatus] ?? 99);
        if (statusWeight !== 0) return statusWeight;
        const leftScore =
          (salesByProject.get(Number(left?.id)) || 0) +
          (expenseByProject.get(Number(left?.id)) || 0) +
          toNumber(left?.member_count) * 100;
        const rightScore =
          (salesByProject.get(Number(right?.id)) || 0) +
          (expenseByProject.get(Number(right?.id)) || 0) +
          toNumber(right?.member_count) * 100;
        return rightScore - leftScore;
      })
      .slice(0, 4)
      .map((project) => {
        const projectId = Number(project?.id);
        const spent = expenseByProject.get(projectId) || 0;
        const revenue = salesByProject.get(projectId) || 0;
        const budget = Math.max(0, toNumber(project?.budget_total));
        const expectedRevenue = Math.max(0, toNumber(project?.expected_revenue));
        const budgetUsePercent = budget > 0 ? clampPercent((spent / budget) * 100) : 0;
        const revenuePercent = expectedRevenue > 0 ? clampPercent((revenue / expectedRevenue) * 100) : 0;
        return {
          id: projectId,
          name: project?.name || "Untitled project",
          description: summarizeText(project?.short_description || project?.description, 108),
          statusLabel: formatLabel(normalizeProjectStatus(project?.status), "Active"),
          statusTone: getProjectStatusTone(project?.status),
          members: toNumber(project?.member_count),
          startDate: formatDate(project?.start_date, { month: "short", day: "numeric", year: "numeric" }),
          spent,
          revenue,
          net: revenue - spent,
          budgetUsePercent,
          revenuePercent,
          budget,
          expectedRevenue,
        };
      });
  }, [projects, expenseByProject, salesByProject]);

  const topRevenueProject = useMemo(() => {
    if (!projectCards.length) return null;
    return [...projectCards]
      .sort((left, right) => right.revenue - left.revenue)[0];
  }, [projectCards]);

  const analyticsSeries = useMemo(() => {
    const frames = buildMonthFrames().map((frame) => ({
      ...frame,
      income: 0,
      expense: 0,
      movement: 0,
    }));
    const seriesByKey = new Map(frames.map((frame) => [frame.key, frame]));

    sales.forEach((sale) => {
      const bucket = seriesByKey.get(getMonthKey(sale?.sale_date || sale?.created_at));
      if (!bucket) return;
      bucket.income += getSaleTotal(sale);
      bucket.movement += 1;
    });

    expenses.forEach((expense) => {
      const bucket = seriesByKey.get(getMonthKey(expense?.expense_date || expense?.created_at));
      if (!bucket) return;
      bucket.expense += toNumber(expense?.amount);
      bucket.movement += 1;
    });

    meetings.forEach((meeting) => {
      const bucket = seriesByKey.get(getMonthKey(meeting?.date || meeting?.meeting_date));
      if (!bucket) return;
      bucket.movement += 1;
    });

    invites.forEach((invite) => {
      const bucket = seriesByKey.get(getMonthKey(invite?.created_at));
      if (!bucket) return;
      bucket.movement += 1;
    });

    return frames.map((frame) => ({
      ...frame,
      net: frame.income - frame.expense,
    }));
  }, [expenses, invites, meetings, sales]);

  const cashflowChartMax = useMemo(
    () => Math.max(1, ...analyticsSeries.map((bucket) => Math.max(bucket.income, bucket.expense))),
    [analyticsSeries]
  );

  const incomeTrendChart = useMemo(
    () => buildLineChart(analyticsSeries.map((bucket) => bucket.income), 360, 188, cashflowChartMax),
    [analyticsSeries, cashflowChartMax]
  );

  const expenseTrendChart = useMemo(
    () => buildLineChart(analyticsSeries.map((bucket) => bucket.expense), 360, 188, cashflowChartMax),
    [analyticsSeries, cashflowChartMax]
  );

  const movementChart = useMemo(
    () => buildLineChart(analyticsSeries.map((bucket) => bucket.movement)),
    [analyticsSeries]
  );

  const currentAnalyticsMonth = analyticsSeries[analyticsSeries.length - 1] || null;
  const previousAnalyticsMonth = analyticsSeries[analyticsSeries.length - 2] || null;

  const budgetDistribution = useMemo(
    () =>
      [...projects]
        .map((project) => Math.max(0, toNumber(project?.budget_total)))
        .filter((value) => value > 0)
        .sort((left, right) => right - left)
        .slice(0, 6),
    [projects]
  );

  const assignedProjectCount = useMemo(
    () =>
      new Set(
        assignmentsInScope
          .map((assignment) => Number(assignment?.project_id))
          .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
      ).size,
    [assignmentsInScope]
  );

  const memberCoveragePercent = memberStats.total > 0
    ? clampPercent((assignedMemberIds.size / memberStats.total) * 100)
    : 0;
  const memberCoverageDash = (memberCoveragePercent / 100) * OVERVIEW_RING_CIRCUMFERENCE;

  const financeFigureCards = useMemo(() => {
    const topCategory = expenseCategoryRows[0] || null;
    const categorySeries = expenseCategoryRows.length
      ? expenseCategoryRows.map((row) => row.value).slice(0, 6)
      : analyticsSeries.map((bucket) => bucket.expense);

    return [
      {
        label: "Inflow",
        value: formatCurrency(financeStats.income, true),
        meta: formatDeltaLabel(currentAnalyticsMonth?.income, previousAnalyticsMonth?.income),
        tone: "green",
        icon: "trending-up",
        visual: "area",
        series: analyticsSeries.map((bucket) => bucket.income),
      },
      {
        label: "Outflow",
        value: formatCurrency(financeStats.expenses, true),
        meta: formatDeltaLabel(currentAnalyticsMonth?.expense, previousAnalyticsMonth?.expense),
        tone: "rose",
        icon: "receipt",
        visual: "bars",
        series: analyticsSeries.map((bucket) => bucket.expense),
      },
      {
        label: "Budget pool",
        value: projectStats.budgetTotal > 0 ? formatCurrency(projectStats.budgetTotal, true) : "No plan",
        meta:
          projectStats.budgetTotal > 0
            ? `${formatPercent(financeStats.budgetUsePercent)} utilised`
            : "Set project budgets",
        tone: "blue",
        icon: "briefcase",
        visual: "capsules",
        series: budgetDistribution.length ? budgetDistribution : analyticsSeries.map((bucket) => bucket.expense),
        percent: financeStats.budgetUsePercent,
      },
      {
        label: "Top category",
        value: topCategory ? formatCurrency(topCategory.value, true) : "No spend",
        meta: topCategory ? topCategory.label : "Awaiting expense data",
        tone: "amber",
        icon: "tag",
        visual: "donut",
        series: categorySeries,
        percent: topCategory?.percent || 0,
      },
    ];
  }, [
    analyticsSeries,
    budgetDistribution,
    currentAnalyticsMonth?.expense,
    currentAnalyticsMonth?.income,
    expenseCategoryRows,
    financeStats.budgetUsePercent,
    financeStats.expenses,
    financeStats.income,
    previousAnalyticsMonth?.expense,
    previousAnalyticsMonth?.income,
    projectStats.budgetTotal,
  ]);

  const distributionRows = expenseCategoryRows.length ? expenseCategoryRows : projectStatusRows;
  const hasExpenseDistribution = expenseCategoryRows.length > 0;

  const recentTimeline = useMemo(
    () =>
      buildRecentTimeline({
        meetings,
        expenses,
        sales,
        invites,
        projectNameById,
        canSeeInvites,
        memberNameById,
      }),
    [meetings, expenses, sales, invites, projectNameById, canSeeInvites, memberNameById]
  );

  const pendingInvites = useMemo(
    () =>
      invites.filter((invite) => String(invite?.status || "pending").trim().toLowerCase() === "pending")
        .length,
    [invites]
  );

  const pulseRows = useMemo(() => {
    const memberCoverage = memberStats.total > 0 ? clampPercent((assignedMemberIds.size / memberStats.total) * 100) : 0;
    const projectActivation = projectStats.total > 0 ? clampPercent((projectStats.active / projectStats.total) * 100) : 0;
    const activityCompletion =
      meetingStats.total > 0 ? clampPercent((meetingStats.completed / meetingStats.total) * 100) : 0;
    return [
      {
        label: "Member coverage",
        meta: `${assignedMemberIds.size} of ${memberStats.total} members linked to projects`,
        value: memberCoverage,
      },
      {
        label: "Project activation",
        meta: `${projectStats.active} of ${projectStats.total} projects are active or planning`,
        value: projectActivation,
      },
      {
        label: "Activity completion",
        meta: `${meetingStats.completed} of ${meetingStats.total} activities completed`,
        value: activityCompletion,
      },
    ];
  }, [assignedMemberIds.size, memberStats.total, projectStats.active, projectStats.total, meetingStats.completed, meetingStats.total]);

  const overviewSignals = useMemo(
    () =>
      buildSignals({
        totalProjects: projectStats.total,
        activeProjects: projectStats.active,
        pendingInvites,
        membersWithoutProjects: Math.max(0, memberStats.total - assignedMemberIds.size),
        netPosition: financeStats.net,
        visibleProjects: projectStats.visible,
        totalMeetings: meetingStats.total,
        upcomingMeetings: meetingStats.upcoming,
        topRevenueProject,
        canSeeInvites,
        canViewAllProjects,
      }),
    [
      assignedMemberIds.size,
      canSeeInvites,
      canViewAllProjects,
      financeStats.net,
      meetingStats.total,
      meetingStats.upcoming,
      memberStats.total,
      pendingInvites,
      projectStats.active,
      projectStats.total,
      projectStats.visible,
      topRevenueProject,
    ]
  );

  const kpiCards = useMemo(() => {
    const cards = [
      {
        label: "Active members",
        value: memberStats.active.toLocaleString("en-KE"),
        meta: `${memberStats.total.toLocaleString("en-KE")} in organization`,
        icon: "users",
        tone: "green",
      },
      {
        label: "Projects in view",
        value: projectStats.total.toLocaleString("en-KE"),
        meta: `${projectStats.active.toLocaleString("en-KE")} active or planning`,
        icon: "briefcase",
        tone: "blue",
      },
      {
        label: canLoadFinance ? "Net position" : "Visible projects",
        value: canLoadFinance
          ? formatCurrency(financeStats.net, true)
          : projectStats.visible.toLocaleString("en-KE"),
        meta: canLoadFinance
          ? `${formatCurrency(financeStats.income, true)} in • ${formatCurrency(financeStats.expenses, true)} out`
          : `${projectStats.visible.toLocaleString("en-KE")} public`,
        icon: canLoadFinance ? "wallet" : "globe",
        tone: getCurrencyDirectionTone(financeStats.net),
      },
      {
        label: canLoadActivities ? "Upcoming activities" : "Pending invites",
        value: canLoadActivities
          ? meetingStats.upcoming.toLocaleString("en-KE")
          : pendingInvites.toLocaleString("en-KE"),
        meta: canLoadActivities
          ? `${meetingStats.today.toLocaleString("en-KE")} happening today`
          : canSeeInvites
            ? `${pendingInvites.toLocaleString("en-KE")} waiting acceptance`
            : "Admin only",
        icon: canLoadActivities ? "calendar" : "mail",
        tone: canLoadActivities ? "amber" : "blue",
      },
    ];

    return cards;
  }, [
    memberStats.active,
    memberStats.total,
    projectStats.total,
    projectStats.active,
    projectStats.visible,
    canLoadFinance,
    financeStats.net,
    financeStats.income,
    financeStats.expenses,
    canLoadActivities,
    meetingStats.upcoming,
    meetingStats.today,
    pendingInvites,
    canSeeInvites,
  ]);

  const todayLabel = new Date().toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="overview-home dashboard-mobile-shell">
      <section className="overview-home-hero">
        <div className="overview-home-hero-copy">
          <span className="overview-home-eyebrow">Workspace home</span>
          <h2>{workspaceName}</h2>
          <p>{workspaceTagline}</p>
          <div className="overview-home-chip-row">
            <span className="overview-home-chip">
              <Icon name="shield" size={14} />
              {formatLabel(normalizedRole, "Member")}
            </span>
            <span className="overview-home-chip">
              <Icon name="briefcase" size={14} />
              {canViewAllProjects
                ? `${projectStats.total} workspace projects`
                : `${projectStats.total} assigned projects`}
            </span>
            <span className="overview-home-chip">
              <Icon name={canLoadActivities ? "calendar" : "globe"} size={14} />
              {canLoadActivities ? `${meetingStats.upcoming} upcoming` : `${projectStats.visible} public`}
            </span>
          </div>
        </div>

        <div className="overview-home-hero-aside">
          <div className="overview-home-hero-stat">
            <span>Today</span>
            <strong>{todayLabel}</strong>
          </div>
          <div className="overview-home-hero-stat">
            <span>Scope</span>
            <strong>{canViewAllProjects ? "Full workspace" : "Assigned projects"}</strong>
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="overview-home-banner" role="status">
          <Icon name="alert" size={16} />
          <span>{loadError}</span>
        </div>
      ) : null}

      {loading ? (
        renderLoadingCards()
      ) : (
        <>
          <section className="overview-home-kpis">
            {kpiCards.map((card) => (
              <article
                key={card.label}
                className={`overview-home-kpi-card overview-home-kpi-card--${card.tone}`}
              >
                <div className="overview-home-kpi-icon">
                  <Icon name={card.icon} size={18} />
                </div>
                <div className="overview-home-kpi-copy">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.meta}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="overview-home-analytics">
            {canLoadFinance ? (
              <article className="overview-home-card overview-home-analytics-card overview-home-analytics-card--wide">
                <div className="overview-home-card-head">
                  <div>
                    <span className="overview-home-section-tag">Analytics</span>
                    <h3>Cash overview</h3>
                  </div>
                  <div className={`overview-home-card-chip tone-${getCurrencyDirectionTone(financeStats.net)}`}>
                    {financeStats.net > 0
                      ? "Positive balance"
                      : financeStats.net < 0
                        ? "Recovery needed"
                        : "Balanced"}
                  </div>
                </div>

                <div className="overview-home-analytics-wide">
                  <div className="overview-home-lead-panel">
                    <span className="overview-home-lead-label">Net position</span>
                    <strong>{formatCurrency(financeStats.net)}</strong>
                    <p>
                      {formatCurrency(financeStats.income)} collected against{" "}
                      {formatCurrency(financeStats.expenses)} spent across the visible projects.
                    </p>

                    <div className="overview-home-figure-grid">
                      {financeFigureCards.map((card) => (
                        <article
                          key={card.label}
                          className={`overview-home-figure-card tone-${card.tone}`}
                        >
                          <div className="overview-home-figure-copy">
                            <span>
                              <Icon name={card.icon} size={14} />
                              {card.label}
                            </span>
                            <strong>{card.value}</strong>
                            <small>{card.meta}</small>
                          </div>
                          <FigureVisual
                            variant={card.visual}
                            values={card.series}
                            tone={card.tone}
                            percent={card.percent}
                          />
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="overview-home-chart-panel">
                    <div className="overview-home-chart-head">
                      <div>
                        <span className="overview-home-chart-kicker">Last 6 months</span>
                        <strong>Income vs expenses</strong>
                      </div>
                      <div className="overview-home-chart-legend">
                        <span className="income">Income</span>
                        <span className="expense">Expense</span>
                      </div>
                    </div>

                    <div className="overview-home-area-chart" aria-hidden="true">
                      <svg
                        viewBox={`0 0 ${incomeTrendChart.width} ${incomeTrendChart.height}`}
                        preserveAspectRatio="none"
                      >
                        {[40, 78, 116, 154].map((y) => (
                          <line
                            key={`grid-${y}`}
                            x1="12"
                            x2={incomeTrendChart.width - 12}
                            y1={y}
                            y2={y}
                            className="overview-home-area-grid"
                          />
                        ))}
                        <path d={expenseTrendChart.areaPath} className="overview-home-area-fill overview-home-area-fill--expense" />
                        <path d={incomeTrendChart.areaPath} className="overview-home-area-fill overview-home-area-fill--income" />
                        <path d={expenseTrendChart.linePath} className="overview-home-area-line overview-home-area-line--expense" />
                        <path d={incomeTrendChart.linePath} className="overview-home-area-line overview-home-area-line--income" />
                        {incomeTrendChart.lastPoint ? (
                          <circle
                            cx={incomeTrendChart.lastPoint.x}
                            cy={incomeTrendChart.lastPoint.y}
                            r="4"
                            className="overview-home-area-point overview-home-area-point--income"
                          />
                        ) : null}
                        {expenseTrendChart.lastPoint ? (
                          <circle
                            cx={expenseTrendChart.lastPoint.x}
                            cy={expenseTrendChart.lastPoint.y}
                            r="4"
                            className="overview-home-area-point overview-home-area-point--expense"
                          />
                        ) : null}
                      </svg>
                      <div className="overview-home-area-axis">
                        {analyticsSeries.map((bucket) => (
                          <span key={bucket.key}>{bucket.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            <article className="overview-home-card overview-home-analytics-card">
              <div className="overview-home-card-head">
                <div>
                  <span className="overview-home-section-tag">Coverage</span>
                  <h3>Members linked to projects</h3>
                </div>
                <div className="overview-home-card-chip tone-blue">{formatPercent(memberCoveragePercent)}</div>
              </div>

              <div className="overview-home-ring-layout">
                <div className="overview-home-ring-chart">
                  <svg viewBox="0 0 96 96" className="overview-home-ring-svg" aria-hidden="true">
                    <circle className="overview-home-ring-bg" cx="48" cy="48" r={OVERVIEW_RING_RADIUS} />
                    <circle
                      className="overview-home-ring-fill"
                      cx="48"
                      cy="48"
                      r={OVERVIEW_RING_RADIUS}
                      style={{
                        strokeDasharray: `${memberCoverageDash} ${OVERVIEW_RING_CIRCUMFERENCE}`,
                      }}
                    />
                  </svg>
                  <span className="overview-home-ring-value">{memberCoveragePercent}%</span>
                </div>

                <div className="overview-home-stat-stack">
                  <div className="overview-home-stat-stack-item">
                    <span>Assigned members</span>
                    <strong>{assignedMemberIds.size}</strong>
                  </div>
                  <div className="overview-home-stat-stack-item">
                    <span>Without project</span>
                    <strong>{Math.max(0, memberStats.total - assignedMemberIds.size)}</strong>
                  </div>
                  <div className="overview-home-stat-stack-item">
                    <span>Projects staffed</span>
                    <strong>{assignedProjectCount}</strong>
                  </div>
                  <div className="overview-home-stat-stack-item">
                    <span>Pending invites</span>
                    <strong>{canSeeInvites ? pendingInvites : "Private"}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="overview-home-card overview-home-analytics-card">
              <div className="overview-home-card-head">
                <div>
                  <span className="overview-home-section-tag">Movement</span>
                  <h3>Workspace rhythm</h3>
                </div>
                <div className="overview-home-card-chip tone-neutral">
                  {formatDeltaLabel(currentAnalyticsMonth?.movement, previousAnalyticsMonth?.movement)}
                </div>
              </div>

              <div className="overview-home-line-chart">
                <svg
                  viewBox={`0 0 ${movementChart.width} ${movementChart.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="overviewMovementFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 14 ${movementChart.baseY} L ${movementChart.width - 14} ${movementChart.baseY}`}
                    className="overview-home-line-axis"
                  />
                  <path d={movementChart.areaPath} fill="url(#overviewMovementFill)" />
                  <path d={movementChart.linePath} className="overview-home-line-path" />
                  {movementChart.lastPoint ? (
                    <circle
                      cx={movementChart.lastPoint.x}
                      cy={movementChart.lastPoint.y}
                      r="4.5"
                      className="overview-home-line-point"
                    />
                  ) : null}
                </svg>
                <div className="overview-home-line-axis-labels">
                  {analyticsSeries.map((bucket) => (
                    <span key={bucket.key}>{bucket.label}</span>
                  ))}
                </div>
              </div>

              <div className="overview-home-mini-grid overview-home-mini-grid--analytics">
                <div className="overview-home-mini-card">
                  <span>This month</span>
                  <strong>{currentAnalyticsMonth?.movement || 0}</strong>
                </div>
                <div className="overview-home-mini-card">
                  <span>Today</span>
                  <strong>{meetingStats.today}</strong>
                </div>
                <div className="overview-home-mini-card">
                  <span>6-month total</span>
                  <strong>
                    {analyticsSeries.reduce((sum, bucket) => sum + bucket.movement, 0)}
                  </strong>
                </div>
              </div>
            </article>

            <article className="overview-home-card overview-home-analytics-card overview-home-analytics-card--distribution">
              <div className="overview-home-card-head">
                <div>
                  <span className="overview-home-section-tag">
                    {hasExpenseDistribution ? "Categories" : "Project mix"}
                  </span>
                  <h3>{hasExpenseDistribution ? "Spend by category" : "Project status mix"}</h3>
                </div>
                <div className="overview-home-card-chip tone-blue">
                  {hasExpenseDistribution
                    ? formatCurrency(financeStats.expenses, true)
                    : `${projectStats.total} projects`}
                </div>
              </div>

              {distributionRows.length ? (
                <div className="overview-home-distribution-list">
                  {distributionRows.map((row) => (
                    <div key={row.label} className="overview-home-distribution-item">
                      <div className="overview-home-distribution-head">
                        <span>{row.label}</span>
                        <strong>
                          {hasExpenseDistribution
                            ? formatCurrency(row.value, true)
                            : `${row.value} ${row.value === 1 ? "project" : "projects"}`}
                        </strong>
                      </div>
                      <div className="overview-home-distribution-track">
                        <span
                          style={{
                            width: `${row.percent}%`,
                            background: hasExpenseDistribution
                              ? `linear-gradient(90deg, ${row.color}, #93c5fd)`
                              : undefined,
                          }}
                          className={!hasExpenseDistribution ? `tone-${row.tone}` : ""}
                        />
                      </div>
                      <small>
                        {hasExpenseDistribution
                          ? `${row.percent}% of recorded expenses • ${row.count} entries`
                          : `${row.percent}% of visible projects`}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overview-home-empty">
                  <Icon name="tag" size={18} />
                  <span>No category totals are available yet.</span>
                </div>
              )}
            </article>
          </section>

          <section className="overview-home-columns">
            <div className="overview-home-column">
              <article className="overview-home-card">
                <div className="overview-home-card-head">
                  <div>
                    <span className="overview-home-section-tag">Organization</span>
                    <h3>Workspace pulse</h3>
                  </div>
                  <div className="overview-home-card-chip">
                    {memberStats.active}/{memberStats.total || 0} active
                  </div>
                </div>

                <div className="overview-home-pulse-list">
                  {pulseRows.map((row) => (
                    <div key={row.label} className="overview-home-pulse-item">
                      <div className="overview-home-pulse-copy">
                        <strong>{row.label}</strong>
                        <span>{row.meta}</span>
                      </div>
                      <div className="overview-home-pulse-meter">
                        <span style={{ width: `${row.value}%` }} />
                      </div>
                      <small>{formatPercent(row.value)}</small>
                    </div>
                  ))}
                </div>

                <div className="overview-home-mini-grid">
                  <div className="overview-home-mini-card">
                    <span>Without project</span>
                    <strong>{Math.max(0, memberStats.total - assignedMemberIds.size)}</strong>
                  </div>
                  <div className="overview-home-mini-card">
                    <span>Pending invites</span>
                    <strong>{canSeeInvites ? pendingInvites : "Private"}</strong>
                  </div>
                  <div className="overview-home-mini-card">
                    <span>Public projects</span>
                    <strong>{projectStats.visible}</strong>
                  </div>
                </div>
              </article>

              <article className="overview-home-card">
                <div className="overview-home-card-head">
                  <div>
                    <span className="overview-home-section-tag">Projects</span>
                    <h3>Project watch</h3>
                  </div>
                  <div className="overview-home-card-chip">{projectCards.length} shown</div>
                </div>

                {projectCards.length ? (
                  <div className="overview-home-project-list">
                    {projectCards.map((project) => (
                      <article key={project.id} className="overview-home-project-card">
                        <div className="overview-home-project-top">
                          <div>
                            <h4>{project.name}</h4>
                            {project.description ? <p>{project.description}</p> : null}
                          </div>
                          <span className={`overview-home-status-pill tone-${project.statusTone}`}>
                            {project.statusLabel}
                          </span>
                        </div>

                        <div className="overview-home-project-meta">
                          <span>
                            <Icon name="calendar" size={14} />
                            {project.startDate}
                          </span>
                          <span>
                            <Icon name="users" size={14} />
                            {project.members} members
                          </span>
                          <span className={`tone-${getCurrencyDirectionTone(project.net)}`}>
                            <Icon name="wallet" size={14} />
                            {formatCurrency(project.net, true)}
                          </span>
                        </div>

                        <div className="overview-home-project-visual-grid">
                          <div className="overview-home-project-visual">
                            <MiniDonut
                              value={project.budgetUsePercent}
                              tone={project.budgetUsePercent >= 80 ? "rose" : "blue"}
                            />
                            <div className="overview-home-project-visual-copy">
                              <span>Budget used</span>
                              <strong>{formatCurrency(project.spent)}</strong>
                              <small>
                                {project.budget > 0
                                  ? `${project.budgetUsePercent}% of ${formatCurrency(project.budget)} budget`
                                  : "No budget target set"}
                              </small>
                            </div>
                          </div>

                          <div className="overview-home-project-visual">
                            <MiniDonut value={project.revenuePercent} tone="green" />
                            <div className="overview-home-project-visual-copy">
                              <span>Income progress</span>
                              <strong>{formatCurrency(project.revenue)}</strong>
                              <small>
                                {project.expectedRevenue > 0
                                  ? `${project.revenuePercent}% of ${formatCurrency(project.expectedRevenue)} target`
                                  : "No income target set"}
                              </small>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="overview-home-empty">
                    <Icon name="briefcase" size={18} />
                    <span>No projects are available in this view yet.</span>
                  </div>
                )}
              </article>
            </div>

            <div className="overview-home-column">
              <article className="overview-home-card">
                <div className="overview-home-card-head">
                  <div>
                    <span className="overview-home-section-tag">Timeline</span>
                    <h3>Recent movement</h3>
                  </div>
                  <div className="overview-home-card-chip">{recentTimeline.length} updates</div>
                </div>

                {recentTimeline.length ? (
                  <div className="overview-home-activity-feed">
                    {recentTimeline.map((item) => (
                      <article key={item.id} className={`overview-home-activity-item tone-${item.tone}`}>
                        <div className={`overview-home-activity-avatar tone-${item.tone}`}>
                          <span>{item.initials}</span>
                          <div className="overview-home-activity-avatar-icon">
                            <Icon name={item.icon} size={12} />
                          </div>
                        </div>
                        <div className="overview-home-activity-body">
                          <div className="overview-home-activity-head">
                            <strong>{item.actor}</strong>
                            <small>{item.timestampLabel}</small>
                          </div>
                          <p>{item.action}</p>
                          <div className={`overview-home-activity-note tone-${item.tone}`}>
                            <span>{item.detail}</span>
                            <em>{item.dateLabel}</em>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="overview-home-empty">
                    <Icon name="clock" size={18} />
                    <span>No recent updates yet.</span>
                  </div>
                )}
              </article>

              <article className="overview-home-card">
                <div className="overview-home-card-head">
                  <div>
                    <span className="overview-home-section-tag">Signals</span>
                    <h3>What needs attention</h3>
                  </div>
                </div>

                {overviewSignals.length ? (
                  <div className="overview-home-signal-list">
                    {overviewSignals.map((signal) => (
                      <div key={signal.title} className="overview-home-signal-item">
                        <div className={`overview-home-timeline-icon tone-${signal.tone}`}>
                          <Icon name={signal.icon} size={16} />
                        </div>
                        <div className="overview-home-signal-copy">
                          <strong>{signal.title}</strong>
                          <p>{signal.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overview-home-empty">
                    <Icon name="check" size={18} />
                    <span>No major risk signals in the current view.</span>
                  </div>
                )}
              </article>
            </div>
          </section>
        </>
      )}

      <DashboardMobileNav activePage="overview" access={access} setActivePage={setActivePage} />
    </div>
  );
}
