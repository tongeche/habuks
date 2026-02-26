import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMeetings,
  createOrganizationActivity,
  updateOrganizationActivity,
  getMembersAdmin,
  getWelfareSummary,
  getEventSubscribers,
  createEventSubscriber,
  getOrganizationActivityOptionValues,
  getTenantById,
  updateTenant,
  uploadOrganizationActivityPoster,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";

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
      id = parsePositiveInt(item.id || item.member_id || item.subscriber_id);
    } else {
      const text = String(item || "");
      if (text.includes(":")) {
        const [rawType, rawId] = text.split(":");
        type = String(rawType || "member")
          .trim()
          .toLowerCase();
        id = parsePositiveInt(rawId);
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

const createSourcePartnerForm = () => ({
  name: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  logo_url: "",
  notes: "",
  status: "Active",
});

export default function MeetingsPage({ user, tenantId }) {
  const [meetings, setMeetings] = useState([]);
  const [members, setMembers] = useState([]);
  const [welfareSummary, setWelfareSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddActivityModal, setShowAddActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activityTab, setActivityTab] = useState("details");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "General",
    date: new Date().toISOString().split("T")[0],
    description: "",
    status: "scheduled",
    value_type: "Income",
    budget_line: "Operations",
    source_partner_id: "",
    source_partner_name: "",
    poster_url: "",
    poster_path: "",
    location: "",
    agenda: "",
    assignees: [],
    attendees: [],
  });
  const [activityOptionValues, setActivityOptionValues] = useState(FALLBACK_ACTIVITY_OPTION_VALUES);
  const [organizationPartners, setOrganizationPartners] = useState([]);
  const [tenantSiteData, setTenantSiteData] = useState({});
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
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
  const defaultCategoryValue =
    activityOptionValues.categories?.[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.categories[0].value;
  const defaultValueType =
    activityOptionValues.valueTypes?.[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.valueTypes[0].value;
  const defaultBudgetLine =
    activityOptionValues.budgetLines?.[0]?.value || FALLBACK_ACTIVITY_OPTION_VALUES.budgetLines[0].value;
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
      const categoryValues = (activityOptionValues.categories || []).map((item) => item.value);
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const cachedMeetings = readCachedMeetings();
        const [
          meetingsResult,
          membersResult,
          welfareResult,
          subscribersResult,
          optionValuesResult,
          tenantResult,
        ] = await Promise.allSettled([
          getMeetings(tenantId),
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
          setTenantSiteData(siteData);
          setOrganizationPartners(getOrganizationPartners(siteData));
        } else {
          console.error("Error loading tenant partner options:", tenantResult.reason);
          setTenantSiteData({});
          setOrganizationPartners([]);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        persistMeetings(readCachedMeetings());
        setMembers([]);
        setWelfareSummary(null);
        setEventSubscribers([]);
        setActivityOptionValues(FALLBACK_ACTIVITY_OPTION_VALUES);
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
      [name]: value,
    }));
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
      };

      if (selectedActivity) {
        // Update existing activity
        await updateOrganizationActivity(selectedActivity.id, activityPayload, tenantId);
      } else {
        // Create new activity
        await createOrganizationActivity(activityPayload, tenantId);
      }

      // Reset form and reload meetings
      setFormData({
        title: "",
        type: defaultCategoryValue,
        date: new Date().toISOString().split("T")[0],
        description: "",
        status: "scheduled",
        value_type: defaultValueType,
        budget_line: defaultBudgetLine,
        source_partner_id: "",
        source_partner_name: "",
        poster_url: "",
        poster_path: "",
        location: "",
        agenda: "",
        assignees: [],
        attendees: [],
      });
      resetPosterUploadState("");
      resetSourcePartnerModal();
      setSelectedActivity(null);
      setActivityTab("details");
      setShowAddActivityModal(false);

      // Reload meetings
      const data = await getMeetings(tenantId);
      persistMeetings(data || []);
    } catch (error) {
      console.error("Error saving activity:", error);
      alert(`Error saving activity: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const activityItems = useMemo(() => {
    return (meetings || [])
      .map((meeting) => {
        const dateValue = meeting?.date || meeting?.meeting_date || meeting?.created_at || "";
        const statusKey = normalizeActivityStatus(meeting?.status, dateValue);
        const normalizedAttendees = normalizeAttendeeTokens(
          meeting?.attendees_data ?? meeting?.attendees
        );
        const rawAssignees = normalizeMemberIdArray(
          normalizeArrayField(meeting?.assignees).length ? meeting?.assignees : meeting?.attendees
        );
        const ownerMemberId = parsePositiveInt(meeting?.owner_member_id);
        const normalizedAssignees =
          ownerMemberId && !rawAssignees.includes(ownerMemberId)
            ? [ownerMemberId, ...rawAssignees]
            : rawAssignees;
        return {
          id: meeting?.id,
          title: meeting?.title || meeting?.agenda || meeting?.type || "Untitled activity",
          category: meeting?.type || "General",
          date: dateValue,
          description: meeting?.description || "",
          location: meeting?.location || "",
          status: meeting?.status || statusKey,
          valueType: meeting?.value_type || "",
          budgetLine: meeting?.budget_line || "",
          sourcePartnerId: String(meeting?.source_partner_id || "").trim(),
          sourcePartnerName: String(meeting?.source_partner_name || "").trim(),
          posterUrl: String(meeting?.poster_url || "").trim(),
          posterPath: String(meeting?.poster_path || "").trim(),
          statusKey,
          statusLabel: formatStatusLabel(statusKey),
          statusTone: ACTIVITY_STATUS_META[statusKey]?.tone || "upcoming",
          assignees: normalizedAssignees,
          attendees: normalizedAttendees,
        };
      })
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.date || ""));
        const rightTime = Date.parse(String(right?.date || ""));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
        const safeRight = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
        return safeLeft - safeRight;
      });
  }, [meetings]);

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

  const calendarPreviewTeamNames = useMemo(() => {
    if (!calendarPreviewActivity) return [];
    return getActivityMemberIds(calendarPreviewActivity)
      .map((memberId) => memberNameById.get(String(memberId)))
      .filter(Boolean);
  }, [calendarPreviewActivity, memberNameById]);

  const calendarPreviewAttendeeCount = useMemo(() => {
    if (!calendarPreviewActivity) return 0;
    const attendeeTokens = normalizeAttendeeTokens(calendarPreviewActivity.attendees);
    const assigneeTokens = normalizeMemberIdArray(calendarPreviewActivity.assignees).map((memberId) => `member:${memberId}`);
    return new Set([...attendeeTokens, ...assigneeTokens]).size;
  }, [calendarPreviewActivity]);

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

  const openCreateActivityModal = (template = null) => {
    setSelectedActivity(null);
    setActivityTab("details");
    resetSourcePartnerModal();
    resetPosterUploadState("");
    setFormData({
      title: template?.title || "",
      type: template?.type || defaultCategoryValue,
      date: new Date().toISOString().split("T")[0],
      description: template?.description || "",
      status: "scheduled",
      value_type: defaultValueType,
      budget_line: defaultBudgetLine,
      source_partner_id: "",
      source_partner_name: "",
      poster_url: "",
      poster_path: "",
      location: "",
      agenda: template?.title || "",
      assignees: [],
      attendees: [],
    });
    setShowAddActivityModal(true);
  };

  const openEditActivityModal = (item, tab = "details") => {
    if (!item) return;
    setSelectedActivity(item);
    setActivityTab(tab);
    resetSourcePartnerModal();
    resetPosterUploadState(item.posterUrl || "");
    setFormData({
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
      agenda: item.title || "",
      assignees: normalizeMemberIdArray(item.assignees),
      attendees: normalizeAttendeeTokens(item.attendees),
    });
    setShowAddActivityModal(true);
  };

  if (loading) {
    return <div className="meetings-page loading">Loading meetings...</div>;
  }

  return (
    <div className="activities-hub">
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
          <strong className="activities-hub-kpi-value">KES {(welfareSummary?.currentBalance || 0).toLocaleString("en-KE")}</strong>
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
                <table className="activities-hub-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(event) => toggleVisibleSelection(event.target.checked)}
                          aria-label="Select all visible activities"
                        />
                      </th>
                      <th>Activity Details</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Team Members</th>
                      <th>Status</th>
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
                          <td className="activities-hub-table-select">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleActivitySelection(identity)}
                              aria-label={`Select ${item.title}`}
                            />
                          </td>
                          <td>
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
                          <td>
                            <span className="activities-hub-table-date">{formatDate(item.date)}</span>
                          </td>
                          <td>
                            <span className={`activities-hub-category-chip tone-${visual.tone}`}>
                              {item.category}
                            </span>
                          </td>
                          <td>
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
                          <td>
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
                      {calendarPreviewAttendeeCount || 0} attendee{calendarPreviewAttendeeCount === 1 ? "" : "s"}
                    </span>
                    <small>{calendarPreviewActivity.location || "Location not set"}</small>
                  </div>
                  <button
                    type="button"
                    className="activities-event-attendees-btn"
                    onClick={() => openEditActivityModal(calendarPreviewActivity, "attendees")}
                  >
                    View attendees
                  </button>
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
              className={`data-modal-tab ${activityTab === "attendees" ? "active" : ""}`}
              onClick={() => setActivityTab("attendees")}
            >
              Attendees
            </button>
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
                  {(activityOptionValues.categories || FALLBACK_ACTIVITY_OPTION_VALUES.categories).map((option) => (
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
            </div>
          ) : null}

          {activityTab === "finance" ? (
            <div className="data-modal-grid">
              <label className="data-modal-field">
                Amount (KES)
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

          {activityTab === "attendees" ? (
            <div className="data-modal-grid">
              {/* Members as Attendees */}
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

              {/* Event Subscribers */}
              {eventSubscribers && eventSubscribers.length > 0 && (
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
              )}

              {/* Add New Attendee Button */}
              <div className="data-modal-field data-modal-field--full">
                {!showNewSubscriberForm ? (
                  <button
                    type="button"
                    className="data-modal-btn"
                    onClick={() => setShowNewSubscriberForm(true)}
                    style={{ marginTop: "1rem", width: "100%" }}
                  >
                    + Add New Attendee
                  </button>
                ) : (
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
                )}
              </div>

              <div className="data-modal-field data-modal-field--full">
                <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
                  Total attendees: {(formData.attendees || []).length}
                </p>
              </div>
            </div>
          ) : null}

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => {
                setShowAddActivityModal(false);
                resetSourcePartnerModal();
                resetPosterUploadState("");
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
    </div>
  );
}
