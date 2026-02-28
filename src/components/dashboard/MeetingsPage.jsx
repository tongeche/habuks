import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMeetings,
  createOrganizationActivity,
  updateOrganizationActivity,
  getMeetingParticipants,
  updateMeetingParticipants,
  respondMeetingInvitation,
  finalizeMeetingAttendance,
  getMembersAdmin,
  getWelfareSummary,
  getEventSubscribers,
  createEventSubscriber,
  getOrganizationActivityOptionValues,
  getTenantById,
  updateTenant,
  uploadOrganizationActivityPoster,
  uploadOrganizationDocument,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";
import { buildMeetingMinutesReportFile } from "../../lib/reporting/meetingMinutesReport.js";
import { buildTenantBrand } from "../../lib/tenantBranding.js";
import {
  MEETING_AGENDA_PRESET_OPTIONS,
  buildAgendaItemFromPreset,
  buildMinutesDraftFromAgenda,
  createMinutesData,
  getOrganizationLeadershipRoles,
  mergeMinutesDraft,
} from "../../lib/meetingMinutes.js";
import {
  enhanceMeetingMinutesDraftWithAi,
  isMeetingMinutesAiConfigured,
} from "../../lib/meetingMinutesAi.js";

const ACTIVITY_STATUS_META = {
  today: { label: "Today", tone: "today" },
  in_progress: { label: "In Progress", tone: "in-progress" },
  upcoming: { label: "Upcoming", tone: "upcoming" },
  overdue: { label: "Overdue", tone: "overdue" },
  completed: { label: "Completed", tone: "completed" },
  cancelled: { label: "Cancelled", tone: "cancelled" },
};

const ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "in_progress", label: "In progress" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
];

const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FALLBACK_ACTIVITY_OPTION_VALUES = {
  categories: [
    { value: "General", label: "General" },
    { value: "Meeting", label: "Meeting" },
    { value: "Sales", label: "Sales" },
    { value: "Expenses", label: "Expenses" },
    { value: "Welfare", label: "Welfare" },
    { value: "Report", label: "Report" },
  ],
  valueTypes: [
    { value: "Income", label: "Income" },
    { value: "Expense", label: "Expense" },
    { value: "Contribution", label: "Contribution" },
  ],
  budgetLines: [
    { value: "Operations", label: "Operations" },
    { value: "Welfare", label: "Welfare" },
    { value: "Projects", label: "Projects" },
    { value: "Administration", label: "Administration" },
  ],
};

const CREATE_SOURCE_PARTNER_OPTION = "__create_source_partner__";

const ACTIVITY_VISUALS = [
  { match: /(transport|delivery|travel|logistics)/i, icon: "truck", tone: "transport" },
  { match: /(expense|payment|receipt|supply|purchase)/i, icon: "receipt", tone: "expense" },
  { match: /(report|audit|analysis)/i, icon: "notes", tone: "report" },
  { match: /(welfare|support|care)/i, icon: "heart", tone: "welfare" },
  { match: /(sales|income|revenue)/i, icon: "wallet", tone: "sales" },
  { match: /(team|meeting|member|sync)/i, icon: "users", tone: "team" },
];

const MEETING_TYPE_VALUE = "Meeting";

const isMeetingType = (value) => String(value || "").trim().toLowerCase() === "meeting";

const toText = (value) => String(value || "").trim();

const createAgendaItem = (item = {}) => ({
  title: toText(item?.title),
  details: toText(item?.details || item?.discussion),
  resolutions: Array.isArray(item?.resolutions)
    ? item.resolutions.map((entry) => toText(entry))
    : [toText(item?.resolution)].filter(Boolean),
});

const hasAgendaItemContent = (item) =>
  Boolean(
    toText(item?.title) ||
      toText(item?.details) ||
      (Array.isArray(item?.resolutions) && item.resolutions.some((entry) => toText(entry)))
  );

const mergeAgendaItemDrafts = (currentItems = [], draftItems = [], { overwrite = false } = {}) => {
  const normalizedCurrent = Array.isArray(currentItems)
    ? currentItems.map((item) => createAgendaItem(item))
    : [];
  const normalizedDraft = Array.isArray(draftItems)
    ? draftItems.map((item) => createAgendaItem(item)).filter(hasAgendaItemContent)
    : [];

  if (!normalizedDraft.length) {
    return normalizedCurrent.length ? normalizedCurrent : [createAgendaItem()];
  }

  const normalizedCurrentWithoutPlaceholder = normalizedCurrent.filter(hasAgendaItemContent);
  const sourceCurrent = normalizedCurrentWithoutPlaceholder.length ? normalizedCurrentWithoutPlaceholder : [];
  const merged = Array.from({ length: Math.max(sourceCurrent.length, normalizedDraft.length) }, (_, index) => {
    const currentItem = sourceCurrent[index] || createAgendaItem();
    const draftItem = normalizedDraft[index] || createAgendaItem();
    const currentResolutions = Array.isArray(currentItem.resolutions)
      ? currentItem.resolutions.map((entry) => toText(entry)).filter(Boolean)
      : [];
    const draftResolutions = Array.isArray(draftItem.resolutions)
      ? draftItem.resolutions.map((entry) => toText(entry)).filter(Boolean)
      : [];

    return {
      title: overwrite
        ? toText(draftItem.title) || toText(currentItem.title)
        : toText(currentItem.title) || toText(draftItem.title),
      details: overwrite
        ? toText(draftItem.details) || toText(currentItem.details)
        : toText(currentItem.details) || toText(draftItem.details),
      resolutions: overwrite
        ? draftResolutions.length
          ? draftResolutions
          : currentResolutions
        : currentResolutions.length
          ? currentResolutions
          : draftResolutions,
    };
  }).filter(hasAgendaItemContent);

  return merged.length ? merged : [createAgendaItem()];
};

const mergeMeetingDraftIntoForm = (currentValue = {}, draftValue = {}, { overwrite = false } = {}) => ({
  ...currentValue,
  agenda_items: mergeAgendaItemDrafts(currentValue.agenda_items, draftValue?.agenda_items, {
    overwrite,
  }),
  minutes_data: mergeMinutesDraft(
    currentValue.minutes_data,
    draftValue?.minutes_data || draftValue?.minutesData || draftValue,
    { overwrite }
  ),
});

const createParticipantDraft = (row = {}) => ({
  id: row?.id || null,
  token: row?.token || "",
  participant_type: String(row?.participant_type || "member").trim().toLowerCase(),
  member_id: row?.member_id ?? null,
  subscriber_id: row?.subscriber_id ?? null,
  name:
    String(row?.member?.name || row?.subscriber?.name || row?.name || "").trim() || "Participant",
  role: String(row?.member?.role || "").trim(),
  email: String(row?.member?.email || row?.subscriber?.email || "").trim(),
  rsvp_status: String(row?.rsvp_status || "pending").trim().toLowerCase(),
  attendance_status: String(row?.attendance_status || "unknown").trim().toLowerCase(),
  notes: String(row?.notes || "").trim(),
});

const summarizeMeetingParticipants = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  return {
    invited: safeRows.length,
    confirmed: safeRows.filter((row) => row?.rsvp_status === "confirmed").length,
    apology: safeRows.filter((row) => row?.rsvp_status === "apology").length,
    attended: safeRows.filter((row) => row?.attendance_status === "attended").length,
    absent: safeRows.filter((row) => row?.attendance_status === "absent").length,
  };
};

const normalizeArrayField = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    return trimmed
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeActivityStatus = (status, dateValue) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized === "completed" || normalized === "done") return "completed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "in_progress" || normalized === "ongoing" || normalized === "active") return "in_progress";
  if (normalized === "today") return "today";
  if (normalized === "upcoming" || normalized === "scheduled" || normalized === "planned") return "upcoming";

  const parsed = Date.parse(String(dateValue || ""));
  if (!Number.isFinite(parsed)) return "upcoming";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return "today";
  if (target.getTime() < today.getTime()) return "overdue";
  return "upcoming";
};

const formatStatusLabel = (statusKey) => {
  return (
    ACTIVITY_STATUS_META[statusKey]?.label ||
    String(statusKey || "Unknown")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
};

const toFormStatusValue = (statusValue, statusKey) => {
  const normalized = String(statusValue || "")
    .trim()
    .toLowerCase();
  if (normalized === "scheduled" || normalized === "in_progress" || normalized === "completed" || normalized === "cancelled") {
    return normalized;
  }
  if (statusKey === "in_progress") return "in_progress";
  if (statusKey === "completed") return "completed";
  if (statusKey === "cancelled") return "cancelled";
  return "scheduled";
};

const toIsoDateKey = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, 10);
};

const getActivityIdentity = (item) => {
  const id = item?.id;
  if (id !== undefined && id !== null && id !== "") return String(id);
  return `${String(item?.title || "activity")}::${toIsoDateKey(item?.date) || "undated"}`;
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseSubscriberId = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const normalizeMemberIdArray = (value) => {
  return Array.from(
    new Set(
      normalizeArrayField(value)
        .map((item) => parsePositiveInt(item))
        .filter(Boolean)
    )
  );
};

const normalizeAttendeeTokens = (value) => {
  const normalized = [];
  const seen = new Set();
  normalizeArrayField(value).forEach((item) => {
    let type = "member";
    let id = null;

    if (item && typeof item === "object" && !Array.isArray(item)) {
      type = String(item.type || item.attendee_type || "member")
        .trim()
        .toLowerCase();
      id =
        type === "subscriber"
          ? parseSubscriberId(item.id || item.subscriber_id)
          : parsePositiveInt(item.id || item.member_id);
    } else {
      const text = String(item || "");
      if (text.includes(":")) {
        const [rawType, rawId] = text.split(":");
        type = String(rawType || "member")
          .trim()
          .toLowerCase();
        id = type === "subscriber" ? parseSubscriberId(rawId) : parsePositiveInt(rawId);
      } else {
        id = parsePositiveInt(text);
      }
    }

    if (!id) return;
    if (type !== "member" && type !== "subscriber") return;
    const token = `${type}:${id}`;
    if (seen.has(token)) return;
    seen.add(token);
    normalized.push(token);
  });
  return normalized;
};

const getActivityMemberIds = (activity) => {
  const assigneeIds = normalizeMemberIdArray(activity?.assignees);
  const attendeeIds = normalizeArrayField(activity?.attendees)
    .map((value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const type = String(value.type || value.attendee_type || "member")
          .trim()
          .toLowerCase();
        if (type !== "member") return null;
        return parsePositiveInt(value.id || value.member_id);
      }
      const text = String(value || "");
      if (text.includes(":")) {
        const [kind, rawId] = text.split(":");
        if (kind !== "member") return null;
        return parsePositiveInt(rawId);
      }
      return parsePositiveInt(text);
    })
    .filter(Boolean);
  return Array.from(new Set([...assigneeIds, ...attendeeIds]));
};

const getActivityVisual = (category) => {
  const text = String(category || "");
  const found = ACTIVITY_VISUALS.find((entry) => entry.match.test(text));
  return found || { icon: "calendar", tone: "general" };
};

