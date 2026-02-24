import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createOrganizationActivity,
  createMemberAdmin,
  createTenantMembership,
  createMagicLinkInvite,
  deleteOrganizationActivities,
  deleteOrganizationDocument,
  getDocuments,
  getMeetings,
  getMembersAdmin,
  getOrganizationTemplateDownloadUrl,
  getOrganizationTemplates,
  getProjectsWithMembership,
  getTenantById,
  renameOrganizationDocument,
  uploadOrganizationDocument,
  uploadMemberAvatar,
  updateOrganizationActivity,
  updateMemberAdmin,
  updateTenant,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import ChoiceModal from "./ChoiceModal.jsx";
import ResponseModal from "./ResponseModal.jsx";

const ORG_TABS = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "documents", label: "Documents" },
  { key: "activities", label: "Activities" },
  { key: "partners", label: "Partners" },
  { key: "templates", label: "Templates" },
];

const PARTNER_KIND_OPTIONS = [
  "Partner",
  "Donor",
  "Vendor",
  "Trainer",
  "Government",
  "NGO",
  "Private Sector",
  "Other",
];
const PARTNER_LOGO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const PARTNER_STATUS_OPTIONS = ["Active", "Prospect", "Dormant", "Closed"];
const MEMBER_ROLE_OPTIONS = ["member", "admin", "superadmin", "project_manager", "supervisor"];
const MEMBER_STATUS_OPTIONS = ["active", "pending", "inactive"];
const ACTIVITY_TYPE_OPTIONS = [
  "General",
  "Meeting",
  "Training",
  "Field Visit",
  "Review",
  "Planning",
  "Donor Engagement",
];
const ACTIVITY_STATUS_OPTIONS = ["scheduled", "today", "upcoming", "completed", "cancelled"];
const MEMBER_FORM_STEPS = [
  { key: "basic", label: "Basic details", note: "Name, contact, role" },
  { key: "profile", label: "Profile", note: "Bio and location" },
  { key: "emergency", label: "Emergency", note: "Contact and review" },
];
const PARTNER_FORM_STEPS = [
  { key: "identity", label: "Identity", note: "Name, type, status, logo" },
  { key: "relationship", label: "Relationship", note: "Contacts, projects, notes" },
];
const ORGANIZATION_DOCUMENT_ACCEPT =
  ".pdf,.docx,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ORGANIZATION_EMIT_DOCUMENT_OPTIONS = [
  { value: "group_profile", label: "Group Profile" },
  { value: "governance_brief", label: "Governance Brief" },
  { value: "member_engagement_report", label: "Member Engagement Report" },
  { value: "activity_report", label: "Activity Report" },
  { value: "donor_readiness_pack", label: "Donor Readiness Pack" },
  { value: "operations_work_plan", label: "Operations Work Plan" },
];
const TEMPLATE_VIEW_OPTIONS = [
  { key: "grid", label: "Grid", icon: "layers" },
  { key: "table", label: "Table", icon: "menu" },
  { key: "list", label: "List", icon: "newspaper" },
];
const ORGANIZATION_OVERVIEW_RANGE_OPTIONS = [
  { value: "30d", label: "30D", windowLabel: "Last 30 days", deltaLabel: "vs previous window" },
  { value: "90d", label: "90D", windowLabel: "Last 90 days", deltaLabel: "vs previous window" },
  { value: "12m", label: "12M", windowLabel: "Last 12 months", deltaLabel: "vs previous month" },
];
const DEFAULT_ORGANIZATION_OVERVIEW_RANGE = ORGANIZATION_OVERVIEW_RANGE_OPTIONS[1].value;
const ORGANIZATION_OVERVIEW_RANGE_LOOKUP = ORGANIZATION_OVERVIEW_RANGE_OPTIONS.reduce(
  (collector, option) => {
    collector[option.value] = option;
    return collector;
  },
  {}
);
const getTemplateCardTone = (category) => {
  const normalized = String(category || "")
    .trim()
    .toLowerCase();
  if (normalized.includes("financial")) return "financial";
  if (normalized.includes("governance")) return "governance";
  if (normalized.includes("planning")) return "planning";
  if (normalized.includes("report")) return "reporting";
  return "default";
};
const getTemplateCardIcon = (category) => {
  const tone = getTemplateCardTone(category);
  if (tone === "financial") return "wallet";
  if (tone === "governance") return "shield";
  if (tone === "planning") return "layers";
  if (tone === "reporting") return "newspaper";
  return "notes";
};
const getTemplateFormatTone = (format) => {
  const normalized = String(format || "")
    .trim()
    .toLowerCase();
  if (!normalized) return "default";
  if (normalized.includes("docx") || normalized.includes("word")) return "docx";
  if (normalized.includes("excel")) return "excel";
  if (normalized.includes("powerpoint") || normalized.includes("ppt")) return "powerpoint";
  if (normalized.includes("pdf")) return "pdf";
  return "default";
};
const MEMBER_IMPORT_EXPORT_COLUMNS = [
  "name",
  "phone_number",
  "email",
  "role",
  "status",
  "join_date",
  "bio",
  "gender",
  "occupation",
  "national_id",
  "county",
  "sub_county",
  "address",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "avatar_url",
];
const MEMBER_IMPORT_TEMPLATE_ROW = {
  name: "Jane Doe",
  phone_number: "+254700000000",
  email: "jane@example.com",
  role: "member",
  status: "active",
  join_date: "2026-01-15",
  bio: "Community mobilizer and savings champion.",
  gender: "female",
  occupation: "Farmer",
  national_id: "12345678",
  county: "Nairobi",
  sub_county: "Kasarani",
  address: "Kasarani, Nairobi",
  emergency_contact_name: "John Doe",
  emergency_contact_phone: "+254711111111",
  emergency_contact_relationship: "Spouse",
  avatar_url: "",
};
const MEMBER_IMPORT_ALIASES = {
  name: ["name", "full_name", "full_names", "fullname"],
  phone_number: ["phone_number", "phone", "telephone", "tel", "mobile"],
  email: ["email", "email_address", "mail"],
  role: ["role"],
  status: ["status"],
  join_date: ["join_date", "joined_date", "date_joined"],
  bio: ["bio", "member_bio"],
  gender: ["gender", "sex"],
  occupation: ["occupation", "job", "profession"],
  national_id: ["national_id", "id_number", "nationalid"],
  county: ["county"],
  sub_county: ["sub_county", "subcounty", "sub_county_name"],
  address: ["address"],
  emergency_contact_name: [
    "emergency_contact_name",
    "emergency_name",
    "next_of_kin_name",
    "next_of_kin",
  ],
  emergency_contact_phone: [
    "emergency_contact_phone",
    "emergency_phone",
    "next_of_kin_phone",
  ],
  emergency_contact_relationship: [
    "emergency_contact_relationship",
    "emergency_relationship",
    "next_of_kin_relationship",
  ],
  avatar_url: ["avatar_url", "photo_url", "image_url"],
};

const normalizeOptional = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const normalizeDateInputValue = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  return text.slice(0, 10);
};

const normalizeCsvHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => String(value || "").trim());
};

const parseCsvText = (csvText) => {
  const normalizedText = String(csvText || "")
    .replace(/\ufeff/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalizedText) {
    throw new Error("The CSV file is empty.");
  }

  const lines = normalizedText.split("\n").filter((line) => String(line || "").trim());
  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => normalizeCsvHeader(header));
  if (!headers.some(Boolean)) {
    throw new Error("CSV header row is invalid.");
  }

  const rows = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex]);
    if (!cells.some((cell) => String(cell || "").trim())) {
      continue;
    }
    const row = {};
    headers.forEach((header, columnIndex) => {
      if (!header) return;
      row[header] = String(cells[columnIndex] || "").trim();
    });
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error("CSV has no valid data rows.");
  }
  return rows;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const isDuplicateDatabaseError = (error) => {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "23505" ||
    message.includes("duplicate") ||
    message.includes("already exists") ||
    message.includes("unique")
  );
};

const toFilenameSlug = (value) => {
  const base = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "organization";
};

