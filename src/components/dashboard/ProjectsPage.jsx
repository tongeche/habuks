import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  applyMagicLinkInviteProjectAccess,
  archiveProjectExpenseCategory,
  createProjectMagicLinkInvite,
  createIgaBudgetEntries,
  createProjectExpense,
  createProjectMediaAssets,
  createProjectNote,
  createProjectTask,
  createProjectExpenseCategory,
  deleteProjectDocument,
  deleteProjectExpense,
  deleteProjectMediaAssets,
  deleteProjectNote,
  deleteProjectTask,
  deleteIgaProject,
  createProjectMemberAssignments,
  createIgaProject,
  getProjectDocuments,
  getProjectExpenseCategoryDefinitions,
  getProjectEditorData,
  getProjectExpenses,
  getMyProjectMagicLinkInvites,
  getProjectMagicLinkInvites,
  getProjectNotes,
  getProjectTasks,
  getProjectsWithMembership,
  getProjectAssignableMembers,
  getTenantById,
  joinProject,
  leaveProject,
  renameProjectExpenseCategory,
  renameProjectDocument,
  replaceIgaProjectBudgetPlan,
  setIgaProjectVisibility,
  syncProjectMemberAssignments,
  updateIgaProject,
  updateProjectNote,
  updateProjectExpense,
  updateProjectTask,
  updateTenant,
  uploadProjectDocument,
  uploadProjectExpenseReceipt,
  markMagicLinkInviteUsed,
  verifyMagicLinkInvite,
} from "../../lib/dataService.js";
import { presentAppError } from "../../lib/appErrors.js";
import { formatCurrencyAmount } from "../../lib/currency.js";
import { buildProjectTemplateOfficialReportFile } from "../../lib/reporting/projectTemplateOfficialReport.js";
import { normalizeProjectId } from "../../lib/projectIds.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import ProjectEditorForm from "./ProjectEditorForm.jsx";
import ResponseModal from "./ResponseModal.jsx";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";

const projectPageMap = {
  jpp: "projects-jpp",
  jgf: "projects-jgf",
};

const PROJECT_DETAIL_TAB_META = {
  overview: { label: "Overview", icon: "home" },
  expenses: { label: "Expenses", icon: "wallet" },
  documents: { label: "Documents", icon: "folder" },
  files: { label: "Files", icon: "folder" },
  tasks: { label: "Tasks", icon: "check" },
  notes: { label: "Notes", icon: "newspaper" },
  invites: { label: "Invites", icon: "mail" },
};

const PROJECT_MOBILE_PILLS = [
  { key: "overview", label: "Overview" },
  { key: "expenses", label: "Expenses" },
  { key: "documents", label: "Docs" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Notes" },
];

const PROJECT_VIEW_OPTIONS = [
  { key: "grid", label: "Grid", icon: "layers" },
  { key: "table", label: "Table", icon: "menu" },
  { key: "list", label: "List", icon: "newspaper" },
];

const DEFAULT_PROJECT_CATEGORY_OPTIONS = [
  "Community Development",
  "Livelihoods",
  "Agriculture",
  "Food Security",
  "Education",
  "Health",
  "WASH",
  "Youth Empowerment",
  "Women Empowerment",
  "Child Protection",
  "Disability Inclusion",
  "Climate Resilience",
  "Environment & Conservation",
  "Skills & Vocational Training",
  "Savings & Microfinance",
  "Social Protection",
  "Governance & Advocacy",
  "Peacebuilding",
  "Emergency Response",
  "Community Infrastructure",
];

const DEFAULT_PROJECT_CATEGORY_LABEL = DEFAULT_PROJECT_CATEGORY_OPTIONS[0];

const resolveModuleKey = (project) => {
  const raw = project?.module_key || project?.code || "";
  const lower = String(raw).trim().toLowerCase();
  if (lower === "jpp" || lower === "jgf") return lower;
  const upper = String(raw).trim().toUpperCase();
  if (upper === "JPP") return "jpp";
  if (upper === "JGF") return "jgf";
  return "";
};

const normalizeProjectCategoryKey = (value, fallback = "generic") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const normalized = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!normalized) return fallback;
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) return fallback;
  return normalized;
};

const formatProjectCategoryLabel = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return DEFAULT_PROJECT_CATEGORY_LABEL;

  const source = raw.replace(/[_-]+/g, " ");
  const words = source
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return DEFAULT_PROJECT_CATEGORY_LABEL;

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (lower === "cbo" || lower === "fbo" || lower === "ngo" || lower === "wash" || lower === "jpp" || lower === "jgf") {
        return lower.toUpperCase();
      }
      if (index > 0 && ["and", "or", "of", "for", "to", "the", "in"].includes(lower)) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
};

const createInitialProjectForm = () => ({
  name: "",
  moduleKey: DEFAULT_PROJECT_CATEGORY_LABEL,
  startDate: "",
  status: "active",
  summary: "",
  totalBudget: "",
  expectedRevenue: "",
  fundingSource: "member_contributions",
  payoutSchedule: "monthly",
  budgetNotes: "",
  primaryContactId: "",
  primaryContactRole: "Project lead",
  memberToAddId: "",
  selectedMemberIds: [],
  memberDirectory: [],
  existingMedia: [],
  removedMediaIds: [],
  mediaFiles: [],
});

const createInitialExpenseForm = () => ({
  title: "",
  amount: "",
  category: "Supplies",
  vendor: "",
  date: new Date().toISOString().slice(0, 10),
  paymentReference: "",
  receiptFile: null,
  existingReceiptUrl: "",
  existingReceiptPath: "",
  notes: "",
});

const createInitialTaskForm = () => ({
  title: "",
  assigneeId: "",
  dueDate: "",
  priority: "normal",
  status: "open",
  details: "",
});

const createInitialNoteForm = () => ({
  title: "",
  visibility: "project_team",
  visibleMemberIds: [],
  details: "",
});

const createInitialProjectInviteForm = () => ({
  email: "",
  phone_number: "",
  role: "member",
  notes: "",
});

const createInitialAcceptProjectInviteForm = () => ({
  inviteNumber: "",
});

const normalizeInviteNumberInput = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "");

const normalizeRoleKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const DEFAULT_EXPENSE_CATEGORIES = [
  "Supplies",
  "Transport",
  "Labor",
  "Equipment",
  "Utilities",
  "Feed",
  "Maintenance",
  "Operations",
  "Other",
];

const PROJECT_EXPENSE_TONES = [
  "emerald",
  "blue",
  "amber",
  "orange",
  "rose",
  "teal",
  "cyan",
  "slate",
  "violet",
];

const getProjectExpenseCategoryTone = (category) => {
  if (!category) return "slate";
  const normalized = String(category).toLowerCase();
  if (normalized.includes("transport") || normalized.includes("travel")) return "violet";
  if (normalized.includes("feed") || normalized.includes("food") || normalized.includes("grocery")) {
    return "orange";
  }
  if (normalized.includes("raw") || normalized.includes("supply") || normalized.includes("material")) {
    return "blue";
  }
  if (normalized.includes("packag")) return "rose";
  if (normalized.includes("utilit") || normalized.includes("housing") || normalized.includes("rent")) {
    return "teal";
  }
  if (normalized.includes("med") || normalized.includes("health")) return "amber";
  if (normalized.includes("labor") || normalized.includes("staff") || normalized.includes("team")) {
    return "emerald";
  }
  if (normalized.includes("maint") || normalized.includes("repair") || normalized.includes("operation")) {
    return "cyan";
  }
  let hash = 0;
  const label = String(category);
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) % 2147483647;
  }
  return PROJECT_EXPENSE_TONES[Math.abs(hash) % PROJECT_EXPENSE_TONES.length];
};

const getProjectExpenseCategoryIcon = (category) => {
  if (!category) return "receipt";
  const normalized = String(category).toLowerCase();
  if (normalized.includes("transport") || normalized.includes("travel")) return "truck";
  if (normalized.includes("food") || normalized.includes("feed") || normalized.includes("grocery")) {
    return "wallet";
  }
  if (normalized.includes("housing") || normalized.includes("rent") || normalized.includes("utilit")) {
    return "home";
  }
  if (normalized.includes("packag") || normalized.includes("label")) return "tag";
  if (normalized.includes("med") || normalized.includes("health")) return "heart";
  if (normalized.includes("labor") || normalized.includes("staff") || normalized.includes("team")) {
    return "users";
  }
  if (normalized.includes("maint") || normalized.includes("repair") || normalized.includes("operation")) {
    return "settings";
  }
  if (normalized.includes("market") || normalized.includes("sale")) return "trending-up";
  return "receipt";
};

const hasExpenseReceiptFile = (expense) => {
  if (!expense || typeof expense !== "object") return false;
  const hasResolvedReceiptUrl =
    Boolean(String(expense?.receipt_download_url || "").trim()) ||
    Boolean(String(expense?.receipt_file_url || "").trim());
  const hasStoragePath = Boolean(String(expense?.receipt_file_path || "").trim());
  if (expense?.receipt_storage_missing) {
    return hasResolvedReceiptUrl;
  }
  return Boolean(expense?.receipt) || hasResolvedReceiptUrl || hasStoragePath;
};

const hasExpenseProof = (expense) =>
  hasExpenseReceiptFile(expense) || Boolean(String(expense?.payment_reference || "").trim());

const asPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const normalizePartnerLookupKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const getTenantOrganizationProfile = (siteData) => {
  const safeSiteData = asPlainObject(siteData);
  return asPlainObject(safeSiteData.organization_profile);
};

const getTenantOrganizationPartners = (siteData) => {
  const profile = getTenantOrganizationProfile(siteData);
  const source = Array.isArray(profile.partners) ? profile.partners : [];
  return source
    .map((partner, index) => {
      const row = asPlainObject(partner);
      const fallbackId = `partner-${index + 1}`;
      const rawLinkedProjects = Array.isArray(row.linked_project_ids)
        ? row.linked_project_ids
        : Array.isArray(row.linked_projects)
          ? row.linked_projects
          : [];
      const linkedProjectIds = rawLinkedProjects
        .map((projectRef) => {
          if (projectRef && typeof projectRef === "object") {
            const objectRef = asPlainObject(projectRef);
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
        id: String(row.id || fallbackId),
        name: String(row.name || "").trim(),
        kind: String(row.kind || "Partner").trim() || "Partner",
        status: String(row.status || "Active").trim() || "Active",
        contact_person: String(row.contact_person || "").trim(),
        contact_email: String(row.contact_email || "").trim(),
        contact_phone: String(row.contact_phone || "").trim(),
        last_contact: String(row.last_contact || "").trim(),
        notes: String(row.notes || "").trim(),
        logo_url: String(row.logo_url || row.logo || "").trim(),
        linked_project_ids: Array.from(new Set(linkedProjectIds)),
      };
    })
    .filter((row) => row.name);
};

const buildTenantSiteDataWithPartners = (siteData, partners) => {
  const safeSiteData = asPlainObject(siteData);
  const profile = getTenantOrganizationProfile(safeSiteData);
  return {
    ...safeSiteData,
    organization_profile: {
      ...profile,
      partners,
    },
  };
};

const getProjectExpenseVendorLogo = (expense) => {
  const candidates = [
    expense?.vendor_logo_url,
    expense?.vendorLogoUrl,
    expense?.partner_logo_url,
    expense?.partnerLogoUrl,
    expense?.logo_url,
    expense?.logoUrl,
    expense?.vendor_meta?.logo_url,
    expense?.vendor_profile?.logo_url,
    expense?.partner?.logo_url,
    expense?.partner?.logoUrl,
  ];
  const match = candidates.find((value) => typeof value === "string" && value.trim());
  return String(match || "").trim();
};

const getProjectExpenseVendorInitials = (vendorName) => {
  const words = String(vendorName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "NA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
};

const ProjectExpenseVendorCell = ({ expense, partnerByName }) => {
  const vendorName = String(expense?.vendor || "").trim() || "Unknown vendor";
  const partnerMatch = partnerByName?.get(normalizePartnerLookupKey(vendorName)) || null;
  const vendorLogo = getProjectExpenseVendorLogo(expense) || String(partnerMatch?.logo_url || "").trim();
  const vendorInitials = getProjectExpenseVendorInitials(vendorName);
  const [showLogo, setShowLogo] = useState(Boolean(vendorLogo));

  useEffect(() => {
    setShowLogo(Boolean(vendorLogo));
  }, [vendorLogo]);

  return (
    <div className="project-expense-vendor">
      {showLogo ? (
        <img
          className="project-expense-vendor-logo"
          src={vendorLogo}
          alt={`${vendorName} logo`}
          loading="lazy"
          onError={() => setShowLogo(false)}
        />
      ) : (
        <span className="project-expense-vendor-fallback" aria-hidden="true">
          {vendorInitials}
        </span>
      )}
      <span className="project-expense-vendor-name">{vendorName}</span>
    </div>
  );
};

const FUNDING_SOURCE_LABELS = {
  member_contributions: "Member contributions",
  grant: "Grant",
  loan: "Loan",
  mixed: "Mixed",
};

const PAYOUT_SCHEDULE_LABELS = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  on_completion: "On completion",
};

const PROJECT_SUMMARY_OBJECTIVE_BY_CATEGORY = [
  {
    keywords: ["agriculture", "food security", "livelihood", "savings", "microfinance"],
    objective:
      "It focuses on improving household incomes, reducing vulnerability, and strengthening member livelihoods through practical implementation.",
  },
  {
    keywords: ["education", "skills", "vocational", "youth", "women", "child"],
    objective:
      "It focuses on improving skills, inclusion, and long-term community outcomes through structured activities and measurable milestones.",
  },
  {
    keywords: ["health", "wash", "disability", "social protection"],
    objective:
      "It focuses on improving service access, well-being, and accountability for targeted members and households.",
  },
  {
    keywords: ["climate", "environment", "conservation", "resilience", "infrastructure"],
    objective:
      "It focuses on resilient community systems, sustainable resource use, and practical local adaptation actions.",
  },
  {
    keywords: ["governance", "advocacy", "peacebuilding", "emergency", "response"],
    objective:
      "It focuses on coordinated delivery, strong local governance, and timely support for priority community needs.",
  },
];

const resolveProjectSummaryObjective = (categoryLabel) => {
  const normalizedCategory = String(categoryLabel || "")
    .trim()
    .toLowerCase();
  if (!normalizedCategory) {
    return "It focuses on coordinated, member-led implementation with clear outcomes and accountability.";
  }

  const match = PROJECT_SUMMARY_OBJECTIVE_BY_CATEGORY.find((entry) =>
    entry.keywords.some((keyword) => normalizedCategory.includes(keyword))
  );

  return (
    match?.objective ||
    "It focuses on coordinated, member-led implementation with clear outcomes and accountability."
  );
};

const TASK_PRIORITY_LABELS = {
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const TASK_STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const TASK_STATUS_GROUP_ORDER = ["open", "in_progress", "done", "cancelled"];

const TASK_STATUS_GROUP_LABELS = {
  open: "To-do",
  in_progress: "On Progress",
  done: "Completed",
  cancelled: "Cancelled",
};

const MOBILE_TASK_STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Completed" },
];

const NOTE_VISIBILITY_LABELS = {
  project_team: "Project team",
  selected_members: "Specific members",
  owner_only: "Owner only",
  admins_only: "Admins only",
};

const NOTE_VISIBILITY_GROUP_ORDER = ["project_team", "selected_members", "owner_only", "admins_only"];

const normalizeNoteVisibilityKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (
    normalized === "project_team" ||
    normalized === "admins_only" ||
    normalized === "owner_only" ||
    normalized === "selected_members"
  ) {
    return normalized;
  }
  if (normalized === "project team") return "project_team";
  if (normalized === "admins only") return "admins_only";
  if (normalized === "owner only") return "owner_only";
  if (normalized === "specific members") return "selected_members";
  return "project_team";
};

const getNoteVisibilityLabel = (visibility, visibleMemberIds = []) => {
  const visibilityKey = normalizeNoteVisibilityKey(visibility);
  if (visibilityKey === "selected_members") {
    const memberCount = Array.isArray(visibleMemberIds)
      ? visibleMemberIds.filter((value) => {
          const parsed = Number.parseInt(String(value ?? ""), 10);
          return Number.isInteger(parsed) && parsed > 0;
        }).length
      : 0;
    if (memberCount > 0) {
      return `Specific members (${memberCount})`;
    }
  }
  return NOTE_VISIBILITY_LABELS[visibilityKey] || toReadableLabel(visibilityKey, "Project team");
};

const getNoteVisibilityIcon = (visibility) => {
  const visibilityKey = normalizeNoteVisibilityKey(visibility);
  if (visibilityKey === "admins_only") return "shield";
  if (visibilityKey === "owner_only") return "user";
  if (visibilityKey === "selected_members") return "member";
  return "users";
};

const toReadableLabel = (value, fallback = "Unknown") => {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ");
  if (!normalized) return fallback;
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
};

const getInitials = (value, fallback = "NA") => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return fallback;
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
};

const truncateProjectCellText = (value, maxLength = 96) => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const PROJECT_DOCUMENT_ACCEPT =
  ".pdf,.docx,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PROJECT_EXPENSE_RECEIPT_ACCEPT = ".pdf,image/*,application/pdf";

const PROJECT_EMIT_DOCUMENT_OPTIONS = [
  { value: "project_proposal", label: "Project Proposal" },
  { value: "project_profile", label: "Project Profile" },
  { value: "concept_note", label: "Concept Note" },
  { value: "work_plan", label: "Work Plan" },
  { value: "monitoring_and_evaluation_plan", label: "Monitoring & Evaluation (M&E) Plan" },
  { value: "activity_report", label: "Activity Report" },
  { value: "project_completion_report", label: "Project Completion Report" },
];

const MOBILE_PROJECT_DOCUMENT_MODE_OPTIONS = [
  { key: "files", label: "Files" },
  { key: "reports", label: "Reports" },
];

const isGeneratedProjectReportDocument = (document) => {
  const normalizedName = String(document?.name || "")
    .trim()
    .toLowerCase();
  const normalizedPath = String(document?.file_path || "")
    .trim()
    .toLowerCase();
  if (!normalizedName && !normalizedPath) return false;

  return PROJECT_EMIT_DOCUMENT_OPTIONS.some((option) => {
    const normalizedLabel = String(option.label || "")
      .trim()
      .toLowerCase();
    const dashedToken = `-${option.value}-`;
    if (normalizedName.startsWith(`${normalizedLabel} - `)) return true;
    if (normalizedName.includes(dashedToken)) return true;
    if (normalizedPath.includes(dashedToken)) return true;
    return false;
  });
};

const PROJECT_OVERVIEW_RANGE_OPTIONS = [
  { value: "30d", label: "30D", windowLabel: "Last 30 days", deltaLabel: "vs previous day" },
  { value: "90d", label: "90D", windowLabel: "Last 90 days", deltaLabel: "vs previous week" },
  { value: "12m", label: "12M", windowLabel: "Last 12 months", deltaLabel: "vs previous month" },
];

const PROJECT_OVERVIEW_RANGE_LOOKUP = PROJECT_OVERVIEW_RANGE_OPTIONS.reduce((lookup, option) => {
  lookup[option.value] = option;
  return lookup;
}, {});

const DEFAULT_PROJECT_OVERVIEW_RANGE = "90d";

const parseOptionalMoney = (value) => {
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return Number.NaN;
  return amount;
};

const parseMemberId = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeNoteVisibilityMemberIds = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  value.forEach((memberId) => {
    const parsed = parseMemberId(memberId);
    if (!parsed) return;
    seen.add(parsed);
  });
  return Array.from(seen);
};

const normalizeModuleKeyForForm = (value) => {
  return formatProjectCategoryLabel(value);
};

const normalizeProjectStatusForForm = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active" || normalized === "planning" || normalized === "completed") {
    return normalized;
  }
  return "active";
};

const normalizeDateInputValue = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const formatNumericInputValue = (value) => {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
};

const normalizeFundingSourceForForm = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized.includes("member")) return "member_contributions";
  if (normalized.includes("grant")) return "grant";
  if (normalized.includes("loan")) return "loan";
  if (normalized.includes("mix")) return "mixed";
  if (normalized === "member_contributions") return "member_contributions";
  if (normalized === "grant") return "grant";
  if (normalized === "loan") return "loan";
  if (normalized === "mixed") return "mixed";
  return "member_contributions";
};

const normalizePayoutScheduleForForm = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized.includes("quarter")) return "quarterly";
  if (normalized.includes("completion")) return "on_completion";
  if (normalized.includes("month")) return "monthly";
  if (normalized === "quarterly") return "quarterly";
  if (normalized === "on_completion") return "on_completion";
  if (normalized === "monthly") return "monthly";
  return "monthly";
};

const parseBudgetPlanDetails = (value) => {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return {
      fundingSource: "member_contributions",
      payoutSchedule: "monthly",
      budgetNotes: "",
    };
  }

  let fundingSource = "member_contributions";
  let payoutSchedule = "monthly";
  const noteParts = [];

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (lower.startsWith("funding source:")) {
      fundingSource = normalizeFundingSourceForForm(line.split(":").slice(1).join(":"));
      return;
    }
    if (lower.startsWith("payout schedule:")) {
      payoutSchedule = normalizePayoutScheduleForForm(line.split(":").slice(1).join(":"));
      return;
    }
    if (lower.startsWith("notes:")) {
      const note = line.split(":").slice(1).join(":").trim();
      if (note) noteParts.push(note);
      return;
    }
    noteParts.push(line);
  });

  return {
    fundingSource,
    payoutSchedule,
    budgetNotes: noteParts.join("\n"),
  };
};

const buildMemberDirectoryFromAssignments = (assignments = []) => {
  return (Array.isArray(assignments) ? assignments : [])
    .map((assignment) => {
      const memberId = parseMemberId(assignment?.member_id);
      if (!memberId) return null;
      const member = assignment?.members || {};
      return {
        id: memberId,
        name: member?.name || `Member #${memberId}`,
        email: member?.email || "",
        phone_number: member?.phone_number || "",
        role: member?.role || "member",
      };
    })
    .filter(Boolean);
};

const mapEditorDataToProjectForm = (editorData, currentUserId) => {
  const initial = createInitialProjectForm();
  const project = editorData?.project || {};
  const budgetEntries = Array.isArray(editorData?.budget_entries) ? editorData.budget_entries : [];
  const assignmentRows = Array.isArray(editorData?.member_assignments) ? editorData.member_assignments : [];
  const galleryRows = Array.isArray(editorData?.gallery) ? editorData.gallery : [];
  const budgetByItem = new Map(
    budgetEntries.map((row) => [String(row?.item || "").trim().toLowerCase(), row])
  );

  const totalBudgetRow = budgetByItem.get("total budget");
  const expectedRevenueRow = budgetByItem.get("expected revenue") || budgetByItem.get("expected funding");
  const detailsRow = budgetByItem.get("budget plan details");
  const details = parseBudgetPlanDetails(detailsRow?.notes || "");

  const projectLeaderId = parseMemberId(project?.project_leader);
  const memberDirectory = buildMemberDirectoryFromAssignments(assignmentRows);
  const assignmentByMemberId = new Map(
    assignmentRows
      .map((row) => {
        const memberId = parseMemberId(row?.member_id);
        if (!memberId) return null;
        return [memberId, row];
      })
      .filter(Boolean)
  );

  const leadAssignment =
    (projectLeaderId && assignmentByMemberId.get(projectLeaderId)) ||
    assignmentRows.find((row) => String(row?.role || "").toLowerCase().includes("lead")) ||
    assignmentRows[0] ||
    null;
  const primaryContactId =
    parseMemberId(leadAssignment?.member_id) || projectLeaderId || parseMemberId(currentUserId) || "";
  const selectedMemberIds = assignmentRows
    .map((row) => parseMemberId(row?.member_id))
    .filter((memberId) => memberId && memberId !== Number(primaryContactId));

  const sortedGallery = galleryRows
    .slice()
    .sort((a, b) => Number(a?.display_order || 0) - Number(b?.display_order || 0));

  return {
    ...initial,
    name: String(project?.name || "").trim(),
    moduleKey: normalizeModuleKeyForForm(project?.module_key || project?.code),
    startDate: normalizeDateInputValue(project?.start_date),
    status: normalizeProjectStatusForForm(project?.status),
    summary: String(project?.short_description || project?.description || "").trim(),
    totalBudget: formatNumericInputValue(totalBudgetRow?.planned_amount),
    expectedRevenue: formatNumericInputValue(expectedRevenueRow?.planned_amount),
    fundingSource: details.fundingSource,
    payoutSchedule: details.payoutSchedule,
    budgetNotes: details.budgetNotes,
    primaryContactId: primaryContactId ? String(primaryContactId) : "",
    primaryContactRole: String(leadAssignment?.role || "Project lead"),
    selectedMemberIds: selectedMemberIds.map((memberId) => String(memberId)),
    memberDirectory,
    existingMedia: sortedGallery.map((item) => ({
      id: item.id,
      image_url: item.image_url,
      caption: item.caption,
      is_primary: Boolean(item.is_primary),
      display_order: Number(item.display_order || 0),
    })),
    removedMediaIds: [],
    mediaFiles: [],
  };
};

const getFileFingerprint = (file) =>
  `${file?.name || "file"}-${file?.size || 0}-${file?.lastModified || 0}`;

const formatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const parseExpenseDescriptionForForm = (description, fallbackCategory = "") => {
  const raw = String(description || "").trim();
  if (!raw) {
    return {
      title: String(fallbackCategory || "").trim(),
      notes: "",
    };
  }
  const [firstPart, ...rest] = raw.split(" — ");
  return {
    title: String(firstPart || "").trim(),
    notes: rest.join(" — ").trim(),
  };
};

const sortExpenseCategoryRows = (rows = []) =>
  rows
    .slice()
    .sort((a, b) => {
      const orderA = Number(a?.display_order);
      const orderB = Number(b?.display_order);
      const safeOrderA = Number.isFinite(orderA) ? orderA : Number.MAX_SAFE_INTEGER;
      const safeOrderB = Number.isFinite(orderB) ? orderB : Number.MAX_SAFE_INTEGER;
      if (safeOrderA !== safeOrderB) return safeOrderA - safeOrderB;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

const toCsvCell = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  if (/["\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toFilenameSlug = (value) => {
  const base = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "project";
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
    if (current) {
      lines.push(current);
    }
    if (word.length <= maxChars) {
      current = word;
      return;
    }
    let remaining = word;
    while (remaining.length > maxChars) {
      lines.push(remaining.slice(0, maxChars - 1) + "-");
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
    if (y <= 45) return;
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

const formatPercentLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(parsed)))}%`;
};

const clampPercent = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

export function ProjectsPage({
  user,
  tenantRole,
  access,
  setActivePage,
  tenantId,
  tenantBrand,
  onManageProject,
}) {
  const {
    currencyCode,
    formatFieldLabel,
  } = useTenantCurrency();
  const projectDocumentInputRef = useRef(null);
  const projectDocumentTemplateMenuRef = useRef(null);
  const expenseReceiptInputRef = useRef(null);
  const expenseFormReceiptInputRef = useRef(null);
  const projectLongPressTimerRef = useRef(null);
  const suppressProjectOpenRef = useRef(false);
  const expenseLongPressTimerRef = useRef(null);
  const suppressExpenseOpenRef = useRef(false);
  const documentLongPressTimerRef = useRef(null);
  const documentSwipeTouchRef = useRef(null);
  const suppressDocumentOpenRef = useRef(false);
  const taskSwipeTouchRef = useRef(null);
  const suppressTaskOpenRef = useRef(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateProjectActionSheet, setShowCreateProjectActionSheet] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [createProjectForm, setCreateProjectForm] = useState(() => createInitialProjectForm());
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [loadingProjectEditor, setLoadingProjectEditor] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseData, setResponseData] = useState({
    type: "info",
    title: "",
    message: "",
    code: null,
  });
  const [projectsNotice, setProjectsNotice] = useState(null);
  const [projectView, setProjectView] = useState("grid");
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectCategoryFilter, setProjectCategoryFilter] = useState("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState("all");
  const [projectOwnerFilter, setProjectOwnerFilter] = useState("all");
  const [projectSortKey, setProjectSortKey] = useState("newest");
  const [showProjectFilters, setShowProjectFilters] = useState(false);
  const [showProjectsToolsMenu, setShowProjectsToolsMenu] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [openProjectMenuId, setOpenProjectMenuId] = useState(null);
  const [projectActionInFlightId, setProjectActionInFlightId] = useState(null);
  const [projectActionConfirm, setProjectActionConfirm] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectActionSheet, setShowProjectActionSheet] = useState(false);
  const [mobileProjectActionTarget, setMobileProjectActionTarget] = useState(null);
  const [mobileDeleteArmed, setMobileDeleteArmed] = useState(false);
  const [isMobileProjectViewport, setIsMobileProjectViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  );
  const [projectAssignableMembers, setProjectAssignableMembers] = useState([]);
  const [projectAssignableMembersLoading, setProjectAssignableMembersLoading] = useState(false);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [projectDocumentsLoading, setProjectDocumentsLoading] = useState(false);
  const [projectDocumentsError, setProjectDocumentsError] = useState("");
  const [projectDocumentMode, setProjectDocumentMode] = useState("upload");
  const [mobileProjectDocumentMode, setMobileProjectDocumentMode] = useState("files");
  const [emitDocumentType, setEmitDocumentType] = useState(PROJECT_EMIT_DOCUMENT_OPTIONS[0].value);
  const [projectDocumentTemplateMenuOpen, setProjectDocumentTemplateMenuOpen] = useState(false);
  const [showDocumentTemplateActionSheet, setShowDocumentTemplateActionSheet] = useState(false);
  const [showDocumentCreateActionSheet, setShowDocumentCreateActionSheet] = useState(false);
  const [documentActionDocumentId, setDocumentActionDocumentId] = useState("");
  const [emittingProjectDocument, setEmittingProjectDocument] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [uploadingProjectDocument, setUploadingProjectDocument] = useState(false);
  const [deletingDocuments, setDeletingDocuments] = useState(false);
  const [showDeleteDocumentsModal, setShowDeleteDocumentsModal] = useState(false);
  const [showRenameDocumentModal, setShowRenameDocumentModal] = useState(false);
  const [renamingDocument, setRenamingDocument] = useState(false);
  const [documentRenameValue, setDocumentRenameValue] = useState("");
  const [documentRenameError, setDocumentRenameError] = useState("");
  const [projectExpenses, setProjectExpenses] = useState([]);
  const [projectExpensesLoading, setProjectExpensesLoading] = useState(false);
  const [projectExpensesError, setProjectExpensesError] = useState("");
  const [expenseCategoryRows, setExpenseCategoryRows] = useState([]);
  const [expenseCategoriesLoading, setExpenseCategoriesLoading] = useState(false);
  const [expenseCategoriesError, setExpenseCategoriesError] = useState("");
  const [expenseCategoryInput, setExpenseCategoryInput] = useState("");
  const [editingExpenseCategoryId, setEditingExpenseCategoryId] = useState("");
  const [savingExpenseCategory, setSavingExpenseCategory] = useState(false);
  const [archivingExpenseCategoryId, setArchivingExpenseCategoryId] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
  const [selectedExpenseDetailId, setSelectedExpenseDetailId] = useState("");
  const [expenseActionExpenseId, setExpenseActionExpenseId] = useState("");
  const [detailTab, setDetailTab] = useState("overview");
  const [overviewRange, setOverviewRange] = useState(DEFAULT_PROJECT_OVERVIEW_RANGE);
  const [showBudgetSummaryReportModal, setShowBudgetSummaryReportModal] = useState(false);
  const [exportingDonorBrief, setExportingDonorBrief] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState(() => createInitialExpenseForm());
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenses, setDeletingExpenses] = useState(false);
  const [uploadingExpenseReceipt, setUploadingExpenseReceipt] = useState(false);
  const [receiptUploadExpenseId, setReceiptUploadExpenseId] = useState("");
  const [showDeleteExpensesModal, setShowDeleteExpensesModal] = useState(false);
  const [showExpenseCategoryModal, setShowExpenseCategoryModal] = useState(false);
  const [expenseFormError, setExpenseFormError] = useState("");
  const [expenseReceiptDragActive, setExpenseReceiptDragActive] = useState(false);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectTasksLoading, setProjectTasksLoading] = useState(false);
  const [projectTasksError, setProjectTasksError] = useState("");
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [mobileTaskStatusFilter, setMobileTaskStatusFilter] = useState("all");
  const [taskActionTaskId, setTaskActionTaskId] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [taskForm, setTaskForm] = useState(() => createInitialTaskForm());
  const [taskFormError, setTaskFormError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState(false);
  const [showDeleteTasksModal, setShowDeleteTasksModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showTaskFilters, setShowTaskFilters] = useState(false);
  const [showTasksToolsMenu, setShowTasksToolsMenu] = useState(false);
  const [openTaskRowMenuId, setOpenTaskRowMenuId] = useState("");
  const [activeTaskDetails, setActiveTaskDetails] = useState(null);
  const [projectNotes, setProjectNotes] = useState([]);
  const [projectNotesLoading, setProjectNotesLoading] = useState(false);
  const [projectNotesError, setProjectNotesError] = useState("");
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteVisibilityFilter, setNoteVisibilityFilter] = useState("all");
  const [selectedNoteIds, setSelectedNoteIds] = useState([]);
  const [noteForm, setNoteForm] = useState(() => createInitialNoteForm());
  const [noteFormError, setNoteFormError] = useState("");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNotes, setDeletingNotes] = useState(false);
  const [showDeleteNotesModal, setShowDeleteNotesModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showNoteFilters, setShowNoteFilters] = useState(false);
  const [showNotesToolsMenu, setShowNotesToolsMenu] = useState(false);
  const [openNoteRowMenuId, setOpenNoteRowMenuId] = useState("");
  const [activeNoteDetails, setActiveNoteDetails] = useState(null);
  const [projectInvites, setProjectInvites] = useState([]);
  const [projectInvitesLoading, setProjectInvitesLoading] = useState(false);
  const [projectInvitesError, setProjectInvitesError] = useState("");
  const [showProjectInviteModal, setShowProjectInviteModal] = useState(false);
  const [projectInviteForm, setProjectInviteForm] = useState(() => createInitialProjectInviteForm());
  const [projectInviteFormError, setProjectInviteFormError] = useState("");
  const [submittingProjectInvite, setSubmittingProjectInvite] = useState(false);
  const [showAcceptInviteModal, setShowAcceptInviteModal] = useState(false);
  const [acceptProjectInviteForm, setAcceptProjectInviteForm] = useState(() =>
    createInitialAcceptProjectInviteForm()
  );
  const [acceptProjectInviteError, setAcceptProjectInviteError] = useState("");
  const [acceptingProjectInvite, setAcceptingProjectInvite] = useState(false);
  const [memberPendingProjectInvites, setMemberPendingProjectInvites] = useState([]);
  const [memberPendingProjectInvitesLoading, setMemberPendingProjectInvitesLoading] = useState(false);
  const [memberPendingProjectInvitesError, setMemberPendingProjectInvitesError] = useState("");
  const [acceptingPendingProjectInviteId, setAcceptingPendingProjectInviteId] = useState("");
  const [organizationPartners, setOrganizationPartners] = useState([]);
  const [organizationPartnersLoading, setOrganizationPartnersLoading] = useState(false);
  const currentMemberId = parseMemberId(user?.id);
  const role = String(tenantRole || user?.role || "member");
  const roleKey = normalizeRoleKey(role);
  const isAdmin = ["admin", "superadmin", "super_admin"].includes(roleKey);
  const canCreateProject = ["project_manager", "admin", "superadmin", "super_admin"].includes(roleKey);
  const canViewProjectInvites =
    isAdmin ||
    ["project_manager", "coordinator", "project_coordinator", "cordinator"].includes(roleKey);
  const canManageProjectContent = canCreateProject;
  const canSelfManageMembership = isAdmin;
  const canAcceptProjectInvites = Boolean(user?.id);
  const activeProjectActionTarget = selectedProject || mobileProjectActionTarget;
  const normalizedEditingProjectId = normalizeProjectId(editingProjectId);
  const isEditingProject = Boolean(normalizedEditingProjectId);

  const openResponseModal = useCallback((payload) => {
    setResponseData({
      type: "info",
      title: "",
      message: "",
      code: null,
      ...payload,
    });
    setShowResponseModal(true);
  }, []);

  const closeResponseModal = useCallback(() => {
    setShowResponseModal(false);
  }, []);

  const showFriendlyProjectError = useCallback(
    (error, options = {}) => {
      openResponseModal(presentAppError(error, options));
    },
    [openResponseModal]
  );

  const expensePartnerByName = useMemo(() => {
    const map = new Map();
    organizationPartners.forEach((partner) => {
      const name = String(partner?.name || "").trim();
      const key = normalizePartnerLookupKey(name);
      if (!key || map.has(key)) return;
      map.set(key, partner);
    });
    return map;
  }, [organizationPartners]);

  const vendorPartnerOptions = useMemo(() => {
    const selectedProjectId = String(selectedProject?.id || "").trim();
    const hasLinkedProject = (partner) =>
      selectedProjectId
        ? Array.isArray(partner?.linked_project_ids) &&
          partner.linked_project_ids.some((projectId) => String(projectId || "").trim() === selectedProjectId)
        : false;
    return [...organizationPartners].sort((a, b) => {
      const aName = String(a?.name || "").toLowerCase();
      const bName = String(b?.name || "").toLowerCase();
      const aLinked = hasLinkedProject(a);
      const bLinked = hasLinkedProject(b);
      if (aLinked !== bLinked) {
        return aLinked ? -1 : 1;
      }
      return aName.localeCompare(bName);
    });
  }, [organizationPartners, selectedProject?.id]);

  const selectedVendorPartner = useMemo(() => {
    const key = normalizePartnerLookupKey(expenseForm.vendor);
    if (!key) return null;
    return expensePartnerByName.get(key) || null;
  }, [expenseForm.vendor, expensePartnerByName]);

  const loadOrganizationPartners = useCallback(async () => {
    if (!tenantId) {
      setOrganizationPartners([]);
      return;
    }
    setOrganizationPartnersLoading(true);
    try {
      const tenantRecord = await getTenantById(tenantId);
      setOrganizationPartners(getTenantOrganizationPartners(tenantRecord?.site_data));
    } catch (error) {
      console.error("Error loading organization partners for expenses:", error);
      setOrganizationPartners([]);
    } finally {
      setOrganizationPartnersLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadProjects();
  }, [user, tenantId]);

  useEffect(() => {
    loadOrganizationPartners();
  }, [loadOrganizationPartners]);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await getProjectsWithMembership(user?.id, tenantId);
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  }

  const resetCreateProjectForm = () => {
    setCreateProjectForm(createInitialProjectForm());
    setCreateProjectError("");
  };

  const openCreateProjectModal = ({ fromTemplate = false } = {}) => {
    if (!canCreateProject) return;
    setShowCreateProjectActionSheet(false);
    setActiveTab("info");
    setEditingProjectId(null);
    setLoadingProjectEditor(false);
    resetCreateProjectForm();
    if (fromTemplate) {
      setCreateProjectForm((prev) => ({
        ...prev,
        moduleKey: DEFAULT_PROJECT_CATEGORY_LABEL,
      }));
    }
    setProjectsNotice(null);
    setShowCreateModal(true);
  };

  const closeCreateProjectActionSheet = () => {
    setShowCreateProjectActionSheet(false);
  };

  const openCreateProjectEntry = () => {
    if (!canCreateProject) return;
    if (isMobileProjectViewport) {
      setShowCreateProjectActionSheet(true);
      return;
    }
    openCreateProjectModal();
  };

  const handleCreateProjectActionSelect = (mode) => {
    closeCreateProjectActionSheet();
    openCreateProjectModal({ fromTemplate: mode === "template" });
  };

  const openEditProjectModal = async (project) => {
    if (!canCreateProject || !project?.id) return;
    setActiveTab("info");
    setOpenProjectMenuId(null);
    setEditingProjectId(project.id);
    setLoadingProjectEditor(true);
    setCreateProjectError("");
    setProjectsNotice(null);
    setCreateProjectForm(createInitialProjectForm());
    setShowCreateModal(true);

    try {
      const editorData = await getProjectEditorData(project.id, tenantId);
      setCreateProjectForm(mapEditorDataToProjectForm(editorData, user?.id));
    } catch (error) {
      setShowCreateModal(false);
      setEditingProjectId(null);
      showFriendlyProjectError(error, {
        actionLabel: "open this project",
        fallbackTitle: "Couldn't open project",
        context: {
          area: "projects",
          action: "load_project_editor",
          tenantId,
          projectId: project.id,
        },
      });
    } finally {
      setLoadingProjectEditor(false);
    }
  };

  const closeCreateProjectModal = () => {
    if (creatingProject) return;
    setShowCreateModal(false);
    setActiveTab("info");
    setEditingProjectId(null);
    setLoadingProjectEditor(false);
    resetCreateProjectForm();
  };

  useEffect(() => {
    if (!openProjectMenuId && !showProjectsToolsMenu) {
      return undefined;
    }
    const handleWindowClick = () => {
      setOpenProjectMenuId(null);
      setShowProjectsToolsMenu(false);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openProjectMenuId, showProjectsToolsMenu]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const applyMediaState = () => {
      setIsMobileProjectViewport(mediaQuery.matches);
    };
    applyMediaState();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyMediaState);
      return () => mediaQuery.removeEventListener("change", applyMediaState);
    }
    mediaQuery.addListener(applyMediaState);
    return () => mediaQuery.removeListener(applyMediaState);
  }, []);

  const updateCreateProjectField = (field, value) => {
    setCreateProjectForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "primaryContactId") {
        const primaryId = String(parseMemberId(value) || "");
        next.selectedMemberIds = (prev.selectedMemberIds || []).filter(
          (id) => String(parseMemberId(id) || "") !== primaryId
        );
      }
      return next;
    });
    if (createProjectError) {
      setCreateProjectError("");
    }
  };

  useEffect(() => {
    if (!showCreateModal || !canCreateProject) {
      return undefined;
    }

    let cancelled = false;

    const loadAssignableMembers = async () => {
      setMembersLoading(true);
      try {
        const members = await getProjectAssignableMembers(user?.id, tenantId);
        if (cancelled) return;
        setAvailableMembers(members || []);

        setCreateProjectForm((prev) => {
          const mergedDirectory = new Map();
          (Array.isArray(prev.memberDirectory) ? prev.memberDirectory : []).forEach((member) => {
            const memberId = parseMemberId(member?.id);
            if (!memberId) return;
            mergedDirectory.set(memberId, member);
          });
          (members || []).forEach((member) => {
            const memberId = parseMemberId(member?.id);
            if (!memberId) return;
            mergedDirectory.set(memberId, member);
          });

          if (prev.primaryContactId) {
            return {
              ...prev,
              memberDirectory: Array.from(mergedDirectory.values()),
            };
          }
          const selfId = parseMemberId(user?.id);
          const defaultMember =
            (members || []).find((member) => member.id === selfId) || (members || [])[0] || null;
          return {
            ...prev,
            memberDirectory: Array.from(mergedDirectory.values()),
            primaryContactId: defaultMember ? String(defaultMember.id) : "",
          };
        });
      } catch (error) {
        console.error("Error loading assignable members:", error);
        if (!cancelled) {
          setAvailableMembers([]);
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    };

    loadAssignableMembers();

    return () => {
      cancelled = true;
    };
  }, [showCreateModal, canCreateProject, tenantId, user?.id]);

  const memberDirectory = useMemo(() => {
    const map = new Map();
    (Array.isArray(createProjectForm.memberDirectory) ? createProjectForm.memberDirectory : []).forEach(
      (member) => {
        const memberId = parseMemberId(member?.id);
        if (!memberId) return;
        map.set(memberId, {
          id: memberId,
          name: member?.name || `Member #${memberId}`,
          email: member?.email || "",
          phone_number: member?.phone_number || "",
          role: member?.role || "member",
        });
      }
    );
    availableMembers.forEach((member) => {
      const memberId = parseMemberId(member?.id);
      if (!memberId) return;
      map.set(memberId, {
        id: memberId,
        name: member?.name || `Member #${memberId}`,
        email: member?.email || "",
        phone_number: member?.phone_number || "",
        role: member?.role || "member",
      });
    });
    return Array.from(map.values()).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [availableMembers, createProjectForm.memberDirectory]);

  const projectCategoryOptions = useMemo(() => {
    const labels = new Set(DEFAULT_PROJECT_CATEGORY_OPTIONS);

    (Array.isArray(projects) ? projects : []).forEach((project) => {
      const source = project?.module_key || project?.category || project?.code || "";
      const label = formatProjectCategoryLabel(source);
      if (label) labels.add(label);
    });

    const currentInput = String(createProjectForm.moduleKey || "").trim();
    if (currentInput) {
      labels.add(formatProjectCategoryLabel(currentInput));
    }

    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [projects, createProjectForm.moduleKey]);

  const primaryContact = useMemo(() => {
    const selectedId = parseMemberId(createProjectForm.primaryContactId);
    if (!selectedId) return null;
    return memberDirectory.find((member) => member.id === selectedId) || null;
  }, [memberDirectory, createProjectForm.primaryContactId]);

  const selectedMemberOptions = useMemo(() => {
    const selectedSet = new Set(
      (createProjectForm.selectedMemberIds || []).map((memberId) => parseMemberId(memberId)).filter(Boolean)
    );
    const primaryId = parseMemberId(createProjectForm.primaryContactId);

    return memberDirectory.filter(
      (member) => !selectedSet.has(member.id) && member.id !== primaryId
    );
  }, [memberDirectory, createProjectForm.selectedMemberIds, createProjectForm.primaryContactId]);

  const selectedAdditionalMembers = useMemo(() => {
    const selectedSet = new Set(
      (createProjectForm.selectedMemberIds || []).map((memberId) => parseMemberId(memberId)).filter(Boolean)
    );
    return memberDirectory.filter((member) => selectedSet.has(member.id));
  }, [memberDirectory, createProjectForm.selectedMemberIds]);

  const selectedExistingMedia = useMemo(
    () => (Array.isArray(createProjectForm.existingMedia) ? createProjectForm.existingMedia : []),
    [createProjectForm.existingMedia]
  );

  const selectedMediaFiles = useMemo(
    () => (Array.isArray(createProjectForm.mediaFiles) ? createProjectForm.mediaFiles : []),
    [createProjectForm.mediaFiles]
  );

  const buildAutoProjectSummary = useCallback(
    (formState) => {
      const snapshot = {
        ...createInitialProjectForm(),
        ...(formState || {}),
      };

      const projectName = String(snapshot.name || "").trim() || "This project";
      const categoryLabel = formatProjectCategoryLabel(snapshot.moduleKey);
      const statusLabel = toReadableLabel(snapshot.status || "active", "Active");
      const objective = resolveProjectSummaryObjective(categoryLabel);
      const startDateValue = String(snapshot.startDate || "").trim();
      const startDateTimestamp = Date.parse(startDateValue);
      const startDateLabel = Number.isFinite(startDateTimestamp)
        ? new Date(startDateTimestamp).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "";

      const totalBudget = parseOptionalMoney(snapshot.totalBudget);
      const expectedFunding = parseOptionalMoney(snapshot.expectedRevenue);
      const fundingSourceLabel =
        FUNDING_SOURCE_LABELS[snapshot.fundingSource] || toReadableLabel(snapshot.fundingSource || "Funding");
      const teamSize = (primaryContact ? 1 : 0) + selectedAdditionalMembers.length;
      const leadLabel = String(primaryContact?.name || "").trim();

      const financialClauses = [];
      if (totalBudget !== null && !Number.isNaN(totalBudget)) {
        financialClauses.push(
          `a planned budget of ${formatCurrencyAmount(totalBudget, {
            currencyCode,
            maximumFractionDigits: 0,
          })}`
        );
      }
      if (expectedFunding !== null && !Number.isNaN(expectedFunding)) {
        financialClauses.push(
          `an expected funding target of ${formatCurrencyAmount(expectedFunding, {
            currencyCode,
            maximumFractionDigits: 0,
          })}`
        );
      }

      const intro = `${projectName} is a ${categoryLabel.toLowerCase()} initiative currently in the ${statusLabel.toLowerCase()} phase${
        startDateLabel ? `, with implementation starting on ${startDateLabel}` : ""
      }.`;
      const objectiveSentence = objective;
      const financeSentence = financialClauses.length
        ? `The project is designed with ${financialClauses.join(
            " and "
          )}, primarily supported through ${fundingSourceLabel.toLowerCase()}.`
        : "";
      const teamSentence =
        teamSize > 0
          ? `Delivery will be coordinated by ${leadLabel || "the project lead"} with support from ${teamSize} project team member${
              teamSize === 1 ? "" : "s"
            }.`
          : "Delivery will be coordinated by the project team with clear roles and regular tracking.";

      return [intro, objectiveSentence, financeSentence, teamSentence].filter(Boolean).join(" ");
    },
    [currencyCode, primaryContact, selectedAdditionalMembers]
  );

  const handleGenerateProjectSummary = useCallback(
    ({ overwrite = false } = {}) => {
      setCreateProjectForm((prev) => {
        const currentSummary = String(prev.summary || "").trim();
        if (currentSummary && !overwrite) return prev;
        const generatedSummary = buildAutoProjectSummary(prev);
        if (!generatedSummary || generatedSummary === currentSummary) return prev;
        return {
          ...prev,
          summary: generatedSummary,
        };
      });
      if (createProjectError) {
        setCreateProjectError("");
      }
    },
    [buildAutoProjectSummary, createProjectError]
  );

  const handleProjectEditorTabChange = useCallback(
    (nextTab) => {
      const normalizedTab = String(nextTab || "info");
      if (normalizedTab === "media") {
        handleGenerateProjectSummary({ overwrite: false });
      }
      setActiveTab(normalizedTab);
    },
    [handleGenerateProjectSummary]
  );

  const handleAddMemberSelection = () => {
    const memberId = parseMemberId(createProjectForm.memberToAddId);
    if (!memberId) return;

    setCreateProjectForm((prev) => {
      const existing = new Set(
        (prev.selectedMemberIds || []).map((item) => String(parseMemberId(item))).filter(Boolean)
      );
      existing.add(String(memberId));
      return {
        ...prev,
        memberToAddId: "",
        selectedMemberIds: Array.from(existing),
      };
    });
  };

  const handleRemoveSelectedMember = (memberId) => {
    const normalizedId = String(memberId);
    setCreateProjectForm((prev) => ({
      ...prev,
      selectedMemberIds: (prev.selectedMemberIds || []).filter((id) => String(id) !== normalizedId),
    }));
  };

  const handleMediaFileSelection = (event) => {
    const incomingFiles = Array.from(event.target.files || []).filter((file) =>
      String(file?.type || "").startsWith("image/")
    );
    event.target.value = "";
    if (!incomingFiles.length) return;

    setCreateProjectForm((prev) => {
      const existingFiles = Array.isArray(prev.mediaFiles) ? prev.mediaFiles : [];
      const byKey = new Map(existingFiles.map((file) => [getFileFingerprint(file), file]));
      incomingFiles.forEach((file) => {
        byKey.set(getFileFingerprint(file), file);
      });
      return {
        ...prev,
        mediaFiles: Array.from(byKey.values()),
      };
    });
  };

  const handleRemoveMediaFile = (fileKey) => {
    setCreateProjectForm((prev) => ({
      ...prev,
      mediaFiles: (Array.isArray(prev.mediaFiles) ? prev.mediaFiles : []).filter(
        (file) => getFileFingerprint(file) !== fileKey
      ),
    }));
  };

  const handleRemoveExistingMedia = (galleryId) => {
    const parsedGalleryId = Number.parseInt(String(galleryId), 10);
    if (!Number.isInteger(parsedGalleryId) || parsedGalleryId <= 0) return;
    setCreateProjectForm((prev) => {
      const currentIds = new Set(
        (Array.isArray(prev.removedMediaIds) ? prev.removedMediaIds : [])
          .map((id) => Number.parseInt(String(id), 10))
          .filter((id) => Number.isInteger(id) && id > 0)
      );
      currentIds.add(parsedGalleryId);
      return {
        ...prev,
        existingMedia: (Array.isArray(prev.existingMedia) ? prev.existingMedia : []).filter(
          (item) => Number(item?.id) !== parsedGalleryId
        ),
        removedMediaIds: Array.from(currentIds),
      };
    });
  };

  const handleCreateProjectSubmit = async (event) => {
    event.preventDefault();

    if (!canCreateProject) {
      setCreateProjectError(
        isEditingProject
          ? "You do not have permission to edit projects."
          : "You do not have permission to create projects."
      );
      return;
    }

    const name = String(createProjectForm.name || "").trim();
    if (!name) {
      setActiveTab("info");
      setCreateProjectError("Project name is required.");
      return;
    }

    const categoryInput = String(createProjectForm.moduleKey || "").trim();
    if (!categoryInput) {
      setActiveTab("info");
      setCreateProjectError("Project category is required.");
      return;
    }
    const moduleKey = normalizeProjectCategoryKey(categoryInput, "");
    if (!moduleKey) {
      setActiveTab("info");
      setCreateProjectError("Project category must contain at least one letter.");
      return;
    }

    const totalBudget = parseOptionalMoney(createProjectForm.totalBudget);
    if (Number.isNaN(totalBudget)) {
      setActiveTab("budget");
      setCreateProjectError("Total budget must be a valid non-negative number.");
      return;
    }

    const expectedRevenue = parseOptionalMoney(createProjectForm.expectedRevenue);
    if (Number.isNaN(expectedRevenue)) {
      setActiveTab("budget");
      setCreateProjectError("Expected funding must be a valid non-negative number.");
      return;
    }

    const budgetNotes = String(createProjectForm.budgetNotes || "").trim();
    const fundingSource = createProjectForm.fundingSource || "member_contributions";
    const payoutSchedule = createProjectForm.payoutSchedule || "monthly";
    const budgetWasProvided =
      totalBudget !== null ||
      expectedRevenue !== null ||
      budgetNotes.length > 0 ||
      fundingSource !== "member_contributions" ||
      payoutSchedule !== "monthly";
    const budgetDate = createProjectForm.startDate || new Date().toISOString().slice(0, 10);
    const mediaFiles = Array.isArray(createProjectForm.mediaFiles)
      ? createProjectForm.mediaFiles.filter(Boolean)
      : [];
    const removedMediaIds = (Array.isArray(createProjectForm.removedMediaIds)
      ? createProjectForm.removedMediaIds
      : []
    )
      .map((id) => Number.parseInt(String(id), 10))
      .filter((id) => Number.isInteger(id) && id > 0);
    const remainingMedia = (Array.isArray(createProjectForm.existingMedia) ? createProjectForm.existingMedia : [])
      .slice()
      .sort((a, b) => Number(a?.display_order || 0) - Number(b?.display_order || 0));

    const primaryContactId = parseMemberId(createProjectForm.primaryContactId);
    const currentUserId = parseMemberId(user?.id);
    const projectLeaderId = primaryContactId || currentUserId || null;

    const selectedMemberIds = (createProjectForm.selectedMemberIds || [])
      .map((memberId) => parseMemberId(memberId))
      .filter(Boolean);
    const memberAssignments = [];
    if (primaryContactId) {
      memberAssignments.push({
        member_id: primaryContactId,
        role: createProjectForm.primaryContactRole || "Project lead",
      });
    }
    selectedMemberIds.forEach((memberId) => {
      if (primaryContactId && memberId === primaryContactId) return;
      memberAssignments.push({
        member_id: memberId,
        role: "Member",
      });
    });

    setCreatingProject(true);
    setCreateProjectError("");
    setProjectsNotice(null);

    try {
      if (isEditingProject) {
        const projectId = parsedEditingProjectId;
        const summary = String(createProjectForm.summary || "").trim();
        const updatePayload = {
          name,
          module_key: moduleKey,
          start_date: createProjectForm.startDate || null,
          status: createProjectForm.status || "active",
          description: summary || null,
          short_description: summary || null,
          project_leader: projectLeaderId,
        };

        await updateIgaProject(projectId, updatePayload, tenantId);

        let budgetSaveFailed = false;
        let membersSaveFailed = false;
        let mediaSaveFailed = false;

        try {
          await replaceIgaProjectBudgetPlan(
            projectId,
            {
              total_budget: totalBudget,
              expected_revenue: expectedRevenue,
              funding_source: fundingSource,
              payout_schedule: payoutSchedule,
              notes: budgetNotes,
              date: budgetDate,
            },
            tenantId
          );
        } catch (budgetError) {
          budgetSaveFailed = true;
          console.error("Project updated but budget save failed:", budgetError);
        }

        try {
          await syncProjectMemberAssignments(projectId, memberAssignments, tenantId);
        } catch (memberError) {
          membersSaveFailed = true;
          console.error("Project updated but member assignments failed:", memberError);
        }

        if (removedMediaIds.length) {
          try {
            await deleteProjectMediaAssets(projectId, removedMediaIds, tenantId);
          } catch (mediaDeleteError) {
            mediaSaveFailed = true;
            console.error("Project updated but media deletion failed:", mediaDeleteError);
          }
        }

        if (mediaFiles.length) {
          try {
            await createProjectMediaAssets(projectId, mediaFiles, tenantId);
          } catch (mediaError) {
            mediaSaveFailed = true;
            console.error("Project updated but media upload failed:", mediaError);
          }
        } else if (removedMediaIds.length) {
          const fallbackCover = remainingMedia[0]?.image_url || null;
          try {
            await updateIgaProject(projectId, { image_url: fallbackCover }, tenantId);
          } catch (coverError) {
            mediaSaveFailed = true;
            console.error("Project updated but cover refresh failed:", coverError);
          }
        }

        setShowCreateModal(false);
        setActiveTab("info");
        setEditingProjectId(null);
        resetCreateProjectForm();
        await loadProjects();

        if (budgetSaveFailed || membersSaveFailed || mediaSaveFailed) {
          const noticeParts = [];
          if (budgetSaveFailed) {
            noticeParts.push("Budget details failed to update.");
          }
          if (membersSaveFailed) {
            noticeParts.push("Some team assignments could not be updated.");
          }
          if (mediaSaveFailed) {
            noticeParts.push("One or more media changes failed.");
          }
          setProjectsNotice({
            type: "warning",
            message: `Project updated with partial errors. ${noticeParts.join(" ")}`,
          });
        } else {
          setProjectsNotice({
            type: "success",
            message: "Project updated successfully.",
          });
        }
      } else {
        const createdProject = await createIgaProject(
          {
            name,
            module_key: moduleKey,
            start_date: createProjectForm.startDate || null,
            status: createProjectForm.status || "active",
            description: createProjectForm.summary,
            short_description: createProjectForm.summary,
            project_leader: projectLeaderId,
          },
          tenantId
        );

        let budgetSaveFailed = false;
        let membersSaveFailed = false;
        let mediaSaveFailed = false;
        if (budgetWasProvided) {
          const budgetDetailNotes = [
            `Funding source: ${FUNDING_SOURCE_LABELS[fundingSource] || fundingSource}`,
            `Payout schedule: ${PAYOUT_SCHEDULE_LABELS[payoutSchedule] || payoutSchedule}`,
            budgetNotes ? `Notes: ${budgetNotes}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          const budgetEntries = [];
          if (totalBudget !== null) {
            budgetEntries.push({
              item: "Total budget",
              planned_amount: totalBudget,
              date: budgetDate,
            });
          }
          if (expectedRevenue !== null) {
            budgetEntries.push({
              item: "Expected funding",
              planned_amount: expectedRevenue,
              date: budgetDate,
            });
          }
          if (budgetDetailNotes) {
            budgetEntries.push({
              item: "Budget plan details",
              date: budgetDate,
              notes: budgetDetailNotes,
            });
          }

          try {
            await createIgaBudgetEntries(createdProject.id, budgetEntries, tenantId);
          } catch (budgetError) {
            budgetSaveFailed = true;
            console.error("Project created but budget save failed:", budgetError);
          }
        }

        if (memberAssignments.length) {
          try {
            await createProjectMemberAssignments(createdProject.id, memberAssignments, tenantId);
          } catch (memberError) {
            membersSaveFailed = true;
            console.error("Project created but member assignments failed:", memberError);
          }
        }

        if (mediaFiles.length) {
          try {
            await createProjectMediaAssets(createdProject.id, mediaFiles, tenantId);
          } catch (mediaError) {
            mediaSaveFailed = true;
            console.error("Project created but media upload failed:", mediaError);
          }
        }

        setShowCreateModal(false);
        setActiveTab("info");
        resetCreateProjectForm();
        await loadProjects();
        if (budgetSaveFailed || membersSaveFailed || mediaSaveFailed) {
          const noticeParts = [];
          if (budgetSaveFailed) {
            noticeParts.push(
              "Project created, but budget details failed to save. You can add budget entries in the project page."
            );
          }
          if (membersSaveFailed) {
            noticeParts.push(
              "Project created, but some team assignments could not be saved with the current access settings."
            );
          }
          if (mediaSaveFailed) {
            noticeParts.push(
              "Project created, but media upload failed. You can retry from the project details page."
            );
          }
          setProjectsNotice({
            type: "warning",
            message: noticeParts.join(" "),
          });
        } else {
          setProjectsNotice({
            type: "success",
            message: "Project created successfully.",
          });
        }
      }
    } catch (error) {
      setActiveTab("info");
      setCreateProjectError("");
      showFriendlyProjectError(error, {
        actionLabel: isEditingProject ? "save this project" : "create this project",
        fallbackTitle: isEditingProject ? "Couldn't save project" : "Couldn't create project",
        fallbackMessage: isEditingProject
          ? "We couldn't save your project changes right now. Please try again in a moment."
          : "We couldn't create the project right now. Please try again in a moment.",
        context: {
          area: "projects",
          action: isEditingProject ? "save_project" : "create_project",
          tenantId,
          projectId: isEditingProject ? parsedEditingProjectId : null,
        },
      });
    } finally {
      setCreatingProject(false);
    }
  };

  const handleJoin = async (projectId) => {
    if (!user?.id) return;
    if (!canSelfManageMembership) return;
    
    setJoiningId(projectId);
    try {
      await joinProject(projectId, user.id, tenantId);
      await loadProjects(); // Refresh to show updated status
    } catch (error) {
      showFriendlyProjectError(error, {
        actionLabel: "update your project membership",
        fallbackTitle: "Couldn't join project",
        context: {
          area: "projects",
          action: "join_project",
          tenantId,
          projectId,
          userId: user.id,
        },
      });
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (projectId) => {
    if (!user?.id) return;
    if (!canSelfManageMembership) return;
    
    if (!confirm("Are you sure you want to leave this project?")) return;
    
    setJoiningId(projectId);
    try {
      await leaveProject(projectId, user.id, tenantId);
      await loadProjects();
    } catch (error) {
      showFriendlyProjectError(error, {
        actionLabel: "update your project membership",
        fallbackTitle: "Couldn't leave project",
        context: {
          area: "projects",
          action: "leave_project",
          tenantId,
          projectId,
          userId: user.id,
        },
      });
    } finally {
      setJoiningId(null);
    }
  };

  const handleToggleProjectMenu = (project, event) => {
    event.stopPropagation();
    if (projectActionInFlightId) return;
    if (isMobileProjectViewport) {
      setOpenProjectMenuId(null);
      setShowProjectsToolsMenu(false);
      setMobileProjectActionTarget(project || null);
      setMobileDeleteArmed(false);
      setShowProjectActionSheet(Boolean(project));
      return;
    }
    const projectId = String(project?.id ?? "");
    if (!projectId) return;
    setShowProjectsToolsMenu(false);
    setOpenProjectMenuId((prev) => (String(prev ?? "") === projectId ? null : projectId));
  };

  const requestProjectVisibilityToggle = (project) => {
    if (!canCreateProject || !project?.id) return;
    const currentlyVisible = project?.is_visible !== false;
    const nextVisible = !currentlyVisible;
    setProjectActionConfirm({
      type: "visibility",
      projects: [project],
      nextVisible,
      title: nextVisible ? "Show project?" : "Hide project?",
      subtitle: nextVisible
        ? `This will make "${project.name}" visible in project views again.`
        : `This will hide "${project.name}" from non-admin users.`,
      confirmLabel: nextVisible ? "Show project" : "Hide project",
    });
    setOpenProjectMenuId(null);
    setShowProjectActionSheet(false);
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
  };

  const requestDeleteProject = (project) => {
    if (!canCreateProject || !project?.id) return;
    setProjectActionConfirm({
      type: "delete",
      projects: [project],
      title: "Delete project?",
      subtitle: `Delete "${project.name}" and all associated activities, expenses, documents, tasks, and records. This cannot be undone.`,
      confirmLabel: "Delete project",
    });
    setOpenProjectMenuId(null);
    setShowProjectActionSheet(false);
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
  };

  const closeProjectActionSheet = () => {
    if (projectActionInFlightId) return;
    setShowProjectActionSheet(false);
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
  };

  const openProjectActionSheet = (project = null) => {
    if (project?.id) {
      setMobileProjectActionTarget(project);
    }
    setMobileDeleteArmed(false);
    setShowProjectActionSheet(true);
  };

  const handleMobileProjectPillClick = (pillKey) => {
    setDetailTab(pillKey);
  };

  const handleDuplicateSelectedProject = async (project = null) => {
    const sourceProject = project || activeProjectActionTarget;
    if (!canCreateProject || !sourceProject?.id) return;
    const sourceName = String(sourceProject?.name || "Project").trim() || "Project";
    const duplicateName = `${sourceName} (Copy)`;

    setProjectActionInFlightId(String(sourceProject.id));
    setProjectsNotice(null);
    try {
      await createIgaProject(
        {
          name: duplicateName,
          module_key: sourceProject?.module_key || sourceProject?.code || "generic",
          start_date: sourceProject?.start_date || null,
          status: sourceProject?.status || "active",
          description: sourceProject?.description || sourceProject?.short_description || "",
          short_description: sourceProject?.short_description || sourceProject?.description || "",
          project_leader: sourceProject?.project_leader || user?.id || null,
        },
        tenantId
      );
      await loadProjects();
      setProjectsNotice({
        type: "success",
        message: `Created duplicate project "${duplicateName}".`,
      });
      setShowProjectActionSheet(false);
      setMobileProjectActionTarget(null);
      setMobileDeleteArmed(false);
    } catch (error) {
      showFriendlyProjectError(error, {
        actionLabel: "duplicate this project",
        fallbackTitle: "Couldn't duplicate project",
        context: {
          area: "projects",
          action: "duplicate_project",
          tenantId,
          projectId: sourceProject.id,
        },
      });
    } finally {
      setProjectActionInFlightId(null);
    }
  };

  const handleArchiveSelectedProject = async (project = null) => {
    const targetProject = project || activeProjectActionTarget;
    if (!canCreateProject || !targetProject?.id) return;
    const projectName = String(targetProject?.name || "this project").trim();
    if (!window.confirm(`Archive ${projectName}?`)) {
      return;
    }

    setProjectActionInFlightId(String(targetProject.id));
    setProjectsNotice(null);
    try {
      await updateIgaProject(targetProject.id, { status: "archived" }, tenantId);
      await loadProjects();
      setSelectedProject((prev) =>
        prev?.id === targetProject.id ? { ...prev, status: "archived" } : prev
      );
      setProjectsNotice({
        type: "success",
        message: `${projectName} archived.`,
      });
      setShowProjectActionSheet(false);
      setMobileProjectActionTarget(null);
      setMobileDeleteArmed(false);
    } catch (error) {
      showFriendlyProjectError(error, {
        actionLabel: "archive this project",
        fallbackTitle: "Couldn't archive project",
        context: {
          area: "projects",
          action: "archive_project",
          tenantId,
          projectId: targetProject.id,
        },
      });
    } finally {
      setProjectActionInFlightId(null);
    }
  };

  const handleMobileDeleteProject = (project = null) => {
    const targetProject = project || activeProjectActionTarget;
    if (!targetProject?.id || !canCreateProject) return;
    if (!mobileDeleteArmed) {
      setMobileDeleteArmed(true);
      return;
    }
    setShowProjectActionSheet(false);
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
    requestDeleteProject(targetProject);
  };

  const closeProjectActionConfirm = () => {
    if (projectActionInFlightId) return;
    setProjectActionConfirm(null);
  };

  const handleConfirmProjectAction = async () => {
    const targets = Array.isArray(projectActionConfirm?.projects)
      ? projectActionConfirm.projects.filter((project) => project?.id)
      : [];
    if (!targets.length) return;

    const { type, nextVisible } = projectActionConfirm;
    setProjectActionInFlightId(targets.length === 1 ? targets[0].id : "bulk");
    setProjectsNotice(null);

    try {
      let successCount = 0;
      let failureCount = 0;
      const deletedIds = [];
      let firstFailure = null;

      if (type === "visibility") {
        for (const project of targets) {
          try {
            await setIgaProjectVisibility(project.id, Boolean(nextVisible), tenantId);
            successCount += 1;
          } catch (error) {
            failureCount += 1;
            if (!firstFailure) firstFailure = error;
            presentAppError(error, {
              actionLabel: "update project visibility",
              context: {
                area: "projects",
                action: "update_visibility",
                tenantId,
                projectId: project.id,
              },
            });
          }
        }
        await loadProjects();
        if (failureCount === 0) {
          setProjectsNotice({
            type: "success",
            message:
              successCount === 1
                ? nextVisible
                  ? `Project "${targets[0].name}" is visible again.`
                  : `Project "${targets[0].name}" has been hidden.`
                : nextVisible
                  ? `${successCount} projects are now visible.`
                  : `${successCount} projects were hidden.`,
          });
        } else {
          setProjectsNotice({
            type: "warning",
            message: `Updated ${successCount} project(s). ${failureCount} project(s) failed.`,
          });
          if (successCount === 0 && firstFailure) {
            showFriendlyProjectError(firstFailure, {
              actionLabel: "update those project settings",
              fallbackTitle: "Couldn't update projects",
              context: {
                area: "projects",
                action: "update_visibility_batch",
                tenantId,
              },
            });
          }
        }
      }

      if (type === "delete") {
        for (const project of targets) {
          try {
            await deleteIgaProject(project.id, tenantId);
            successCount += 1;
            const deletedProjectId = normalizeProjectId(project.id);
            if (deletedProjectId) {
              deletedIds.push(deletedProjectId);
            }
          } catch (error) {
            failureCount += 1;
            if (!firstFailure) firstFailure = error;
            presentAppError(error, {
              actionLabel: "delete a project",
              context: {
                area: "projects",
                action: "delete_project",
                tenantId,
                projectId: project.id,
              },
            });
          }
        }

        if (deletedIds.length && selectedProject?.id) {
          const selectedId = normalizeProjectId(selectedProject.id);
          if (deletedIds.includes(selectedId)) {
            setSelectedProject(null);
          }
        }

        await loadProjects();
        if (deletedIds.length) {
          setSelectedProjectIds((prev) => prev.filter((projectId) => !deletedIds.includes(projectId)));
        }

        if (failureCount === 0) {
          setProjectsNotice({
            type: "success",
            message:
              successCount === 1
                ? `Project "${targets[0].name}" was deleted.`
                : `${successCount} projects were deleted.`,
          });
        } else {
          setProjectsNotice({
            type: "warning",
            message: `Deleted ${successCount} project(s). ${failureCount} project(s) failed.`,
          });
          if (successCount === 0 && firstFailure) {
            showFriendlyProjectError(firstFailure, {
              actionLabel: "delete those projects",
              fallbackTitle: "Couldn't delete projects",
              context: {
                area: "projects",
                action: "delete_project_batch",
                tenantId,
              },
            });
          }
        }
      }
    } finally {
      setProjectActionInFlightId(null);
      setProjectActionConfirm(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return "—";
    return formatCurrencyAmount(amount, {
      currencyCode,
      maximumFractionDigits: 0,
    });
  };

  const formatReportMetricValue = (value, unit = "") => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "—";
    if (unit === "%") return `${Math.round(parsed)}%`;
    if (unit === "x") {
      if (parsed <= 0) return "—";
      return parsed >= 10 ? `${Math.round(parsed)}x` : `${parsed.toFixed(2)}x`;
    }
    if (unit === "months") {
      if (parsed <= 0) return "0 mo";
      if (parsed >= 10) return `${Math.round(parsed)} mo`;
      return `${parsed.toFixed(1)} mo`;
    }
    const rounded = Math.round(parsed);
    const numberLabel = rounded.toLocaleString("en-KE");
    return unit ? `${numberLabel} ${unit}` : numberLabel;
  };

  const getProjectBudgetAmount = (project) => {
    const candidates = [
      project?.budget_total,
      project?.total_budget,
      project?.budget,
      project?.planned_budget,
    ];
    const valid = candidates.find((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    });
    return valid ?? null;
  };

  const getProjectRevenueAmount = (project) => {
    const candidates = [
      project?.expected_revenue,
      project?.revenue_target,
      project?.target_revenue,
      project?.revenue,
    ];
    const valid = candidates.find((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    });
    return valid ?? null;
  };

  const getStatusColor = (status, isVisible = true) => {
    if (!isVisible) return "#64748b";
    switch (status?.toLowerCase()) {
      case "active": return "#10b981";
      case "planning": return "#f59e0b";
      case "completed": return "#6b7280";
      default: return "#10b981";
    }
  };

  const getProjectImage = (project) => {
    const uploadedCover = String(project?.image_url || "").trim();
    if (uploadedCover) return uploadedCover;
    const moduleKey = resolveModuleKey(project);
    if (moduleKey === "jpp") return "/assets/jpp_farm-bg.png";
    if (moduleKey === "jgf") return "/assets/hero-2.webp";
    return "/assets/hero-1.png";
  };

  const getProjectSubtitle = (project) => {
    const base =
      project?.short_description ||
      project?.lead_description ||
      project?.description ||
      "";
    const trimmed = String(base).trim();
    if (!trimmed) return "Community project";
    if (trimmed.length <= 60) return trimmed;
    return `${trimmed.slice(0, 57)}...`;
  };

  const getProjectProgress = (project, metrics = null) => {
    const parseProgress = (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      const normalized = parsed <= 1 ? parsed * 100 : parsed;
      return Math.max(0, Math.min(100, normalized));
    };

    const directProgress = parseProgress(
      project?.progress ??
        project?.completion ??
        project?.completion_rate ??
        project?.percent_complete
    );
    if (directProgress !== null) {
      return Math.round(directProgress);
    }

    const taskRows = Array.isArray(metrics?.tasks) ? metrics.tasks : [];
    if (taskRows.length) {
      let doneCount = 0;
      let actionableCount = 0;
      taskRows.forEach((task) => {
        const status = String(task?.status || "open")
          .trim()
          .toLowerCase();
        if (status === "cancelled") return;
        actionableCount += 1;
        if (status === "done") {
          doneCount += 1;
        }
      });
      const taskProgress = actionableCount > 0 ? (doneCount / actionableCount) * 100 : null;
      const budgetAmount = Number(metrics?.budgetAmount);
      const spentAmount = Number(metrics?.spentAmount);
      const budgetProgress =
        Number.isFinite(budgetAmount) && budgetAmount > 0 && Number.isFinite(spentAmount)
          ? Math.max(0, Math.min(100, (spentAmount / budgetAmount) * 100))
          : null;
      if (taskProgress !== null && budgetProgress !== null) {
        return Math.round(taskProgress * 0.7 + budgetProgress * 0.3);
      }
      if (taskProgress !== null) {
        return Math.round(taskProgress);
      }
      if (budgetProgress !== null) {
        return Math.round(budgetProgress);
      }
    }

    const statusKey = String(project?.status || "")
      .trim()
      .toLowerCase();
    if (statusKey === "completed") {
      return 100;
    }

    const startTimestamp = Date.parse(String(project?.start_date || ""));
    const endTimestamp = Date.parse(
      String(
        project?.end_date ||
          project?.target_end_date ||
          project?.expected_end_date ||
          project?.due_date ||
          ""
      )
    );
    const now = Date.now();

    if (
      Number.isFinite(startTimestamp) &&
      Number.isFinite(endTimestamp) &&
      endTimestamp > startTimestamp
    ) {
      const ratio = ((now - startTimestamp) / (endTimestamp - startTimestamp)) * 100;
      return Math.round(Math.max(0, Math.min(100, ratio)));
    }

    if (Number.isFinite(startTimestamp)) {
      const elapsedDays = Math.max(0, (now - startTimestamp) / (1000 * 60 * 60 * 24));
      const baselineDays = statusKey === "planning" ? 120 : 180;
      const ratio = (elapsedDays / baselineDays) * 100;
      const floor = statusKey === "planning" ? 5 : 10;
      return Math.round(Math.max(floor, Math.min(95, ratio)));
    }

    if (statusKey === "planning") return 15;
    if (statusKey === "active") return 35;
    return 25;
  };

  const getAvatarLetters = (project) => {
    const name = String(project?.name || "").trim();
    const parts = name.split(/\s+/).filter(Boolean);
    const initials = parts.map((part) => part.charAt(0).toUpperCase()).slice(0, 3);
    while (initials.length < 3) {
      initials.push("M");
    }
    return initials.slice(0, 3);
  };

  const getProjectLead = (project) => {
    const base =
      project?.short_description ||
      project?.lead_description ||
      project?.description ||
      "";
    if (base) {
      const trimmed = String(base).trim();
      if (trimmed.length <= 90) return trimmed;
      return `${trimmed.slice(0, 87)}...`;
    }
    const moduleKey = resolveModuleKey(project);
    if (moduleKey === "jpp") return "Reducing poultry losses and improving member incomes.";
    if (moduleKey === "jgf") return "Adding value to groundnuts for reliable household earnings.";
    return "Supporting member-led income activities in the community.";
  };

  const getProjectCategory = (project) => {
    const raw = project?.category || project?.module_key || project?.code || "General";
    return String(raw)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getProjectDocumentTypeLabel = (document) => {
    const mimeType = String(document?.mime_type || "")
      .trim()
      .toLowerCase();
    const ext = String(document?.file_ext || "")
      .trim()
      .toLowerCase();

    if (mimeType === "application/pdf" || ext === "pdf") return "PDF";
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      return "DOCX";
    }
    if (mimeType.startsWith("image/")) return "Image";
    if (ext) return ext.toUpperCase();
    return "File";
  };

  const renderProjectActionMenu = (project, variant = "overlay") => {
    if (!project?.id) return null;
    const isVisible = project?.is_visible !== false;
    const projectId = String(project.id);
    const isActionBusy = projectActionInFlightId === projectId;
    const isMenuOpen = String(openProjectMenuId ?? "") === projectId;
    const isMember = Boolean(project?.membership);
    const closeProjectMenus = () => {
      setOpenProjectMenuId(null);
      setShowProjectsToolsMenu(false);
    };
    const openProjectTab = (tab = "overview") => {
      closeProjectMenus();
      openProjectDetails(project);
      setDetailTab(tab);
    };

    return (
      <div
        className={`project-card-menu${variant === "inline" ? " project-card-menu--inline" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          type="button"
          className="project-card-menu-btn"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label={`Project actions for ${project.name}`}
          onClick={(event) => handleToggleProjectMenu(project, event)}
          disabled={isActionBusy}
        >
          <Icon name="more-vertical" size={16} />
        </button>
        {isMenuOpen ? (
          <div className="project-card-menu-dropdown" role="menu">
            <button type="button" role="menuitem" onClick={() => openProjectTab("overview")} disabled={isActionBusy}>
              <Icon name="home" size={14} />
              <span>Open overview</span>
            </button>
            <button type="button" role="menuitem" onClick={() => openProjectTab("expenses")} disabled={isActionBusy}>
              <Icon name="wallet" size={14} />
              <span>Open expenses</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => openProjectTab("documents")}
              disabled={isActionBusy}
            >
              <Icon name="folder" size={14} />
              <span>Open docs</span>
            </button>
            <button type="button" role="menuitem" onClick={() => openProjectTab("tasks")} disabled={isActionBusy}>
              <Icon name="check-circle" size={14} />
              <span>Open tasks</span>
            </button>
            <button type="button" role="menuitem" onClick={() => openProjectTab("notes")} disabled={isActionBusy}>
              <Icon name="notes" size={14} />
              <span>Open notes</span>
            </button>
            {canViewProjectInvites ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => openProjectTab("invites")}
                disabled={isActionBusy}
              >
                <Icon name="mail" size={14} />
                <span>Open invites</span>
              </button>
            ) : null}
            {canSelfManageMembership ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeProjectMenus();
                  if (isMember) {
                    handleLeave(project.id);
                    return;
                  }
                  handleJoin(project.id);
                }}
                disabled={Boolean(joiningId) || isActionBusy}
              >
                <Icon name={isMember ? "user-minus" : "plus"} size={14} />
                <span>{isMember ? "Leave project" : "Join project"}</span>
              </button>
            ) : null}
            {canCreateProject ? <div className="project-card-menu-divider" role="separator" /> : null}
            {canCreateProject ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeProjectMenus();
                  openEditProjectModal(project);
                }}
                disabled={isActionBusy}
              >
                <Icon name="tag" size={14} />
                <span>Edit project</span>
              </button>
            ) : null}
            {canCreateProject ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeProjectMenus();
                  handleDuplicateSelectedProject(project);
                }}
                disabled={isActionBusy}
              >
                <Icon name="plus" size={14} />
                <span>Duplicate project</span>
              </button>
            ) : null}
            {canCreateProject ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeProjectMenus();
                  handleArchiveSelectedProject(project);
                }}
                disabled={isActionBusy}
              >
                <Icon name="clock-alert" size={14} />
                <span>Archive project</span>
              </button>
            ) : null}
            {canCreateProject ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => requestProjectVisibilityToggle(project)}
                disabled={isActionBusy}
              >
                <Icon name="filter" size={14} />
                <span>{isVisible ? "Hide project" : "Show project"}</span>
              </button>
            ) : null}
            {canCreateProject ? <div className="project-card-menu-divider" role="separator" /> : null}
            {canCreateProject ? (
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => requestDeleteProject(project)}
                disabled={isActionBusy}
              >
                <Icon name="trash" size={14} />
                <span>Delete project</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const projectDetailTabs = useMemo(() => {
    const tabs = ["overview", "expenses", "documents", "tasks", "notes"];
    if (canViewProjectInvites) {
      tabs.push("invites");
    }
    return tabs;
  }, [canViewProjectInvites]);

  const activeProjectMobilePill = useMemo(() => {
    return PROJECT_MOBILE_PILLS.some((pill) => pill.key === detailTab) ? detailTab : "overview";
  }, [detailTab]);

  const openProjectDetails = (project) => {
    setSelectedProject(project);
    setDetailTab("overview");
    setShowProjectActionSheet(false);
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
    setOverviewRange(DEFAULT_PROJECT_OVERVIEW_RANGE);
    setShowBudgetSummaryReportModal(false);
    setExportingDonorBrief(false);
    setShowProjectInviteModal(false);
    setProjectInviteForm(createInitialProjectInviteForm());
    setProjectInviteFormError("");
    setProjectInvitesError("");
    setMobileProjectDocumentMode("files");
    setShowDocumentCreateActionSheet(false);
    setShowDocumentTemplateActionSheet(false);
    setDocumentActionDocumentId("");
  };

  const closeProjectDetails = () => {
    setShowBudgetSummaryReportModal(false);
    setSelectedProject(null);
    setMobileProjectActionTarget(null);
  };

  useEffect(() => {
    if (detailTab === "invites" && !canViewProjectInvites) {
      setDetailTab("overview");
    }
  }, [detailTab, canViewProjectInvites]);

  useEffect(() => {
    if (detailTab === "tasks") return;
    if (!taskActionTaskId) return;
    setTaskActionTaskId("");
  }, [detailTab, taskActionTaskId]);

  useEffect(() => {
    if (detailTab === "documents") return;
    if (showDocumentCreateActionSheet) {
      setShowDocumentCreateActionSheet(false);
    }
    if (showDocumentTemplateActionSheet) {
      setShowDocumentTemplateActionSheet(false);
    }
    if (documentActionDocumentId) {
      setDocumentActionDocumentId("");
    }
  }, [detailTab, showDocumentCreateActionSheet, showDocumentTemplateActionSheet, documentActionDocumentId]);

  useEffect(() => {
    if (!isMobileProjectViewport) {
      if (showProjectActionSheet) {
        setShowProjectActionSheet(false);
        setMobileProjectActionTarget(null);
        setMobileDeleteArmed(false);
      }
      if (showCreateProjectActionSheet) {
        setShowCreateProjectActionSheet(false);
      }
      if (expenseActionExpenseId) {
        setExpenseActionExpenseId("");
      }
      if (taskActionTaskId) {
        setTaskActionTaskId("");
      }
      if (showDocumentCreateActionSheet) {
        setShowDocumentCreateActionSheet(false);
      }
      if (showDocumentTemplateActionSheet) {
        setShowDocumentTemplateActionSheet(false);
      }
      if (documentActionDocumentId) {
        setDocumentActionDocumentId("");
      }
    }
  }, [
    isMobileProjectViewport,
    showProjectActionSheet,
    showCreateProjectActionSheet,
    expenseActionExpenseId,
    taskActionTaskId,
    showDocumentCreateActionSheet,
    showDocumentTemplateActionSheet,
    documentActionDocumentId,
  ]);

  useEffect(() => {
    if (!selectedProject) {
      setShowBudgetSummaryReportModal(false);
      setExportingDonorBrief(false);
      setShowProjectInviteModal(false);
      setProjectInviteFormError("");
      setShowProjectActionSheet(false);
      setMobileProjectActionTarget(null);
      setMobileDeleteArmed(false);
      setExpenseActionExpenseId("");
      setTaskActionTaskId("");
      setShowDocumentCreateActionSheet(false);
      setShowDocumentTemplateActionSheet(false);
      setDocumentActionDocumentId("");
    }
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadProjectExpenses = async () => {
      setProjectExpensesLoading(true);
      setProjectExpensesError("");
      try {
        const rows = await getProjectExpenses(selectedProject.id, tenantId);
        if (cancelled) return;
        setProjectExpenses(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project expenses:", error);
        setProjectExpenses([]);
        setProjectExpensesError(error?.message || "Failed to load project expenses.");
      } finally {
        if (!cancelled) {
          setProjectExpensesLoading(false);
        }
      }
    };

    loadProjectExpenses();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId]);

  const loadProjectInvites = useCallback(async () => {
    const projectId = normalizeProjectId(selectedProject?.id);
    if (!canViewProjectInvites || !projectId) {
      setProjectInvites([]);
      return;
    }

    setProjectInvitesLoading(true);
    setProjectInvitesError("");
    try {
      const rows = await getProjectMagicLinkInvites(projectId);
      setProjectInvites(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error loading project invites:", error);
      setProjectInvites([]);
      setProjectInvitesError(error?.message || "Failed to load invited members.");
    } finally {
      setProjectInvitesLoading(false);
    }
  }, [selectedProject?.id, canViewProjectInvites]);

  useEffect(() => {
    if (detailTab !== "invites") {
      return;
    }
    loadProjectInvites();
  }, [detailTab, loadProjectInvites]);

  const loadPendingProjectInvites = useCallback(async () => {
    const memberEmail = String(user?.email || "").trim().toLowerCase();
    if (!canAcceptProjectInvites || !tenantId || !memberEmail) {
      setMemberPendingProjectInvites([]);
      setMemberPendingProjectInvitesError("");
      setMemberPendingProjectInvitesLoading(false);
      return;
    }

    setMemberPendingProjectInvitesLoading(true);
    setMemberPendingProjectInvitesError("");
    try {
      const rows = await getMyProjectMagicLinkInvites(tenantId);
      setMemberPendingProjectInvites(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error loading pending project invites for member:", error);
      setMemberPendingProjectInvites([]);
      setMemberPendingProjectInvitesError(error?.message || "Failed to load your pending project invites.");
    } finally {
      setMemberPendingProjectInvitesLoading(false);
    }
  }, [canAcceptProjectInvites, tenantId, user?.email]);

  useEffect(() => {
    loadPendingProjectInvites();
  }, [loadPendingProjectInvites]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadExpenseCategories = async () => {
      setExpenseCategoriesLoading(true);
      setExpenseCategoriesError("");
      try {
        const rows = await getProjectExpenseCategoryDefinitions(selectedProject.id, tenantId);
        if (cancelled) return;
        setExpenseCategoryRows(sortExpenseCategoryRows(Array.isArray(rows) ? rows : []));
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project expense categories:", error);
        setExpenseCategoryRows([]);
        setExpenseCategoriesError(error?.message || "Failed to load expense categories.");
      } finally {
        if (!cancelled) {
          setExpenseCategoriesLoading(false);
        }
      }
    };

    loadExpenseCategories();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadAssignableMembersForProject = async () => {
      setProjectAssignableMembersLoading(true);
      try {
        const members = await getProjectAssignableMembers(user?.id, tenantId);
        if (cancelled) return;
        setProjectAssignableMembers(Array.isArray(members) ? members : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project assignable members:", error);
        setProjectAssignableMembers([]);
      } finally {
        if (!cancelled) {
          setProjectAssignableMembersLoading(false);
        }
      }
    };

    loadAssignableMembersForProject();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId, user?.id]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadProjectDocuments = async () => {
      setProjectDocumentsLoading(true);
      setProjectDocumentsError("");
      try {
        const rows = await getProjectDocuments(selectedProject.id, tenantId);
        if (cancelled) return;
        setProjectDocuments(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project documents:", error);
        setProjectDocuments([]);
        setProjectDocumentsError(error?.message || "Failed to load project documents.");
      } finally {
        if (!cancelled) {
          setProjectDocumentsLoading(false);
        }
      }
    };

    loadProjectDocuments();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadProjectTasks = async () => {
      setProjectTasksLoading(true);
      setProjectTasksError("");
      try {
        const rows = await getProjectTasks(selectedProject.id, tenantId);
        if (cancelled) return;
        setProjectTasks(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project tasks:", error);
        setProjectTasks([]);
        setProjectTasksError(error?.message || "Failed to load project tasks.");
      } finally {
        if (!cancelled) {
          setProjectTasksLoading(false);
        }
      }
    };

    loadProjectTasks();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return undefined;
    }

    let cancelled = false;

    const loadProjectNotes = async () => {
      setProjectNotesLoading(true);
      setProjectNotesError("");
      try {
        const rows = await getProjectNotes(selectedProject.id, tenantId);
        if (cancelled) return;
        setProjectNotes(Array.isArray(rows) ? rows : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading project notes:", error);
        setProjectNotes([]);
        setProjectNotesError(error?.message || "Failed to load project notes.");
      } finally {
        if (!cancelled) {
          setProjectNotesLoading(false);
        }
      }
    };

    loadProjectNotes();

    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, tenantId]);

  const sortedProjectExpenses = useMemo(() => {
    return [...projectExpenses]
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.expense_date || a?.created_at || ""));
        const bTime = Date.parse(String(b?.expense_date || b?.created_at || ""));
        const safeA = Number.isFinite(aTime) ? aTime : 0;
        const safeB = Number.isFinite(bTime) ? bTime : 0;
        return safeB - safeA;
      });
  }, [projectExpenses]);

  const recentProjectExpenses = useMemo(
    () => sortedProjectExpenses.slice(0, 10),
    [sortedProjectExpenses]
  );

  const totalProjectExpensesAmount = useMemo(
    () =>
      projectExpenses.reduce((sum, expense) => {
        const amount = Number(expense?.amount);
        if (!Number.isFinite(amount)) return sum;
        return sum + amount;
      }, 0),
    [projectExpenses]
  );

  const projectOverviewAnalytics = useMemo(() => {
    const budgetAmount = Number(getProjectBudgetAmount(selectedProject));
    const expectedRevenueAmount = Number(getProjectRevenueAmount(selectedProject));
    const safeBudgetAmount = Number.isFinite(budgetAmount) && budgetAmount >= 0 ? budgetAmount : null;
    const safeExpectedRevenueAmount =
      Number.isFinite(expectedRevenueAmount) && expectedRevenueAmount >= 0
        ? expectedRevenueAmount
        : null;
    const spentAmount = Number.isFinite(totalProjectExpensesAmount) ? totalProjectExpensesAmount : 0;
    const remainingAmount =
      safeBudgetAmount !== null ? Math.max(safeBudgetAmount - spentAmount, 0) : null;
    const budgetSpentPercent =
      safeBudgetAmount && safeBudgetAmount > 0 ? (spentAmount / safeBudgetAmount) * 100 : 0;
    const progressPercent = getProjectProgress(selectedProject, {
      tasks: projectTasks,
      budgetAmount: safeBudgetAmount,
      spentAmount,
    });
    const memberCount = Number(selectedProject?.member_count || 0);
    const safeMemberCount = Number.isFinite(memberCount) && memberCount >= 0 ? memberCount : 0;

    const taskTotals = {
      open: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    let overdueTaskCount = 0;
    let highPriorityActiveTaskCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    projectTasks.forEach((task) => {
      const statusKey = String(task?.status || "open")
        .trim()
        .toLowerCase();
      if (statusKey in taskTotals) {
        taskTotals[statusKey] += 1;
      }
      const priorityKey = String(task?.priority || "normal")
        .trim()
        .toLowerCase();
      if (
        (priorityKey === "high" || priorityKey === "urgent") &&
        statusKey !== "done" &&
        statusKey !== "cancelled"
      ) {
        highPriorityActiveTaskCount += 1;
      }
      if (statusKey === "done" || statusKey === "cancelled") return;
      const dueDateTimestamp = Date.parse(String(task?.due_date || ""));
      if (Number.isFinite(dueDateTimestamp) && dueDateTimestamp < todayTimestamp) {
        overdueTaskCount += 1;
      }
    });

    const totalTasks = projectTasks.length;
    const taskCompletionPercent = totalTasks > 0 ? (taskTotals.done / totalTasks) * 100 : 0;

    const selectedRange =
      PROJECT_OVERVIEW_RANGE_LOOKUP[overviewRange] ||
      PROJECT_OVERVIEW_RANGE_LOOKUP[DEFAULT_PROJECT_OVERVIEW_RANGE];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const nowTimestamp = now.getTime();
    const oneDayMilliseconds = 24 * 60 * 60 * 1000;
    const formatDayKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;

    let expenseProofCount = 0;
    const parsedExpenses = [];
    projectExpenses.forEach((expense) => {
      const category = String(expense?.category || "Other").trim() || "Other";
      const amount = Number(expense?.amount);
      const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
      const expenseTimestamp = Date.parse(String(expense?.expense_date || expense?.created_at || ""));
      parsedExpenses.push({
        category,
        amount: safeAmount,
        timestamp: Number.isFinite(expenseTimestamp) ? expenseTimestamp : null,
      });

      const hasProof = hasExpenseProof(expense);
      if (hasProof) {
        expenseProofCount += 1;
      }
    });

    const expenseProofPercent =
      projectExpenses.length > 0 ? (expenseProofCount / projectExpenses.length) * 100 : 0;

    const trendBuckets = [];
    const trendBucketIndex = new Map();
    let rangeStartTimestamp = 0;
    const rangeEndTimestamp = nowTimestamp;

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
          amount: 0,
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
          amount: 0,
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
          amount: 0,
        });
      }
    }

    const rangeExpenses = parsedExpenses.filter((expense) => {
      if (!Number.isFinite(expense?.timestamp)) return false;
      return expense.timestamp >= rangeStartTimestamp && expense.timestamp <= rangeEndTimestamp;
    });

    const expenseCategoryTotals = new Map();
    rangeExpenses.forEach((expense) => {
      const category = String(expense?.category || "Other").trim() || "Other";
      const amount = Number(expense?.amount);
      const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
      expenseCategoryTotals.set(category, (expenseCategoryTotals.get(category) || 0) + safeAmount);
    });

    const topExpenseCategories = Array.from(expenseCategoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, amount]) => ({ category, amount }));
    const topExpenseCategoryMax = topExpenseCategories.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item?.amount) || 0),
      0
    );

    rangeExpenses.forEach((expense) => {
      const amount = Number(expense?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const expenseDate = new Date(expense.timestamp);
      if (selectedRange.value === "12m") {
        const key = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, "0")}`;
        const bucketPosition = trendBucketIndex.get(key);
        if (bucketPosition === undefined) return;
        trendBuckets[bucketPosition].amount += amount;
        return;
      }
      if (selectedRange.value === "30d") {
        expenseDate.setHours(0, 0, 0, 0);
        const key = formatDayKey(expenseDate);
        const bucketPosition = trendBucketIndex.get(key);
        if (bucketPosition === undefined) return;
        trendBuckets[bucketPosition].amount += amount;
        return;
      }
      expenseDate.setHours(0, 0, 0, 0);
      const dayOffset = Math.floor((expenseDate.getTime() - rangeStartTimestamp) / oneDayMilliseconds);
      if (dayOffset < 0) return;
      const bucketPosition = Math.floor(dayOffset / 7);
      if (bucketPosition < 0 || bucketPosition >= trendBuckets.length) return;
      trendBuckets[bucketPosition].amount += amount;
    });

    const trendMaxAmount = trendBuckets.reduce(
      (maxAmount, bucket) => Math.max(maxAmount, Number(bucket?.amount) || 0),
      0
    );
    const trendCurrentAmount = Number(trendBuckets[trendBuckets.length - 1]?.amount || 0);
    const trendPreviousAmount = Number(trendBuckets[trendBuckets.length - 2]?.amount || 0);
    const trendDeltaPercent =
      trendPreviousAmount > 0
        ? ((trendCurrentAmount - trendPreviousAmount) / trendPreviousAmount) * 100
        : trendCurrentAmount > 0
          ? 100
          : 0;

    const ringCircumference = 2 * Math.PI * 34;
    const normalizedBudgetSpentPercent = clampPercent(budgetSpentPercent);
    const normalizedTaskCompletionPercent = clampPercent(taskCompletionPercent);
    const normalizedProgressPercent = clampPercent(progressPercent);
    const normalizedExpenseProofPercent = clampPercent(expenseProofPercent);

    return {
      budgetAmount: safeBudgetAmount,
      expectedRevenueAmount: safeExpectedRevenueAmount,
      spentAmount,
      remainingAmount,
      memberCount: safeMemberCount,
      progressPercent: normalizedProgressPercent,
      budgetSpentPercent: normalizedBudgetSpentPercent,
      taskCompletionPercent: normalizedTaskCompletionPercent,
      expenseProofPercent: normalizedExpenseProofPercent,
      totalTasks,
      taskTotals,
      overdueTaskCount,
      highPriorityActiveTaskCount,
      notesCount: projectNotes.length,
      documentsCount: projectDocuments.length,
      expensesCount: projectExpenses.length,
      rangeExpensesCount: rangeExpenses.length,
      trendWindowLabel: selectedRange.windowLabel,
      trendDeltaLabel: selectedRange.deltaLabel,
      trendBuckets,
      trendMaxAmount,
      trendDeltaPercent,
      topExpenseCategories,
      topExpenseCategoryMax,
      ringCircumference,
      budgetRingDash: (normalizedBudgetSpentPercent / 100) * ringCircumference,
      taskRingDash: (normalizedTaskCompletionPercent / 100) * ringCircumference,
    };
  }, [
    selectedProject,
    totalProjectExpensesAmount,
    projectTasks,
    projectExpenses,
    projectNotes,
    projectDocuments,
    overviewRange,
  ]);

  const projectSummaryReport = useMemo(() => {
    if (!selectedProject) return null;

    const budgetUsedPercent = clampPercent(projectOverviewAnalytics.budgetSpentPercent);
    const executionPercent = clampPercent(projectOverviewAnalytics.taskCompletionPercent);
    const proofCoveragePercent = clampPercent(projectOverviewAnalytics.expenseProofPercent);
    const progressPercent = clampPercent(projectOverviewAnalytics.progressPercent);
    const memberCount = Number(selectedProject?.member_count || 0);
    const safeMemberCount = Number.isFinite(memberCount) && memberCount >= 0 ? memberCount : 0;

    let budgetHealth = { label: "Healthy burn", tone: "good" };
    if (budgetUsedPercent >= 100) {
      budgetHealth = { label: "Over budget", tone: "critical" };
    } else if (budgetUsedPercent >= 80) {
      budgetHealth = { label: "Watch spend", tone: "warning" };
    }

    const expenseGuardrail =
      proofCoveragePercent >= 85
        ? "Strong controls"
        : proofCoveragePercent >= 60
          ? "Needs tighter controls"
          : "Weak controls";

    const budgetAmount = Number(projectOverviewAnalytics.budgetAmount);
    const safeBudgetAmount = Number.isFinite(budgetAmount) && budgetAmount >= 0 ? budgetAmount : null;
    const expectedRevenueAmount = Number(projectOverviewAnalytics.expectedRevenueAmount);
    const safeExpectedRevenueAmount =
      Number.isFinite(expectedRevenueAmount) && expectedRevenueAmount >= 0
        ? expectedRevenueAmount
        : null;
    const spentAmount = Number(projectOverviewAnalytics.spentAmount);
    const safeSpentAmount = Number.isFinite(spentAmount) && spentAmount >= 0 ? spentAmount : 0;
    const remainingAmount = Number(projectOverviewAnalytics.remainingAmount);
    const safeRemainingAmount =
      Number.isFinite(remainingAmount) && remainingAmount >= 0 ? remainingAmount : null;

    const fundsCommittedAmount = safeExpectedRevenueAmount;
    const coveragePercent =
      safeBudgetAmount !== null && safeBudgetAmount > 0 && fundsCommittedAmount !== null
        ? clampPercent((fundsCommittedAmount / safeBudgetAmount) * 100)
        : null;
    const fundingGapAmount =
      safeBudgetAmount !== null
        ? fundsCommittedAmount !== null
          ? Math.max(safeBudgetAmount - fundsCommittedAmount, 0)
          : safeBudgetAmount
        : null;
    const fundingSurplusAmount =
      safeBudgetAmount !== null && fundsCommittedAmount !== null && fundsCommittedAmount > safeBudgetAmount
        ? fundsCommittedAmount - safeBudgetAmount
        : 0;

    let fundingStatus = { label: "Coverage unknown", tone: "unknown" };
    if (coveragePercent !== null) {
      if (coveragePercent >= 100) {
        fundingStatus = { label: "Fully covered", tone: "good" };
      } else if (coveragePercent >= 70) {
        fundingStatus = { label: "Partially covered", tone: "warning" };
      } else {
        fundingStatus = { label: "Funding gap", tone: "critical" };
      }
    } else if (safeBudgetAmount !== null && safeBudgetAmount > 0) {
      fundingStatus = { label: "Funding not mapped", tone: "warning" };
    }

    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTs = todayStart.getTime();
    const rollingStart = new Date(todayStart);
    rollingStart.setDate(rollingStart.getDate() - 89);
    const rollingStartTs = rollingStart.getTime();

    let rollingSpendAmount = 0;
    projectExpenses.forEach((expense) => {
      const amount = Number(expense?.amount);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const timestamp = Date.parse(String(expense?.expense_date || expense?.created_at || ""));
      if (!Number.isFinite(timestamp)) return;
      if (timestamp < rollingStartTs || timestamp > todayStartTs + 24 * 60 * 60 * 1000) return;
      rollingSpendAmount += amount;
    });

    let monthlyBurnRate = rollingSpendAmount > 0 ? rollingSpendAmount / 3 : 0;
    if (monthlyBurnRate <= 0 && safeSpentAmount > 0) {
      const startTimestamp = Date.parse(String(selectedProject?.start_date || ""));
      if (Number.isFinite(startTimestamp)) {
        const activeMonths = Math.max((todayStartTs - startTimestamp) / (1000 * 60 * 60 * 24 * 30), 1);
        monthlyBurnRate = safeSpentAmount / activeMonths;
      } else {
        monthlyBurnRate = safeSpentAmount;
      }
    }

    const runwayMonths =
      safeRemainingAmount !== null && monthlyBurnRate > 0
        ? Math.max(safeRemainingAmount / monthlyBurnRate, 0)
        : null;
    let runwayStatus = { label: "Runway unavailable", tone: "unknown" };
    if (runwayMonths !== null) {
      if (runwayMonths < 3) {
        runwayStatus = { label: "Short runway", tone: "critical" };
      } else if (runwayMonths < 6) {
        runwayStatus = { label: "Moderate runway", tone: "warning" };
      } else {
        runwayStatus = { label: "Healthy runway", tone: "good" };
      }
    }

    const topCategories = (projectOverviewAnalytics.topExpenseCategories || []).slice(0, 5).map((item) => ({
      category: String(item?.category || "Other"),
      amount: Number(item?.amount || 0),
    }));
    const topCategoryMax = topCategories.reduce((maxValue, item) => Math.max(maxValue, item.amount), 0);

    const recentExpensesFeed = recentProjectExpenses.slice(0, 5).map((expense, index) => {
      const hasProof = hasExpenseProof(expense);
      return {
        id: String(expense?.id || `expense-${index + 1}`),
        title: String(expense?.title || expense?.category || "Expense item").trim() || "Expense item",
        vendor: String(expense?.vendor || "Vendor not specified").trim() || "Vendor not specified",
        amount: Number(expense?.amount || 0),
        dateLabel: formatDate(expense?.expense_date || expense?.created_at),
        hasProof,
      };
    });

    const expenseCount = projectOverviewAnalytics.expensesCount;
    const completionLabel =
      executionPercent >= 75 ? "On schedule" : executionPercent >= 45 ? "Progressing" : "Needs acceleration";
    const leadSummary = getProjectLead(selectedProject);

    const linkedProjectId = String(selectedProject?.id || "").trim();
    const linkedPartners = organizationPartners
      .filter((partner) =>
        linkedProjectId
          ? Array.isArray(partner?.linked_project_ids) &&
            partner.linked_project_ids.some((projectId) => String(projectId || "").trim() === linkedProjectId)
          : false
      )
      .map((partner) => String(partner?.name || "").trim())
      .filter(Boolean);

    const milestoneRows = (() => {
      const rows = [...projectTasks]
        .map((task, index) => {
          const statusKey = String(task?.status || "open")
            .trim()
            .toLowerCase();
          const dueTimestamp = Date.parse(String(task?.due_date || ""));
          const hasDueDate = Number.isFinite(dueTimestamp);
          const isDone = statusKey === "done";
          const isCancelled = statusKey === "cancelled";
          const isOverdue = hasDueDate && dueTimestamp < todayStartTs && !isDone && !isCancelled;
          const statusLabel = TASK_STATUS_LABELS[statusKey] || toReadableLabel(statusKey, "Open");
          const timelineTone = isDone ? "done" : isOverdue ? "critical" : statusKey === "in_progress" ? "active" : "upcoming";
          return {
            id: String(task?.id || `milestone-${index + 1}`),
            title: String(task?.title || "Untitled milestone").trim() || "Untitled milestone",
            assignee: String(task?.assignee_name || "").trim() || "Unassigned",
            dueLabel: hasDueDate ? formatDate(task?.due_date) : "No due date",
            dueSort: hasDueDate ? dueTimestamp : Number.MAX_SAFE_INTEGER,
            statusLabel: isOverdue ? "Overdue" : statusLabel,
            timelineTone,
            isDone,
          };
        })
        .sort((a, b) => a.dueSort - b.dueSort)
        .slice(0, 6);

      if (rows.length) return rows;

      const fallbackStart = new Date(Date.parse(String(selectedProject?.start_date || "")) || Date.now());
      const fallbackMilestones = [
        { title: "Project kickoff", offsetDays: 0, statusLabel: "Started", timelineTone: "done" },
        { title: "Midpoint delivery review", offsetDays: 60, statusLabel: "In progress", timelineTone: "active" },
        { title: "Donor reporting checkpoint", offsetDays: 120, statusLabel: "Upcoming", timelineTone: "upcoming" },
      ];
      return fallbackMilestones.map((milestone, index) => {
        const dueDate = new Date(fallbackStart);
        dueDate.setDate(fallbackStart.getDate() + milestone.offsetDays);
        return {
          id: `fallback-milestone-${index + 1}`,
          title: milestone.title,
          assignee: "Project team",
          dueLabel: formatDate(dueDate.toISOString()),
          dueSort: dueDate.getTime(),
          statusLabel: milestone.statusLabel,
          timelineTone: milestone.timelineTone,
          isDone: milestone.timelineTone === "done",
        };
      });
    })();

    const milestoneCompletionPercent =
      milestoneRows.length > 0
        ? clampPercent((milestoneRows.filter((row) => row.isDone).length / milestoneRows.length) * 100)
        : 0;

    const milestoneTarget = projectOverviewAnalytics.totalTasks > 0 ? projectOverviewAnalytics.totalTasks : 4;
    const kpiTracker = [
      {
        key: "member_reach",
        label: "Member reach",
        baseline: 0,
        current: safeMemberCount,
        target: Math.max(safeMemberCount, Math.ceil(safeMemberCount * 1.25), 5),
        unit: "members",
      },
      {
        key: "milestones",
        label: "Milestones delivered",
        baseline: 0,
        current: projectOverviewAnalytics.taskTotals.done,
        target: milestoneTarget,
        unit: "milestones",
      },
      {
        key: "budget_coverage",
        label: "Budget coverage",
        baseline: 0,
        current: coveragePercent ?? 0,
        target: 100,
        unit: "%",
      },
      {
        key: "expense_compliance",
        label: "Expense compliance",
        baseline: 0,
        current: proofCoveragePercent,
        target: 95,
        unit: "%",
      },
    ].map((row) => {
      const safeTarget = Number(row.target);
      const safeCurrent = Number(row.current);
      const progressToTarget =
        Number.isFinite(safeTarget) && safeTarget > 0 && Number.isFinite(safeCurrent)
          ? clampPercent((safeCurrent / safeTarget) * 100)
          : 0;
      const change = Number.isFinite(safeCurrent) ? safeCurrent - Number(row.baseline || 0) : 0;
      return {
        ...row,
        progressToTarget,
        change,
      };
    });

    const donorAskAmount =
      fundingGapAmount !== null && fundingGapAmount > 0 ? fundingGapAmount : null;
    const donorAskSummary =
      donorAskAmount !== null
        ? `Seeking ${formatCurrency(donorAskAmount)} to close the current funding gap and sustain planned delivery milestones.`
        : fundingSurplusAmount > 0
          ? `Funding projections exceed budget by ${formatCurrency(fundingSurplusAmount)}. Additional support can accelerate delivery scale.`
          : "Funding position is balanced to budget. Additional support can be directed to acceleration priorities.";

    const completedMilestones = Number(projectOverviewAnalytics.taskTotals.done || 0);
    const costPerMember = safeMemberCount > 0 ? safeSpentAmount / safeMemberCount : null;
    const costPerCompletedMilestone =
      completedMilestones > 0 ? safeSpentAmount / completedMilestones : null;
    const budgetLeverageRatio =
      safeSpentAmount > 0 && safeExpectedRevenueAmount !== null
        ? safeExpectedRevenueAmount / safeSpentAmount
        : null;

    let valueForMoneyNarrative = "Value-for-money baseline is being established as more delivery data is captured.";
    if (costPerMember !== null && budgetLeverageRatio !== null) {
      valueForMoneyNarrative =
        budgetLeverageRatio >= 1
          ? `Current spending translates into projected returns at approximately ${budgetLeverageRatio.toFixed(
              2
            )}x of spend, with unit costs at ${formatCurrency(costPerMember)} per member reached.`
          : `Projected returns are still below total spend (${budgetLeverageRatio.toFixed(
              2
            )}x). Focus is on cost control and milestone acceleration.`;
    }

    const riskScoreLookup = { low: 1, medium: 2, high: 3 };
    const toRiskTone = (likelihood, impact) => {
      const likelihoodScore = riskScoreLookup[String(likelihood || "").toLowerCase()] || 1;
      const impactScore = riskScoreLookup[String(impact || "").toLowerCase()] || 1;
      const severityScore = likelihoodScore * impactScore;
      if (severityScore >= 6) return "high";
      if (severityScore >= 3) return "medium";
      return "low";
    };

    const riskReviewDate = new Date(todayStart);
    riskReviewDate.setDate(riskReviewDate.getDate() + 30);
    const reviewDateLabel = formatDate(riskReviewDate.toISOString());

    const fundingRiskLikelihood = coveragePercent === null ? "medium" : coveragePercent < 70 ? "high" : coveragePercent < 100 ? "medium" : "low";
    const fundingRiskImpact = fundingGapAmount !== null && fundingGapAmount > 0 ? "high" : "medium";
    const deliveryRiskLikelihood =
      projectOverviewAnalytics.overdueTaskCount > 0 ? "high" : projectOverviewAnalytics.highPriorityActiveTaskCount > 1 ? "medium" : "low";
    const deliveryRiskImpact = executionPercent < 50 ? "high" : executionPercent < 75 ? "medium" : "low";
    const complianceRiskLikelihood = proofCoveragePercent < 60 ? "high" : proofCoveragePercent < 85 ? "medium" : "low";
    const complianceRiskImpact = proofCoveragePercent < 60 ? "high" : "medium";

    const riskRegister = [
      {
        key: "funding_continuity",
        risk: "Funding continuity and cashflow pressure",
        likelihood: toReadableLabel(fundingRiskLikelihood, "Medium"),
        impact: toReadableLabel(fundingRiskImpact, "Medium"),
        tone: toRiskTone(fundingRiskLikelihood, fundingRiskImpact),
        owner: "Records lead",
        mitigation:
          donorAskAmount !== null
            ? `Prioritize closure of the ${formatCurrency(donorAskAmount)} funding ask and phase non-critical spend.`
            : "Maintain monthly budget variance reviews and ring-fence critical costs.",
        reviewDate: reviewDateLabel,
      },
      {
        key: "delivery_slippage",
        risk: "Delivery slippage against milestone schedule",
        likelihood: toReadableLabel(deliveryRiskLikelihood, "Medium"),
        impact: toReadableLabel(deliveryRiskImpact, "Medium"),
        tone: toRiskTone(deliveryRiskLikelihood, deliveryRiskImpact),
        owner: "Project manager",
        mitigation:
          projectOverviewAnalytics.overdueTaskCount > 0
            ? `Recover ${projectOverviewAnalytics.overdueTaskCount} overdue task(s) with weekly milestone check-ins.`
            : "Maintain weekly workplan reviews and escalation for critical tasks.",
        reviewDate: reviewDateLabel,
      },
      {
        key: "compliance_gap",
        risk: "Compliance and evidence quality risk",
        likelihood: toReadableLabel(complianceRiskLikelihood, "Medium"),
        impact: toReadableLabel(complianceRiskImpact, "Medium"),
        tone: toRiskTone(complianceRiskLikelihood, complianceRiskImpact),
        owner: "M&E and admin",
        mitigation:
          proofCoveragePercent < 95
            ? "Enforce receipt upload and monthly document verification for all expenses."
            : "Continue quarterly internal compliance reviews.",
        reviewDate: reviewDateLabel,
      },
    ];

    const riskHighCount = riskRegister.filter((row) => row.tone === "high").length;
    const riskMediumCount = riskRegister.filter((row) => row.tone === "medium").length;

    const mePlan = kpiTracker.map((kpi) => {
      let dataSource = "Project records";
      let frequency = "Monthly";
      let verification = "Internal review sign-off";
      if (kpi.key === "member_reach") {
        dataSource = "Member registry and attendance logs";
        frequency = "Monthly";
        verification = "Cross-check against membership roll";
      } else if (kpi.key === "milestones") {
        dataSource = "Task tracker and completion reports";
        frequency = "Bi-weekly";
        verification = "Project manager approval";
      } else if (kpi.key === "budget_coverage") {
        dataSource = "Budget ledger and funding commitments";
        frequency = "Monthly";
        verification = "Records reconciliation";
      } else if (kpi.key === "expense_compliance") {
        dataSource = "Expense register and receipt archive";
        frequency = "Monthly";
        verification = "Random proof audit";
      }
      return {
        ...kpi,
        dataSource,
        frequency,
        verification,
      };
    });

    const sustainabilityScore = clampPercent(
      ((executionPercent || 0) + (proofCoveragePercent || 0) + (coveragePercent ?? progressPercent ?? 0)) / 3
    );
    let sustainabilityLabel = "At risk";
    if (sustainabilityScore >= 85) {
      sustainabilityLabel = "Resilient";
    } else if (sustainabilityScore >= 70) {
      sustainabilityLabel = "Strengthening";
    }

    const sustainabilityPillars = [
      {
        key: "financial",
        title: "Financial continuity",
        detail:
          safeExpectedRevenueAmount !== null
            ? `Funding target of ${formatCurrency(
                safeExpectedRevenueAmount
              )} is tracked against spend and reinvestment needs.`
            : "Funding planning is pending; funding diversification should be prioritized.",
      },
      {
        key: "capacity",
        title: "Local delivery capacity",
        detail: `${safeMemberCount} member(s) are currently linked to execution with structured milestones and role ownership.`,
      },
      {
        key: "governance",
        title: "Governance and accountability",
        detail: `${projectOverviewAnalytics.documentsCount} documents and ${projectOverviewAnalytics.notesCount} notes currently support traceability and continuity.`,
      },
    ];

    return {
      generatedAt: new Date().toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      projectName: String(selectedProject?.name || "Project"),
      moduleLabel: getProjectCategory(selectedProject),
      statusLabel: String(selectedProject?.status || "active")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      startDateLabel: formatDate(selectedProject?.start_date),
      memberCount: safeMemberCount,
      leadSummary,
      budgetHealth,
      expenseGuardrail,
      fundingStatus,
      runwayStatus,
      progressPercent,
      budgetUsedPercent,
      executionPercent,
      proofCoveragePercent,
      completionLabel,
      budgetAmount: safeBudgetAmount,
      spentAmount: safeSpentAmount,
      remainingAmount: safeRemainingAmount,
      expectedRevenueAmount: safeExpectedRevenueAmount,
      fundsCommittedAmount,
      fundingGapAmount,
      fundingSurplusAmount,
      budgetCoveragePercent: coveragePercent,
      monthlyBurnRate,
      runwayMonths,
      totalTasks: projectOverviewAnalytics.totalTasks,
      taskTotals: projectOverviewAnalytics.taskTotals,
      overdueTaskCount: projectOverviewAnalytics.overdueTaskCount,
      highPriorityActiveTaskCount: projectOverviewAnalytics.highPriorityActiveTaskCount,
      notesCount: projectOverviewAnalytics.notesCount,
      documentsCount: projectOverviewAnalytics.documentsCount,
      expenseCount,
      rangeExpensesCount: projectOverviewAnalytics.rangeExpensesCount,
      trendWindowLabel: projectOverviewAnalytics.trendWindowLabel,
      trendDeltaPercent: projectOverviewAnalytics.trendDeltaPercent,
      topCategories,
      topCategoryMax,
      recentExpensesFeed,
      milestoneRows,
      milestoneCompletionPercent,
      kpiTracker,
      linkedPartners,
      donorAskAmount,
      donorAskSummary,
      costPerMember,
      costPerCompletedMilestone,
      budgetLeverageRatio,
      valueForMoneyNarrative,
      riskRegister,
      riskHighCount,
      riskMediumCount,
      mePlan,
      sustainabilityScore,
      sustainabilityLabel,
      sustainabilityPillars,
    };
  }, [selectedProject, projectOverviewAnalytics, recentProjectExpenses, projectExpenses, projectTasks, organizationPartners]);

  const openBudgetSummaryReportModal = () => {
    if (!selectedProject) return;
    setShowBudgetSummaryReportModal(true);
  };

  const closeBudgetSummaryReportModal = () => {
    setExportingDonorBrief(false);
    setShowBudgetSummaryReportModal(false);
  };

  const buildDonorBriefLines = (report) => {
    if (!report) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${report.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "EXECUTIVE SUMMARY");
    appendWrappedPdfLine(lines, `Project: ${report.projectName}`);
    appendWrappedPdfLine(lines, `Module: ${report.moduleLabel}`);
    appendWrappedPdfLine(lines, `Status: ${report.statusLabel}`);
    appendWrappedPdfLine(lines, `Started: ${report.startDateLabel}`);
    appendWrappedPdfLine(lines, `Lead summary: ${report.leadSummary}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "FUNDING POSITION");
    appendWrappedPdfLine(lines, `Total budget: ${formatCurrency(report.budgetAmount)}`);
    appendWrappedPdfLine(lines, `Funds committed: ${formatCurrency(report.fundsCommittedAmount)}`);
    appendWrappedPdfLine(lines, `Spent to date: ${formatCurrency(report.spentAmount)}`);
    appendWrappedPdfLine(lines, `Budget remaining: ${formatCurrency(report.remainingAmount)}`);
    appendWrappedPdfLine(lines, `Funding gap: ${formatCurrency(report.fundingGapAmount)}`);
    appendWrappedPdfLine(
      lines,
      `Budget coverage: ${formatPercentLabel(report.budgetCoveragePercent)} | Burn rate: ${formatCurrency(
        report.monthlyBurnRate
      )}/month | Runway: ${formatReportMetricValue(report.runwayMonths, "months")}`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "DELIVERY STATUS");
    appendWrappedPdfLine(
      lines,
      `Progress: ${formatPercentLabel(report.progressPercent)} | Execution: ${formatPercentLabel(
        report.executionPercent
      )} | Compliance: ${formatPercentLabel(report.proofCoveragePercent)}`
    );
    appendWrappedPdfLine(
      lines,
      `Tasks: ${report.taskTotals.done} done, ${report.taskTotals.in_progress} in progress, ${report.taskTotals.open} open, ${report.overdueTaskCount} overdue`
    );
    appendWrappedPdfLine(lines, `Documents: ${report.documentsCount} | Notes: ${report.notesCount}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "KPI TRACKER");
    report.kpiTracker.slice(0, 4).forEach((kpi, index) => {
      appendWrappedPdfLine(
        lines,
        `${index + 1}. ${kpi.label}: Baseline ${formatReportMetricValue(
          kpi.baseline,
          kpi.unit
        )} | Current ${formatReportMetricValue(kpi.current, kpi.unit)} | Target ${formatReportMetricValue(
          kpi.target,
          kpi.unit
        )}`
      );
    });
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "MILESTONE TIMELINE");
    report.milestoneRows.slice(0, 5).forEach((milestone, index) => {
      appendWrappedPdfLine(
        lines,
        `${index + 1}. ${milestone.title} | ${milestone.statusLabel} | Due ${milestone.dueLabel} | ${milestone.assignee}`
      );
    });
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "VALUE FOR MONEY");
    appendWrappedPdfLine(lines, `Cost per member reached: ${formatCurrency(report.costPerMember)}`);
    appendWrappedPdfLine(
      lines,
      `Cost per milestone delivered: ${formatCurrency(report.costPerCompletedMilestone)}`
    );
    appendWrappedPdfLine(
      lines,
      `Leverage ratio (expected funding vs spend): ${formatReportMetricValue(report.budgetLeverageRatio, "x")}`
    );
    appendWrappedPdfLine(lines, `Narrative: ${report.valueForMoneyNarrative}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "RISK REGISTER");
    report.riskRegister.slice(0, 3).forEach((risk, index) => {
      appendWrappedPdfLine(
        lines,
        `${index + 1}. ${risk.risk} | Likelihood ${risk.likelihood} | Impact ${risk.impact} | Owner ${risk.owner} | Review ${risk.reviewDate}`
      );
      appendWrappedPdfLine(lines, `Mitigation: ${risk.mitigation}`);
    });
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "MONITORING & EVALUATION");
    report.mePlan.slice(0, 4).forEach((indicator, index) => {
      appendWrappedPdfLine(
        lines,
        `${index + 1}. ${indicator.label} | Source: ${indicator.dataSource} | Frequency: ${indicator.frequency} | Verification: ${indicator.verification}`
      );
    });
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "SUSTAINABILITY");
    appendWrappedPdfLine(
      lines,
      `Sustainability score: ${formatPercentLabel(report.sustainabilityScore)} (${report.sustainabilityLabel})`
    );
    report.sustainabilityPillars.slice(0, 3).forEach((pillar, index) => {
      appendWrappedPdfLine(lines, `${index + 1}. ${pillar.title}: ${pillar.detail}`);
    });
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PARTNER & FUNDING ASK");
    appendWrappedPdfLine(
      lines,
      `Linked partners: ${report.linkedPartners.length ? report.linkedPartners.join(", ") : "None listed"}`
    );
    appendWrappedPdfLine(lines, `Funding narrative: ${report.donorAskSummary}`);
    return lines;
  };

  const handleDownloadDonorBrief = () => {
    if (!projectSummaryReport || exportingDonorBrief) return;
    setExportingDonorBrief(true);
    try {
      const lines = buildDonorBriefLines(projectSummaryReport);
      const fileTitle = `${projectSummaryReport.projectName} Donor Brief`;
      const blob = buildSimplePdfBlob(fileTitle, lines);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const slug = toFilenameSlug(projectSummaryReport.projectName || "project");
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${slug}-donor-brief-${dateStamp}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setProjectsNotice({
        type: "success",
        message: "Donor brief downloaded.",
      });
    } catch (error) {
      console.error("Error generating donor brief:", error);
      setProjectsNotice({
        type: "warning",
        message: "Failed to generate donor brief PDF.",
      });
    } finally {
      setExportingDonorBrief(false);
    }
  };

  const projectExpenseInsights = useMemo(() => {
    const totalAmount = Number.isFinite(totalProjectExpensesAmount) ? totalProjectExpensesAmount : 0;
    const categoryTotals = new Map();
    const vendorTotals = new Map();
    let missingReceiptCount = 0;

    projectExpenses.forEach((expense) => {
      const amount = Number(expense?.amount);
      const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
      const category = String(expense?.category || "Other").trim() || "Other";
      const vendor = String(expense?.vendor || "").trim() || "Unknown vendor";
      const hasProof = hasExpenseProof(expense);

      categoryTotals.set(category, (categoryTotals.get(category) || 0) + safeAmount);
      const vendorCurrent = vendorTotals.get(vendor) || { name: vendor, amount: 0, count: 0 };
      vendorTotals.set(vendor, {
        ...vendorCurrent,
        amount: vendorCurrent.amount + safeAmount,
        count: vendorCurrent.count + 1,
      });
      if (!hasProof) {
        missingReceiptCount += 1;
      }
    });

    const palette = ["#7c3aed", "#3b82f6", "#06b6d4", "#22c55e", "#84cc16", "#f59e0b", "#ef4444", "#14b8a6"];
    const sortedCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, amount], index) => ({
        label,
        amount,
        color: palette[index % palette.length],
      }));

    const legendCategories = sortedCategories.slice(0, 4);
    const remainingCategoryAmount = sortedCategories
      .slice(4)
      .reduce((sum, item) => sum + Number(item?.amount || 0), 0);

    const donutCategories = [...legendCategories];
    if (remainingCategoryAmount > 0) {
      donutCategories.push({
        label: "Other",
        amount: remainingCategoryAmount,
        color: "#94a3b8",
      });
    }

    let cursor = 0;
    const donutSegments =
      totalAmount > 0
        ? donutCategories.map((item, index) => {
            const slice = (Number(item?.amount || 0) / totalAmount) * 360;
            const start = cursor;
            const end = index === donutCategories.length - 1 ? 360 : Math.min(360, start + slice);
            cursor = end;
            return `${item.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
          })
        : [];

    const maxCategoryAmount = legendCategories.reduce(
      (maxValue, item) => Math.max(maxValue, Number(item?.amount || 0)),
      0
    );

    const leadingVendor =
      Array.from(vendorTotals.values()).sort((a, b) => {
        const amountDelta = Number(b?.amount || 0) - Number(a?.amount || 0);
        if (amountDelta !== 0) return amountDelta;
        return String(a?.name || "").localeCompare(String(b?.name || ""));
      })[0] || null;

    return {
      totalAmount,
      expenseCount: projectExpenses.length,
      missingReceiptCount,
      legendCategories,
      donutGradient: donutSegments.length
        ? `conic-gradient(${donutSegments.join(", ")})`
        : "conic-gradient(#e2e8f0 0deg 360deg)",
      maxCategoryAmount,
      leadingVendor,
    };
  }, [projectExpenses, totalProjectExpensesAmount]);

  const leadingExpenseVendorName = String(projectExpenseInsights.leadingVendor?.name || "").trim();
  const leadingExpenseVendorLogo = useMemo(() => {
    if (!leadingExpenseVendorName) return "";
    const partner = expensePartnerByName.get(normalizePartnerLookupKey(leadingExpenseVendorName));
    return String(partner?.logo_url || "").trim();
  }, [expensePartnerByName, leadingExpenseVendorName]);

  const visibleProjectExpenses = useMemo(
    () => (isMobileProjectViewport ? sortedProjectExpenses : recentProjectExpenses),
    [isMobileProjectViewport, sortedProjectExpenses, recentProjectExpenses]
  );

  const expenseRowIds = useMemo(
    () =>
      visibleProjectExpenses
        .map((expense) => String(expense?.id ?? ""))
        .filter(Boolean),
    [visibleProjectExpenses]
  );

  useEffect(() => {
    const visibleExpenseSet = new Set(expenseRowIds);
    setSelectedExpenseIds((prev) => prev.filter((expenseId) => visibleExpenseSet.has(expenseId)));
  }, [expenseRowIds]);

  useEffect(() => {
    if (!selectedExpenseDetailId) return;
    const exists = projectExpenses.some(
      (expense) => String(expense?.id ?? "") === String(selectedExpenseDetailId)
    );
    if (!exists) {
      setSelectedExpenseDetailId("");
    }
  }, [projectExpenses, selectedExpenseDetailId]);

  useEffect(() => {
    return () => {
      if (expenseLongPressTimerRef.current) {
        window.clearTimeout(expenseLongPressTimerRef.current);
        expenseLongPressTimerRef.current = null;
      }
    };
  }, []);

  const allExpensesSelected =
    expenseRowIds.length > 0 &&
    expenseRowIds.every((expenseId) => selectedExpenseIds.includes(expenseId));

  const handleToggleSelectAllExpenses = () => {
    if (allExpensesSelected) {
      setSelectedExpenseIds([]);
      return;
    }
    setSelectedExpenseIds(expenseRowIds);
  };

  const handleToggleExpenseSelection = (expenseId) => {
    const normalizedId = String(expenseId ?? "");
    if (!normalizedId) return;
    setSelectedExpenseIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const selectedExpenses = useMemo(() => {
    const selectedSet = new Set(selectedExpenseIds.map((expenseId) => String(expenseId)));
    return projectExpenses.filter((expense) => selectedSet.has(String(expense?.id ?? "")));
  }, [projectExpenses, selectedExpenseIds]);

  const selectedExpenseDetail = useMemo(() => {
    const normalizedId = String(selectedExpenseDetailId || "").trim();
    if (!normalizedId) return null;
    return (
      sortedProjectExpenses.find((expense) => String(expense?.id ?? "") === normalizedId) || null
    );
  }, [sortedProjectExpenses, selectedExpenseDetailId]);

  const expenseActionExpense = useMemo(() => {
    const normalizedId = String(expenseActionExpenseId || "").trim();
    if (!normalizedId) return null;
    return (
      sortedProjectExpenses.find((expense) => String(expense?.id ?? "") === normalizedId) || null
    );
  }, [sortedProjectExpenses, expenseActionExpenseId]);

  const selectedExpenseDetailParsed = useMemo(
    () =>
      parseExpenseDescriptionForForm(
        selectedExpenseDetail?.description,
        selectedExpenseDetail?.category
      ),
    [selectedExpenseDetail?.description, selectedExpenseDetail?.category]
  );

  const expenseCategoryUsage = useMemo(() => {
    const usage = new Map();
    projectExpenses.forEach((expense) => {
      const category = String(expense?.category || "").trim();
      if (!category) return;
      usage.set(category, (usage.get(category) || 0) + 1);
    });
    return usage;
  }, [projectExpenses]);

  const suggestedExpenseCategories = useMemo(() => {
    const categorySet = new Set(DEFAULT_EXPENSE_CATEGORIES);
    expenseCategoryRows.forEach((row) => {
      const category = String(row?.name || "").trim();
      if (category) categorySet.add(category);
    });
    projectExpenses.forEach((expense) => {
      const category = String(expense?.category || "").trim();
      if (category) categorySet.add(category);
    });
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
  }, [projectExpenses, expenseCategoryRows]);

  const openEditExpenseModal = (expense) => {
    if (!canManageProjectContent || !expense) return;
    const parsed = parseExpenseDescriptionForForm(expense?.description, expense?.category);
    setEditingExpenseId(String(expense?.id ?? ""));
    setExpenseForm({
      title: parsed.title || String(expense?.category || ""),
      amount:
        expense?.amount === undefined || expense?.amount === null
          ? ""
          : String(expense.amount),
      category: String(expense?.category || "Supplies"),
      vendor: String(expense?.vendor || ""),
      date: String(expense?.expense_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      paymentReference: String(expense?.payment_reference || ""),
      receiptFile: null,
      existingReceiptUrl: String(expense?.receipt_download_url || expense?.receipt_file_url || ""),
      existingReceiptPath: String(expense?.receipt_file_path || ""),
      notes: parsed.notes || "",
    });
    if (expenseFormReceiptInputRef.current) {
      expenseFormReceiptInputRef.current.value = "";
    }
    setExpenseReceiptDragActive(false);
    setExpenseFormError("");
    setShowExpenseModal(true);
  };

  const openEditSelectedExpenseModal = () => {
    if (!canManageProjectContent) return;
    if (selectedExpenses.length !== 1) return;
    openEditExpenseModal(selectedExpenses[0]);
  };

  const openExpenseDetailModal = (expense) => {
    const expenseId = String(expense?.id ?? "").trim();
    if (!expenseId) return;
    setSelectedExpenseDetailId(expenseId);
  };

  const closeExpenseDetailModal = () => {
    setSelectedExpenseDetailId("");
  };

  const openExpenseActionSheet = (expense) => {
    if (!isMobileProjectViewport) return;
    const expenseId = String(expense?.id ?? "").trim();
    if (!expenseId) return;
    setExpenseActionExpenseId(expenseId);
  };

  const closeExpenseActionSheet = () => {
    setExpenseActionExpenseId("");
  };

  const handleEditExpenseFromActionSheet = () => {
    if (!canManageProjectContent || !expenseActionExpense) return;
    const expenseToEdit = expenseActionExpense;
    closeExpenseActionSheet();
    openEditExpenseModal(expenseToEdit);
  };

  const handleDuplicateExpenseFromActionSheet = () => {
    if (!canManageProjectContent || !expenseActionExpense) return;
    const parsed = parseExpenseDescriptionForForm(
      expenseActionExpense?.description,
      expenseActionExpense?.category
    );
    setSelectedExpenseDetailId("");
    setEditingExpenseId(null);
    setExpenseForm({
      title: parsed.title || String(expenseActionExpense?.category || ""),
      amount:
        expenseActionExpense?.amount === undefined || expenseActionExpense?.amount === null
          ? ""
          : String(expenseActionExpense.amount),
      category: String(expenseActionExpense?.category || "Supplies"),
      vendor: String(expenseActionExpense?.vendor || ""),
      date: String(
        expenseActionExpense?.expense_date || new Date().toISOString().slice(0, 10)
      ).slice(0, 10),
      paymentReference: String(expenseActionExpense?.payment_reference || ""),
      receiptFile: null,
      existingReceiptUrl: "",
      existingReceiptPath: "",
      notes: parsed.notes || "",
    });
    if (expenseFormReceiptInputRef.current) {
      expenseFormReceiptInputRef.current.value = "";
    }
    setExpenseReceiptDragActive(false);
    setExpenseFormError("");
    closeExpenseActionSheet();
    setShowExpenseModal(true);
  };

  const handleDeleteExpenseFromActionSheet = () => {
    if (!canManageProjectContent || !expenseActionExpense) return;
    const expenseId = String(expenseActionExpense?.id ?? "").trim();
    if (!expenseId) return;
    setSelectedExpenseIds([expenseId]);
    closeExpenseActionSheet();
    setShowDeleteExpensesModal(true);
  };

  const clearExpenseLongPressTimer = () => {
    if (expenseLongPressTimerRef.current) {
      window.clearTimeout(expenseLongPressTimerRef.current);
      expenseLongPressTimerRef.current = null;
    }
  };

  const handleExpensePressStart = (expenseId) => {
    if (!isMobileProjectViewport || !canManageProjectContent) return;
    const normalizedId = String(expenseId ?? "");
    if (!normalizedId) return;
    clearExpenseLongPressTimer();
    expenseLongPressTimerRef.current = window.setTimeout(() => {
      setSelectedExpenseIds((prev) => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
      suppressExpenseOpenRef.current = true;
    }, 420);
  };

  const handleExpensePressEnd = () => {
    clearExpenseLongPressTimer();
  };

  const handleExpenseRowActivate = (expense) => {
    const normalizedId = String(expense?.id ?? "");
    if (!normalizedId) return;
    if (suppressExpenseOpenRef.current) {
      suppressExpenseOpenRef.current = false;
      return;
    }
    if (isMobileProjectViewport && canManageProjectContent && selectedExpenseIds.length > 0) {
      handleToggleExpenseSelection(normalizedId);
      return;
    }
    openExpenseDetailModal(expense);
  };

  const requestDeleteSelectedExpenses = () => {
    if (!canManageProjectContent) return;
    if (!selectedExpenses.length) return;
    setShowDeleteExpensesModal(true);
  };

  const closeDeleteExpensesModal = () => {
    if (deletingExpenses) return;
    setShowDeleteExpensesModal(false);
  };

  useEffect(() => {
    if (!showDeleteExpensesModal) return;
    if (selectedExpenses.length > 0) return;
    setShowDeleteExpensesModal(false);
  }, [showDeleteExpensesModal, selectedExpenses.length]);

  const handleConfirmDeleteSelectedExpenses = async () => {
    if (!canManageProjectContent) return;
    if (!selectedExpenses.length) return;
    setDeletingExpenses(true);
    setExpenseFormError("");
    let successCount = 0;
    let failureCount = 0;
    const deletedIds = [];

    try {
      for (const expense of selectedExpenses) {
        try {
          await deleteProjectExpense(expense.id, tenantId);
          successCount += 1;
          deletedIds.push(String(expense.id));
        } catch (error) {
          failureCount += 1;
          console.error("Error deleting selected expense:", error);
        }
      }

      if (deletedIds.length) {
        setProjectExpenses((prev) =>
          prev.filter((expense) => !deletedIds.includes(String(expense?.id ?? "")))
        );
        setSelectedExpenseIds((prev) =>
          prev.filter((expenseId) => !deletedIds.includes(String(expenseId)))
        );
        if (selectedExpenseDetailId && deletedIds.includes(String(selectedExpenseDetailId))) {
          setSelectedExpenseDetailId("");
        }
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message:
            successCount === 1
              ? "Expense deleted successfully."
              : `${successCount} expenses deleted successfully.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Deleted ${successCount} expense(s). ${failureCount} expense(s) failed.`,
        });
      }
      setShowDeleteExpensesModal(false);
    } finally {
      setDeletingExpenses(false);
    }
  };

  useEffect(() => {
    if (selectedProject?.id) return;
    setProjectAssignableMembers([]);
    setProjectAssignableMembersLoading(false);
    setProjectDocuments([]);
    setProjectDocumentsLoading(false);
    setProjectDocumentsError("");
    setProjectDocumentMode("upload");
    setMobileProjectDocumentMode("files");
    setEmitDocumentType(PROJECT_EMIT_DOCUMENT_OPTIONS[0].value);
    setShowDocumentTemplateActionSheet(false);
    setShowDocumentCreateActionSheet(false);
    setDocumentActionDocumentId("");
    setEmittingProjectDocument(false);
    setSelectedDocumentIds([]);
    setUploadingProjectDocument(false);
    setDeletingDocuments(false);
    setShowDeleteDocumentsModal(false);
    setShowRenameDocumentModal(false);
    setRenamingDocument(false);
    setDocumentRenameValue("");
    setDocumentRenameError("");
    setProjectExpenses([]);
    setSelectedExpenseIds([]);
    setSelectedExpenseDetailId("");
    setExpenseActionExpenseId("");
    setProjectExpensesError("");
    setProjectExpensesLoading(false);
    setExpenseCategoryRows([]);
    setExpenseCategoriesLoading(false);
    setExpenseCategoriesError("");
    setExpenseCategoryInput("");
    setEditingExpenseCategoryId("");
    setSavingExpenseCategory(false);
    setArchivingExpenseCategoryId("");
    setShowExpenseModal(false);
    setExpenseForm(createInitialExpenseForm());
    setExpenseReceiptDragActive(false);
    setExpenseFormError("");
    setEditingExpenseId(null);
    setShowDeleteExpensesModal(false);
    setShowExpenseCategoryModal(false);
    setDeletingExpenses(false);
    setSavingExpense(false);
    setUploadingExpenseReceipt(false);
    setReceiptUploadExpenseId("");
    setProjectTasks([]);
    setProjectTasksLoading(false);
    setProjectTasksError("");
    setTaskSearchQuery("");
    setTaskStatusFilter("all");
    setTaskAssigneeFilter("all");
    setMobileTaskStatusFilter("all");
    setTaskActionTaskId("");
    setSelectedTaskIds([]);
    setTaskForm(createInitialTaskForm());
    setTaskFormError("");
    setEditingTaskId(null);
    setSavingTask(false);
    setDeletingTasks(false);
    setShowTaskModal(false);
    setShowDeleteTasksModal(false);
    setProjectNotes([]);
    setProjectNotesLoading(false);
    setProjectNotesError("");
    setNoteSearchQuery("");
    setNoteVisibilityFilter("all");
    setSelectedNoteIds([]);
    setNoteForm(createInitialNoteForm());
    setNoteFormError("");
    setEditingNoteId(null);
    setSavingNote(false);
    setDeletingNotes(false);
    setShowNoteModal(false);
    setShowDeleteNotesModal(false);
  }, [selectedProject?.id]);

  const openExpenseModal = () => {
    if (!canManageProjectContent) return;
    setSelectedExpenseDetailId("");
    setEditingExpenseId(null);
    setExpenseForm(createInitialExpenseForm());
    setExpenseReceiptDragActive(false);
    if (expenseFormReceiptInputRef.current) {
      expenseFormReceiptInputRef.current.value = "";
    }
    setExpenseFormError("");
    setShowExpenseModal(true);
  };

  const closeExpenseModal = () => {
    if (savingExpense) return;
    setShowExpenseModal(false);
    setExpenseForm(createInitialExpenseForm());
    setExpenseReceiptDragActive(false);
    if (expenseFormReceiptInputRef.current) {
      expenseFormReceiptInputRef.current.value = "";
    }
    setExpenseFormError("");
    setEditingExpenseId(null);
  };

  const openExpenseCategoryModal = () => {
    if (!canManageProjectContent) return;
    setExpenseCategoriesError("");
    setShowExpenseCategoryModal(true);
  };

  const closeExpenseCategoryModal = () => {
    if (savingExpenseCategory || archivingExpenseCategoryId) return;
    setShowExpenseCategoryModal(false);
    setExpenseCategoryInput("");
    setEditingExpenseCategoryId("");
    setExpenseCategoriesError("");
  };

  const startEditingExpenseCategory = (categoryRow) => {
    if (!canManageProjectContent) return;
    const categoryId = String(categoryRow?.id || "");
    const categoryName = String(categoryRow?.name || "").trim();
    if (!categoryId || !categoryName) return;
    setEditingExpenseCategoryId(categoryId);
    setExpenseCategoryInput(categoryName);
    setExpenseCategoriesError("");
  };

  const cancelEditingExpenseCategory = () => {
    if (savingExpenseCategory) return;
    setEditingExpenseCategoryId("");
    setExpenseCategoryInput("");
    setExpenseCategoriesError("");
  };

  const handleSaveExpenseCategory = async (event) => {
    event.preventDefault();
    if (!canManageProjectContent) return;

    const projectId = normalizeProjectId(selectedProject?.id);
    if (!projectId) {
      setExpenseCategoriesError("Select a valid project before managing categories.");
      return;
    }

    const categoryName = String(expenseCategoryInput || "").trim();
    if (!categoryName) {
      setExpenseCategoriesError("Category name is required.");
      return;
    }

    setSavingExpenseCategory(true);
    setExpenseCategoriesError("");

    try {
      if (editingExpenseCategoryId) {
        const currentRow =
          expenseCategoryRows.find((row) => String(row?.id || "") === editingExpenseCategoryId) || null;
        const previousName = String(currentRow?.name || "").trim();
        await renameProjectExpenseCategory(
          editingExpenseCategoryId,
          { name: categoryName, applyToExpenses: true },
          tenantId
        );

        if (previousName && previousName !== categoryName) {
          setProjectExpenses((prev) =>
            prev.map((expense) =>
              String(expense?.category || "").trim() === previousName
                ? { ...expense, category: categoryName }
                : expense
            )
          );
          setExpenseForm((prev) =>
            String(prev.category || "").trim() === previousName
              ? { ...prev, category: categoryName }
              : prev
          );
        }

        setProjectsNotice({
          type: "success",
          message: `Category "${categoryName}" updated.`,
        });
      } else {
        await createProjectExpenseCategory(projectId, { name: categoryName }, tenantId);
        setProjectsNotice({
          type: "success",
          message: `Category "${categoryName}" created.`,
        });
      }

      const rows = await getProjectExpenseCategoryDefinitions(projectId, tenantId);
      setExpenseCategoryRows(sortExpenseCategoryRows(Array.isArray(rows) ? rows : []));
      setEditingExpenseCategoryId("");
      setExpenseCategoryInput("");
    } catch (error) {
      console.error("Error saving expense category:", error);
      setExpenseCategoriesError(error?.message || "Failed to save category.");
    } finally {
      setSavingExpenseCategory(false);
    }
  };

  const handleArchiveExpenseCategory = async (categoryRow) => {
    if (!canManageProjectContent) return;
    const categoryId = String(categoryRow?.id || "");
    const categoryName = String(categoryRow?.name || "").trim();
    if (!categoryId || !categoryName) return;

    const shouldArchive = window.confirm(
      `Archive category "${categoryName}"? Existing expenses keep their category label.`
    );
    if (!shouldArchive) return;

    setArchivingExpenseCategoryId(categoryId);
    setExpenseCategoriesError("");

    try {
      await archiveProjectExpenseCategory(categoryId, tenantId);
      setExpenseCategoryRows((prev) =>
        sortExpenseCategoryRows(prev.filter((row) => String(row?.id || "") !== categoryId))
      );
      if (editingExpenseCategoryId === categoryId) {
        setEditingExpenseCategoryId("");
        setExpenseCategoryInput("");
      }
      setProjectsNotice({
        type: "success",
        message: `Category "${categoryName}" archived.`,
      });
    } catch (error) {
      console.error("Error archiving expense category:", error);
      setExpenseCategoriesError(error?.message || "Failed to archive category.");
    } finally {
      setArchivingExpenseCategoryId("");
    }
  };

  const exportExpenseRowsToCsv = (rows, filenameSuffix = "expenses") => {
    if (!Array.isArray(rows) || rows.length === 0) {
      setProjectsNotice({
        type: "warning",
        message: "No expense rows available to export.",
      });
      return;
    }

    const headers = [
      "Project",
      "Expense Date",
      "Category",
      "Vendor",
      formatFieldLabel("Amount"),
      "Description",
      "Payment Reference",
      "Receipt",
      "Approved",
    ];
    const csvRows = rows.map((expense) => [
      selectedProject?.name || "",
      expense?.expense_date || "",
      expense?.category || "",
      expense?.vendor || "",
      Number(expense?.amount || 0),
      expense?.description || "",
      expense?.payment_reference || "",
      expense?.receipt ? "Yes" : "No",
      expense?.approved_by ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.map((value) => toCsvCell(value)).join(","),
      ...csvRows.map((row) => row.map((value) => toCsvCell(value)).join(",")),
    ].join("\n");

    const blob = new Blob([`\uFEFF${csvContent}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = toFilenameSlug(selectedProject?.name || "project");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${slug}-${filenameSuffix}-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setProjectsNotice({
      type: "success",
      message: `Exported ${rows.length} expense row(s) to CSV.`,
    });
  };

  const handleExportVisibleExpensesCsv = () => {
    exportExpenseRowsToCsv(visibleProjectExpenses, "expenses");
  };

  const handleExportSelectedExpensesCsv = () => {
    exportExpenseRowsToCsv(selectedExpenses, "selected-expenses");
  };

  const handleClearExpenseSelection = () => {
    setSelectedExpenseIds([]);
  };

  const handleApproveSelectedExpenses = async () => {
    if (!canManageProjectContent) return;
    if (!selectedExpenses.length) return;
    if (!user?.id) {
      setProjectsNotice({
        type: "warning",
        message: "Approval requires a signed-in member profile.",
      });
      return;
    }

    setSavingExpense(true);
    setProjectExpensesError("");
    let successCount = 0;
    let failureCount = 0;
    const approvedAt = new Date().toISOString();

    try {
      for (const expense of selectedExpenses) {
        try {
          await updateProjectExpense(expense.id, { approved_by: user.id }, tenantId);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          console.error("Error approving selected expense:", error);
        }
      }

      if (successCount > 0) {
        const selectedIdSet = new Set(selectedExpenses.map((expense) => String(expense?.id ?? "")));
        setProjectExpenses((prev) =>
          prev.map((expense) =>
            selectedIdSet.has(String(expense?.id ?? ""))
              ? {
                  ...expense,
                  approved_by: user.id,
                  approved_at: expense?.approved_at || approvedAt,
                }
              : expense
          )
        );
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message:
            successCount === 1
              ? "Expense approved."
              : `${successCount} expenses approved.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Approved ${successCount} expense(s). ${failureCount} expense(s) failed.`,
        });
      }
    } finally {
      setSavingExpense(false);
    }
  };

  const handleExpenseFormFieldChange = (field, value) => {
    setExpenseForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (expenseFormError) {
      setExpenseFormError("");
    }
  };

  const ensureVendorPartnerRecord = useCallback(
    async (vendorName, projectId) => {
      const normalizedVendor = String(vendorName || "").trim();
      if (!normalizedVendor || !tenantId) {
        return { created: false, warning: "" };
      }

      const vendorKey = normalizePartnerLookupKey(normalizedVendor);
      if (expensePartnerByName.has(vendorKey)) {
        return { created: false, warning: "" };
      }

      try {
        const tenantRecord = await getTenantById(tenantId);
        if (!tenantRecord) {
          return {
            created: false,
            warning: "Expense saved, but vendor was not added to Organization Partners.",
          };
        }

        const existingPartners = getTenantOrganizationPartners(tenantRecord?.site_data);
        const existingMatch = existingPartners.find(
          (partner) => normalizePartnerLookupKey(partner?.name) === vendorKey
        );
        if (existingMatch) {
          setOrganizationPartners(existingPartners);
          return { created: false, warning: "" };
        }

        const linkedProjectIds =
          Number.isInteger(projectId) && projectId > 0 ? [String(projectId)] : [];
        const nextPartner = {
          id: `partner-${Date.now()}`,
          name: normalizedVendor,
          kind: "Vendor",
          status: "Active",
          contact_person: "",
          contact_email: "",
          contact_phone: "",
          last_contact: "",
          notes: "",
          logo_url: "",
          linked_project_ids: linkedProjectIds,
        };
        const nextPartners = [...existingPartners, nextPartner];
        const nextSiteData = buildTenantSiteDataWithPartners(tenantRecord?.site_data, nextPartners);

        await updateTenant(tenantId, { site_data: nextSiteData });
        setOrganizationPartners(nextPartners);
        return { created: true, warning: "" };
      } catch (error) {
        console.error("Error creating vendor from expense form:", error);
        return {
          created: false,
          warning: "Expense saved, but vendor was not added to Organization Partners.",
        };
      }
    },
    [tenantId, expensePartnerByName]
  );

  const handleExpenseFormReceiptFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setExpenseForm((prev) => ({
      ...prev,
      receiptFile: file,
    }));
    setExpenseReceiptDragActive(false);
    if (expenseFormError) {
      setExpenseFormError("");
    }
  };

  const triggerExpenseFormReceiptPicker = () => {
    if (savingExpense) return;
    expenseFormReceiptInputRef.current?.click();
  };

  const handleExpenseReceiptDragOver = (event) => {
    event.preventDefault();
    if (savingExpense) return;
    setExpenseReceiptDragActive(true);
  };

  const handleExpenseReceiptDragLeave = (event) => {
    event.preventDefault();
    setExpenseReceiptDragActive(false);
  };

  const handleExpenseReceiptDrop = (event) => {
    event.preventDefault();
    setExpenseReceiptDragActive(false);
    if (savingExpense) return;
    const file = event.dataTransfer?.files?.[0] || null;
    if (!file) return;
    setExpenseForm((prev) => ({
      ...prev,
      receiptFile: file,
    }));
    if (expenseFormError) {
      setExpenseFormError("");
    }
  };

  const clearExpenseFormReceiptFile = () => {
    setExpenseForm((prev) => ({
      ...prev,
      receiptFile: null,
    }));
    if (expenseFormReceiptInputRef.current) {
      expenseFormReceiptInputRef.current.value = "";
    }
  };

  const triggerSelectedExpenseReceiptPicker = () => {
    if (!canManageProjectContent) return;
    if (selectedExpenses.length !== 1 || savingExpense || deletingExpenses || uploadingExpenseReceipt) return;
    const targetExpenseId = String(selectedExpenses[0]?.id ?? "").trim();
    if (!targetExpenseId) return;
    setReceiptUploadExpenseId(targetExpenseId);
    setProjectExpensesError("");
    expenseReceiptInputRef.current?.click();
  };

  const handleSelectedExpenseReceiptFileSelection = async (event) => {
    if (!canManageProjectContent) return;
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    const targetExpenseId = String(receiptUploadExpenseId || selectedExpenses[0]?.id || "").trim();
    if (!file || !targetExpenseId) {
      setReceiptUploadExpenseId("");
      return;
    }

    setUploadingExpenseReceipt(true);
    setProjectExpensesError("");

    try {
      const updatedExpense = await uploadProjectExpenseReceipt(targetExpenseId, file, tenantId);
      if (updatedExpense?.id) {
        const normalizedUpdatedId = String(updatedExpense.id);
        setProjectExpenses((prev) =>
          prev.map((expense) =>
            String(expense?.id ?? "") === normalizedUpdatedId ? { ...expense, ...updatedExpense } : expense
          )
        );
      }
      setProjectsNotice({
        type: "success",
        message: "Receipt uploaded successfully.",
      });
    } catch (error) {
      console.error("Error uploading selected expense receipt:", error);
      setProjectExpensesError(error?.message || "Failed to upload receipt.");
    } finally {
      setUploadingExpenseReceipt(false);
      setReceiptUploadExpenseId("");
    }
  };

  const handleExpenseFormSubmit = async (event) => {
    event.preventDefault();
    if (!canManageProjectContent) return;
    const projectId = normalizeProjectId(selectedProject?.id);
    const normalizedEditingExpenseId = String(editingExpenseId || "").trim();
    const isEditingExpense = Boolean(normalizedEditingExpenseId);
    if (!projectId) {
      setExpenseFormError("Select a valid project before adding an expense.");
      return;
    }

    const title = String(expenseForm.title || "").trim();
    const notes = String(expenseForm.notes || "").trim();
    const category = String(expenseForm.category || "").trim();
    const vendor = String(expenseForm.vendor || "").trim();
    const expenseDate = String(expenseForm.date || "").trim();
    const paymentReference = String(expenseForm.paymentReference || "").trim();
    const receiptFile = expenseForm.receiptFile instanceof File ? expenseForm.receiptFile : null;
    const amount = Number(String(expenseForm.amount || "").trim().replace(/,/g, ""));

    if (!title) {
      setExpenseFormError("Expense title is required.");
      return;
    }
    if (!category) {
      setExpenseFormError("Expense category is required.");
      return;
    }
    if (!expenseDate) {
      setExpenseFormError("Expense date is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseFormError("Expense amount must be greater than 0.");
      return;
    }

    setSavingExpense(true);
    setExpenseFormError("");
    setProjectExpensesError("");

    try {
      const description = [title, notes].filter(Boolean).join(" — ");
      let savedExpense = null;
      let receiptUploadErrorMessage = "";
      let vendorPartnerWarning = "";
      let vendorPartnerCreated = false;

      if (isEditingExpense) {
        const existingExpense =
          projectExpenses.find(
            (expense) => String(expense?.id ?? "") === normalizedEditingExpenseId
          ) || null;
        const hasExistingReceipt = hasExpenseReceiptFile(existingExpense);

        savedExpense = await updateProjectExpense(
          normalizedEditingExpenseId,
          {
            expense_date: expenseDate,
            category,
            amount,
            vendor,
            description,
            payment_reference: paymentReference || null,
            receipt: hasExistingReceipt || Boolean(paymentReference),
          },
          tenantId
        );
      } else {
        savedExpense = await createProjectExpense(
          projectId,
          {
            expense_date: expenseDate,
            category,
            amount,
            vendor,
            description,
            payment_reference: paymentReference || null,
            receipt: Boolean(paymentReference),
          },
          tenantId
        );
      }

      if (receiptFile) {
        const targetExpenseId = String(savedExpense?.id || normalizedEditingExpenseId).trim();
        if (!targetExpenseId) {
          receiptUploadErrorMessage = "Expense saved, but receipt upload target could not be resolved.";
        } else {
          try {
            savedExpense = await uploadProjectExpenseReceipt(targetExpenseId, receiptFile, tenantId);
          } catch (receiptError) {
            console.error("Expense saved but receipt upload failed:", receiptError);
            receiptUploadErrorMessage =
              receiptError?.message || "Expense saved, but failed to upload receipt.";
          }
        }
      }

      if (vendor) {
        const vendorPartnerResult = await ensureVendorPartnerRecord(vendor, projectId);
        vendorPartnerCreated = Boolean(vendorPartnerResult?.created);
        vendorPartnerWarning = String(vendorPartnerResult?.warning || "");
      }

      setShowExpenseModal(false);
      setEditingExpenseId(null);
      setExpenseForm(createInitialExpenseForm());
      setExpenseReceiptDragActive(false);
      if (expenseFormReceiptInputRef.current) {
        expenseFormReceiptInputRef.current.value = "";
      }
      setSelectedExpenseIds([]);
      setDetailTab("expenses");
      const successMessage = isEditingExpense ? "Expense updated successfully." : "Expense saved successfully.";
      const warningMessages = [receiptUploadErrorMessage, vendorPartnerWarning].filter(Boolean);
      const noticeMessage = warningMessages.length
        ? `${successMessage} ${warningMessages.join(" ")}`
        : vendorPartnerCreated
          ? `${successMessage} Vendor added to Organization Partners.`
          : successMessage;
      setProjectsNotice({
        type: warningMessages.length ? "warning" : "success",
        message: noticeMessage,
      });
      if (warningMessages.length) {
        setProjectExpensesError(warningMessages.join(" "));
      }

      setProjectExpensesLoading(true);
      try {
        const rows = await getProjectExpenses(projectId, tenantId);
        setProjectExpenses(Array.isArray(rows) ? rows : []);
        const categoryRows = await getProjectExpenseCategoryDefinitions(projectId, tenantId);
        setExpenseCategoryRows(sortExpenseCategoryRows(Array.isArray(categoryRows) ? categoryRows : []));
      } catch (reloadError) {
        console.error("Expense saved but refresh failed:", reloadError);
        setProjectExpensesError(reloadError?.message || "Expense saved, but failed to refresh the list.");
      } finally {
        setProjectExpensesLoading(false);
      }
    } catch (error) {
      console.error("Error saving project expense:", error);
      setExpenseFormError(
        error?.message || (isEditingExpense ? "Failed to update expense." : "Failed to save expense.")
      );
    } finally {
      setSavingExpense(false);
    }
  };

  const sortedProjectDocuments = useMemo(() => {
    return [...projectDocuments].sort((a, b) => {
      const aTime = Date.parse(String(a?.uploaded_at || a?.created_at || ""));
      const bTime = Date.parse(String(b?.uploaded_at || b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });
  }, [projectDocuments]);

  const documentRowIds = useMemo(
    () =>
      sortedProjectDocuments
        .map((document) => String(document?.id ?? ""))
        .filter(Boolean),
    [sortedProjectDocuments]
  );

  const selectedEmitDocumentOption = useMemo(
    () =>
      PROJECT_EMIT_DOCUMENT_OPTIONS.find((option) => option.value === emitDocumentType) ||
      PROJECT_EMIT_DOCUMENT_OPTIONS[0],
    [emitDocumentType]
  );

  useEffect(() => {
    const visibleDocumentSet = new Set(documentRowIds);
    setSelectedDocumentIds((prev) => prev.filter((documentId) => visibleDocumentSet.has(documentId)));
  }, [documentRowIds]);

  useEffect(() => {
    if (!projectDocumentTemplateMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (projectDocumentTemplateMenuRef.current?.contains(event.target)) return;
      setProjectDocumentTemplateMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProjectDocumentTemplateMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [projectDocumentTemplateMenuOpen]);

  useEffect(() => {
    setProjectDocumentTemplateMenuOpen(false);
  }, [selectedProject?.id, projectDocumentMode]);

  const allDocumentsSelected =
    documentRowIds.length > 0 &&
    documentRowIds.every((documentId) => selectedDocumentIds.includes(documentId));

  const handleToggleSelectAllDocuments = () => {
    if (allDocumentsSelected) {
      setSelectedDocumentIds([]);
      return;
    }
    setSelectedDocumentIds(documentRowIds);
  };

  const handleToggleDocumentSelection = (documentId) => {
    const normalizedId = String(documentId ?? "");
    if (!normalizedId) return;
    setSelectedDocumentIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const selectedDocuments = useMemo(() => {
    const selectedSet = new Set(selectedDocumentIds.map((documentId) => String(documentId)));
    return sortedProjectDocuments.filter((document) => selectedSet.has(String(document?.id ?? "")));
  }, [sortedProjectDocuments, selectedDocumentIds]);

  const mobileReportProjectDocuments = useMemo(
    () => sortedProjectDocuments.filter((document) => isGeneratedProjectReportDocument(document)),
    [sortedProjectDocuments]
  );

  const mobileFileProjectDocuments = useMemo(
    () => sortedProjectDocuments.filter((document) => !isGeneratedProjectReportDocument(document)),
    [sortedProjectDocuments]
  );

  const mobileVisibleProjectDocuments = useMemo(
    () => (mobileProjectDocumentMode === "reports" ? mobileReportProjectDocuments : mobileFileProjectDocuments),
    [mobileProjectDocumentMode, mobileReportProjectDocuments, mobileFileProjectDocuments]
  );

  const documentActionDocument = useMemo(() => {
    const normalizedId = String(documentActionDocumentId || "").trim();
    if (!normalizedId) return null;
    return (
      sortedProjectDocuments.find((document) => String(document?.id ?? "") === normalizedId) || null
    );
  }, [sortedProjectDocuments, documentActionDocumentId]);

  useEffect(() => {
    if (!isMobileProjectViewport || detailTab !== "documents") return;
    const visibleSet = new Set(
      mobileVisibleProjectDocuments
        .map((document) => String(document?.id ?? ""))
        .filter(Boolean)
    );
    setSelectedDocumentIds((prev) => prev.filter((documentId) => visibleSet.has(String(documentId))));
  }, [isMobileProjectViewport, detailTab, mobileVisibleProjectDocuments]);

  useEffect(() => {
    return () => {
      if (documentLongPressTimerRef.current) {
        window.clearTimeout(documentLongPressTimerRef.current);
        documentLongPressTimerRef.current = null;
      }
      documentSwipeTouchRef.current = null;
    };
  }, []);

  const getProjectDocumentUrl = (documentRow) =>
    String(documentRow?.download_url || documentRow?.file_url || "").trim();

  const openProjectDocumentInBrowser = (documentRow) => {
    const downloadUrl = getProjectDocumentUrl(documentRow);
    if (!downloadUrl) {
      setProjectsNotice({
        type: "warning",
        message: "Document preview is unavailable.",
      });
      return;
    }
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadProjectDocument = (documentRow) => {
    const downloadUrl = getProjectDocumentUrl(documentRow);
    if (!downloadUrl) {
      setProjectsNotice({
        type: "warning",
        message: "Document download is unavailable.",
      });
      return;
    }
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareProjectDocument = async (documentRow) => {
    const downloadUrl = getProjectDocumentUrl(documentRow);
    if (!downloadUrl) {
      setProjectsNotice({
        type: "warning",
        message: "Document link is unavailable to share.",
      });
      return;
    }
    const fileName = String(documentRow?.name || "Document").trim() || "Document";

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: fileName,
          text: fileName,
          url: downloadUrl,
        });
        return;
      }
    } catch (error) {
      const isAbortError = String(error?.name || "").toLowerCase() === "aborterror";
      if (!isAbortError) {
        console.error("Error sharing project document:", error);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setProjectsNotice({
        type: "success",
        message: "Document link copied.",
      });
    } catch (error) {
      console.error("Error copying document link:", error);
      setProjectsNotice({
        type: "warning",
        message: "Unable to share this document right now.",
      });
    }
  };

  const openDocumentActionSheet = (documentRow) => {
    if (!isMobileProjectViewport) return;
    const documentId = String(documentRow?.id ?? "").trim();
    if (!documentId) return;
    setDocumentActionDocumentId(documentId);
  };

  const closeDocumentActionSheet = () => {
    setDocumentActionDocumentId("");
  };

  const openDocumentCreateActionSheet = () => {
    if (!isMobileProjectViewport || !canManageProjectContent) return;
    setShowDocumentTemplateActionSheet(false);
    setShowDocumentCreateActionSheet(true);
  };

  const closeDocumentCreateActionSheet = () => {
    setShowDocumentCreateActionSheet(false);
  };

  const openDocumentTemplateActionSheet = () => {
    if (!isMobileProjectViewport || !canManageProjectContent) return;
    setShowDocumentCreateActionSheet(false);
    setShowDocumentTemplateActionSheet(true);
  };

  const closeDocumentTemplateActionSheet = () => {
    setShowDocumentTemplateActionSheet(false);
  };

  const handleDeleteDocumentFromActionSheet = () => {
    if (!canManageProjectContent || !documentActionDocument) return;
    const documentId = String(documentActionDocument?.id ?? "").trim();
    if (!documentId) return;
    closeDocumentActionSheet();
    setSelectedDocumentIds([documentId]);
    setShowDeleteDocumentsModal(true);
  };

  const handleRenameDocumentFromActionSheet = () => {
    if (!canManageProjectContent || !documentActionDocument) return;
    const documentId = String(documentActionDocument?.id ?? "").trim();
    if (!documentId) return;
    closeDocumentActionSheet();
    setSelectedDocumentIds([documentId]);
    setDocumentRenameValue(String(documentActionDocument?.name || "").trim());
    setDocumentRenameError("");
    setShowRenameDocumentModal(true);
  };

  const clearDocumentLongPressTimer = () => {
    if (documentLongPressTimerRef.current) {
      window.clearTimeout(documentLongPressTimerRef.current);
      documentLongPressTimerRef.current = null;
    }
  };

  const handleDocumentCardTouchStart = (documentId, event) => {
    if (!isMobileProjectViewport) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const normalizedId = String(documentId ?? "").trim();
    if (!normalizedId) return;
    documentSwipeTouchRef.current = {
      documentId: normalizedId,
      x: touch.clientX,
      y: touch.clientY,
    };

    if (!canManageProjectContent) return;
    clearDocumentLongPressTimer();
    documentLongPressTimerRef.current = window.setTimeout(() => {
      setSelectedDocumentIds((prev) => (prev.includes(normalizedId) ? prev : [...prev, normalizedId]));
      suppressDocumentOpenRef.current = true;
    }, 420);
  };

  const handleDocumentCardTouchMove = (event) => {
    const start = documentSwipeTouchRef.current;
    if (!start) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) > 12 || Math.abs(deltaY) > 12) {
      clearDocumentLongPressTimer();
    }
  };

  const handleDocumentCardTouchEnd = (documentRow, event) => {
    clearDocumentLongPressTimer();
    const start = documentSwipeTouchRef.current;
    documentSwipeTouchRef.current = null;
    if (!start) return;
    if (String(start.documentId || "") !== String(documentRow?.id ?? "")) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > 48) return;
    if (deltaX >= 72) {
      suppressDocumentOpenRef.current = true;
      handleDownloadProjectDocument(documentRow);
      return;
    }
    if (deltaX <= -72) {
      suppressDocumentOpenRef.current = true;
      openDocumentActionSheet(documentRow);
    }
  };

  const handleDocumentCardTouchCancel = () => {
    clearDocumentLongPressTimer();
    documentSwipeTouchRef.current = null;
  };

  const handleDocumentCardActivate = (documentRow) => {
    const normalizedId = String(documentRow?.id ?? "").trim();
    if (!normalizedId) return;
    if (suppressDocumentOpenRef.current) {
      suppressDocumentOpenRef.current = false;
      return;
    }
    if (isMobileProjectViewport && canManageProjectContent && selectedDocumentIds.length > 0) {
      handleToggleDocumentSelection(normalizedId);
      return;
    }
    openDocumentActionSheet(documentRow);
  };

  const handleExportSelectedDocuments = () => {
    const exportRows = selectedDocuments.filter((documentRow) => getProjectDocumentUrl(documentRow));
    if (!exportRows.length) {
      setProjectsNotice({
        type: "warning",
        message: "No downloadable documents selected.",
      });
      return;
    }
    exportRows.forEach((documentRow, index) => {
      const url = getProjectDocumentUrl(documentRow);
      window.setTimeout(() => {
        window.open(url, "_blank", "noopener,noreferrer");
      }, index * 120);
    });
    setProjectsNotice({
      type: "success",
      message:
        exportRows.length === 1
          ? "Opened selected document."
          : `Opened ${exportRows.length} selected documents.`,
    });
  };

  const triggerProjectDocumentPicker = () => {
    if (
      !canManageProjectContent ||
      uploadingProjectDocument ||
      deletingDocuments ||
      emittingProjectDocument ||
      renamingDocument
    ) {
      return;
    }
    projectDocumentInputRef.current?.click();
  };

  const handleProjectDocumentFileSelection = async (event) => {
    if (!canManageProjectContent) return;
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const projectId = normalizeProjectId(selectedProject?.id);
    if (!files.length) return;
    if (!projectId) {
      setProjectDocumentsError("Select a valid project before uploading documents.");
      return;
    }

    setUploadingProjectDocument(true);
    setProjectDocumentsError("");

    let successCount = 0;
    let failureCount = 0;
    const uploadedDocuments = [];
    const uploadErrors = [];

    try {
      for (const file of files) {
        try {
          const uploadedDocument = await uploadProjectDocument(
            projectId,
            file,
            {
              uploadedByMemberId: user?.id,
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
          console.error("Error uploading project document:", error);
          uploadErrors.push(error?.message || "Upload failed.");
        }
      }

      let refreshedDocuments = [];
      setProjectDocumentsLoading(true);
      try {
        const rows = await getProjectDocuments(projectId, tenantId);
        refreshedDocuments = Array.isArray(rows) ? rows : [];
        setProjectDocuments(refreshedDocuments);
      } catch (reloadError) {
        console.error("Document upload succeeded but list refresh failed:", reloadError);
        setProjectDocumentsError(
          reloadError?.message || "Upload complete, but failed to refresh document list."
        );
      } finally {
        setProjectDocumentsLoading(false);
      }

      const uploadedIds = uploadedDocuments
        .map((document) => String(document?.id || "").trim())
        .filter(Boolean);
      if (uploadedIds.length > 0) {
        setSelectedDocumentIds(uploadedIds);
      }
      if (uploadedIds.length === 1) {
        const uploadedId = uploadedIds[0];
        const uploadedDocument =
          refreshedDocuments.find((document) => String(document?.id ?? "") === uploadedId) ||
          uploadedDocuments[0] ||
          null;
        setDocumentRenameValue(String(uploadedDocument?.name || "").trim());
        setDocumentRenameError("");
        setShowRenameDocumentModal(true);
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message:
            successCount === 1
              ? "Document uploaded successfully."
              : `${successCount} documents uploaded successfully.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Uploaded ${successCount} document(s). ${failureCount} document(s) failed.`,
        });
        if (uploadErrors.length) {
          setProjectDocumentsError(uploadErrors.join(" "));
        }
      }
    } finally {
      setUploadingProjectDocument(false);
    }
  };

  const openRenameSelectedDocumentModal = () => {
    if (!canManageProjectContent || selectedDocumentIds.length !== 1) return;
    const selectedDocument =
      sortedProjectDocuments.find(
        (document) => String(document?.id ?? "") === String(selectedDocumentIds[0] ?? "")
      ) || null;
    setDocumentRenameValue(String(selectedDocument?.name || "").trim());
    setDocumentRenameError("");
    setShowRenameDocumentModal(true);
  };

  const closeRenameSelectedDocumentModal = () => {
    if (renamingDocument) return;
    setShowRenameDocumentModal(false);
    setDocumentRenameValue("");
    setDocumentRenameError("");
  };

  const handleConfirmRenameSelectedDocument = async (event) => {
    event.preventDefault();

    if (!canManageProjectContent || selectedDocumentIds.length !== 1) {
      setDocumentRenameError("Select one document to rename.");
      return;
    }

    const documentId = String(selectedDocumentIds[0] ?? "").trim();
    const nextName = String(documentRenameValue || "").trim();
    if (!documentId) {
      setDocumentRenameError("Document id is missing.");
      return;
    }
    if (!nextName) {
      setDocumentRenameError("Document name is required.");
      return;
    }

    setRenamingDocument(true);
    setDocumentRenameError("");
    setProjectDocumentsError("");

    try {
      const updatedDocument = await renameProjectDocument(documentId, nextName, tenantId);
      const normalizedDocumentId = String(updatedDocument?.id || documentId);
      setProjectDocuments((prev) =>
        prev.map((document) =>
          String(document?.id ?? "") === normalizedDocumentId
            ? { ...document, ...updatedDocument }
            : document
        )
      );
      setSelectedDocumentIds([normalizedDocumentId]);
      setProjectsNotice({
        type: "success",
        message: "Document renamed successfully.",
      });
      setShowRenameDocumentModal(false);
      setDocumentRenameValue("");
      setDocumentRenameError("");
    } catch (error) {
      console.error("Error renaming project document:", error);
      setDocumentRenameError(error?.message || "Failed to rename document.");
    } finally {
      setRenamingDocument(false);
    }
  };

  const requestDeleteSelectedDocuments = () => {
    if (!canManageProjectContent) return;
    if (!selectedDocuments.length) return;
    setShowDeleteDocumentsModal(true);
  };

  const buildProjectDocumentContext = () => {
    if (!selectedProject) return null;
    const now = new Date();
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const projectName = String(selectedProject?.name || "Project").trim();
    const moduleKey = String(
      selectedProject?.module_key || selectedProject?.code || selectedProject?.category || "general"
    )
      .trim()
      .toUpperCase();
    const category = getProjectCategory(selectedProject);
    const status = String(selectedProject?.status || "active")
      .trim()
      .toLowerCase();
    const summary = String(
      selectedProject?.short_description || selectedProject?.description || "No summary provided."
    )
      .trim()
      .replace(/\s+/g, " ");
    const memberCount = Number(selectedProject?.member_count || 0);
    const budgetAmount = Number(getProjectBudgetAmount(selectedProject));
    const revenueAmount = Number(getProjectRevenueAmount(selectedProject));
    const safeBudgetAmount = Number.isFinite(budgetAmount) && budgetAmount >= 0 ? budgetAmount : null;
    const safeRevenueAmount = Number.isFinite(revenueAmount) && revenueAmount >= 0 ? revenueAmount : null;
    const spentAmount = Number.isFinite(totalProjectExpensesAmount) ? totalProjectExpensesAmount : 0;
    const remainingAmount =
      safeBudgetAmount !== null ? Math.max(safeBudgetAmount - spentAmount, 0) : null;
    const budgetUtilizationPercent =
      safeBudgetAmount && safeBudgetAmount > 0 ? (spentAmount / safeBudgetAmount) * 100 : null;
    const progressPercent = getProjectProgress(selectedProject, {
      tasks: projectTasks,
      budgetAmount: safeBudgetAmount,
      spentAmount,
    });

    const expensesSorted = [...projectExpenses].sort((a, b) => {
      const aTime = Date.parse(String(a?.expense_date || a?.created_at || ""));
      const bTime = Date.parse(String(b?.expense_date || b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });

    const tasksSorted = [...projectTasks].sort((a, b) => {
      const aDue = Date.parse(String(a?.due_date || ""));
      const bDue = Date.parse(String(b?.due_date || ""));
      const safeADue = Number.isFinite(aDue) ? aDue : Number.MAX_SAFE_INTEGER;
      const safeBDue = Number.isFinite(bDue) ? bDue : Number.MAX_SAFE_INTEGER;
      if (safeADue !== safeBDue) return safeADue - safeBDue;
      const aCreated = Date.parse(String(a?.created_at || ""));
      const bCreated = Date.parse(String(b?.created_at || ""));
      const safeACreated = Number.isFinite(aCreated) ? aCreated : 0;
      const safeBCreated = Number.isFinite(bCreated) ? bCreated : 0;
      return safeBCreated - safeACreated;
    });

    const notesSorted = [...projectNotes].sort((a, b) => {
      const aTime = Date.parse(String(a?.updated_at || a?.created_at || ""));
      const bTime = Date.parse(String(b?.updated_at || b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });

    const documentsSorted = [...projectDocuments].sort((a, b) => {
      const aTime = Date.parse(String(a?.uploaded_at || a?.created_at || ""));
      const bTime = Date.parse(String(b?.uploaded_at || b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });

    const taskTotals = {
      open: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    tasksSorted.forEach((task) => {
      const key = String(task?.status || "open")
        .trim()
        .toLowerCase();
      if (key in taskTotals) {
        taskTotals[key] += 1;
      }
    });
    const taskCount = tasksSorted.length;
    const taskCompletionPercent = taskCount > 0 ? (taskTotals.done / taskCount) * 100 : null;

    const overdueTaskCount = tasksSorted.filter((task) => {
      const statusKey = String(task?.status || "open")
        .trim()
        .toLowerCase();
      if (statusKey === "done" || statusKey === "cancelled") return false;
      const dueDateValue = Date.parse(String(task?.due_date || ""));
      if (!Number.isFinite(dueDateValue)) return false;
      return dueDateValue < Date.parse(todayIso);
    }).length;

    const highPriorityOpenTaskCount = tasksSorted.filter((task) => {
      const statusKey = String(task?.status || "open")
        .trim()
        .toLowerCase();
      if (statusKey === "done" || statusKey === "cancelled") return false;
      const priorityKey = String(task?.priority || "normal")
        .trim()
        .toLowerCase();
      return priorityKey === "high" || priorityKey === "urgent";
    }).length;

    const expensesWithProofCount = expensesSorted.filter((expense) => hasExpenseProof(expense)).length;
    const expenseProofPercent =
      expensesSorted.length > 0 ? (expensesWithProofCount / expensesSorted.length) * 100 : null;

    return {
      now,
      generatedAt: now.toLocaleString("en-KE"),
      projectName,
      moduleKey,
      category,
      status,
      startDateLabel: formatDate(selectedProject?.start_date),
      summary,
      memberCount: Number.isFinite(memberCount) ? memberCount : 0,
      progressPercent,
      budgetAmount: safeBudgetAmount,
      revenueAmount: safeRevenueAmount,
      spentAmount,
      remainingAmount,
      budgetUtilizationPercent,
      taskTotals,
      taskCount,
      taskCompletionPercent,
      overdueTaskCount,
      highPriorityOpenTaskCount,
      expenses: expensesSorted,
      recentExpenses: expensesSorted.slice(0, 6),
      expenseProofPercent,
      tasks: tasksSorted,
      recentTasks: tasksSorted.slice(0, 8),
      notes: notesSorted,
      recentNotes: notesSorted.slice(0, 6),
      documents: documentsSorted,
      recentDocuments: documentsSorted.slice(0, 6),
    };
  };

  const buildProjectProfileDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PROJECT OVERVIEW");
    appendWrappedPdfLine(lines, `Name: ${context.projectName}`);
    appendWrappedPdfLine(lines, `Module: ${context.moduleKey}`);
    appendWrappedPdfLine(lines, `Category: ${context.category}`);
    appendWrappedPdfLine(lines, `Status: ${context.status}`);
    appendWrappedPdfLine(lines, `Start date: ${context.startDateLabel}`);
    appendWrappedPdfLine(lines, `Progress: ${formatPercentLabel(context.progressPercent)}`);
    appendWrappedPdfLine(lines, `Members: ${context.memberCount}`);
    appendWrappedPdfLine(lines, `Summary: ${context.summary}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "FINANCIAL SNAPSHOT");
    appendWrappedPdfLine(lines, `Total budget: ${formatCurrency(context.budgetAmount)}`);
    appendWrappedPdfLine(lines, `Expected funding: ${formatCurrency(context.revenueAmount)}`);
    appendWrappedPdfLine(lines, `Total spent: ${formatCurrency(context.spentAmount)}`);
    appendWrappedPdfLine(lines, `Budget remaining: ${formatCurrency(context.remainingAmount)}`);
    appendWrappedPdfLine(lines, `Budget utilization: ${formatPercentLabel(context.budgetUtilizationPercent)}`);
    appendWrappedPdfLine(lines, `Expense records: ${context.expenses.length}`);
    appendWrappedPdfLine(lines, `Expense proof coverage: ${formatPercentLabel(context.expenseProofPercent)}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "RECENT EXPENSES");
    if (!context.recentExpenses.length) {
      appendWrappedPdfLine(lines, "No expenses recorded yet.");
    } else {
      context.recentExpenses.slice(0, 4).forEach((expense, index) => {
        appendWrappedPdfLine(
          lines,
          `${index + 1}. ${formatDate(expense?.expense_date)} | ${expense?.category || "Uncategorized"} | ${formatCurrency(
            expense?.amount
          )} | ${expense?.vendor || "Vendor N/A"}`
        );
      });
    }
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "OPERATIONS SNAPSHOT");
    appendWrappedPdfLine(
      lines,
      `Tasks: Open ${context.taskTotals.open}, In progress ${context.taskTotals.in_progress}, Done ${context.taskTotals.done}, Cancelled ${context.taskTotals.cancelled}`
    );
    appendWrappedPdfLine(lines, `Task completion: ${formatPercentLabel(context.taskCompletionPercent)}`);
    appendWrappedPdfLine(lines, `Notes captured: ${context.notes.length}`);
    appendWrappedPdfLine(lines, `Documents stored: ${context.documents.length}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "DONOR CONTEXT");
    appendWrappedPdfLine(
      lines,
      "This profile summarizes project scope, financial position, and delivery activity for partner and donor review."
    );
    return lines;
  };

  const buildProjectProposalDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PROJECT PROPOSAL");
    appendWrappedPdfLine(lines, `Project: ${context.projectName} (${context.moduleKey})`);
    appendWrappedPdfLine(lines, `Category: ${context.category}`);
    appendWrappedPdfLine(lines, `Current status: ${context.status}`);
    appendWrappedPdfLine(lines, `Start date: ${context.startDateLabel}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "1. RATIONALE");
    appendWrappedPdfLine(
      lines,
      `This proposal builds on current project operations serving ${context.memberCount} members. ${context.summary}`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "2. OBJECTIVES");
    appendWrappedPdfLine(
      lines,
      `Increase project performance from the current ${formatPercentLabel(context.progressPercent)} completion position and improve delivery reliability.`
    );
    appendWrappedPdfLine(
      lines,
      `Strengthen financial outcomes by controlling expenses and moving toward expected funding of ${formatCurrency(
        context.revenueAmount
      )}.`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "3. IMPLEMENTATION APPROACH");
    appendWrappedPdfLine(
      lines,
      `Operational workload currently tracks ${context.taskCount} tasks with ${formatPercentLabel(
        context.taskCompletionPercent
      )} completed. Priority management focuses on ${context.highPriorityOpenTaskCount} high/urgent active tasks.`
    );
    appendWrappedPdfLine(
      lines,
      `Financial control is based on ${context.expenses.length} expense records and proof coverage at ${formatPercentLabel(
        context.expenseProofPercent
      )}.`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "4. BUDGET SUMMARY");
    appendWrappedPdfLine(lines, `Total budget: ${formatCurrency(context.budgetAmount)}`);
    appendWrappedPdfLine(lines, `Spent to date: ${formatCurrency(context.spentAmount)}`);
    appendWrappedPdfLine(lines, `Remaining budget: ${formatCurrency(context.remainingAmount)}`);
    appendWrappedPdfLine(lines, `Expected funding: ${formatCurrency(context.revenueAmount)}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "5. FUNDING REQUEST NARRATIVE");
    appendWrappedPdfLine(
      lines,
      `Support is requested to stabilize delivery, close ${context.overdueTaskCount} overdue tasks, and sustain documented activities reflected in ${context.notes.length} internal notes and ${context.documents.length} stored documents.`
    );
    return lines;
  };

  const buildConceptNoteDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "CONCEPT NOTE");
    appendWrappedPdfLine(lines, `Project: ${context.projectName}`);
    appendWrappedPdfLine(lines, `Beneficiaries (current members): ${context.memberCount}`);
    appendWrappedPdfLine(lines, `Problem statement: ${context.summary}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PROPOSED INTERVENTION");
    appendWrappedPdfLine(
      lines,
      `The project will prioritize completion of pending work (${context.taskTotals.open + context.taskTotals.in_progress} active tasks), improve expense accountability, and drive progress beyond ${formatPercentLabel(
        context.progressPercent
      )}.`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "EXPECTED RESULTS");
    appendWrappedPdfLine(
      lines,
      `Task completion target: improve from ${formatPercentLabel(
        context.taskCompletionPercent
      )} through focused execution and overdue clearance.`
    );
    appendWrappedPdfLine(
      lines,
      `Financial target: protect remaining budget (${formatCurrency(
        context.remainingAmount
      )}) while working toward expected funding (${formatCurrency(context.revenueAmount)}).`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "RESOURCE OVERVIEW");
    appendWrappedPdfLine(lines, `Total budget: ${formatCurrency(context.budgetAmount)}`);
    appendWrappedPdfLine(lines, `Total spent: ${formatCurrency(context.spentAmount)}`);
    appendWrappedPdfLine(lines, `Expense documentation rate: ${formatPercentLabel(context.expenseProofPercent)}`);
    return lines;
  };

  const buildWorkPlanDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "WORK PLAN");
    appendWrappedPdfLine(lines, `Project: ${context.projectName}`);
    appendWrappedPdfLine(lines, `Status: ${context.status} | Progress: ${formatPercentLabel(context.progressPercent)}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "EXECUTION SUMMARY");
    appendWrappedPdfLine(
      lines,
      `Task load: ${context.taskCount} total (${context.taskTotals.done} done, ${context.taskTotals.in_progress} in progress, ${context.taskTotals.open} open, ${context.taskTotals.cancelled} cancelled).`
    );
    appendWrappedPdfLine(lines, `Overdue active tasks: ${context.overdueTaskCount}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PLANNED ACTIVITIES");
    if (!context.recentTasks.length) {
      appendWrappedPdfLine(lines, "No task records yet. Define activities in the Tasks tab.");
    } else {
      context.recentTasks.slice(0, 10).forEach((task, index) => {
        const statusLabel = TASK_STATUS_LABELS[String(task?.status || "open").trim().toLowerCase()] || String(task?.status || "Open");
        const priorityLabel = TASK_PRIORITY_LABELS[String(task?.priority || "normal").trim().toLowerCase()] || String(task?.priority || "Normal");
        const assigneeLabel = String(task?.assignee_name || "").trim() || "Unassigned";
        appendWrappedPdfLine(
          lines,
          `${index + 1}. ${task?.title || "Untitled task"} | Due ${formatDate(task?.due_date)} | ${statusLabel} | ${priorityLabel} | ${assigneeLabel}`
        );
      });
    }
    return lines;
  };

  const buildMonitoringAndEvaluationPlanLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "MONITORING & EVALUATION PLAN");
    appendWrappedPdfLine(lines, `Project: ${context.projectName}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "KEY INDICATORS");
    appendWrappedPdfLine(
      lines,
      `1) Progress index - Current: ${formatPercentLabel(context.progressPercent)} | Data source: project overview.`
    );
    appendWrappedPdfLine(
      lines,
      `2) Task completion rate - Current: ${formatPercentLabel(context.taskCompletionPercent)} | Source: tasks table (${context.taskCount} records).`
    );
    appendWrappedPdfLine(
      lines,
      `3) Budget utilization - Current: ${formatPercentLabel(context.budgetUtilizationPercent)} | Source: expenses vs budget.`
    );
    appendWrappedPdfLine(
      lines,
      `4) Expense proof coverage - Current: ${formatPercentLabel(context.expenseProofPercent)} | Source: expense receipt/payment references.`
    );
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "MONITORING CADENCE");
    appendWrappedPdfLine(lines, "Weekly: track task status changes and overdue items.");
    appendWrappedPdfLine(lines, "Monthly: reconcile expenses, proof coverage, and remaining budget.");
    appendWrappedPdfLine(lines, "Quarterly: review progress against donor and internal targets.");
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "EVIDENCE LOG");
    appendWrappedPdfLine(lines, `Documents stored: ${context.documents.length}`);
    appendWrappedPdfLine(lines, `Operational notes available: ${context.notes.length}`);
    appendWrappedPdfLine(lines, `Recent expenses captured: ${context.recentExpenses.length}`);
    return lines;
  };

  const buildActivityReportDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "ACTIVITY REPORT");
    appendWrappedPdfLine(lines, `Project: ${context.projectName}`);
    appendWrappedPdfLine(lines, `Reporting snapshot date: ${context.startDateLabel} to ${formatDate(context.now.toISOString())}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "ACTIVITY SUMMARY");
    appendWrappedPdfLine(lines, `Tasks completed: ${context.taskTotals.done}`);
    appendWrappedPdfLine(lines, `Tasks in progress: ${context.taskTotals.in_progress}`);
    appendWrappedPdfLine(lines, `Open tasks: ${context.taskTotals.open}`);
    appendWrappedPdfLine(lines, `Overdue tasks: ${context.overdueTaskCount}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "FINANCIAL ACTIVITY");
    appendWrappedPdfLine(lines, `Expense entries recorded: ${context.expenses.length}`);
    appendWrappedPdfLine(lines, `Total spent to date: ${formatCurrency(context.spentAmount)}`);
    appendWrappedPdfLine(lines, `Proof coverage: ${formatPercentLabel(context.expenseProofPercent)}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "RECENT OPERATIONAL NOTES");
    if (!context.recentNotes.length) {
      appendWrappedPdfLine(lines, "No notes captured during this period.");
    } else {
      context.recentNotes.slice(0, 4).forEach((note, index) => {
        appendWrappedPdfLine(
          lines,
          `${index + 1}. ${note?.title || "Untitled note"} | ${formatDate(note?.updated_at || note?.created_at)}`
        );
      });
    }
    return lines;
  };

  const buildProjectCompletionReportDocumentLines = (context) => {
    if (!context) return [];
    const lines = [];
    appendWrappedPdfLine(lines, `Generated: ${context.generatedAt}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "PROJECT COMPLETION REPORT");
    appendWrappedPdfLine(lines, `Project: ${context.projectName}`);
    appendWrappedPdfLine(lines, `Lifecycle status: ${context.status}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "CLOSURE STATUS");
    appendWrappedPdfLine(lines, `Overall progress: ${formatPercentLabel(context.progressPercent)}`);
    appendWrappedPdfLine(lines, `Task completion rate: ${formatPercentLabel(context.taskCompletionPercent)}`);
    appendWrappedPdfLine(lines, `Completed tasks: ${context.taskTotals.done} / ${context.taskCount}`);
    appendWrappedPdfLine(lines, `Outstanding active tasks: ${context.taskTotals.open + context.taskTotals.in_progress}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "FINANCIAL CLOSURE");
    appendWrappedPdfLine(lines, `Total budget: ${formatCurrency(context.budgetAmount)}`);
    appendWrappedPdfLine(lines, `Total spent: ${formatCurrency(context.spentAmount)}`);
    appendWrappedPdfLine(lines, `Budget remaining: ${formatCurrency(context.remainingAmount)}`);
    appendWrappedPdfLine(lines, `Budget utilization: ${formatPercentLabel(context.budgetUtilizationPercent)}`);
    appendWrappedPdfLine(lines, "");
    appendWrappedPdfLine(lines, "DOCUMENTATION & LESSONS");
    appendWrappedPdfLine(lines, `Documents archived: ${context.documents.length}`);
    appendWrappedPdfLine(lines, `Operational notes captured: ${context.notes.length}`);
    if (context.recentNotes.length) {
      appendWrappedPdfLine(lines, `Most recent lesson: ${context.recentNotes[0]?.title || "No title"}`);
    } else {
      appendWrappedPdfLine(lines, "No notes were captured for lessons learned.");
    }
    return lines;
  };

  const buildEmitDocumentLines = (templateKey, context) => {
    switch (templateKey) {
      case "project_proposal":
        return buildProjectProposalDocumentLines(context);
      case "project_profile":
        return buildProjectProfileDocumentLines(context);
      case "concept_note":
        return buildConceptNoteDocumentLines(context);
      case "work_plan":
        return buildWorkPlanDocumentLines(context);
      case "monitoring_and_evaluation_plan":
        return buildMonitoringAndEvaluationPlanLines(context);
      case "activity_report":
        return buildActivityReportDocumentLines(context);
      case "project_completion_report":
        return buildProjectCompletionReportDocumentLines(context);
      default:
        return buildProjectProfileDocumentLines(context);
    }
  };

  const buildEmitDocumentFile = async (selectedOption) => {
    const safeOption = selectedOption || PROJECT_EMIT_DOCUMENT_OPTIONS[0];
    const safeProjectName = String(selectedProject?.name || "Project").trim();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${toFilenameSlug(safeProjectName)}-${safeOption.value}-${dateStamp}.pdf`;
    const context = buildProjectDocumentContext();
    const lines = buildEmitDocumentLines(safeOption.value, context);
    return buildProjectTemplateOfficialReportFile({
      templateKey: safeOption.value,
      templateLabel: safeOption.label,
      tenantBrand,
      user,
      context,
      currencyCode,
      lines,
      fileName,
    });
  };

  const handlePrepareEmitDocument = async (optionOverride = null) => {
    if (
      !canManageProjectContent ||
      uploadingProjectDocument ||
      deletingDocuments ||
      emittingProjectDocument ||
      renamingDocument
    ) {
      return;
    }
    const projectId = normalizeProjectId(selectedProject?.id);
    if (!projectId) {
      setProjectDocumentsError("Select a valid project before emitting documents.");
      return;
    }

    const selectedOption =
      optionOverride ||
      PROJECT_EMIT_DOCUMENT_OPTIONS.find((option) => option.value === emitDocumentType) ||
      PROJECT_EMIT_DOCUMENT_OPTIONS[0];
    setEmitDocumentType(selectedOption.value);
    setEmittingProjectDocument(true);
    setProjectDocumentsError("");

    try {
      const emittedFile = await buildEmitDocumentFile(selectedOption);
      await uploadProjectDocument(
        projectId,
        emittedFile,
        {
          name: `${selectedOption.label} - ${selectedProject?.name || "Project"}.pdf`,
          uploadedByMemberId: user?.id,
        },
        tenantId
      );

      setProjectDocumentsLoading(true);
      try {
        const rows = await getProjectDocuments(projectId, tenantId);
        setProjectDocuments(Array.isArray(rows) ? rows : []);
      } catch (reloadError) {
        console.error("Document emitted but list refresh failed:", reloadError);
        setProjectDocumentsError(
          reloadError?.message || "Document emitted, but failed to refresh document list."
        );
      } finally {
        setProjectDocumentsLoading(false);
      }

      setProjectsNotice({
        type: "success",
        message: `${selectedOption.label} emitted successfully.`,
      });
    } catch (error) {
      console.error("Error emitting project document:", error);
      const message = error?.message || `Failed to emit ${selectedOption.label}.`;
      setProjectDocumentsError(message);
      showFriendlyProjectError(error, {
        actionLabel: `emit ${selectedOption.label.toLowerCase()}`,
        fallbackTitle: "Couldn't generate the document",
        fallbackMessage: `We couldn't generate ${selectedOption.label} right now. Please try again.`,
        context: {
          area: "projects",
          action: "emit_project_document",
          tenantId,
          projectId,
          template: selectedOption.value,
        },
      });
      setProjectsNotice({
        type: "error",
        message,
      });
    } finally {
      setEmittingProjectDocument(false);
    }
  };

  const closeDeleteDocumentsModal = () => {
    if (deletingDocuments) return;
    setShowDeleteDocumentsModal(false);
  };

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

  const handleConfirmDeleteSelectedDocuments = async () => {
    if (!canManageProjectContent) return;
    if (!selectedDocuments.length) return;
    setDeletingDocuments(true);
    try {
      let successCount = 0;
      let failureCount = 0;
      const deletedIds = [];

      for (const document of selectedDocuments) {
        try {
          await deleteProjectDocument(document.id, tenantId);
          successCount += 1;
          deletedIds.push(String(document.id));
        } catch (error) {
          failureCount += 1;
          console.error("Error deleting selected project document:", error);
        }
      }

      if (deletedIds.length) {
        setProjectDocuments((prev) =>
          prev.filter((document) => !deletedIds.includes(String(document?.id ?? "")))
        );
        setSelectedDocumentIds((prev) =>
          prev.filter((documentId) => !deletedIds.includes(String(documentId)))
        );
        if (documentActionDocumentId && deletedIds.includes(String(documentActionDocumentId))) {
          setDocumentActionDocumentId("");
        }
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message:
            successCount === 1
              ? "Document deleted successfully."
              : `${successCount} documents deleted successfully.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Deleted ${successCount} document(s). ${failureCount} document(s) failed.`,
        });
      }

      setShowDeleteDocumentsModal(false);
    } finally {
      setDeletingDocuments(false);
    }
  };

  const sortedProjectTasks = useMemo(() => {
    return [...projectTasks].sort((a, b) => {
      const aDue = Date.parse(String(a?.due_date || ""));
      const bDue = Date.parse(String(b?.due_date || ""));
      const safeADue = Number.isFinite(aDue) ? aDue : Number.MAX_SAFE_INTEGER;
      const safeBDue = Number.isFinite(bDue) ? bDue : Number.MAX_SAFE_INTEGER;
      if (safeADue !== safeBDue) return safeADue - safeBDue;
      const aCreated = Date.parse(String(a?.created_at || ""));
      const bCreated = Date.parse(String(b?.created_at || ""));
      const safeACreated = Number.isFinite(aCreated) ? aCreated : 0;
      const safeBCreated = Number.isFinite(bCreated) ? bCreated : 0;
      return safeBCreated - safeACreated;
    });
  }, [projectTasks]);

  const taskAssigneeFilterOptions = useMemo(() => {
    const options = new Map();
    sortedProjectTasks.forEach((task) => {
      const assigneeId = parseMemberId(task?.assignee_member_id);
      if (!assigneeId) return;
      const assigneeName =
        String(task?.assignee_name || "").trim() || `Member #${assigneeId}`;
      options.set(String(assigneeId), assigneeName);
    });
    return Array.from(options.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedProjectTasks]);

  const filteredProjectTasks = useMemo(() => {
    const normalizedSearch = String(taskSearchQuery || "")
      .trim()
      .toLowerCase();
    return sortedProjectTasks.filter((task) => {
      const safeStatus = String(task?.status || "open")
        .trim()
        .toLowerCase();
      const assigneeId = parseMemberId(task?.assignee_member_id);

      if (taskStatusFilter !== "all" && safeStatus !== taskStatusFilter) {
        return false;
      }
      if (taskAssigneeFilter === "unassigned" && assigneeId) {
        return false;
      }
      if (
        taskAssigneeFilter !== "all" &&
        taskAssigneeFilter !== "unassigned" &&
        String(assigneeId || "") !== String(taskAssigneeFilter)
      ) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        task?.title,
        task?.details,
        task?.assignee_name,
        TASK_STATUS_LABELS[safeStatus] || safeStatus,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(normalizedSearch);
    });
  }, [sortedProjectTasks, taskSearchQuery, taskStatusFilter, taskAssigneeFilter]);

  const mobileFilteredProjectTasks = useMemo(() => {
    return sortedProjectTasks.filter((task) => {
      const safeStatus = String(task?.status || "open")
        .trim()
        .toLowerCase();
      if (mobileTaskStatusFilter === "all") {
        return true;
      }
      return safeStatus === mobileTaskStatusFilter;
    });
  }, [sortedProjectTasks, mobileTaskStatusFilter]);

  const taskActionTask = useMemo(() => {
    const normalizedId = String(taskActionTaskId || "").trim();
    if (!normalizedId) return null;
    return (
      sortedProjectTasks.find((task) => String(task?.id ?? "") === normalizedId) || null
    );
  }, [sortedProjectTasks, taskActionTaskId]);

  const groupedTaskRows = useMemo(() => {
    const buckets = new Map();
    TASK_STATUS_GROUP_ORDER.forEach((statusKey) => {
      buckets.set(statusKey, []);
    });
    const customBuckets = new Map();

    filteredProjectTasks.forEach((task) => {
      const safeStatus = String(task?.status || "open")
        .trim()
        .toLowerCase();
      const statusKey = safeStatus || "open";
      if (buckets.has(statusKey)) {
        buckets.get(statusKey).push(task);
        return;
      }
      if (!customBuckets.has(statusKey)) {
        customBuckets.set(statusKey, []);
      }
      customBuckets.get(statusKey).push(task);
    });

    const lanes = TASK_STATUS_GROUP_ORDER.map((statusKey) => ({
      key: statusKey,
      label: TASK_STATUS_GROUP_LABELS[statusKey] || TASK_STATUS_LABELS[statusKey] || toReadableLabel(statusKey),
      rows: buckets.get(statusKey) || [],
    })).filter((lane) => lane.rows.length > 0);

    Array.from(customBuckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([statusKey, rows]) => {
        lanes.push({
          key: statusKey,
          label: TASK_STATUS_LABELS[statusKey] || toReadableLabel(statusKey),
          rows,
        });
      });

    return lanes;
  }, [filteredProjectTasks]);

  const taskRowIds = useMemo(
    () =>
      filteredProjectTasks
        .map((task) => String(task?.id ?? ""))
        .filter(Boolean),
    [filteredProjectTasks]
  );

  useEffect(() => {
    const visibleTaskSet = new Set(taskRowIds);
    setSelectedTaskIds((prev) => prev.filter((taskId) => visibleTaskSet.has(taskId)));
  }, [taskRowIds]);

  const allTasksSelected =
    taskRowIds.length > 0 &&
    taskRowIds.every((taskId) => selectedTaskIds.includes(taskId));

  const handleToggleSelectAllTasks = () => {
    if (allTasksSelected) {
      setSelectedTaskIds([]);
      return;
    }
    setSelectedTaskIds(taskRowIds);
  };

  const handleToggleTaskSelection = (taskId) => {
    const normalizedId = String(taskId ?? "");
    if (!normalizedId) return;
    setSelectedTaskIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const selectedTasks = useMemo(() => {
    const selectedSet = new Set(selectedTaskIds.map((taskId) => String(taskId)));
    return filteredProjectTasks.filter((task) => selectedSet.has(String(task?.id ?? "")));
  }, [filteredProjectTasks, selectedTaskIds]);

  const hasActiveTaskFilters =
    String(taskSearchQuery || "").trim().length > 0 ||
    taskStatusFilter !== "all" ||
    taskAssigneeFilter !== "all";

  const openTaskDetailsModal = useCallback((task) => {
    if (!task) return;
    setActiveTaskDetails(task);
    setShowTasksToolsMenu(false);
    setOpenTaskRowMenuId("");
  }, []);

  const closeTaskDetailsModal = () => {
    setActiveTaskDetails(null);
  };

  const handleToggleTasksToolsMenu = (event) => {
    event.stopPropagation();
    setShowTasksToolsMenu((prev) => !prev);
    setOpenTaskRowMenuId("");
  };

  const handleToggleTaskRowMenu = (taskId, event) => {
    event.stopPropagation();
    const normalizedId = String(taskId || "");
    setOpenTaskRowMenuId((prev) => (prev === normalizedId ? "" : normalizedId));
    setShowTasksToolsMenu(false);
  };

  const handleRequestDeleteSingleTask = (task) => {
    if (!canManageProjectContent) return;
    const taskId = String(task?.id || "").trim();
    if (!taskId) return;
    setSelectedTaskIds([taskId]);
    setOpenTaskRowMenuId("");
    setShowDeleteTasksModal(true);
  };

  const openTaskModalForStatus = useCallback(
    (status = "open") => {
      if (!canManageProjectContent) return;
      const normalizedStatus =
        TASK_STATUS_LABELS[String(status || "").trim().toLowerCase()] ? String(status).trim().toLowerCase() : "open";
      const defaultAssignee = parseMemberId(user?.id);
      setEditingTaskId(null);
      setShowTasksToolsMenu(false);
      setOpenTaskRowMenuId("");
      setTaskForm({
        ...createInitialTaskForm(),
        assigneeId: defaultAssignee ? String(defaultAssignee) : "",
        dueDate: new Date().toISOString().slice(0, 10),
        status: normalizedStatus,
      });
      setTaskFormError("");
      setShowTaskModal(true);
    },
    [canManageProjectContent, user?.id]
  );

  const openTaskModal = () => {
    openTaskModalForStatus("open");
  };

  const openTaskEditorForRow = useCallback((task) => {
    if (!canManageProjectContent) return;
    if (!task) return;
    setEditingTaskId(String(task?.id ?? ""));
    setShowTasksToolsMenu(false);
    setOpenTaskRowMenuId("");
    setTaskForm({
      title: String(task?.title || ""),
      assigneeId: task?.assignee_member_id ? String(task.assignee_member_id) : "",
      dueDate: String(task?.due_date || "").slice(0, 10),
      priority: String(task?.priority || "normal"),
      status: String(task?.status || "open"),
      details: String(task?.details || ""),
    });
    setTaskFormError("");
    setShowTaskModal(true);
  }, [canManageProjectContent]);

  const openTaskActionSheet = (task) => {
    if (!isMobileProjectViewport) return;
    const taskId = String(task?.id ?? "").trim();
    if (!taskId) return;
    setTaskActionTaskId(taskId);
  };

  const closeTaskActionSheet = () => {
    setTaskActionTaskId("");
  };

  const persistTaskStatusUpdate = async (task, nextStatus) => {
    const taskId = String(task?.id ?? "").trim();
    if (!taskId) return;
    const safeStatus = String(nextStatus || "open").trim().toLowerCase();
    if (!TASK_STATUS_LABELS[safeStatus]) return;

    const previousStatus = String(task?.status || "open").trim().toLowerCase() || "open";
    if (previousStatus === safeStatus) return;

    const payload = {
      title: String(task?.title || "").trim() || "Untitled task",
      details: String(task?.details || "").trim() || null,
      assignee_member_id: parseMemberId(task?.assignee_member_id),
      due_date: String(task?.due_date || "").trim() || null,
      priority: ["high", "urgent"].includes(String(task?.priority || "").trim().toLowerCase())
        ? String(task?.priority || "").trim().toLowerCase()
        : "normal",
      status: safeStatus,
    };

    setProjectTasks((prev) =>
      prev.map((row) =>
        String(row?.id ?? "") === taskId
          ? {
              ...row,
              status: safeStatus,
            }
          : row
      )
    );

    try {
      await updateProjectTask(taskId, payload, tenantId);
      setProjectsNotice({
        type: "success",
        message:
          safeStatus === "done"
            ? "Task marked completed."
            : `Task moved to ${TASK_STATUS_LABELS[safeStatus] || toReadableLabel(safeStatus)}.`,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
      setProjectTasks((prev) =>
        prev.map((row) =>
          String(row?.id ?? "") === taskId
            ? {
                ...row,
                status: previousStatus,
              }
            : row
        )
      );
      setProjectsNotice({
        type: "warning",
        message: error?.message || "Failed to update task status.",
      });
    }
  };

  const handleToggleTaskComplete = async (task) => {
    if (!canManageProjectContent || savingTask || deletingTasks) return;
    const currentStatus = String(task?.status || "open").trim().toLowerCase();
    const nextStatus = currentStatus === "done" ? "open" : "done";
    await persistTaskStatusUpdate(task, nextStatus);
  };

  const handleTaskCardTouchStart = (taskId, event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    taskSwipeTouchRef.current = {
      taskId: String(taskId ?? ""),
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTaskCardTouchEnd = (task, event) => {
    const start = taskSwipeTouchRef.current;
    taskSwipeTouchRef.current = null;
    if (!start) return;
    if (String(start.taskId || "") !== String(task?.id ?? "")) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > 42) return;
    if (deltaX >= 72) {
      suppressTaskOpenRef.current = true;
      handleToggleTaskComplete(task);
      return;
    }
    if (deltaX <= -72 && canManageProjectContent) {
      suppressTaskOpenRef.current = true;
      openTaskActionSheet(task);
    }
  };

  const handleTaskCardTouchCancel = () => {
    taskSwipeTouchRef.current = null;
  };

  const handleEditTaskFromActionSheet = () => {
    if (!canManageProjectContent || !taskActionTask) return;
    const taskToEdit = taskActionTask;
    closeTaskActionSheet();
    openTaskEditorForRow(taskToEdit);
  };

  const handleDeleteTaskFromActionSheet = () => {
    if (!canManageProjectContent || !taskActionTask) return;
    const taskId = String(taskActionTask?.id ?? "").trim();
    if (!taskId) return;
    setSelectedTaskIds([taskId]);
    closeTaskActionSheet();
    setShowDeleteTasksModal(true);
  };

  const openEditSelectedTaskModal = () => {
    if (!canManageProjectContent) return;
    if (selectedTasks.length !== 1) return;
    setShowTasksToolsMenu(false);
    openTaskEditorForRow(selectedTasks[0]);
  };

  const closeTaskModal = () => {
    if (savingTask) return;
    setShowTaskModal(false);
    setTaskFormError("");
    setEditingTaskId(null);
  };

  const requestDeleteSelectedTasks = () => {
    if (!canManageProjectContent) return;
    if (!selectedTasks.length) return;
    setShowTasksToolsMenu(false);
    setOpenTaskRowMenuId("");
    setShowDeleteTasksModal(true);
  };

  const closeDeleteTasksModal = () => {
    if (deletingTasks) return;
    setShowDeleteTasksModal(false);
  };

  useEffect(() => {
    if (!showDeleteTasksModal) return;
    if (selectedTasks.length > 0) return;
    setShowDeleteTasksModal(false);
  }, [showDeleteTasksModal, selectedTasks.length]);

  useEffect(() => {
    if (detailTab === "tasks") return;
    setShowTasksToolsMenu(false);
    setOpenTaskRowMenuId("");
    setActiveTaskDetails(null);
  }, [detailTab]);

  useEffect(() => {
    setShowTasksToolsMenu(false);
    setOpenTaskRowMenuId("");
    setActiveTaskDetails(null);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!showTasksToolsMenu && !openTaskRowMenuId) {
      return undefined;
    }
    const handleWindowClick = () => {
      setShowTasksToolsMenu(false);
      setOpenTaskRowMenuId("");
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [showTasksToolsMenu, openTaskRowMenuId]);

  const handleTaskFormFieldChange = (field, value) => {
    setTaskForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (taskFormError) {
      setTaskFormError("");
    }
  };

  const handleTaskFormSubmit = async (event) => {
    event.preventDefault();
    if (!canManageProjectContent) return;
    const projectId = normalizeProjectId(selectedProject?.id);
    const parsedEditingTaskId = String(editingTaskId || "").trim();
    const isEditingTask = Boolean(parsedEditingTaskId);

    if (!projectId) {
      setTaskFormError("Select a valid project before adding a task.");
      return;
    }

    const title = String(taskForm.title || "").trim();
    const dueDate = String(taskForm.dueDate || "").trim();
    const priority = String(taskForm.priority || "normal").trim().toLowerCase();
    const status = String(taskForm.status || "open").trim().toLowerCase();
    const details = String(taskForm.details || "").trim();
    const assigneeMemberId = parseMemberId(taskForm.assigneeId);
    const currentUserId = parseMemberId(user?.id);

    if (!title) {
      setTaskFormError("Task title is required.");
      return;
    }
    if (priority !== "normal" && priority !== "high" && priority !== "urgent") {
      setTaskFormError("Select a valid priority.");
      return;
    }

    setSavingTask(true);
    setTaskFormError("");

    try {
      if (isEditingTask) {
        await updateProjectTask(
          parsedEditingTaskId,
          {
            title,
            details: details || null,
            assignee_member_id: assigneeMemberId,
            due_date: dueDate || null,
            priority,
            status,
          },
          tenantId
        );
      } else {
        await createProjectTask(
          projectId,
          {
            title,
            details: details || null,
            assignee_member_id: assigneeMemberId,
            due_date: dueDate || null,
            priority,
            status,
            created_by_member_id: currentUserId,
          },
          tenantId
        );
      }

      setShowTaskModal(false);
      setEditingTaskId(null);
      setTaskForm(createInitialTaskForm());
      setSelectedTaskIds([]);
      setDetailTab("tasks");
      setProjectsNotice({
        type: "success",
        message: isEditingTask ? "Task updated successfully." : "Task created successfully.",
      });

      setProjectTasksLoading(true);
      setProjectTasksError("");
      try {
        const rows = await getProjectTasks(projectId, tenantId);
        setProjectTasks(Array.isArray(rows) ? rows : []);
      } catch (reloadError) {
        console.error("Task saved but refresh failed:", reloadError);
        setProjectTasksError(reloadError?.message || "Task saved, but failed to refresh task list.");
      } finally {
        setProjectTasksLoading(false);
      }
    } catch (error) {
      console.error("Error saving project task:", error);
      setTaskFormError(error?.message || (isEditingTask ? "Failed to update task." : "Failed to save task."));
    } finally {
      setSavingTask(false);
    }
  };

  const handleConfirmDeleteSelectedTasks = async () => {
    if (!canManageProjectContent) return;
    if (!selectedTasks.length) return;
    setDeletingTasks(true);
    try {
      let successCount = 0;
      let failureCount = 0;
      const deletedIds = [];

      for (const task of selectedTasks) {
        try {
          await deleteProjectTask(task.id, tenantId);
          successCount += 1;
          deletedIds.push(String(task.id));
        } catch (error) {
          failureCount += 1;
          console.error("Error deleting selected task:", error);
        }
      }

      if (deletedIds.length) {
        setProjectTasks((prev) => prev.filter((task) => !deletedIds.includes(String(task?.id ?? ""))));
        setSelectedTaskIds((prev) => prev.filter((taskId) => !deletedIds.includes(String(taskId))));
        if (taskActionTaskId && deletedIds.includes(String(taskActionTaskId))) {
          setTaskActionTaskId("");
        }
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message: successCount === 1 ? "Task deleted successfully." : `${successCount} tasks deleted successfully.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Deleted ${successCount} task(s). ${failureCount} task(s) failed.`,
        });
      }
      setShowDeleteTasksModal(false);
    } finally {
      setDeletingTasks(false);
    }
  };


  const noteVisibilityMemberOptions = useMemo(() => {
    const map = new Map();
    (Array.isArray(projectAssignableMembers) ? projectAssignableMembers : []).forEach((member) => {
      const memberId = parseMemberId(member?.id);
      if (!memberId || map.has(memberId)) return;
      map.set(memberId, {
        id: memberId,
        name: String(member?.name || `Member #${memberId}`).trim() || `Member #${memberId}`,
        role: String(member?.role || "").trim(),
      });
    });

    if (currentMemberId && !map.has(currentMemberId)) {
      map.set(currentMemberId, {
        id: currentMemberId,
        name: String(user?.name || "You").trim() || "You",
        role: "",
      });
    }

    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [projectAssignableMembers, currentMemberId, user?.name]);

  const sortedProjectNotes = useMemo(() => {
    return [...projectNotes].sort((a, b) => {
      const aTime = Date.parse(String(a?.created_at || ""));
      const bTime = Date.parse(String(b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });
  }, [projectNotes]);

  const readableProjectNotes = useMemo(() => {
    return sortedProjectNotes.filter((note) => {
      if (isAdmin) {
        return true;
      }

      const visibility = normalizeNoteVisibilityKey(note?.visibility);
      const authorMemberId = parseMemberId(note?.author_member_id);
      const visibleMemberIds = normalizeNoteVisibilityMemberIds(note?.visible_member_ids);

      if (currentMemberId && authorMemberId && currentMemberId === authorMemberId) {
        return true;
      }

      if (visibility === "project_team") return true;
      if (visibility === "admins_only") return false;
      if (visibility === "owner_only") return false;

      if (visibility === "selected_members") {
        if (!currentMemberId) return false;
        return visibleMemberIds.includes(currentMemberId);
      }

      return true;
    });
  }, [sortedProjectNotes, isAdmin, currentMemberId]);

  const filteredProjectNotes = useMemo(() => {
    const normalizedSearch = String(noteSearchQuery || "")
      .trim()
      .toLowerCase();
    return readableProjectNotes.filter((note) => {
      const safeVisibility = normalizeNoteVisibilityKey(note?.visibility);
      if (noteVisibilityFilter !== "all" && safeVisibility !== noteVisibilityFilter) {
        return false;
      }
      if (!normalizedSearch) return true;

      const haystack = [note?.title, note?.body, note?.author_name]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalizedSearch);
    });
  }, [readableProjectNotes, noteSearchQuery, noteVisibilityFilter]);

  const groupedNoteRows = useMemo(() => {
    const buckets = new Map();
    NOTE_VISIBILITY_GROUP_ORDER.forEach((visibilityKey) => {
      buckets.set(visibilityKey, []);
    });
    const customBuckets = new Map();

    filteredProjectNotes.forEach((note) => {
      const safeVisibility = normalizeNoteVisibilityKey(note?.visibility);
      const visibilityKey = safeVisibility || "project_team";
      if (buckets.has(visibilityKey)) {
        buckets.get(visibilityKey).push(note);
        return;
      }
      if (!customBuckets.has(visibilityKey)) {
        customBuckets.set(visibilityKey, []);
      }
      customBuckets.get(visibilityKey).push(note);
    });

    const lanes = NOTE_VISIBILITY_GROUP_ORDER.map((visibilityKey) => ({
      key: visibilityKey,
      label: NOTE_VISIBILITY_LABELS[visibilityKey] || toReadableLabel(visibilityKey),
      rows: buckets.get(visibilityKey) || [],
    })).filter((lane) => lane.rows.length > 0);

    Array.from(customBuckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([visibilityKey, rows]) => {
        lanes.push({
          key: visibilityKey,
          label: NOTE_VISIBILITY_LABELS[visibilityKey] || toReadableLabel(visibilityKey),
          rows,
        });
      });

    return lanes;
  }, [filteredProjectNotes]);

  const mobileProjectFiles = useMemo(() => {
    const documentRows = sortedProjectDocuments.map((document) => {
      const timestamp = Date.parse(String(document?.uploaded_at || document?.created_at || ""));
      return {
        id: `document-${String(document?.id || "")}`,
        type: "document",
        title: String(document?.name || "Untitled document").trim() || "Untitled document",
        subtitle: getProjectDocumentTypeLabel(document),
        secondary: formatDate(document?.uploaded_at || document?.created_at),
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        downloadUrl: String(document?.download_url || document?.file_url || "").trim(),
      };
    });

    const noteRows = readableProjectNotes.map((note) => {
      const timestamp = Date.parse(String(note?.updated_at || note?.created_at || ""));
      return {
        id: `note-${String(note?.id || "")}`,
        type: "note",
        title: String(note?.title || "Untitled note").trim() || "Untitled note",
        subtitle: getNoteVisibilityLabel(note?.visibility, note?.visible_member_ids),
        secondary: formatDate(note?.updated_at || note?.created_at),
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        notePreview: truncateProjectCellText(String(note?.body || "").trim(), 140),
      };
    });

    return [...documentRows, ...noteRows].sort((left, right) => right.timestamp - left.timestamp);
  }, [sortedProjectDocuments, readableProjectNotes]);

  const noteRowIds = useMemo(
    () =>
      filteredProjectNotes
        .map((note) => String(note?.id ?? ""))
        .filter(Boolean),
    [filteredProjectNotes]
  );

  useEffect(() => {
    const visibleNoteSet = new Set(noteRowIds);
    setSelectedNoteIds((prev) => prev.filter((noteId) => visibleNoteSet.has(noteId)));
  }, [noteRowIds]);

  const allNotesSelected =
    noteRowIds.length > 0 &&
    noteRowIds.every((noteId) => selectedNoteIds.includes(noteId));

  const handleToggleSelectAllNotes = () => {
    if (allNotesSelected) {
      setSelectedNoteIds([]);
      return;
    }
    setSelectedNoteIds(noteRowIds);
  };

  const handleToggleNoteSelection = (noteId) => {
    const normalizedId = String(noteId ?? "");
    if (!normalizedId) return;
    setSelectedNoteIds((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const selectedNotes = useMemo(() => {
    const selectedSet = new Set(selectedNoteIds.map((noteId) => String(noteId)));
    return filteredProjectNotes.filter((note) => selectedSet.has(String(note?.id ?? "")));
  }, [filteredProjectNotes, selectedNoteIds]);

  const hasActiveNoteFilters =
    String(noteSearchQuery || "").trim().length > 0 || noteVisibilityFilter !== "all";
  const selectedNoteVisibilityMemberIds = useMemo(
    () => new Set(normalizeNoteVisibilityMemberIds(noteForm.visibleMemberIds)),
    [noteForm.visibleMemberIds]
  );

  const openNoteModalForVisibility = useCallback(
    (visibility = "project_team") => {
      if (!canManageProjectContent) return;
      const normalizedVisibility = normalizeNoteVisibilityKey(visibility);
      setEditingNoteId(null);
      setShowNotesToolsMenu(false);
      setOpenNoteRowMenuId("");
      setNoteForm({
        ...createInitialNoteForm(),
        visibility: normalizedVisibility,
      });
      setNoteFormError("");
      setShowNoteModal(true);
    },
    [canManageProjectContent]
  );

  const openNoteModal = () => {
    openNoteModalForVisibility("project_team");
  };

  const closeNoteModal = () => {
    if (savingNote) return;
    setShowNoteModal(false);
    setNoteFormError("");
    setEditingNoteId(null);
  };

  const openNoteDetailsModal = useCallback((note) => {
    if (!note) return;
    setActiveNoteDetails(note);
    setShowNotesToolsMenu(false);
    setOpenNoteRowMenuId("");
  }, []);

  const closeNoteDetailsModal = () => {
    setActiveNoteDetails(null);
  };

  const handleToggleNotesToolsMenu = (event) => {
    event.stopPropagation();
    setShowNotesToolsMenu((prev) => !prev);
    setOpenNoteRowMenuId("");
  };

  const handleToggleNoteRowMenu = (noteId, event) => {
    event.stopPropagation();
    const normalizedId = String(noteId || "");
    setOpenNoteRowMenuId((prev) => (prev === normalizedId ? "" : normalizedId));
    setShowNotesToolsMenu(false);
  };

  const handleRequestDeleteSingleNote = (note) => {
    if (!canManageProjectContent) return;
    const noteId = String(note?.id || "").trim();
    if (!noteId) return;
    setSelectedNoteIds([noteId]);
    setOpenNoteRowMenuId("");
    setShowDeleteNotesModal(true);
  };

  const openNoteEditorForRow = useCallback((note) => {
    if (!canManageProjectContent) return;
    if (!note) return;
    setEditingNoteId(String(note?.id ?? ""));
    setOpenNoteRowMenuId("");
    setShowNotesToolsMenu(false);
    setNoteForm({
      title: String(note?.title || ""),
      visibility: normalizeNoteVisibilityKey(note?.visibility),
      visibleMemberIds: normalizeNoteVisibilityMemberIds(note?.visible_member_ids),
      details: String(note?.body || ""),
    });
    setNoteFormError("");
    setShowNoteModal(true);
  }, [canManageProjectContent]);

  const openEditSelectedNoteModal = () => {
    if (!canManageProjectContent) return;
    if (selectedNotes.length !== 1) return;
    setShowNotesToolsMenu(false);
    openNoteEditorForRow(selectedNotes[0]);
  };

  const requestDeleteSelectedNotes = () => {
    if (!canManageProjectContent) return;
    if (!selectedNotes.length) return;
    setShowNotesToolsMenu(false);
    setOpenNoteRowMenuId("");
    setShowDeleteNotesModal(true);
  };

  const closeDeleteNotesModal = () => {
    if (deletingNotes) return;
    setShowDeleteNotesModal(false);
  };

  useEffect(() => {
    if (!showDeleteNotesModal) return;
    if (selectedNotes.length > 0) return;
    setShowDeleteNotesModal(false);
  }, [showDeleteNotesModal, selectedNotes.length]);

  useEffect(() => {
    if (detailTab === "notes") return;
    setShowNotesToolsMenu(false);
    setOpenNoteRowMenuId("");
    setActiveNoteDetails(null);
  }, [detailTab]);

  useEffect(() => {
    setShowNotesToolsMenu(false);
    setOpenNoteRowMenuId("");
    setActiveNoteDetails(null);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!showNotesToolsMenu && !openNoteRowMenuId) {
      return undefined;
    }
    const handleWindowClick = () => {
      setShowNotesToolsMenu(false);
      setOpenNoteRowMenuId("");
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [showNotesToolsMenu, openNoteRowMenuId]);

  const handleNoteFormFieldChange = (field, value) => {
    setNoteForm((prev) => {
      if (field === "visibility") {
        const nextVisibility = normalizeNoteVisibilityKey(value);
        return {
          ...prev,
          visibility: nextVisibility,
          visibleMemberIds: nextVisibility === "selected_members" ? prev.visibleMemberIds : [],
        };
      }

      if (field === "visibleMemberIds") {
        return {
          ...prev,
          visibleMemberIds: normalizeNoteVisibilityMemberIds(value),
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
    if (noteFormError) {
      setNoteFormError("");
    }
  };

  const handleToggleNoteVisibilityMember = (memberId) => {
    const parsedMemberId = parseMemberId(memberId);
    if (!parsedMemberId) return;
    setNoteForm((prev) => {
      const selectedIds = new Set(normalizeNoteVisibilityMemberIds(prev.visibleMemberIds));
      if (selectedIds.has(parsedMemberId)) {
        selectedIds.delete(parsedMemberId);
      } else {
        selectedIds.add(parsedMemberId);
      }
      return {
        ...prev,
        visibleMemberIds: Array.from(selectedIds),
      };
    });
    if (noteFormError) {
      setNoteFormError("");
    }
  };

  const handleNoteFormSubmit = async (event) => {
    event.preventDefault();
    if (!canManageProjectContent) return;
    const projectId = normalizeProjectId(selectedProject?.id);
    const parsedEditingNoteId = String(editingNoteId || "").trim();
    const isEditingNote = Boolean(parsedEditingNoteId);

    if (!projectId) {
      setNoteFormError("Select a valid project before adding a note.");
      return;
    }

    const title = String(noteForm.title || "").trim();
    const visibility = normalizeNoteVisibilityKey(noteForm.visibility);
    const body = String(noteForm.details || "").trim();
    const selectedVisibleMemberIds = normalizeNoteVisibilityMemberIds(noteForm.visibleMemberIds);
    const currentUserId = currentMemberId;

    if (!title) {
      setNoteFormError("Note title is required.");
      return;
    }
    if (
      visibility !== "project_team" &&
      visibility !== "admins_only" &&
      visibility !== "owner_only" &&
      visibility !== "selected_members"
    ) {
      setNoteFormError("Select a valid visibility.");
      return;
    }
    if (visibility === "selected_members" && selectedVisibleMemberIds.length === 0) {
      setNoteFormError("Select at least one member for this note.");
      return;
    }
    if (visibility === "owner_only" && !currentUserId) {
      setNoteFormError("Unable to resolve note owner for this account.");
      return;
    }

    setSavingNote(true);
    setNoteFormError("");

    try {
      const notePayload = {
        title,
        visibility,
        body: body || null,
      };
      if (visibility === "selected_members") {
        notePayload.visible_member_ids = selectedVisibleMemberIds;
      }

      if (isEditingNote) {
        await updateProjectNote(
          parsedEditingNoteId,
          notePayload,
          tenantId
        );
      } else {
        await createProjectNote(
          projectId,
          { ...notePayload, author_member_id: currentUserId },
          tenantId
        );
      }

      setShowNoteModal(false);
      setEditingNoteId(null);
      setNoteForm(createInitialNoteForm());
      setSelectedNoteIds([]);
      setDetailTab("notes");
      setProjectsNotice({
        type: "success",
        message: isEditingNote ? "Note updated successfully." : "Note saved successfully.",
      });

      setProjectNotesLoading(true);
      setProjectNotesError("");
      try {
        const rows = await getProjectNotes(projectId, tenantId);
        setProjectNotes(Array.isArray(rows) ? rows : []);
      } catch (reloadError) {
        console.error("Note saved but refresh failed:", reloadError);
        setProjectNotesError(reloadError?.message || "Note saved, but failed to refresh notes.");
      } finally {
        setProjectNotesLoading(false);
      }
    } catch (error) {
      console.error("Error saving project note:", error);
      setNoteFormError(error?.message || (isEditingNote ? "Failed to update note." : "Failed to save note."));
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmDeleteSelectedNotes = async () => {
    if (!canManageProjectContent) return;
    if (!selectedNotes.length) return;
    setDeletingNotes(true);
    try {
      let successCount = 0;
      let failureCount = 0;
      const deletedIds = [];

      for (const note of selectedNotes) {
        try {
          await deleteProjectNote(note.id, tenantId);
          successCount += 1;
          deletedIds.push(String(note.id));
        } catch (error) {
          failureCount += 1;
          console.error("Error deleting selected note:", error);
        }
      }

      if (deletedIds.length) {
        setProjectNotes((prev) => prev.filter((note) => !deletedIds.includes(String(note?.id ?? ""))));
        setSelectedNoteIds((prev) => prev.filter((noteId) => !deletedIds.includes(String(noteId))));
      }

      if (failureCount === 0) {
        setProjectsNotice({
          type: "success",
          message: successCount === 1 ? "Note deleted successfully." : `${successCount} notes deleted successfully.`,
        });
      } else {
        setProjectsNotice({
          type: "warning",
          message: `Deleted ${successCount} note(s). ${failureCount} note(s) failed.`,
        });
      }
      setShowDeleteNotesModal(false);
    } finally {
      setDeletingNotes(false);
    }
  };

  const handleManageProject = (project) => {
    const moduleKey = resolveModuleKey(project);
    const target = projectPageMap[moduleKey];
    if (target && setActivePage) {
      if (typeof onManageProject === "function") {
        onManageProject(project);
      }
      setActivePage(target);
    }
  };

  const formatInviteStatusLabel = (status) =>
    String(status || "pending")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const formatInviteScopeLabel = (invite) => {
    const scope = String(invite?.project_access_scope || "none").trim().toLowerCase();
    if (scope === "all") return "All projects";
    if (scope === "selected") {
      const count = Array.isArray(invite?.project_ids) ? invite.project_ids.length : 0;
      return count <= 1 ? "Selected project" : `${count} selected projects`;
    }
    return "No project access";
  };

  const formatMemberPendingInviteProjects = (invite) => {
    const names = Array.isArray(invite?.project_names)
      ? invite.project_names
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      : [];
    if (!names.length) return formatInviteScopeLabel(invite);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  };

  const applyProjectInviteToCurrentMember = async (invite) => {
    const inviteId = String(invite?.id || "").trim();
    if (!inviteId) {
      throw new Error("Invite was not found or has expired.");
    }

    const memberId = Number.parseInt(String(user?.id || ""), 10);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      throw new Error("Your member profile is not available. Refresh and try again.");
    }

    const inviteTenantId = String(invite?.tenant_id || "").trim().toLowerCase();
    const currentTenantId = String(tenantId || "").trim().toLowerCase();
    if (inviteTenantId && currentTenantId && inviteTenantId !== currentTenantId) {
      throw new Error("This invite belongs to a different workspace.");
    }

    const inviteStatus = String(invite?.status || "pending").trim().toLowerCase();
    if (inviteStatus === "used") {
      throw new Error("This invite has already been used.");
    }
    if (inviteStatus === "revoked" || inviteStatus === "expired") {
      throw new Error("This invite is no longer active.");
    }

    const expiresAtTimestamp = Date.parse(String(invite?.expires_at || ""));
    if (Number.isFinite(expiresAtTimestamp) && expiresAtTimestamp <= Date.now()) {
      throw new Error("This invite has expired.");
    }

    const inviteEmail = String(invite?.email || "").trim().toLowerCase();
    const memberEmail = String(user?.email || "").trim().toLowerCase();
    if (inviteEmail && memberEmail && inviteEmail !== memberEmail) {
      throw new Error("This invite is linked to a different email address.");
    }
    if (inviteEmail && !memberEmail) {
      throw new Error("Your account email is missing. Contact your admin to confirm this invite.");
    }

    const appliedProjectRows = await applyMagicLinkInviteProjectAccess(inviteId, memberId);
    await markMagicLinkInviteUsed(inviteId, memberId);

    await loadProjects();
    if (detailTab === "invites" && canViewProjectInvites) {
      await loadProjectInvites();
    }
    await loadPendingProjectInvites();

    return Array.isArray(appliedProjectRows) ? appliedProjectRows.length : 0;
  };

  const resetAcceptProjectInviteForm = useCallback(() => {
    setAcceptProjectInviteForm(createInitialAcceptProjectInviteForm());
    setAcceptProjectInviteError("");
  }, []);

  const openAcceptInviteModal = useCallback(() => {
    if (!canAcceptProjectInvites) return;
    resetAcceptProjectInviteForm();
    setShowAcceptInviteModal(true);
  }, [canAcceptProjectInvites, resetAcceptProjectInviteForm]);

  const closeAcceptInviteModal = useCallback(() => {
    if (acceptingProjectInvite) return;
    setShowAcceptInviteModal(false);
    resetAcceptProjectInviteForm();
  }, [acceptingProjectInvite, resetAcceptProjectInviteForm]);

  const handleAcceptProjectInviteFieldChange = useCallback((field, value) => {
    setAcceptProjectInviteForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (acceptProjectInviteError) {
      setAcceptProjectInviteError("");
    }
  }, [acceptProjectInviteError]);

  const handleAcceptProjectInviteSubmit = async (event) => {
    event.preventDefault();
    if (!canAcceptProjectInvites) return;

    const inviteNumber = normalizeInviteNumberInput(acceptProjectInviteForm.inviteNumber);
    if (!inviteNumber) {
      setAcceptProjectInviteError("Invite number is required.");
      return;
    }

    const memberId = Number.parseInt(String(user?.id || ""), 10);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      setAcceptProjectInviteError("Your member profile is not available. Refresh and try again.");
      return;
    }

    setAcceptingProjectInvite(true);
    setAcceptProjectInviteError("");
    setProjectsNotice(null);
    try {
      const invite = await verifyMagicLinkInvite(inviteNumber);
      const appliedCount = await applyProjectInviteToCurrentMember(invite);

      setShowAcceptInviteModal(false);
      resetAcceptProjectInviteForm();
      setProjectsNotice({
        type: "success",
        message:
          appliedCount > 0
            ? `Invite accepted. Added access to ${appliedCount} project${appliedCount === 1 ? "" : "s"}.`
            : "Invite accepted. You already had access to the assigned project(s).",
      });
    } catch (error) {
      console.error("Error accepting project invite:", error);
      setAcceptProjectInviteError(error?.message || "Failed to accept invite.");
    } finally {
      setAcceptingProjectInvite(false);
    }
  };

  const handleAcceptPendingProjectInvite = async (invite) => {
    const inviteId = String(invite?.id || "").trim();
    if (!canAcceptProjectInvites || !inviteId) return;

    setAcceptingPendingProjectInviteId(inviteId);
    setProjectsNotice(null);
    try {
      const appliedCount = await applyProjectInviteToCurrentMember(invite);
      setProjectsNotice({
        type: "success",
        message:
          appliedCount > 0
            ? `Invite accepted. Added access to ${appliedCount} project${appliedCount === 1 ? "" : "s"}.`
            : "Invite accepted. You already had access to the assigned project(s).",
      });
    } catch (error) {
      console.error("Error accepting pending project invite:", error);
      setProjectsNotice({
        type: "error",
        message: error?.message || "Failed to accept invite.",
      });
    } finally {
      setAcceptingPendingProjectInviteId("");
    }
  };

  const resetProjectInviteForm = useCallback(() => {
    setProjectInviteForm(createInitialProjectInviteForm());
    setProjectInviteFormError("");
  }, []);

  const openProjectInviteModal = useCallback(() => {
    const projectId = normalizeProjectId(selectedProject?.id);
    if (!canViewProjectInvites || !projectId) {
      return;
    }
    resetProjectInviteForm();
    setShowProjectInviteModal(true);
  }, [canViewProjectInvites, selectedProject?.id, resetProjectInviteForm]);

  const closeProjectInviteModal = useCallback(() => {
    if (submittingProjectInvite) return;
    setShowProjectInviteModal(false);
    resetProjectInviteForm();
  }, [submittingProjectInvite, resetProjectInviteForm]);

  const handleProjectInviteFormFieldChange = useCallback((field, value) => {
    setProjectInviteForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (projectInviteFormError) {
      setProjectInviteFormError("");
    }
  }, [projectInviteFormError]);

  const handleProjectInviteSubmit = async (event) => {
    event.preventDefault();
    if (!canViewProjectInvites) return;

    const projectId = normalizeProjectId(selectedProject?.id);
    if (!projectId) {
      setProjectInviteFormError("Select a valid project before inviting members.");
      return;
    }

    const email = String(projectInviteForm.email || "").trim().toLowerCase();
    if (!email) {
      setProjectInviteFormError("Invite email is required.");
      return;
    }

    setSubmittingProjectInvite(true);
    setProjectInviteFormError("");
    try {
      const result = await createProjectMagicLinkInvite({
        project_id: projectId,
        email,
        phone_number: projectInviteForm.phone_number || null,
        role: projectInviteForm.role || "member",
        notes: projectInviteForm.notes || null,
      });
      setShowProjectInviteModal(false);
      resetProjectInviteForm();
      setProjectsNotice({
        type: "success",
        message: `Invite created for ${email}. Invite number: ${result?.inviteNumber || "N/A"}.`,
      });
      await loadProjectInvites();
      setDetailTab("invites");
    } catch (error) {
      console.error("Error creating project invite:", error);
      setProjectInviteFormError(error?.message || "Failed to create project invite.");
    } finally {
      setSubmittingProjectInvite(false);
    }
  };

  const handleCopyInviteNumber = async (inviteNumber) => {
    const value = String(inviteNumber || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setProjectsNotice({
        type: "success",
        message: `Invite number ${value} copied.`,
      });
    } catch (error) {
      console.error("Unable to copy invite number:", error);
      setProjectsNotice({
        type: "warning",
        message: `Unable to copy invite number ${value}.`,
      });
    }
  };

  const handleToggleProjectsToolsMenu = (event) => {
    event.stopPropagation();
    setShowProjectsToolsMenu((prev) => !prev);
    setOpenProjectMenuId(null);
  };

  const clearProjectFilters = useCallback(() => {
    setProjectSearchQuery("");
    setProjectCategoryFilter("all");
    setProjectStatusFilter("all");
    setProjectOwnerFilter("all");
  }, []);

  const baseVisibleProjects = useMemo(
    () =>
      isAdmin
        ? projects
        : projects.filter(
            (project) =>
              project.is_visible !== false &&
              (project.membership || project.project_leader === user?.id)
          ),
    [isAdmin, projects, user?.id]
  );

  const projectFilterCategoryOptions = useMemo(() => {
    const categories = new Set();
    baseVisibleProjects.forEach((project) => {
      const label = String(getProjectCategory(project) || "").trim();
      if (label) {
        categories.add(label);
      }
    });
    return Array.from(categories).sort((left, right) => left.localeCompare(right));
  }, [baseVisibleProjects]);

  const projectStatusOptions = useMemo(() => {
    const statuses = new Map();
    baseVisibleProjects.forEach((project) => {
      const statusKey = String(project?.status || "active")
        .trim()
        .toLowerCase();
      if (!statusKey || statuses.has(statusKey)) return;
      statuses.set(statusKey, toReadableLabel(statusKey, "Active"));
    });
    return Array.from(statuses.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [baseVisibleProjects]);

  const projectOwnerOptions = useMemo(() => {
    const owners = new Map();
    const currentUserId = parseMemberId(user?.id);
    baseVisibleProjects.forEach((project) => {
      const ownerId = parseMemberId(project?.project_leader);
      if (!ownerId || owners.has(ownerId)) return;
      owners.set(ownerId, ownerId === currentUserId ? "You" : `Member #${ownerId}`);
    });
    return Array.from(owners.entries())
      .map(([value, label]) => ({ value: String(value), label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [baseVisibleProjects, user?.id]);

  const hasActiveProjectFilters =
    String(projectSearchQuery || "").trim().length > 0 ||
    projectCategoryFilter !== "all" ||
    projectStatusFilter !== "all" ||
    projectOwnerFilter !== "all";

  const visibleProjects = useMemo(() => {
    const currentUserId = parseMemberId(user?.id);
    const normalizedSearch = String(projectSearchQuery || "")
      .trim()
      .toLowerCase();
    const normalizedCategory = String(projectCategoryFilter || "all")
      .trim()
      .toLowerCase();
    const normalizedStatus = String(projectStatusFilter || "all")
      .trim()
      .toLowerCase();
    const normalizedOwner = String(projectOwnerFilter || "all")
      .trim()
      .toLowerCase();

    const filtered = baseVisibleProjects.filter((project) => {
      const statusKey = String(project?.status || "active")
        .trim()
        .toLowerCase();
      const isVisible = project?.is_visible !== false;
      const categoryLabel = String(getProjectCategory(project) || "").trim();
      const categoryKey = categoryLabel.toLowerCase();
      const ownerId = parseMemberId(project?.project_leader);

      if (normalizedSearch) {
        const haystack = [
          project?.name,
          project?.description,
          project?.short_description,
          project?.code,
          categoryLabel,
          statusKey,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (normalizedCategory !== "all" && categoryKey !== normalizedCategory) {
        return false;
      }

      if (normalizedStatus === "visible" && !isVisible) {
        return false;
      }
      if (normalizedStatus === "hidden" && isVisible) {
        return false;
      }
      if (
        normalizedStatus !== "all" &&
        normalizedStatus !== "visible" &&
        normalizedStatus !== "hidden" &&
        normalizedStatus !== statusKey
      ) {
        return false;
      }

      if (normalizedOwner === "mine") {
        if (!currentUserId || ownerId !== currentUserId) {
          return false;
        }
      } else if (normalizedOwner === "joined") {
        if (!project?.membership) {
          return false;
        }
      } else if (normalizedOwner === "unassigned") {
        if (ownerId) {
          return false;
        }
      } else if (normalizedOwner !== "all") {
        const selectedOwnerId = parseMemberId(normalizedOwner);
        if (!selectedOwnerId || ownerId !== selectedOwnerId) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (projectSortKey === "name_asc") {
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      }
      if (projectSortKey === "name_desc") {
        return String(right?.name || "").localeCompare(String(left?.name || ""));
      }
      if (projectSortKey === "progress_desc") {
        return getProjectProgress(right) - getProjectProgress(left);
      }
      if (projectSortKey === "budget_desc") {
        return getProjectBudgetAmount(right) - getProjectBudgetAmount(left);
      }

      const leftStart = Date.parse(String(left?.start_date || ""));
      const rightStart = Date.parse(String(right?.start_date || ""));
      const safeLeftStart = Number.isFinite(leftStart) ? leftStart : 0;
      const safeRightStart = Number.isFinite(rightStart) ? rightStart : 0;

      if (projectSortKey === "oldest") {
        return safeLeftStart - safeRightStart;
      }

      return safeRightStart - safeLeftStart;
    });

    return sorted;
  }, [
    baseVisibleProjects,
    user?.id,
    projectSearchQuery,
    projectCategoryFilter,
    projectStatusFilter,
    projectOwnerFilter,
    projectSortKey,
  ]);

  const visibleProjectIds = useMemo(
    () =>
      visibleProjects
        .map((project) => normalizeProjectId(project?.id))
        .filter(Boolean),
    [visibleProjects]
  );

  const selectedProjects = useMemo(() => {
    const selectedIdSet = new Set(selectedProjectIds);
    return visibleProjects.filter((project) =>
      selectedIdSet.has(normalizeProjectId(project?.id))
    );
  }, [visibleProjects, selectedProjectIds]);

  useEffect(() => {
    const visibleIdSet = new Set(visibleProjectIds);
    setSelectedProjectIds((prev) => prev.filter((projectId) => visibleIdSet.has(projectId)));
  }, [visibleProjectIds]);

  const allVisibleSelected =
    visibleProjectIds.length > 0 &&
    visibleProjectIds.every((projectId) => selectedProjectIds.includes(projectId));
  const showMemberPendingInvitesPanel =
    canAcceptProjectInvites &&
    (memberPendingProjectInvitesLoading ||
      Boolean(memberPendingProjectInvitesError) ||
      memberPendingProjectInvites.length > 0);

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedProjectIds([]);
      return;
    }
    setSelectedProjectIds(visibleProjectIds);
  };

  const handleToggleProjectSelection = (projectId) => {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId) return;
    setSelectedProjectIds((prev) => {
      if (prev.includes(normalizedProjectId)) {
        return prev.filter((id) => id !== normalizedProjectId);
      }
      return [...prev, normalizedProjectId];
    });
  };

  const clearProjectLongPressTimer = () => {
    if (!projectLongPressTimerRef.current) return;
    window.clearTimeout(projectLongPressTimerRef.current);
    projectLongPressTimerRef.current = null;
  };

  const handleProjectLongPressStart = (projectId) => {
    if (!isMobileProjectViewport) return;
    clearProjectLongPressTimer();
    projectLongPressTimerRef.current = window.setTimeout(() => {
      handleToggleProjectSelection(projectId);
      suppressProjectOpenRef.current = true;
      clearProjectLongPressTimer();
    }, 430);
  };

  const handleProjectLongPressCancel = () => {
    clearProjectLongPressTimer();
  };

  const openProjectDetailsFromList = (project) => {
    if (suppressProjectOpenRef.current) {
      suppressProjectOpenRef.current = false;
      return;
    }
    openProjectDetails(project);
  };

  const openProjectDetailsFromActionSheet = (project, tab = "overview") => {
    if (!project?.id) return;
    setMobileProjectActionTarget(null);
    setMobileDeleteArmed(false);
    openProjectDetails(project);
    setDetailTab(tab);
  };

  useEffect(
    () => () => {
      if (!projectLongPressTimerRef.current) return;
      window.clearTimeout(projectLongPressTimerRef.current);
      projectLongPressTimerRef.current = null;
    },
    []
  );

  const handleEditSelectedProject = () => {
    if (selectedProjects.length !== 1) return;
    openEditProjectModal(selectedProjects[0]);
  };

  const requestSelectedProjectsVisibility = (nextVisible) => {
    if (!canCreateProject || !selectedProjects.length) return;
    const count = selectedProjects.length;
    setProjectActionConfirm({
      type: "visibility",
      projects: selectedProjects,
      nextVisible: Boolean(nextVisible),
      title: `${nextVisible ? "Show" : "Hide"} ${count} selected project${count === 1 ? "" : "s"}?`,
      subtitle: nextVisible
        ? "Selected projects will be visible in project views."
        : "Selected projects will be hidden from non-admin users.",
      confirmLabel: nextVisible ? "Show selected" : "Hide selected",
    });
  };

  const requestDeleteSelectedProjects = () => {
    if (!canCreateProject || !selectedProjects.length) return;
    const count = selectedProjects.length;
    setProjectActionConfirm({
      type: "delete",
      projects: selectedProjects,
      title: `Delete ${count} selected project${count === 1 ? "" : "s"}?`,
      subtitle:
        "This will permanently remove the selected projects and all associated activities and linked records. This cannot be undone.",
      confirmLabel: "Delete selected",
    });
  };

  if (loading) {
    return (
      <div className="projects-page-modern">
        <div className="page-header">
          <h1>IGA Projects</h1>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-page-modern">
      <div className="projects-toolbar">
        <label className="projects-toolbar-search" aria-label="Search projects">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search projects, category, status, or code"
            value={projectSearchQuery}
            onChange={(event) => setProjectSearchQuery(event.target.value)}
          />
          {projectSearchQuery ? (
            <button
              type="button"
              className="projects-toolbar-search-clear"
              onClick={() => setProjectSearchQuery("")}
              aria-label="Clear project search"
            >
              <Icon name="x" size={14} />
            </button>
          ) : null}
        </label>
        <div className="projects-toolbar-right">
          <div className="projects-view-toggle" role="tablist" aria-label="Project view">
            {PROJECT_VIEW_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`projects-view-btn${projectView === option.key ? " active" : ""}`}
                onClick={() => setProjectView(option.key)}
                role="tab"
                aria-selected={projectView === option.key}
              >
                <Icon name={option.icon} size={14} />
                <span className="projects-view-btn-label">{option.label}</span>
              </button>
            ))}
          </div>
          <label className="projects-filter-btn projects-filter-btn--select" aria-label="Sort projects">
            <Icon name="calendar" size={14} />
            <select value={projectSortKey} onChange={(event) => setProjectSortKey(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="progress_desc">Highest progress</option>
              <option value="budget_desc">Highest budget</option>
            </select>
          </label>
          {canAcceptProjectInvites ? (
            <button className="projects-filter-btn" type="button" onClick={openAcceptInviteModal}>
              <Icon name="mail" size={14} />
              <span className="projects-filter-btn-label">Accept invite</span>
            </button>
          ) : null}
          <div
            className="project-note-tools-menu projects-toolbar-tools-menu"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="projects-filter-btn projects-filter-btn--icon"
              aria-haspopup="menu"
              aria-expanded={showProjectsToolsMenu}
              aria-label="Project tools"
              onClick={handleToggleProjectsToolsMenu}
            >
              <Icon name="more-vertical" size={16} />
            </button>
            {showProjectsToolsMenu ? (
              <div className="project-note-tools-dropdown projects-toolbar-tools-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowProjectFilters((prev) => !prev);
                    setShowProjectsToolsMenu(false);
                  }}
                >
                  {showProjectFilters ? "Hide filters" : "Show filters"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    clearProjectFilters();
                    setShowProjectsToolsMenu(false);
                  }}
                  disabled={!hasActiveProjectFilters}
                >
                  Clear filters
                </button>
                {projectView !== "grid" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      handleToggleSelectAllVisible();
                      setShowProjectsToolsMenu(false);
                    }}
                    disabled={visibleProjectIds.length === 0}
                  >
                    {allVisibleSelected ? "Clear selected" : "Select all visible"}
                  </button>
                ) : null}
                {projectView !== "grid" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSelectedProjectIds([]);
                      setShowProjectsToolsMenu(false);
                    }}
                    disabled={selectedProjectIds.length === 0}
                  >
                    Clear selection
                  </button>
                ) : null}
                {canCreateProject && projectView !== "grid" ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        handleEditSelectedProject();
                        setShowProjectsToolsMenu(false);
                      }}
                      disabled={selectedProjects.length !== 1 || Boolean(projectActionInFlightId)}
                    >
                      Edit selected
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        requestSelectedProjectsVisibility(false);
                        setShowProjectsToolsMenu(false);
                      }}
                      disabled={selectedProjects.length === 0 || Boolean(projectActionInFlightId)}
                    >
                      Hide selected
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        requestSelectedProjectsVisibility(true);
                        setShowProjectsToolsMenu(false);
                      }}
                      disabled={selectedProjects.length === 0 || Boolean(projectActionInFlightId)}
                    >
                      Show selected
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="danger"
                      onClick={() => {
                        requestDeleteSelectedProjects();
                        setShowProjectsToolsMenu(false);
                      }}
                      disabled={selectedProjects.length === 0 || Boolean(projectActionInFlightId)}
                    >
                      Delete selected
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            className="projects-new-btn"
            type="button"
            onClick={openCreateProjectEntry}
            disabled={!canCreateProject}
            title={
              !canCreateProject ? "Only project managers and admins can create projects." : undefined
            }
          >
            <Icon name="plus" size={16} />
            <span className="projects-new-btn-label">New Project</span>
          </button>
        </div>
      </div>
      {showProjectFilters ? (
        <div className="project-detail-filters projects-toolbar-filters">
          <label className="project-detail-filter">
            <span>Status</span>
            <select value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
              {projectStatusOptions.map((option) => (
                <option key={`project-status-filter-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="project-detail-filter">
            <span>Category</span>
            <select
              value={projectCategoryFilter}
              onChange={(event) => setProjectCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {projectFilterCategoryOptions.map((option) => (
                <option key={`project-category-filter-${option}`} value={option.toLowerCase()}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="project-detail-filter">
            <span>Owner</span>
            <select value={projectOwnerFilter} onChange={(event) => setProjectOwnerFilter(event.target.value)}>
              <option value="all">All owners</option>
              <option value="mine">Mine</option>
              <option value="joined">Joined projects</option>
              <option value="unassigned">Unassigned</option>
              {projectOwnerOptions.map((option) => (
                <option key={`project-owner-filter-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="project-detail-filter project-detail-filter--actions">
            <button
              type="button"
              className="project-detail-action ghost"
              onClick={clearProjectFilters}
              disabled={!hasActiveProjectFilters}
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}
      {projectsNotice?.message ? (
        <p className={`projects-notice projects-notice--${projectsNotice.type || "warning"}`}>
          {projectsNotice.message}
        </p>
      ) : null}
      {showMemberPendingInvitesPanel ? (
        <section className="projects-member-invites" aria-label="Pending project invites">
          <div className="projects-member-invites-head">
            <h3>Pending project invites</h3>
            <button
              type="button"
              className="projects-member-invites-manual-btn"
              onClick={openAcceptInviteModal}
              disabled={acceptingProjectInvite}
            >
              Use invite number
            </button>
          </div>
          {memberPendingProjectInvitesError ? (
            <p className="projects-member-invites-error">{memberPendingProjectInvitesError}</p>
          ) : null}
          {memberPendingProjectInvitesLoading ? (
            <p className="projects-member-invites-empty">Loading your pending invites...</p>
          ) : null}
          {!memberPendingProjectInvitesLoading && !memberPendingProjectInvitesError ? (
            memberPendingProjectInvites.length ? (
              <div className="projects-member-invites-list">
                {memberPendingProjectInvites.map((invite) => {
                  const inviteId = String(invite?.id || invite?.invite_number || "");
                  const safeStatus = String(invite?.status || "pending")
                    .trim()
                    .toLowerCase();
                  const inviteNumber = String(invite?.invite_number || "").trim();
                  const isAccepting = acceptingPendingProjectInviteId === inviteId;
                  return (
                    <article
                      className="projects-member-invite-row"
                      key={`${inviteId || inviteNumber || "invite"}-${String(invite?.created_at || "")}`}
                    >
                      <div className="projects-member-invite-main">
                        <p className="projects-member-invite-projects">
                          {formatMemberPendingInviteProjects(invite)}
                        </p>
                        <div className="projects-member-invite-meta">
                          <span className={`project-invite-status is-${safeStatus}`}>
                            {formatInviteStatusLabel(invite?.status)}
                          </span>
                          <span>{toReadableLabel(invite?.role || "member", "Member")}</span>
                          <span>
                            {invite?.expires_at ? `Expires ${formatDate(invite.expires_at)}` : "No expiry"}
                          </span>
                        </div>
                      </div>
                      <div className="projects-member-invite-actions">
                        {inviteNumber ? (
                          <button
                            type="button"
                            className="project-invite-copy"
                            onClick={() => handleCopyInviteNumber(inviteNumber)}
                            title="Copy invite number"
                          >
                            {inviteNumber}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="projects-member-invite-accept-btn"
                          onClick={() => handleAcceptPendingProjectInvite(invite)}
                          disabled={isAccepting || acceptingProjectInvite}
                        >
                          {isAccepting ? "Accepting..." : "Accept"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="projects-member-invites-empty">No pending project invites.</p>
            )
          ) : null}
        </section>
      ) : null}
      {projectView !== "grid" && selectedProjectIds.length > 0 ? (
        <div className="projects-selection-actions">
          <span className="projects-selection-count">{selectedProjectIds.length} selected</span>
          {canCreateProject ? (
            <>
              <button
                type="button"
                className="projects-selection-btn"
                onClick={handleEditSelectedProject}
                disabled={selectedProjects.length !== 1 || Boolean(projectActionInFlightId)}
              >
                Edit selected
              </button>
              <button
                type="button"
                className="projects-selection-btn"
                onClick={() => requestSelectedProjectsVisibility(false)}
                disabled={Boolean(projectActionInFlightId)}
              >
                Hide selected
              </button>
              <button
                type="button"
                className="projects-selection-btn"
                onClick={() => requestSelectedProjectsVisibility(true)}
                disabled={Boolean(projectActionInFlightId)}
              >
                Show selected
              </button>
              <button
                type="button"
                className="projects-selection-btn danger"
                onClick={requestDeleteSelectedProjects}
                disabled={Boolean(projectActionInFlightId)}
              >
                Delete selected
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="projects-selection-btn ghost"
            onClick={() => setSelectedProjectIds([])}
            disabled={Boolean(projectActionInFlightId)}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {visibleProjects.length === 0 ? (
        <div className="empty-state">
          <Icon name="folder" size={48} />
          <h3>No projects yet</h3>
          <p>IGA projects will appear here once they are created.</p>
        </div>
      ) : (
        <>
          {projectView === "grid" ? (
            <div className="projects-card-grid">
              {visibleProjects.map((project) => {
                const projectId = normalizeProjectId(project?.id);
                const isProjectMenuOpen = String(openProjectMenuId ?? "") === String(project?.id ?? "");
                const progressValue = getProjectProgress(project);
                const avatarLetters = getAvatarLetters(project);
                const extraMembers = Math.max((project.member_count || 0) - avatarLetters.length, 0);
                const canJoin = !project.membership && canSelfManageMembership;
                const isVisible = project?.is_visible !== false;
                return (
                  <article
                    className={`project-card-elevated${isVisible ? "" : " project-card-elevated--hidden"}${
                      isProjectMenuOpen ? " project-card-elevated--menu-open" : ""
                    }`}
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProjectDetailsFromList(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openProjectDetails(project);
                    }}
                    onTouchStart={() => handleProjectLongPressStart(projectId)}
                    onTouchMove={handleProjectLongPressCancel}
                    onTouchEnd={handleProjectLongPressCancel}
                    onTouchCancel={handleProjectLongPressCancel}
                  >
                    {renderProjectActionMenu(project)}
                    <div className="project-card-hero">
                      <span className="project-pill project-pill--category">{getProjectCategory(project)}</span>
                      <span className="project-pill project-pill--status">
                        <span className="status-dot" style={{ background: getStatusColor(project.status, isVisible) }}></span>
                        {isVisible ? project.status || "Active" : "Hidden"}
                      </span>
                      <img src={getProjectImage(project)} alt={`${project.name} cover`} loading="lazy" />
                    </div>
                    <div className="project-card-body">
                      <div className="project-card-title">
                        {canCreateProject && !isMobileProjectViewport ? (
                          <button
                            type="button"
                            className="project-card-title-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditProjectModal(project);
                            }}
                          >
                            {project.name}
                          </button>
                        ) : (
                          <h3>{project.name}</h3>
                        )}
                        <p>{getProjectSubtitle(project)}</p>
                      </div>
                      <div className="project-card-meta">
                        <span>
                          <Icon name="calendar" size={14} />
                          Started: {formatDate(project.start_date)}
                        </span>
                        <span>
                          <Icon name="member" size={14} />
                          {project.member_count || 0} members
                        </span>
                      </div>
                      <div className="project-card-progress">
                        <div className="project-progress-track">
                          <span style={{ width: `${progressValue}%` }}></span>
                        </div>
                        <span className="project-progress-value">{progressValue}%</span>
                      </div>
                      <div className="project-card-actions">
                        {canJoin ? (
                          <button
                            className="project-btn-secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleJoin(project.id);
                            }}
                          >
                            Join
                          </button>
                        ) : (
                          <div className="project-card-avatars">
                            {avatarLetters.map((letter, index) => (
                              <span className="project-avatar" key={`${project.id}-avatar-${index}`}>
                                {letter}
                              </span>
                            ))}
                            {extraMembers > 0 && (
                              <span className="project-avatar project-avatar-more">+{extraMembers}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {projectView === "table" ? (
            <div className="projects-table-wrap">
              <table className="projects-table-view projects-main-table">
                <thead>
                  <tr>
                    <th className="projects-table-check">
                      <input
                        type="checkbox"
                        aria-label="Select all visible projects"
                        checked={allVisibleSelected}
                        onChange={handleToggleSelectAllVisible}
                      />
                    </th>
                    <th className="projects-main-col-project">Project</th>
                    <th className="projects-main-col-category">Category</th>
                    <th className="projects-main-col-start">Start date</th>
                    <th className="projects-main-col-status">Status</th>
                    <th className="projects-main-col-members">Members</th>
                    <th className="projects-main-col-budget">Budget</th>
                    <th className="projects-main-col-revenue">Funding</th>
                  </tr>
                </thead>
                <tbody>
              {visibleProjects.map((project) => {
                    const projectId = normalizeProjectId(project?.id);
                    const isChecked = selectedProjectIds.includes(projectId);
                    const isVisible = project?.is_visible !== false;
                    const budgetAmount = getProjectBudgetAmount(project);
                    const revenueAmount = getProjectRevenueAmount(project);
                    return (
                      <tr
                        key={project.id}
                        className={!isVisible ? "is-hidden" : ""}
                        onClick={() => openProjectDetailsFromList(project)}
                        onTouchStart={() => handleProjectLongPressStart(projectId)}
                        onTouchMove={handleProjectLongPressCancel}
                        onTouchEnd={handleProjectLongPressCancel}
                        onTouchCancel={handleProjectLongPressCancel}
                      >
                        <td
                          className="projects-table-check"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleProjectSelection(projectId)}
                            aria-label={`Select ${project.name}`}
                          />
                        </td>
                        <td className="projects-main-col-project">
                          <div className="projects-table-main">
                            <img src={getProjectImage(project)} alt={`${project.name} cover`} loading="lazy" />
                            <div className="projects-table-main-copy">
                              <div className="projects-table-main-head">
                                <strong>{project.name}</strong>
                              </div>
                              <p>{getProjectSubtitle(project)}</p>
                            </div>
                            <div
                              className="projects-table-main-more"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {renderProjectActionMenu(project, "inline")}
                            </div>
                          </div>
                        </td>
                        <td className="projects-main-col-category">{getProjectCategory(project)}</td>
                        <td className="projects-main-col-start">{formatDate(project.start_date)}</td>
                        <td className="projects-main-col-status">{isVisible ? project.status || "Active" : "Hidden"}</td>
                        <td className="projects-main-col-members">{project.member_count || 0}</td>
                        <td className="projects-table-money projects-main-col-budget">{formatCurrency(budgetAmount)}</td>
                        <td className="projects-table-money projects-main-col-revenue">{formatCurrency(revenueAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {projectView === "list" ? (
            <div className="projects-list-view">
              {visibleProjects.map((project) => {
                const projectId = normalizeProjectId(project?.id);
                const isChecked = selectedProjectIds.includes(projectId);
                const isVisible = project?.is_visible !== false;
                const budgetAmount = getProjectBudgetAmount(project);
                const revenueAmount = getProjectRevenueAmount(project);
                return (
                  <article
                    className={`projects-list-item${isVisible ? "" : " is-hidden"}`}
                    key={project.id}
                    onClick={() => openProjectDetailsFromList(project)}
                    onTouchStart={() => handleProjectLongPressStart(projectId)}
                    onTouchMove={handleProjectLongPressCancel}
                    onTouchEnd={handleProjectLongPressCancel}
                    onTouchCancel={handleProjectLongPressCancel}
                  >
                    <div className="projects-list-select" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleProjectSelection(projectId)}
                        aria-label={`Select ${project.name}`}
                      />
                    </div>
                    <div className="projects-list-media">
                      <img src={getProjectImage(project)} alt={`${project.name} cover`} loading="lazy" />
                    </div>
                    <div className="projects-list-content">
                      <h4>{project.name}</h4>
                      <p>{getProjectSubtitle(project)}</p>
                      <div className="projects-list-meta">
                        <span>
                          <Icon name="calendar" size={14} />
                          {formatDate(project.start_date)}
                        </span>
                        <span>
                          <Icon name="member" size={14} />
                          {project.member_count || 0} members
                        </span>
                        <span className={`projects-table-status${isVisible ? "" : " hidden"}`}>
                          {isVisible ? project.status || "Active" : "Hidden"}
                        </span>
                        <span>
                          <Icon name="coins" size={14} />
                          {formatCurrency(budgetAmount)}
                        </span>
                        <span>
                          <Icon name="trending-up" size={14} />
                          {formatCurrency(revenueAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="projects-list-menu" onClick={(event) => event.stopPropagation()}>
                      {renderProjectActionMenu(project, "inline")}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      {canCreateProject ? (
        <button
          type="button"
          className="dashboard-page-fab"
          onClick={openCreateProjectEntry}
          aria-label="Add project"
        >
          <Icon name="plus" size={20} />
        </button>
      ) : null}

      {showCreateProjectActionSheet ? (
        <div
          className="project-action-sheet-overlay"
          onClick={closeCreateProjectActionSheet}
          role="presentation"
        >
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create project options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => handleCreateProjectActionSelect("manual")}
            >
              Create project manually
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => handleCreateProjectActionSelect("template")}
            >
              Import project template
            </button>
            <hr />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={closeCreateProjectActionSheet}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <DataModal
        open={showCreateModal}
        onClose={closeCreateProjectModal}
        title={isEditingProject ? "Edit Project" : "New Project"}
        subtitle={
          isEditingProject
            ? "Update project details, members, budget, and media."
            : "Add a new income-generating activity for your group."
        }
        icon="briefcase"
        className="project-submodal project-editor-modal"
        bodyClassName="project-editor-modal-body"
      >
        {loadingProjectEditor ? (
          <div className="projects-editor-loading">
            <div className="loading-spinner"></div>
            <p>Loading project details...</p>
          </div>
        ) : (
        <ProjectEditorForm
          activeTab={activeTab}
          onTabChange={handleProjectEditorTabChange}
          form={createProjectForm}
          categoryOptions={projectCategoryOptions}
          onFieldChange={updateCreateProjectField}
          onGenerateSummary={handleGenerateProjectSummary}
          createProjectError={createProjectError}
          onSubmit={handleCreateProjectSubmit}
          onCancel={closeCreateProjectModal}
          creatingProject={creatingProject}
          isEditingProject={isEditingProject}
          membersLoading={membersLoading}
          memberDirectory={memberDirectory}
          primaryContact={primaryContact}
          selectedMemberOptions={selectedMemberOptions}
          selectedAdditionalMembers={selectedAdditionalMembers}
          onAddMemberSelection={handleAddMemberSelection}
          onRemoveSelectedMember={handleRemoveSelectedMember}
          selectedExistingMedia={selectedExistingMedia}
          onRemoveExistingMedia={handleRemoveExistingMedia}
          onMediaFileSelection={handleMediaFileSelection}
          selectedMediaFiles={selectedMediaFiles}
          onRemoveMediaFile={handleRemoveMediaFile}
          getFileFingerprint={getFileFingerprint}
          formatFileSize={formatFileSize}
        />
        )}
      </DataModal>

      <ResponseModal
        open={showResponseModal}
        onClose={closeResponseModal}
        type={responseData.type}
        title={responseData.title}
        message={responseData.message}
        code={responseData.code}
        actions={
          responseData.type === "error"
            ? [{ label: "Close", variant: "primary", onClick: closeResponseModal }]
            : []
        }
      />

      <DataModal
        open={Boolean(projectActionConfirm)}
        onClose={closeProjectActionConfirm}
        title={projectActionConfirm?.title || "Confirm action"}
        subtitle={projectActionConfirm?.subtitle || ""}
        icon={projectActionConfirm?.type === "delete" ? "alert" : "vision"}
      >
        <div className="projects-confirm-modal">
          <p>
            This change affects project visibility and management actions immediately.
          </p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeProjectActionConfirm}
              disabled={Boolean(projectActionInFlightId)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`data-modal-btn ${projectActionConfirm?.type === "delete" ? "data-modal-btn--danger" : "data-modal-btn--primary"}`}
              onClick={handleConfirmProjectAction}
              disabled={Boolean(projectActionInFlightId)}
            >
              {projectActionInFlightId
                ? "Working..."
                : projectActionConfirm?.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={Boolean(selectedProject)}
        onClose={closeProjectDetails}
        title={selectedProject?.name || "Project details"}
        subtitle={selectedProject ? getProjectSubtitle(selectedProject) : ""}
        icon="briefcase"
        className="project-submodal project-detail-modal"
        bodyClassName="project-detail-body"
        hideHeader={isMobileProjectViewport}
      >
        {selectedProject && (
          <div className="project-detail-layout project-detail-layout--expenses">
            <div className="project-detail-center">
              {isMobileProjectViewport ? (
                <div className="project-detail-mobile-header">
                  <button
                    type="button"
                    className="project-detail-mobile-back-btn"
                    onClick={closeProjectDetails}
                    aria-label="Back to projects"
                  >
                    <Icon name="arrow-left" size={16} />
                  </button>
                  <strong>{selectedProject?.name || "Project"}</strong>
                  <button
                    type="button"
                    className="project-detail-mobile-more-btn"
                    onClick={openProjectActionSheet}
                    aria-label="Project actions"
                  >
                    <Icon name="more-horizontal" size={16} />
                  </button>
                </div>
              ) : null}
              {isMobileProjectViewport ? (
                <div className="project-detail-mobile-pills" role="tablist" aria-label="Project actions">
                  {PROJECT_MOBILE_PILLS.map((pill) => (
                    <button
                      key={`mobile-pill-${pill.key}`}
                      type="button"
                      className={`project-detail-mobile-pill${
                        activeProjectMobilePill === pill.key ? " active" : ""
                      }`}
                      onClick={() => handleMobileProjectPillClick(pill.key)}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="project-detail-tabs" role="tablist">
                {projectDetailTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`project-detail-tab${detailTab === tab ? " active" : ""}`}
                    onClick={() => setDetailTab(tab)}
                  >
                    {PROJECT_DETAIL_TAB_META[tab]?.label || tab}
                  </button>
                ))}
              </div>
              <div className="project-detail-panel">
                {detailTab === "overview" && (
                  <div className="project-detail-section project-overview-modern">
                    <div className="project-overview-head">
                      <div>
                        <h4>Project summary</h4>
                        <p>{getProjectLead(selectedProject)}</p>
                      </div>
                      <span
                        className={`project-overview-status-badge is-${String(
                          selectedProject?.status || "active"
                        )
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}`}
                      >
                        {String(selectedProject?.status || "active")
                          .replace(/[_-]+/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                      </span>
                    </div>

                    <div className="project-overview-kpi-grid">
                      <article className="project-overview-kpi-card">
                        <span className="project-overview-kpi-label">Progress</span>
                        <strong>{formatPercentLabel(projectOverviewAnalytics.progressPercent)}</strong>
                        <small>{projectOverviewAnalytics.taskTotals.done} tasks done</small>
                      </article>
                      <article className="project-overview-kpi-card">
                        <span className="project-overview-kpi-label">Budget used</span>
                        <strong>{formatPercentLabel(projectOverviewAnalytics.budgetSpentPercent)}</strong>
                        <small>{formatCurrency(projectOverviewAnalytics.spentAmount)} spent</small>
                      </article>
                      <article className="project-overview-kpi-card">
                        <span className="project-overview-kpi-label">Expense proof</span>
                        <strong>{formatPercentLabel(projectOverviewAnalytics.expenseProofPercent)}</strong>
                        <small>{projectOverviewAnalytics.expensesCount} recorded expenses</small>
                      </article>
                      <article className="project-overview-kpi-card">
                        <span className="project-overview-kpi-label">Documentation</span>
                        <strong>{projectOverviewAnalytics.documentsCount}</strong>
                        <small>{projectOverviewAnalytics.notesCount} notes captured</small>
                      </article>
                    </div>

                    <div className="project-overview-panel-grid">
                      <article
                        className="project-overview-panel project-overview-panel--interactive"
                        role="button"
                        tabIndex={0}
                        onClick={openBudgetSummaryReportModal}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openBudgetSummaryReportModal();
                          }
                        }}
                        aria-label={`Open project summary report for ${selectedProject?.name || "this project"}`}
                      >
                        <div className="project-overview-panel-head">
                          <h5>Budget health</h5>
                          <span>{formatPercentLabel(projectOverviewAnalytics.budgetSpentPercent)} used</span>
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
                                  strokeDasharray: `${projectOverviewAnalytics.budgetRingDash} ${projectOverviewAnalytics.ringCircumference}`,
                                  stroke: "#1d4ed8",
                                }}
                              />
                            </svg>
                            <span className="project-overview-ring-value">
                              {Math.round(projectOverviewAnalytics.budgetSpentPercent)}%
                            </span>
                          </div>
                          <div className="project-overview-stat-list">
                            <div className="project-overview-stat-item">
                              <span>Total budget</span>
                              <strong>{formatCurrency(projectOverviewAnalytics.budgetAmount)}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>Spent</span>
                              <strong>{formatCurrency(projectOverviewAnalytics.spentAmount)}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>Remaining</span>
                              <strong>{formatCurrency(projectOverviewAnalytics.remainingAmount)}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>Expected funding</span>
                              <strong>{formatCurrency(projectOverviewAnalytics.expectedRevenueAmount)}</strong>
                            </div>
                          </div>
                        </div>
                        <p className="project-overview-panel-link-hint">
                          <Icon name="trending-up" size={14} />
                          View full summary report
                        </p>
                      </article>

                      <article className="project-overview-panel">
                        <div className="project-overview-panel-head">
                          <h5>Task delivery</h5>
                          <span>{formatPercentLabel(projectOverviewAnalytics.taskCompletionPercent)} complete</span>
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
                                  strokeDasharray: `${projectOverviewAnalytics.taskRingDash} ${projectOverviewAnalytics.ringCircumference}`,
                                  stroke: "#0ea5e9",
                                }}
                              />
                            </svg>
                            <span className="project-overview-ring-value">
                              {Math.round(projectOverviewAnalytics.taskCompletionPercent)}%
                            </span>
                          </div>
                          <div className="project-overview-stat-list">
                            <div className="project-overview-stat-item">
                              <span>Total tasks</span>
                              <strong>{projectOverviewAnalytics.totalTasks}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>In progress</span>
                              <strong>{projectOverviewAnalytics.taskTotals.in_progress}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>Overdue</span>
                              <strong>{projectOverviewAnalytics.overdueTaskCount}</strong>
                            </div>
                            <div className="project-overview-stat-item">
                              <span>High priority</span>
                              <strong>{projectOverviewAnalytics.highPriorityActiveTaskCount}</strong>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>

                    <div className="project-overview-range-row">
                      <span className="project-overview-range-label">Chart range</span>
                      <div className="project-overview-range-toggle" role="group" aria-label="Overview chart range">
                        {PROJECT_OVERVIEW_RANGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={`project-overview-range-btn${
                              overviewRange === option.value ? " active" : ""
                            }`}
                            onClick={() => setOverviewRange(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="project-overview-panel-grid project-overview-panel-grid--secondary">
                      <article className="project-overview-panel">
                        <div className="project-overview-panel-head">
                          <h5>Expense trend ({projectOverviewAnalytics.trendWindowLabel})</h5>
                          <span>
                            {formatPercentLabel(projectOverviewAnalytics.trendDeltaPercent)}{" "}
                            {projectOverviewAnalytics.trendDeltaLabel}
                          </span>
                        </div>
                        <div className="project-overview-trend-chart">
                          {projectOverviewAnalytics.trendBuckets.map((bucket) => {
                            const barHeight =
                              projectOverviewAnalytics.trendMaxAmount > 0
                                ? Math.max(
                                    8,
                                    (Number(bucket?.amount || 0) / projectOverviewAnalytics.trendMaxAmount) * 118
                                  )
                                : 8;
                            const safeAmount = Number(bucket?.amount || 0);
                            return (
                              <div className="project-overview-trend-col" key={bucket.key}>
                                <span className="project-overview-trend-value">{formatCurrency(safeAmount)}</span>
                                <div className="project-overview-trend-track">
                                  <span
                                    className={`project-overview-trend-bar${safeAmount > 0 ? "" : " is-zero"}`}
                                    style={{ height: `${barHeight}px` }}
                                  />
                                </div>
                                <span className="project-overview-trend-label">{bucket.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </article>

                      <article className="project-overview-panel">
                        <div className="project-overview-panel-head">
                          <h5>Spending mix</h5>
                          <span>
                            {projectOverviewAnalytics.rangeExpensesCount} expense
                            {projectOverviewAnalytics.rangeExpensesCount === 1 ? "" : "s"} in range
                          </span>
                        </div>
                        {projectOverviewAnalytics.topExpenseCategories.length ? (
                          <div className="project-overview-category-list">
                            {projectOverviewAnalytics.topExpenseCategories.map((item) => {
                              const widthPercent =
                                projectOverviewAnalytics.topExpenseCategoryMax > 0
                                  ? (item.amount / projectOverviewAnalytics.topExpenseCategoryMax) * 100
                                  : 0;
                              return (
                                <div className="project-overview-category-item" key={item.category}>
                                  <div className="project-overview-category-head">
                                    <span>{item.category}</span>
                                    <strong>{formatCurrency(item.amount)}</strong>
                                  </div>
                                  <div className="project-overview-category-track">
                                    <span style={{ width: `${clampPercent(widthPercent)}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="project-detail-empty">
                            <Icon name="receipt" size={20} />
                            <span>No expense categories in the selected range.</span>
                          </div>
                        )}
                      </article>
                    </div>
                  </div>
                )}
                {detailTab === "expenses" && (
                  <div className="project-detail-section project-detail-expenses">
                    <div className="project-detail-section-head">
                      <div className="project-expense-section-title">
                        <h4>Project Expenses</h4>
                        {!isMobileProjectViewport ? (
                          <span className="project-expense-section-subtitle">
                            {selectedProject?.name || "Project"} ·{" "}
                            {formatPercentLabel(projectOverviewAnalytics.progressPercent)} progress ·{" "}
                            {projectExpenseInsights.expenseCount} expense
                            {projectExpenseInsights.expenseCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                      {!isMobileProjectViewport ? (
                        <div className="project-detail-section-head-actions project-expense-head-actions">
                          {canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action icon-only project-expense-head-action"
                              onClick={openExpenseModal}
                              disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                              aria-label="Add expense"
                            >
                              <Icon name="plus" size={16} />
                              <span className="project-expense-head-action-tooltip" role="tooltip">
                                Add expense
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="project-detail-action ghost icon-only project-expense-head-action"
                            onClick={handleExportVisibleExpensesCsv}
                            disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                            aria-label="Export shown expenses as CSV"
                          >
                            <Icon name="download" size={16} />
                            <span className="project-expense-head-action-tooltip" role="tooltip">
                              Export CSV
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {canManageProjectContent ? (
                      <input
                        ref={expenseReceiptInputRef}
                        type="file"
                        className="project-documents-file-input"
                        accept={PROJECT_EXPENSE_RECEIPT_ACCEPT}
                        onChange={handleSelectedExpenseReceiptFileSelection}
                        disabled={uploadingExpenseReceipt || savingExpense || deletingExpenses}
                      />
                    ) : null}
                    {!isMobileProjectViewport ? (
                      <div className="project-expense-summary-strip">
                        <article className="project-expense-summary-card">
                          <span>Budget</span>
                          <strong>{formatCurrency(projectOverviewAnalytics.budgetAmount)}</strong>
                        </article>
                        <article className="project-expense-summary-card">
                          <span>Spent</span>
                          <strong>{formatCurrency(projectOverviewAnalytics.spentAmount)}</strong>
                        </article>
                        <article className="project-expense-summary-card">
                          <span>Bal</span>
                          <strong>{formatCurrency(projectOverviewAnalytics.remainingAmount)}</strong>
                        </article>
                        <article className="project-expense-summary-card">
                          <span>Proof</span>
                          <strong>{formatPercentLabel(projectOverviewAnalytics.expenseProofPercent)}</strong>
                        </article>
                      </div>
                    ) : null}
                    {!isMobileProjectViewport && canManageProjectContent && selectedExpenseIds.length > 0 ? (
                      <div className="project-expense-desktop-bulk">
                        <strong>{selectedExpenseIds.length} selected</strong>
                        <div className="project-expense-desktop-bulk-actions">
                          <button
                            type="button"
                            className="project-detail-action ghost"
                            onClick={openEditSelectedExpenseModal}
                            disabled={
                              selectedExpenses.length !== 1 ||
                              savingExpense ||
                              deletingExpenses ||
                              uploadingExpenseReceipt
                            }
                          >
                            Edit selected
                          </button>
                          <button
                            type="button"
                            className="project-detail-action ghost"
                            onClick={triggerSelectedExpenseReceiptPicker}
                            disabled={
                              selectedExpenses.length !== 1 ||
                              savingExpense ||
                              deletingExpenses ||
                              uploadingExpenseReceipt
                            }
                          >
                            {uploadingExpenseReceipt ? "Uploading..." : "Upload receipt"}
                          </button>
                          <button
                            type="button"
                            className="project-detail-action ghost"
                            onClick={handleExportSelectedExpensesCsv}
                            disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                          >
                            Export selected
                          </button>
                          <button
                            type="button"
                            className="project-detail-action ghost danger"
                            onClick={requestDeleteSelectedExpenses}
                            disabled={deletingExpenses || savingExpense || uploadingExpenseReceipt}
                          >
                            Delete selected
                          </button>
                          <button
                            type="button"
                            className="project-detail-action ghost"
                            onClick={handleClearExpenseSelection}
                            disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {isMobileProjectViewport ? (
                      <>
                        <div className="project-mobile-finance-summary">
                          <article>
                            <span>Budget</span>
                            <strong>{formatCurrency(projectOverviewAnalytics.budgetAmount)}</strong>
                          </article>
                          <article>
                            <span>Spent</span>
                            <strong>{formatCurrency(projectOverviewAnalytics.spentAmount)}</strong>
                          </article>
                          <article>
                            <span>Bal</span>
                            <strong>{formatCurrency(projectOverviewAnalytics.remainingAmount)}</strong>
                          </article>
                        </div>
                        {canManageProjectContent && selectedExpenseIds.length > 0 ? (
                          <div className="project-expense-mobile-selection">
                            <strong>
                              {selectedExpenseIds.length} selected
                            </strong>
                            <div className="project-expense-mobile-selection-actions">
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={handleApproveSelectedExpenses}
                                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                              >
                                Bulk approve
                              </button>
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={handleExportSelectedExpensesCsv}
                                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                              >
                                Export
                              </button>
                              <button
                                type="button"
                                className="project-detail-action ghost danger"
                                onClick={requestDeleteSelectedExpenses}
                                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={handleClearExpenseSelection}
                                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {projectExpensesError ? (
                      <p className="project-detail-expense-error">{projectExpensesError}</p>
                    ) : null}
                    {projectExpensesLoading ? (
                      <div className="project-expenses-loading">
                        <div className="loading-spinner"></div>
                        <span>Loading expenses...</span>
                      </div>
                    ) : projectExpenses.length === 0 ? (
                      <div className="project-detail-empty">
                        <Icon name="receipt" size={24} />
                        <span>No expenses recorded yet.</span>
                        {isMobileProjectViewport ? (
                          <p>Start tracking project spending.</p>
                        ) : null}
                        {isMobileProjectViewport && canManageProjectContent ? (
                          <button type="button" className="project-detail-action" onClick={openExpenseModal}>
                            Add Expense
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        {isMobileProjectViewport ? (
                          <div className="project-expense-mobile-list" role="list">
                            {visibleProjectExpenses.map((expense) => {
                              const expenseId = String(expense?.id ?? "");
                              const isSelected = selectedExpenseIds.includes(expenseId);
                              const categoryLabel = String(expense?.category || "Other").trim() || "Other";
                              const categoryTone = getProjectExpenseCategoryTone(categoryLabel);
                              const categoryIcon = getProjectExpenseCategoryIcon(categoryLabel);
                              const parsed = parseExpenseDescriptionForForm(expense?.description, categoryLabel);
                              const detailTitle =
                                String(parsed.title || "").trim() || categoryLabel || `Expense #${expenseId || "-"}`;
                              const vendorLabel = String(expense?.vendor || "").trim();
                              return (
                                <div
                                  key={expenseId || `${detailTitle}-${expense?.expense_date || ""}`}
                                  className={`project-expense-mobile-item${isSelected ? " is-selected" : ""}`}
                                  onClick={() => handleExpenseRowActivate(expense)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleExpenseRowActivate(expense);
                                    }
                                  }}
                                  onTouchStart={() => handleExpensePressStart(expenseId)}
                                  onTouchEnd={handleExpensePressEnd}
                                  onTouchCancel={handleExpensePressEnd}
                                  onTouchMove={handleExpensePressEnd}
                                  onContextMenu={(event) => event.preventDefault()}
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={canManageProjectContent ? isSelected : undefined}
                                >
                                  <span className={`project-expense-mobile-item-icon tone-${categoryTone}`} aria-hidden="true">
                                    <Icon name={categoryIcon} size={16} />
                                  </span>
                                  <span className="project-expense-mobile-item-main">
                                    <span className="project-expense-mobile-item-head">
                                      <strong className="project-expense-mobile-item-title">
                                        {truncateProjectCellText(detailTitle, 74)}
                                      </strong>
                                      <strong className="project-expense-mobile-item-amount">
                                        {formatCurrency(expense?.amount)}
                                      </strong>
                                    </span>
                                    <span className="project-expense-mobile-item-sub">{categoryLabel}</span>
                                    <span className="project-expense-mobile-item-meta">
                                      {vendorLabel || "No vendor"} · {formatShortDate(expense?.expense_date || expense?.created_at)}
                                    </span>
                                  </span>
                                  {canManageProjectContent ? (
                                    <button
                                      type="button"
                                      className="project-expense-mobile-item-menu"
                                      onTouchStart={(event) => event.stopPropagation()}
                                      onTouchEnd={(event) => event.stopPropagation()}
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openExpenseActionSheet(expense);
                                      }}
                                      aria-label={`Expense actions for ${detailTitle}`}
                                    >
                                      <Icon name="more-vertical" size={14} />
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            {projectExpenses.length > recentProjectExpenses.length ? (
                              <div className="project-expenses-selection-note">
                                Showing {recentProjectExpenses.length} most recent expenses.
                              </div>
                            ) : null}
                            <div className="projects-table-wrap project-expenses-table-wrap">
                              <table className="projects-table-view project-expenses-table">
                                <thead>
                                  <tr>
                                    {canManageProjectContent ? (
                                      <th className="projects-table-check">
                                        <input
                                          type="checkbox"
                                          checked={allExpensesSelected}
                                          onChange={handleToggleSelectAllExpenses}
                                          aria-label="Select all project expenses"
                                        />
                                      </th>
                                    ) : null}
                                    <th className="project-expense-col-detail">Expense details</th>
                                    <th className="project-expense-col-date">Date</th>
                                    <th className="project-expense-col-category">Category</th>
                                    <th className="project-expense-col-vendor">Vendor</th>
                                    <th className="project-expense-col-amount">Amount</th>
                                    <th className="project-expense-col-receipt">Receipt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {recentProjectExpenses.map((expense) => {
                                    const expenseId = String(expense?.id ?? "");
                                    const isChecked = selectedExpenseIds.includes(expenseId);
                                    const categoryLabel = String(expense?.category || "Other").trim() || "Other";
                                    const categoryTone = getProjectExpenseCategoryTone(categoryLabel);
                                    const categoryIcon = getProjectExpenseCategoryIcon(categoryLabel);
                                    const detailTitle =
                                      String(expense?.description || "").trim() ||
                                      categoryLabel ||
                                      `Expense #${expenseId || "-"}`;
                                    const detailTitleTrimmed = truncateProjectCellText(detailTitle, 82);
                                    return (
                                      <tr
                                        key={expenseId || `${detailTitle}-${expense?.expense_date || ""}`}
                                        className="project-expense-row"
                                      >
                                        {canManageProjectContent ? (
                                          <td className="projects-table-check">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleExpenseSelection(expenseId)}
                                              aria-label={`Select expense ${detailTitle}`}
                                            />
                                          </td>
                                        ) : null}
                                        <td className="project-expense-col-detail">
                                          <div className="project-expense-main">
                                            <div className="project-expense-detail">
                                              <strong className="project-row-title" title={detailTitle}>
                                                {detailTitleTrimmed}
                                              </strong>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="project-expense-date project-expense-col-date">{formatDate(expense?.expense_date)}</td>
                                        <td className="project-expense-col-category">
                                          <span
                                            className={`project-expense-category-pill project-expense-tone-${categoryTone}`}
                                          >
                                            <span className="project-expense-category-pill-icon" aria-hidden="true">
                                              <Icon name={categoryIcon} size={12} />
                                            </span>
                                            <span className="project-expense-category-pill-label">{categoryLabel}</span>
                                          </span>
                                        </td>
                                        <td className="project-expense-vendor-cell project-expense-col-vendor">
                                          <ProjectExpenseVendorCell
                                            expense={expense}
                                            partnerByName={expensePartnerByName}
                                          />
                                        </td>
                                        <td className="projects-table-money project-expense-amount project-expense-col-amount">
                                          {formatCurrency(expense?.amount)}
                                        </td>
                                        <td className="project-expense-col-receipt">
                                          <div className="project-expense-receipt-cell">
                                            {expense?.receipt_download_url ? (
                                              <a
                                                className="project-expense-receipt-link"
                                                href={expense.receipt_download_url}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                Open
                                              </a>
                                            ) : expense?.receipt_storage_missing ? (
                                              <span className="projects-table-status hidden">
                                                Missing file
                                              </span>
                                            ) : (
                                              <span
                                                className={`projects-table-status${
                                                  hasExpenseProof(expense) ? "" : " hidden"
                                                }`}
                                              >
                                                {hasExpenseProof(expense) ? "Available" : "Missing"}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {detailTab === "files" && (
                  <div className="project-detail-section project-detail-files">
                    <div className="project-detail-section-head">
                      <h4>Files</h4>
                      <div className="project-detail-section-head-actions">
                        {canManageProjectContent ? (
                          <>
                            <input
                              ref={projectDocumentInputRef}
                              type="file"
                              className="project-documents-file-input"
                              onChange={handleProjectDocumentFileSelection}
                              disabled={uploadingProjectDocument || deletingDocuments || renamingDocument}
                            />
                            <button
                              type="button"
                              className="project-detail-action"
                              onClick={triggerProjectDocumentPicker}
                              disabled={uploadingProjectDocument || deletingDocuments || renamingDocument}
                            >
                              {uploadingProjectDocument ? "Uploading..." : "Upload"}
                            </button>
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={openNoteModal}
                              disabled={savingNote || deletingNotes}
                            >
                              Add note
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {projectDocumentsError || projectNotesError ? (
                      <p className="project-detail-expense-error">{projectDocumentsError || projectNotesError}</p>
                    ) : null}
                    {projectDocumentsLoading || projectNotesLoading ? (
                      <div className="project-expenses-loading">
                        <div className="loading-spinner"></div>
                        <span>Loading files...</span>
                      </div>
                    ) : mobileProjectFiles.length === 0 ? (
                      <div className="project-detail-empty">
                        <Icon name="folder" size={24} />
                        <span>No files yet.</span>
                      </div>
                    ) : (
                      <div className="project-files-merged-list">
                        {mobileProjectFiles.map((item) => (
                          <article className="project-files-merged-item" key={item.id}>
                            <div className="project-files-merged-copy">
                              <strong>{item.title}</strong>
                              <span>
                                {item.type === "document" ? "Document" : "Note"} · {item.subtitle} · {item.secondary}
                              </span>
                              {item.notePreview ? <p>{item.notePreview}</p> : null}
                            </div>
                            <div className="project-files-merged-action">
                              {item.type === "document" ? (
                                item.downloadUrl ? (
                                  <a href={item.downloadUrl} target="_blank" rel="noreferrer" className="project-documents-link">
                                    Open
                                  </a>
                                ) : (
                                  <span className="project-documents-link is-disabled">Unavailable</span>
                                )
                              ) : (
                                <button
                                  type="button"
                                  className="project-documents-link"
                                  onClick={() => setDetailTab("notes")}
                                >
                                  Open
                                </button>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {detailTab === "documents" && (
                  <div className="project-detail-section">
                    <div className="project-detail-section-head">
                      <h4>Documents</h4>
                      {!isMobileProjectViewport ? (
                        <div className="project-detail-section-head-actions">
                          {canManageProjectContent ? (
                            <div className="project-documents-mode" role="tablist" aria-label="Document action mode">
                              <button
                                type="button"
                                className={`project-documents-mode-btn${projectDocumentMode === "upload" ? " active" : ""}`}
                                onClick={() => setProjectDocumentMode("upload")}
                                disabled={
                                  uploadingProjectDocument ||
                                  deletingDocuments ||
                                  emittingProjectDocument ||
                                  renamingDocument
                                }
                                role="tab"
                                aria-selected={projectDocumentMode === "upload"}
                              >
                                Upload
                              </button>
                              <button
                                type="button"
                                className={`project-documents-mode-btn${projectDocumentMode === "emit" ? " active" : ""}`}
                                onClick={() => setProjectDocumentMode("emit")}
                                disabled={
                                  uploadingProjectDocument ||
                                  deletingDocuments ||
                                  emittingProjectDocument ||
                                  renamingDocument
                                }
                                role="tab"
                                aria-selected={projectDocumentMode === "emit"}
                              >
                                Emit
                              </button>
                            </div>
                          ) : (
                            <span>Read-only</span>
                          )}
                          {selectedDocumentIds.length === 1 && canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={openRenameSelectedDocumentModal}
                              disabled={
                                renamingDocument ||
                                deletingDocuments ||
                                uploadingProjectDocument ||
                                emittingProjectDocument
                              }
                            >
                              Rename selected
                            </button>
                          ) : null}
                          {selectedDocumentIds.length > 0 && canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action ghost danger"
                              onClick={requestDeleteSelectedDocuments}
                              disabled={
                                deletingDocuments ||
                                uploadingProjectDocument ||
                                emittingProjectDocument ||
                                renamingDocument
                              }
                            >
                              Delete selected
                            </button>
                          ) : null}
                          {canManageProjectContent && projectDocumentMode === "upload" ? (
                            <button
                              type="button"
                              className="project-detail-action"
                              onClick={triggerProjectDocumentPicker}
                              disabled={
                                uploadingProjectDocument ||
                                deletingDocuments ||
                                emittingProjectDocument ||
                                renamingDocument
                              }
                            >
                              {uploadingProjectDocument ? "Uploading..." : "Upload document"}
                            </button>
                          ) : canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action"
                              onClick={() => handlePrepareEmitDocument()}
                              disabled={
                                emittingProjectDocument ||
                                uploadingProjectDocument ||
                                deletingDocuments ||
                                renamingDocument
                              }
                            >
                              {emittingProjectDocument ? "Emitting..." : "Emit document"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <input
                      ref={projectDocumentInputRef}
                      type="file"
                      className="project-documents-file-input"
                      accept={PROJECT_DOCUMENT_ACCEPT}
                      multiple
                      onChange={handleProjectDocumentFileSelection}
                      disabled={
                        uploadingProjectDocument ||
                        deletingDocuments ||
                        emittingProjectDocument ||
                        renamingDocument
                      }
                    />
                    {isMobileProjectViewport ? (
                      <>
                        <div className="project-documents-mobile-mode" role="tablist" aria-label="Document view mode">
                          {MOBILE_PROJECT_DOCUMENT_MODE_OPTIONS.map((option) => (
                            <button
                              key={`mobile-doc-mode-${option.key}`}
                              type="button"
                              className={`project-documents-mobile-mode-btn${
                                mobileProjectDocumentMode === option.key ? " active" : ""
                              }`}
                              role="tab"
                              aria-selected={mobileProjectDocumentMode === option.key}
                              onClick={() => {
                                setMobileProjectDocumentMode(option.key);
                                setSelectedDocumentIds([]);
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className="project-documents-hint">
                          {mobileProjectDocumentMode === "reports"
                            ? "Generated reports from project templates."
                            : "Uploaded files and evidence for this project."}
                        </p>
                        {canManageProjectContent && selectedDocumentIds.length > 0 ? (
                          <div className="project-documents-mobile-selection">
                            <strong>{selectedDocumentIds.length} selected</strong>
                            <div className="project-documents-mobile-selection-actions">
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={handleExportSelectedDocuments}
                                disabled={deletingDocuments || uploadingProjectDocument || emittingProjectDocument}
                              >
                                Export
                              </button>
                              <button
                                type="button"
                                className="project-detail-action ghost danger"
                                onClick={requestDeleteSelectedDocuments}
                                disabled={deletingDocuments || uploadingProjectDocument || emittingProjectDocument}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={() => setSelectedDocumentIds([])}
                                disabled={deletingDocuments || uploadingProjectDocument || emittingProjectDocument}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {projectDocumentsError ? (
                          <p className="project-detail-expense-error">{projectDocumentsError}</p>
                        ) : null}
                        {projectDocumentsLoading ? (
                          <div className="project-expenses-loading">
                            <div className="loading-spinner"></div>
                            <span>Loading documents...</span>
                          </div>
                        ) : mobileVisibleProjectDocuments.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="folder" size={24} />
                            <span>
                              {mobileProjectDocumentMode === "reports"
                                ? "No generated reports yet."
                                : "No files yet."}
                            </span>
                          </div>
                        ) : (
                          <div className="project-documents-mobile-list" role="list">
                            {mobileVisibleProjectDocuments.map((document) => {
                              const documentId = String(document?.id ?? "");
                              const isSelected = selectedDocumentIds.includes(documentId);
                              const fileName = String(document?.name || "Untitled document").trim() || "Untitled document";
                              const uploadedLabel = formatDate(document?.uploaded_at);
                              const isReport = isGeneratedProjectReportDocument(document);
                              const metaLabel =
                                mobileProjectDocumentMode === "reports" ? `Generated ${uploadedLabel}` : uploadedLabel;
                              return (
                                <article
                                  key={documentId || `${fileName}-${document?.uploaded_at || ""}`}
                                  className={`project-documents-mobile-card${isSelected ? " is-selected" : ""}`}
                                  role="listitem"
                                  tabIndex={0}
                                  onClick={() => handleDocumentCardActivate(document)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleDocumentCardActivate(document);
                                    }
                                  }}
                                  onTouchStart={(event) => handleDocumentCardTouchStart(documentId, event)}
                                  onTouchMove={handleDocumentCardTouchMove}
                                  onTouchEnd={(event) => handleDocumentCardTouchEnd(document, event)}
                                  onTouchCancel={handleDocumentCardTouchCancel}
                                  onContextMenu={(event) => event.preventDefault()}
                                  aria-pressed={canManageProjectContent ? isSelected : undefined}
                                >
                                  <span
                                    className={`project-documents-mobile-icon${isReport ? " is-report" : ""}`}
                                    aria-hidden="true"
                                  >
                                    <Icon name={isReport ? "notes" : "folder"} size={16} />
                                  </span>
                                  <span className="project-documents-mobile-main">
                                    <strong>{truncateProjectCellText(fileName, 86)}</strong>
                                    <span>{metaLabel}</span>
                                  </span>
                                  <button
                                    type="button"
                                    className="project-documents-mobile-menu"
                                    onTouchStart={(event) => event.stopPropagation()}
                                    onTouchEnd={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openDocumentActionSheet(document);
                                    }}
                                    aria-label={`Document actions for ${fileName}`}
                                  >
                                    <Icon name="more-vertical" size={14} />
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : canManageProjectContent ? (
                      projectDocumentMode === "upload" ? (
                        <p className="project-documents-hint">
                          Allowed file types: <strong>.docx</strong>, <strong>.pdf</strong>, and image files.
                        </p>
                      ) : (
                        <div className="project-documents-emit">
                          <label className="project-detail-filter project-detail-filter--search">
                            <span>Document template</span>
                            <div className="project-detail-custom-select" ref={projectDocumentTemplateMenuRef}>
                              <button
                                type="button"
                                className={`project-detail-custom-select-trigger${projectDocumentTemplateMenuOpen ? " is-open" : ""}`}
                                onClick={() => {
                                  if (emittingProjectDocument || renamingDocument) return;
                                  setProjectDocumentTemplateMenuOpen((open) => !open);
                                }}
                                disabled={emittingProjectDocument || renamingDocument}
                                aria-haspopup="listbox"
                                aria-expanded={projectDocumentTemplateMenuOpen}
                              >
                                <span>{selectedEmitDocumentOption.label}</span>
                                <Icon name="chevron" size={16} />
                              </button>
                              {projectDocumentTemplateMenuOpen ? (
                                <div className="project-detail-custom-select-menu" role="listbox" aria-label="Document template">
                                  {PROJECT_EMIT_DOCUMENT_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      role="option"
                                      aria-selected={option.value === emitDocumentType}
                                      className={`project-detail-custom-select-option${option.value === emitDocumentType ? " is-active" : ""}`}
                                      onClick={() => {
                                        setEmitDocumentType(option.value);
                                        setProjectDocumentTemplateMenuOpen(false);
                                      }}
                                    >
                                      <span>{option.label}</span>
                                      {option.value === emitDocumentType ? <Icon name="check" size={14} /> : null}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </label>
                          <p className="project-documents-emit-note">
                            All templates emit generated PDFs using current project data and KPI summaries.
                          </p>
                        </div>
                      )
                    ) : (
                      <p className="project-documents-hint">You can view and download documents in this project.</p>
                    )}
                    {!isMobileProjectViewport ? (
                      <>
                        {projectDocumentsError ? (
                          <p className="project-detail-expense-error">{projectDocumentsError}</p>
                        ) : null}
                        {projectDocumentsLoading ? (
                          <div className="project-expenses-loading">
                            <div className="loading-spinner"></div>
                            <span>Loading documents...</span>
                          </div>
                        ) : projectDocuments.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="folder" size={24} />
                            <span>No documents yet.</span>
                          </div>
                        ) : (
                          <>
                            {canManageProjectContent ? (
                              <div className="project-expenses-selection-note">
                                {selectedDocumentIds.length} selected
                              </div>
                            ) : null}
                            <div className="projects-table-wrap project-expenses-table-wrap">
                              <table className="projects-table-view project-expenses-table project-documents-table">
                                <thead>
                                  <tr>
                                    {canManageProjectContent ? (
                                      <th className="projects-table-check">
                                        <input
                                          type="checkbox"
                                          checked={allDocumentsSelected}
                                          onChange={handleToggleSelectAllDocuments}
                                          aria-label="Select all project documents"
                                        />
                                      </th>
                                    ) : null}
                                    <th className="project-document-col-document">Document</th>
                                    <th className="project-document-col-type">Type</th>
                                    <th className="project-document-col-size">Size</th>
                                    <th className="project-document-col-uploaded">Uploaded</th>
                                    <th className="project-document-col-by">By</th>
                                    <th className="project-document-col-action">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedProjectDocuments.map((document) => {
                                    const documentId = String(document?.id ?? "");
                                    const isChecked = selectedDocumentIds.includes(documentId);
                                    const fileName = String(document?.name || "Untitled document").trim();
                                    const downloadUrl = String(document?.download_url || document?.file_url || "").trim();
                                    return (
                                      <tr key={documentId || fileName}>
                                        {canManageProjectContent ? (
                                          <td className="projects-table-check">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleDocumentSelection(documentId)}
                                              aria-label={`Select document ${fileName}`}
                                            />
                                          </td>
                                        ) : null}
                                        <td className="project-document-col-document">
                                          <div className="project-expense-detail project-document-detail">
                                            <strong className="project-row-title">{fileName}</strong>
                                            <p>{String(document?.file_path || "").split("/").pop() || "Stored document"}</p>
                                          </div>
                                        </td>
                                        <td className="project-document-col-type">{getProjectDocumentTypeLabel(document)}</td>
                                        <td className="project-document-col-size">{formatFileSize(document?.file_size_bytes)}</td>
                                        <td className="project-document-col-uploaded">{formatDate(document?.uploaded_at)}</td>
                                        <td className="project-document-col-by">{document?.uploader_name || "—"}</td>
                                        <td className="project-document-col-action">
                                          {downloadUrl ? (
                                            <a
                                              href={downloadUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="project-documents-link"
                                            >
                                              Open
                                            </a>
                                          ) : (
                                            <span className="project-documents-link is-disabled">Unavailable</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
                {detailTab === "tasks" && (
                  <div className="project-detail-section project-detail-tasks">
                    <div className="project-detail-section-head">
                      <h4>Tasks</h4>
                      {!isMobileProjectViewport ? (
                        <div className="project-detail-section-head-actions project-expense-head-actions">
                          {canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action icon-only project-expense-head-action"
                              onClick={openTaskModal}
                              disabled={savingTask || deletingTasks}
                              aria-label="Add task"
                            >
                              <Icon name="plus" size={16} />
                              <span className="project-expense-head-action-tooltip" role="tooltip">
                                Add task
                              </span>
                            </button>
                          ) : null}
                          <div
                            className="project-note-tools-menu"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className="project-group-row-action project-note-tools-menu-btn"
                              onClick={handleToggleTasksToolsMenu}
                              aria-haspopup="menu"
                              aria-expanded={showTasksToolsMenu}
                              aria-label="Task options"
                            >
                              <Icon name="more-vertical" size={15} />
                            </button>
                            {showTasksToolsMenu ? (
                              <div className="project-note-tools-dropdown" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setShowTaskFilters((prev) => !prev);
                                    setShowTasksToolsMenu(false);
                                  }}
                                  disabled={projectTasks.length === 0}
                                >
                                  {showTaskFilters ? "Hide filters" : "Show filters"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setTaskSearchQuery("");
                                    setTaskStatusFilter("all");
                                    setTaskAssigneeFilter("all");
                                    setShowTasksToolsMenu(false);
                                  }}
                                  disabled={!hasActiveTaskFilters}
                                >
                                  Clear filters
                                </button>
                                {canManageProjectContent ? (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        handleToggleSelectAllTasks();
                                        setShowTasksToolsMenu(false);
                                      }}
                                      disabled={filteredProjectTasks.length === 0}
                                    >
                                      {allTasksSelected ? "Clear selected" : "Select all visible"}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={openEditSelectedTaskModal}
                                      disabled={selectedTasks.length !== 1 || savingTask || deletingTasks}
                                    >
                                      Edit selected
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="danger"
                                      onClick={requestDeleteSelectedTasks}
                                      disabled={selectedTasks.length === 0 || deletingTasks || savingTask}
                                    >
                                      Delete selected
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {projectTasksError ? (
                      <p className="project-detail-expense-error">{projectTasksError}</p>
                    ) : null}
                    {isMobileProjectViewport ? (
                      <>
                        {projectTasks.length > 0 ? (
                          <div className="project-task-mobile-status-chips" role="tablist" aria-label="Task status">
                            {MOBILE_TASK_STATUS_CHIPS.map((chip) => (
                              <button
                                key={`task-mobile-chip-${chip.key}`}
                                type="button"
                                className={`project-task-mobile-status-chip${
                                  mobileTaskStatusFilter === chip.key ? " active" : ""
                                }`}
                                onClick={() => setMobileTaskStatusFilter(chip.key)}
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {projectTasksLoading ? (
                          <div className="project-expenses-loading">
                            <div className="loading-spinner"></div>
                            <span>Loading tasks...</span>
                          </div>
                        ) : projectTasks.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="check-circle" size={24} />
                            <span>No tasks yet.</span>
                            <p>Break the project into smaller activities.</p>
                            {canManageProjectContent ? (
                              <button type="button" className="project-detail-action" onClick={openTaskModal}>
                                Add Task
                              </button>
                            ) : null}
                          </div>
                        ) : mobileFilteredProjectTasks.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="search" size={24} />
                            <span>No tasks in this status yet.</span>
                          </div>
                        ) : (
                          <div className="project-task-mobile-list" role="list">
                            {mobileFilteredProjectTasks.map((task) => {
                              const taskId = String(task?.id ?? "");
                              const safePriority = String(task?.priority || "normal")
                                .trim()
                                .toLowerCase();
                              const safeStatus = String(task?.status || "open")
                                .trim()
                                .toLowerCase();
                              const priorityLabel = TASK_PRIORITY_LABELS[safePriority] || "Normal";
                              const statusLabel =
                                TASK_STATUS_LABELS[safeStatus] || toReadableLabel(safeStatus, "Open");
                              const assignee =
                                task?.assignee_name ||
                                (task?.assignee_member_id
                                  ? `Member #${task.assignee_member_id}`
                                  : "Unassigned");
                              const assigneeInitials = getInitials(assignee, "UN");
                              const taskTitle = String(task?.title || "Untitled task").trim() || "Untitled task";
                              const dueLabel = task?.due_date
                                ? `Due ${formatShortDate(task?.due_date)}`
                                : "No due date";
                              const isDone = safeStatus === "done";
                              return (
                                <article
                                  key={taskId || `${taskTitle}-${task?.due_date || ""}`}
                                  className={`project-task-mobile-card is-${safeStatus.replace(/[^a-z_]+/g, "")}`}
                                  role="listitem"
                                >
                                  <button
                                    type="button"
                                    className={`project-task-mobile-check${isDone ? " is-done" : ""}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleTaskComplete(task);
                                    }}
                                    disabled={!canManageProjectContent || savingTask || deletingTasks}
                                    aria-label={isDone ? `Mark ${taskTitle} as open` : `Mark ${taskTitle} as completed`}
                                  >
                                    <Icon name="check-circle" size={16} />
                                  </button>
                                  <div
                                    className="project-task-mobile-main"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => {
                                      if (suppressTaskOpenRef.current) {
                                        suppressTaskOpenRef.current = false;
                                        return;
                                      }
                                      openTaskEditorForRow(task);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        openTaskEditorForRow(task);
                                      }
                                    }}
                                    onTouchStart={(event) => handleTaskCardTouchStart(taskId, event)}
                                    onTouchEnd={(event) => handleTaskCardTouchEnd(task, event)}
                                    onTouchCancel={handleTaskCardTouchCancel}
                                  >
                                    <div className="project-task-mobile-head">
                                      <strong>{taskTitle}</strong>
                                      <span>{dueLabel}</span>
                                    </div>
                                    <div className="project-task-mobile-assignee">
                                      <span className="project-task-mobile-avatar" aria-hidden="true">
                                        {assigneeInitials}
                                      </span>
                                      <span>{assignee}</span>
                                    </div>
                                    <div className="project-task-mobile-badges">
                                      <span
                                        className={`project-task-badge is-status-${safeStatus.replace(
                                          /[^a-z_]+/g,
                                          ""
                                        )}`}
                                      >
                                        {statusLabel}
                                      </span>
                                      <span
                                        className={`project-task-badge is-priority-${safePriority.replace(
                                          /[^a-z_]+/g,
                                          ""
                                        )}`}
                                      >
                                        {priorityLabel}
                                      </span>
                                    </div>
                                  </div>
                                  {canManageProjectContent ? (
                                    <button
                                      type="button"
                                      className="project-task-mobile-menu"
                                      onTouchStart={(event) => event.stopPropagation()}
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openTaskActionSheet(task);
                                      }}
                                      aria-label={`Task actions for ${taskTitle}`}
                                    >
                                      <Icon name="more-vertical" size={14} />
                                    </button>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {showTaskFilters && projectTasks.length > 0 ? (
                          <div className="project-detail-filters">
                            <label className="project-detail-filter project-detail-filter--search">
                              <span>Search</span>
                              <input
                                type="search"
                                placeholder="Search task title or details"
                                value={taskSearchQuery}
                                onChange={(event) => setTaskSearchQuery(event.target.value)}
                              />
                            </label>
                            <label className="project-detail-filter">
                              <span>Status</span>
                              <select
                                value={taskStatusFilter}
                                onChange={(event) => setTaskStatusFilter(event.target.value)}
                              >
                                <option value="all">All statuses</option>
                                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                                  <option key={`task-filter-status-${value}`} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="project-detail-filter">
                              <span>Assignee</span>
                              <select
                                value={taskAssigneeFilter}
                                onChange={(event) => setTaskAssigneeFilter(event.target.value)}
                              >
                                <option value="all">All assignees</option>
                                <option value="unassigned">Unassigned</option>
                                {taskAssigneeFilterOptions.map((option) => (
                                  <option key={`task-filter-assignee-${option.id}`} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="project-detail-filter project-detail-filter--actions">
                              <button
                                type="button"
                                className="project-detail-action ghost"
                                onClick={() => {
                                  setTaskSearchQuery("");
                                  setTaskStatusFilter("all");
                                  setTaskAssigneeFilter("all");
                                }}
                                disabled={!hasActiveTaskFilters}
                              >
                                Clear filters
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {projectTasksLoading ? (
                          <div className="project-expenses-loading">
                            <div className="loading-spinner"></div>
                            <span>Loading tasks...</span>
                          </div>
                        ) : projectTasks.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="check-circle" size={24} />
                            <span>No tasks yet.</span>
                          </div>
                        ) : filteredProjectTasks.length === 0 ? (
                          <div className="project-detail-empty">
                            <Icon name="search" size={24} />
                            <span>No tasks match the selected filters.</span>
                          </div>
                        ) : (
                          <>
                            <div className="project-grouped-board">
                              {groupedTaskRows.map((lane) => {
                                const laneTaskIds = lane.rows
                                  .map((task) => String(task?.id ?? ""))
                                  .filter(Boolean);
                                const laneAllSelected =
                                  laneTaskIds.length > 0 &&
                                  laneTaskIds.every((taskId) => selectedTaskIds.includes(taskId));
                                return (
                                  <section
                                    key={`task-lane-${lane.key}`}
                                    className={`project-group-lane is-${String(lane.key).replace(/[^a-z0-9_]+/g, "-")}`}
                                  >
                                    <header className="project-group-lane-head">
                                      <div className="project-group-lane-title">
                                        <span className="project-group-lane-dot" aria-hidden="true" />
                                        <h5>{lane.label}</h5>
                                        <span className="project-group-lane-count">{lane.rows.length}</span>
                                      </div>
                                      {canManageProjectContent ? (
                                        <button
                                          type="button"
                                          className="project-group-lane-add"
                                          onClick={() => openTaskModalForStatus(lane.key)}
                                          disabled={savingTask || deletingTasks}
                                          aria-label={`Add task in ${lane.label}`}
                                        >
                                          <Icon name="plus" size={14} />
                                        </button>
                                      ) : null}
                                    </header>
                                    <div className="projects-table-wrap project-expenses-table-wrap project-group-lane-table-wrap">
                                      <table className="projects-table-view project-expenses-table project-tasks-table project-group-lane-table">
                                        <thead>
                                          <tr>
                                            {canManageProjectContent ? (
                                              <th className="projects-table-check">
                                                <input
                                                  type="checkbox"
                                                  checked={laneAllSelected}
                                                  onChange={() => {
                                                    if (laneAllSelected) {
                                                      const laneSet = new Set(laneTaskIds);
                                                      setSelectedTaskIds((prev) => prev.filter((id) => !laneSet.has(id)));
                                                      return;
                                                    }
                                                    setSelectedTaskIds((prev) =>
                                                      Array.from(new Set([...prev, ...laneTaskIds]))
                                                    );
                                                  }}
                                                  aria-label={`Select all tasks in ${lane.label}`}
                                                />
                                              </th>
                                            ) : null}
                                            <th className="project-task-col-name">Task Name</th>
                                            <th className="project-task-col-description">Description</th>
                                            <th className="project-task-col-due">Estimation</th>
                                            <th className="project-task-col-people">People</th>
                                            <th className="project-task-col-priority">Priority</th>
                                            <th className="project-task-col-status">Status</th>
                                            {canManageProjectContent ? (
                                              <th className="project-group-actions-col project-task-col-actions" aria-label="Actions" />
                                            ) : null}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {lane.rows.map((task) => {
                                            const taskId = String(task?.id ?? "");
                                            const isChecked = selectedTaskIds.includes(taskId);
                                            const safePriority = String(task?.priority || "normal")
                                              .trim()
                                              .toLowerCase();
                                            const safeStatus = String(task?.status || "open")
                                              .trim()
                                              .toLowerCase();
                                            const priorityLabel = TASK_PRIORITY_LABELS[safePriority] || "Normal";
                                            const statusLabel = TASK_STATUS_LABELS[safeStatus] || toReadableLabel(safeStatus, "Open");
                                            const assignee =
                                              task?.assignee_name ||
                                              (task?.assignee_member_id ? `Member #${task.assignee_member_id}` : "Unassigned");
                                            const assigneeInitials = getInitials(assignee, "UN");
                                            const taskDetailsRaw = String(task?.details || "").trim();
                                            const taskDetailsDisplay = taskDetailsRaw
                                              ? truncateProjectCellText(taskDetailsRaw, 108)
                                              : "—";
                                            return (
                                              <tr
                                                key={taskId || `${task?.title || "task"}-${task?.due_date || ""}`}
                                                className="project-task-row"
                                                onClick={() => openTaskDetailsModal(task)}
                                              >
                                                {canManageProjectContent ? (
                                                  <td className="projects-table-check">
                                                    <input
                                                      type="checkbox"
                                                      checked={isChecked}
                                                      onChange={() => handleToggleTaskSelection(taskId)}
                                                      onClick={(event) => event.stopPropagation()}
                                                      aria-label={`Select task ${task?.title || taskId}`}
                                                    />
                                                  </td>
                                                ) : null}
                                                <td className="project-task-col-name">
                                                  <div className="project-expense-detail project-task-detail">
                                                    <strong className="project-row-title">{task?.title || "Untitled task"}</strong>
                                                  </div>
                                                </td>
                                                <td className="project-group-description-cell project-task-col-description">
                                                  <p className="project-group-description" title={taskDetailsRaw || undefined}>
                                                    {taskDetailsDisplay}
                                                  </p>
                                                </td>
                                                <td className="project-group-estimation project-task-col-due">{formatDate(task?.due_date)}</td>
                                                <td className="project-task-col-people">
                                                  <div className="project-task-person">
                                                    <span className="project-task-person-avatar" aria-hidden="true">
                                                      {assigneeInitials}
                                                    </span>
                                                    <span className="project-task-person-name">{assignee}</span>
                                                  </div>
                                                </td>
                                                <td className="project-task-col-priority">
                                                  <span
                                                    className={`project-task-badge is-priority-${safePriority.replace(/[^a-z_]+/g, "")}`}
                                                  >
                                                    {priorityLabel}
                                                  </span>
                                                </td>
                                                <td className="project-task-col-status">
                                                  <span
                                                    className={`project-task-badge is-status-${safeStatus.replace(/[^a-z_]+/g, "")}`}
                                                  >
                                                    {statusLabel}
                                                  </span>
                                                </td>
                                                {canManageProjectContent ? (
                                                  <td className="project-group-actions-col project-task-col-actions">
                                                    <div
                                                      className="project-note-row-menu"
                                                      onClick={(event) => event.stopPropagation()}
                                                    >
                                                      <button
                                                        type="button"
                                                        className="project-group-row-action"
                                                        aria-label={`Actions for ${task?.title || "task"}`}
                                                        aria-haspopup="menu"
                                                        aria-expanded={openTaskRowMenuId === taskId}
                                                        onClick={(event) => handleToggleTaskRowMenu(taskId, event)}
                                                        disabled={savingTask || deletingTasks}
                                                      >
                                                        <Icon name="more-vertical" size={15} />
                                                      </button>
                                                      {openTaskRowMenuId === taskId ? (
                                                        <div className="project-note-row-dropdown" role="menu">
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={() => openTaskDetailsModal(task)}
                                                          >
                                                            View details
                                                          </button>
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={() => {
                                                              setOpenTaskRowMenuId("");
                                                              openTaskEditorForRow(task);
                                                            }}
                                                            disabled={savingTask || deletingTasks}
                                                          >
                                                            Edit
                                                          </button>
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={() => {
                                                              setOpenTaskRowMenuId("");
                                                              handleToggleTaskComplete(task);
                                                            }}
                                                            disabled={savingTask || deletingTasks}
                                                          >
                                                            {safeStatus === "done" ? "Reopen" : "Mark completed"}
                                                          </button>
                                                          <button
                                                            type="button"
                                                            role="menuitem"
                                                            className="danger"
                                                            onClick={() => handleRequestDeleteSingleTask(task)}
                                                            disabled={savingTask || deletingTasks}
                                                          >
                                                            Delete
                                                          </button>
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  </td>
                                                ) : null}
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {detailTab === "notes" && (
                  <>
                    <div className="project-detail-section project-detail-notes">
                      <div className="project-detail-section-head">
                        <h4>Notes</h4>
                        <div className="project-detail-section-head-actions">
                          {canManageProjectContent ? (
                            <button
                              type="button"
                              className="project-detail-action project-detail-action--add-note"
                              onClick={openNoteModal}
                              disabled={savingNote || deletingNotes}
                            >
                              Add note
                            </button>
                          ) : null}
                          <div
                            className="project-note-tools-menu"
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            <button
                              type="button"
                              className="project-group-row-action project-note-tools-menu-btn"
                              onClick={handleToggleNotesToolsMenu}
                              aria-haspopup="menu"
                              aria-expanded={showNotesToolsMenu}
                              aria-label="Notes options"
                            >
                              <Icon name="more-vertical" size={15} />
                            </button>
                            {showNotesToolsMenu ? (
                              <div className="project-note-tools-dropdown" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setShowNoteFilters((prev) => !prev);
                                    setShowNotesToolsMenu(false);
                                  }}
                                  disabled={readableProjectNotes.length === 0}
                                >
                                  {showNoteFilters ? "Hide filters" : "Show filters"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setNoteSearchQuery("");
                                    setNoteVisibilityFilter("all");
                                    setShowNotesToolsMenu(false);
                                  }}
                                  disabled={!hasActiveNoteFilters}
                                >
                                  Clear filters
                                </button>
                                {canManageProjectContent ? (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        handleToggleSelectAllNotes();
                                        setShowNotesToolsMenu(false);
                                      }}
                                      disabled={filteredProjectNotes.length === 0}
                                    >
                                      {allNotesSelected ? "Clear selected" : "Select all visible"}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={openEditSelectedNoteModal}
                                      disabled={selectedNotes.length !== 1 || savingNote || deletingNotes}
                                    >
                                      Edit selected
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="danger"
                                      onClick={requestDeleteSelectedNotes}
                                      disabled={selectedNotes.length === 0 || deletingNotes || savingNote}
                                    >
                                      Delete selected
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {projectNotesError ? (
                        <p className="project-detail-expense-error">{projectNotesError}</p>
                      ) : null}
                      {showNoteFilters && readableProjectNotes.length > 0 ? (
                        <div className="project-detail-filters">
                          <label className="project-detail-filter project-detail-filter--search">
                            <span>Search</span>
                            <input
                              type="search"
                              placeholder="Search note title or content"
                              value={noteSearchQuery}
                              onChange={(event) => setNoteSearchQuery(event.target.value)}
                            />
                          </label>
                          <label className="project-detail-filter">
                            <span>Visibility</span>
                            <select
                              value={noteVisibilityFilter}
                              onChange={(event) => setNoteVisibilityFilter(event.target.value)}
                            >
                              <option value="all">All visibility</option>
                              {Object.entries(NOTE_VISIBILITY_LABELS).map(([value, label]) => (
                                <option key={`note-filter-visibility-${value}`} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="project-detail-filter project-detail-filter--actions">
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={() => {
                                setNoteSearchQuery("");
                                setNoteVisibilityFilter("all");
                              }}
                              disabled={!hasActiveNoteFilters}
                            >
                              Clear filters
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {projectNotesLoading ? (
                        <div className="project-expenses-loading">
                          <div className="loading-spinner"></div>
                          <span>Loading notes...</span>
                        </div>
                      ) : readableProjectNotes.length === 0 ? (
                        <div className="project-detail-empty">
                          <Icon name="notes" size={24} />
                          <span>No notes available.</span>
                        </div>
                      ) : filteredProjectNotes.length === 0 ? (
                        <div className="project-detail-empty">
                          <Icon name="search" size={24} />
                          <span>No notes match the selected filters.</span>
                        </div>
                      ) : (
                        <>
                          <div className="project-grouped-board">
                            {groupedNoteRows.map((lane) => {
                              const laneNoteIds = lane.rows
                                .map((note) => String(note?.id ?? ""))
                                .filter(Boolean);
                              const laneAllSelected =
                                laneNoteIds.length > 0 &&
                                laneNoteIds.every((noteId) => selectedNoteIds.includes(noteId));
                              return (
                                <section
                                  key={`note-lane-${lane.key}`}
                                  className={`project-group-lane is-${String(lane.key).replace(/[^a-z0-9_]+/g, "-")}`}
                                >
                                  <header className="project-group-lane-head">
                                    <div className="project-group-lane-title">
                                      <span className="project-group-lane-dot" aria-hidden="true" />
                                      <h5>{lane.label}</h5>
                                      <span className="project-group-lane-count">{lane.rows.length}</span>
                                    </div>
                                    {canManageProjectContent ? (
                                      <button
                                        type="button"
                                        className="project-group-lane-add"
                                        onClick={() => openNoteModalForVisibility(lane.key)}
                                        disabled={savingNote || deletingNotes}
                                        aria-label={`Add note in ${lane.label}`}
                                      >
                                        <Icon name="plus" size={14} />
                                      </button>
                                    ) : null}
                                  </header>
                                  <div className="projects-table-wrap project-expenses-table-wrap project-group-lane-table-wrap">
                                    <table className="projects-table-view project-expenses-table project-notes-table project-group-lane-table">
                                      <thead>
                                        <tr>
                                          {canManageProjectContent ? (
                                            <th className="projects-table-check">
                                              <input
                                                type="checkbox"
                                                checked={laneAllSelected}
                                                onChange={() => {
                                                  if (laneAllSelected) {
                                                    const laneSet = new Set(laneNoteIds);
                                                    setSelectedNoteIds((prev) =>
                                                      prev.filter((id) => !laneSet.has(id))
                                                    );
                                                    return;
                                                  }
                                                  setSelectedNoteIds((prev) =>
                                                    Array.from(new Set([...prev, ...laneNoteIds]))
                                                  );
                                                }}
                                                aria-label={`Select all notes in ${lane.label}`}
                                              />
                                            </th>
                                          ) : null}
                                          <th className="project-note-col-name">Note Name</th>
                                          <th className="project-note-col-description">Description</th>
                                          <th className="project-note-col-updated">Updated</th>
                                          <th className="project-note-col-author">Author</th>
                                          <th className="project-note-col-visibility">Visibility</th>
                                          {canManageProjectContent ? (
                                            <th
                                              className="project-group-actions-col project-note-col-actions"
                                              aria-label="Actions"
                                            />
                                          ) : null}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lane.rows.map((note) => {
                                          const noteId = String(note?.id ?? "");
                                          const isChecked = selectedNoteIds.includes(noteId);
                                          const safeVisibility = normalizeNoteVisibilityKey(note?.visibility);
                                          const visibilityIcon = getNoteVisibilityIcon(safeVisibility);
                                          const visibilityLabel = getNoteVisibilityLabel(
                                            safeVisibility,
                                            note?.visible_member_ids
                                          );
                                          const author =
                                            note?.author_name ||
                                            (note?.author_member_id ? `Member #${note.author_member_id}` : "—");
                                          const noteBodyRaw = String(note?.body || "").trim();
                                          const noteBodyDisplay = noteBodyRaw
                                            ? truncateProjectCellText(noteBodyRaw, 108)
                                            : "—";
                                          return (
                                            <tr
                                              key={noteId || `${note?.title || "note"}-${note?.created_at || ""}`}
                                              className="project-note-row"
                                              onClick={() => openNoteDetailsModal(note)}
                                            >
                                              {canManageProjectContent ? (
                                                <td className="projects-table-check">
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleToggleNoteSelection(noteId)}
                                                    onClick={(event) => event.stopPropagation()}
                                                    aria-label={`Select note ${note?.title || noteId}`}
                                                  />
                                                </td>
                                              ) : null}
                                              <td className="project-note-col-name">
                                                <div className="project-expense-detail project-note-detail">
                                                  <strong className="project-row-title">
                                                    {note?.title || "Untitled note"}
                                                  </strong>
                                                </div>
                                              </td>
                                              <td className="project-group-description-cell project-note-col-description">
                                                <p className="project-group-description" title={noteBodyRaw || undefined}>
                                                  {noteBodyDisplay}
                                                </p>
                                              </td>
                                              <td className="project-group-estimation project-note-col-updated">
                                                {formatDate(note?.updated_at || note?.created_at)}
                                              </td>
                                              <td className="project-note-col-author">{author}</td>
                                              <td className="project-note-col-visibility">
                                                <span
                                                  className={`project-note-visibility is-${safeVisibility.replace(/[^a-z_]+/g, "")}`}
                                                  title={visibilityLabel}
                                                  aria-label={visibilityLabel}
                                                >
                                                  <Icon name={visibilityIcon} size={12} />
                                                </span>
                                              </td>
                                              {canManageProjectContent ? (
                                                <td className="project-group-actions-col project-note-col-actions">
                                                  <div
                                                    className="project-note-row-menu"
                                                    onClick={(event) => event.stopPropagation()}
                                                  >
                                                    <button
                                                      type="button"
                                                      className="project-group-row-action"
                                                      aria-label={`Actions for ${note?.title || "note"}`}
                                                      aria-haspopup="menu"
                                                      aria-expanded={openNoteRowMenuId === noteId}
                                                      onClick={(event) => handleToggleNoteRowMenu(noteId, event)}
                                                      disabled={savingNote || deletingNotes}
                                                    >
                                                      <Icon name="more-vertical" size={15} />
                                                    </button>
                                                    {openNoteRowMenuId === noteId ? (
                                                      <div className="project-note-row-dropdown" role="menu">
                                                        <button
                                                          type="button"
                                                          role="menuitem"
                                                          onClick={() => openNoteDetailsModal(note)}
                                                        >
                                                          View details
                                                        </button>
                                                        <button
                                                          type="button"
                                                          role="menuitem"
                                                          onClick={() => openNoteEditorForRow(note)}
                                                          disabled={savingNote || deletingNotes}
                                                        >
                                                          Edit
                                                        </button>
                                                        <button
                                                          type="button"
                                                          role="menuitem"
                                                          className="danger"
                                                          onClick={() => handleRequestDeleteSingleNote(note)}
                                                          disabled={savingNote || deletingNotes}
                                                        >
                                                          Delete
                                                        </button>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                </td>
                                              ) : null}
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    {canManageProjectContent ? (
                      <button
                        type="button"
                        className="project-detail-fab project-detail-fab--note"
                        onClick={openNoteModal}
                        disabled={savingNote || deletingNotes}
                        aria-label="Add note"
                      >
                        <Icon name="plus" size={20} />
                      </button>
                    ) : null}
                  </>
                )}
                {detailTab === "invites" && canViewProjectInvites && (
                  <div className="project-detail-section project-detail-invites">
                    <div className="project-detail-section-head">
                      <div>
                        <h4>Invited members</h4>
                        <p>Invites linked to this project, including all-project access invites.</p>
                      </div>
                      <div className="project-detail-section-head-actions">
                        <button
                          type="button"
                          className="project-detail-action ghost"
                          onClick={loadProjectInvites}
                          disabled={projectInvitesLoading || submittingProjectInvite}
                        >
                          Refresh
                        </button>
                        <button
                          type="button"
                          className="project-detail-action"
                          onClick={openProjectInviteModal}
                          disabled={submittingProjectInvite}
                        >
                          <Icon name="plus" size={14} />
                          Invite member
                        </button>
                      </div>
                    </div>
                    {projectInvitesError ? (
                      <p className="project-detail-expense-error">{projectInvitesError}</p>
                    ) : null}
                    {projectInvitesLoading ? (
                      <div className="project-expenses-loading">
                        <div className="loading-spinner"></div>
                        <span>Loading invited members...</span>
                      </div>
                    ) : projectInvites.length === 0 ? (
                      <div className="project-detail-empty">
                        <Icon name="mail" size={24} />
                        <span>No invites for this project yet.</span>
                      </div>
                    ) : (
                      <div className="projects-table-wrap project-expenses-table-wrap project-invites-table-wrap">
                        <table className="projects-table-view project-expenses-table project-invites-table">
                          <thead>
                            <tr>
                              <th className="project-invite-col-member">Invited member</th>
                              <th className="project-invite-col-role">Role</th>
                              <th className="project-invite-col-access">Access</th>
                              <th className="project-invite-col-status">Status</th>
                              <th className="project-invite-col-code">Invite #</th>
                              <th className="project-invite-col-created">Created</th>
                              <th className="project-invite-col-expires">Expires</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectInvites.map((invite) => {
                              const inviteId = String(invite?.id || invite?.invite_number || "");
                              const safeRole = toReadableLabel(String(invite?.role || "member"), "Member");
                              const safeStatus = String(invite?.status || "pending")
                                .trim()
                                .toLowerCase()
                                .replace(/[^a-z0-9_]+/g, "_");
                              const inviteNumber = String(invite?.invite_number || "").trim();
                              const email = String(invite?.email || "").trim();
                              const phone = String(invite?.phone_number || "").trim();
                              return (
                                <tr key={inviteId || `${email}-${inviteNumber}`}>
                                  <td className="project-invite-col-member">
                                    <div className="project-invite-member">
                                      <strong>{email || "No email"}</strong>
                                      {phone ? <small>{phone}</small> : null}
                                    </div>
                                  </td>
                                  <td className="project-invite-col-role">{safeRole}</td>
                                  <td className="project-invite-col-access">{formatInviteScopeLabel(invite)}</td>
                                  <td className="project-invite-col-status">
                                    <span className={`project-invite-status is-${safeStatus}`}>
                                      {formatInviteStatusLabel(invite?.status)}
                                    </span>
                                  </td>
                                  <td className="project-invite-col-code">
                                    {inviteNumber ? (
                                      <button
                                        type="button"
                                        className="project-invite-copy"
                                        onClick={() => handleCopyInviteNumber(inviteNumber)}
                                        title="Copy invite number"
                                      >
                                        {inviteNumber}
                                      </button>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="project-invite-col-created">{formatDate(invite?.created_at)}</td>
                                  <td className="project-invite-col-expires">
                                    {invite?.expires_at ? formatDate(invite.expires_at) : "No expiry"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isMobileProjectViewport && canManageProjectContent && detailTab === "tasks" ? (
                <button
                  type="button"
                  className="project-detail-fab project-detail-fab--note"
                  onClick={openTaskModal}
                  disabled={savingTask || deletingTasks}
                  aria-label="Add task"
                >
                  <Icon name="plus" size={20} />
                </button>
              ) : null}
              {isMobileProjectViewport && canManageProjectContent && detailTab === "expenses" ? (
                <button
                  type="button"
                  className="project-detail-fab project-detail-fab--note"
                  onClick={openExpenseModal}
                  disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                  aria-label="Record expense"
                >
                  <Icon name="plus" size={20} />
                </button>
              ) : null}
              {isMobileProjectViewport && canManageProjectContent && detailTab === "documents" ? (
                <button
                  type="button"
                  className="project-detail-fab project-detail-fab--note"
                  onClick={openDocumentCreateActionSheet}
                  disabled={uploadingProjectDocument || deletingDocuments || renamingDocument || emittingProjectDocument}
                  aria-label="Document actions"
                >
                  <Icon name="plus" size={20} />
                </button>
              ) : null}
              {isMobileProjectViewport && canManageProjectContent && detailTab === "notes" ? (
                <button
                  type="button"
                  className="project-detail-fab project-detail-fab--note"
                  onClick={openNoteModal}
                  disabled={savingNote || deletingNotes}
                  aria-label="Add note"
                >
                  <Icon name="plus" size={20} />
                </button>
              ) : null}
            </div>
          </div>
        )}
      </DataModal>

      {Boolean(activeProjectActionTarget) && showProjectActionSheet ? (
        <div className="project-action-sheet-overlay" onClick={closeProjectActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Project actions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "overview")}
              disabled={Boolean(projectActionInFlightId)}
            >
              Open overview
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "expenses")}
              disabled={Boolean(projectActionInFlightId)}
            >
              Open expenses
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "documents")}
              disabled={Boolean(projectActionInFlightId)}
            >
              Open docs
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "tasks")}
              disabled={Boolean(projectActionInFlightId)}
            >
              Open tasks
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "notes")}
              disabled={Boolean(projectActionInFlightId)}
            >
              Open notes
            </button>
            {canViewProjectInvites ? (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={() => openProjectDetailsFromActionSheet(activeProjectActionTarget, "invites")}
                disabled={Boolean(projectActionInFlightId)}
              >
                Open invites
              </button>
            ) : null}
            {canCreateProject ? (
              <>
                <hr />
                <button
                  type="button"
                  className="project-action-sheet-btn"
                  onClick={() => {
                    const projectToEdit = activeProjectActionTarget;
                    closeProjectActionSheet();
                    if (selectedProject?.id === projectToEdit?.id) {
                      setSelectedProject(null);
                    }
                    openEditProjectModal(projectToEdit);
                  }}
                  disabled={Boolean(projectActionInFlightId)}
                >
                  Edit project
                </button>
                <button
                  type="button"
                  className="project-action-sheet-btn"
                  onClick={() => handleDuplicateSelectedProject(activeProjectActionTarget)}
                  disabled={Boolean(projectActionInFlightId)}
                >
                  Duplicate project
                </button>
                <button
                  type="button"
                  className="project-action-sheet-btn"
                  onClick={() => handleArchiveSelectedProject(activeProjectActionTarget)}
                  disabled={Boolean(projectActionInFlightId)}
                >
                  Archive project
                </button>
                <button
                  type="button"
                  className="project-action-sheet-btn"
                  onClick={() => requestProjectVisibilityToggle(activeProjectActionTarget)}
                  disabled={Boolean(projectActionInFlightId)}
                >
                  {activeProjectActionTarget?.is_visible !== false ? "Hide project" : "Show project"}
                </button>
              </>
            ) : null}
            <hr />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                openProjectDetailsFromActionSheet(activeProjectActionTarget, "overview");
                setShowBudgetSummaryReportModal(true);
              }}
              disabled={Boolean(projectActionInFlightId)}
            >
              Export project report
            </button>
            {canCreateProject ? (
              <>
                <hr />
                <button
                  type="button"
                  className={`project-action-sheet-btn is-danger${mobileDeleteArmed ? " is-armed" : ""}`}
                  onClick={() => handleMobileDeleteProject(activeProjectActionTarget)}
                  disabled={Boolean(projectActionInFlightId)}
                >
                  {mobileDeleteArmed ? "Tap again to delete project" : "Delete project"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {Boolean(selectedProject) && Boolean(expenseActionExpense) && isMobileProjectViewport ? (
        <div className="project-action-sheet-overlay" onClick={closeExpenseActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Expense actions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                const expense = expenseActionExpense;
                closeExpenseActionSheet();
                openExpenseDetailModal(expense);
              }}
            >
              View details
            </button>
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={handleEditExpenseFromActionSheet}
                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
              >
                Edit expense
              </button>
            ) : null}
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={handleDuplicateExpenseFromActionSheet}
                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
              >
                Duplicate expense
              </button>
            ) : null}
            {expenseActionExpense?.receipt_download_url ? (
              <a
                className="project-action-sheet-btn project-action-sheet-btn--link"
                href={expenseActionExpense.receipt_download_url}
                target="_blank"
                rel="noreferrer"
                onClick={closeExpenseActionSheet}
              >
                View receipt
              </a>
            ) : null}
            {canManageProjectContent ? <hr /> : null}
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn is-danger"
                onClick={handleDeleteExpenseFromActionSheet}
                disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
              >
                Delete expense
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {Boolean(selectedProject) && Boolean(taskActionTask) && isMobileProjectViewport ? (
        <div className="project-action-sheet-overlay" onClick={closeTaskActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Task actions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={handleEditTaskFromActionSheet}
              disabled={!canManageProjectContent || savingTask || deletingTasks}
            >
              Edit task
            </button>
            {String(taskActionTask?.status || "open").trim().toLowerCase() !== "done" ? (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={() => {
                  const selected = taskActionTask;
                  closeTaskActionSheet();
                  handleToggleTaskComplete(selected);
                }}
                disabled={!canManageProjectContent || savingTask || deletingTasks}
              >
                Mark completed
              </button>
            ) : (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={() => {
                  const selected = taskActionTask;
                  closeTaskActionSheet();
                  persistTaskStatusUpdate(selected, "open");
                }}
                disabled={!canManageProjectContent || savingTask || deletingTasks}
              >
                Reopen task
              </button>
            )}
            {canManageProjectContent ? <hr /> : null}
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn is-danger"
                onClick={handleDeleteTaskFromActionSheet}
                disabled={savingTask || deletingTasks}
              >
                Delete task
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {Boolean(selectedProject) && Boolean(documentActionDocument) && isMobileProjectViewport ? (
        <div className="project-action-sheet-overlay" onClick={closeDocumentActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Document actions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                const selected = documentActionDocument;
                closeDocumentActionSheet();
                openProjectDocumentInBrowser(selected);
              }}
            >
              Open preview
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                const selected = documentActionDocument;
                closeDocumentActionSheet();
                handleDownloadProjectDocument(selected);
              }}
            >
              Download
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                const selected = documentActionDocument;
                closeDocumentActionSheet();
                handleShareProjectDocument(selected);
              }}
            >
              Share
            </button>
            {canManageProjectContent ? <hr /> : null}
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn"
                onClick={handleRenameDocumentFromActionSheet}
                disabled={renamingDocument || deletingDocuments || uploadingProjectDocument || emittingProjectDocument}
              >
                Rename
              </button>
            ) : null}
            {canManageProjectContent ? (
              <button
                type="button"
                className="project-action-sheet-btn is-danger"
                onClick={handleDeleteDocumentFromActionSheet}
                disabled={deletingDocuments || renamingDocument || uploadingProjectDocument || emittingProjectDocument}
              >
                Delete document
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {Boolean(selectedProject) && showDocumentCreateActionSheet && isMobileProjectViewport ? (
        <div className="project-action-sheet-overlay" onClick={closeDocumentCreateActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Create document"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={() => {
                closeDocumentCreateActionSheet();
                triggerProjectDocumentPicker();
              }}
              disabled={uploadingProjectDocument || deletingDocuments || renamingDocument || emittingProjectDocument}
            >
              Upload file
            </button>
            <button
              type="button"
              className="project-action-sheet-btn"
              onClick={openDocumentTemplateActionSheet}
              disabled={uploadingProjectDocument || deletingDocuments || renamingDocument || emittingProjectDocument}
            >
              Generate report
            </button>
          </div>
        </div>
      ) : null}

      {Boolean(selectedProject) && showDocumentTemplateActionSheet && isMobileProjectViewport ? (
        <div className="project-action-sheet-overlay" onClick={closeDocumentTemplateActionSheet} role="presentation">
          <div
            className="project-action-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Report templates"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="project-action-sheet-handle" aria-hidden="true" />
            {PROJECT_EMIT_DOCUMENT_OPTIONS.map((option) => (
              <button
                key={`mobile-document-template-${option.value}`}
                type="button"
                className="project-action-sheet-btn"
                onClick={() => {
                  closeDocumentTemplateActionSheet();
                  setMobileProjectDocumentMode("reports");
                  handlePrepareEmitDocument(option);
                }}
                disabled={uploadingProjectDocument || deletingDocuments || renamingDocument || emittingProjectDocument}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <DataModal
        open={showAcceptInviteModal}
        onClose={closeAcceptInviteModal}
        title="Accept project invite"
        subtitle="Enter the invite number shared with you to confirm project access."
        icon="mail"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleAcceptProjectInviteSubmit}>
          {acceptProjectInviteError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{acceptProjectInviteError}</p>
          ) : null}
          <div className="data-modal-grid">
            <div className="data-modal-field data-modal-field--full">
              <label>Invite number</label>
              <input
                type="text"
                value={acceptProjectInviteForm.inviteNumber}
                onChange={(event) => handleAcceptProjectInviteFieldChange("inviteNumber", event.target.value)}
                placeholder="e.g. 8374629"
                autoComplete="off"
                disabled={acceptingProjectInvite}
                required
              />
            </div>
          </div>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeAcceptInviteModal}
              disabled={acceptingProjectInvite}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={acceptingProjectInvite}
            >
              {acceptingProjectInvite ? "Confirming..." : "Confirm invite"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={Boolean(selectedProject) && showProjectInviteModal}
        onClose={closeProjectInviteModal}
        title="Invite member"
        subtitle={
          selectedProject?.name
            ? `Invite someone to join ${selectedProject.name}.`
            : "Send a secure invite to this project."
        }
        icon="mail"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleProjectInviteSubmit}>
          {projectInviteFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{projectInviteFormError}</p>
          ) : null}
          <p className="project-invite-form-scope">
            This invite grants access to <strong>{selectedProject?.name || "the selected project"}</strong>.
          </p>
          <div className="data-modal-grid">
            <div className="data-modal-field data-modal-field--full">
              <label>Email *</label>
              <input
                type="email"
                value={projectInviteForm.email}
                onChange={(event) => handleProjectInviteFormFieldChange("email", event.target.value)}
                placeholder="member@example.com"
                disabled={submittingProjectInvite}
                required
              />
            </div>

            <div className="data-modal-field">
              <label>Phone</label>
              <input
                type="tel"
                value={projectInviteForm.phone_number}
                onChange={(event) => handleProjectInviteFormFieldChange("phone_number", event.target.value)}
                placeholder="+254 700 000 000"
                disabled={submittingProjectInvite}
              />
            </div>

            <div className="data-modal-field">
              <label>Role</label>
              <select
                value={projectInviteForm.role}
                onChange={(event) => handleProjectInviteFormFieldChange("role", event.target.value)}
                disabled={submittingProjectInvite}
              >
                <option value="member">Member</option>
                <option value="coordinator">Coordinator</option>
                <option value="project_manager">Project Manager</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="data-modal-field data-modal-field--full">
              <label>Notes</label>
              <textarea
                value={projectInviteForm.notes}
                onChange={(event) => handleProjectInviteFormFieldChange("notes", event.target.value)}
                placeholder="Optional instructions for this invite"
                rows="3"
                disabled={submittingProjectInvite}
              />
            </div>
          </div>

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeProjectInviteModal}
              disabled={submittingProjectInvite}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={submittingProjectInvite}
            >
              {submittingProjectInvite ? "Sending..." : "Send invite"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={Boolean(selectedProject) && showBudgetSummaryReportModal}
        onClose={closeBudgetSummaryReportModal}
        title="Project Summary Report"
        subtitle={
          projectSummaryReport
            ? `${projectSummaryReport.projectName} • Generated ${projectSummaryReport.generatedAt}`
            : ""
        }
        icon="trending-up"
        className="project-submodal project-summary-report-modal"
        bodyClassName="project-summary-report-body"
      >
        {projectSummaryReport ? (
          <div className="project-summary-report">
            <div className="project-summary-report-actions">
              <button
                type="button"
                className="project-detail-action"
                onClick={handleDownloadDonorBrief}
                disabled={exportingDonorBrief}
              >
                <Icon name="download" size={16} />
                {exportingDonorBrief ? "Preparing donor brief..." : "Download donor brief (PDF)"}
              </button>
              <p className="project-summary-report-actions-note">
                Share-ready package for donors and partners with financials, KPIs, milestones, and funding ask.
              </p>
            </div>

            <section className="project-summary-report-hero">
              <div>
                <p className="project-summary-report-kicker">Executive summary</p>
                <h3>{projectSummaryReport.projectName}</h3>
                <p className="project-summary-report-description">{projectSummaryReport.leadSummary}</p>
                <div className="project-summary-report-meta">
                  <span>
                    <Icon name="briefcase" size={14} />
                    {projectSummaryReport.moduleLabel}
                  </span>
                  <span>
                    <Icon name="calendar" size={14} />
                    Started {projectSummaryReport.startDateLabel}
                  </span>
                  <span>
                    <Icon name="member" size={14} />
                    {projectSummaryReport.memberCount} member
                    {projectSummaryReport.memberCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    <Icon name="target" size={14} />
                    {projectSummaryReport.statusLabel}
                  </span>
                </div>
              </div>
              <div className="project-summary-report-health-stack">
                <div
                  className={`project-summary-report-health project-summary-report-health--${projectSummaryReport.budgetHealth.tone}`}
                >
                  <span>Budget status</span>
                  <strong>{projectSummaryReport.budgetHealth.label}</strong>
                  <small>{formatPercentLabel(projectSummaryReport.budgetUsedPercent)} utilized</small>
                </div>
                <div
                  className={`project-summary-report-health project-summary-report-health--${projectSummaryReport.fundingStatus.tone}`}
                >
                  <span>Funding status</span>
                  <strong>{projectSummaryReport.fundingStatus.label}</strong>
                  <small>{formatPercentLabel(projectSummaryReport.budgetCoveragePercent)} budget coverage</small>
                </div>
              </div>
            </section>

            <section className="project-summary-report-ring-grid">
              <article className="project-summary-report-ring-card" data-tone="budget">
                <div
                  className="project-summary-report-ring"
                  style={{ "--report-value": `${projectSummaryReport.budgetUsedPercent}%` }}
                >
                  <strong>{formatPercentLabel(projectSummaryReport.budgetUsedPercent)}</strong>
                </div>
                <div>
                  <h4>Budget utilization</h4>
                  <p>
                    {formatCurrency(projectSummaryReport.spentAmount)} spent of{" "}
                    {formatCurrency(projectSummaryReport.budgetAmount)}.
                  </p>
                </div>
              </article>
              <article className="project-summary-report-ring-card" data-tone="tasks">
                <div
                  className="project-summary-report-ring"
                  style={{ "--report-value": `${projectSummaryReport.executionPercent}%` }}
                >
                  <strong>{formatPercentLabel(projectSummaryReport.executionPercent)}</strong>
                </div>
                <div>
                  <h4>Execution pace</h4>
                  <p>
                    {projectSummaryReport.taskTotals.done} of {projectSummaryReport.totalTasks} tasks complete.{" "}
                    {projectSummaryReport.completionLabel}.
                  </p>
                </div>
              </article>
              <article className="project-summary-report-ring-card" data-tone="proof">
                <div
                  className="project-summary-report-ring"
                  style={{ "--report-value": `${projectSummaryReport.proofCoveragePercent}%` }}
                >
                  <strong>{formatPercentLabel(projectSummaryReport.proofCoveragePercent)}</strong>
                </div>
                <div>
                  <h4>Expense compliance</h4>
                  <p>
                    {projectSummaryReport.expenseGuardrail} across {projectSummaryReport.expenseCount} expense
                    record{projectSummaryReport.expenseCount === 1 ? "" : "s"}.
                  </p>
                </div>
              </article>
            </section>

            <section className="project-summary-report-grid">
              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Financial position</h4>
                  <span>
                    {formatPercentLabel(projectSummaryReport.trendDeltaPercent)} in{" "}
                    {projectSummaryReport.trendWindowLabel}
                  </span>
                </div>
                <div className="project-summary-report-financial-grid">
                  <div className="project-summary-report-financial-item">
                    <span>Total budget</span>
                    <strong>{formatCurrency(projectSummaryReport.budgetAmount)}</strong>
                  </div>
                  <div className="project-summary-report-financial-item">
                    <span>Spent</span>
                    <strong>{formatCurrency(projectSummaryReport.spentAmount)}</strong>
                  </div>
                  <div className="project-summary-report-financial-item">
                    <span>Remaining</span>
                    <strong>{formatCurrency(projectSummaryReport.remainingAmount)}</strong>
                  </div>
                  <div className="project-summary-report-financial-item">
                    <span>Expected funding</span>
                    <strong>{formatCurrency(projectSummaryReport.expectedRevenueAmount)}</strong>
                  </div>
                </div>

                <div className="project-summary-report-funding-grid">
                  <div className="project-summary-report-funding-item">
                    <span>Funds committed</span>
                    <strong>{formatCurrency(projectSummaryReport.fundsCommittedAmount)}</strong>
                  </div>
                  <div className="project-summary-report-funding-item">
                    <span>Funding gap</span>
                    <strong>{formatCurrency(projectSummaryReport.fundingGapAmount)}</strong>
                  </div>
                  <div className="project-summary-report-funding-item">
                    <span>Monthly burn rate</span>
                    <strong>{formatCurrency(projectSummaryReport.monthlyBurnRate)}</strong>
                  </div>
                  <div
                    className={`project-summary-report-funding-item project-summary-report-funding-item--${projectSummaryReport.runwayStatus.tone}`}
                  >
                    <span>Runway</span>
                    <strong>{formatReportMetricValue(projectSummaryReport.runwayMonths, "months")}</strong>
                    <small>{projectSummaryReport.runwayStatus.label}</small>
                  </div>
                </div>

                <div className="project-summary-report-category-list">
                  <div className="project-summary-report-card-head project-summary-report-card-head--minor">
                    <h5>Top expense categories</h5>
                    <span>{projectSummaryReport.rangeExpensesCount} in selected range</span>
                  </div>
                  {projectSummaryReport.topCategories.length ? (
                    projectSummaryReport.topCategories.map((item) => {
                      const widthPercent =
                        projectSummaryReport.topCategoryMax > 0
                          ? (Number(item.amount) / projectSummaryReport.topCategoryMax) * 100
                          : 0;
                      return (
                        <div className="project-summary-report-category-row" key={`summary-category-${item.category}`}>
                          <div className="project-summary-report-category-meta">
                            <span>{item.category}</span>
                            <strong>{formatCurrency(item.amount)}</strong>
                          </div>
                          <div className="project-summary-report-category-track">
                            <span style={{ width: `${Math.max(0, Math.min(100, widthPercent))}%` }} />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="project-summary-report-empty">No expense activity captured in this range yet.</p>
                  )}
                </div>
              </article>

              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Delivery and milestones</h4>
                  <span>{formatPercentLabel(projectSummaryReport.progressPercent)} project progress</span>
                </div>

                <div className="project-summary-report-delivery-grid">
                  <div className="project-summary-report-delivery-item">
                    <span>Open tasks</span>
                    <strong>{projectSummaryReport.taskTotals.open}</strong>
                  </div>
                  <div className="project-summary-report-delivery-item">
                    <span>In progress</span>
                    <strong>{projectSummaryReport.taskTotals.in_progress}</strong>
                  </div>
                  <div className="project-summary-report-delivery-item">
                    <span>Overdue</span>
                    <strong>{projectSummaryReport.overdueTaskCount}</strong>
                  </div>
                  <div className="project-summary-report-delivery-item">
                    <span>High priority</span>
                    <strong>{projectSummaryReport.highPriorityActiveTaskCount}</strong>
                  </div>
                  <div className="project-summary-report-delivery-item">
                    <span>Documents</span>
                    <strong>{projectSummaryReport.documentsCount}</strong>
                  </div>
                  <div className="project-summary-report-delivery-item">
                    <span>Notes</span>
                    <strong>{projectSummaryReport.notesCount}</strong>
                  </div>
                </div>

                <div className="project-summary-report-milestone-list">
                  <div className="project-summary-report-card-head project-summary-report-card-head--minor">
                    <h5>Milestone timeline</h5>
                    <span>{formatPercentLabel(projectSummaryReport.milestoneCompletionPercent)} delivered</span>
                  </div>
                  {projectSummaryReport.milestoneRows.length ? (
                    projectSummaryReport.milestoneRows.map((milestone) => (
                      <div
                        className={`project-summary-report-milestone-row is-${milestone.timelineTone}`}
                        key={milestone.id}
                      >
                        <div className="project-summary-report-milestone-main">
                          <strong>{milestone.title}</strong>
                          <span>
                            {milestone.assignee} • Due {milestone.dueLabel}
                          </span>
                        </div>
                        <span className="project-summary-report-milestone-status">{milestone.statusLabel}</span>
                      </div>
                    ))
                  ) : (
                    <p className="project-summary-report-empty">No milestones captured yet.</p>
                  )}
                </div>

                <div className="project-summary-report-support-block">
                  <div className="project-summary-report-card-head project-summary-report-card-head--minor">
                    <h5>Partner traction</h5>
                    <span>{projectSummaryReport.linkedPartners.length} linked</span>
                  </div>
                  <p className="project-summary-report-support-text">
                    {projectSummaryReport.linkedPartners.length
                      ? projectSummaryReport.linkedPartners.join(", ")
                      : "No linked partners yet. Use Organization Partners to map supporting institutions."}
                  </p>
                  <div
                    className={`project-summary-report-ask project-summary-report-ask--${projectSummaryReport.fundingStatus.tone}`}
                  >
                    <span>Current donor ask</span>
                    <strong>
                      {projectSummaryReport.donorAskAmount !== null
                        ? formatCurrency(projectSummaryReport.donorAskAmount)
                        : "No immediate gap"}
                    </strong>
                    <p>{projectSummaryReport.donorAskSummary}</p>
                  </div>
                </div>
              </article>
            </section>

            <section className="project-summary-report-grid project-summary-report-grid--tertiary">
              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Value for Money</h4>
                  <span>Unit-cost and leverage view</span>
                </div>
                <div className="project-summary-report-vfm-grid">
                  <div className="project-summary-report-vfm-item">
                    <span>Cost per member reached</span>
                    <strong>{formatCurrency(projectSummaryReport.costPerMember)}</strong>
                  </div>
                  <div className="project-summary-report-vfm-item">
                    <span>Cost per milestone delivered</span>
                    <strong>{formatCurrency(projectSummaryReport.costPerCompletedMilestone)}</strong>
                  </div>
                  <div className="project-summary-report-vfm-item">
                    <span>Leverage ratio</span>
                    <strong>{formatReportMetricValue(projectSummaryReport.budgetLeverageRatio, "x")}</strong>
                  </div>
                </div>
                <p className="project-summary-report-support-text">{projectSummaryReport.valueForMoneyNarrative}</p>
              </article>

              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Risk Register</h4>
                  <span>
                    {projectSummaryReport.riskHighCount} high, {projectSummaryReport.riskMediumCount} medium
                  </span>
                </div>
                <div className="project-summary-report-risk-list">
                  {projectSummaryReport.riskRegister.map((risk) => (
                    <div className="project-summary-report-risk-row" key={risk.key}>
                      <div className="project-summary-report-risk-head">
                        <strong>{risk.risk}</strong>
                        <span className={`project-summary-report-risk-level is-${risk.tone}`}>
                          {risk.tone.toUpperCase()}
                        </span>
                      </div>
                      <p>
                        Likelihood: {risk.likelihood} | Impact: {risk.impact} | Owner: {risk.owner} | Review:{" "}
                        {risk.reviewDate}
                      </p>
                      <small>{risk.mitigation}</small>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="project-summary-report-grid project-summary-report-grid--secondary">
              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>KPI Baseline Tracker</h4>
                  <span>Baseline to current to target</span>
                </div>
                <div className="project-summary-report-kpi-table">
                  <div className="project-summary-report-kpi-row project-summary-report-kpi-row--head">
                    <span>Indicator</span>
                    <span>Baseline</span>
                    <span>Current</span>
                    <span>Target</span>
                    <span>Progress</span>
                  </div>
                  {projectSummaryReport.kpiTracker.map((kpi) => (
                    <div className="project-summary-report-kpi-row" key={kpi.key}>
                      <strong>{kpi.label}</strong>
                      <span>{formatReportMetricValue(kpi.baseline, kpi.unit)}</span>
                      <span>{formatReportMetricValue(kpi.current, kpi.unit)}</span>
                      <span>{formatReportMetricValue(kpi.target, kpi.unit)}</span>
                      <span>{formatPercentLabel(kpi.progressToTarget)}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Recent expenses</h4>
                  <span>Latest 5</span>
                </div>
                <div className="project-summary-report-expense-feed">
                  {projectSummaryReport.recentExpensesFeed.length ? (
                    projectSummaryReport.recentExpensesFeed.map((row) => (
                      <div className="project-summary-report-expense-row" key={row.id}>
                        <div>
                          <strong>{row.title}</strong>
                          <span>
                            {row.vendor} • {row.dateLabel}
                          </span>
                        </div>
                        <div className="project-summary-report-expense-row-right">
                          <strong>{formatCurrency(row.amount)}</strong>
                          <small className={row.hasProof ? "is-proof" : "is-missing-proof"}>
                            {row.hasProof ? "Proof attached" : "Missing proof"}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="project-summary-report-empty">No expense records yet.</p>
                  )}
                </div>
              </article>
            </section>

            <section className="project-summary-report-grid project-summary-report-grid--tertiary">
              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Monitoring and Evaluation Plan</h4>
                  <span>Indicator management matrix</span>
                </div>
                <div className="project-summary-report-me-list">
                  {projectSummaryReport.mePlan.map((indicator) => (
                    <div className="project-summary-report-me-row" key={`me-${indicator.key}`}>
                      <div className="project-summary-report-me-main">
                        <strong>{indicator.label}</strong>
                        <span>
                          Baseline {formatReportMetricValue(indicator.baseline, indicator.unit)} | Current{" "}
                          {formatReportMetricValue(indicator.current, indicator.unit)} | Target{" "}
                          {formatReportMetricValue(indicator.target, indicator.unit)}
                        </span>
                      </div>
                      <p>
                        Source: {indicator.dataSource} | Frequency: {indicator.frequency}
                      </p>
                      <small>Verification: {indicator.verification}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="project-summary-report-card">
                <div className="project-summary-report-card-head">
                  <h4>Sustainability and Continuity</h4>
                  <span>{formatPercentLabel(projectSummaryReport.sustainabilityScore)} score</span>
                </div>
                <div className="project-summary-report-sustainability-head">
                  <span className={`project-summary-report-risk-level is-${projectSummaryReport.sustainabilityScore >= 85 ? "low" : projectSummaryReport.sustainabilityScore >= 70 ? "medium" : "high"}`}>
                    {projectSummaryReport.sustainabilityLabel}
                  </span>
                  <p className="project-summary-report-support-text">
                    Long-term continuity based on financial viability, local capacity, and governance controls.
                  </p>
                </div>
                <div className="project-summary-report-sustainability-list">
                  {projectSummaryReport.sustainabilityPillars.map((pillar) => (
                    <div className="project-summary-report-sustainability-item" key={pillar.key}>
                      <strong>{pillar.title}</strong>
                      <span>{pillar.detail}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>
        ) : null}
      </DataModal>

      <DataModal
        open={Boolean(selectedExpenseDetail)}
        onClose={closeExpenseDetailModal}
        title={
          selectedExpenseDetail
            ? selectedExpenseDetailParsed.title || String(selectedExpenseDetail?.category || "Expense")
            : "Expense detail"
        }
        subtitle={selectedExpenseDetail ? formatDate(selectedExpenseDetail?.expense_date) : ""}
        icon="receipt"
        className="project-submodal"
      >
        {selectedExpenseDetail ? (
          <div className="project-expense-mobile-detail">
            <div className="project-expense-mobile-detail-grid">
              <article>
                <span>Category</span>
                <strong>{String(selectedExpenseDetail?.category || "Other")}</strong>
              </article>
              <article>
                <span>Amount</span>
                <strong>{formatCurrency(selectedExpenseDetail?.amount)}</strong>
              </article>
              <article>
                <span>Vendor</span>
                <strong>{String(selectedExpenseDetail?.vendor || "No vendor")}</strong>
              </article>
              <article>
                <span>Date</span>
                <strong>{formatDate(selectedExpenseDetail?.expense_date)}</strong>
              </article>
            </div>
            <div className="project-expense-mobile-detail-status">
              <span
                className={`project-expense-mobile-flag${
                  hasExpenseProof(selectedExpenseDetail) ? " is-active" : ""
                }`}
              >
                <Icon name="receipt" size={12} />
                {hasExpenseProof(selectedExpenseDetail) ? "Proof attached" : "No proof yet"}
              </span>
              <span
                className={`project-expense-mobile-flag${
                  selectedExpenseDetail?.approved_by ? " is-active" : ""
                }`}
              >
                <Icon name="check-circle" size={12} />
                {selectedExpenseDetail?.approved_by ? "Approved" : "Pending approval"}
              </span>
            </div>
            {selectedExpenseDetail?.payment_reference ? (
              <p className="project-expense-mobile-detail-note">
                Payment ref: <strong>{selectedExpenseDetail.payment_reference}</strong>
              </p>
            ) : null}
            {selectedExpenseDetailParsed.notes ? (
              <p className="project-expense-mobile-detail-note">
                {selectedExpenseDetailParsed.notes}
              </p>
            ) : null}
            <div className="data-modal-actions">
              {selectedExpenseDetail?.receipt_download_url ? (
                <a
                  href={selectedExpenseDetail.receipt_download_url}
                  target="_blank"
                  rel="noreferrer"
                  className="data-modal-btn"
                >
                  View receipt
                </a>
              ) : null}
              {canManageProjectContent ? (
                <button
                  type="button"
                  className="data-modal-btn"
                  onClick={() => {
                    const expense = selectedExpenseDetail;
                    closeExpenseDetailModal();
                    openEditExpenseModal(expense);
                  }}
                >
                  Edit expense
                </button>
              ) : null}
              {canManageProjectContent ? (
                <button
                  type="button"
                  className="data-modal-btn data-modal-btn--danger"
                  onClick={() => {
                    const expenseId = String(selectedExpenseDetail?.id || "").trim();
                    if (!expenseId) return;
                    setSelectedExpenseIds([expenseId]);
                    closeExpenseDetailModal();
                    setShowDeleteExpensesModal(true);
                  }}
                >
                  Delete expense
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DataModal>

      <DataModal
        open={showExpenseModal}
        onClose={closeExpenseModal}
        title={editingExpenseId ? "Edit Expense" : "Add Expense"}
        subtitle={
          editingExpenseId
            ? "Update the selected expense entry."
            : "Record a project expense to keep project records accurate."
        }
        icon="receipt"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleExpenseFormSubmit}>
          {expenseFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{expenseFormError}</p>
          ) : null}
          <div className="data-modal-grid">
            <label className="data-modal-field">
              Expense title
              <input
                type="text"
                placeholder="e.g. Feed purchase"
                value={expenseForm.title}
                onChange={(event) => handleExpenseFormFieldChange("title", event.target.value)}
                disabled={savingExpense}
                required
              />
            </label>
            <label className="data-modal-field">
              Amount (KSh)
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="8000"
                value={expenseForm.amount}
                onChange={(event) => handleExpenseFormFieldChange("amount", event.target.value)}
                disabled={savingExpense}
                required
              />
            </label>
            <label className="data-modal-field">
              Category
              <input
                type="text"
                list="project-expense-category-options"
                placeholder="e.g. Supplies or Training"
                value={expenseForm.category}
                onChange={(event) => handleExpenseFormFieldChange("category", event.target.value)}
                disabled={savingExpense}
                required
              />
              <datalist id="project-expense-category-options">
                {suggestedExpenseCategories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              <div className="data-modal-field-inline">
                <small>Type a custom category or select an existing one.</small>
                <button
                  type="button"
                  className="data-modal-inline-btn"
                  onClick={openExpenseCategoryModal}
                  disabled={savingExpense}
                >
                  <Icon name="settings" size={14} />
                  Manage
                </button>
              </div>
            </label>
            <label className="data-modal-field">
              Vendor
              <input
                type="text"
                list="project-expense-vendor-options"
                placeholder="Select a partner or type a new vendor"
                value={expenseForm.vendor}
                onChange={(event) => handleExpenseFormFieldChange("vendor", event.target.value)}
                disabled={savingExpense}
              />
              <datalist id="project-expense-vendor-options">
                {vendorPartnerOptions.map((partner) => (
                  <option key={`${partner.id}-${partner.name}`} value={partner.name} />
                ))}
              </datalist>
              <small className="project-expense-vendor-helper">
                {organizationPartnersLoading
                  ? "Loading organization partners..."
                  : "Vendor list is based on Organization Partners. New names are added automatically."}
              </small>
              {selectedVendorPartner ? (
                <div className="project-expense-vendor-preview">
                  {selectedVendorPartner.logo_url ? (
                    <img
                      src={selectedVendorPartner.logo_url}
                      alt={`${selectedVendorPartner.name} logo`}
                      className="project-expense-vendor-logo"
                      loading="lazy"
                    />
                  ) : (
                    <span className="project-expense-vendor-fallback" aria-hidden="true">
                      {getProjectExpenseVendorInitials(selectedVendorPartner.name)}
                    </span>
                  )}
                  <span className="project-expense-vendor-preview-text">Using partner record</span>
                </div>
              ) : null}
            </label>
            <label className="data-modal-field">
              Payment reference
              <input
                type="text"
                placeholder="e.g. M-PESA QWE123ABC"
                value={expenseForm.paymentReference}
                onChange={(event) =>
                  handleExpenseFormFieldChange("paymentReference", event.target.value)
                }
                disabled={savingExpense}
              />
            </label>
            <label className="data-modal-field">
              Date
              <input
                type="date"
                value={expenseForm.date}
                onChange={(event) => handleExpenseFormFieldChange("date", event.target.value)}
                disabled={savingExpense}
                required
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Receipt or proof
              <div
                className={`project-expense-upload-dropzone${expenseReceiptDragActive ? " is-drag-active" : ""}${
                  savingExpense ? " is-disabled" : ""
                }`}
                role="button"
                tabIndex={savingExpense ? -1 : 0}
                aria-disabled={savingExpense}
                onClick={triggerExpenseFormReceiptPicker}
                onKeyDown={(event) => {
                  if (savingExpense) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    triggerExpenseFormReceiptPicker();
                  }
                }}
                onDragOver={handleExpenseReceiptDragOver}
                onDragEnter={handleExpenseReceiptDragOver}
                onDragLeave={handleExpenseReceiptDragLeave}
                onDrop={handleExpenseReceiptDrop}
              >
                <span className="project-expense-upload-icon" aria-hidden="true">
                  <Icon name="upload" size={18} />
                </span>
                <div className="project-expense-upload-copy">
                  <strong>Drag and drop receipt here</strong>
                  <p>or click to upload a PDF or image file</p>
                </div>
                <button
                  type="button"
                  className="data-modal-inline-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    triggerExpenseFormReceiptPicker();
                  }}
                  disabled={savingExpense}
                >
                  Choose file
                </button>
              </div>
              <input
                ref={expenseFormReceiptInputRef}
                type="file"
                className="project-documents-file-input"
                accept={PROJECT_EXPENSE_RECEIPT_ACCEPT}
                onChange={handleExpenseFormReceiptFileChange}
                disabled={savingExpense}
              />
              <small className="project-expense-upload-helper">
                Upload .pdf or image proof. If unavailable, use payment reference only.
              </small>
              {expenseForm.receiptFile ? (
                <div className="project-expense-upload-file">
                  <span className="project-expense-upload-file-icon" aria-hidden="true">
                    <Icon name="receipt" size={16} />
                  </span>
                  <div className="project-expense-upload-file-copy">
                    <strong>{expenseForm.receiptFile.name}</strong>
                    <small>{formatFileSize(expenseForm.receiptFile.size)}</small>
                  </div>
                  <button
                    type="button"
                    className="data-modal-inline-btn"
                    onClick={clearExpenseFormReceiptFile}
                    disabled={savingExpense}
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              {expenseForm.existingReceiptUrl ? (
                <a
                  className="project-expense-receipt-link project-expense-receipt-link--inline"
                  href={expenseForm.existingReceiptUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View current receipt
                </a>
              ) : null}
            </label>
            <label className="data-modal-field data-modal-field--full">
              Notes
              <textarea
                rows="4"
                placeholder="Add notes or reference numbers."
                value={expenseForm.notes}
                onChange={(event) => handleExpenseFormFieldChange("notes", event.target.value)}
                disabled={savingExpense}
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeExpenseModal} disabled={savingExpense}>
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingExpense}>
              {savingExpense ? "Saving..." : editingExpenseId ? "Update expense" : "Save expense"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={showExpenseCategoryModal}
        onClose={closeExpenseCategoryModal}
        title="Expense Categories"
        subtitle="Create, rename, and archive categories for this project."
        icon="settings"
        className="project-submodal"
      >
        <div className="project-expense-category-manager">
          <form className="project-expense-category-form" onSubmit={handleSaveExpenseCategory}>
            <label className="data-modal-field data-modal-field--full">
              Category name
              <input
                type="text"
                placeholder="e.g. Training"
                value={expenseCategoryInput}
                onChange={(event) => {
                  setExpenseCategoryInput(event.target.value);
                  if (expenseCategoriesError) setExpenseCategoriesError("");
                }}
                disabled={savingExpenseCategory}
                required
              />
            </label>
            <div className="data-modal-actions">
              {editingExpenseCategoryId ? (
                <button
                  type="button"
                  className="data-modal-btn"
                  onClick={cancelEditingExpenseCategory}
                  disabled={savingExpenseCategory}
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                type="submit"
                className="data-modal-btn data-modal-btn--primary"
                disabled={savingExpenseCategory}
              >
                {savingExpenseCategory
                  ? editingExpenseCategoryId
                    ? "Saving..."
                    : "Adding..."
                  : editingExpenseCategoryId
                    ? "Save category"
                    : "Add category"}
              </button>
            </div>
          </form>

          {expenseCategoriesError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{expenseCategoriesError}</p>
          ) : null}

          {expenseCategoriesLoading ? (
            <div className="project-expenses-loading">
              <div className="loading-spinner"></div>
              <span>Loading categories...</span>
            </div>
          ) : expenseCategoryRows.length === 0 ? (
            <div className="project-detail-empty">
              <Icon name="tag" size={22} />
              <span>No categories yet. Add your first category above.</span>
            </div>
          ) : (
            <div className="project-expense-category-table-wrap">
              <table className="projects-table-view project-expense-category-table">
                <thead>
                  <tr>
                    <th className="project-category-col-name">Category</th>
                    <th className="project-category-col-usage">Used in expenses</th>
                    <th className="project-category-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseCategoryRows.map((categoryRow) => {
                    const categoryId = String(categoryRow?.id || "");
                    const categoryName = String(categoryRow?.name || "").trim();
                    const usageCount = expenseCategoryUsage.get(categoryName) || 0;
                    const isEditing = editingExpenseCategoryId === categoryId;
                    const isArchiving = archivingExpenseCategoryId === categoryId;
                    return (
                      <tr key={categoryId || categoryName}>
                        <td className="project-category-col-name">
                          <span className="project-category-chip">{categoryName || "—"}</span>
                        </td>
                        <td className="project-category-col-usage">{usageCount}</td>
                        <td className="project-category-col-actions">
                          <div className="project-expense-category-actions">
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={() => startEditingExpenseCategory(categoryRow)}
                              disabled={savingExpenseCategory || Boolean(archivingExpenseCategoryId)}
                            >
                              {isEditing ? "Editing" : "Rename"}
                            </button>
                            <button
                              type="button"
                              className="project-detail-action ghost danger"
                              onClick={() => handleArchiveExpenseCategory(categoryRow)}
                              disabled={savingExpenseCategory || isArchiving}
                            >
                              {isArchiving ? "Archiving..." : "Archive"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeExpenseCategoryModal}
              disabled={savingExpenseCategory || Boolean(archivingExpenseCategoryId)}
            >
              Close
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showDeleteExpensesModal}
        onClose={closeDeleteExpensesModal}
        title={`Delete ${selectedExpenses.length} expense${selectedExpenses.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
        className="project-submodal"
      >
        <div className="projects-confirm-modal">
          <p>
            Selected expense records will be permanently removed from this project.
          </p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeDeleteExpensesModal}
              disabled={deletingExpenses}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleConfirmDeleteSelectedExpenses}
              disabled={deletingExpenses || selectedExpenses.length === 0}
            >
              {deletingExpenses ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showRenameDocumentModal}
        onClose={closeRenameSelectedDocumentModal}
        title="Rename Document"
        subtitle="Update the selected project document name."
        icon="folder"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleConfirmRenameSelectedDocument}>
          {documentRenameError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{documentRenameError}</p>
          ) : null}
          <div className="data-modal-grid">
            <label className="data-modal-field data-modal-field--full">
              Document name
              <input
                type="text"
                value={documentRenameValue}
                onChange={(event) => {
                  setDocumentRenameValue(event.target.value);
                  if (documentRenameError) setDocumentRenameError("");
                }}
                disabled={renamingDocument}
                required
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeRenameSelectedDocumentModal}
              disabled={renamingDocument}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={renamingDocument}
            >
              {renamingDocument ? "Saving..." : "Save name"}
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
        className="project-submodal"
      >
        <div className="projects-confirm-modal">
          <p>
            Selected documents will be permanently removed from this project.
          </p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeDeleteDocumentsModal}
              disabled={deletingDocuments}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleConfirmDeleteSelectedDocuments}
              disabled={deletingDocuments || selectedDocuments.length === 0}
            >
              {deletingDocuments ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showTaskModal}
        onClose={closeTaskModal}
        title={editingTaskId ? "Edit Task" : "Add Task"}
        subtitle="Assign tasks and deadlines to keep the project on track."
        icon="check-circle"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleTaskFormSubmit}>
          {taskFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{taskFormError}</p>
          ) : null}
          <div className="data-modal-grid">
            <label className="data-modal-field">
              Task title
              <input
                type="text"
                placeholder="e.g. Collect member contributions"
                value={taskForm.title}
                onChange={(event) => handleTaskFormFieldChange("title", event.target.value)}
                disabled={savingTask}
                required
              />
            </label>
            <label className="data-modal-field">
              Assignee
              <select
                value={taskForm.assigneeId}
                onChange={(event) => handleTaskFormFieldChange("assigneeId", event.target.value)}
                disabled={savingTask || projectAssignableMembersLoading}
              >
                <option value="">
                  {projectAssignableMembersLoading ? "Loading members..." : "Unassigned"}
                </option>
                {projectAssignableMembers.map((member) => (
                  <option key={`task-member-${member.id}`} value={String(member.id)}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Due date
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(event) => handleTaskFormFieldChange("dueDate", event.target.value)}
                disabled={savingTask}
              />
            </label>
            <label className="data-modal-field">
              Priority
              <select
                value={taskForm.priority}
                onChange={(event) => handleTaskFormFieldChange("priority", event.target.value)}
                disabled={savingTask}
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={`task-priority-${value}`} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Status
              <select
                value={taskForm.status}
                onChange={(event) => handleTaskFormFieldChange("status", event.target.value)}
                disabled={savingTask}
              >
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={`task-status-${value}`} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field data-modal-field--full">
              Task details
              <textarea
                rows="4"
                placeholder="Add details or instructions."
                value={taskForm.details}
                onChange={(event) => handleTaskFormFieldChange("details", event.target.value)}
                disabled={savingTask}
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeTaskModal} disabled={savingTask}>
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingTask}>
              {savingTask ? "Saving..." : editingTaskId ? "Update task" : "Save task"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={Boolean(activeTaskDetails)}
        onClose={closeTaskDetailsModal}
        title={activeTaskDetails?.title || "Task details"}
        subtitle="Full task context and current delivery state."
        icon="check-circle"
        className="project-submodal"
      >
        <div className="project-note-details-modal">
          <div className="project-note-details-meta">
            <div>
              <span>Status</span>
              <strong>
                {TASK_STATUS_LABELS[
                  String(activeTaskDetails?.status || "open")
                    .trim()
                    .toLowerCase()
                ] || toReadableLabel(String(activeTaskDetails?.status || "open"))}
              </strong>
            </div>
            <div>
              <span>Priority</span>
              <strong>
                {TASK_PRIORITY_LABELS[
                  String(activeTaskDetails?.priority || "normal")
                    .trim()
                    .toLowerCase()
                ] || toReadableLabel(String(activeTaskDetails?.priority || "normal"))}
              </strong>
            </div>
            <div>
              <span>Assignee</span>
              <strong>
                {activeTaskDetails?.assignee_name ||
                  (activeTaskDetails?.assignee_member_id ? `Member #${activeTaskDetails.assignee_member_id}` : "Unassigned")}
              </strong>
            </div>
            <div>
              <span>Due date</span>
              <strong>{formatDate(activeTaskDetails?.due_date)}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatDate(activeTaskDetails?.updated_at || activeTaskDetails?.created_at)}</strong>
            </div>
          </div>
          <div className="project-note-details-body">
            {String(activeTaskDetails?.details || "").trim() || "No details were provided for this task."}
          </div>
          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeTaskDetailsModal}>
              Close
            </button>
            {canManageProjectContent ? (
              <button
                type="button"
                className="data-modal-btn data-modal-btn--primary"
                onClick={() => {
                  const task = activeTaskDetails;
                  closeTaskDetailsModal();
                  openTaskEditorForRow(task);
                }}
                disabled={!activeTaskDetails}
              >
                Edit task
              </button>
            ) : null}
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showNoteModal}
        onClose={closeNoteModal}
        title={editingNoteId ? "Edit Note" : "Add Note"}
        subtitle="Capture important decisions or context for the team."
        icon="notes"
        className="project-submodal"
      >
        <form className="data-modal-form" onSubmit={handleNoteFormSubmit}>
          {noteFormError ? (
            <p className="data-modal-feedback data-modal-feedback--error">{noteFormError}</p>
          ) : null}
          <div className="data-modal-grid">
            <label className="data-modal-field">
              Note title
              <input
                type="text"
                placeholder="e.g. Supplier meeting recap"
                value={noteForm.title}
                onChange={(event) => handleNoteFormFieldChange("title", event.target.value)}
                disabled={savingNote}
                required
              />
            </label>
            <label className="data-modal-field">
              Visibility
              <select
                value={noteForm.visibility}
                onChange={(event) => handleNoteFormFieldChange("visibility", event.target.value)}
                disabled={savingNote}
              >
                {Object.entries(NOTE_VISIBILITY_LABELS).map(([value, label]) => (
                  <option key={`note-visibility-${value}`} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {noteForm.visibility === "selected_members" ? (
              <label className="data-modal-field data-modal-field--full">
                Members with access
                <div className="note-visibility-member-list">
                  {projectAssignableMembersLoading ? (
                    <p className="note-visibility-member-empty">Loading members...</p>
                  ) : noteVisibilityMemberOptions.length === 0 ? (
                    <p className="note-visibility-member-empty">No members available yet.</p>
                  ) : (
                    noteVisibilityMemberOptions.map((member) => {
                      const isChecked = selectedNoteVisibilityMemberIds.has(member.id);
                      const memberRole = String(member?.role || "").trim();
                      return (
                        <label
                          key={`note-visibility-member-${member.id}`}
                          className={`note-visibility-member-row${isChecked ? " is-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleNoteVisibilityMember(member.id)}
                            disabled={savingNote}
                          />
                          <span className="note-visibility-member-meta">
                            <strong>{member.name}</strong>
                            {memberRole ? <small>{toReadableLabel(memberRole, "Member")}</small> : null}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                <small className="note-visibility-member-help">
                  Selected members, the note owner, and org admins/superadmins can access this note.
                </small>
              </label>
            ) : noteForm.visibility === "owner_only" ? (
              <label className="data-modal-field data-modal-field--full">
                <small className="note-visibility-member-help">
                  Only the note owner and org admins/superadmins can access this note.
                </small>
              </label>
            ) : null}
            <label className="data-modal-field data-modal-field--full">
              Note details
              <textarea
                rows="5"
                placeholder="Write the note here."
                value={noteForm.details}
                onChange={(event) => handleNoteFormFieldChange("details", event.target.value)}
                disabled={savingNote}
              />
            </label>
          </div>
          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeNoteModal} disabled={savingNote}>
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary" disabled={savingNote}>
              {savingNote ? "Saving..." : editingNoteId ? "Update note" : "Save note"}
            </button>
          </div>
        </form>
      </DataModal>

      <DataModal
        open={Boolean(activeNoteDetails)}
        onClose={closeNoteDetailsModal}
        title={activeNoteDetails?.title || "Note details"}
        subtitle="Full note content and visibility details."
        icon="notes"
        className="project-submodal"
      >
        <div className="project-note-details-modal">
          <div className="project-note-details-meta">
            <div>
              <span>Visibility</span>
              <strong>
                {getNoteVisibilityLabel(activeNoteDetails?.visibility, activeNoteDetails?.visible_member_ids)}
              </strong>
            </div>
            <div>
              <span>Author</span>
              <strong>
                {activeNoteDetails?.author_name ||
                  (activeNoteDetails?.author_member_id ? `Member #${activeNoteDetails.author_member_id}` : "—")}
              </strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatDate(activeNoteDetails?.updated_at || activeNoteDetails?.created_at)}</strong>
            </div>
          </div>
          <div className="project-note-details-body">
            {String(activeNoteDetails?.body || "").trim() || "No details were provided for this note."}
          </div>
          <div className="data-modal-actions">
            <button type="button" className="data-modal-btn" onClick={closeNoteDetailsModal}>
              Close
            </button>
            {canManageProjectContent ? (
              <button
                type="button"
                className="data-modal-btn data-modal-btn--primary"
                onClick={() => {
                  const note = activeNoteDetails;
                  closeNoteDetailsModal();
                  openNoteEditorForRow(note);
                }}
                disabled={!activeNoteDetails}
              >
                Edit note
              </button>
            ) : null}
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showDeleteTasksModal}
        onClose={closeDeleteTasksModal}
        title={`Delete ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
        className="project-submodal"
      >
        <div className="projects-confirm-modal">
          <p>
            Selected tasks will be permanently removed from this project.
          </p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeDeleteTasksModal}
              disabled={deletingTasks}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleConfirmDeleteSelectedTasks}
              disabled={deletingTasks || selectedTasks.length === 0}
            >
              {deletingTasks ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>

      <DataModal
        open={showDeleteNotesModal}
        onClose={closeDeleteNotesModal}
        title={`Delete ${selectedNotes.length} note${selectedNotes.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
        className="project-submodal"
      >
        <div className="projects-confirm-modal">
          <p>
            Selected notes will be permanently removed from this project.
          </p>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={closeDeleteNotesModal}
              disabled={deletingNotes}
            >
              Cancel
            </button>
            <button
              type="button"
              className="data-modal-btn data-modal-btn--danger"
              onClick={handleConfirmDeleteSelectedNotes}
              disabled={deletingNotes || selectedNotes.length === 0}
            >
              {deletingNotes ? "Deleting..." : "Delete selected"}
            </button>
          </div>
        </div>
      </DataModal>
    </div>
  );
}

export default ProjectsPage;