const toInitials = (label) => {
  const parts = String(label || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
};

const normalizeOptionalText = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const toFilenameSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "meeting";

const asPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const normalizePartnerNameKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getOrganizationProfile = (siteData) => {
  const safeSiteData = asPlainObject(siteData);
  return asPlainObject(safeSiteData.organization_profile);
};

const getOrganizationPartners = (siteData) => {
  const profile = getOrganizationProfile(siteData);
  const source = Array.isArray(profile.partners) ? profile.partners : [];
  return source
    .map((partner, index) => {
      const row = asPlainObject(partner);
      const fallbackId = `partner-${index + 1}`;
      return {
        id: String(row.id || fallbackId),
        name: String(row.name || "").trim(),
        kind: String(row.kind || "Partner").trim() || "Partner",
        status: String(row.status || "Active").trim() || "Active",
        contact_person: String(row.contact_person || "").trim(),
        contact_email: String(row.contact_email || "").trim(),
        contact_phone: String(row.contact_phone || "").trim(),
        last_contact: String(row.last_contact || "").trim(),
        logo_url: String(row.logo_url || row.logo || "").trim(),
        linked_project_ids: Array.isArray(row.linked_project_ids)
          ? row.linked_project_ids.map((projectId) => String(projectId || "").trim()).filter(Boolean)
          : [],
        notes: String(row.notes || "").trim(),
      };
    })
    .filter((partner) => partner.name);
};

const buildSiteDataWithPartners = (siteData, partners) => {
  const safeSiteData = asPlainObject(siteData);
  const profile = getOrganizationProfile(safeSiteData);
  return {
    ...safeSiteData,
    organization_profile: {
      ...profile,
      partners,
    },
  };
};

const buildActivityItemFromMeeting = (meeting = {}, participantRows = []) => {
  const dateValue = meeting?.date || meeting?.meeting_date || meeting?.created_at || "";
  const statusKey = normalizeActivityStatus(meeting?.status, dateValue);
  const normalizedAttendees = normalizeAttendeeTokens(meeting?.attendees_data ?? meeting?.attendees);
  const rawAssignees = normalizeMemberIdArray(
    normalizeArrayField(meeting?.assignees).length ? meeting?.assignees : meeting?.attendees
  );
  const ownerMemberId = parsePositiveInt(meeting?.owner_member_id);
  const normalizedAssignees =
    ownerMemberId && !rawAssignees.includes(ownerMemberId)
      ? [ownerMemberId, ...rawAssignees]
      : rawAssignees;
  const normalizedParticipants = (Array.isArray(participantRows) ? participantRows : []).map((row) =>
    createParticipantDraft(row)
  );
  const summary = summarizeMeetingParticipants(normalizedParticipants);

  return {
    id: meeting?.id,
    title: meeting?.title || meeting?.agenda || meeting?.type || "Untitled activity",
    category: meeting?.type || meeting?.category || "General",
    date: dateValue,
    description: meeting?.description || "",
    location: meeting?.location || "",
    status: meeting?.status || statusKey,
    valueType: meeting?.value_type || meeting?.valueType || "",
    value_type: meeting?.value_type || meeting?.valueType || "",
    budgetLine: meeting?.budget_line || meeting?.budgetLine || "",
    budget_line: meeting?.budget_line || meeting?.budgetLine || "",
    sourcePartnerId: String(meeting?.source_partner_id || meeting?.sourcePartnerId || "").trim(),
    source_partner_id: String(meeting?.source_partner_id || meeting?.sourcePartnerId || "").trim(),
    sourcePartnerName: String(meeting?.source_partner_name || meeting?.sourcePartnerName || "").trim(),
    source_partner_name: String(meeting?.source_partner_name || meeting?.sourcePartnerName || "").trim(),
    posterUrl: String(meeting?.poster_url || meeting?.posterUrl || "").trim(),
    poster_url: String(meeting?.poster_url || meeting?.posterUrl || "").trim(),
    posterPath: String(meeting?.poster_path || meeting?.posterPath || "").trim(),
    poster_path: String(meeting?.poster_path || meeting?.posterPath || "").trim(),
    statusKey,
    statusLabel: formatStatusLabel(statusKey),
    statusTone: ACTIVITY_STATUS_META[statusKey]?.tone || "upcoming",
    assignees: normalizedAssignees,
    attendees: normalizedAttendees,
    agenda: String(meeting?.agenda || meeting?.title || "").trim(),
    audienceScope: String(meeting?.audience_scope || meeting?.audienceScope || "selected_members").trim(),
    audience_scope: String(meeting?.audience_scope || meeting?.audienceScope || "selected_members").trim(),
    agenda_items: Array.isArray(meeting?.agenda_items || meeting?.agendaItems)
      ? (meeting?.agenda_items || meeting?.agendaItems).map((item) => createAgendaItem(item))
      : [],
    chairperson_member_id: String(
      meeting?.chairperson_member_id || meeting?.chairpersonMemberId || ""
    ).trim(),
    secretary_member_id: String(
      meeting?.secretary_member_id || meeting?.secretaryMemberId || ""
    ).trim(),
    minutes_status: String(meeting?.minutes_status || meeting?.minutesStatus || "draft").trim(),
    minutes_generated_at: String(
      meeting?.minutes_generated_at || meeting?.minutesGeneratedAt || ""
    ).trim(),
    minutes_data: createMinutesData(meeting?.minutes_data || meeting?.minutesData),
    startAt: String(meeting?.start_at || meeting?.startAt || "").trim(),
    start_at: String(meeting?.start_at || meeting?.startAt || "").trim(),
    meetingParticipants: normalizedParticipants,
    invitedCount: summary.invited || normalizedAttendees.length,
    confirmedCount: summary.confirmed,
    apologyCount: summary.apology,
    attendedCount: summary.attended,
    absentCount: summary.absent,
  };
};

const createSourcePartnerForm = () => ({
  name: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  notes: "",
  status: "Active",
});

const createActivityForm = (defaults = {}) => ({
  title: String(defaults?.title || "").trim(),
  type: String(defaults?.type || defaults?.category || "General").trim() || "General",
  date:
    String(defaults?.date || "").trim() || new Date().toISOString().split("T")[0],
  description: String(defaults?.description || "").trim(),
  status: String(defaults?.status || "scheduled").trim() || "scheduled",
  value_type: String(defaults?.value_type || "Income").trim() || "Income",
  budget_line: String(defaults?.budget_line || "Operations").trim() || "Operations",
  source_partner_id: String(defaults?.source_partner_id || "").trim(),
  source_partner_name: String(defaults?.source_partner_name || "").trim(),
  poster_url: String(defaults?.poster_url || "").trim(),
  poster_path: String(defaults?.poster_path || "").trim(),
  location: String(defaults?.location || "").trim(),
  agenda: String(defaults?.agenda || defaults?.title || "").trim(),
  assignees: Array.isArray(defaults?.assignees) ? defaults.assignees : [],
  attendees: Array.isArray(defaults?.attendees) ? defaults.attendees : [],
  audience_scope: String(defaults?.audience_scope || "selected_members").trim() || "selected_members",
  agenda_items:
    Array.isArray(defaults?.agenda_items) && defaults.agenda_items.length
      ? defaults.agenda_items.map((item) => createAgendaItem(item))
      : [createAgendaItem()],
  chairperson_member_id: String(defaults?.chairperson_member_id || "").trim(),
  secretary_member_id: String(defaults?.secretary_member_id || "").trim(),
  minutes_status: String(defaults?.minutes_status || "draft").trim() || "draft",
  minutes_data: createMinutesData(defaults?.minutes_data),
  meeting_participants:
    Array.isArray(defaults?.meeting_participants)
      ? defaults.meeting_participants.map((row) => createParticipantDraft(row))
      : [],
});

export default function MeetingsPage({ user, tenantId, access, setActivePage }) {
  const { formatCurrency, formatFieldLabel } = useTenantCurrency();
  const [meetings, setMeetings] = useState([]);
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [members, setMembers] = useState([]);
  const [welfareSummary, setWelfareSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activityTab, setActivityTab] = useState("details");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => createActivityForm());
  const [activityOptionValues, setActivityOptionValues] = useState(FALLBACK_ACTIVITY_OPTION_VALUES);
  const [organizationPartners, setOrganizationPartners] = useState([]);
  const [tenantSiteData, setTenantSiteData] = useState({});
  const [tenantRecord, setTenantRecord] = useState(null);
  const [showSourcePartnerModal, setShowSourcePartnerModal] = useState(false);
  const [sourcePartnerForm, setSourcePartnerForm] = useState(() => createSourcePartnerForm());
  const [sourcePartnerError, setSourcePartnerError] = useState("");
  const [savingSourcePartner, setSavingSourcePartner] = useState(false);
  const [activityPosterFile, setActivityPosterFile] = useState(null);
  const [activityPosterPreview, setActivityPosterPreview] = useState("");
  const [posterUploadError, setPosterUploadError] = useState("");
  const posterObjectUrlRef = useRef("");
  const [eventSubscribers, setEventSubscribers] = useState([]);
  const [showNewSubscriberForm, setShowNewSubscriberForm] = useState(false);
  const [newSubscriber, setNewSubscriber] = useState({ name: "", email: "", contact: "" });
  const [selectedAgendaPresetKey, setSelectedAgendaPresetKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [updatingParticipants, setUpdatingParticipants] = useState(false);
  const [emittingMinutes, setEmittingMinutes] = useState(false);
  const [useAiMinutesBackup, setUseAiMinutesBackup] = useState(false);
  const [draftingWithAi, setDraftingWithAi] = useState(false);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [calendarPreviewActivityId, setCalendarPreviewActivityId] = useState("");
  const meetingsCacheKey = useMemo(
    () => `habuks.activities.meetings.${tenantId || "global"}`,
    [tenantId]
  );
  const formatMoney = (value) => formatCurrency(Number(value) || 0, { maximumFractionDigits: 0 });
  const categoryOptions = useMemo(() => {
    const source = Array.isArray(activityOptionValues.categories)
      ? activityOptionValues.categories
      : FALLBACK_ACTIVITY_OPTION_VALUES.categories;
    const map = new Map();
    source.forEach((option) => {
      const value = String(option?.value || "").trim();
      if (!value) return;
      map.set(value.toLowerCase(), {
        value,
        label: String(option?.label || value).trim() || value,
      });
    });
    if (!map.has(MEETING_TYPE_VALUE.toLowerCase())) {
      map.set(MEETING_TYPE_VALUE.toLowerCase(), {
        value: MEETING_TYPE_VALUE,
        label: MEETING_TYPE_VALUE,
      });
    }
    return Array.from(map.values());
  }, [activityOptionValues.categories]);
  const defaultCategoryValue =
    categoryOptions[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.categories[0].value;
  const defaultValueType =
    activityOptionValues.valueTypes?.[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.valueTypes[0].value;
  const defaultBudgetLine =
    activityOptionValues.budgetLines?.[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.budgetLines[0].value;
  const currentMemberId = parsePositiveInt(user?.id);
  const currentUserRole = String(user?.role || "").trim().toLowerCase();
  const canManageMeetings =
    currentUserRole === "admin" ||
    currentUserRole === "superadmin" ||
    currentUserRole === "project_manager";
  const sourcePartnerById = useMemo(() => {
    const map = new Map();
    (organizationPartners || []).forEach((partner) => {
      const id = String(partner?.id || "").trim();
      if (!id) return;
      map.set(id, partner);
    });
    return map;
  }, [organizationPartners]);
  const sourcePartnerByName = useMemo(() => {
    const map = new Map();
    (organizationPartners || []).forEach((partner) => {
      const name = String(partner?.name || "").trim();
      if (!name) return;
      map.set(normalizePartnerNameKey(name), partner);
    });
    return map;
  }, [organizationPartners]);
  const sourcePartnerOptions = useMemo(
    () => [...(organizationPartners || [])].sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""))),
    [organizationPartners]
  );
  const memberById = useMemo(() => {
    const map = new Map();
    (members || []).forEach((member) => {
      const memberId = parsePositiveInt(member?.id);
      if (!memberId) return;
      map.set(String(memberId), member);
    });
    return map;
  }, [members]);
  const subscriberById = useMemo(() => {
    const map = new Map();
    (eventSubscribers || []).forEach((subscriber) => {
      const subscriberId = parseSubscriberId(subscriber?.id);
      if (!subscriberId) return;
      map.set(String(subscriberId), subscriber);
    });
    return map;
  }, [eventSubscribers]);
  const participantRowsByMeetingId = useMemo(() => {
    const map = new Map();
    (meetingParticipants || []).forEach((row) => {
      const meetingId = parsePositiveInt(row?.meeting_id);
      if (!meetingId) return;
      const key = String(meetingId);
      const existing = map.get(key) || [];
      existing.push(createParticipantDraft(row));
      map.set(key, existing);
    });
    return map;
  }, [meetingParticipants]);
  const organizationLeadership = useMemo(
    () => getOrganizationLeadershipRoles(asPlainObject(tenantSiteData)),
    [tenantSiteData]
  );
  const organizationLeadershipIds = useMemo(
    () => ({
      chairperson_member_id: String(organizationLeadership.chairperson_member_id || "").trim(),
      vice_chairperson_member_id: String(
        organizationLeadership.vice_chairperson_member_id || ""
      ).trim(),
      secretary_member_id: String(organizationLeadership.secretary_member_id || "").trim(),
      treasurer_member_id: String(organizationLeadership.treasurer_member_id || "").trim(),
    }),
    [organizationLeadership]
  );
  const organizationLeadershipNames = useMemo(
    () => ({
      chairperson:
        memberById.get(String(organizationLeadershipIds.chairperson_member_id || ""))?.name || "",
      viceChairperson:
        memberById.get(String(organizationLeadershipIds.vice_chairperson_member_id || ""))?.name ||
        "",
      secretary:
        memberById.get(String(organizationLeadershipIds.secretary_member_id || ""))?.name || "",
      treasurer:
        memberById.get(String(organizationLeadershipIds.treasurer_member_id || ""))?.name || "",
    }),
    [memberById, organizationLeadershipIds]
  );
  const tenantBrand = useMemo(
    () => buildTenantBrand(tenantRecord || {}, asPlainObject(tenantSiteData)),
    [tenantRecord, tenantSiteData]
  );
  const aiMinutesBackupConfigured = isMeetingMinutesAiConfigured();
  const posterFileLabel = useMemo(() => {
    if (activityPosterFile?.name) {
      return activityPosterFile.name;
    }
    const posterPath = String(formData.poster_path || "").trim();
    if (posterPath) {
      const fromPath = posterPath.split("/").pop();
      if (fromPath) return fromPath;
    }
    const posterUrl = String(formData.poster_url || "").trim();
    if (posterUrl) {
      const fromUrl = posterUrl.split("?")[0].split("/").pop();
      if (fromUrl) return fromUrl;
      return "Current poster selected";
    }
    return "No file chosen";
  }, [activityPosterFile, formData.poster_path, formData.poster_url]);

  const resetSourcePartnerModal = () => {
    setShowSourcePartnerModal(false);
    setSourcePartnerForm(createSourcePartnerForm());
    setSourcePartnerError("");
  };

  const clearPosterObjectUrl = () => {
    if (!posterObjectUrlRef.current || typeof URL === "undefined") return;
    try {
      URL.revokeObjectURL(posterObjectUrlRef.current);
    } catch (error) {
      console.warn("Could not revoke poster preview URL:", error);
    }
    posterObjectUrlRef.current = "";
  };

  const resetPosterUploadState = (previewUrl = "") => {
    clearPosterObjectUrl();
    setActivityPosterFile(null);
    setActivityPosterPreview(String(previewUrl || "").trim());
    setPosterUploadError("");
  };

  const handlePosterFileChange = (event) => {
    const file = event?.target?.files?.[0] || null;
    if (!file) {
      setActivityPosterFile(null);
      setPosterUploadError("");
      setActivityPosterPreview(String(formData.poster_url || "").trim());
      return;
    }
    clearPosterObjectUrl();
    if (typeof URL !== "undefined" && URL.createObjectURL) {
      posterObjectUrlRef.current = URL.createObjectURL(file);
      setActivityPosterPreview(posterObjectUrlRef.current);
    }
    setActivityPosterFile(file);
    setPosterUploadError("");
  };

  useEffect(() => {
    setFormData((prev) => {
      const categoryValues = categoryOptions.map((item) => item.value);
      const valueTypeValues = (activityOptionValues.valueTypes || []).map((item) => item.value);
      const budgetLineValues = (activityOptionValues.budgetLines || []).map((item) => item.value);
      const partnerIds = new Set((organizationPartners || []).map((partner) => String(partner?.id || "").trim()).filter(Boolean));
      const nextCategory = categoryValues.includes(prev.type) ? prev.type : defaultCategoryValue;
      const nextValueType = valueTypeValues.includes(prev.value_type)
        ? prev.value_type
        : defaultValueType;
      const nextBudgetLine = budgetLineValues.includes(prev.budget_line)
        ? prev.budget_line
        : defaultBudgetLine;
      const nextSourcePartnerId = partnerIds.has(String(prev.source_partner_id || "").trim())
        ? String(prev.source_partner_id || "").trim()
        : "";
      const nextSourcePartnerName = nextSourcePartnerId
        ? String(sourcePartnerById.get(nextSourcePartnerId)?.name || "")
        : String(prev.source_partner_name || "").trim();
      if (
        nextCategory === prev.type &&
        nextValueType === prev.value_type &&
        nextBudgetLine === prev.budget_line &&
        nextSourcePartnerId === String(prev.source_partner_id || "").trim() &&
        nextSourcePartnerName === String(prev.source_partner_name || "").trim()
      ) {
        return prev;
      }
      return {
        ...prev,
        type: nextCategory,
        value_type: nextValueType,
        budget_line: nextBudgetLine,
        source_partner_id: nextSourcePartnerId,
        source_partner_name: nextSourcePartnerName,
      };
    });
  }, [
    categoryOptions,
    activityOptionValues,
    defaultCategoryValue,
    defaultValueType,
    defaultBudgetLine,
    organizationPartners,
    sourcePartnerById,
  ]);

  useEffect(() => {
    return () => {
      clearPosterObjectUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isMeetingType(formData.type)) {
      return;
    }
    if (activityTab === "minutes" || activityTab === "roster") {
      setActivityTab("attendees");
    }
  }, [activityTab, formData.type]);

  const readCachedMeetings = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(meetingsCacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("Unable to read meetings cache:", error);
      return [];
    }
  };

  const persistMeetings = (items) => {
    const normalized = Array.isArray(items) ? items : [];
    setMeetings(normalized);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(meetingsCacheKey, JSON.stringify(normalized));
    } catch (error) {
      console.error("Unable to persist meetings cache:", error);
    }
  };

  const reloadMeetingsAndParticipants = async (openMeetingId = null) => {
    const [meetingData, participantData] = await Promise.all([
      getMeetings(tenantId),
      tenantId ? getMeetingParticipants(tenantId) : Promise.resolve([]),
    ]);
    persistMeetings(meetingData || []);
    setMeetingParticipants(participantData || []);

    if (openMeetingId) {
      const matchingMeeting = (meetingData || []).find(
        (meeting) => String(meeting?.id || "") === String(openMeetingId)
      );
      if (matchingMeeting) {
        const matchingParticipants = (participantData || []).filter(
          (participant) => String(participant?.meeting_id || "") === String(openMeetingId)
        );
        const nextActivity = buildActivityItemFromMeeting(matchingMeeting, matchingParticipants);
        setSelectedActivity(nextActivity);
        setFormData(createActivityForm(nextActivity));
      }
    }

    return {
      meetingData: meetingData || [],
      participantData: participantData || [],
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const cachedMeetings = readCachedMeetings();
        const [
          meetingsResult,
          participantsResult,
          membersResult,
          welfareResult,
          subscribersResult,
          optionValuesResult,
          tenantResult,
        ] = await Promise.allSettled([
          getMeetings(tenantId),
          tenantId ? getMeetingParticipants(tenantId) : Promise.resolve([]),
          tenantId ? getMembersAdmin(tenantId) : Promise.resolve([]),
          tenantId ? getWelfareSummary(tenantId) : Promise.resolve(null),
          tenantId ? getEventSubscribers(tenantId) : Promise.resolve([]),
          getOrganizationActivityOptionValues(tenantId),
          tenantId ? getTenantById(tenantId) : Promise.resolve(null),
        ]);

        if (meetingsResult.status === "fulfilled") {
          persistMeetings(meetingsResult.value || []);
        } else {
          console.error("Error loading meetings:", meetingsResult.reason);
          persistMeetings(cachedMeetings);
        }

        if (membersResult.status === "fulfilled") {
          setMembers(membersResult.value || []);
        } else {
          console.error("Error loading members:", membersResult.reason);
          setMembers([]);
        }

        if (participantsResult.status === "fulfilled") {
          setMeetingParticipants(participantsResult.value || []);
        } else {
          console.error("Error loading meeting participants:", participantsResult.reason);
          setMeetingParticipants([]);
        }

        if (welfareResult.status === "fulfilled") {
          setWelfareSummary(welfareResult.value || null);
        } else {
          console.error("Error loading welfare summary:", welfareResult.reason);
          setWelfareSummary(null);
        }

        if (subscribersResult.status === "fulfilled") {
          setEventSubscribers(subscribersResult.value || []);
        } else {
          console.error("Error loading event subscribers:", subscribersResult.reason);
          setEventSubscribers([]);
        }

        if (optionValuesResult.status === "fulfilled") {
          setActivityOptionValues(optionValuesResult.value || FALLBACK_ACTIVITY_OPTION_VALUES);
        } else {
          console.error("Error loading activity option values:", optionValuesResult.reason);
          setActivityOptionValues(FALLBACK_ACTIVITY_OPTION_VALUES);
        }

        if (tenantResult.status === "fulfilled") {
          const siteData = asPlainObject(tenantResult.value?.site_data);
          setTenantRecord(tenantResult.value || null);
          setTenantSiteData(siteData);
          setOrganizationPartners(getOrganizationPartners(siteData));
        } else {
          console.error("Error loading tenant partner options:", tenantResult.reason);
          setTenantRecord(null);
          setTenantSiteData({});
          setOrganizationPartners([]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        persistMeetings(readCachedMeetings());
        setMeetingParticipants([]);
        setMembers([]);
        setWelfareSummary(null);
        setEventSubscribers([]);
        setActivityOptionValues(FALLBACK_ACTIVITY_OPTION_VALUES);
        setTenantRecord(null);
        setTenantSiteData({});
        setOrganizationPartners([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, meetingsCacheKey]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "type"
          ? value
          : name === "audience_scope"
            ? value
            : value,
      ...(name === "type" && isMeetingType(value) && !prev.agenda_items.some((item) => item.title.trim())
        ? { agenda_items: [createAgendaItem()] }
        : {}),
    }));
  };

  const handleAgendaItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      agenda_items: (prev.agenda_items || []).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (field === "resolutions") {
          return {
            ...item,
            resolutions: value,
          };
        }
        return {
          ...item,
          [field]: value,
        };
      }),
    }));
  };

  const addAgendaItem = () => {
    setFormData((prev) => ({
      ...prev,
      agenda_items: [...(prev.agenda_items || []), createAgendaItem()],
    }));
  };

  const removeAgendaItem = (index) => {
    setFormData((prev) => {
      const remaining = (prev.agenda_items || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...prev,
        agenda_items: remaining.length ? remaining : [createAgendaItem()],
      };
    });
  };

  const handleAgendaResolutionChange = (agendaIndex, resolutionIndex, value) => {
    setFormData((prev) => ({
      ...prev,
      agenda_items: (prev.agenda_items || []).map((item, itemIndex) => {
        if (itemIndex !== agendaIndex) return item;
        const nextResolutions = Array.isArray(item.resolutions) ? [...item.resolutions] : [""];
        nextResolutions[resolutionIndex] = value;
        return {
          ...item,
          resolutions: nextResolutions,
        };
      }),
    }));
  };

  const addAgendaResolution = (agendaIndex) => {
    setFormData((prev) => ({
      ...prev,
      agenda_items: (prev.agenda_items || []).map((item, itemIndex) =>
        itemIndex === agendaIndex
          ? {
              ...item,
              resolutions: [...(Array.isArray(item.resolutions) ? item.resolutions : []), ""],
            }
          : item
      ),
    }));
  };

  const removeAgendaResolution = (agendaIndex, resolutionIndex) => {
    setFormData((prev) => ({
      ...prev,
      agenda_items: (prev.agenda_items || []).map((item, itemIndex) => {
        if (itemIndex !== agendaIndex) return item;
        const nextResolutions = (Array.isArray(item.resolutions) ? item.resolutions : []).filter(
          (_, itemResolutionIndex) => itemResolutionIndex !== resolutionIndex
        );
        return {
          ...item,
          resolutions: nextResolutions.length ? nextResolutions : [""],
        };
      }),
    }));
  };

  const handleMinutesFieldChange = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      minutes_data: {
        ...prev.minutes_data,
        [section]:
          field === null
            ? value
            : {
                ...(prev.minutes_data?.[section] || {}),
                [field]: value,
              },
      },
    }));
  };

  const buildAgendaBasedDraft = (value = {}) => ({
    agenda_items: Array.isArray(value?.agenda_items)
      ? value.agenda_items.map((item) => createAgendaItem(item))
      : [],
    minutes_data: buildMinutesDraftFromAgenda({
      meetingTitle: value?.title,
      meetingDate: value?.date,
      agendaItems: value?.agenda_items || [],
      leadershipNames: organizationLeadershipNames,
    }),
  });

  const applyDraftMinutesFromAgenda = ({ overwrite = false } = {}) => {
    setFormData((prev) => mergeMeetingDraftIntoForm(prev, buildAgendaBasedDraft(prev), { overwrite }));
  };

  const handleBuildMinutesDraft = async ({ overwrite = false } = {}) => {
    if (!useAiMinutesBackup || !aiMinutesBackupConfigured) {
      applyDraftMinutesFromAgenda({ overwrite });
      return;
    }

    const currentDraftState = {
      id: selectedActivity?.id || null,
      title: formData.title,
      date: formData.date,
      description: formData.description,
      location: formData.location,
      agenda: formData.agenda,
      audience_scope: formData.audience_scope,
      start_at: formData.start_at || formData.startAt,
      agenda_items: formData.agenda_items || [],
      meeting_participants: formData.meeting_participants || [],
      minutes_data: formData.minutes_data || createMinutesData(),
    };
    const fallbackDraft = buildAgendaBasedDraft(currentDraftState);
    const draftParticipants = (Array.isArray(currentDraftState.meeting_participants)
      ? currentDraftState.meeting_participants
      : []
    ).map((row) => createParticipantDraft(row));
    const presentRows = draftParticipants.filter((participant) => participant.attendance_status === "attended");
    const apologyRows = draftParticipants.filter((participant) => participant.rsvp_status === "apology");
    const absentRows = draftParticipants.filter(
      (participant) =>
        participant.attendance_status === "absent" && participant.rsvp_status !== "apology"
    );

    setDraftingWithAi(true);
    try {
      const aiDraft = await enhanceMeetingMinutesDraftWithAi({
        meeting: currentDraftState,
        leadershipNames: organizationLeadershipNames,
        agendaItems: currentDraftState.agenda_items,
        presentRows,
        apologyRows,
        absentRows,
        currentMinutesData: currentDraftState.minutes_data,
        fallbackMinutesData: fallbackDraft.minutes_data,
      });
      setFormData((prev) => mergeMeetingDraftIntoForm(prev, aiDraft, { overwrite }));
    } catch (error) {
      console.error("Error generating AI meeting minutes draft:", error);
      setFormData((prev) => mergeMeetingDraftIntoForm(prev, fallbackDraft, { overwrite }));
      alert(`${error?.message || "OpenAI backup is unavailable right now."} Standard draft applied instead.`);
    } finally {
      setDraftingWithAi(false);
    }
  };

  const handleAddAgendaPreset = () => {
    const presetItem = buildAgendaItemFromPreset(selectedAgendaPresetKey);
    if (!presetItem) return;

    setFormData((prev) => {
      const currentAgendaItems = Array.isArray(prev.agenda_items) ? prev.agenda_items : [];
      const hasOnlyPlaceholder =
        currentAgendaItems.length === 1 && !hasAgendaItemContent(currentAgendaItems[0]);
      const nextAgendaItems = hasOnlyPlaceholder
        ? [createAgendaItem(presetItem)]
        : [...currentAgendaItems, createAgendaItem(presetItem)];
      return {
        ...prev,
        agenda_items: nextAgendaItems,
        minutes_data: mergeMinutesDraft(
          prev.minutes_data,
          buildAgendaBasedDraft({
            ...prev,
            agenda_items: nextAgendaItems,
          }).minutes_data,
          { overwrite: false }
        ),
      };
    });
    setSelectedAgendaPresetKey("");
  };

  const handleSourcePartnerSelect = (event) => {
    const selectedValue = String(event.target.value || "");
    if (selectedValue === CREATE_SOURCE_PARTNER_OPTION) {
      setShowSourcePartnerModal(true);
      setSourcePartnerForm(createSourcePartnerForm());
      setSourcePartnerError("");
      return;
    }

    const selectedPartner = sourcePartnerById.get(selectedValue);
    setSourcePartnerError("");
    setFormData((prev) => ({
      ...prev,
      source_partner_id: selectedPartner ? String(selectedPartner.id) : "",
      source_partner_name: selectedPartner ? String(selectedPartner.name || "") : "",
    }));
  };

  const handleSourcePartnerFormChange = (event) => {
    const { name, value } = event.target;
    setSourcePartnerForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateSourcePartner = async () => {
    const name = String(sourcePartnerForm.name || "").trim();
    if (!name) {
      setSourcePartnerError("Partner name is required.");
      return;
    }
    if (!tenantId) {
      setSourcePartnerError("Source partners require an organization.");
      return;
    }

    const existingPartner = sourcePartnerByName.get(normalizePartnerNameKey(name));
    if (existingPartner) {
      setFormData((prev) => ({
        ...prev,
        source_partner_id: String(existingPartner.id),
        source_partner_name: String(existingPartner.name || name),
      }));
      resetSourcePartnerModal();
      return;
    }

    setSavingSourcePartner(true);
    setSourcePartnerError("");
    try {
      const tenantRecord = await getTenantById(tenantId);
      const latestSiteData = asPlainObject(tenantRecord?.site_data);
      const baseSiteData = Object.keys(latestSiteData).length ? latestSiteData : asPlainObject(tenantSiteData);
      const existingPartners = getOrganizationPartners(baseSiteData);
      const duplicatePartner = existingPartners.find(
        (partner) => normalizePartnerNameKey(partner.name) === normalizePartnerNameKey(name)
      );

      if (duplicatePartner) {
        setTenantSiteData(baseSiteData);
        setOrganizationPartners(existingPartners);
        setFormData((prev) => ({
          ...prev,
          source_partner_id: String(duplicatePartner.id),
          source_partner_name: String(duplicatePartner.name || name),
        }));
        resetSourcePartnerModal();
        return;
      }

      const partnerId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `partner-${Date.now()}`;
      const nextPartner = {
        id: partnerId,
        name,
        kind: "Partner",
        status: String(sourcePartnerForm.status || "Active").trim() || "Active",
        contact_person: String(sourcePartnerForm.contact_person || "").trim(),
        contact_email: String(sourcePartnerForm.contact_email || "").trim(),
        contact_phone: String(sourcePartnerForm.contact_phone || "").trim(),
        last_contact: "",
        logo_url: String(sourcePartnerForm.logo_url || "").trim(),
        linked_project_ids: [],
        notes: String(sourcePartnerForm.notes || "").trim(),
      };
      const nextPartners = [nextPartner, ...existingPartners];
      const nextSiteData = buildSiteDataWithPartners(baseSiteData, nextPartners);
      await updateTenant(tenantId, { site_data: nextSiteData });
      setTenantSiteData(nextSiteData);
      setOrganizationPartners(nextPartners);
      setFormData((prev) => ({
        ...prev,
        source_partner_id: partnerId,
        source_partner_name: name,
      }));
      resetSourcePartnerModal();
    } catch (error) {
      console.error("Error creating source partner:", error);
      setSourcePartnerError(error?.message || "Could not create partner source.");
    } finally {
      setSavingSourcePartner(false);
    }
  };

  const handleToggleAssignee = (memberId) => {
    setFormData((prev) => {
      const assignees = prev.assignees || [];
      const isSelected = assignees.includes(memberId);
      return {
        ...prev,
        assignees: isSelected
          ? assignees.filter((id) => id !== memberId)
          : [...assignees, memberId],
      };
    });
  };

  const handleToggleAttendee = (attendeeId, type = "member") => {
    setFormData((prev) => {
      const attendees = prev.attendees || [];
      const attendeeKey = `${type}:${attendeeId}`;
      const isSelected = attendees.includes(attendeeKey);
      return {
        ...prev,
        attendees: isSelected
          ? attendees.filter((id) => id !== attendeeKey)
          : [...attendees, attendeeKey],
      };
    });
  };

  const handleAddNewSubscriber = async () => {
    if (!newSubscriber.name.trim() || !newSubscriber.email.trim()) {
      alert("Name and email are required");
      return;
    }

    try {
      const subscriber = await createEventSubscriber(newSubscriber, tenantId);
      setEventSubscribers((prev) => [...prev, subscriber]);
      setNewSubscriber({ name: "", email: "", contact: "" });
      setShowNewSubscriberForm(false);
      // Auto-select the new subscriber as an attendee
      handleToggleAttendee(subscriber.id, "subscriber");
    } catch (error) {
      console.error("Error creating subscriber:", error);
      alert(`Error creating subscriber: ${error.message}`);
    }
  };

  const handleSubmitActivity = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Activity title is required");
      return;
    }
    if (isMeetingType(formData.type) && !formData.agenda_items.some((item) => item.title.trim())) {
      alert("Meetings require at least one agenda item.");
      setActivityTab("details");
      return;
    }

    setSubmitting(true);
    try {
      let posterMeta = {
        poster_url: normalizeOptionalText(formData.poster_url),
        poster_path: normalizeOptionalText(formData.poster_path),
      };

      if (activityPosterFile) {
        try {
          const uploadedPoster = await uploadOrganizationActivityPoster(activityPosterFile, tenantId, {
            existingPath: formData.poster_path || "",
          });
          posterMeta = {
            poster_url: normalizeOptionalText(uploadedPoster?.poster_url),
            poster_path: normalizeOptionalText(uploadedPoster?.poster_path),
          };
        } catch (posterError) {
          console.error("Error uploading activity poster:", posterError);
          setPosterUploadError(
            posterError?.message || "Poster upload failed. Please try another image."
          );
          setActivityTab("details");
          return;
        }
      }

      const activityPayload = {
        title: formData.title,
        agenda: formData.agenda || formData.title,
        type: formData.type,
        date: formData.date,
        description: formData.description,
        location: formData.location,
        status: formData.status,
        value_type: formData.value_type,
        budget_line: formData.budget_line,
        source_partner_id: formData.source_partner_id || null,
        source_partner_name:
          sourcePartnerById.get(String(formData.source_partner_id || ""))?.name ||
          formData.source_partner_name ||
          null,
        poster_url: posterMeta.poster_url || null,
        poster_path: posterMeta.poster_path || null,
        assignees: formData.assignees || [],
        attendees: formData.attendees || [],
        audience_scope: formData.audience_scope || "selected_members",
        agenda_items: formData.agenda_items || [],
        chairperson_member_id:
          formData.chairperson_member_id || organizationLeadershipIds.chairperson_member_id || null,
        secretary_member_id:
          formData.secretary_member_id || organizationLeadershipIds.secretary_member_id || null,
        minutes_status: formData.minutes_status || "draft",
        minutes_data: formData.minutes_data || createMinutesData(),
      };

      let savedActivity = null;
      if (selectedActivity) {
        // Update existing activity
        savedActivity = await updateOrganizationActivity(selectedActivity.id, activityPayload, tenantId);
      } else {
        // Create new activity
        savedActivity = await createOrganizationActivity(activityPayload, tenantId);
      }

      // Reset form and reload meetings
      setFormData(
        createActivityForm({
          type: defaultCategoryValue,
          value_type: defaultValueType,
          budget_line: defaultBudgetLine,
        })
      );
      resetPosterUploadState("");
      resetSourcePartnerModal();
      setSelectedActivity(null);
      setActivityTab("details");
      setShowAddActivityModal(false);
      setShowNewSubscriberForm(false);
      setNewSubscriber({ name: "", email: "", contact: "" });
      setSelectedAgendaPresetKey("");

      await reloadMeetingsAndParticipants();

      if (savedActivity?.id) {
        setCalendarPreviewActivityId(String(savedActivity.id));
      }
    } catch (error) {
      console.error("Error saving activity:", error);
      alert(`Error saving activity: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const activityItems = useMemo(() => {
    return (meetings || [])
      .map((meeting) =>
        buildActivityItemFromMeeting(
          meeting,
          participantRowsByMeetingId.get(String(meeting?.id || "")) || []
        )
      )
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.date || ""));
        const rightTime = Date.parse(String(right?.date || ""));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
        const safeRight = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
        return safeLeft - safeRight;
      });
  }, [meetings, participantRowsByMeetingId]);

  const typeOptions = useMemo(() => {
    const unique = new Set(["all"]);
    activityItems.forEach((item) => {
      const type = String(item?.category || "").trim();
      if (type) unique.add(type);
    });
    return Array.from(unique);
  }, [activityItems]);

  const filteredActivities = useMemo(() => {
    const normalizedSearch = String(searchQuery || "").trim().toLowerCase();
    return activityItems.filter((item) => {
      if (statusFilter !== "all" && item.statusKey !== statusFilter) return false;
      if (typeFilter !== "all" && String(item.category || "") !== String(typeFilter || "")) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        item.title,
        item.category,
        item.description,
        item.location,
        item.statusLabel,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalizedSearch);
    });
  }, [activityItems, searchQuery, statusFilter, typeFilter]);

  const activityByIdentity = useMemo(() => {
    const map = new Map();
    activityItems.forEach((item) => {
      map.set(getActivityIdentity(item), item);
    });
    return map;
  }, [activityItems]);

  useEffect(() => {
    setSelectedActivityIds((prev) => prev.filter((id) => activityByIdentity.has(id)));
  }, [activityByIdentity]);

  useEffect(() => {
    setCalendarPreviewActivityId((prev) => (prev && !activityByIdentity.has(prev) ? "" : prev));
  }, [activityByIdentity]);

  const visibleActivityIds = useMemo(() => {
    return filteredActivities.map((item) => getActivityIdentity(item));
  }, [filteredActivities]);

  const selectedIdSet = useMemo(() => new Set(selectedActivityIds), [selectedActivityIds]);
  const allVisibleSelected = useMemo(() => {
    if (!visibleActivityIds.length) return false;
    return visibleActivityIds.every((id) => selectedIdSet.has(id));
  }, [visibleActivityIds, selectedIdSet]);

  const selectedActivities = useMemo(() => {
    return selectedActivityIds
      .map((id) => activityByIdentity.get(id))
      .filter(Boolean);
  }, [selectedActivityIds, activityByIdentity]);

  const activitySummary = useMemo(() => {
    const totals = {
      total: activityItems.length,
      today: 0,
      upcoming: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    };

    activityItems.forEach((item) => {
      if (item.statusKey === "today") totals.today += 1;
      if (item.statusKey === "upcoming") totals.upcoming += 1;
      if (item.statusKey === "in_progress") totals.inProgress += 1;
      if (item.statusKey === "completed") totals.completed += 1;
      if (item.statusKey === "overdue") totals.overdue += 1;
    });

    return totals;
  }, [activityItems]);

  const calendarMonthLabel = useMemo(() => {
    return calendarCursor.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [calendarCursor]);

  const activitiesByDate = useMemo(() => {
    const map = new Map();
    activityItems.forEach((item) => {
      const key = toIsoDateKey(item?.date);
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    return map;
  }, [activityItems]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const monthStartOffset = firstOfMonth.getDay();
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - monthStartOffset);

    const todayKey = new Date().toISOString().slice(0, 10);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === calendarCursor.getMonth(),
        isToday: key === todayKey,
        hasActivities: activitiesByDate.has(key),
      };
    });
  }, [activitiesByDate, calendarCursor]);

  const activityFeed = useMemo(() => {
    const selected = activitiesByDate.get(selectedCalendarDate);
    if (selected?.length) {
      return selected;
    }
    return [...activityItems]
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.date || ""));
        const rightTime = Date.parse(String(right?.date || ""));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
        return safeRight - safeLeft;
      })
      .slice(0, 4);
  }, [activitiesByDate, activityItems, selectedCalendarDate]);

  const memberNameById = useMemo(() => {
    const map = new Map();
    (members || []).forEach((member) => {
      if (member?.id === undefined || member?.id === null) return;
      map.set(String(member.id), String(member.name || "").trim());
    });
    return map;
  }, [members]);

  const selectedTeamMembers = useMemo(() => {
    const names = [];
    const seen = new Set();
    selectedActivities.forEach((activity) => {
      const memberIds = getActivityMemberIds(activity);
      memberIds.forEach((memberId) => {
        const memberName = memberNameById.get(String(memberId));
        if (!memberName || seen.has(memberName)) return;
        seen.add(memberName);
        names.push(memberName);
      });
    });
    return names;
  }, [selectedActivities, memberNameById]);

  const calendarPreviewActivity = useMemo(() => {
    if (!calendarPreviewActivityId) return null;
    return activityByIdentity.get(calendarPreviewActivityId) || null;
  }, [calendarPreviewActivityId, activityByIdentity]);

  const calendarPreviewAttendeeCount = useMemo(() => {
    if (!calendarPreviewActivity) return 0;
    return Number(calendarPreviewActivity.invitedCount || 0);
  }, [calendarPreviewActivity]);
  const calendarPreviewParticipantSummary = useMemo(
    () => summarizeMeetingParticipants(calendarPreviewActivity?.meetingParticipants),
    [calendarPreviewActivity]
  );
  const calendarPreviewCurrentParticipant = useMemo(() => {
    if (!calendarPreviewActivity || !currentMemberId) return null;
    return (calendarPreviewActivity.meetingParticipants || []).find(
      (participant) =>
        participant.participant_type === "member" &&
        Number(participant.member_id) === currentMemberId
    );
  }, [calendarPreviewActivity, currentMemberId]);

  const calendarPreviewDateMeta = useMemo(() => {
    if (!calendarPreviewActivity?.date) {
      return { day: "—", month: "N/A", weekday: "Undated" };
    }
    const parsedDate = new Date(String(calendarPreviewActivity.date));
    if (Number.isNaN(parsedDate.getTime())) {
      return { day: "—", month: "N/A", weekday: "Undated" };
    }
    return {
      day: parsedDate.toLocaleDateString("en-US", { day: "2-digit" }),
      month: parsedDate.toLocaleDateString("en-US", { month: "short" }),
      weekday: parsedDate.toLocaleDateString("en-US", { weekday: "long" }),
    };
  }, [calendarPreviewActivity]);

  const calendarPreviewVisual = useMemo(
    () => (calendarPreviewActivity ? getActivityVisual(calendarPreviewActivity.category) : { icon: "calendar", tone: "general" }),
    [calendarPreviewActivity]
  );
  const draftMeetingParticipants = useMemo(() => {
    if (!isMeetingType(formData.type)) {
      return [];
    }
    const existingByToken = new Map(
      (Array.isArray(formData.meeting_participants) ? formData.meeting_participants : [])
        .map((row) => {
          const draft = createParticipantDraft(row);
          const token =
            draft.token ||
            `${draft.participant_type}:${
              draft.participant_type === "subscriber" ? draft.subscriber_id : draft.member_id
            }`;
          return [token, draft];
        })
        .filter(([token]) => Boolean(token))
    );
    const tokens = new Set(normalizeAttendeeTokens(formData.attendees));
    if (formData.audience_scope === "all_members") {
      (members || []).forEach((member) => {
        const memberId = parsePositiveInt(member?.id);
        if (memberId) {
          tokens.add(`member:${memberId}`);
        }
      });
    }

    return Array.from(tokens).map((token) => {
      const existingDraft = existingByToken.get(token);
      if (existingDraft) {
        return existingDraft;
      }
      const [participantType, rawId] = token.split(":");
      const participantId =
        participantType === "subscriber" ? parseSubscriberId(rawId) : parsePositiveInt(rawId);
      const member = participantType === "member" ? memberById.get(String(participantId)) : null;
      const subscriber =
        participantType === "subscriber" ? subscriberById.get(String(participantId)) : null;
      return createParticipantDraft({
        token,
        participant_type: participantType,
        member_id: participantType === "member" ? participantId : null,
        subscriber_id: participantType === "subscriber" ? participantId : null,
        member,
        subscriber,
      });
    });
  }, [
    formData.type,
    formData.meeting_participants,
    formData.attendees,
    formData.audience_scope,
    members,
    memberById,
    subscriberById,
  ]);
  const draftMeetingParticipantSummary = useMemo(
    () => summarizeMeetingParticipants(draftMeetingParticipants),
    [draftMeetingParticipants]
  );
  const currentMeetingParticipant = useMemo(() => {
    if (!currentMemberId) return null;
    return draftMeetingParticipants.find(
      (participant) =>
        participant.participant_type === "member" &&
        Number(participant.member_id) === currentMemberId
    );
  }, [draftMeetingParticipants, currentMemberId]);

  const toggleCalendarPreviewActivity = (item) => {
    const identity = getActivityIdentity(item);
    if (!identity) return;
    setCalendarPreviewActivityId((prev) => (prev === identity ? "" : identity));

    const nextDateKey = toIsoDateKey(item?.date);
    if (nextDateKey) {
      setSelectedCalendarDate(nextDateKey);
      const parsedDate = new Date(nextDateKey);
      if (!Number.isNaN(parsedDate.getTime())) {
        setCalendarCursor(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
      }
    }
  };

  const moveCalendarMonth = (offset) => {
    setCalendarCursor((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  };

  const toggleActivitySelection = (identity) => {
    if (!identity) return;
    setSelectedActivityIds((prev) => {
      const exists = prev.includes(identity);
      return exists ? prev.filter((value) => value !== identity) : [...prev, identity];
    });
  };

  const toggleVisibleSelection = (selectAll) => {
    if (!visibleActivityIds.length) return;
    setSelectedActivityIds((prev) => {
      if (selectAll) {
        return Array.from(new Set([...prev, ...visibleActivityIds]));
      }
      const visibleSet = new Set(visibleActivityIds);
      return prev.filter((id) => !visibleSet.has(id));
    });
  };

  const updateParticipantDraft = (participantId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      meeting_participants: (prev.meeting_participants || []).map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              [field]: value,
            }
          : participant
      ),
    }));
  };

  const handleParticipantStatusChange = async (participant, field, value) => {
    if (!participant || !participant.id || !selectedActivity?.id || !tenantId || !canManageMeetings) {
      return;
    }
    updateParticipantDraft(participant.id, field, value);
    setUpdatingParticipants(true);
    try {
      await updateMeetingParticipants(
        [
          {
            id: participant.id,
            [field]: value,
          },
        ],
        tenantId,
        currentMemberId
      );
      await reloadMeetingsAndParticipants(selectedActivity.id);
    } catch (error) {
      console.error("Error updating meeting participant:", error);
      alert(error?.message || "Failed to update participant status.");
    } finally {
      setUpdatingParticipants(false);
    }
  };

  const handleMeetingRsvp = async (meetingId, rsvpStatus) => {
    if (!meetingId) return;
    setUpdatingParticipants(true);
    try {
      await respondMeetingInvitation(meetingId, rsvpStatus);
      await reloadMeetingsAndParticipants(meetingId);
    } catch (error) {
      console.error("Error responding to meeting invitation:", error);
      alert(error?.message || "Could not update your RSVP.");
    } finally {
      setUpdatingParticipants(false);
    }
  };

  const handleGenerateMinutes = async () => {
    if (!selectedActivity?.id || !tenantId || !isMeetingType(selectedActivity.category) || !canManageMeetings) {
      return;
    }

    setEmittingMinutes(true);
    try {
      await updateOrganizationActivity(
        selectedActivity.id,
        {
          title: formData.title,
          agenda: formData.agenda || formData.title,
          type: formData.type,
          date: formData.date,
          description: formData.description,
          location: formData.location,
          status: formData.status,
          value_type: formData.value_type,
          budget_line: formData.budget_line,
          source_partner_id: formData.source_partner_id || null,
          source_partner_name:
            sourcePartnerById.get(String(formData.source_partner_id || ""))?.name ||
            formData.source_partner_name ||
            null,
          poster_url: normalizeOptionalText(formData.poster_url),
          poster_path: normalizeOptionalText(formData.poster_path),
          assignees: formData.assignees || [],
          attendees: formData.attendees || [],
          audience_scope: formData.audience_scope || "selected_members",
          agenda_items: formData.agenda_items || [],
          chairperson_member_id:
            formData.chairperson_member_id || organizationLeadershipIds.chairperson_member_id || null,
          secretary_member_id:
            formData.secretary_member_id || organizationLeadershipIds.secretary_member_id || null,
          minutes_status: formData.minutes_status || "draft",
          minutes_data: formData.minutes_data || createMinutesData(),
        },
        tenantId
      );
      const finalizedMeeting = await finalizeMeetingAttendance(selectedActivity.id, tenantId, currentMemberId);
      const { meetingData, participantData } = await reloadMeetingsAndParticipants(selectedActivity.id);
      const activeMeeting =
        (meetingData || []).find((meeting) => String(meeting?.id || "") === String(selectedActivity.id)) ||
        finalizedMeeting;
      const activeParticipants = (participantData || []).filter(
        (participant) => String(participant?.meeting_id || "") === String(selectedActivity.id)
      );
      const draftedParticipants = activeParticipants.map((participant) => createParticipantDraft(participant));
      const presentRows = draftedParticipants.filter(
        (participant) => participant.attendance_status === "attended"
      );
      const apologyRows = draftedParticipants.filter(
        (participant) => participant.rsvp_status === "apology"
      );
      const absentRows = draftedParticipants.filter(
        (participant) =>
          participant.attendance_status === "absent" && participant.rsvp_status !== "apology"
      );
      const meetingItem = buildActivityItemFromMeeting(activeMeeting, activeParticipants);
      const resolvedChairpersonId =
        String(meetingItem.chairperson_member_id || organizationLeadershipIds.chairperson_member_id || "").trim();
      const resolvedSecretaryId =
        String(meetingItem.secretary_member_id || organizationLeadershipIds.secretary_member_id || "").trim();
      const generatedAt = new Date().toISOString();
      const titleLabel = String(meetingItem.title || "Meeting").trim();
      const fileName = `${toFilenameSlug(titleLabel)}-minutes-${generatedAt.slice(0, 10)}.pdf`;
      const file = await buildMeetingMinutesReportFile({
        tenantBrand,
        fileName,
        context: {
          meeting: {
            title: meetingItem.title,
            date: meetingItem.date,
            location: meetingItem.location,
            agenda: meetingItem.agenda,
            startAtLabel: meetingItem.startAt,
          },
          meetingTitle: meetingItem.title,
          meetingDate: meetingItem.date,
          agendaItems: meetingItem.agenda_items,
          minutesData: meetingItem.minutes_data,
          presentRows,
          apologyRows,
          absentRows,
          chairpersonName: memberNameById.get(resolvedChairpersonId) || organizationLeadershipNames.chairperson || "",
          secretaryName: memberNameById.get(resolvedSecretaryId) || organizationLeadershipNames.secretary || "",
          generatedAt,
          generatedBy: String(user?.name || user?.email || "Habuks").trim(),
        },
      });

      await uploadOrganizationDocument(
        file,
        {
          name: `Meeting Minutes - ${titleLabel}.pdf`,
          type: "Meeting Minutes",
          description: `Generated minutes for ${titleLabel}`,
          uploadedByMemberId: currentMemberId,
        },
        tenantId
      );
      alert("Meeting minutes generated and saved to organization documents.");
    } catch (error) {
      console.error("Error generating meeting minutes:", error);
      alert(error?.message || "Failed to generate meeting minutes.");
    } finally {
      setEmittingMinutes(false);
    }
  };

  const openCreateActivityModal = (template = null) => {
    setSelectedActivity(null);
    setActivityTab("details");
    resetSourcePartnerModal();
    resetPosterUploadState("");
    setShowNewSubscriberForm(false);
    setNewSubscriber({ name: "", email: "", contact: "" });
    setSelectedAgendaPresetKey("");
    setFormData(
      createActivityForm({
        title: template?.title || "",
        type: template?.type || defaultCategoryValue,
        date: new Date().toISOString().split("T")[0],
        description: template?.description || "",
        status: "scheduled",
        value_type: defaultValueType,
        budget_line: defaultBudgetLine,
        agenda: template?.title || "",
        attendees: [],
        chairperson_member_id: organizationLeadershipIds.chairperson_member_id || "",
        secretary_member_id: organizationLeadershipIds.secretary_member_id || "",
      })
    );
    setShowAddActivityModal(true);
  };

  const openEditActivityModal = (item, tab = "details") => {
    if (!item) return;
    setSelectedActivity(item);
    setActivityTab(tab);
    resetSourcePartnerModal();
    resetPosterUploadState(item.posterUrl || "");
    setShowNewSubscriberForm(false);
    setNewSubscriber({ name: "", email: "", contact: "" });
    setSelectedAgendaPresetKey("");
    setFormData(
      createActivityForm({
        title: item.title || "",
        type: item.category || defaultCategoryValue,
        date: item.date ? String(item.date).split("T")[0] : new Date().toISOString().split("T")[0],
        description: item.description || "",
        status: toFormStatusValue(item.status, item.statusKey),
        value_type: item.valueType || defaultValueType,
        budget_line: item.budgetLine || defaultBudgetLine,
        source_partner_id: item.sourcePartnerId || "",
        source_partner_name: item.sourcePartnerName || "",
        poster_url: item.posterUrl || "",
        poster_path: item.posterPath || "",
        location: item.location || "",
        agenda: item.agenda || item.title || "",
        assignees: normalizeMemberIdArray(item.assignees),
        attendees: normalizeAttendeeTokens(item.attendees),
        audience_scope: item.audience_scope || item.audienceScope || "selected_members",
        agenda_items: item.agenda_items || [],
        chairperson_member_id:
          item.chairperson_member_id || organizationLeadershipIds.chairperson_member_id || "",
        secretary_member_id:
          item.secretary_member_id || organizationLeadershipIds.secretary_member_id || "",
        minutes_status: item.minutes_status || "draft",
        minutes_data: item.minutes_data || createMinutesData(),
        meeting_participants: item.meetingParticipants || [],
      })
    );
    setShowAddActivityModal(true);
  };

  if (loading) {
    return <div className="meetings-page loading">Loading meetings...</div>;
  }

  return (
    <div className="activities-hub dashboard-mobile-shell">
      <section className="activities-hub-top">
        <div className="activities-hub-heading">
          <h2>Activities Hub</h2>
          <p>Track what is happening now, what is next, and what needs follow-up.</p>
        </div>
        <div className="activities-hub-actions">
          <button type="button" className="activities-hub-add-btn" onClick={() => openCreateActivityModal()}>
            <Icon name="plus" size={16} />
            New activity
          </button>
        </div>
      </section>

      <section className="activities-hub-kpis">
        <article className="activities-hub-kpi">
          <span className="activities-hub-kpi-label">Today</span>
          <strong className="activities-hub-kpi-value">{activitySummary.today}</strong>
          <small className="activities-hub-kpi-meta">{activitySummary.inProgress} in progress</small>
        </article>
        <article className="activities-hub-kpi">
          <span className="activities-hub-kpi-label">Upcoming</span>
          <strong className="activities-hub-kpi-value">{activitySummary.upcoming}</strong>
          <small className="activities-hub-kpi-meta">Planned next steps</small>
        </article>
        <article className="activities-hub-kpi">
          <span className="activities-hub-kpi-label">Completed</span>
          <strong className="activities-hub-kpi-value">{activitySummary.completed}</strong>
          <small className="activities-hub-kpi-meta">Activities closed</small>
        </article>
        <article className="activities-hub-kpi">
          <span className="activities-hub-kpi-label">Welfare Balance</span>
          <strong className="activities-hub-kpi-value">
            {formatMoney(welfareSummary?.currentBalance || 0)}
          </strong>
          <small className="activities-hub-kpi-meta">{members.length} members connected</small>
        </article>
      </section>

      <div className="activities-hub-layout">
        <section className="activities-hub-main">
          <div className="activities-hub-toolbar">
            <label className="activities-hub-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, location, description"
              />
            </label>
            <label className="activities-hub-select">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {ACTIVITY_FILTER_OPTIONS.map((option) => (
                  <option key={`status-filter-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="activities-hub-select">
              <span>Type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {typeOptions.map((optionValue) => (
                  <option key={`type-filter-${optionValue}`} value={optionValue}>
                    {optionValue === "all" ? "All Types" : optionValue}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="activities-hub-table-shell">
            <div className="activities-hub-table-meta">
              <span>{selectedActivityIds.length} selected</span>
              {selectedActivityIds.length ? (
                <button
                  type="button"
                  onClick={() => setSelectedActivityIds([])}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {!filteredActivities.length ? (
              <div className="activities-hub-empty">
                <Icon name="calendar" size={22} />
                <div>
                  <strong>No activities match your filters.</strong>
                  <p>Clear filters or add a new activity to get started.</p>
                </div>
              </div>
            ) : (
              <div className="activities-hub-table-wrap">
                <table className="activities-hub-table activities-hub-table--responsive">
                  <thead>
                    <tr>
                      <th className="activities-hub-col-select">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(event) => toggleVisibleSelection(event.target.checked)}
                          aria-label="Select all visible activities"
                        />
                      </th>
                      <th className="activities-hub-col-details">Activity Details</th>
                      <th className="activities-hub-col-date">Date</th>
                      <th className="activities-hub-col-category">Category</th>
                      <th className="activities-hub-col-team">Team Members</th>
                      <th className="activities-hub-col-status">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((item) => {
                      const identity = getActivityIdentity(item);
                      const isSelected = selectedIdSet.has(identity);
                      const visual = getActivityVisual(item.category);
                      const teamNames = getActivityMemberIds(item)
                        .map((memberId) => memberNameById.get(String(memberId)))
                        .filter(Boolean);

                      return (
                        <tr key={`activity-table-row-${identity}`} className={isSelected ? "is-selected" : ""}>
                          <td className="activities-hub-table-select activities-hub-col-select">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleActivitySelection(identity)}
                              aria-label={`Select ${item.title}`}
                            />
                          </td>
                          <td className="activities-hub-col-details">
                            <button
                              type="button"
                              className="activities-hub-table-detail"
                              onClick={() => openEditActivityModal(item)}
                            >
                              <span className={`activities-hub-table-icon tone-${visual.tone}`}>
                                <Icon name={visual.icon} size={15} />
                              </span>
                              <span className="activities-hub-table-detail-text">
                                <strong>{item.title}</strong>
                                <small>
                                  {item.location
                                    ? item.location
                                    : item.description || `${item.category} activity`}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td className="activities-hub-col-date">
                            <span className="activities-hub-table-date">{formatDate(item.date)}</span>
                          </td>
                          <td className="activities-hub-col-category">
                            <span className={`activities-hub-category-chip tone-${visual.tone}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="activities-hub-col-team">
                            {teamNames.length ? (
                              <div className="activities-hub-team-stack">
                                {teamNames.slice(0, 3).map((name) => (
                                  <span
                                    key={`activity-team-${identity}-${name}`}
                                    className="activities-hub-team-avatar"
                                    title={name}
                                  >
                                    {toInitials(name)}
                                  </span>
                                ))}
                                {teamNames.length > 3 ? (
                                  <span className="activities-hub-team-avatar is-more">
                                    +{teamNames.length - 3}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="activities-hub-team-empty">Unassigned</span>
                            )}
                          </td>
                          <td className="activities-hub-col-status">
                            <button
                              type="button"
                              className={`activities-hub-status-btn${
                                calendarPreviewActivityId === identity ? " is-active" : ""
                              }`}
                              onClick={() => toggleCalendarPreviewActivity(item)}
                              aria-label={`Preview ${item.title} in calendar panel`}
                            >
                              <span className={`activities-hub-status is-${item.statusTone}`}>
                                {item.statusLabel}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="activities-hub-side">
          <article className="activities-hub-card activities-hub-card-calendar">
            {calendarPreviewActivity ? (
              <div className={`activities-event-panel tone-${calendarPreviewVisual.tone}`}>
                <div className="activities-event-toolbar">
                  <button
                    type="button"
                    className="activities-event-back"
                    onClick={() => setCalendarPreviewActivityId("")}
                    aria-label="Back to calendar"
                  >
                    <Icon name="arrow-left" size={15} />
                  </button>
                  <div className="activities-event-toolbar-actions">
                    <span className="activities-event-icon-btn" aria-hidden="true">
                      <Icon name="heart" size={15} />
                    </span>
                  </div>
                </div>

                <div className={`activities-event-poster tone-${calendarPreviewVisual.tone}`}>
                  {calendarPreviewActivity.posterUrl ? (
                    <img
                      className="activities-event-poster-image"
                      src={calendarPreviewActivity.posterUrl}
                      alt={`${calendarPreviewActivity.title} poster`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <span className="activities-event-poster-badge">
                    <Icon name={calendarPreviewVisual.icon} size={13} />
                    {calendarPreviewActivity.category}
                  </span>
                  <span className={`activities-hub-status is-${calendarPreviewActivity.statusTone}`}>
                    {calendarPreviewActivity.statusLabel}
                  </span>
                </div>

                <h5 className="activities-event-title">{calendarPreviewActivity.title}</h5>

                <div className="activities-event-schedule">
                  <div className="activities-event-date-pill">
                    <strong className="activities-event-date-day">{calendarPreviewDateMeta.day}</strong>
                    <span className="activities-event-date-month">{calendarPreviewDateMeta.month}</span>
                  </div>
                  <div className="activities-event-schedule-meta">
                    <span className="activities-event-schedule-item">
                      <Icon name="calendar" size={13} />
                      {calendarPreviewDateMeta.weekday}
                    </span>
                    <span className="activities-event-schedule-item">
                      <Icon name="clock" size={13} />
                      {calendarPreviewActivity.statusLabel}
                    </span>
                    {calendarPreviewActivity.location ? (
                      <span className="activities-event-schedule-item">
                        <Icon name="location" size={13} />
                        {calendarPreviewActivity.location}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="activities-event-about">
                  <h6>About this activity</h6>
                  <p>
                    {calendarPreviewActivity.description ||
                      "Track details, assigned members, and execution updates for this activity."}
                  </p>
                </div>

                <div className="activities-event-facts">
                  <span className="activities-event-fact">
                    <Icon name="wallet" size={13} />
                    {calendarPreviewActivity.valueType || "Flow not set"}
                  </span>
                  <span className="activities-event-fact">
                    <Icon name="flag" size={13} />
                    {calendarPreviewActivity.budgetLine || "Purpose not set"}
                  </span>
                  <span className="activities-event-fact">
                    <Icon name="briefcase" size={13} />
                    {calendarPreviewActivity.sourcePartnerName ||
                      sourcePartnerById.get(calendarPreviewActivity.sourcePartnerId)?.name ||
                      "No source partner"}
                  </span>
                </div>

                <div className="activities-event-footer">
                  <div className="activities-event-footer-meta">
                    <span>
                      <Icon name="users" size={13} />
                      {calendarPreviewAttendeeCount || 0} invitee{calendarPreviewAttendeeCount === 1 ? "" : "s"}
                    </span>
                    <small>
                      {isMeetingType(calendarPreviewActivity.category)
                        ? `${calendarPreviewParticipantSummary.confirmed} confirmed • ${calendarPreviewParticipantSummary.attended} present`
                        : calendarPreviewActivity.location || "Location not set"}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isMeetingType(calendarPreviewActivity.category) && calendarPreviewCurrentParticipant ? (
                      <>
                        <button
                          type="button"
                          className="activities-event-attendees-btn"
                          onClick={() => handleMeetingRsvp(calendarPreviewActivity.id, "confirmed")}
                          disabled={updatingParticipants}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="activities-event-attendees-btn"
                          onClick={() => handleMeetingRsvp(calendarPreviewActivity.id, "apology")}
                          disabled={updatingParticipants}
                        >
                          Apology
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="activities-event-attendees-btn"
                      onClick={() =>
                        openEditActivityModal(
                          calendarPreviewActivity,
                          isMeetingType(calendarPreviewActivity.category) ? "roster" : "attendees"
                        )
                      }
                    >
                      {isMeetingType(calendarPreviewActivity.category) ? "View roster" : "View attendees"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <header className="activities-hub-calendar-head">
                  <h4>Calendar</h4>
                </header>
                <div className="activities-hub-selected-team">
                  <div className="activities-hub-selected-team-head">
                    <h5>Team Members</h5>
                    <span>{selectedActivities.length} activities</span>
                  </div>
                  {selectedTeamMembers.length ? (
                    <div className="activities-hub-selected-team-stack">
                      {selectedTeamMembers.slice(0, 8).map((memberName) => (
                        <span
                          key={`selected-team-member-${memberName}`}
                          className="activities-hub-team-avatar"
                          title={memberName}
                        >
                          {toInitials(memberName)}
                        </span>
                      ))}
                      {selectedTeamMembers.length > 8 ? (
                        <span className="activities-hub-team-avatar is-more">
                          +{selectedTeamMembers.length - 8}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="activities-hub-muted">
                      Select one or more activities to preview assigned members.
                    </p>
                  )}
                </div>
                <div className="activities-hub-calendar-toolbar">
                  <strong>{calendarMonthLabel}</strong>
                  <div className="activities-hub-calendar-controls">
                    <button
                      type="button"
                      className="activities-hub-calendar-nav"
                      aria-label="Previous month"
                      onClick={() => moveCalendarMonth(-1)}
                    >
                      <Icon name="arrow-left" size={14} />
                    </button>
                    <button
                      type="button"
                      className="activities-hub-calendar-nav"
                      aria-label="Next month"
                      onClick={() => moveCalendarMonth(1)}
                    >
                      <Icon name="arrow-right" size={14} />
                    </button>
                  </div>
                </div>
                <div className="activities-hub-calendar-grid">
                  {CALENDAR_WEEKDAYS.map((day) => (
                    <span key={`calendar-weekday-${day}`} className="activities-hub-calendar-weekday">
                      {day}
                    </span>
                  ))}
                  {calendarDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      className={`activities-hub-calendar-day${
                        day.isCurrentMonth ? "" : " is-muted"
                      }${day.isToday ? " is-today" : ""}${
                        selectedCalendarDate === day.key ? " is-selected" : ""
                      }`}
                      onClick={() => setSelectedCalendarDate(day.key)}
                    >
                      <span>{day.dayNumber}</span>
                      {day.hasActivities ? (
                        <small className="activities-hub-calendar-dot" aria-hidden="true" />
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className="activities-hub-feed">
                  <div className="activities-hub-feed-head">
                    <h5>Activity</h5>
                    <span>
                      {activitiesByDate.get(selectedCalendarDate)?.length
                        ? formatDate(selectedCalendarDate)
                        : "Recent updates"}
                    </span>
                  </div>
                  {!activityFeed.length ? (
                    <p className="activities-hub-muted">No activity records yet.</p>
                  ) : (
                    <div className="activities-hub-feed-list">
                      {activityFeed.map((item) => {
                        const assigneeName = (item.assignees || [])
                          .map((memberId) => memberNameById.get(String(memberId)))
                          .find(Boolean);
                        const actor = assigneeName || "Team member";
                        return (
                          <button
                            key={`activity-feed-${item.id || `${item.title}-${item.date}`}`}
                            type="button"
                            className="activities-hub-feed-item"
                            onClick={() => openEditActivityModal(item)}
                          >
                            <span className="activities-hub-feed-avatar" aria-hidden="true">
                              {actor.charAt(0).toUpperCase()}
                            </span>
                            <span className="activities-hub-feed-content">
                              <strong>{actor}</strong>
                              <small>{formatDate(item.date)}</small>
                              <em>
                                {item.title}
                                {item.category ? ` • ${item.category}` : ""}
                              </em>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </article>

          <article className="activities-hub-card">
            <header>
              <h4>Members snapshot</h4>
            </header>
            <div className="activities-hub-member-stack">
              {members.slice(0, 6).map((member) => (
                <span key={`member-avatar-${member.id || member.name}`} className="activities-hub-member-avatar">
                  {String(member?.name || "?").charAt(0).toUpperCase()}
                </span>
              ))}
              {members.length > 6 ? (
                <span className="activities-hub-member-avatar is-more">+{members.length - 6}</span>
              ) : null}
            </div>
            <div className="activities-hub-member-meta">
              <span>{members.length} members</span>
              <span>{members.filter((member) => String(member?.role || "").toLowerCase() === "admin").length} admins</span>
            </div>
          </article>
        </aside>
      </div>

      <DataModal
        open={showAddActivityModal}
        onClose={() => {
          setShowAddActivityModal(false);
          setSelectedActivity(null);
          resetSourcePartnerModal();
          resetPosterUploadState("");
          setShowNewSubscriberForm(false);
          setNewSubscriber({ name: "", email: "", contact: "" });
          setSelectedAgendaPresetKey("");
        }}
        title={selectedActivity ? "Edit activity" : "Add activity"}
        subtitle={selectedActivity ? "Update activity details and members." : "Capture activity details, value impact, and ownership."}
        icon={selectedActivity ? "edit" : "plus"}
        className="activities-data-modal"
      >
        <form className="data-modal-form" onSubmit={handleSubmitActivity}>
          <div className="data-modal-tabs">
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "details" ? "active" : ""}`}
              onClick={() => setActivityTab("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "finance" ? "active" : ""}`}
              onClick={() => setActivityTab("finance")}
            >
              Finance
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "partners" ? "active" : ""}`}
              onClick={() => setActivityTab("partners")}
            >
              Partners
            </button>
            <button
              type="button"
              className={`data-modal-tab ${activityTab === "assignees" ? "active" : ""}`}
              onClick={() => setActivityTab("assignees")}
            >
              Assignees
            </button>
            <button
              type="button"
              className={`data-modal-tab ${
                activityTab === "attendees" || activityTab === "roster" ? "active" : ""
              }`}
              onClick={() => setActivityTab(isMeetingType(formData.type) ? "roster" : "attendees")}
            >
              {isMeetingType(formData.type) ? "Roster" : "Attendees"}
            </button>
            {isMeetingType(formData.type) ? (
              <button
                type="button"
                className={`data-modal-tab ${activityTab === "minutes" ? "active" : ""}`}
                onClick={() => setActivityTab("minutes")}
              >
                Minutes
              </button>
            ) : null}
          </div>

          {activityTab === "details" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field">
                Activity title
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  placeholder="e.g. School fee disbursement"
                />
              </label>
              <label className="data-modal-field">
                Category
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleFormChange}
                >
                  {categoryOptions.map((option) => (
                    <option key={`activity-category-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="data-modal-field">
                Activity date
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                />
              </label>
              <label className="data-modal-field">
                Status
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="data-modal-field">
                Location
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleFormChange}
                  placeholder="e.g. Community Center"
                />
              </label>
              <div className="data-modal-field data-modal-field--full">
                <label htmlFor="activity-poster-upload">Poster image</label>
                <div className="activities-poster-upload">
                  <input
                    id="activity-poster-upload"
                    className="activities-poster-upload-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePosterFileChange}
                  />
                  <div className="activities-poster-upload-row">
                    <label htmlFor="activity-poster-upload" className="activities-poster-upload-trigger">
                      <Icon name="folder" size={14} />
                      Choose file
                    </label>
                    <span
                      className={`activities-poster-upload-name${
                        activityPosterFile || formData.poster_url ? " is-selected" : ""
                      }`}
                      title={posterFileLabel}
                    >
                      {posterFileLabel}
                    </span>
                  </div>
                  <small>Upload a poster image (JPG, PNG, WEBP, GIF). Max 8 MB.</small>
                </div>
                {activityPosterPreview ? (
                  <div className="activities-poster-preview">
                    <img
                      src={activityPosterPreview}
                      alt="Activity poster preview"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                {posterUploadError ? (
                  <small className="activities-source-error">{posterUploadError}</small>
                ) : null}
              </div>
              <label className="data-modal-field data-modal-field--full">
                Description
                <textarea
                  rows="4"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Add a short description for this activity."
                />
              </label>
              {isMeetingType(formData.type) ? (
                <>
                  <label className="data-modal-field data-modal-field--full">
                    Agenda summary
                    <textarea
                      rows="3"
                      name="agenda"
                      value={formData.agenda}
                      onChange={handleFormChange}
                      placeholder="Short summary of the meeting purpose and overall agenda."
                    />
                  </label>
                  <label className="data-modal-field">
                    Invite scope
                    <select
                      name="audience_scope"
                      value={formData.audience_scope}
                      onChange={handleFormChange}
                    >
                      <option value="selected_members">Selected members only</option>
                      <option value="all_members">All tenant members</option>
                    </select>
                  </label>
                  <div className="data-modal-field data-modal-field--full">
                    <div
                      style={{
                        border: "1px solid #dbe3ee",
                        borderRadius: "12px",
                        padding: "1rem",
                        background: "#f8fbff",
                        display: "grid",
                        gap: "0.5rem",
                      }}
                    >
                      <strong>Meeting leadership</strong>
                      <small style={{ color: "#64748b" }}>
                        Leadership is pulled automatically from organization settings.
                      </small>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "0.75rem",
                          marginTop: "0.35rem",
                        }}
                      >
                        <div>
                          <span style={{ display: "block", color: "#64748b", fontSize: "0.82rem" }}>
                            Chairperson
                          </span>
                          <strong>{organizationLeadershipNames.chairperson || "Not assigned"}</strong>
                        </div>
                        <div>
                          <span style={{ display: "block", color: "#64748b", fontSize: "0.82rem" }}>
                            Secretary
                          </span>
                          <strong>{organizationLeadershipNames.secretary || "Not assigned"}</strong>
                        </div>
                        <div>
                          <span style={{ display: "block", color: "#64748b", fontSize: "0.82rem" }}>
                            Treasurer
                          </span>
                          <strong>{organizationLeadershipNames.treasurer || "Not assigned"}</strong>
                        </div>
                      </div>
                      {!organizationLeadershipIds.chairperson_member_id ||
                      !organizationLeadershipIds.secretary_member_id ? (
                        <small style={{ color: "#b45309" }}>
                          Set chairperson and secretary in organization settings to auto-fill
                          governance documents.
                        </small>
                      ) : null}
                    </div>
                  </div>
                  <div className="data-modal-field data-modal-field--full">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: "0.75rem",
                        alignItems: "end",
                      }}
                    >
                      <label className="data-modal-field" style={{ marginBottom: 0 }}>
                        Quick agenda preset
                        <select
                          value={selectedAgendaPresetKey}
                          onChange={(event) => setSelectedAgendaPresetKey(event.target.value)}
                        >
                          <option value="">Choose a common agenda...</option>
                          {Array.from(
                            MEETING_AGENDA_PRESET_OPTIONS.reduce((groups, option) => {
                              const existing = groups.get(option.group) || [];
                              existing.push(option);
                              groups.set(option.group, existing);
                              return groups;
                            }, new Map())
                          ).map(([groupLabel, options]) => (
                            <optgroup key={`agenda-group-${groupLabel}`} label={groupLabel}>
                              {options.map((option) => (
                                <option key={`agenda-preset-${option.key}`} value={option.key}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="data-modal-inline-btn"
                        onClick={handleAddAgendaPreset}
                        disabled={!selectedAgendaPresetKey}
                      >
                        <Icon name="plus" size={14} />
                        Add preset
                      </button>
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "0.45rem" }}>
                      Presets add agenda items with ready-made discussion and resolution drafts so the
                      minutes wizard starts nearly complete.
                    </small>
                  </div>
                  <div className="data-modal-field data-modal-field--full">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      <label style={{ margin: 0 }}>Agenda items</label>
                      <button type="button" className="data-modal-inline-btn" onClick={addAgendaItem}>
                        <Icon name="plus" size={14} />
                        Add agenda item
                      </button>
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "0.35rem" }}>
                      Each item becomes a numbered section in the generated minutes.
                    </small>
                    <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.9rem" }}>
                      {(formData.agenda_items || []).map((item, index) => (
                        <div
                          key={`meeting-agenda-item-${index}`}
                          style={{
                            border: "1px solid #dbe3ee",
                            borderRadius: "12px",
                            padding: "1rem",
                            background: "#f8fbff",
                            display: "grid",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                            <strong>Item {index + 1}</strong>
                            <button
                              type="button"
                              className="data-modal-inline-btn"
                              onClick={() => removeAgendaItem(index)}
                              disabled={(formData.agenda_items || []).length <= 1}
                            >
                              Remove
                            </button>
                          </div>
                          <label className="data-modal-field" style={{ marginBottom: 0 }}>
                            Title
                            <input
                              type="text"
                              value={item.title}
                              onChange={(event) =>
                                handleAgendaItemChange(index, "title", event.target.value)
                              }
                              placeholder="e.g. Review of previous action items"
                            />
                          </label>
                          <label className="data-modal-field" style={{ marginBottom: 0 }}>
                            Discussion notes
                            <textarea
                              rows="3"
                              value={item.details}
                              onChange={(event) =>
                                handleAgendaItemChange(index, "details", event.target.value)
                              }
                              placeholder="Capture the discussion points for this agenda item."
                            />
                          </label>
                          <div style={{ display: "grid", gap: "0.5rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                              <span style={{ fontSize: "0.92rem", fontWeight: 600 }}>Resolutions</span>
                              <button
                                type="button"
                                className="data-modal-inline-btn"
                                onClick={() => addAgendaResolution(index)}
                              >
                                <Icon name="plus" size={14} />
                                Add resolution
                              </button>
                            </div>
                            {(item.resolutions || [""]).map((resolution, resolutionIndex) => (
                              <div
                                key={`meeting-agenda-resolution-${index}-${resolutionIndex}`}
                                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
                              >
                                <input
                                  type="text"
                                  value={resolution}
                                  onChange={(event) =>
                                    handleAgendaResolutionChange(
                                      index,
                                      resolutionIndex,
                                      event.target.value
                                    )
                                  }
                                  placeholder="Add a resolution or action taken."
                                />
                                <button
                                  type="button"
                                  className="data-modal-inline-btn"
                                  onClick={() => removeAgendaResolution(index, resolutionIndex)}
                                  disabled={(item.resolutions || []).length <= 1}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {activityTab === "finance" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field">
                {formatFieldLabel("Amount")}
                <input type="number" placeholder="5000" />
              </label>
              <label className="data-modal-field">
                Flow
                <select
                  name="value_type"
                  value={formData.value_type}
                  onChange={handleFormChange}
                >
                  {(activityOptionValues.valueTypes || FALLBACK_ACTIVITY_OPTION_VALUES.valueTypes).map((option) => (
                    <option key={`activity-value-type-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="data-modal-field">
                Purpose
                <select
                  name="budget_line"
                  value={formData.budget_line}
                  onChange={handleFormChange}
                >
                  {(activityOptionValues.budgetLines || FALLBACK_ACTIVITY_OPTION_VALUES.budgetLines).map((option) => (
                    <option key={`activity-budget-line-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="data-modal-field">
                Reference
                <input type="text" placeholder="Receipt or transaction code" />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Financial note
                <textarea rows="4" placeholder="Optional note for finance records." />
              </label>
            </div>
          ) : null}

          {activityTab === "partners" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field data-modal-field--full">
                Source
                <select
                  value={formData.source_partner_id || ""}
                  onChange={handleSourcePartnerSelect}
                >
                  <option value="">Select source partner</option>
                  {formData.source_partner_id && !sourcePartnerById.has(String(formData.source_partner_id)) ? (
                    <option value={formData.source_partner_id}>
                      {formData.source_partner_name || "Selected source"}
                    </option>
                  ) : null}
                  {sourcePartnerOptions.map((partner) => (
                    <option key={`activity-source-partner-${partner.id}`} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                  <option value={CREATE_SOURCE_PARTNER_OPTION}>+ Create new partner</option>
                </select>
                <small className="activities-source-helper">
                  Pick the organization partner funding or backing this activity.
                </small>
              </label>
              <div className="data-modal-field data-modal-field--full">
                <button
                  type="button"
                  className="data-modal-inline-btn"
                  onClick={() => {
                    setSourcePartnerError("");
                    setShowSourcePartnerModal(true);
                  }}
                >
                  <Icon name="plus" size={14} />
                  Create new partner
                </button>
                {sourcePartnerError ? (
                  <small className="activities-source-error">{sourcePartnerError}</small>
                ) : null}
              </div>
            </div>
          ) : null}

          {activityTab === "assignees" ? (
            <div className="data-modal-grid">
              <div className="data-modal-field data-modal-field--full">
                <label>Select Members (Responsible)</label>
                <div className="member-selection-grid">
                  {members && members.length > 0 ? (
                    members.map((member) => (
                      <label key={member.id} className="member-checkbox">
                        <input
                          type="checkbox"
                          checked={(formData.assignees || []).includes(member.id)}
                          onChange={() => handleToggleAssignee(member.id)}
                        />
                        <span className="member-checkbox-label">
                          <span className="member-avatar-small">
                            {member.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                          <span className="member-info">
                            <span className="member-name">{member.name}</span>
                            <span className="member-role">{member.role}</span>
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p style={{ color: "#999", padding: "1rem" }}>No members available</p>
                  )}
                </div>
              </div>
              <div className="data-modal-field data-modal-field--full">
                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                  Selected: {(formData.assignees || []).length} assignee{(formData.assignees || []).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          ) : null}

          {activityTab === "attendees" || activityTab === "roster" ? (
            <div className="data-modal-grid">
              {isMeetingType(formData.type) ? (
                <>
                  <div className="data-modal-field data-modal-field--full">
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ border: "1px solid #dbe3ee", borderRadius: "12px", padding: "0.9rem", background: "#f8fbff" }}>
                        <small style={{ color: "#64748b", display: "block" }}>Invited</small>
                        <strong>{draftMeetingParticipantSummary.invited}</strong>
                      </div>
                      <div style={{ border: "1px solid #dbe3ee", borderRadius: "12px", padding: "0.9rem", background: "#f8fbff" }}>
                        <small style={{ color: "#64748b", display: "block" }}>Confirmed</small>
                        <strong>{draftMeetingParticipantSummary.confirmed}</strong>
                      </div>
                      <div style={{ border: "1px solid #dbe3ee", borderRadius: "12px", padding: "0.9rem", background: "#f8fbff" }}>
                        <small style={{ color: "#64748b", display: "block" }}>Apologies</small>
                        <strong>{draftMeetingParticipantSummary.apology}</strong>
                      </div>
                      <div style={{ border: "1px solid #dbe3ee", borderRadius: "12px", padding: "0.9rem", background: "#f8fbff" }}>
                        <small style={{ color: "#64748b", display: "block" }}>Marked present</small>
                        <strong>{draftMeetingParticipantSummary.attended}</strong>
                      </div>
                    </div>
                    <small style={{ color: "#64748b", display: "block", marginTop: "0.75rem" }}>
                      Members can confirm or send apologies. When minutes are generated, any invitee
                      still not marked present is finalized as absent.
                    </small>
                  </div>

                  {currentMeetingParticipant && selectedActivity?.id ? (
                    <div className="data-modal-field data-modal-field--full">
                      <label>Your RSVP</label>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="data-modal-btn data-modal-btn--primary"
                          onClick={() => handleMeetingRsvp(selectedActivity.id, "confirmed")}
                          disabled={updatingParticipants}
                        >
                          Confirm attendance
                        </button>
                        <button
                          type="button"
                          className="data-modal-btn"
                          onClick={() => handleMeetingRsvp(selectedActivity.id, "apology")}
                          disabled={updatingParticipants}
                        >
                          Send apology
                        </button>
                        <button
                          type="button"
                          className="data-modal-btn"
                          onClick={() => handleMeetingRsvp(selectedActivity.id, "declined")}
                          disabled={updatingParticipants}
                        >
                          Decline
                        </button>
                      </div>
                      <small style={{ color: "#64748b", display: "block", marginTop: "0.5rem" }}>
                        Current status:{" "}
                        <strong>
                          {String(currentMeetingParticipant.rsvp_status || "pending")
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (char) => char.toUpperCase())}
                        </strong>
                      </small>
                    </div>
                  ) : null}

                  <div className="data-modal-field data-modal-field--full">
                    <label>Invited members</label>
                    {formData.audience_scope === "all_members" ? (
                      <div
                        style={{
                          border: "1px dashed #cbd5e1",
                          borderRadius: "12px",
                          padding: "1rem",
                          background: "#f8fafc",
                          color: "#475569",
                        }}
                      >
                        All active tenant members will be invited automatically. You can still add
                        guest attendees below.
                      </div>
                    ) : (
                      <div className="member-selection-grid">
                        {members && members.length > 0 ? (
                          members.map((member) => (
                            <label key={`member-${member.id}`} className="member-checkbox">
                              <input
                                type="checkbox"
                                checked={(formData.attendees || []).includes(`member:${member.id}`)}
                                onChange={() => handleToggleAttendee(member.id, "member")}
                              />
                              <span className="member-checkbox-label">
                                <span className="member-avatar-small">
                                  {member.name?.charAt(0).toUpperCase() || "?"}
                                </span>
                                <span className="member-info">
                                  <span className="member-name">{member.name}</span>
                                  <span className="member-role">{member.role}</span>
                                </span>
                              </span>
                            </label>
                          ))
                        ) : (
                          <p style={{ color: "#999", padding: "1rem" }}>No members available</p>
                        )}
                      </div>
                    )}
                  </div>

                  {eventSubscribers && eventSubscribers.length > 0 ? (
                    <div className="data-modal-field data-modal-field--full">
                      <label>Guest attendees</label>
                      <div className="member-selection-grid">
                        {eventSubscribers.map((subscriber) => (
                          <label key={`subscriber-${subscriber.id}`} className="member-checkbox">
                            <input
                              type="checkbox"
                              checked={(formData.attendees || []).includes(`subscriber:${subscriber.id}`)}
                              onChange={() => handleToggleAttendee(subscriber.id, "subscriber")}
                            />
                            <span className="member-checkbox-label">
                              <span className="member-avatar-small">
                                {subscriber.name?.charAt(0).toUpperCase() || "?"}
                              </span>
                              <span className="member-info">
                                <span className="member-name">{subscriber.name}</span>
                                <span className="member-role">{subscriber.email}</span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="data-modal-field data-modal-field--full">
                    {!showNewSubscriberForm ? (
                      <button
                        type="button"
                        className="data-modal-btn"
                        onClick={() => setShowNewSubscriberForm(true)}
                        style={{ width: "100%" }}
                      >
                        + Add Guest Attendee
                      </button>
                    ) : (
                      <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "1rem" }}>
                        <h4 style={{ marginBottom: "1rem" }}>Add Guest Attendee</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <input
                            type="text"
                            value={newSubscriber.name}
                            onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                            placeholder="Full name"
                            style={{
                              padding: "0.75rem",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                            }}
                          />
                          <input
                            type="email"
                            value={newSubscriber.email}
                            onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                            placeholder="Email address"
                            style={{
                              padding: "0.75rem",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                            }}
                          />
                          <input
                            type="text"
                            value={newSubscriber.contact}
                            onChange={(e) => setNewSubscriber({ ...newSubscriber, contact: e.target.value })}
                            placeholder="Phone number (optional)"
                            style={{
                              padding: "0.75rem",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "0.875rem",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                          <button
                            type="button"
                            className="data-modal-btn"
                            onClick={() => {
                              setShowNewSubscriberForm(false);
                              setNewSubscriber({ name: "", email: "", contact: "" });
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="data-modal-btn data-modal-btn--primary"
                            onClick={handleAddNewSubscriber}
                          >
                            Add attendee
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="data-modal-field data-modal-field--full">
                    <label>Roster status</label>
                    {!draftMeetingParticipants.length ? (
                      <p style={{ color: "#64748b" }}>Save the meeting after choosing invitees to manage RSVPs and attendance.</p>
                    ) : (
                      <div style={{ display: "grid", gap: "0.75rem" }}>
                        {draftMeetingParticipants.map((participant) => (
                          <div
                            key={`meeting-participant-${participant.id || participant.token}`}
                            style={{
                              border: "1px solid #dbe3ee",
                              borderRadius: "12px",
                              padding: "0.9rem",
                              display: "grid",
                              gap: "0.75rem",
                              background: "#ffffff",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                              <div>
                                <strong>{participant.name}</strong>
                                <div style={{ color: "#64748b", fontSize: "0.875rem" }}>
                                  {participant.participant_type === "subscriber"
                                    ? participant.email || "Guest attendee"
                                    : participant.role || participant.email || "Member"}
                                </div>
                              </div>
                              <span
                                style={{
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "999px",
                                  background: participant.participant_type === "subscriber" ? "#eef2ff" : "#ecfeff",
                                  color: "#0f172a",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                {participant.participant_type === "subscriber" ? "Guest" : "Member"}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                                gap: "0.75rem",
                              }}
                            >
                              <label className="data-modal-field" style={{ marginBottom: 0 }}>
                                RSVP
                                <select
                                  value={participant.rsvp_status}
                                  onChange={(event) =>
                                    handleParticipantStatusChange(
                                      participant,
                                      "rsvp_status",
                                      event.target.value
                                    )
                                  }
                                  disabled={!canManageMeetings || !selectedActivity?.id || !participant.id || updatingParticipants}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="declined">Declined</option>
                                  <option value="apology">Apology</option>
                                </select>
                              </label>
                              <label className="data-modal-field" style={{ marginBottom: 0 }}>
                                Attendance
                                <select
                                  value={participant.attendance_status}
                                  onChange={(event) =>
                                    handleParticipantStatusChange(
                                      participant,
                                      "attendance_status",
                                      event.target.value
                                    )
                                  }
                                  disabled={!canManageMeetings || !selectedActivity?.id || !participant.id || updatingParticipants}
                                >
                                  <option value="unknown">Not marked</option>
                                  <option value="attended">Present</option>
                                  <option value="absent">Absent</option>
                                </select>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="data-modal-field data-modal-field--full">
                    <label>Members Attending</label>
                    <div className="member-selection-grid">
                      {members && members.length > 0 ? (
                        members.map((member) => (
                          <label key={`member-${member.id}`} className="member-checkbox">
                            <input
                              type="checkbox"
                              checked={(formData.attendees || []).includes(`member:${member.id}`)}
                              onChange={() => handleToggleAttendee(member.id, "member")}
                            />
                            <span className="member-checkbox-label">
                              <span className="member-avatar-small">
                                {member.name?.charAt(0).toUpperCase() || "?"}
                              </span>
                              <span className="member-info">
                                <span className="member-name">{member.name}</span>
                                <span className="member-role">{member.role}</span>
                              </span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p style={{ color: "#999", padding: "1rem" }}>No members available</p>
                      )}
                    </div>
                  </div>

                  {eventSubscribers && eventSubscribers.length > 0 ? (
                    <div className="data-modal-field data-modal-field--full">
                      <label>Event Subscribers</label>
                      <div className="member-selection-grid">
                        {eventSubscribers.map((subscriber) => (
                          <label key={`subscriber-${subscriber.id}`} className="member-checkbox">
                            <input
                              type="checkbox"
                              checked={(formData.attendees || []).includes(`subscriber:${subscriber.id}`)}
                              onChange={() => handleToggleAttendee(subscriber.id, "subscriber")}
                            />
                            <span className="member-checkbox-label">
                              <span className="member-avatar-small">
                                {subscriber.name?.charAt(0).toUpperCase() || "?"}
                              </span>
                              <span className="member-info">
                                <span className="member-name">{subscriber.name}</span>
                                <span className="member-role">{subscriber.email}</span>
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {!isMeetingType(formData.type) && !showNewSubscriberForm ? (
                <div className="data-modal-field data-modal-field--full">
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() => setShowNewSubscriberForm(true)}
                    style={{ marginTop: "1rem", width: "100%" }}
                  >
                    + Add New Attendee
                  </button>
                </div>
              ) : null}

              {!isMeetingType(formData.type) && showNewSubscriberForm ? (
                <div className="data-modal-field data-modal-field--full">
                  <div style={{ border: "1px solid #e0e0e0", borderRadius: "8px", padding: "1rem", marginTop: "1rem" }}>
                    <h4 style={{ marginBottom: "1rem" }}>Add New Attendee</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <input
                        type="text"
                        value={newSubscriber.name}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                        placeholder="Full name"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                      <input
                        type="email"
                        value={newSubscriber.email}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                        placeholder="Email address"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                      <input
                        type="text"
                        value={newSubscriber.contact}
                        onChange={(e) => setNewSubscriber({ ...newSubscriber, contact: e.target.value })}
                        placeholder="Phone number (optional)"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                      <button
                        type="button"
                        className="data-modal-btn"
                        onClick={() => {
                          setShowNewSubscriberForm(false);
                          setNewSubscriber({ name: "", email: "", contact: "" });
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="data-modal-btn data-modal-btn--primary"
                        onClick={handleAddNewSubscriber}
                      >
                        Add Attendee
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isMeetingType(formData.type) ? (
                <div className="data-modal-field data-modal-field--full">
                  <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                    Total attendees: {(formData.attendees || []).length}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {activityTab === "minutes" && isMeetingType(formData.type) ? (
            <div className="data-modal-grid">
              <div className="data-modal-field data-modal-field--full">
                <div
                  style={{
                    border: "1px solid #dbe3ee",
                    borderRadius: "12px",
                    padding: "1rem",
                    background: "#f8fbff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>Quick draft</strong>
                    <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
                      Build a draft from the selected agenda and organization leadership roles, then
                      edit it freely before generating the PDF.
                    </p>
                    <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
                      Ask Habuks can draft the first formal version for you. If the AI path is not
                      available, the standard agenda-based draft still runs.
                    </p>
                  </div>
                  <div className="meeting-minutes-draft-actions">
                    <button
                      type="button"
                      className={`data-modal-btn meeting-minutes-ai-toggle${useAiMinutesBackup ? " is-active" : ""}${aiMinutesBackupConfigured ? " is-configured" : ""}`}
                      onClick={() => setUseAiMinutesBackup((prev) => !prev)}
                      aria-pressed={useAiMinutesBackup}
                      aria-label={useAiMinutesBackup ? "Ask Habuks activated" : "Ask Habuks"}
                      title={useAiMinutesBackup ? "Ask Habuks activated" : "Ask Habuks"}
                      disabled={draftingWithAi}
                    >
                      <span className="meeting-minutes-ai-tooltip" aria-hidden="true">
                        Ask Habuks
                      </span>
                      <span className="meeting-minutes-ai-mark" aria-hidden="true">
                        <img src="/assets/logo.png" alt="" />
                        <span className="meeting-minutes-ai-badge">
                          <Icon name="star" size={10} />
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="data-modal-btn"
                      onClick={() => handleBuildMinutesDraft({ overwrite: false })}
                      disabled={draftingWithAi}
                    >
                      {draftingWithAi ? "Drafting..." : "Draft from agenda"}
                    </button>
                  </div>
                </div>
              </div>
              <label className="data-modal-field data-modal-field--full">
                Preliminaries
                <textarea
                  rows="4"
                  value={formData.minutes_data?.preliminaries || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("preliminaries", null, event.target.value)
                  }
                  placeholder="Opening remarks, prayers, introductions, or procedural preliminaries."
                />
              </label>
              <label className="data-modal-field">
                Previous minutes status
                <input
                  type="text"
                  value={formData.minutes_data?.previous_minutes?.status || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("previous_minutes", "status", event.target.value)
                  }
                  placeholder="e.g. Confirmed as true record"
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Previous minutes notes
                <textarea
                  rows="3"
                  value={formData.minutes_data?.previous_minutes?.notes || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("previous_minutes", "notes", event.target.value)
                  }
                  placeholder="Corrections, adoption notes, or follow-up observations."
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Financial matters discussion
                <textarea
                  rows="4"
                  value={formData.minutes_data?.financial_matters?.discussion || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("financial_matters", "discussion", event.target.value)
                  }
                  placeholder="Capture the finance discussion from the meeting."
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Financial matters resolution
                <textarea
                  rows="3"
                  value={formData.minutes_data?.financial_matters?.resolution || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("financial_matters", "resolution", event.target.value)
                  }
                  placeholder="State the decision taken on financial matters."
                />
              </label>
              <label className="data-modal-field">
                Next meeting date
                <input
                  type="date"
                  value={formData.minutes_data?.next_meeting?.date || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("next_meeting", "date", event.target.value)
                  }
                />
              </label>
              <label className="data-modal-field">
                Adjournment time
                <input
                  type="text"
                  value={formData.minutes_data?.adjournment?.time || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("adjournment", "time", event.target.value)
                  }
                  placeholder="e.g. 4:30 PM"
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Next meeting note
                <textarea
                  rows="3"
                  value={formData.minutes_data?.next_meeting?.note || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("next_meeting", "note", event.target.value)
                  }
                  placeholder="Venue, host, or preparatory action for the next meeting."
                />
              </label>
              <label className="data-modal-field data-modal-field--full">
                Adjournment note
                <textarea
                  rows="3"
                  value={formData.minutes_data?.adjournment?.note || ""}
                  onChange={(event) =>
                    handleMinutesFieldChange("adjournment", "note", event.target.value)
                  }
                  placeholder="Closing remarks or direction issued at adjournment."
                />
              </label>
              <div className="data-modal-field data-modal-field--full">
                <div
                  style={{
                    border: "1px solid #dbe3ee",
                    borderRadius: "12px",
                    padding: "1rem",
                    background: "#f8fbff",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>Generate final minutes</strong>
                    <p style={{ margin: "0.35rem 0 0", color: "#64748b" }}>
                      Finalizing minutes marks unrecorded invitees as absent, renders the PDF, and
                      stores it in organization documents.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="data-modal-btn data-modal-btn--primary"
                    onClick={handleGenerateMinutes}
                    disabled={!selectedActivity?.id || !canManageMeetings || emittingMinutes}
                  >
                    {emittingMinutes ? "Generating..." : "Generate minutes PDF"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => {
                setShowAddActivityModal(false);
                setSelectedActivity(null);
                resetSourcePartnerModal();
                resetPosterUploadState("");
                setShowNewSubscriberForm(false);
                setNewSubscriber({ name: "", email: "", contact: "" });
                setSelectedAgendaPresetKey("");
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save activity"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showSourcePartnerModal}
        onClose={resetSourcePartnerModal}
        title="Add source partner"
        subtitle="Create a partner and use it as an activity source."
        icon="users"
      >
        <form
          className="data-modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreateSourcePartner();
          }}
        >
          <div className="data-modal-grid">
            <label className="data-modal-field">
              Partner name
              <input
                type="text"
                name="name"
                value={sourcePartnerForm.name}
                onChange={handleSourcePartnerFormChange}
                placeholder="e.g. AD Lure"
                required
              />
            </label>
            <label className="data-modal-field">
              Status
              <select
                name="status"
                value={sourcePartnerForm.status}
                onChange={handleSourcePartnerFormChange}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label className="data-modal-field">
              Contact person
              <input
                type="text"
                name="contact_person"
                value={sourcePartnerForm.contact_person}
                onChange={handleSourcePartnerFormChange}
                placeholder="e.g. Jane Doe"
              />
            </label>
            <label className="data-modal-field">
              Contact email
              <input
                type="email"
                name="contact_email"
                value={sourcePartnerForm.contact_email}
                onChange={handleSourcePartnerFormChange}
                placeholder="partner@example.org"
              />
            </label>
            <label className="data-modal-field">
              Contact phone
              <input
                type="text"
                name="contact_phone"
                value={sourcePartnerForm.contact_phone}
                onChange={handleSourcePartnerFormChange}
                placeholder="+254..."
              />
            </label>
            <label className="data-modal-field">
              Logo URL
              <input
                type="url"
                name="logo_url"
                value={sourcePartnerForm.logo_url}
                onChange={handleSourcePartnerFormChange}
                placeholder="https://..."
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Note
              <textarea
                rows="3"
                name="notes"
                value={sourcePartnerForm.notes}
                onChange={handleSourcePartnerFormChange}
                placeholder="Optional note about this partner."
              />
            </label>
            {sourcePartnerError ? (
              <p className="data-modal-feedback data-modal-feedback--error data-modal-field--full">
                {sourcePartnerError}
              </p>
            ) : null}
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={resetSourcePartnerModal}
              disabled={savingSourcePartner}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={savingSourcePartner}
            >
              {savingSourcePartner ? "Saving..." : "Save partner"}
            </button>
          </div>
        </form>
      </DataModal>
      <button
        type="button"
        className="dashboard-page-fab"
        onClick={() => openCreateActivityModal()}
        aria-label="Add activity"
      >
        <Icon name="plus" size={20} />
      </button>
      <DashboardMobileNav activePage="meetings" access={access} setActivePage={setActivePage} />
    </div>
  );
}