const toPdfAscii = (value) =>
  String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapePdfText = (value) =>
  toPdfAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const wrapPdfLine = (value, maxChars = 92) => {
  const text = toPdfAscii(value);
  if (!text) return [""];
  const words = text.split(" ");
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if (!word) return;
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    if (word.length <= maxChars) {
      current = word;
      return;
    }
    let remaining = word;
    while (remaining.length > maxChars) {
      lines.push(`${remaining.slice(0, maxChars - 1)}-`);
      remaining = remaining.slice(maxChars - 1);
    }
    current = remaining;
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

const buildSimplePdfBlob = (title, lines = []) => {
  const safeTitle = escapePdfText(title || "Document");
  const streamCommands = ["BT", "/F1 16 Tf", "50 800 Td", `(${safeTitle}) Tj`, "ET"];
  let y = 776;
  const lineHeight = 14;
  const normalizedLines = Array.isArray(lines) ? lines.slice(0, 46) : [];
  normalizedLines.forEach((line) => {
    const safeLine = escapePdfText(line);
    streamCommands.push("BT");
    streamCommands.push("/F1 10 Tf");
    streamCommands.push(`1 0 0 1 50 ${y} Tm`);
    streamCommands.push(`(${safeLine}) Tj`);
    streamCommands.push("ET");
    y -= lineHeight;
  });

  const stream = streamCommands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  const encoder = new TextEncoder();
  const byteLength = (text) => encoder.encode(text).length;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(byteLength(pdf));
    pdf += `${object}\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
};

const appendWrappedPdfLine = (collector, text = "") => {
  if (!Array.isArray(collector)) return;
  if (!text) {
    collector.push("");
    return;
  }
  wrapPdfLine(text).forEach((line) => collector.push(line));
};

const safeObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const getOrganizationProfile = (siteData) => {
  const safeSiteData = safeObject(siteData);
  const profile = safeObject(safeSiteData.organization_profile);
  return profile;
};

const getOrganizationPartners = (siteData) => {
  const profile = getOrganizationProfile(siteData);
  const source = Array.isArray(profile.partners) ? profile.partners : [];
  return source
    .map((partner, index) => {
      const row = safeObject(partner);
      const fallbackId = `partner-${index + 1}`;
      const id = String(row.id || fallbackId);
      const rawLinkedProjects = Array.isArray(row.linked_project_ids)
        ? row.linked_project_ids
        : Array.isArray(row.linked_projects)
          ? row.linked_projects
          : [];
      const linkedProjectIds = rawLinkedProjects
        .map((projectRef) => {
          if (projectRef && typeof projectRef === "object") {
            const objectRef = safeObject(projectRef);
            return (
              String(objectRef.id || "").trim() ||
              String(objectRef.project_id || "").trim() ||
              String(objectRef.projectId || "").trim()
            );
          }
          return String(projectRef || "").trim();
        })
        .filter(Boolean);
      return {
        id,
        name: String(row.name || "").trim(),
        kind: String(row.kind || "Partner").trim() || "Partner",
        status: String(row.status || "Active").trim() || "Active",
        contact_person: String(row.contact_person || "").trim(),
        contact_email: String(row.contact_email || "").trim(),
        contact_phone: String(row.contact_phone || "").trim(),
        last_contact: normalizeDateInputValue(row.last_contact),
        notes: String(row.notes || "").trim(),
        logo_url: String(row.logo_url || row.logo || "").trim(),
        linked_project_ids: Array.from(new Set(linkedProjectIds)),
      };
    })
    .filter((row) => row.name);
};

const buildSiteDataWithProfilePatch = (siteData, profilePatch) => {
  const baseSiteData = safeObject(siteData);
  const baseProfile = getOrganizationProfile(baseSiteData);
  return {
    ...baseSiteData,
    organization_profile: {
      ...baseProfile,
      ...profilePatch,
    },
  };
};

const createOrganizationForm = (tenantRecord) => {
  const profile = getOrganizationProfile(tenantRecord?.site_data);
  return {
    name: String(tenantRecord?.name || "").trim(),
    tagline: String(tenantRecord?.tagline || "").trim(),
    contact_email: String(tenantRecord?.contact_email || "").trim(),
    contact_phone: String(tenantRecord?.contact_phone || "").trim(),
    location: String(tenantRecord?.location || "").trim(),
    registration_number: String(profile.registration_number || "").trim(),
    website: String(profile.website || "").trim(),
    mission: String(profile.mission || "").trim(),
    vision: String(profile.vision || "").trim(),
    is_public: Boolean(tenantRecord?.is_public ?? true),
  };
};

const createPartnerForm = () => ({
  name: "",
  kind: "Partner",
  status: "Active",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  last_contact: "",
  logo_url: "",
  linked_project_ids: [],
  notes: "",
});

const createMemberForm = (member = null) => ({
  name: String(member?.name || "").trim(),
  email: String(member?.email || "").trim(),
  phone_number: String(member?.phone_number || "").trim(),
  role: String(member?.role || "member").trim() || "member",
  status: String(member?.status || "active").trim() || "active",
  join_date: normalizeDateInputValue(member?.join_date) || new Date().toISOString().slice(0, 10),
  avatar_url: String(member?.avatar_url || "").trim(),
  bio: String(member?.bio || "").trim(),
  gender: String(member?.gender || "").trim(),
  occupation: String(member?.occupation || "").trim(),
  national_id: String(member?.national_id || "").trim(),
  county: String(member?.county || "").trim(),
  sub_county: String(member?.sub_county || "").trim(),
  address: String(member?.address || "").trim(),
  emergency_contact_name: String(member?.emergency_contact_name || "").trim(),
  emergency_contact_phone: String(member?.emergency_contact_phone || "").trim(),
  emergency_contact_relationship: String(member?.emergency_contact_relationship || "").trim(),
});

const toDateInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const toDateTimeLocalInputValue = (value) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const normalizeActivityStatusKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

const createActivityForm = (activity = null) => ({
  title: String(activity?.title || activity?.agenda || activity?.type || "").trim(),
  type: String(activity?.type || ACTIVITY_TYPE_OPTIONS[0]).trim() || ACTIVITY_TYPE_OPTIONS[0],
  status: normalizeActivityStatusKey(activity?.status) || "scheduled",
  date:
    normalizeDateInputValue(activity?.date || activity?.meeting_date) ||
    new Date().toISOString().slice(0, 10),
  startAt: toDateTimeLocalInputValue(activity?.start_at),
  endAt: toDateTimeLocalInputValue(activity?.end_at),
  location: String(activity?.location || "").trim(),
  projectId: activity?.project_id ? String(activity.project_id) : "",
  ownerMemberId: activity?.owner_member_id ? String(activity.owner_member_id) : "",
  attendeeMemberIds: Array.from(
    new Set(
      (Array.isArray(activity?.attendees) ? activity.attendees : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ),
  agenda: String(activity?.agenda || "").trim(),
  description: String(activity?.description || activity?.notes || "").trim(),
  minutes: String(activity?.minutes || "").trim(),
});

const formatDate = (value) => {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getMeetingTitle = (meeting) => {
  return (
    String(meeting?.title || "").trim() ||
    String(meeting?.agenda || "").trim() ||
    String(meeting?.subject || "").trim() ||
    String(meeting?.type || "").trim() ||
    "Meeting"
  );
};

const getMeetingStatus = (meeting) => {
  const explicitStatusKey = normalizeActivityStatusKey(meeting?.status);
  if (explicitStatusKey) {
    if (explicitStatusKey === "inprogress") return "In Progress";
    return toDisplayLabel(explicitStatusKey, "Scheduled");
  }
  const meetingDate = Date.parse(String(meeting?.date || meeting?.meeting_date || ""));
  if (!Number.isFinite(meetingDate)) return "Scheduled";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetingDay = new Date(meetingDate);
  meetingDay.setHours(0, 0, 0, 0);
  if (meetingDay.getTime() === today.getTime()) return "Today";
  return meetingDay.getTime() < today.getTime() ? "Completed" : "Upcoming";
};

const getDocumentName = (document) => {
  return (
    String(document?.name || "").trim() ||
    String(document?.title || "").trim() ||
    String(document?.file_name || "").trim() ||
    "Untitled document"
  );
};

const getDocumentType = (document) => {
  return (
    String(document?.type || "").trim() ||
    String(document?.category || "").trim() ||
    String(document?.mime_type || "").split("/")[1] ||
    "File"
  );
};

const getMemberAvatarUrl = (member) => {
  return String(member?.avatar_url || member?.photo_url || member?.image_url || "").trim();
};

const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const formatPercentLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${Math.round(clampPercent(parsed))}%`;
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(parsed);
};

const toDisplayLabel = (value, fallback = "Unknown") => {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ");
  if (!normalized) return fallback;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

function OrganizationPage({ user, tenantId, tenant, onTenantUpdated, setActivePage }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);

  const [tenantRecord, setTenantRecord] = useState(tenant || null);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [organizationTemplates, setOrganizationTemplates] = useState([]);

  const [memberSearch, setMemberSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const [meetingStatusFilter, setMeetingStatusFilter] = useState("all");
  const [meetingTypeFilter, setMeetingTypeFilter] = useState("all");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [templateView, setTemplateView] = useState("table");
  const [organizationOverviewRange, setOrganizationOverviewRange] = useState(
    DEFAULT_ORGANIZATION_OVERVIEW_RANGE
  );
  const [templatesError, setTemplatesError] = useState("");

  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState([]);
  const [documentMode, setDocumentMode] = useState("upload");
  const [emitOrganizationDocumentType, setEmitOrganizationDocumentType] = useState(
    ORGANIZATION_EMIT_DOCUMENT_OPTIONS[0].value
  );
  const [uploadingOrganizationDocument, setUploadingOrganizationDocument] = useState(false);
  const [deletingOrganizationDocuments, setDeletingOrganizationDocuments] = useState(false);
  const [emittingOrganizationDocument, setEmittingOrganizationDocument] = useState(false);
  const [organizationDocumentsError, setOrganizationDocumentsError] = useState("");
  const [showDeleteDocumentsModal, setShowDeleteDocumentsModal] = useState(false);
  const [showRenameDocumentModal, setShowRenameDocumentModal] = useState(false);
  const [renamingOrganizationDocument, setRenamingOrganizationDocument] = useState(false);
  const [organizationDocumentRenameValue, setOrganizationDocumentRenameValue] = useState("");
  const [organizationDocumentRenameError, setOrganizationDocumentRenameError] = useState("");

  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgForm, setOrgForm] = useState(() => createOrganizationForm(tenant));
  const [orgFormError, setOrgFormError] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showMemberEditorModal, setShowMemberEditorModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState("");
  const [memberForm, setMemberForm] = useState(() => createMemberForm());
  const [memberFormStep, setMemberFormStep] = useState(1);
  const [memberFormError, setMemberFormError] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [importingMembers, setImportingMembers] = useState(false);
  const [uploadingMemberAvatar, setUploadingMemberAvatar] = useState(false);

  // Choice modal for Add vs Invite
  const [showChoiceModal, setShowChoiceModal] = useState(false);

  // Invite modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone_number: "",
    role: "member",
    notes: "",
  });
  const [responseData, setResponseData] = useState({
    type: "success",
    title: "",
    message: "",
    code: null,
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showMeetingEditorModal, setShowMeetingEditorModal] = useState(false);
  const [showDeleteMeetingsModal, setShowDeleteMeetingsModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState("");
  const [meetingForm, setMeetingForm] = useState(() => createActivityForm());
  const [meetingFormError, setMeetingFormError] = useState("");
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [deletingMeetings, setDeletingMeetings] = useState(false);

  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState("");
  const [partnerForm, setPartnerForm] = useState(() => createPartnerForm());
  const [partnerFormStep, setPartnerFormStep] = useState(1);
  const [partnerLogoUploadName, setPartnerLogoUploadName] = useState("");
  const [partnerFormError, setPartnerFormError] = useState("");
  const [savingPartner, setSavingPartner] = useState(false);
  const [showDeletePartnerModal, setShowDeletePartnerModal] = useState(false);
  const memberAvatarInputRef = useRef(null);
  const memberImportInputRef = useRef(null);
  const organizationDocumentInputRef = useRef(null);
  const partnerLogoInputRef = useRef(null);

  useEffect(() => {
    if (!tenant) return;
    setTenantRecord(tenant);
  }, [tenant]);

  const loadWorkspace = useCallback(
    async ({ silent = false } = {}) => {
      if (!tenantId) {
        setTenantRecord(null);
        setMembers([]);
        setProjects([]);
        setDocuments([]);
        setMeetings([]);
        setOrganizationTemplates([]);
        setLoadError("Tenant context is missing. Open this workspace from a tenant dashboard.");
        setLoading(false);
        return;
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadError("");
      setOrganizationDocumentsError("");
      setTemplatesError("");

      const [tenantResult, membersResult, projectsResult, documentsResult, meetingsResult, templatesResult] =
        await Promise.allSettled([
          getTenantById(tenantId),
          getMembersAdmin(tenantId),
          getProjectsWithMembership(user?.id, tenantId),
          getDocuments(tenantId),
          getMeetings(tenantId),
          getOrganizationTemplates(tenantId),
        ]);

      const errors = [];

      if (tenantResult.status === "fulfilled") {
        if (tenantResult.value) {
          setTenantRecord(tenantResult.value);
          setOrgForm(createOrganizationForm(tenantResult.value));
        }
      } else {
        errors.push("Failed to load organization profile.");
        console.error("Organization profile load error:", tenantResult.reason);
      }

      if (membersResult.status === "fulfilled") {
        setMembers(Array.isArray(membersResult.value) ? membersResult.value : []);
      } else {
        setMembers([]);
        errors.push("Failed to load members.");
        console.error("Organization members load error:", membersResult.reason);
      }

      if (projectsResult.status === "fulfilled") {
        setProjects(Array.isArray(projectsResult.value) ? projectsResult.value : []);
      } else {
        setProjects([]);
        errors.push("Failed to load projects.");
        console.error("Organization projects load error:", projectsResult.reason);
      }

      if (documentsResult.status === "fulfilled") {
        setDocuments(Array.isArray(documentsResult.value) ? documentsResult.value : []);
      } else {
        setDocuments([]);
        errors.push("Failed to load documents.");
        console.error("Organization documents load error:", documentsResult.reason);
      }

      if (meetingsResult.status === "fulfilled") {
        setMeetings(Array.isArray(meetingsResult.value) ? meetingsResult.value : []);
      } else {
        setMeetings([]);
        errors.push("Failed to load activities.");
        console.error("Organization activities load error:", meetingsResult.reason);
      }

      if (templatesResult.status === "fulfilled") {
        setOrganizationTemplates(Array.isArray(templatesResult.value) ? templatesResult.value : []);
      } else {
        setOrganizationTemplates([]);
        errors.push("Failed to load templates.");
        const message = templatesResult.reason?.message || "Failed to load templates.";
        setTemplatesError(message);
        console.error("Organization templates load error:", templatesResult.reason);
      }

      setLoadError(errors.join(" "));

      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    },
    [tenantId, user?.id]
  );

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const partners = useMemo(
    () => getOrganizationPartners(tenantRecord?.site_data),
    [tenantRecord?.site_data]
  );

  useEffect(() => {
    const allowedPartnerIds = new Set(partners.map((partner) => partner.id));
    setSelectedPartnerIds((prev) => prev.filter((id) => allowedPartnerIds.has(id)));
  }, [partners]);

  const orgStats = useMemo(() => {
    const activeMembers = members.filter(
      (member) => String(member?.status || "active").trim().toLowerCase() === "active"
    ).length;
    const activeProjects = projects.filter((project) => {
      const status = String(project?.status || "").trim().toLowerCase();
      return status === "active" || status === "planning";
    }).length;
    const visibleProjects = projects.filter((project) => project?.is_visible !== false).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let upcomingMeetings = 0;
    let completedMeetings = 0;
    meetings.forEach((meeting) => {
      const explicitStatus = String(getMeetingStatus(meeting)).trim().toLowerCase();
      if (explicitStatus === "completed") {
        completedMeetings += 1;
        return;
      }
      const meetingDate = Date.parse(String(meeting?.date || meeting?.meeting_date || ""));
      if (Number.isFinite(meetingDate)) {
        const meetingDay = new Date(meetingDate);
        meetingDay.setHours(0, 0, 0, 0);
        if (meetingDay.getTime() >= today.getTime()) {
          upcomingMeetings += 1;
        } else {
          completedMeetings += 1;
        }
        return;
      }
      upcomingMeetings += 1;
    });

    return {
      totalMembers: members.length,
      activeMembers,
      totalProjects: projects.length,
      activeProjects,
      visibleProjects,
      totalDocuments: documents.length,
      totalMeetings: meetings.length,
      upcomingMeetings,
      completedMeetings,
      totalPartners: partners.length,
    };
  }, [members, projects, documents, meetings, partners]);

  const organizationOverviewAnalytics = useMemo(() => {
    const totalMembers = orgStats.totalMembers;
    const activeMembers = orgStats.activeMembers;
    const inactiveMembers = Math.max(0, totalMembers - activeMembers);
    const totalProjects = orgStats.totalProjects;
    const activeProjects = orgStats.activeProjects;
    const totalDocuments = orgStats.totalDocuments;
    const totalPartners = orgStats.totalPartners;
    const totalMeetings = orgStats.totalMeetings;
    const completedMeetings = orgStats.completedMeetings;
    const upcomingMeetings = orgStats.upcomingMeetings;

    const activeMemberPercent = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
    const activeProjectPercent = totalProjects > 0 ? (activeProjects / totalProjects) * 100 : 0;
    const meetingCompletionPercent =
      totalMeetings > 0 ? (completedMeetings / totalMeetings) * 100 : 0;

    const totalBudgetPipeline = projects.reduce((sum, project) => {
      const amount = Number(project?.budget_total);
      if (!Number.isFinite(amount) || amount < 0) return sum;
      return sum + amount;
    }, 0);
    const totalExpectedRevenue = projects.reduce((sum, project) => {
      const amount = Number(project?.expected_revenue);
      if (!Number.isFinite(amount) || amount < 0) return sum;
      return sum + amount;
    }, 0);

    const projectStatusCounts = new Map();
    projects.forEach((project) => {
      const statusKey =
        String(project?.status || "")
          .trim()
          .toLowerCase() || "unknown";
      projectStatusCounts.set(statusKey, (projectStatusCounts.get(statusKey) || 0) + 1);
    });

    const projectStatusMix = Array.from(projectStatusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([status, count]) => ({
        status,
        label: toDisplayLabel(status),
        count,
        percent: totalProjects > 0 ? (count / totalProjects) * 100 : 0,
      }));
    const projectStatusMixMax = projectStatusMix.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item?.count) || 0),
      0
    );

    const selectedRange =
      ORGANIZATION_OVERVIEW_RANGE_LOOKUP[organizationOverviewRange] ||
      ORGANIZATION_OVERVIEW_RANGE_LOOKUP[DEFAULT_ORGANIZATION_OVERVIEW_RANGE];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const nowTimestamp = now.getTime();
    const oneDayMilliseconds = 24 * 60 * 60 * 1000;
    const formatDayKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    const trendBuckets = [];
    const trendBucketIndex = new Map();
    let rangeStartTimestamp = 0;

    if (selectedRange.value === "30d") {
      const dayCount = 30;
      const endDay = new Date(now);
      endDay.setHours(0, 0, 0, 0);
      const startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - (dayCount - 1));
      rangeStartTimestamp = startDay.getTime();

      for (let index = 0; index < dayCount; index += 1) {
        const bucketDate = new Date(startDay);
        bucketDate.setDate(startDay.getDate() + index);
        const key = formatDayKey(bucketDate);
        trendBucketIndex.set(key, trendBuckets.length);
        trendBuckets.push({
          key,
          label: bucketDate.toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
          count: 0,
        });
      }
    } else if (selectedRange.value === "90d") {
      const weekCount = 13;
      const endDay = new Date(now);
      endDay.setHours(0, 0, 0, 0);
      const startDay = new Date(endDay);
      startDay.setDate(startDay.getDate() - (weekCount * 7 - 1));
      rangeStartTimestamp = startDay.getTime();

      for (let index = 0; index < weekCount; index += 1) {
        const bucketStart = new Date(startDay);
        bucketStart.setDate(startDay.getDate() + index * 7);
        const key = formatDayKey(bucketStart);
        trendBucketIndex.set(key, trendBuckets.length);
        trendBuckets.push({
          key,
          label: bucketStart.toLocaleDateString("en-KE", { month: "short", day: "numeric" }),
          count: 0,
        });
      }
    } else {
      const monthCount = 12;
      const baseMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - (monthCount - 1), 1);
      rangeStartTimestamp = startMonth.getTime();

      for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
        const bucketDate = new Date(baseMonth.getFullYear(), baseMonth.getMonth() - offset, 1);
        const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
        trendBucketIndex.set(key, trendBuckets.length);
        trendBuckets.push({
          key,
          label: bucketDate.toLocaleDateString("en-KE", { month: "short" }),
          count: 0,
        });
      }
    }

    let rangeDocumentCount = 0;
    let rangeMeetingCount = 0;
    let rangeMemberJoinCount = 0;

    const registerTrendRecord = (timestamp, source) => {
      if (!Number.isFinite(timestamp)) return;
      if (timestamp < rangeStartTimestamp || timestamp > nowTimestamp) return;

      if (source === "documents") rangeDocumentCount += 1;
      if (source === "meetings") rangeMeetingCount += 1;
      if (source === "members") rangeMemberJoinCount += 1;

      const recordDate = new Date(timestamp);
      if (selectedRange.value === "12m") {
        const key = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, "0")}`;
        const bucketPosition = trendBucketIndex.get(key);
        if (bucketPosition === undefined) return;
        trendBuckets[bucketPosition].count += 1;
        return;
      }

      recordDate.setHours(0, 0, 0, 0);
      if (selectedRange.value === "30d") {
        const key = formatDayKey(recordDate);
        const bucketPosition = trendBucketIndex.get(key);
        if (bucketPosition === undefined) return;
        trendBuckets[bucketPosition].count += 1;
        return;
      }

      const dayOffset = Math.floor((recordDate.getTime() - rangeStartTimestamp) / oneDayMilliseconds);
      if (dayOffset < 0) return;
      const bucketPosition = Math.floor(dayOffset / 7);
      if (bucketPosition < 0 || bucketPosition >= trendBuckets.length) return;
      trendBuckets[bucketPosition].count += 1;
    };

    documents.forEach((document) => {
      const timestamp = Date.parse(String(document?.uploaded_at || document?.created_at || ""));
      registerTrendRecord(timestamp, "documents");
    });

    meetings.forEach((meeting) => {
      const timestamp = Date.parse(
        String(meeting?.date || meeting?.meeting_date || meeting?.created_at || "")
      );
      registerTrendRecord(timestamp, "meetings");
    });

    members.forEach((member) => {
      const timestamp = Date.parse(String(member?.join_date || member?.created_at || ""));
      registerTrendRecord(timestamp, "members");
    });

    const trendMaxCount = trendBuckets.reduce(
      (maxCount, bucket) => Math.max(maxCount, Number(bucket?.count) || 0),
      0
    );
    const trendCurrentCount = Number(trendBuckets[trendBuckets.length - 1]?.count || 0);
    const trendPreviousCount = Number(trendBuckets[trendBuckets.length - 2]?.count || 0);
    const trendDeltaPercent =
      trendPreviousCount > 0
        ? ((trendCurrentCount - trendPreviousCount) / trendPreviousCount) * 100
        : trendCurrentCount > 0
          ? 100
          : 0;

    const ringCircumference = 2 * Math.PI * 34;
    const normalizedMemberPercent = clampPercent(activeMemberPercent);
    const normalizedMeetingPercent = clampPercent(meetingCompletionPercent);
    const normalizedProjectPercent = clampPercent(activeProjectPercent);

    return {
      activeMemberPercent: normalizedMemberPercent,
      activeProjectPercent: normalizedProjectPercent,
      meetingCompletionPercent: normalizedMeetingPercent,
      inactiveMembers,
      totalBudgetPipeline,
      totalExpectedRevenue,
      projectStatusMix,
      projectStatusMixMax,
      trendWindowLabel: selectedRange.windowLabel,
      trendDeltaLabel: selectedRange.deltaLabel,
      trendBuckets,
      trendMaxCount,
      trendDeltaPercent,
      rangeDocumentCount,
      rangeMeetingCount,
      rangeMemberJoinCount,
      ringCircumference,
      memberRingDash: (normalizedMemberPercent / 100) * ringCircumference,
      meetingRingDash: (normalizedMeetingPercent / 100) * ringCircumference,
    };
  }, [orgStats, projects, documents, meetings, members, organizationOverviewRange]);

  const partnerProjectOptions = useMemo(() => {
    return projects
      .map((project, index) => {
        const id = String(project?.id || "").trim();
        if (!id) return null;
        const name = String(project?.name || "").trim() || `Project ${index + 1}`;
        return { id, name };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const partnerProjectNameById = useMemo(() => {
    const lookup = new Map();
    partnerProjectOptions.forEach((project) => {
      lookup.set(project.id, project.name);
    });
    return lookup;
  }, [partnerProjectOptions]);

  const memberNameById = useMemo(() => {
    const lookup = new Map();
    members.forEach((member) => {
      const memberId = String(member?.id || "").trim();
      if (!memberId) return;
      const name = String(member?.name || "").trim() || `Member #${memberId}`;
      lookup.set(memberId, name);
    });
    return lookup;
  }, [members]);

  const getPartnerLinkedProjectNames = useCallback(
    (partner) => {
      const linkedIds = Array.isArray(partner?.linked_project_ids) ? partner.linked_project_ids : [];
      return linkedIds
        .map((projectId) => partnerProjectNameById.get(String(projectId || "").trim()) || "")
        .filter(Boolean);
    },
    [partnerProjectNameById]
  );

  const memberRows = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const text = [
        member?.name,
        member?.email,
        member?.phone_number,
        member?.role,
        member?.bio,
        member?.occupation,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return text.includes(query);
    });
  }, [members, memberSearch]);

  const documentRows = useMemo(() => {
    const query = documentSearch.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter((doc) => {
      const text = [getDocumentName(doc), getDocumentType(doc), doc?.uploaded_by]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return text.includes(query);
    });
  }, [documents, documentSearch]);

  const meetingTypeOptions = useMemo(() => {
    const options = new Set(ACTIVITY_TYPE_OPTIONS);
    meetings.forEach((meeting) => {
      const type = String(meeting?.type || "").trim();
      if (type) options.add(type);
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [meetings]);

  const meetingRows = useMemo(() => {
    const query = meetingSearch.trim().toLowerCase();
    return meetings
      .filter((meeting) => {
        if (meetingStatusFilter !== "all") {
          const normalizedStatus = normalizeActivityStatusKey(getMeetingStatus(meeting));
          if (normalizedStatus !== normalizeActivityStatusKey(meetingStatusFilter)) {
            return false;
          }
        }
        if (meetingTypeFilter !== "all") {
          const normalizedType = String(meeting?.type || "")
            .trim()
            .toLowerCase();
          if (normalizedType !== String(meetingTypeFilter || "").trim().toLowerCase()) {
            return false;
          }
        }
        if (!query) return true;
        const text = [
          getMeetingTitle(meeting),
          meeting?.type,
          meeting?.agenda,
          meeting?.status,
          meeting?.location,
          meeting?.description,
          meeting?.notes,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return text.includes(query);
      })
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.start_at || a?.date || a?.meeting_date || a?.created_at || ""));
        const bTime = Date.parse(String(b?.start_at || b?.date || b?.meeting_date || b?.created_at || ""));
        const safeA = Number.isFinite(aTime) ? aTime : 0;
        const safeB = Number.isFinite(bTime) ? bTime : 0;
        return safeB - safeA;
      });
  }, [meetings, meetingSearch, meetingStatusFilter, meetingTypeFilter]);

  const partnerRows = useMemo(() => {
    const query = partnerSearch.trim().toLowerCase();
    if (!query) return partners;
    return partners.filter((partner) => {
      const linkedProjectsText = getPartnerLinkedProjectNames(partner).join(" ");
      const text = [
        partner.name,
        partner.kind,
        partner.status,
        partner.contact_person,
        partner.contact_email,
        partner.contact_phone,
        linkedProjectsText,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return text.includes(query);
    });
  }, [partners, partnerSearch, getPartnerLinkedProjectNames]);

  const memberRowIds = useMemo(
    () => memberRows.map((member) => String(member?.id || "")).filter(Boolean),
    [memberRows]
  );
  const documentRowIds = useMemo(
    () => documentRows.map((doc) => String(doc?.id || "")).filter(Boolean),
    [documentRows]
  );
  const meetingRowIds = useMemo(
    () => meetingRows.map((meeting) => String(meeting?.id || "")).filter(Boolean),
    [meetingRows]
  );
  const partnerRowIds = useMemo(
    () => partnerRows.map((partner) => String(partner?.id || "")).filter(Boolean),
    [partnerRows]
  );

  useEffect(() => {
    const visible = new Set(memberRowIds);
    setSelectedMemberIds((prev) => prev.filter((id) => visible.has(id)));
  }, [memberRowIds]);

  useEffect(() => {
    const visible = new Set(documentRowIds);
    setSelectedDocumentIds((prev) => prev.filter((id) => visible.has(id)));
  }, [documentRowIds]);

  useEffect(() => {
    const visible = new Set(meetingRowIds);
    setSelectedMeetingIds((prev) => prev.filter((id) => visible.has(id)));
  }, [meetingRowIds]);

  useEffect(() => {
    const visible = new Set(partnerRowIds);
    setSelectedPartnerIds((prev) => prev.filter((id) => visible.has(id)));
  }, [partnerRowIds]);

  const selectedMember = useMemo(() => {
    if (selectedMemberIds.length !== 1) return null;
    return members.find((member) => String(member?.id || "") === selectedMemberIds[0]) || null;
  }, [members, selectedMemberIds]);

  const selectedMeeting = useMemo(() => {
    if (selectedMeetingIds.length !== 1) return null;
    return meetings.find((meeting) => String(meeting?.id || "") === selectedMeetingIds[0]) || null;
  }, [meetings, selectedMeetingIds]);

  const selectedMeetings = useMemo(() => {
    const selected = new Set(selectedMeetingIds.map((id) => String(id)));
    return meetingRows.filter((meeting) => selected.has(String(meeting?.id || "")));
  }, [meetingRows, selectedMeetingIds]);

  const selectedDocument = useMemo(() => {
    if (selectedDocumentIds.length !== 1) return null;
    return documents.find((document) => String(document?.id || "") === selectedDocumentIds[0]) || null;
  }, [documents, selectedDocumentIds]);

  const selectedDocuments = useMemo(() => {
    const selectedSet = new Set(selectedDocumentIds.map((id) => String(id)));
    return documentRows.filter((document) => selectedSet.has(String(document?.id || "")));
  }, [documentRows, selectedDocumentIds]);

  useEffect(() => {
    if (!showDeleteDocumentsModal) return;
    if (selectedDocuments.length > 0) return;
    setShowDeleteDocumentsModal(false);
  }, [showDeleteDocumentsModal, selectedDocuments.length]);

  useEffect(() => {
    if (!showRenameDocumentModal) return;
    if (selectedDocumentIds.length === 1) return;
    setShowRenameDocumentModal(false);
  }, [showRenameDocumentModal, selectedDocumentIds.length]);

  useEffect(() => {
    if (!showDeleteMeetingsModal) return;
    if (selectedMeetings.length > 0) return;
    setShowDeleteMeetingsModal(false);
  }, [showDeleteMeetingsModal, selectedMeetings.length]);

  const selectedPartners = useMemo(() => {
    const selected = new Set(selectedPartnerIds);
    return partners.filter((partner) => selected.has(partner.id));
  }, [partners, selectedPartnerIds]);

  const toggleSelectAll = (rowIds, selectedIds, setSelectedIds) => {
    const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(rowIds);
  };

  const toggleSelection = (id, setSelectedIds) => {
    if (!id) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const triggerMemberImportPicker = () => {
    if (savingMember || importingMembers) return;
    memberImportInputRef.current?.click();
  };

  const downloadMemberImportTemplate = () => {
    const header = MEMBER_IMPORT_EXPORT_COLUMNS.join(",");
    const sampleRow = MEMBER_IMPORT_EXPORT_COLUMNS.map((column) =>
      escapeCsvValue(MEMBER_IMPORT_TEMPLATE_ROW[column] ?? "")
    ).join(",");
    const csv = [header, sampleRow].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "members-import-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setNotice({
      type: "success",
      message: "Downloaded members import template.",
    });
  };

  const exportMembersCsv = () => {
    const selected = new Set(selectedMemberIds);
    const rowsToExport = selected.size
      ? members.filter((member) => selected.has(String(member?.id || "")))
      : memberRows;

    if (!rowsToExport.length) {
      setNotice({ type: "error", message: "No members available to export." });
      return;
    }

    const header = MEMBER_IMPORT_EXPORT_COLUMNS.join(",");
    const csvLines = rowsToExport.map((member) =>
      MEMBER_IMPORT_EXPORT_COLUMNS.map((column) => escapeCsvValue(member?.[column] ?? "")).join(",")
    );
    const csv = [header, ...csvLines].join("\n");

    const fileSafeName =
      String(tenantRecord?.slug || tenantRecord?.name || tenantId || "members")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "members";
    const fileName = `${fileSafeName}-members-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setNotice({
      type: "success",
      message: `Exported ${rowsToExport.length} member${rowsToExport.length === 1 ? "" : "s"} to CSV.`,
    });
  };

  const handleMemberImportFileSelection = async (event) => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (!file) return;
    input.value = "";

    if (!tenantId) {
      setNotice({ type: "error", message: "Tenant context is missing. Cannot import members." });
      return;
    }

    setImportingMembers(true);

    try {
      const csvText = await file.text();
      const parsedRows = parseCsvText(csvText);
      const importedIds = [];
      let createdCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      let failedCount = 0;

      for (let index = 0; index < parsedRows.length; index += 1) {
        const row = parsedRows[index];
        const getValue = (field) => {
          const aliases = MEMBER_IMPORT_ALIASES[field] || [field];
          for (const alias of aliases) {
            const key = normalizeCsvHeader(alias);
            const value = String(row?.[key] || "").trim();
            if (value) {
              return value;
            }
          }
          return "";
        };

        const roleRaw = getValue("role").toLowerCase().replace(/\s+/g, "_");
        const statusRaw = getValue("status").toLowerCase();
        const payload = {
          name: getValue("name"),
          phone_number: getValue("phone_number"),
          email: getValue("email"),
          role: MEMBER_ROLE_OPTIONS.includes(roleRaw) ? roleRaw : "member",
          status: MEMBER_STATUS_OPTIONS.includes(statusRaw) ? statusRaw : "active",
          join_date: normalizeDateInputValue(getValue("join_date")) || new Date().toISOString().slice(0, 10),
          bio: getValue("bio"),
          gender: getValue("gender"),
          occupation: getValue("occupation"),
          national_id: getValue("national_id"),
          county: getValue("county"),
          sub_county: getValue("sub_county"),
          address: getValue("address"),
          emergency_contact_name: getValue("emergency_contact_name"),
          emergency_contact_phone: getValue("emergency_contact_phone"),
          emergency_contact_relationship: getValue("emergency_contact_relationship"),
          avatar_url: getValue("avatar_url"),
        };

        if (!payload.name || !payload.phone_number) {
          invalidCount += 1;
          continue;
        }

        try {
          const savedMember = await createMemberAdmin(payload);
          const createdMemberId = Number.parseInt(String(savedMember?.id || ""), 10);
          if (Number.isInteger(createdMemberId) && createdMemberId > 0) {
            try {
              await createTenantMembership({
                tenantId,
                memberId: createdMemberId,
                role: payload.role || "member",
              });
            } catch (membershipError) {
              if (!isDuplicateDatabaseError(membershipError)) {
                throw new Error(
                  membershipError?.message ||
                    "Member was created but could not be linked to this organization."
                );
              }
            }
          }
          const nextId = String(savedMember?.id || "").trim();
          if (nextId) {
            importedIds.push(nextId);
          }
          createdCount += 1;
        } catch (error) {
          if (isDuplicateDatabaseError(error)) {
            duplicateCount += 1;
            continue;
          }
          failedCount += 1;
          console.error(`Member import row ${index + 2} failed:`, error, row);
        }
      }

      await loadWorkspace({ silent: true });
      if (importedIds.length) {
        setSelectedMemberIds(importedIds);
      }

      if (failedCount > 0) {
        setNotice({
          type: "error",
          message: `Imported ${createdCount}, duplicates ${duplicateCount}, invalid ${invalidCount}, failed ${failedCount}.`,
        });
      } else {
        setNotice({
          type: "success",
          message: `Imported ${createdCount}, duplicates ${duplicateCount}, invalid ${invalidCount}.`,
        });
      }
    } catch (error) {
      console.error("Error importing members:", error);
      setNotice({ type: "error", message: error?.message || "Failed to import members CSV." });
    } finally {
      setImportingMembers(false);
    }
  };

  const getDocumentDownloadUrl = (document) =>
    String(document?.download_url || document?.file_url || "").trim();

  const triggerOrganizationDocumentPicker = () => {
    if (
      uploadingOrganizationDocument ||
      deletingOrganizationDocuments ||
      emittingOrganizationDocument ||
      renamingOrganizationDocument
    ) {
      return;
    }
    organizationDocumentInputRef.current?.click();
  };

  const handleUploadOrganizationDocuments = async (event) => {
    const input = event?.target;
    const files = Array.from(input?.files || []);
    if (!files.length) return;
    if (!tenantId) {
      setOrganizationDocumentsError("Tenant context is missing. Cannot upload documents.");
      if (input) input.value = "";
      return;
    }

    setUploadingOrganizationDocument(true);
    setOrganizationDocumentsError("");

    let successCount = 0;
    let failureCount = 0;
    const uploadedDocuments = [];
    const uploadErrors = [];

    try {
      for (const file of files) {
        try {
          const uploadedDocument = await uploadOrganizationDocument(
            file,
            {
              name: file?.name || "Organization document",
              uploadedByMemberId: user?.id,
              type: "Upload",
            },
            tenantId
          );
          uploadedDocuments.push({
            id: String(uploadedDocument?.id || "").trim(),
            name: String(uploadedDocument?.name || file?.name || "").trim(),
          });
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          uploadErrors.push(error?.message || "Upload failed.");
          console.error("Organization document upload error:", error);
        }
      }

      await loadWorkspace({ silent: true });
      const uploadedIds = uploadedDocuments
        .map((document) => String(document?.id || "").trim())
        .filter(Boolean);
      if (uploadedIds.length > 0) {
        setDocumentSearch("");
        setSelectedDocumentIds(uploadedIds);
      }
      if (uploadedIds.length === 1) {
        const uploadedDocument =
          documents.find((document) => String(document?.id || "").trim() === uploadedIds[0]) ||
          uploadedDocuments[0] ||
          null;
        setOrganizationDocumentRenameValue(String(uploadedDocument?.name || "").trim());
        setOrganizationDocumentRenameError("");
        setShowRenameDocumentModal(true);
      }

      if (failureCount > 0) {
        setNotice({
          type: "warning",
          message: `Uploaded ${successCount} document(s). ${failureCount} document(s) failed.`,
        });
        setOrganizationDocumentsError(uploadErrors.join(" "));
      } else {
        setNotice({
          type: "success",
          message: `${successCount} document(s) uploaded successfully.`,
        });
      }
    } finally {
      if (input) input.value = "";
      setUploadingOrganizationDocument(false);
    }
  };

  const openRenameSelectedOrganizationDocumentModal = () => {
    if (selectedDocumentIds.length !== 1) return;
    const selectedDocument =
      documents.find((document) => String(document?.id || "") === String(selectedDocumentIds[0] || "")) || null;
    setOrganizationDocumentRenameValue(String(selectedDocument?.name || "").trim());
    setOrganizationDocumentRenameError("");
    setShowRenameDocumentModal(true);
  };

  const closeRenameOrganizationDocumentModal = () => {
    if (renamingOrganizationDocument) return;
    setShowRenameDocumentModal(false);
    setOrganizationDocumentRenameValue("");
    setOrganizationDocumentRenameError("");
  };

  const handleConfirmRenameOrganizationDocument = async (event) => {
    event.preventDefault();
    if (selectedDocumentIds.length !== 1) {
      setOrganizationDocumentRenameError("Select one document to rename.");
      return;
    }

    const documentId = String(selectedDocumentIds[0] || "").trim();
    const nextName = String(organizationDocumentRenameValue || "").trim();
    if (!documentId) {
      setOrganizationDocumentRenameError("Document id is missing.");
      return;
    }
    if (!nextName) {
      setOrganizationDocumentRenameError("Document name is required.");
      return;
    }

    setRenamingOrganizationDocument(true);
    setOrganizationDocumentRenameError("");
    setOrganizationDocumentsError("");

    try {
      const updatedDocument = await renameOrganizationDocument(documentId, nextName, tenantId);
      const normalizedDocumentId = String(updatedDocument?.id || documentId);
      setDocuments((prev) =>
        prev.map((document) =>
          String(document?.id || "") === normalizedDocumentId ? { ...document, ...updatedDocument } : document
        )
      );
      setSelectedDocumentIds([normalizedDocumentId]);
      setNotice({ type: "success", message: "Document renamed successfully." });
      setShowRenameDocumentModal(false);
      setOrganizationDocumentRenameValue("");
      setOrganizationDocumentRenameError("");
    } catch (error) {
      console.error("Error renaming organization document:", error);
      setOrganizationDocumentRenameError(error?.message || "Failed to rename document.");
    } finally {
      setRenamingOrganizationDocument(false);
    }
  };

  const buildOrganizationDocumentContext = () => {
    const now = new Date();
    const activeMembers = members.filter(
      (member) => String(member?.status || "").trim().toLowerCase() === "active"
    ).length;
    const completedMeetings = meetings.filter(
      (meeting) => String(getMeetingStatus(meeting)).trim().toLowerCase() === "completed"
    ).length;
    const upcomingMeetings = meetings.filter((meeting) => {
      const normalized = String(getMeetingStatus(meeting)).trim().toLowerCase();
      return normalized === "today" || normalized === "upcoming" || normalized === "scheduled";
    }).length;
    const recentMeetings = [...meetings]
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.date || a?.meeting_date || a?.created_at || ""));
        const bTime = Date.parse(String(b?.date || b?.meeting_date || b?.created_at || ""));
        const safeA = Number.isFinite(aTime) ? aTime : 0;
        const safeB = Number.isFinite(bTime) ? bTime : 0;
        return safeB - safeA;
      })
      .slice(0, 6);
    const recentDocuments = [...documents]
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.uploaded_at || a?.created_at || ""));
        const bTime = Date.parse(String(b?.uploaded_at || b?.created_at || ""));
        const safeA = Number.isFinite(aTime) ? aTime : 0;
        const safeB = Number.isFinite(bTime) ? bTime : 0;
        return safeB - safeA;
      })
      .slice(0, 6);

    return {
      now,
      generatedAt: now.toLocaleString("en-KE"),
      organizationName: String(tenantRecord?.name || "Organization"),
      tagline: String(tenantRecord?.tagline || "").trim() || "—",
      location: String(tenantRecord?.location || "").trim() || "—",
      contactEmail: String(tenantRecord?.contact_email || "").trim() || "—",
      contactPhone: String(tenantRecord?.contact_phone || "").trim() || "—",
      mission: String(getOrganizationProfile(tenantRecord?.site_data)?.mission || "").trim() || "—",
      vision: String(getOrganizationProfile(tenantRecord?.site_data)?.vision || "").trim() || "—",
      totalMembers: members.length,
      activeMembers,
      totalProjects: projects.length,
      activeProjects: orgStats.activeProjects,
      visibleProjects: orgStats.visibleProjects,
      totalDocuments: documents.length,
      totalMeetings: meetings.length,
      upcomingMeetings,
      completedMeetings,
      totalPartners: partners.length,
      recentMeetings,
      recentDocuments,
    };
  };

  const buildGroupProfileLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "GROUP PROFILE");
    appendWrappedPdfLine(lines, `Name: ${context.organizationName}`);
    appendWrappedPdfLine(lines, `Tagline: ${context.tagline}`);
    appendWrappedPdfLine(lines, `Location: ${context.location}`);
    appendWrappedPdfLine(lines, `Contact email: ${context.contactEmail}`);
    appendWrappedPdfLine(lines, `Contact phone: ${context.contactPhone}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "IDENTITY");
    appendWrappedPdfLine(lines, `Mission: ${context.mission}`);
    appendWrappedPdfLine(lines, `Vision: ${context.vision}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "OPERATIONS SNAPSHOT");
    appendWrappedPdfLine(lines, `Members: ${context.totalMembers} (${context.activeMembers} active)`);
    appendWrappedPdfLine(lines, `Projects: ${context.totalProjects} (${context.activeProjects} active)`);
    appendWrappedPdfLine(lines, `Meetings tracked: ${context.totalMeetings}`);
    appendWrappedPdfLine(lines, `Documents archived: ${context.totalDocuments}`);
    appendWrappedPdfLine(lines, `Partners tracked: ${context.totalPartners}`);
    return lines;
  };

  const buildGovernanceBriefLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "GOVERNANCE BRIEF");
    appendWrappedPdfLine(lines, `Organization: ${context.organizationName}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "STRUCTURE");
    appendWrappedPdfLine(lines, `Active members: ${context.activeMembers}`);
    appendWrappedPdfLine(lines, `Partner / donor entities: ${context.totalPartners}`);
    appendWrappedPdfLine(lines, `Visible projects: ${context.visibleProjects}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "ACCOUNTABILITY SIGNALS");
    appendWrappedPdfLine(lines, `Documents available: ${context.totalDocuments}`);
    appendWrappedPdfLine(lines, `Meetings completed: ${context.completedMeetings}`);
    appendWrappedPdfLine(lines, `Meetings upcoming: ${context.upcomingMeetings}`);
    return lines;
  };

  const buildMemberEngagementLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "MEMBER ENGAGEMENT REPORT");
    appendWrappedPdfLine(lines, `Organization: ${context.organizationName}`);
    appendWrappedPdfLine(lines, `Total members: ${context.totalMembers}`);
    appendWrappedPdfLine(lines, `Active members: ${context.activeMembers}`);
    const engagementRate =
      context.totalMembers > 0 ? Math.round((context.activeMembers / context.totalMembers) * 100) : 0;
    appendWrappedPdfLine(lines, `Engagement rate: ${engagementRate}%`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PROGRAM PARTICIPATION");
    appendWrappedPdfLine(lines, `Active projects: ${context.activeProjects}`);
    appendWrappedPdfLine(lines, `Upcoming meeting slots: ${context.upcomingMeetings}`);
    appendWrappedPdfLine(lines, `Completed meeting records: ${context.completedMeetings}`);
    return lines;
  };

  const buildActivityReportLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "ORGANIZATION ACTIVITY REPORT");
    appendWrappedPdfLine(lines, `Organization: ${context.organizationName}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "ACTIVITY COUNTS");
    appendWrappedPdfLine(lines, `Total meetings: ${context.totalMeetings}`);
    appendWrappedPdfLine(lines, `Completed meetings: ${context.completedMeetings}`);
    appendWrappedPdfLine(lines, `Upcoming meetings: ${context.upcomingMeetings}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "LATEST RECORDED ACTIVITIES");
    if (!context.recentMeetings.length) {
      appendWrappedPdfLine(lines, "No meeting records available.");
    } else {
      context.recentMeetings.forEach((meeting, index) => {
        appendWrappedPdfLine(
          lines,
          `${index + 1}. ${getMeetingTitle(meeting)} | ${formatDate(
            meeting?.date || meeting?.meeting_date || meeting?.created_at
          )} | ${getMeetingStatus(meeting)}`
        );
      });
    }
    return lines;
  };

  const buildDonorReadinessLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "DONOR READINESS PACK");
    appendWrappedPdfLine(lines, `Organization: ${context.organizationName}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "CAPACITY INDICATORS");
    appendWrappedPdfLine(lines, `Members enrolled: ${context.totalMembers}`);
    appendWrappedPdfLine(lines, `Active initiatives: ${context.activeProjects}`);
    appendWrappedPdfLine(lines, `Partner network size: ${context.totalPartners}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "EVIDENCE AVAILABILITY");
    appendWrappedPdfLine(lines, `Documents in repository: ${context.totalDocuments}`);
    appendWrappedPdfLine(lines, `Meeting records logged: ${context.totalMeetings}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "CONTACT FOR FOLLOW-UP");
    appendWrappedPdfLine(lines, `Email: ${context.contactEmail}`);
    appendWrappedPdfLine(lines, `Phone: ${context.contactPhone}`);
    return lines;
  };

  const buildOperationsWorkPlanLines = (context) => {
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "OPERATIONS WORK PLAN");
    appendWrappedPdfLine(lines, `Organization: ${context.organizationName}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "FOCUS AREAS");
    appendWrappedPdfLine(lines, `1. Maintain active participation for ${context.activeMembers} members.`);
    appendWrappedPdfLine(lines, `2. Drive delivery across ${context.activeProjects} active projects.`);
    appendWrappedPdfLine(lines, `3. Keep governance cadence with ${context.upcomingMeetings} upcoming meetings.`);
    appendWrappedPdfLine(lines, `4. Expand and update donor/partner records (${context.totalPartners} tracked).`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "DOCUMENTATION TARGET");
    appendWrappedPdfLine(lines, `Maintain at least ${context.totalDocuments} current supporting documents.`);
    return lines;
  };

  const buildOrganizationEmitLines = (templateKey, context) => {
    switch (templateKey) {
      case "governance_brief":
        return buildGovernanceBriefLines(context);
      case "member_engagement_report":
        return buildMemberEngagementLines(context);
      case "activity_report":
        return buildActivityReportLines(context);
      case "donor_readiness_pack":
        return buildDonorReadinessLines(context);
      case "operations_work_plan":
        return buildOperationsWorkPlanLines(context);
      case "group_profile":
      default:
        return buildGroupProfileLines(context);
    }
  };

  const buildOrganizationEmitDocumentFile = (selectedOption) => {
    const safeOption = selectedOption || ORGANIZATION_EMIT_DOCUMENT_OPTIONS[0];
    const context = buildOrganizationDocumentContext();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${toFilenameSlug(context.organizationName)}-${safeOption.value}-${dateStamp}.pdf`;
    const title = `${safeOption.label} - ${context.organizationName}`;
    const lines = buildOrganizationEmitLines(safeOption.value, context);
    const blob = buildSimplePdfBlob(title, lines);
    return {
      file: new File([blob], fileName, { type: "application/pdf" }),
      context,
    };
  };

  const handleEmitOrganizationDocument = async () => {
    if (
      uploadingOrganizationDocument ||
      deletingOrganizationDocuments ||
      emittingOrganizationDocument ||
      renamingOrganizationDocument
    ) {
      return;
    }
    if (!tenantId) {
      setOrganizationDocumentsError("Tenant context is missing. Cannot emit documents.");
      return;
    }

    const selectedOption =
      ORGANIZATION_EMIT_DOCUMENT_OPTIONS.find((option) => option.value === emitOrganizationDocumentType) ||
      ORGANIZATION_EMIT_DOCUMENT_OPTIONS[0];

    setOrganizationDocumentsError("");
    setEmittingOrganizationDocument(true);
    try {
      const { file, context } = buildOrganizationEmitDocumentFile(selectedOption);
      await uploadOrganizationDocument(
        file,
        {
          name: `${selectedOption.label} - ${context.organizationName}.pdf`,
          type: "Emit",
          uploadedByMemberId: user?.id,
        },
        tenantId
      );
      await loadWorkspace({ silent: true });
      setNotice({
        type: "success",
        message: `${selectedOption.label} emitted successfully.`,
      });
    } catch (error) {
      console.error("Error emitting organization document:", error);
      const message = error?.message || `Failed to emit ${selectedOption.label}.`;
      setOrganizationDocumentsError(message);
      setNotice({ type: "error", message });
    } finally {
      setEmittingOrganizationDocument(false);
    }
  };

  const requestDeleteSelectedDocuments = () => {
    if (!selectedDocuments.length) return;
    setShowDeleteDocumentsModal(true);
  };

  const closeDeleteDocumentsModal = () => {
    if (deletingOrganizationDocuments) return;
    setShowDeleteDocumentsModal(false);
  };

  const handleConfirmDeleteSelectedDocuments = async () => {
    if (!selectedDocuments.length) return;
    setDeletingOrganizationDocuments(true);
    setOrganizationDocumentsError("");
    try {
      let successCount = 0;
      let failureCount = 0;
      for (const document of selectedDocuments) {
        try {
          await deleteOrganizationDocument(document?.id, tenantId);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          console.error("Error deleting organization document:", error);
        }
      }

      await loadWorkspace({ silent: true });
      setSelectedDocumentIds([]);

      if (failureCount === 0) {
        setNotice({
          type: "success",
          message:
            successCount === 1
              ? "Document deleted successfully."
              : `${successCount} documents deleted successfully.`,
        });
      } else {
        setNotice({
          type: "warning",
          message: `Deleted ${successCount} document(s). ${failureCount} document(s) failed.`,
        });
      }
      setShowDeleteDocumentsModal(false);
    } finally {
      setDeletingOrganizationDocuments(false);
    }
  };

  const clearActivityFilters = () => {
    setMeetingSearch("");
    setMeetingStatusFilter("all");
    setMeetingTypeFilter("all");
  };

  const openCreateMeetingEditorModal = () => {
    setEditingMeetingId("");
    setMeetingForm(createActivityForm());
    setMeetingFormError("");
    setShowMeetingEditorModal(true);
  };

  const openEditSelectedMeetingModal = () => {
    if (!selectedMeeting) return;
    setEditingMeetingId(String(selectedMeeting.id || ""));
    setMeetingForm(createActivityForm(selectedMeeting));
    setMeetingFormError("");
    setShowMeetingEditorModal(true);
  };

  const closeMeetingEditorModal = () => {
    if (savingMeeting) return;
    setShowMeetingEditorModal(false);
    setEditingMeetingId("");
    setMeetingForm(createActivityForm());
    setMeetingFormError("");
  };

  const handleMeetingFormChange = (field, value) => {
    setMeetingForm((prev) => ({ ...prev, [field]: value }));
    if (meetingFormError) setMeetingFormError("");
  };

  const toggleMeetingAttendee = (memberId) => {
    const normalizedMemberId = String(memberId || "").trim();
    if (!normalizedMemberId) return;
    setMeetingForm((prev) => {
      const existing = Array.isArray(prev.attendeeMemberIds) ? prev.attendeeMemberIds : [];
      const nextIds = existing.includes(normalizedMemberId)
        ? existing.filter((id) => id !== normalizedMemberId)
        : [...existing, normalizedMemberId];
      return { ...prev, attendeeMemberIds: nextIds };
    });
    if (meetingFormError) setMeetingFormError("");
  };

  const handleSaveActivity = async (event) => {
    event.preventDefault();
    if (!tenantId) {
      setMeetingFormError("Tenant context is missing.");
      return;
    }

    const title = String(meetingForm.title || "").trim();
    if (!title) {
      setMeetingFormError("Activity title is required.");
      return;
    }

    const meetingDate = normalizeDateInputValue(meetingForm.date);
    if (!meetingDate) {
      setMeetingFormError("Activity date is required.");
      return;
    }

    const toIsoStringOrNull = (value) => {
      const text = String(value || "").trim();
      if (!text) return null;
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString();
    };

    const attendeeMemberIds = Array.from(
      new Set(
        (Array.isArray(meetingForm.attendeeMemberIds) ? meetingForm.attendeeMemberIds : [])
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    );

    const payload = {
      title,
      agenda: String(meetingForm.agenda || "").trim() || title,
      description: String(meetingForm.description || "").trim(),
      notes: String(meetingForm.description || "").trim(),
      minutes: String(meetingForm.minutes || "").trim(),
      type: String(meetingForm.type || "General").trim() || "General",
      status: normalizeActivityStatusKey(meetingForm.status) || "scheduled",
      date: meetingDate,
      start_at: toIsoStringOrNull(meetingForm.startAt),
      end_at: toIsoStringOrNull(meetingForm.endAt),
      location: String(meetingForm.location || "").trim(),
      project_id: meetingForm.projectId ? Number.parseInt(String(meetingForm.projectId), 10) : null,
      owner_member_id: meetingForm.ownerMemberId
        ? Number.parseInt(String(meetingForm.ownerMemberId), 10)
        : null,
      attendees: attendeeMemberIds,
    };

    setSavingMeeting(true);
    setMeetingFormError("");

    try {
      let saved = null;
      if (editingMeetingId) {
        saved = await updateOrganizationActivity(editingMeetingId, payload, tenantId);
      } else {
        saved = await createOrganizationActivity(payload, tenantId);
      }

      await loadWorkspace({ silent: true });
      const selectedId = String(saved?.id || "").trim();
      if (selectedId) {
        setSelectedMeetingIds([selectedId]);
      }
      setNotice({
        type: "success",
        message: editingMeetingId ? "Activity updated successfully." : "Activity created successfully.",
      });
      setShowMeetingEditorModal(false);
      setEditingMeetingId("");
      setMeetingForm(createActivityForm());
    } catch (error) {
      console.error("Error saving activity:", error);
      setMeetingFormError(error?.message || "Failed to save activity.");
    } finally {
      setSavingMeeting(false);
    }
  };

  const requestDeleteSelectedActivities = () => {
    if (!selectedMeetings.length) return;
    setShowDeleteMeetingsModal(true);
  };

  const closeDeleteMeetingsModal = () => {
    if (deletingMeetings) return;
    setShowDeleteMeetingsModal(false);
  };

  const handleConfirmDeleteSelectedActivities = async () => {
    if (!selectedMeetings.length) return;

    setDeletingMeetings(true);
    try {
      const deletedCount = await deleteOrganizationActivities(
        selectedMeetings.map((meeting) => meeting?.id),
        tenantId
      );
      await loadWorkspace({ silent: true });
      setSelectedMeetingIds([]);
      setShowDeleteMeetingsModal(false);
      setNotice({
        type: "success",
        message:
          deletedCount === 1
            ? "Activity deleted successfully."
            : `${deletedCount} activities deleted successfully.`,
      });
    } catch (error) {
      console.error("Error deleting activities:", error);
      setNotice({
        type: "error",
        message: error?.message || "Failed to delete selected activities.",
      });
    } finally {
      setDeletingMeetings(false);
    }
  };

  const openCreateMemberModal = () => {
    setEditingMemberId("");
    setMemberForm(createMemberForm());
    setMemberFormStep(1);
    setMemberFormError("");
    setShowMemberEditorModal(true);
  };

  const openEditSelectedMemberModal = () => {
    if (!selectedMember) return;
    setEditingMemberId(String(selectedMember.id));
    setMemberForm(createMemberForm(selectedMember));
    setMemberFormStep(1);
    setMemberFormError("");
    setShowMemberEditorModal(true);
  };

  const handleMemberFormChange = (field, value) => {
    setMemberForm((prev) => ({ ...prev, [field]: value }));
    if (memberFormError) {
      setMemberFormError("");
    }
  };

  const goToMemberFormStep = (stepNumber) => {
    const parsedStep = Number.parseInt(String(stepNumber), 10);
    if (!Number.isFinite(parsedStep)) return;
    const maxStep = MEMBER_FORM_STEPS.length;
    const boundedStep = Math.min(Math.max(parsedStep, 1), maxStep);
    setMemberFormStep(boundedStep);
  };

  const handleNextMemberFormStep = () => {
    if (memberFormStep === 1) {
      if (!String(memberForm.name || "").trim()) {
        setMemberFormError("Member name is required.");
        return;
      }
      if (!String(memberForm.phone_number || "").trim()) {
        setMemberFormError("Phone number is required.");
        return;
      }
    }
    if (memberFormError) {
      setMemberFormError("");
    }
    goToMemberFormStep(memberFormStep + 1);
  };

  const handlePreviousMemberFormStep = () => {
    if (memberFormError) {
      setMemberFormError("");
    }
    goToMemberFormStep(memberFormStep - 1);
  };

  const triggerMemberAvatarPicker = () => {
    if (savingMember || uploadingMemberAvatar) return;
    memberAvatarInputRef.current?.click();
  };

  const handleMemberAvatarFileSelection = async (event) => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (!file) return;
    input.value = "";

    if (!tenantId) {
      setMemberFormError("Tenant context is missing. Cannot upload member avatar.");
      return;
    }

    setUploadingMemberAvatar(true);
    if (memberFormError) {
      setMemberFormError("");
    }

    try {
      const uploaded = await uploadMemberAvatar(file, {
        tenantId,
        memberId: editingMemberId || undefined,
      });
      const nextUrl = String(uploaded?.publicUrl || uploaded?.path || "").trim();
      if (!nextUrl) {
        throw new Error("Avatar upload succeeded but no URL was returned.");
      }
      setMemberForm((prev) => ({
        ...prev,
        avatar_url: nextUrl,
      }));
      setNotice({
        type: "success",
        message: "Member avatar uploaded. Save member to persist this change.",
      });
    } catch (error) {
      console.error("Error uploading member avatar:", error);
      setMemberFormError(error?.message || "Failed to upload member avatar.");
    } finally {
      setUploadingMemberAvatar(false);
    }
  };

  const closeMemberEditorModal = () => {
    if (savingMember || uploadingMemberAvatar) return;
    setShowMemberEditorModal(false);
    setEditingMemberId("");
    setMemberForm(createMemberForm());
    setMemberFormStep(1);
    setMemberFormError("");
  };

  // Invite handlers
  const handleInviteFormChange = (field, value) => {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setSubmittingInvite(true);

    try {
      if (!inviteForm.email.trim()) {
        setResponseData({
          type: "error",
          title: "Email Required",
          message: "Please enter an email address for the member.",
          code: null,
        });
        setShowResponseModal(true);
        setSubmittingInvite(false);
        return;
      }

      const payload = {
        email: inviteForm.email,
        phone_number: inviteForm.phone_number || null,
        role: inviteForm.role || "member",
        notes: inviteForm.notes || null,
        tenant_id: tenantId,
      };

      const result = await createMagicLinkInvite(payload);

      // Show success response with invite number
      setResponseData({
        type: "success",
        title: "Invite Created!",
        message: `Share this invite number with ${inviteForm.email}. They can use it to join the workspace.`,
        code: result?.inviteNumber,
      });
      setShowResponseModal(true);

      // Reset form
      setInviteForm({
        name: "",
        email: "",
        phone_number: "",
        role: "member",
        notes: "",
      });
      setShowInviteModal(false);
    } catch (error) {
      setResponseData({
        type: "error",
        title: "Failed to Create Invite",
        message: error.message || "Something went wrong. Please try again.",
        code: null,
      });
      setShowResponseModal(true);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteForm({
      name: "",
      email: "",
      phone_number: "",
      role: "member",
      notes: "",
    });
  };

  const closeResponseModal = () => {
    setShowResponseModal(false);
  };

  const handleSaveMember = async (event) => {
    event.preventDefault();
    if (!tenantId) {
      setMemberFormError("Tenant ID is missing.");
      return;
    }

    const payload = {
      name: String(memberForm.name || "").trim(),
      email: String(memberForm.email || "").trim(),
      phone_number: String(memberForm.phone_number || "").trim(),
      role: String(memberForm.role || "member").trim() || "member",
      status: String(memberForm.status || "active").trim() || "active",
      join_date: normalizeDateInputValue(memberForm.join_date),
      avatar_url: String(memberForm.avatar_url || "").trim(),
      bio: String(memberForm.bio || "").trim(),
      gender: String(memberForm.gender || "").trim(),
      occupation: String(memberForm.occupation || "").trim(),
      national_id: String(memberForm.national_id || "").trim(),
      county: String(memberForm.county || "").trim(),
      sub_county: String(memberForm.sub_county || "").trim(),
      address: String(memberForm.address || "").trim(),
      emergency_contact_name: String(memberForm.emergency_contact_name || "").trim(),
      emergency_contact_phone: String(memberForm.emergency_contact_phone || "").trim(),
      emergency_contact_relationship: String(memberForm.emergency_contact_relationship || "").trim(),
    };

    if (!payload.name) {
      setMemberFormStep(1);
      setMemberFormError("Member name is required.");
      return;
    }
    if (!payload.phone_number) {
      setMemberFormStep(1);
      setMemberFormError("Phone number is required.");
      return;
    }

    setSavingMember(true);
    setMemberFormError("");

    try {
      let savedMember = null;
      if (editingMemberId) {
        savedMember = await updateMemberAdmin(editingMemberId, payload);
      } else {
        savedMember = await createMemberAdmin(payload);
        const createdMemberId = Number.parseInt(String(savedMember?.id || ""), 10);
        if (Number.isInteger(createdMemberId) && createdMemberId > 0) {
          try {
            await createTenantMembership({
              tenantId,
              memberId: createdMemberId,
              role: payload.role || "member",
            });
          } catch (membershipError) {
            const code = String(membershipError?.code || "");
            const message = String(membershipError?.message || "").toLowerCase();
            const isDuplicate =
              code === "23505" ||
              message.includes("duplicate") ||
              message.includes("already exists") ||
              message.includes("unique");
            if (!isDuplicate) {
              throw new Error(
                membershipError?.message ||
                  "Member was created but could not be linked to this organization."
              );
            }
          }
        }
      }

      await loadWorkspace({ silent: true });
      const nextSelectedId = String(savedMember?.id || "").trim();
      if (nextSelectedId) {
        setSelectedMemberIds([nextSelectedId]);
      }

      setNotice({
        type: "success",
        message: editingMemberId ? "Member updated successfully." : "Member created successfully.",
      });
      setShowMemberEditorModal(false);
      setEditingMemberId("");
      setMemberForm(createMemberForm());
      setMemberFormStep(1);
    } catch (error) {
      console.error("Error saving member:", error);
      setMemberFormError(error?.message || "Failed to save member.");
    } finally {
      setSavingMember(false);
    }
  };

  const openOrgEditor = () => {
    setOrgForm(createOrganizationForm(tenantRecord));
    setOrgFormError("");
    setShowOrgModal(true);
  };

  const handleOrgFormChange = (field, value) => {
    setOrgForm((prev) => ({ ...prev, [field]: value }));
    if (orgFormError) setOrgFormError("");
  };

  const handleSaveOrganization = async (event) => {
    event.preventDefault();
    if (!tenantId) {
      setOrgFormError("Tenant ID is missing.");
      return;
    }

    if (!String(orgForm.name || "").trim()) {
      setOrgFormError("Organization name is required.");
      return;
    }

    setSavingOrg(true);
    setOrgFormError("");

    try {
      const existingSiteData = safeObject(tenantRecord?.site_data);
      const existingProfile = getOrganizationProfile(existingSiteData);
      const existingPartners = getOrganizationPartners(existingSiteData);

      const nextSiteData = buildSiteDataWithProfilePatch(existingSiteData, {
        ...existingProfile,
        registration_number: normalizeOptional(orgForm.registration_number),
        website: normalizeOptional(orgForm.website),
        mission: normalizeOptional(orgForm.mission),
        vision: normalizeOptional(orgForm.vision),
        partners: existingPartners,
      });

      const updated = await updateTenant(tenantId, {
        name: orgForm.name,
        tagline: orgForm.tagline,
        contact_email: orgForm.contact_email,
        contact_phone: orgForm.contact_phone,
        location: orgForm.location,
        is_public: Boolean(orgForm.is_public),
        site_data: nextSiteData,
      });

      setTenantRecord(updated);
      setOrgForm(createOrganizationForm(updated));
      onTenantUpdated?.(updated);
      setNotice({ type: "success", message: "Organization profile saved." });
      setShowOrgModal(false);
    } catch (error) {
      console.error("Error saving organization profile:", error);
      setOrgFormError(error?.message || "Failed to save organization profile.");
    } finally {
      setSavingOrg(false);
    }
  };

  const persistPartners = async (nextPartners, successMessage) => {
    if (!tenantId) {
      throw new Error("Tenant ID is missing.");
    }

    const existingSiteData = safeObject(tenantRecord?.site_data);
    const existingProfile = getOrganizationProfile(existingSiteData);
    const nextSiteData = buildSiteDataWithProfilePatch(existingSiteData, {
      ...existingProfile,
      partners: nextPartners,
    });

    const updated = await updateTenant(tenantId, {
      site_data: nextSiteData,
    });

    setTenantRecord(updated);
    onTenantUpdated?.(updated);
    setNotice({ type: "success", message: successMessage });
    return updated;
  };

  const openCreatePartnerModal = () => {
    setEditingPartnerId("");
    setPartnerForm({
      ...createPartnerForm(),
      linked_project_ids: partnerProjectOptions.length ? [partnerProjectOptions[0].id] : [],
    });
    setPartnerFormStep(1);
    setPartnerLogoUploadName("");
    setPartnerFormError("");
    setShowPartnerModal(true);
  };

  const openEditPartnerModal = () => {
    if (selectedPartners.length !== 1) return;
    const partner = selectedPartners[0];
    setEditingPartnerId(partner.id);
    setPartnerForm({
      name: partner.name,
      kind: partner.kind,
      status: partner.status,
      contact_person: partner.contact_person,
      contact_email: partner.contact_email,
      contact_phone: partner.contact_phone,
      last_contact: normalizeDateInputValue(partner.last_contact),
      logo_url: String(partner.logo_url || "").trim(),
      linked_project_ids: Array.isArray(partner.linked_project_ids)
        ? partner.linked_project_ids.map((projectId) => String(projectId || "").trim()).filter(Boolean)
        : [],
      notes: partner.notes,
    });
    setPartnerFormStep(1);
    setPartnerLogoUploadName("");
    setPartnerFormError("");
    setShowPartnerModal(true);
  };

  const handlePartnerFormChange = (field, value) => {
    setPartnerForm((prev) => ({ ...prev, [field]: value }));
    if (partnerFormError) setPartnerFormError("");
  };

  const goToPartnerFormStep = (stepNumber) => {
    const parsedStep = Number.parseInt(String(stepNumber), 10);
    if (!Number.isFinite(parsedStep)) return;
    const maxStep = PARTNER_FORM_STEPS.length;
    const boundedStep = Math.min(Math.max(parsedStep, 1), maxStep);
    setPartnerFormStep(boundedStep);
  };

  const handleNextPartnerFormStep = () => {
    if (partnerFormStep === 1) {
      if (!String(partnerForm.name || "").trim()) {
        setPartnerFormError("Partner name is required.");
        return;
      }
    }
    if (partnerFormError) setPartnerFormError("");
    goToPartnerFormStep(partnerFormStep + 1);
  };

  const handlePreviousPartnerFormStep = () => {
    if (partnerFormError) setPartnerFormError("");
    goToPartnerFormStep(partnerFormStep - 1);
  };

  const triggerPartnerLogoPicker = () => {
    if (savingPartner) return;
    partnerLogoInputRef.current?.click();
  };

  const clearPartnerLogo = () => {
    handlePartnerFormChange("logo_url", "");
    setPartnerLogoUploadName("");
    if (partnerLogoInputRef.current) {
      partnerLogoInputRef.current.value = "";
    }
  };

  const handlePartnerLogoFileSelection = (event) => {
    const file = event?.target?.files?.[0] || null;
    if (event?.target) {
      event.target.value = "";
    }
    if (!file) return;
    if (!String(file.type || "").toLowerCase().startsWith("image/")) {
      setPartnerFormError("Logo file must be an image.");
      return;
    }
    if (file.size > PARTNER_LOGO_MAX_SIZE_BYTES) {
      setPartnerFormError("Logo file must be 2MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handlePartnerFormChange("logo_url", String(reader.result || "").trim());
      setPartnerLogoUploadName(String(file.name || "").trim());
    };
    reader.onerror = () => {
      setPartnerFormError("Failed to read logo file.");
    };
    reader.readAsDataURL(file);
  };

  const togglePartnerLinkedProject = (projectId) => {
    const normalizedProjectId = String(projectId || "").trim();
    if (!normalizedProjectId) return;
    setPartnerForm((prev) => {
      const current = Array.isArray(prev.linked_project_ids) ? prev.linked_project_ids : [];
      const exists = current.includes(normalizedProjectId);
      return {
        ...prev,
        linked_project_ids: exists
          ? current.filter((id) => id !== normalizedProjectId)
          : [...current, normalizedProjectId],
      };
    });
    if (partnerFormError) setPartnerFormError("");
  };

  const handleSavePartner = async (event) => {
    event.preventDefault();
    const name = String(partnerForm.name || "").trim();
    if (!name) {
      setPartnerFormError("Partner name is required.");
      return;
    }
    if (!partnerProjectOptions.length) {
      setPartnerFormError("Create at least one project before adding partners.");
      return;
    }

    const linkedProjectIds = Array.from(
      new Set(
        (Array.isArray(partnerForm.linked_project_ids) ? partnerForm.linked_project_ids : [])
          .map((projectId) => String(projectId || "").trim())
          .filter((projectId) => partnerProjectNameById.has(projectId))
      )
    );
    if (!linkedProjectIds.length) {
      setPartnerFormError("Link this partner to at least one project.");
      return;
    }

    setSavingPartner(true);
    setPartnerFormError("");

    try {
      const partnerId = editingPartnerId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `partner-${Date.now()}`);

      const nextPartner = {
        id: partnerId,
        name,
        kind: String(partnerForm.kind || "Partner").trim() || "Partner",
        status: String(partnerForm.status || "Active").trim() || "Active",
        contact_person: String(partnerForm.contact_person || "").trim(),
        contact_email: String(partnerForm.contact_email || "").trim(),
        contact_phone: String(partnerForm.contact_phone || "").trim(),
        last_contact: normalizeDateInputValue(partnerForm.last_contact),
        logo_url: String(partnerForm.logo_url || "").trim(),
        linked_project_ids: linkedProjectIds,
        notes: String(partnerForm.notes || "").trim(),
      };

      const currentPartners = getOrganizationPartners(tenantRecord?.site_data);
      const nextPartners = editingPartnerId
        ? currentPartners.map((partner) => (partner.id === editingPartnerId ? nextPartner : partner))
        : [nextPartner, ...currentPartners];

      await persistPartners(nextPartners, editingPartnerId ? "Partner updated." : "Partner added.");
      setShowPartnerModal(false);
      setEditingPartnerId("");
      setPartnerForm(createPartnerForm());
      setPartnerFormStep(1);
      setPartnerLogoUploadName("");
      setSelectedPartnerIds([nextPartner.id]);
    } catch (error) {
      console.error("Error saving partner:", error);
      setPartnerFormError(error?.message || "Failed to save partner.");
    } finally {
      setSavingPartner(false);
    }
  };

  const requestDeleteSelectedPartners = () => {
    if (!selectedPartnerIds.length) return;
    setShowDeletePartnerModal(true);
  };

  const handleDeleteSelectedPartners = async () => {
    if (!selectedPartnerIds.length) return;
    setSavingPartner(true);
    setPartnerFormError("");

    try {
      const selectedSet = new Set(selectedPartnerIds);
      const currentPartners = getOrganizationPartners(tenantRecord?.site_data);
      const nextPartners = currentPartners.filter((partner) => !selectedSet.has(partner.id));
      await persistPartners(nextPartners, "Selected partners removed.");
      setSelectedPartnerIds([]);
      setShowDeletePartnerModal(false);
    } catch (error) {
      console.error("Error deleting partners:", error);
      setPartnerFormError(error?.message || "Failed to delete selected partners.");
    } finally {
      setSavingPartner(false);
    }
  };

  const resolveTemplateDownloadExtension = (template) => {
    const path = String(template?.file_path || "").trim();
    if (path.includes(".")) {
      const extension = path.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (extension) return extension;
    }

    const format = String(template?.format || "")
      .trim()
      .toLowerCase();
    if (format.includes("docx") || format.includes("word")) return "docx";
    if (format.includes("pdf")) return "pdf";
    if (format.includes("xlsx") || format.includes("excel") || format.includes("xls")) return "xlsx";
    if (format.includes("pptx") || format.includes("powerpoint") || format.includes("ppt")) return "pptx";
    if (format.includes("csv")) return "csv";
    if (format.includes("png")) return "png";
    if (format.includes("jpg") || format.includes("jpeg")) return "jpg";
    return "file";
  };

  const resolveTemplateDownloadName = (template) => {
    const path = String(template?.file_path || "").trim();
    const fromPath = path ? path.split("/").pop() : "";
    if (fromPath) return fromPath;
    const extension = resolveTemplateDownloadExtension(template);
    const baseName = toFilenameSlug(template?.name || "template");
    return `${baseName}.${extension}`;
  };

  const handleDownloadOrganizationTemplate = async (template) => {
    if (!template) return;
    const templateName = String(template?.name || "Template").trim() || "Template";
    const filePath = String(template?.file_path || "").trim();
    if (!filePath) {
      setNotice({
        type: "warning",
        message: `${templateName} is not uploaded yet.`,
      });
      return;
    }

    try {
      const signedUrl = await getOrganizationTemplateDownloadUrl(filePath);
      if (!signedUrl) {
        throw new Error("Download URL could not be generated.");
      }

      const anchor = document.createElement("a");
      anchor.href = signedUrl;
      anchor.download = resolveTemplateDownloadName(template);
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Error downloading organization template:", error);
      setNotice({
        type: "error",
        message: error?.message || `Failed to download ${templateName}.`,
      });
    }
  };

  const memberAllSelected =
    memberRowIds.length > 0 && memberRowIds.every((id) => selectedMemberIds.includes(id));
  const documentAllSelected =
    documentRowIds.length > 0 && documentRowIds.every((id) => selectedDocumentIds.includes(id));
  const meetingAllSelected =
    meetingRowIds.length > 0 && meetingRowIds.every((id) => selectedMeetingIds.includes(id));
  const partnerAllSelected =
    partnerRowIds.length > 0 && partnerRowIds.every((id) => selectedPartnerIds.includes(id));
  const maxMemberFormStep = MEMBER_FORM_STEPS.length;
  const isFinalMemberFormStep = memberFormStep >= maxMemberFormStep;

  const renderOverviewTab = () => {
    const orgProfile = getOrganizationProfile(tenantRecord?.site_data);
    const missionSummary =
      String(orgProfile?.mission || "").trim() ||
      String(tenantRecord?.tagline || "").trim() ||
      "Track organization delivery, member engagement, and governance outcomes in one place.";
    const quickActions = [
      {
        key: "members",
        label: "Members",
        note: "Manage member profiles",
        icon: "users",
        onClick: () => setActiveTab("members"),
      },
      {
        key: "activities",
        label: "Activities",
        note: "Update governance records",
        icon: "calendar",
        onClick: () => setActiveTab("activities"),
      },
      {
        key: "partners",
        label: "Partners",
        note: "Track partner relationships",
        icon: "briefcase",
        onClick: () => setActiveTab("partners"),
      },
      {
        key: "documents",
        label: "Documents",
        note: "Upload and emit docs",
        icon: "folder",
        onClick: () => setActiveTab("documents"),
      },
    ];
    if (setActivePage) {
      quickActions.push({
        key: "projects",
        label: "Projects",
        note: "Open project workspace",
        icon: "layers",
        onClick: () => setActivePage("projects"),
      });
    }

    return (
      <article className="org-shell-panel org-shell-panel--overview">
        <div className="project-overview-modern organization-overview-modern">
          <div className="project-overview-head organization-overview-head">
            <div>
              <h4>Organization performance</h4>
              <p>{missionSummary}</p>
            </div>
            <div className="organization-overview-head-actions">
              <span
                className={`project-overview-status-badge ${
                  tenantRecord?.is_public ? "is-active" : "is-hidden"
                }`}
              >
                {tenantRecord?.is_public ? "Public profile" : "Private profile"}
              </span>
              <button type="button" className="project-detail-action ghost" onClick={openOrgEditor}>
                Edit profile
              </button>
            </div>
          </div>

          <div className="project-overview-kpi-grid">
            <article className="project-overview-kpi-card">
              <span className="project-overview-kpi-label">Member engagement</span>
              <strong>{formatPercentLabel(organizationOverviewAnalytics.activeMemberPercent)}</strong>
              <small>
                {orgStats.activeMembers} of {orgStats.totalMembers} members active
              </small>
            </article>
            <article className="project-overview-kpi-card">
              <span className="project-overview-kpi-label">Project activation</span>
              <strong>{formatPercentLabel(organizationOverviewAnalytics.activeProjectPercent)}</strong>
              <small>
                {orgStats.activeProjects} of {orgStats.totalProjects} active or planning
              </small>
            </article>
            <article className="project-overview-kpi-card">
              <span className="project-overview-kpi-label">Governance records</span>
              <strong>{orgStats.totalDocuments + orgStats.totalMeetings}</strong>
              <small>
                {orgStats.totalDocuments} docs and {orgStats.totalMeetings} activities
              </small>
            </article>
            <article className="project-overview-kpi-card">
              <span className="project-overview-kpi-label">Budget pipeline</span>
              <strong>{formatCurrency(organizationOverviewAnalytics.totalBudgetPipeline)}</strong>
              <small>
                {orgStats.totalPartners} partners tracked • {formatCurrency(
                  organizationOverviewAnalytics.totalExpectedRevenue
                )} expected revenue
              </small>
            </article>
          </div>

          <div className="project-overview-panel-grid">
            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Membership health</h5>
                <span>{formatPercentLabel(organizationOverviewAnalytics.activeMemberPercent)} active</span>
              </div>
              <div className="project-overview-ring-layout">
                <div className="project-overview-ring-chart">
                  <svg viewBox="0 0 96 96" className="project-overview-ring-svg" aria-hidden="true">
                    <circle className="project-overview-ring-bg" cx="48" cy="48" r="34" />
                    <circle
                      className="project-overview-ring-fill"
                      cx="48"
                      cy="48"
                      r="34"
                      style={{
                        strokeDasharray: `${organizationOverviewAnalytics.memberRingDash} ${organizationOverviewAnalytics.ringCircumference}`,
                        stroke: "#1d4ed8",
                      }}
                    />
                  </svg>
                  <span className="project-overview-ring-value">
                    {Math.round(organizationOverviewAnalytics.activeMemberPercent)}%
                  </span>
                </div>
                <div className="project-overview-stat-list">
                  <div className="project-overview-stat-item">
                    <span>Total members</span>
                    <strong>{orgStats.totalMembers}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Active members</span>
                    <strong>{orgStats.activeMembers}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Inactive or pending</span>
                    <strong>{organizationOverviewAnalytics.inactiveMembers}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Partners tracked</span>
                    <strong>{orgStats.totalPartners}</strong>
                  </div>
                </div>
              </div>
            </article>

            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Governance cadence</h5>
                <span>
                  {formatPercentLabel(organizationOverviewAnalytics.meetingCompletionPercent)} activities completed
                </span>
              </div>
              <div className="project-overview-ring-layout">
                <div className="project-overview-ring-chart">
                  <svg viewBox="0 0 96 96" className="project-overview-ring-svg" aria-hidden="true">
                    <circle className="project-overview-ring-bg" cx="48" cy="48" r="34" />
                    <circle
                      className="project-overview-ring-fill"
                      cx="48"
                      cy="48"
                      r="34"
                      style={{
                        strokeDasharray: `${organizationOverviewAnalytics.meetingRingDash} ${organizationOverviewAnalytics.ringCircumference}`,
                        stroke: "#0f766e",
                      }}
                    />
                  </svg>
                  <span className="project-overview-ring-value">
                    {Math.round(organizationOverviewAnalytics.meetingCompletionPercent)}%
                  </span>
                </div>
                <div className="project-overview-stat-list">
                  <div className="project-overview-stat-item">
                    <span>Total activities</span>
                    <strong>{orgStats.totalMeetings}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Completed</span>
                    <strong>{orgStats.completedMeetings}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Upcoming</span>
                    <strong>{orgStats.upcomingMeetings}</strong>
                  </div>
                  <div className="project-overview-stat-item">
                    <span>Documents</span>
                    <strong>{orgStats.totalDocuments}</strong>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div className="project-overview-range-row">
            <span className="project-overview-range-label">Chart range</span>
            <div className="project-overview-range-toggle" role="group" aria-label="Organization overview range">
              {ORGANIZATION_OVERVIEW_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`project-overview-range-btn${
                    organizationOverviewRange === option.value ? " active" : ""
                  }`}
                  onClick={() => setOrganizationOverviewRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="project-overview-panel-grid project-overview-panel-grid--secondary">
            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Records trend ({organizationOverviewAnalytics.trendWindowLabel})</h5>
                <span>
                  {formatPercentLabel(organizationOverviewAnalytics.trendDeltaPercent)}{" "}
                  {organizationOverviewAnalytics.trendDeltaLabel}
                </span>
              </div>
              <div className="project-overview-trend-chart">
                {organizationOverviewAnalytics.trendBuckets.map((bucket) => {
                  const safeCount = Number(bucket?.count || 0);
                  const barHeight =
                    organizationOverviewAnalytics.trendMaxCount > 0
                      ? Math.max(8, (safeCount / organizationOverviewAnalytics.trendMaxCount) * 118)
                      : 8;
                  return (
                    <div className="project-overview-trend-col" key={bucket.key}>
                      <span className="project-overview-trend-value">{safeCount.toLocaleString("en-KE")}</span>
                      <div className="project-overview-trend-track">
                        <span
                          className={`project-overview-trend-bar${safeCount > 0 ? "" : " is-zero"}`}
                          style={{ height: `${barHeight}px` }}
                        />
                      </div>
                      <span className="project-overview-trend-label">{bucket.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="organization-overview-trend-breakdown">
                <span>{organizationOverviewAnalytics.rangeMemberJoinCount} member joins</span>
                <span>{organizationOverviewAnalytics.rangeMeetingCount} activities logged</span>
                <span>{organizationOverviewAnalytics.rangeDocumentCount} docs uploaded</span>
              </div>
            </article>

            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Project status mix</h5>
                <span>{orgStats.visibleProjects} visible projects</span>
              </div>
              {organizationOverviewAnalytics.projectStatusMix.length ? (
                <div className="organization-overview-status-chart">
                  {organizationOverviewAnalytics.projectStatusMix.map((item) => {
                    const statusTone = String(item.status || "default")
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-");
                    const barHeight =
                      organizationOverviewAnalytics.projectStatusMixMax > 0
                        ? Math.max(10, (item.count / organizationOverviewAnalytics.projectStatusMixMax) * 122)
                        : 10;
                    return (
                      <div className={`organization-overview-status-col is-${statusTone}`} key={item.status}>
                        <span className="organization-overview-status-value">{item.count}</span>
                        <div className="organization-overview-status-track">
                          <span
                            className="organization-overview-status-bar"
                            style={{ height: `${barHeight}px` }}
                          />
                        </div>
                        <span className="organization-overview-status-label">{item.label}</span>
                        <span className="organization-overview-status-percent">{formatPercentLabel(item.percent)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="org-shell-empty">No project status data yet.</div>
              )}
            </article>
          </div>

          <div className="project-overview-panel-grid project-overview-panel-grid--secondary">
            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Organization profile</h5>
                <span>{tenantRecord?.name || "—"}</span>
              </div>
              <div className="org-shell-detail-grid organization-overview-profile-grid">
                <div>
                  <strong>Registration number</strong>
                  <p>{orgProfile?.registration_number || "—"}</p>
                </div>
                <div>
                  <strong>Location</strong>
                  <p>{tenantRecord?.location || "—"}</p>
                </div>
                <div>
                  <strong>Contact email</strong>
                  <p>{tenantRecord?.contact_email || "—"}</p>
                </div>
                <div>
                  <strong>Contact phone</strong>
                  <p>{tenantRecord?.contact_phone || "—"}</p>
                </div>
                <div className="org-shell-detail-full">
                  <strong>Mission</strong>
                  <p>{orgProfile?.mission || "—"}</p>
                </div>
                <div className="org-shell-detail-full">
                  <strong>Vision</strong>
                  <p>{orgProfile?.vision || "—"}</p>
                </div>
              </div>
            </article>

            <article className="project-overview-panel">
              <div className="project-overview-panel-head">
                <h5>Quick actions</h5>
                <span>Workspace shortcuts</span>
              </div>
              <div className="organization-overview-action-grid">
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="organization-overview-action-card"
                    onClick={action.onClick}
                  >
                    <span className="organization-overview-action-icon" aria-hidden="true">
                      <Icon name={action.icon} size={16} />
                    </span>
                    <span className="organization-overview-action-copy">
                      <strong>{action.label}</strong>
                      <small>{action.note}</small>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>
      </article>
    );
  };

  const renderMembersTab = () => (
    <article className="org-shell-panel org-shell-panel--table">
      <div className="project-detail-section-head">
        <h4>Organization Members</h4>
        <div className="project-detail-section-head-actions">
          {selectedMemberIds.length > 0 ? (
            <>
              <button
                type="button"
                className="project-detail-action ghost"
                disabled={selectedMemberIds.length !== 1 || savingMember}
                onClick={() => setShowMemberModal(true)}
              >
                View selected
              </button>
              <button
                type="button"
                className="project-detail-action ghost"
                disabled={selectedMemberIds.length !== 1 || savingMember}
                onClick={openEditSelectedMemberModal}
              >
                Edit selected
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="project-detail-action ghost"
            title="Download import template"
            aria-label="Download import template"
            onClick={downloadMemberImportTemplate}
            disabled={savingMember || importingMembers}
          >
            Template CSV
          </button>
          <button
            type="button"
            className="project-detail-action ghost icon-only"
            title="Import users"
            aria-label="Import users"
            onClick={triggerMemberImportPicker}
            disabled={savingMember || importingMembers}
          >
            <Icon name="upload" size={16} />
          </button>
          <button
            type="button"
            className="project-detail-action ghost icon-only"
            title="Export users"
            aria-label="Export users"
            onClick={exportMembersCsv}
            disabled={savingMember}
          >
            <Icon name="download" size={16} />
          </button>
          <input
            ref={memberImportInputRef}
            type="file"
            accept=".csv,text/csv"
            className="project-documents-file-input"
            onChange={handleMemberImportFileSelection}
            disabled={savingMember || importingMembers}
          />
          <button
            type="button"
            className="project-detail-action"
            onClick={() => setShowChoiceModal(true)}
            disabled={savingMember || importingMembers}
          >
            New member
          </button>
        </div>
      </div>

      <div className="project-detail-filters">
        <label className="project-detail-filter project-detail-filter--search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Search by full name, telephone, email"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="project-expenses-selection-note">{selectedMemberIds.length} selected</div>
      <div className="project-expenses-selection-note">
        Showing {memberRows.length} of {members.length} members.
      </div>

      <div className="projects-table-wrap project-expenses-table-wrap">
        <table className="projects-table-view project-expenses-table">
          <thead>
            <tr>
              <th className="projects-table-check">
                <input
                  type="checkbox"
                  checked={memberAllSelected}
                  onChange={() => toggleSelectAll(memberRowIds, selectedMemberIds, setSelectedMemberIds)}
                />
              </th>
              <th className="org-shell-member-icon-col">Icon</th>
              <th>Full names</th>
              <th>Telephone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.length ? (
              memberRows.map((member) => {
                const memberId = String(member?.id || "");
                const avatarUrl = getMemberAvatarUrl(member);
                return (
                  <tr key={memberId || member?.email || member?.name}>
                    <td className="projects-table-check">
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(memberId)}
                        onChange={() => toggleSelection(memberId, setSelectedMemberIds)}
                        aria-label={`Select member ${member?.name || memberId}`}
                      />
                    </td>
                    <td className="org-shell-member-icon-cell">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={`${member?.name || "Member"} avatar`}
                          className="org-shell-member-icon"
                          loading="lazy"
                        />
                      ) : (
                        <span className="org-shell-member-icon-fallback" aria-hidden="true">
                          <Icon name="member" size={16} />
                        </span>
                      )}
                    </td>
                    <td>{member?.name || `Member #${memberId}`}</td>
                    <td>{member?.phone_number || "—"}</td>
                    <td>{member?.email || "—"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="org-shell-empty">No members found for this query.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  const renderDocumentsTab = () => (
    <article className="org-shell-panel org-shell-panel--table">
      <div className="project-detail-section-head">
        <h4>Organization Documents</h4>
        <div className="project-detail-section-head-actions">
          <div className="project-documents-mode" role="tablist" aria-label="Organization document mode">
            <button
              type="button"
              className={`project-documents-mode-btn${documentMode === "upload" ? " active" : ""}`}
              onClick={() => setDocumentMode("upload")}
              disabled={
                uploadingOrganizationDocument ||
                deletingOrganizationDocuments ||
                emittingOrganizationDocument ||
                renamingOrganizationDocument
              }
              aria-selected={documentMode === "upload"}
            >
              Upload
            </button>
            <button
              type="button"
              className={`project-documents-mode-btn${documentMode === "emit" ? " active" : ""}`}
              onClick={() => setDocumentMode("emit")}
              disabled={
                uploadingOrganizationDocument ||
                deletingOrganizationDocuments ||
                emittingOrganizationDocument ||
                renamingOrganizationDocument
              }
              aria-selected={documentMode === "emit"}
            >
              Emit
            </button>
          </div>
          {selectedDocuments.length === 1 ? (
            <button
              type="button"
              className="project-detail-action ghost"
              onClick={openRenameSelectedOrganizationDocumentModal}
              disabled={
                renamingOrganizationDocument ||
                deletingOrganizationDocuments ||
                uploadingOrganizationDocument ||
                emittingOrganizationDocument
              }
            >
              Rename selected
            </button>
          ) : null}
          {selectedDocuments.length > 0 ? (
            <button
              type="button"
              className="project-detail-action ghost danger"
              onClick={requestDeleteSelectedDocuments}
              disabled={
                deletingOrganizationDocuments ||
                uploadingOrganizationDocument ||
                emittingOrganizationDocument ||
                renamingOrganizationDocument
              }
            >
              Delete selected
            </button>
          ) : null}
          {selectedDocument && getDocumentDownloadUrl(selectedDocument) ? (
            <a
              className="project-detail-action ghost"
              href={getDocumentDownloadUrl(selectedDocument)}
              target="_blank"
              rel="noreferrer"
            >
              Open selected
            </a>
          ) : null}
          {documentMode === "upload" ? (
            <>
              <button
                type="button"
                className="project-detail-action"
                onClick={triggerOrganizationDocumentPicker}
                disabled={
                  uploadingOrganizationDocument ||
                  deletingOrganizationDocuments ||
                  emittingOrganizationDocument ||
                  renamingOrganizationDocument
                }
              >
                {uploadingOrganizationDocument ? "Uploading..." : "Upload document"}
              </button>
              <input
                ref={organizationDocumentInputRef}
                type="file"
                className="project-documents-file-input"
                accept={ORGANIZATION_DOCUMENT_ACCEPT}
                onChange={handleUploadOrganizationDocuments}
                multiple
                disabled={
                  uploadingOrganizationDocument ||
                  deletingOrganizationDocuments ||
                  emittingOrganizationDocument ||
                  renamingOrganizationDocument
                }
              />
            </>
          ) : (
            <button
              type="button"
              className="project-detail-action"
              onClick={handleEmitOrganizationDocument}
              disabled={
                emittingOrganizationDocument ||
                uploadingOrganizationDocument ||
                deletingOrganizationDocuments ||
                renamingOrganizationDocument
              }
            >
              {emittingOrganizationDocument ? "Emitting..." : "Emit document"}
            </button>
          )}
        </div>
      </div>

      <p className="project-documents-hint">
        Allowed file types: <strong>.docx, .pdf</strong>, and image files.
      </p>

      {documentMode === "emit" ? (
        <div className="project-documents-emit">
          <label className="project-detail-filter">
            <span>Group template</span>
            <select
              value={emitOrganizationDocumentType}
              onChange={(event) => setEmitOrganizationDocumentType(event.target.value)}
              disabled={emittingOrganizationDocument || renamingOrganizationDocument}
            >
              {ORGANIZATION_EMIT_DOCUMENT_OPTIONS.map((option) => (
                <option key={`organization-emit-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="project-documents-emit-note">
            Templates emit generated PDFs from organization-level management and activity data.
          </p>
        </div>
      ) : null}

      {organizationDocumentsError ? (
        <p className="project-detail-expense-error">{organizationDocumentsError}</p>
      ) : null}

      <div className="org-shell-toolbar">
        <label className="org-shell-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder="Search by name, type"
            value={documentSearch}
            onChange={(event) => setDocumentSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="project-expenses-selection-note">{selectedDocumentIds.length} selected</div>
      <div className="project-expenses-selection-note">
        Showing {documentRows.length} of {documents.length} documents.
      </div>

      <div className="projects-table-wrap project-expenses-table-wrap">
        <table className="projects-table-view project-expenses-table project-documents-table">
          <thead>
            <tr>
              <th className="projects-table-check">
                <input
                  type="checkbox"
                  checked={documentAllSelected}
                  onChange={() =>
                    toggleSelectAll(documentRowIds, selectedDocumentIds, setSelectedDocumentIds)
                  }
                />
              </th>
              <th>Document</th>
              <th>Type</th>
              <th>Uploaded</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {documentRows.length ? (
              documentRows.map((document) => {
                const documentId = String(document?.id || "");
                const documentUrl = getDocumentDownloadUrl(document);
                return (
                  <tr key={documentId || getDocumentName(document)}>
                    <td className="projects-table-check">
                      <input
                        type="checkbox"
                        checked={selectedDocumentIds.includes(documentId)}
                        onChange={() => toggleSelection(documentId, setSelectedDocumentIds)}
                      />
                    </td>
                    <td>
                      <div className="projects-table-main-copy">
                        <strong>{getDocumentName(document)}</strong>
                        <p>
                          {document?.description ||
                            String(document?.file_path || "").split("/").pop() ||
                            "Organization file"}
                        </p>
                      </div>
                    </td>
                    <td>{getDocumentType(document)}</td>
                    <td>{formatDate(document?.uploaded_at || document?.created_at)}</td>
                    <td>
                      {documentUrl ? (
                        <a href={documentUrl} target="_blank" rel="noreferrer" className="org-shell-link-btn">
                          Open
                        </a>
                      ) : (
                        <span className="org-shell-muted">Unavailable</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="org-shell-empty">No documents found for this query.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  const renderActivitiesTab = () => (
    <article className="org-shell-panel org-shell-panel--table">
      <div className="org-shell-panel-head">
        <h3>Organization Activities</h3>
        <span>{meetingRows.length} visible</span>
      </div>

      <div className="org-shell-toolbar org-shell-activity-filters">
        <label className="org-shell-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder="Search title, agenda, location, type"
            value={meetingSearch}
            onChange={(event) => setMeetingSearch(event.target.value)}
          />
        </label>
        <label className="data-modal-field">
          Status
          <select value={meetingStatusFilter} onChange={(event) => setMeetingStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {ACTIVITY_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {toDisplayLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label className="data-modal-field">
          Type
          <select value={meetingTypeFilter} onChange={(event) => setMeetingTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            {meetingTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="org-shell-toolbar-actions">
          <button
            type="button"
            className="project-detail-action ghost"
            onClick={clearActivityFilters}
            disabled={!meetingSearch && meetingStatusFilter === "all" && meetingTypeFilter === "all"}
          >
            Clear filters
          </button>
          {selectedMeetingIds.length === 1 ? (
            <>
              <button
                type="button"
                className="project-detail-action ghost"
                onClick={() => setShowMeetingModal(true)}
                disabled={savingMeeting || deletingMeetings}
              >
                View selected
              </button>
              <button
                type="button"
                className="project-detail-action ghost"
                onClick={openEditSelectedMeetingModal}
                disabled={savingMeeting || deletingMeetings}
              >
                Edit selected
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="project-detail-action ghost danger"
            disabled={!selectedMeetingIds.length || savingMeeting || deletingMeetings}
            onClick={requestDeleteSelectedActivities}
          >
            Delete selected
          </button>
          <button
            type="button"
            className="project-detail-action"
            onClick={openCreateMeetingEditorModal}
            disabled={savingMeeting || deletingMeetings}
          >
            Add activity
          </button>
        </div>
      </div>

      <div className="projects-table-wrap">
        <table className="projects-table-view">
          <thead>
            <tr>
              <th className="projects-table-check">
                <input
                  type="checkbox"
                  checked={meetingAllSelected}
                  onChange={() => toggleSelectAll(meetingRowIds, selectedMeetingIds, setSelectedMeetingIds)}
                />
              </th>
              <th>Activity</th>
              <th>Type</th>
              <th>Date</th>
              <th>Project</th>
              <th>Owner</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {meetingRows.length ? (
              meetingRows.map((meeting, index) => {
                const meetingId = String(meeting?.id || `meeting-${index}`);
                const statusLabel = getMeetingStatus(meeting);
                const projectLabel =
                  partnerProjectNameById.get(String(meeting?.project_id || "").trim()) || "—";
                const ownerLabel =
                  memberNameById.get(String(meeting?.owner_member_id || "").trim()) || "—";
                return (
                  <tr key={meetingId}>
                    <td className="projects-table-check">
                      <input
                        type="checkbox"
                        checked={selectedMeetingIds.includes(meetingId)}
                        onChange={() => toggleSelection(meetingId, setSelectedMeetingIds)}
                      />
                    </td>
                    <td>
                      <div className="projects-table-main-copy">
                        <strong>{getMeetingTitle(meeting)}</strong>
                        <p>{meeting?.description || meeting?.notes || meeting?.agenda || "Activity record"}</p>
                      </div>
                    </td>
                    <td>{meeting?.type || "General"}</td>
                    <td>{formatDate(meeting?.start_at || meeting?.date || meeting?.meeting_date || meeting?.created_at)}</td>
                    <td>{projectLabel}</td>
                    <td>{ownerLabel}</td>
                    <td>
                      <span
                        className={`org-shell-status-badge is-${String(statusLabel)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="org-shell-empty">No activities found for this query.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  const renderPartnersTab = () => (
    <article className="org-shell-panel org-shell-panel--table">
      <div className="org-shell-panel-head">
        <h3>Partners</h3>
        <span>{partnerRows.length} visible</span>
      </div>

      <div className="org-shell-toolbar">
        <label className="org-shell-search">
          <Icon name="search" size={15} />
          <input
            type="text"
            placeholder="Search name, status, contact, linked project"
            value={partnerSearch}
            onChange={(event) => setPartnerSearch(event.target.value)}
          />
        </label>
        <div className="org-shell-toolbar-actions">
          <button type="button" className="project-detail-action ghost" onClick={openCreatePartnerModal}>
            Add partner
          </button>
          <button
            type="button"
            className="project-detail-action ghost"
            disabled={selectedPartners.length !== 1}
            onClick={openEditPartnerModal}
          >
            Edit selected
          </button>
          <button
            type="button"
            className="project-detail-action ghost danger"
            disabled={!selectedPartners.length}
            onClick={requestDeleteSelectedPartners}
          >
            Delete selected
          </button>
        </div>
      </div>

      <div className="projects-table-wrap">
        <table className="projects-table-view">
          <thead>
            <tr>
              <th className="projects-table-check">
                <input
                  type="checkbox"
                  checked={partnerAllSelected}
                  onChange={() => toggleSelectAll(partnerRowIds, selectedPartnerIds, setSelectedPartnerIds)}
                />
              </th>
              <th className="org-shell-partner-logo-col">Logo</th>
              <th>Organization</th>
              <th>Type</th>
              <th>Status</th>
              <th>Linked projects</th>
              <th>Last contact</th>
            </tr>
          </thead>
          <tbody>
            {partnerRows.length ? (
              partnerRows.map((partner) => {
                const partnerLogoUrl = String(partner.logo_url || "").trim();
                const linkedProjectNames = getPartnerLinkedProjectNames(partner);
                return (
                  <tr key={partner.id}>
                    <td className="projects-table-check">
                      <input
                        type="checkbox"
                        checked={selectedPartnerIds.includes(partner.id)}
                        onChange={() => toggleSelection(partner.id, setSelectedPartnerIds)}
                      />
                    </td>
                    <td className="org-shell-partner-logo-cell">
                      {partnerLogoUrl ? (
                        <img
                          src={partnerLogoUrl}
                          alt={`${partner.name} logo`}
                          className="org-shell-partner-logo"
                          loading="lazy"
                        />
                      ) : (
                        <span className="org-shell-partner-logo-fallback" aria-hidden="true">
                          <Icon name="briefcase" size={14} />
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="projects-table-main-copy">
                        <strong>{partner.name}</strong>
                        <p>{partner.contact_person || partner.contact_email || partner.contact_phone || "No contact set"}</p>
                      </div>
                    </td>
                    <td>{partner.kind}</td>
                    <td>
                      <span
                        className={`org-shell-status-badge is-${String(partner.status)
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}`}
                      >
                        {partner.status}
                      </span>
                    </td>
                    <td>
                      {linkedProjectNames.length ? (
                        <div className="org-shell-partner-project-chips">
                          {linkedProjectNames.map((projectName) => (
                            <span key={`${partner.id}-${projectName}`} className="org-shell-partner-project-chip">
                              {projectName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="org-shell-muted">—</span>
                      )}
                    </td>
                    <td>{formatDate(partner.last_contact)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="org-shell-empty">No partners captured yet.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );

  const renderTemplatesTab = () => {
    const templateRows = Array.isArray(organizationTemplates) ? organizationTemplates : [];
    const hasTemplates = templateRows.length > 0;
    const emptyMessage =
      templatesError ||
      "No templates available yet. Upload template files to storage and map them in organization templates.";

    return (
      <article className="org-shell-panel org-shell-panel--table">
        <div className="org-shell-panel-head">
          <h3>Template Library</h3>
          <span>{templateRows.length} templates</span>
        </div>
        <p className="org-shell-muted-copy">
          Download approved templates from secure storage for faster organization workflows.
        </p>
        {templatesError ? <p className="org-shell-form-error">{templatesError}</p> : null}

        <div className="org-shell-template-toolbar">
          <div className="projects-view-toggle" role="tablist" aria-label="Template view mode">
            {TEMPLATE_VIEW_OPTIONS.map((option) => (
              <button
                key={`template-view-${option.key}`}
                type="button"
                className={`projects-view-btn${templateView === option.key ? " active" : ""}`}
                onClick={() => setTemplateView(option.key)}
                role="tab"
                aria-selected={templateView === option.key}
              >
                <Icon name={option.icon} size={14} />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {templateView === "table" ? (
          <div className="projects-table-wrap">
            <table className="projects-table-view">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Category</th>
                  <th>Format</th>
                  <th>Use case</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {hasTemplates ? (
                  templateRows.map((template) => {
                    const sections = Array.isArray(template.sections) ? template.sections : [];
                    const sectionPreview = sections.slice(0, 3).join(" • ");
                    const purpose = String(template?.description || "").trim();
                    return (
                      <tr key={template.id}>
                        <td>
                          <div className="projects-table-main-copy">
                            <strong>{template.name}</strong>
                            <p>{sectionPreview || purpose || "Template sections are not configured yet."}</p>
                          </div>
                        </td>
                        <td>
                          <span className="org-shell-template-category">{template.category}</span>
                        </td>
                        <td>{template.format}</td>
                        <td>{purpose || "—"}</td>
                        <td>
                          <button
                            type="button"
                            className="project-detail-action ghost org-shell-template-download"
                            onClick={() => handleDownloadOrganizationTemplate(template)}
                            disabled={!template.can_download}
                            title={template.can_download ? "Download template" : "No file uploaded yet"}
                          >
                            <Icon name="download" size={15} />
                            <span>Download</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="org-shell-empty">{emptyMessage}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {templateView === "grid" ? (
          hasTemplates ? (
            <div className="org-shell-template-grid">
              {templateRows.map((template) => {
                const sections = Array.isArray(template.sections) ? template.sections : [];
                const tone = getTemplateFormatTone(template.format);
                return (
                  <article key={`template-grid-${template.id}`} className={`org-shell-template-card is-${tone}`}>
                    <div className="org-shell-template-card-visual">
                      <span className="org-shell-template-card-icon" aria-hidden="true">
                        <Icon name={getTemplateCardIcon(template.category)} size={17} />
                      </span>
                      <button
                        type="button"
                        className="org-shell-template-quick-download"
                        onClick={() => handleDownloadOrganizationTemplate(template)}
                        aria-label={`Quick download ${template.name}`}
                        disabled={!template.can_download}
                        title={template.can_download ? "Download template" : "No file uploaded yet"}
                      >
                        <Icon name="download" size={15} />
                      </button>
                    </div>
                    <div className="org-shell-template-card-head">
                      <h4>{template.name}</h4>
                      <span className="org-shell-template-category">{template.category}</span>
                    </div>
                    <p className="org-shell-template-card-purpose">
                      {String(template?.description || "").trim() || "No description available."}
                    </p>
                    <div className="org-shell-template-card-meta">
                      <span>{template.format}</span>
                      <span>{sections.length} sections</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="org-shell-empty">{emptyMessage}</div>
          )
        ) : null}

        {templateView === "list" ? (
          hasTemplates ? (
            <div className="org-shell-template-list">
              {templateRows.map((template) => {
                const sections = Array.isArray(template.sections) ? template.sections : [];
                const purpose = String(template?.description || "").trim();
                return (
                  <article key={`template-list-${template.id}`} className="org-shell-template-list-item">
                    <div className="org-shell-template-list-copy">
                      <h4>{template.name}</h4>
                      <p>{purpose || "No description available."}</p>
                      <div className="org-shell-template-list-meta">
                        <span className="org-shell-template-category">{template.category}</span>
                        <span>{template.format}</span>
                        <span>{sections.length} sections</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="project-detail-action ghost org-shell-template-download"
                      onClick={() => handleDownloadOrganizationTemplate(template)}
                      disabled={!template.can_download}
                      title={template.can_download ? "Download template" : "No file uploaded yet"}
                    >
                      <Icon name="download" size={15} />
                      <span>Download</span>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="org-shell-empty">{emptyMessage}</div>
          )
        ) : null}
      </article>
    );
  };

  return (
    <div className="org-shell">
      <section className="org-shell-card org-shell-card--workspace">
        <header className="org-shell-header">
          <div>
            <h2>Organization Profile</h2>
            <p>
              Manage the whole organization workspace: profile, members, documents, activities, and
              partner relationships.
            </p>
          </div>
          <div className="org-shell-header-actions">
            <button
              type="button"
              className="project-detail-action ghost"
              onClick={() => loadWorkspace({ silent: true })}
              disabled={refreshing || loading}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="project-detail-action" onClick={openOrgEditor}>
              Edit organization
            </button>
          </div>
        </header>

        <div className="org-shell-tabs" role="tablist" aria-label="Organization sections">
          {ORG_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`org-shell-tab${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {notice ? (
          <div className={`projects-notice projects-notice--${notice.type || "success"}`}>
            {notice.message}
          </div>
        ) : null}

        {loadError ? <div className="projects-notice projects-notice--error">{loadError}</div> : null}

        {loading ? (
          <div className="project-expenses-loading org-shell-loading">
            <div className="loading-spinner" />
            <span>Loading organization workspace...</span>
          </div>
        ) : (
          <>
            {activeTab === "overview" ? renderOverviewTab() : null}
            {activeTab === "members" ? renderMembersTab() : null}
            {activeTab === "documents" ? renderDocumentsTab() : null}
            {activeTab === "activities" ? renderActivitiesTab() : null}
            {activeTab === "partners" ? renderPartnersTab() : null}
            {activeTab === "templates" ? renderTemplatesTab() : null}
          </>
        )}
      </section>

      <DataModal
        open={showOrgModal}
        onClose={() => {
          if (savingOrg) return;
          setShowOrgModal(false);
        }}
        title="Edit Organization"
        subtitle="Update public profile, contact info, and governance summary fields."
        icon="briefcase"
      >
        <form className="data-modal-form" onSubmit={handleSaveOrganization}>
          {orgFormError ? <p className="data-modal-feedback data-modal-feedback--error">{orgFormError}</p> : null}

          <div className="data-modal-grid">
            <label className="data-modal-field">
              Organization name
              <input
                type="text"
                value={orgForm.name}
                onChange={(event) => handleOrgFormChange("name", event.target.value)}
                disabled={savingOrg}
                required
              />
            </label>
            <label className="data-modal-field">
              Registration number
              <input
                type="text"
                value={orgForm.registration_number}
                onChange={(event) =>
                  handleOrgFormChange("registration_number", event.target.value)
                }
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field">
              Contact email
              <input
                type="email"
                value={orgForm.contact_email}
                onChange={(event) => handleOrgFormChange("contact_email", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field">
              Contact phone
              <input
                type="tel"
                value={orgForm.contact_phone}
                onChange={(event) => handleOrgFormChange("contact_phone", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Tagline
              <input
                type="text"
                value={orgForm.tagline}
                onChange={(event) => handleOrgFormChange("tagline", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field">
              Location
              <input
                type="text"
                value={orgForm.location}
                onChange={(event) => handleOrgFormChange("location", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field">
              Website
              <input
                type="text"
                value={orgForm.website}
                onChange={(event) => handleOrgFormChange("website", event.target.value)}
                disabled={savingOrg}
                placeholder="https://..."
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Mission
              <textarea
                rows="3"
                value={orgForm.mission}
                onChange={(event) => handleOrgFormChange("mission", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Vision
              <textarea
                rows="3"
                value={orgForm.vision}
                onChange={(event) => handleOrgFormChange("vision", event.target.value)}
                disabled={savingOrg}
              />
            </label>
            <label className="data-modal-field data-modal-field--full org-modal-toggle-field">
              <span>Public tenant profile</span>
              <input
                type="checkbox"
                checked={Boolean(orgForm.is_public)}
                onChange={(event) => handleOrgFormChange("is_public", event.target.checked)}
                disabled={savingOrg}
              />
            </label>
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => setShowOrgModal(false)}
              disabled={savingOrg}
            >
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingOrg}>
              {savingOrg ? "Saving..." : "Save organization"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showMemberEditorModal}
        onClose={closeMemberEditorModal}
        title={editingMemberId ? "Edit Member" : "Add Member"}
        subtitle="Capture member profile details for organization operations and reporting."
        icon="member"
      >
        <form className="data-modal-form" onSubmit={handleSaveMember}>
          {memberFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{memberFormError}</p>
          ) : null}

          <div className="org-shell-member-stepper" role="tablist" aria-label="Member form steps">
            {MEMBER_FORM_STEPS.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = memberFormStep === stepNumber;
              const isComplete = memberFormStep > stepNumber;
              return (
                <button
                  key={step.key}
                  type="button"
                  className={`org-shell-member-step-card${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                  onClick={() => goToMemberFormStep(stepNumber)}
                  disabled={savingMember || uploadingMemberAvatar}
                >
                  <span className="org-shell-member-step-index">{stepNumber}</span>
                  <span className="org-shell-member-step-copy">
                    <strong>{step.label}</strong>
                    <small>{step.note}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="org-shell-member-step-panel">
            {memberFormStep === 1 ? (
              <div className="data-modal-grid">
                <div className="data-modal-field data-modal-field--full org-shell-member-avatar-field">
                  <span>Member photo</span>
                  <div className="org-shell-member-avatar-upload">
                    <div className="org-shell-member-avatar-preview">
                      {String(memberForm.avatar_url || "").trim() ? (
                        <img
                          src={memberForm.avatar_url}
                          alt={`${memberForm.name || "Member"} avatar`}
                          className="org-shell-member-avatar-image"
                        />
                      ) : (
                        <span className="org-shell-member-avatar-fallback" aria-hidden="true">
                          <Icon name="member" size={18} />
                        </span>
                      )}
                    </div>
                    <div className="org-shell-member-avatar-actions">
                      <button
                        type="button"
                        className="project-detail-action ghost"
                        onClick={triggerMemberAvatarPicker}
                        disabled={savingMember || uploadingMemberAvatar}
                      >
                        {uploadingMemberAvatar
                          ? "Uploading..."
                          : memberForm.avatar_url
                            ? "Change photo"
                            : "Upload photo"}
                      </button>
                      {memberForm.avatar_url ? (
                        <button
                          type="button"
                          className="project-detail-action ghost"
                          onClick={() => handleMemberFormChange("avatar_url", "")}
                          disabled={savingMember || uploadingMemberAvatar}
                        >
                          Remove
                        </button>
                      ) : null}
                      <input
                        ref={memberAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="project-documents-file-input"
                        onChange={handleMemberAvatarFileSelection}
                        disabled={savingMember || uploadingMemberAvatar}
                      />
                    </div>
                  </div>
                </div>
                <label className="data-modal-field">
                  Full name
                  <input
                    type="text"
                    value={memberForm.name}
                    onChange={(event) => handleMemberFormChange("name", event.target.value)}
                    disabled={savingMember}
                    required
                  />
                </label>
                <label className="data-modal-field">
                  Phone number
                  <input
                    type="tel"
                    value={memberForm.phone_number}
                    onChange={(event) => handleMemberFormChange("phone_number", event.target.value)}
                    placeholder="+254 700 000 000"
                    disabled={savingMember}
                    required
                  />
                </label>
                <label className="data-modal-field">
                  Email
                  <input
                    type="email"
                    value={memberForm.email}
                    onChange={(event) => handleMemberFormChange("email", event.target.value)}
                    disabled={savingMember}
                    placeholder="name@example.com"
                  />
                </label>
                <label className="data-modal-field">
                  Joined date
                  <input
                    type="date"
                    value={memberForm.join_date}
                    onChange={(event) => handleMemberFormChange("join_date", event.target.value)}
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field">
                  Role
                  <select
                    value={memberForm.role}
                    onChange={(event) => handleMemberFormChange("role", event.target.value)}
                    disabled={savingMember}
                  >
                    {MEMBER_ROLE_OPTIONS.map((option) => (
                      <option key={`member-role-${option}`} value={option}>
                        {option.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="data-modal-field">
                  Status
                  <select
                    value={memberForm.status}
                    onChange={(event) => handleMemberFormChange("status", event.target.value)}
                    disabled={savingMember}
                  >
                    {MEMBER_STATUS_OPTIONS.map((option) => (
                      <option key={`member-status-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {memberFormStep === 2 ? (
              <div className="data-modal-grid">
                <label className="data-modal-field">
                  Gender
                  <select
                    value={memberForm.gender}
                    onChange={(event) => handleMemberFormChange("gender", event.target.value)}
                    disabled={savingMember}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="data-modal-field">
                  Occupation
                  <input
                    type="text"
                    value={memberForm.occupation}
                    onChange={(event) => handleMemberFormChange("occupation", event.target.value)}
                    disabled={savingMember}
                    placeholder="e.g. Farmer"
                  />
                </label>
                <label className="data-modal-field">
                  National ID
                  <input
                    type="text"
                    value={memberForm.national_id}
                    onChange={(event) => handleMemberFormChange("national_id", event.target.value)}
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field">
                  County
                  <input
                    type="text"
                    value={memberForm.county}
                    onChange={(event) => handleMemberFormChange("county", event.target.value)}
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field">
                  Sub-county
                  <input
                    type="text"
                    value={memberForm.sub_county}
                    onChange={(event) => handleMemberFormChange("sub_county", event.target.value)}
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field data-modal-field--full">
                  Member bio
                  <textarea
                    rows="4"
                    value={memberForm.bio}
                    onChange={(event) => handleMemberFormChange("bio", event.target.value)}
                    disabled={savingMember}
                    placeholder="Short member background, skills, and responsibilities."
                  />
                </label>
                <label className="data-modal-field data-modal-field--full">
                  Address
                  <textarea
                    rows="3"
                    value={memberForm.address}
                    onChange={(event) => handleMemberFormChange("address", event.target.value)}
                    disabled={savingMember}
                  />
                </label>
              </div>
            ) : null}

            {memberFormStep === 3 ? (
              <div className="data-modal-grid">
                <label className="data-modal-field">
                  Emergency contact name
                  <input
                    type="text"
                    value={memberForm.emergency_contact_name}
                    onChange={(event) =>
                      handleMemberFormChange("emergency_contact_name", event.target.value)
                    }
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field">
                  Emergency contact phone
                  <input
                    type="text"
                    value={memberForm.emergency_contact_phone}
                    onChange={(event) =>
                      handleMemberFormChange("emergency_contact_phone", event.target.value)
                    }
                    disabled={savingMember}
                  />
                </label>
                <label className="data-modal-field data-modal-field--full">
                  Emergency contact relationship
                  <input
                    type="text"
                    value={memberForm.emergency_contact_relationship}
                    onChange={(event) =>
                      handleMemberFormChange("emergency_contact_relationship", event.target.value)
                    }
                    disabled={savingMember}
                    placeholder="e.g. Spouse, sibling"
                  />
                </label>
                <div className="data-modal-field data-modal-field--full org-shell-member-review">
                  <span>Review summary</span>
                  <ul className="org-shell-member-review-list">
                    <li>
                      <strong>Name:</strong> {memberForm.name || "—"}
                    </li>
                    <li>
                      <strong>Phone:</strong> {memberForm.phone_number || "—"}
                    </li>
                    <li>
                      <strong>Email:</strong> {memberForm.email || "—"}
                    </li>
                    <li>
                      <strong>Role:</strong> {memberForm.role || "member"}
                    </li>
                    <li>
                      <strong>Location:</strong> {memberForm.county || memberForm.sub_county || "—"}
                    </li>
                  </ul>
                </div>
              </div>
            ) : null}
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeMemberEditorModal}
              disabled={savingMember || uploadingMemberAvatar}
            >
              Cancel
            </button>
            {memberFormStep > 1 ? (
              <button
                type="button"
                className="data-modal-btn"
                onClick={handlePreviousMemberFormStep}
                disabled={savingMember || uploadingMemberAvatar}
              >
                Back
              </button>
            ) : null}
            {!isFinalMemberFormStep ? (
              <button
                type="button"
                className="data-modal-btn data-modal-btn--primary"
                onClick={handleNextMemberFormStep}
                disabled={savingMember || uploadingMemberAvatar}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="data-modal-btn data-modal-btn--primary"
                disabled={savingMember || uploadingMemberAvatar}
              >
                {savingMember ? "Saving..." : editingMemberId ? "Save member" : "Create member"}
              </button>
            )}
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showMemberModal && Boolean(selectedMember)}
        onClose={() => setShowMemberModal(false)}
        title={selectedMember?.name || "Member"}
        subtitle="Member details from the organization roster."
        icon="member"
      >
        {selectedMember ? (
          <div className="org-shell-detail-grid">
            <div>
              <strong>Role</strong>
              <p>{String(selectedMember.role || "member").replace(/_/g, " ")}</p>
            </div>
            <div>
              <strong>Status</strong>
              <p>{selectedMember.status || "active"}</p>
            </div>
            <div>
              <strong>Email</strong>
              <p>{selectedMember.email || "—"}</p>
            </div>
            <div>
              <strong>Phone</strong>
              <p>{selectedMember.phone_number || "—"}</p>
            </div>
            <div>
              <strong>Joined</strong>
              <p>{formatDate(selectedMember.join_date)}</p>
            </div>
            <div>
              <strong>Location</strong>
              <p>{selectedMember.county || selectedMember.sub_county || "—"}</p>
            </div>
            <div className="org-shell-detail-full">
              <strong>Bio</strong>
              <p>{String(selectedMember.bio || "").trim() || "—"}</p>
            </div>
          </div>
        ) : null}
      </DataModal>

      {/* Choice Modal: Add vs Invite */}
      <ChoiceModal
        open={showChoiceModal}
        onClose={() => setShowChoiceModal(false)}
        title="Add New Member"
        message="How would you like to add this member?"
        option1Label="Add Member"
        option1Icon="user-plus"
        option1Description="Create a member profile directly"
        onOption1Click={() => {
          setShowChoiceModal(false);
          openCreateMemberModal();
        }}
        option2Label="Invite Member"
        option2Icon="mail"
        option2Description="Send an invite for them to register"
        onOption2Click={() => {
          setShowChoiceModal(false);
          setShowInviteModal(true);
        }}
      />

      {/* Invite Modal */}
      <DataModal
        open={showInviteModal}
        onClose={closeInviteModal}
        title="Invite member"
        subtitle="Send an invite and assign a role before they join."
        icon="mail"
      >
        <form className="data-modal-form" onSubmit={handleInviteSubmit}>
          <div className="data-modal-grid">
            <div className="data-modal-field data-modal-field--full">
              <label>Email *</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => handleInviteFormChange("email", e.target.value)}
                placeholder="member@example.com"
                disabled={submittingInvite}
                required
              />
            </div>

            <div className="data-modal-field">
              <label>Name</label>
              <input
                type="text"
                value={inviteForm.name}
                onChange={(e) => handleInviteFormChange("name", e.target.value)}
                placeholder="Full name"
                disabled={submittingInvite}
              />
            </div>

            <div className="data-modal-field">
              <label>Phone</label>
              <input
                type="tel"
                value={inviteForm.phone_number}
                onChange={(e) => handleInviteFormChange("phone_number", e.target.value)}
                placeholder="+254 700 000 000"
                disabled={submittingInvite}
              />
            </div>

            <div className="data-modal-field">
              <label>Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) => handleInviteFormChange("role", e.target.value)}
                disabled={submittingInvite}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="project_manager">Project Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            <div className="data-modal-field data-modal-field--full">
              <label>Notes</label>
              <textarea
                value={inviteForm.notes}
                onChange={(e) => handleInviteFormChange("notes", e.target.value)}
                placeholder="Optional welcome message or instructions"
                disabled={submittingInvite}
                rows="3"
              />
            </div>
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeInviteModal}
              disabled={submittingInvite}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={submittingInvite}
            >
              {submittingInvite ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </DataModal>

      {/* Response Modal for Invite Success/Error */}
      <ResponseModal
        open={showResponseModal}
        onClose={closeResponseModal}
        type={responseData.type}
        title={responseData.title}
        message={responseData.message}
        code={responseData.code}
        codeLabel="Invite Number"
        onCopyCode={() => {
          navigator.clipboard.writeText(responseData.code);
        }}
      />

      <DataModal
        open={showMeetingModal && Boolean(selectedMeeting)}
        onClose={() => setShowMeetingModal(false)}
        title={selectedMeeting ? getMeetingTitle(selectedMeeting) : "Activity"}
        subtitle="Activity details from organization meetings."
        icon="calendar"
      >
        {selectedMeeting ? (
          <div className="org-shell-detail-grid">
            <div>
              <strong>Category</strong>
              <p>{selectedMeeting.type || "General"}</p>
            </div>
            <div>
              <strong>Status</strong>
              <p>{getMeetingStatus(selectedMeeting)}</p>
            </div>
            <div>
              <strong>Date</strong>
              <p>
                {formatDate(
                  selectedMeeting.start_at ||
                    selectedMeeting.date ||
                    selectedMeeting.meeting_date ||
                    selectedMeeting.created_at
                )}
              </p>
            </div>
            <div>
              <strong>Location</strong>
              <p>{selectedMeeting.location || "—"}</p>
            </div>
            <div>
              <strong>Project</strong>
              <p>{partnerProjectNameById.get(String(selectedMeeting.project_id || "").trim()) || "—"}</p>
            </div>
            <div>
              <strong>Owner</strong>
              <p>{memberNameById.get(String(selectedMeeting.owner_member_id || "").trim()) || "—"}</p>
            </div>
            <div className="org-shell-detail-full">
              <strong>Agenda</strong>
              <p>{selectedMeeting.agenda || "—"}</p>
            </div>
            <div className="org-shell-detail-full">
              <strong>Details</strong>
              <p>{selectedMeeting.description || selectedMeeting.notes || selectedMeeting.minutes || "—"}</p>
            </div>
            <div className="org-shell-detail-full">
              <strong>Minutes</strong>
              <p>{selectedMeeting.minutes || "—"}</p>
            </div>
          </div>
        ) : null}
      </DataModal>

      <DataModal
        open={showMeetingEditorModal}
        onClose={closeMeetingEditorModal}
        title={editingMeetingId ? "Edit activity" : "Add activity"}
        subtitle="Capture organization-level activities and governance records."
        icon="calendar"
      >
        <form className="data-modal-form" onSubmit={handleSaveActivity}>
          {meetingFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{meetingFormError}</p>
          ) : null}

          <div className="data-modal-grid">
            <label className="data-modal-field">
              Activity title
              <input
                type="text"
                value={meetingForm.title}
                onChange={(event) => handleMeetingFormChange("title", event.target.value)}
                disabled={savingMeeting}
                required
              />
            </label>
            <label className="data-modal-field">
              Type
              <select
                value={meetingForm.type}
                onChange={(event) => handleMeetingFormChange("type", event.target.value)}
                disabled={savingMeeting}
              >
                {Array.from(new Set([...ACTIVITY_TYPE_OPTIONS, meetingForm.type].filter(Boolean))).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Date
              <input
                type="date"
                value={meetingForm.date}
                onChange={(event) => handleMeetingFormChange("date", event.target.value)}
                disabled={savingMeeting}
                required
              />
            </label>
            <label className="data-modal-field">
              Status
              <select
                value={meetingForm.status}
                onChange={(event) => handleMeetingFormChange("status", event.target.value)}
                disabled={savingMeeting}
              >
                {ACTIVITY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {toDisplayLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Start time
              <input
                type="datetime-local"
                value={meetingForm.startAt}
                onChange={(event) => handleMeetingFormChange("startAt", event.target.value)}
                disabled={savingMeeting}
              />
            </label>
            <label className="data-modal-field">
              End time
              <input
                type="datetime-local"
                value={meetingForm.endAt}
                onChange={(event) => handleMeetingFormChange("endAt", event.target.value)}
                disabled={savingMeeting}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Location
              <input
                type="text"
                value={meetingForm.location}
                onChange={(event) => handleMeetingFormChange("location", event.target.value)}
                placeholder="e.g. Community hall, Kajiado"
                disabled={savingMeeting}
              />
            </label>
            <label className="data-modal-field">
              Linked project
              <select
                value={meetingForm.projectId}
                onChange={(event) => handleMeetingFormChange("projectId", event.target.value)}
                disabled={savingMeeting}
              >
                <option value="">No linked project</option>
                {partnerProjectOptions.map((project) => (
                  <option key={`activity-project-${project.id}`} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Owner
              <select
                value={meetingForm.ownerMemberId}
                onChange={(event) => handleMeetingFormChange("ownerMemberId", event.target.value)}
                disabled={savingMeeting}
              >
                <option value="">No owner</option>
                {members.map((member) => (
                  <option key={`activity-owner-${member.id}`} value={String(member.id)}>
                    {member.name || `Member #${member.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field data-modal-field--full">
              Agenda
              <textarea
                rows={3}
                value={meetingForm.agenda}
                onChange={(event) => handleMeetingFormChange("agenda", event.target.value)}
                placeholder="Outline agenda, objectives, or milestones."
                disabled={savingMeeting}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Description
              <textarea
                rows={3}
                value={meetingForm.description}
                onChange={(event) => handleMeetingFormChange("description", event.target.value)}
                placeholder="Capture summary details for this activity."
                disabled={savingMeeting}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Minutes
              <textarea
                rows={4}
                value={meetingForm.minutes}
                onChange={(event) => handleMeetingFormChange("minutes", event.target.value)}
                placeholder="Document decisions, action points, and owners."
                disabled={savingMeeting}
              />
            </label>
            <div className="data-modal-field data-modal-field--full">
              Attendees
              {members.length ? (
                <div className="org-shell-activity-attendee-picker">
                  {members.map((member) => {
                    const memberId = String(member?.id || "").trim();
                    if (!memberId) return null;
                    const checked = meetingForm.attendeeMemberIds.includes(memberId);
                    return (
                      <label key={`activity-attendee-${memberId}`} className="org-shell-activity-attendee-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMeetingAttendee(memberId)}
                          disabled={savingMeeting}
                        />
                        <span>{member?.name || `Member #${memberId}`}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="org-shell-muted">Create members first to assign attendees.</p>
              )}
            </div>
          </div>

          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeMeetingEditorModal} disabled={savingMeeting}>
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingMeeting}>
              {savingMeeting ? "Saving..." : editingMeetingId ? "Save activity" : "Create activity"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showDeleteMeetingsModal}
        onClose={closeDeleteMeetingsModal}
        title="Delete activities"
        subtitle="This action cannot be undone."
        icon="alert"
      >
        <p className="org-shell-muted-copy">
          Delete {selectedMeetings.length} selected activit{selectedMeetings.length === 1 ? "y" : "ies"}?
        </p>
        <div className="data-modal-actions">
          <button type="button" className="data-modal-btn" onClick={closeDeleteMeetingsModal} disabled={deletingMeetings}>
            Cancel
          </button>
          <button
            type="button"
            className="data-modal-btn data-modal-btn--danger"
            onClick={handleConfirmDeleteSelectedActivities}
            disabled={deletingMeetings}
          >
            {deletingMeetings ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      </DataModal>

      <DataModal
        open={showRenameDocumentModal}
        onClose={closeRenameOrganizationDocumentModal}
        title="Rename Document"
        subtitle="Update the selected organization document name."
        icon="folder"
      >
        <form className="data-modal-form" onSubmit={handleConfirmRenameOrganizationDocument}>
          {organizationDocumentRenameError ? (
            <p className="data-modal-feedback data-modal-feedback--error">
              {organizationDocumentRenameError}
            </p>
          ) : null}
          <div className="data-modal-grid">
            <label className="data-modal-field data-modal-field--full">
              Document name
              <input
                type="text"
                value={organizationDocumentRenameValue}
                onChange={(event) => {
                  setOrganizationDocumentRenameValue(event.target.value);
                  if (organizationDocumentRenameError) setOrganizationDocumentRenameError("");
                }}
                disabled={renamingOrganizationDocument}
                required
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeRenameOrganizationDocumentModal}
              disabled={renamingOrganizationDocument}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={renamingOrganizationDocument}
            >
              {renamingOrganizationDocument ? "Saving..." : "Save name"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showDeleteDocumentsModal}
        onClose={closeDeleteDocumentsModal}
        title={`Delete ${selectedDocuments.length} document${selectedDocuments.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
      >
        <div className="projects-confirm-modal">
          <p>Selected organization documents will be removed from this workspace.</p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeDeleteDocumentsModal}
              disabled={deletingOrganizationDocuments}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleConfirmDeleteSelectedDocuments}
              disabled={deletingOrganizationDocuments || selectedDocuments.length === 0}
            >
              {deletingOrganizationDocuments ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showPartnerModal}
        onClose={() => {
          if (savingPartner) return;
          setPartnerFormStep(1);
          setPartnerLogoUploadName("");
          setShowPartnerModal(false);
        }}
        title={editingPartnerId ? "Edit Partner" : "Add Partner"}
        subtitle="Maintain partner relationship records at organization level."
        icon="users"
      >
        <form
          className="data-modal-form"
          onSubmit={(event) => {
            if (partnerFormStep < PARTNER_FORM_STEPS.length) {
              event.preventDefault();
              handleNextPartnerFormStep();
              return;
            }
            handleSavePartner(event);
          }}
        >
          {partnerFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{partnerFormError}</p>
          ) : null}

          <div className="org-shell-member-stepper org-shell-partner-stepper">
            {PARTNER_FORM_STEPS.map((step, index) => {
              const stepNumber = index + 1;
              const isActive = partnerFormStep === stepNumber;
              const isComplete = partnerFormStep > stepNumber;
              return (
                <button
                  key={`partner-form-step-${step.key}`}
                  type="button"
                  className={`org-shell-member-step-card${isActive ? " is-active" : ""}${
                    isComplete ? " is-complete" : ""
                  }`}
                  onClick={() => goToPartnerFormStep(stepNumber)}
                  disabled={savingPartner}
                >
                  <span className="org-shell-member-step-index">{stepNumber}</span>
                  <span className="org-shell-member-step-copy">
                    <strong>{step.label}</strong>
                    <small>{step.note}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="org-shell-member-step-panel">
            {partnerFormStep === 1 ? (
              <div className="data-modal-grid">
                <label className="data-modal-field">
                  Name
                  <input
                    type="text"
                    value={partnerForm.name}
                    onChange={(event) => handlePartnerFormChange("name", event.target.value)}
                    disabled={savingPartner}
                    required
                  />
                </label>
                <label className="data-modal-field">
                  Type
                  <select
                    value={partnerForm.kind}
                    onChange={(event) => handlePartnerFormChange("kind", event.target.value)}
                    disabled={savingPartner}
                  >
                    {PARTNER_KIND_OPTIONS.map((option) => (
                      <option key={`partner-kind-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="data-modal-field">
                  Status
                  <select
                    value={partnerForm.status}
                    onChange={(event) => handlePartnerFormChange("status", event.target.value)}
                    disabled={savingPartner}
                  >
                    {PARTNER_STATUS_OPTIONS.map((option) => (
                      <option key={`partner-status-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="data-modal-field">
                  Last contact
                  <input
                    type="date"
                    value={partnerForm.last_contact}
                    onChange={(event) => handlePartnerFormChange("last_contact", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
                <label className="data-modal-field data-modal-field--full">
                  Logo URL
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={partnerForm.logo_url}
                    onChange={(event) => handlePartnerFormChange("logo_url", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
                <div className="data-modal-field data-modal-field--full">
                  <span>Logo file (optional)</span>
                  <div className="org-shell-partner-logo-upload">
                    <button
                      type="button"
                      className="data-modal-inline-btn"
                      onClick={triggerPartnerLogoPicker}
                      disabled={savingPartner}
                    >
                      Upload logo
                    </button>
                    <span className="org-shell-partner-logo-upload-name">
                      {partnerLogoUploadName || "No file selected"}
                    </span>
                    {String(partnerForm.logo_url || "").trim() ? (
                      <button
                        type="button"
                        className="data-modal-inline-btn"
                        onClick={clearPartnerLogo}
                        disabled={savingPartner}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={partnerLogoInputRef}
                    type="file"
                    className="project-documents-file-input"
                    accept="image/*"
                    onChange={handlePartnerLogoFileSelection}
                    disabled={savingPartner}
                  />
                  <small>Upload PNG/JPG/SVG up to 2MB if you do not have a URL.</small>
                </div>
                {String(partnerForm.logo_url || "").trim() ? (
                  <div className="data-modal-field data-modal-field--full">
                    <span>Logo preview</span>
                    <div className="org-shell-partner-logo-preview">
                      <img
                        src={String(partnerForm.logo_url || "").trim()}
                        alt="Partner logo preview"
                        className="org-shell-partner-logo-preview-image"
                        loading="lazy"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="data-modal-grid">
                <label className="data-modal-field">
                  Contact person
                  <input
                    type="text"
                    value={partnerForm.contact_person}
                    onChange={(event) => handlePartnerFormChange("contact_person", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
                <label className="data-modal-field">
                  Contact email
                  <input
                    type="email"
                    value={partnerForm.contact_email}
                    onChange={(event) => handlePartnerFormChange("contact_email", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
                <label className="data-modal-field data-modal-field--full">
                  Contact phone
                  <input
                    type="text"
                    value={partnerForm.contact_phone}
                    onChange={(event) => handlePartnerFormChange("contact_phone", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
                <div className="data-modal-field data-modal-field--full">
                  <span>Linked projects</span>
                  {partnerProjectOptions.length ? (
                    <div className="org-shell-partner-project-picker">
                      {partnerProjectOptions.map((project) => {
                        const checked = (partnerForm.linked_project_ids || []).includes(project.id);
                        return (
                          <label key={`partner-project-${project.id}`} className="org-shell-partner-project-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePartnerLinkedProject(project.id)}
                              disabled={savingPartner}
                            />
                            <span>{project.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="org-shell-muted">Create a project first, then link this partner.</p>
                  )}
                  <small>At least one linked project is required.</small>
                </div>
                <label className="data-modal-field data-modal-field--full">
                  Notes
                  <textarea
                    rows="4"
                    value={partnerForm.notes}
                    onChange={(event) => handlePartnerFormChange("notes", event.target.value)}
                    disabled={savingPartner}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => {
                if (savingPartner) return;
                setPartnerFormStep(1);
                setPartnerLogoUploadName("");
                setShowPartnerModal(false);
              }}
              disabled={savingPartner}
            >
              Cancel
            </button>
            {partnerFormStep > 1 ? (
              <button
                type="button"
                className="data-modal-btn"
                onClick={handlePreviousPartnerFormStep}
                disabled={savingPartner}
              >
                Back
              </button>
            ) : null}
            {partnerFormStep < PARTNER_FORM_STEPS.length ? (
              <button
                type="button"
                className="data-modal-btn data-modal-btn--primary"
                onClick={handleNextPartnerFormStep}
                disabled={savingPartner}
              >
                Next
              </button>
            ) : (
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={savingPartner}
            >
              {savingPartner ? "Saving..." : editingPartnerId ? "Save changes" : "Add partner"}
            </button>
            )}
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showDeletePartnerModal}
        onClose={() => {
          if (savingPartner) return;
          setShowDeletePartnerModal(false);
        }}
        title={`Delete ${selectedPartners.length} partner${selectedPartners.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
      >
        <div className="projects-confirm-modal">
          <p>Selected partner records will be permanently removed from this organization profile.</p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => setShowDeletePartnerModal(false)}
              disabled={savingPartner}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleDeleteSelectedPartners}
              disabled={savingPartner || !selectedPartners.length}
            >
              {savingPartner ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>
    </div>
  );
}

export { OrganizationPage };
export default OrganizationPage;
