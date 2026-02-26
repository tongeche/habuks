import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  archiveProjectExpenseCategory,
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
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import ProjectEditorForm from "./ProjectEditorForm.jsx";

const projectPageMap = {
  jpp: "projects-jpp",
  jgf: "projects-jgf",
};

const PROJECT_VIEW_OPTIONS = [
  { key: "grid", label: "Grid", icon: "layers" },
  { key: "table", label: "Table", icon: "menu" },
  { key: "list", label: "List", icon: "newspaper" },
];

const resolveModuleKey = (project) => {
  const raw = project?.module_key || project?.code || "";
  const lower = String(raw).trim().toLowerCase();
  if (lower === "jpp" || lower === "jgf") return lower;
  const upper = String(raw).trim().toUpperCase();
  if (upper === "JPP") return "jpp";
  if (upper === "JGF") return "jgf";
  return "";
};

const createInitialProjectForm = () => ({
  name: "",
  moduleKey: "generic",
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
  details: "",
});

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

const NOTE_VISIBILITY_LABELS = {
  project_team: "Project team",
  admins_only: "Admins only",
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

const normalizeModuleKeyForForm = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "jpp" || normalized === "jgf" || normalized === "generic") {
    return normalized;
  }
  return "generic";
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
  const expectedRevenueRow = budgetByItem.get("expected revenue");
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

function ProjectsPage({ user, setActivePage, tenantId, onManageProject }) {
  const projectDocumentInputRef = useRef(null);
  const expenseReceiptInputRef = useRef(null);
  const expenseFormReceiptInputRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [createProjectForm, setCreateProjectForm] = useState(() => createInitialProjectForm());
  const [creatingProject, setCreatingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [loadingProjectEditor, setLoadingProjectEditor] = useState(false);
  const [createProjectError, setCreateProjectError] = useState("");
  const [projectsNotice, setProjectsNotice] = useState(null);
  const [projectView, setProjectView] = useState("grid");
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [openProjectMenuId, setOpenProjectMenuId] = useState(null);
  const [projectActionInFlightId, setProjectActionInFlightId] = useState(null);
  const [projectActionConfirm, setProjectActionConfirm] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectAssignableMembers, setProjectAssignableMembers] = useState([]);
  const [projectAssignableMembersLoading, setProjectAssignableMembersLoading] = useState(false);
  const [projectDocuments, setProjectDocuments] = useState([]);
  const [projectDocumentsLoading, setProjectDocumentsLoading] = useState(false);
  const [projectDocumentsError, setProjectDocumentsError] = useState("");
  const [projectDocumentMode, setProjectDocumentMode] = useState("upload");
  const [emitDocumentType, setEmitDocumentType] = useState(PROJECT_EMIT_DOCUMENT_OPTIONS[0].value);
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
  const [detailTab, setDetailTab] = useState("overview");
  const [overviewRange, setOverviewRange] = useState(DEFAULT_PROJECT_OVERVIEW_RANGE);
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
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [taskForm, setTaskForm] = useState(() => createInitialTaskForm());
  const [taskFormError, setTaskFormError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState(false);
  const [showDeleteTasksModal, setShowDeleteTasksModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
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
  const [organizationPartners, setOrganizationPartners] = useState([]);
  const [organizationPartnersLoading, setOrganizationPartnersLoading] = useState(false);
  const role = String(user?.role || "member").toLowerCase();
  const isAdmin = ["admin", "superadmin"].includes(role);
  const canCreateProject = ["project_manager", "admin", "superadmin"].includes(role);
  const canSelfManageMembership = isAdmin;
  const parsedEditingProjectId = Number.parseInt(String(editingProjectId ?? ""), 10);
  const isEditingProject = Number.isInteger(parsedEditingProjectId) && parsedEditingProjectId > 0;

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

  const openCreateProjectModal = () => {
    if (!canCreateProject) return;
    setActiveTab("info");
    setEditingProjectId(null);
    setLoadingProjectEditor(false);
    resetCreateProjectForm();
    setProjectsNotice(null);
    setShowCreateModal(true);
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
      console.error("Error loading project editor data:", error);
      setCreateProjectError(error?.message || "Failed to load project details.");
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
    if (!openProjectMenuId) {
      return undefined;
    }
    const handleWindowClick = () => setOpenProjectMenuId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [openProjectMenuId]);

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

  const mediaFolderPreview = useMemo(
    () => `tenants/${tenantId || "global"}/projects/{projectId}/media`,
    [tenantId]
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

    const totalBudget = parseOptionalMoney(createProjectForm.totalBudget);
    if (Number.isNaN(totalBudget)) {
      setActiveTab("budget");
      setCreateProjectError("Total budget must be a valid non-negative number.");
      return;
    }

    const expectedRevenue = parseOptionalMoney(createProjectForm.expectedRevenue);
    if (Number.isNaN(expectedRevenue)) {
      setActiveTab("budget");
      setCreateProjectError("Expected revenue must be a valid non-negative number.");
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
          module_key: createProjectForm.moduleKey,
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
            noticeParts.push("Some member assignments failed to update.");
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
            module_key: createProjectForm.moduleKey,
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
              item: "Expected revenue",
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
              "Project created, but some member assignments failed due to permission or policy limits."
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
      console.error("Error saving project:", error);
      setActiveTab("info");
      setCreateProjectError(
        error?.message || (isEditingProject ? "Failed to update project." : "Failed to create project.")
      );
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
      console.error("Error joining project:", error);
      alert(error.message);
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
      console.error("Error leaving project:", error);
      alert(error.message);
    } finally {
      setJoiningId(null);
    }
  };

  const handleToggleProjectMenu = (projectId, event) => {
    event.stopPropagation();
    if (projectActionInFlightId) return;
    setOpenProjectMenuId((prev) => (prev === projectId ? null : projectId));
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
  };

  const requestDeleteProject = (project) => {
    if (!canCreateProject || !project?.id) return;
    setProjectActionConfirm({
      type: "delete",
      projects: [project],
      title: "Delete project?",
      subtitle: `Delete "${project.name}" and its linked records that can be safely removed.`,
      confirmLabel: "Delete project",
    });
    setOpenProjectMenuId(null);
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

      if (type === "visibility") {
        for (const project of targets) {
          try {
            await setIgaProjectVisibility(project.id, Boolean(nextVisible), tenantId);
            successCount += 1;
          } catch (error) {
            failureCount += 1;
            console.error("Error updating project visibility:", error);
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
        }
      }

      if (type === "delete") {
        for (const project of targets) {
          try {
            await deleteIgaProject(project.id, tenantId);
            successCount += 1;
            deletedIds.push(Number.parseInt(String(project.id), 10));
          } catch (error) {
            failureCount += 1;
            console.error("Error deleting project:", error);
          }
        }

        if (deletedIds.length && selectedProject?.id) {
          const selectedId = Number.parseInt(String(selectedProject.id), 10);
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

  const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return "—";
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(amount);
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

  const getProjectProgress = (project) => {
    const raw =
      project?.progress ??
      project?.completion ??
      project?.completion_rate ??
      project?.percent_complete;
    if (typeof raw === "number" && !Number.isNaN(raw)) {
      const normalized = raw <= 1 ? raw * 100 : raw;
      return Math.max(0, Math.min(100, Math.round(normalized)));
    }
    switch (project?.status?.toLowerCase()) {
      case "completed":
        return 100;
      case "planning":
        return 24;
      case "active":
        return 62;
      default:
        return 45;
    }
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
    if (!canCreateProject) return null;
    const isVisible = project?.is_visible !== false;
    const isActionBusy = projectActionInFlightId === project.id;
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
          aria-expanded={openProjectMenuId === project.id}
          aria-label={`Project actions for ${project.name}`}
          onClick={(event) => handleToggleProjectMenu(project.id, event)}
          disabled={isActionBusy}
        >
          <Icon name="more-horizontal" size={16} />
        </button>
        {openProjectMenuId === project.id ? (
          <div className="project-card-menu-dropdown" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => openEditProjectModal(project)}
              disabled={isActionBusy}
            >
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => requestProjectVisibilityToggle(project)}
              disabled={isActionBusy}
            >
              {isVisible ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => requestDeleteProject(project)}
              disabled={isActionBusy}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const openProjectDetails = (project) => {
    setSelectedProject(project);
    setDetailTab("overview");
    setOverviewRange(DEFAULT_PROJECT_OVERVIEW_RANGE);
  };

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

  const recentProjectExpenses = useMemo(() => {
    return [...projectExpenses]
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.expense_date || a?.created_at || ""));
        const bTime = Date.parse(String(b?.expense_date || b?.created_at || ""));
        const safeA = Number.isFinite(aTime) ? aTime : 0;
        const safeB = Number.isFinite(bTime) ? bTime : 0;
        return safeB - safeA;
      })
      .slice(0, 10);
  }, [projectExpenses]);

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
    const progressPercent = getProjectProgress(selectedProject);
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

      const hasProof =
        Boolean(expense?.receipt) ||
        Boolean(expense?.receipt_file_path) ||
        Boolean(expense?.receipt_file_url) ||
        Boolean(String(expense?.payment_reference || "").trim());
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
      const hasProof =
        Boolean(expense?.receipt) ||
        Boolean(expense?.receipt_download_url) ||
        Boolean(expense?.receipt_file_path) ||
        Boolean(expense?.receipt_file_url) ||
        Boolean(String(expense?.payment_reference || "").trim());

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

  const expenseRowIds = useMemo(
    () =>
      recentProjectExpenses
        .map((expense) => String(expense?.id ?? ""))
        .filter(Boolean),
    [recentProjectExpenses]
  );

  useEffect(() => {
    const visibleExpenseSet = new Set(expenseRowIds);
    setSelectedExpenseIds((prev) => prev.filter((expenseId) => visibleExpenseSet.has(expenseId)));
  }, [expenseRowIds]);

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

  const openEditSelectedExpenseModal = () => {
    if (selectedExpenses.length !== 1) return;
    const expense = selectedExpenses[0];
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

  const requestDeleteSelectedExpenses = () => {
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
    setEmitDocumentType(PROJECT_EMIT_DOCUMENT_OPTIONS[0].value);
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

    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
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

  const handleExportVisibleExpensesCsv = () => {
    if (!recentProjectExpenses.length) {
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
      "Amount (KES)",
      "Description",
      "Payment Reference",
      "Receipt",
    ];
    const csvRows = recentProjectExpenses.map((expense) => [
      selectedProject?.name || "",
      expense?.expense_date || "",
      expense?.category || "",
      expense?.vendor || "",
      Number(expense?.amount || 0),
      expense?.description || "",
      expense?.payment_reference || "",
      expense?.receipt ? "Yes" : "No",
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
    link.download = `${slug}-expenses-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    setProjectsNotice({
      type: "success",
      message: `Exported ${recentProjectExpenses.length} expense row(s) to CSV.`,
    });
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
    if (selectedExpenses.length !== 1 || savingExpense || deletingExpenses || uploadingExpenseReceipt) return;
    const targetExpenseId = String(selectedExpenses[0]?.id ?? "").trim();
    if (!targetExpenseId) return;
    setReceiptUploadExpenseId(targetExpenseId);
    setProjectExpensesError("");
    expenseReceiptInputRef.current?.click();
  };

  const handleSelectedExpenseReceiptFileSelection = async (event) => {
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
    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    const normalizedEditingExpenseId = String(editingExpenseId || "").trim();
    const isEditingExpense = Boolean(normalizedEditingExpenseId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
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
        const hasExistingReceipt =
          Boolean(existingExpense?.receipt) ||
          Boolean(existingExpense?.receipt_file_path) ||
          Boolean(existingExpense?.receipt_file_url);

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

  useEffect(() => {
    const visibleDocumentSet = new Set(documentRowIds);
    setSelectedDocumentIds((prev) => prev.filter((documentId) => visibleDocumentSet.has(documentId)));
  }, [documentRowIds]);

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

  const triggerProjectDocumentPicker = () => {
    if (
      !canCreateProject ||
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
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    if (!files.length) return;
    if (!Number.isInteger(projectId) || projectId <= 0) {
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
    if (!canCreateProject || selectedDocumentIds.length !== 1) return;
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

    if (!canCreateProject || selectedDocumentIds.length !== 1) {
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
    const progressPercent = getProjectProgress(selectedProject);

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

    const expensesWithProofCount = expensesSorted.filter(
      (expense) =>
        Boolean(expense?.receipt) ||
        Boolean(expense?.receipt_file_path) ||
        Boolean(expense?.receipt_file_url) ||
        Boolean(String(expense?.payment_reference || "").trim())
    ).length;
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
    appendWrappedPdfLine(lines, `Expected revenue: ${formatCurrency(context.revenueAmount)}`);
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
      `Strengthen financial outcomes by controlling expenses and moving toward expected revenue of ${formatCurrency(
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
    appendWrappedPdfLine(lines, `Expected revenue: ${formatCurrency(context.revenueAmount)}`);
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
      )}) while working toward expected revenue (${formatCurrency(context.revenueAmount)}).`
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

  const buildEmitDocumentFile = (selectedOption) => {
    const safeOption = selectedOption || PROJECT_EMIT_DOCUMENT_OPTIONS[0];
    const safeProjectName = String(selectedProject?.name || "Project").trim();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `${toFilenameSlug(safeProjectName)}-${safeOption.value}-${dateStamp}.pdf`;
    const title = `${safeOption.label} - ${safeProjectName}`;
    const context = buildProjectDocumentContext();
    const lines = buildEmitDocumentLines(safeOption.value, context);
    const blob = buildSimplePdfBlob(title, lines);
    return new File([blob], fileName, { type: "application/pdf" });
  };

  const handlePrepareEmitDocument = async () => {
    if (
      !canCreateProject ||
      uploadingProjectDocument ||
      deletingDocuments ||
      emittingProjectDocument ||
      renamingDocument
    ) {
      return;
    }
    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setProjectDocumentsError("Select a valid project before emitting documents.");
      return;
    }

    const selectedOption =
      PROJECT_EMIT_DOCUMENT_OPTIONS.find((option) => option.value === emitDocumentType) ||
      PROJECT_EMIT_DOCUMENT_OPTIONS[0];
    setEmittingProjectDocument(true);
    setProjectDocumentsError("");

    try {
      const emittedFile = buildEmitDocumentFile(selectedOption);
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

  const openTaskModal = () => {
    const defaultAssignee = parseMemberId(user?.id);
    setEditingTaskId(null);
    setTaskForm({
      ...createInitialTaskForm(),
      assigneeId: defaultAssignee ? String(defaultAssignee) : "",
      dueDate: new Date().toISOString().slice(0, 10),
    });
    setTaskFormError("");
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    if (savingTask) return;
    setShowTaskModal(false);
    setTaskFormError("");
    setEditingTaskId(null);
  };

  const openEditSelectedTaskModal = () => {
    if (selectedTasks.length !== 1) return;
    const task = selectedTasks[0];
    setEditingTaskId(String(task?.id ?? ""));
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
  };

  const requestDeleteSelectedTasks = () => {
    if (!selectedTasks.length) return;
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
    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    const parsedEditingTaskId = String(editingTaskId || "").trim();
    const isEditingTask = Boolean(parsedEditingTaskId);

    if (!Number.isInteger(projectId) || projectId <= 0) {
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

  const sortedProjectNotes = useMemo(() => {
    return [...projectNotes].sort((a, b) => {
      const aTime = Date.parse(String(a?.created_at || ""));
      const bTime = Date.parse(String(b?.created_at || ""));
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeB - safeA;
    });
  }, [projectNotes]);

  const filteredProjectNotes = useMemo(() => {
    const normalizedSearch = String(noteSearchQuery || "")
      .trim()
      .toLowerCase();
    return sortedProjectNotes.filter((note) => {
      const safeVisibility = String(note?.visibility || "project_team")
        .trim()
        .toLowerCase();
      if (noteVisibilityFilter !== "all" && safeVisibility !== noteVisibilityFilter) {
        return false;
      }
      if (!normalizedSearch) return true;

      const haystack = [note?.title, note?.body, note?.author_name]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(normalizedSearch);
    });
  }, [sortedProjectNotes, noteSearchQuery, noteVisibilityFilter]);

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

  const openNoteModal = () => {
    setEditingNoteId(null);
    setNoteForm(createInitialNoteForm());
    setNoteFormError("");
    setShowNoteModal(true);
  };

  const closeNoteModal = () => {
    if (savingNote) return;
    setShowNoteModal(false);
    setNoteFormError("");
    setEditingNoteId(null);
  };

  const openEditSelectedNoteModal = () => {
    if (selectedNotes.length !== 1) return;
    const note = selectedNotes[0];
    setEditingNoteId(String(note?.id ?? ""));
    setNoteForm({
      title: String(note?.title || ""),
      visibility: String(note?.visibility || "project_team"),
      details: String(note?.body || ""),
    });
    setNoteFormError("");
    setShowNoteModal(true);
  };

  const requestDeleteSelectedNotes = () => {
    if (!selectedNotes.length) return;
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

  const handleNoteFormFieldChange = (field, value) => {
    setNoteForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (noteFormError) {
      setNoteFormError("");
    }
  };

  const handleNoteFormSubmit = async (event) => {
    event.preventDefault();
    const projectId = Number.parseInt(String(selectedProject?.id ?? ""), 10);
    const parsedEditingNoteId = String(editingNoteId || "").trim();
    const isEditingNote = Boolean(parsedEditingNoteId);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      setNoteFormError("Select a valid project before adding a note.");
      return;
    }

    const title = String(noteForm.title || "").trim();
    const visibility = String(noteForm.visibility || "project_team").trim().toLowerCase();
    const body = String(noteForm.details || "").trim();
    const currentUserId = parseMemberId(user?.id);

    if (!title) {
      setNoteFormError("Note title is required.");
      return;
    }
    if (visibility !== "project_team" && visibility !== "admins_only") {
      setNoteFormError("Select a valid visibility.");
      return;
    }

    setSavingNote(true);
    setNoteFormError("");

    try {
      if (isEditingNote) {
        await updateProjectNote(
          parsedEditingNoteId,
          {
            title,
            visibility,
            body: body || null,
          },
          tenantId
        );
      } else {
        await createProjectNote(
          projectId,
          {
            title,
            visibility,
            body: body || null,
            author_member_id: currentUserId,
          },
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

  const visibleProjects = isAdmin
    ? projects
    : projects.filter(
        (project) =>
          project.is_visible !== false &&
          (project.membership || project.project_leader === user?.id)
      );

  const visibleProjectIds = useMemo(
    () =>
      visibleProjects
        .map((project) => Number.parseInt(String(project?.id), 10))
        .filter((projectId) => Number.isInteger(projectId) && projectId > 0),
    [visibleProjects]
  );

  const selectedProjects = useMemo(() => {
    const selectedIdSet = new Set(selectedProjectIds);
    return visibleProjects.filter((project) =>
      selectedIdSet.has(Number.parseInt(String(project?.id), 10))
    );
  }, [visibleProjects, selectedProjectIds]);

  useEffect(() => {
    const visibleIdSet = new Set(visibleProjectIds);
    setSelectedProjectIds((prev) => prev.filter((projectId) => visibleIdSet.has(projectId)));
  }, [visibleProjectIds]);

  const allVisibleSelected =
    visibleProjectIds.length > 0 &&
    visibleProjectIds.every((projectId) => selectedProjectIds.includes(projectId));

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedProjectIds([]);
      return;
    }
    setSelectedProjectIds(visibleProjectIds);
  };

  const handleToggleProjectSelection = (projectId) => {
    const parsedProjectId = Number.parseInt(String(projectId), 10);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) return;
    setSelectedProjectIds((prev) => {
      if (prev.includes(parsedProjectId)) {
        return prev.filter((id) => id !== parsedProjectId);
      }
      return [...prev, parsedProjectId];
    });
  };

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
      subtitle: "This will permanently remove selected projects and linked records that can be safely deleted.",
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
        <div className="projects-toolbar-left">
          <button className="projects-filter-btn" type="button">
            Active <Icon name="chevron" size={16} />
          </button>
          <button className="projects-filter-btn" type="button">
            Completed <Icon name="chevron" size={16} />
          </button>
        </div>
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
                {option.label}
              </button>
            ))}
          </div>
          <button className="projects-filter-btn" type="button">
            All Categories <Icon name="chevron" size={16} />
          </button>
          <button className="projects-filter-btn" type="button">
            Newest <Icon name="chevron" size={16} />
          </button>
          <button
            className="projects-new-btn"
            type="button"
            onClick={openCreateProjectModal}
            disabled={!canCreateProject}
            title={
              !canCreateProject ? "Only project managers and admins can create projects." : undefined
            }
          >
            <Icon name="plus" size={16} />
            New Project
          </button>
        </div>
      </div>
      {projectsNotice?.message ? (
        <p className={`projects-notice projects-notice--${projectsNotice.type || "warning"}`}>
          {projectsNotice.message}
        </p>
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
                const progressValue = getProjectProgress(project);
                const avatarLetters = getAvatarLetters(project);
                const extraMembers = Math.max((project.member_count || 0) - avatarLetters.length, 0);
                const canJoin = !project.membership && canSelfManageMembership;
                const isVisible = project?.is_visible !== false;
                return (
                  <article
                    className={`project-card-elevated${isVisible ? "" : " project-card-elevated--hidden"}`}
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProjectDetails(project)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openProjectDetails(project);
                    }}
                  >
                    <div className="project-card-hero">
                      <span className="project-pill project-pill--category">{getProjectCategory(project)}</span>
                      <span className="project-pill project-pill--status">
                        <span className="status-dot" style={{ background: getStatusColor(project.status, isVisible) }}></span>
                        {isVisible ? project.status || "Active" : "Hidden"}
                      </span>
                      {renderProjectActionMenu(project)}
                      <img src={getProjectImage(project)} alt={`${project.name} cover`} loading="lazy" />
                    </div>
                    <div className="project-card-body">
                      <div className="project-card-title">
                        <h3>{project.name}</h3>
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
                        <button
                          type="button"
                          className="project-btn-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            openProjectDetails(project);
                          }}
                        >
                          Open Project
                        </button>
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
              <table className="projects-table-view">
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
                    <th>Project</th>
                    <th>Category</th>
                    <th>Start date</th>
                    <th>Status</th>
                    <th>Members</th>
                    <th>Budget</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProjects.map((project) => {
                    const projectId = Number.parseInt(String(project.id), 10);
                    const isChecked = selectedProjectIds.includes(projectId);
                    const isVisible = project?.is_visible !== false;
                    const budgetAmount = getProjectBudgetAmount(project);
                    const revenueAmount = getProjectRevenueAmount(project);
                    return (
                      <tr
                        key={project.id}
                        className={!isVisible ? "is-hidden" : ""}
                        onClick={() => openProjectDetails(project)}
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
                        <td>
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
                        <td>{getProjectCategory(project)}</td>
                        <td>{formatDate(project.start_date)}</td>
                        <td>{isVisible ? project.status || "Active" : "Hidden"}</td>
                        <td>{project.member_count || 0}</td>
                        <td className="projects-table-money">{formatCurrency(budgetAmount)}</td>
                        <td className="projects-table-money">{formatCurrency(revenueAmount)}</td>
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
                const projectId = Number.parseInt(String(project.id), 10);
                const isChecked = selectedProjectIds.includes(projectId);
                const isVisible = project?.is_visible !== false;
                const budgetAmount = getProjectBudgetAmount(project);
                const revenueAmount = getProjectRevenueAmount(project);
                return (
                  <article
                    className={`projects-list-item${isVisible ? "" : " is-hidden"}`}
                    key={project.id}
                    onClick={() => openProjectDetails(project)}
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

      <div className="projects-mobile-nav">
        <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("overview")}>
          <Icon name="home" size={20} />
          <span>Home</span>
        </button>
        <button type="button" className="projects-mobile-nav-btn active">
          <Icon name="briefcase" size={20} />
          <span>Projects</span>
        </button>
        {isAdmin && (
          <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("reports")}>
            <Icon name="trending-up" size={20} />
            <span>Reports</span>
          </button>
        )}
        <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("profile")}>
          <Icon name="user" size={20} />
          <span>Settings</span>
        </button>
      </div>

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
      >
        {loadingProjectEditor ? (
          <div className="projects-editor-loading">
            <div className="loading-spinner"></div>
            <p>Loading project details...</p>
          </div>
        ) : (
        <ProjectEditorForm
          activeTab={activeTab}
          onTabChange={setActiveTab}
          form={createProjectForm}
          onFieldChange={updateCreateProjectField}
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
          mediaFolderPreview={mediaFolderPreview}
          selectedMediaFiles={selectedMediaFiles}
          onRemoveMediaFile={handleRemoveMediaFile}
          getFileFingerprint={getFileFingerprint}
          formatFileSize={formatFileSize}
        />
        )}
      </DataModal>

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
        onClose={() => setSelectedProject(null)}
        title={selectedProject?.name || "Project details"}
        subtitle={selectedProject ? getProjectSubtitle(selectedProject) : ""}
        icon="briefcase"
        className="project-detail-modal"
        bodyClassName="project-detail-body"
      >
        {selectedProject && (
          <div className="project-detail-layout">
            <div className={`project-detail-left${detailTab === "expenses" ? " is-expenses" : ""}`}>
              {detailTab === "expenses" ? (
                <div className="project-expense-sidebar">
                  <article className="project-expense-insight-card project-expense-insight-card--hero">
                    <h5>Expense Overview</h5>
                    <p>{selectedProject.name}</p>
                    <div className="project-expense-insight-meta">
                      <span>
                        <Icon name="calendar" size={14} />
                        Started: {formatDate(selectedProject.start_date)}
                      </span>
                      <span>
                        <Icon name="member" size={14} />
                        {selectedProject.member_count || 0} members
                      </span>
                      <span>
                        <Icon name="receipt" size={14} />
                        {projectExpenseInsights.expenseCount} expenses tracked
                      </span>
                    </div>
                  </article>

                  <article className="project-expense-insight-card">
                    <h5>Total Expenses</h5>
                    <strong className="project-expense-insight-total">
                      {formatCurrency(projectExpenseInsights.totalAmount)}
                    </strong>
                    <div className="project-expense-donut-wrap">
                      <div
                        className="project-expense-donut-ring"
                        style={{ background: projectExpenseInsights.donutGradient }}
                      >
                        <div className="project-expense-donut-hole">
                          <span>Total</span>
                          <strong>{formatCurrency(projectExpenseInsights.totalAmount)}</strong>
                        </div>
                      </div>
                    </div>
                    {projectExpenseInsights.legendCategories.length ? (
                      <div className="project-expense-legend-list">
                        {projectExpenseInsights.legendCategories.map((item) => (
                          <div className="project-expense-legend-row" key={`legend-${item.label}`}>
                            <span className="project-expense-legend-label">
                              <i style={{ background: item.color }} aria-hidden="true" />
                              {item.label}
                            </span>
                            <strong>{formatCurrency(item.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="project-expense-insight-empty">No expenses recorded yet.</p>
                    )}
                  </article>

                  <article className="project-expense-insight-card">
                    <h5>Expense Breakdown</h5>
                    {projectExpenseInsights.legendCategories.length ? (
                      <div className="project-expense-breakdown-bars">
                        {projectExpenseInsights.legendCategories.map((item) => {
                          const barHeight =
                            projectExpenseInsights.maxCategoryAmount > 0
                              ? Math.max(16, (item.amount / projectExpenseInsights.maxCategoryAmount) * 84)
                              : 16;
                          return (
                            <div className="project-expense-breakdown-item" key={`breakdown-${item.label}`}>
                              <span
                                className="project-expense-breakdown-bar"
                                style={{
                                  height: `${barHeight}px`,
                                  background: `linear-gradient(180deg, ${item.color}, ${item.color}cc)`,
                                }}
                              />
                              <span className="project-expense-breakdown-label">{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="project-expense-insight-empty">No breakdown available.</p>
                    )}

                    {projectExpenseInsights.leadingVendor ? (
                      <div className="project-expense-leading-vendor">
                        <div className="project-expense-leading-vendor-main">
                          {leadingExpenseVendorLogo ? (
                            <img
                              src={leadingExpenseVendorLogo}
                              alt={`${leadingExpenseVendorName} logo`}
                              className="project-expense-vendor-logo"
                              loading="lazy"
                            />
                          ) : (
                            <span className="project-expense-vendor-fallback" aria-hidden="true">
                              {getProjectExpenseVendorInitials(leadingExpenseVendorName)}
                            </span>
                          )}
                          <div>
                            <strong>{leadingExpenseVendorName}</strong>
                            <span>
                              {projectExpenseInsights.leadingVendor.count} expense
                              {projectExpenseInsights.leadingVendor.count === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                        <span className="project-expense-leading-vendor-amount">
                          {formatCurrency(projectExpenseInsights.leadingVendor.amount)}
                        </span>
                      </div>
                    ) : null}

                    <p className="project-expense-insight-foot">
                      {projectExpenseInsights.missingReceiptCount} expense
                      {projectExpenseInsights.missingReceiptCount === 1 ? "" : "s"} missing proof
                    </p>
                  </article>
                </div>
              ) : (
                <>
                  <div className="project-detail-image">
                    <img src={getProjectImage(selectedProject)} alt={selectedProject.name} />
                  </div>
                  <div className="project-detail-thumbs">
                    <img src={getProjectImage(selectedProject)} alt={`${selectedProject.name} preview`} />
                    <img src={getProjectImage(selectedProject)} alt={`${selectedProject.name} preview`} />
                    <img src={getProjectImage(selectedProject)} alt={`${selectedProject.name} preview`} />
                  </div>
                  <div className="project-detail-meta">
                    <span>
                      <Icon name="calendar" size={14} />
                      Started: {formatDate(selectedProject.start_date)}
                    </span>
                    <span>
                      <Icon name="member" size={14} />
                      {selectedProject.member_count || 0} members
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="project-detail-center">
              <div className="project-detail-tabs" role="tablist">
                {["overview", "expenses", "documents", "tasks", "notes"].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`project-detail-tab${detailTab === tab ? " active" : ""}`}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab === "overview"
                      ? "Overview"
                      : tab === "expenses"
                        ? "Expenses"
                        : tab === "documents"
                          ? "Documents"
                          : tab === "tasks"
                            ? "Tasks"
                            : "Notes"}
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
                      <article className="project-overview-panel">
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
                              <span>Expected revenue</span>
                              <strong>{formatCurrency(projectOverviewAnalytics.expectedRevenueAmount)}</strong>
                            </div>
                          </div>
                        </div>
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
                      <h4>Expenses</h4>
                      <div className="project-detail-section-head-actions">
                        {selectedExpenseIds.length > 0 ? (
                          <>
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
                              className="project-detail-action ghost danger"
                              onClick={requestDeleteSelectedExpenses}
                              disabled={deletingExpenses || savingExpense || uploadingExpenseReceipt}
                            >
                              Delete selected
                            </button>
                          </>
                        ) : null}
                        <input
                          ref={expenseReceiptInputRef}
                          type="file"
                          className="project-documents-file-input"
                          accept={PROJECT_EXPENSE_RECEIPT_ACCEPT}
                          onChange={handleSelectedExpenseReceiptFileSelection}
                          disabled={uploadingExpenseReceipt || savingExpense || deletingExpenses}
                        />
                        <button
                          type="button"
                          className="project-detail-action ghost icon-only"
                          onClick={handleExportVisibleExpensesCsv}
                          disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                          title="Export shown expenses as CSV"
                          aria-label="Export shown expenses as CSV"
                        >
                          <Icon name="download" size={16} />
                        </button>
                        <button
                          type="button"
                          className="project-detail-action"
                          onClick={openExpenseModal}
                          disabled={savingExpense || deletingExpenses || uploadingExpenseReceipt}
                        >
                          Add expense
                        </button>
                      </div>
                    </div>
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
                      </div>
                    ) : (
                      <>
                        <div className="project-expenses-selection-note">
                          {selectedExpenseIds.length} selected
                        </div>
                        {projectExpenses.length > recentProjectExpenses.length ? (
                          <div className="project-expenses-selection-note">
                            Showing {recentProjectExpenses.length} most recent expenses.
                          </div>
                        ) : null}
                        <div className="projects-table-wrap project-expenses-table-wrap">
                          <table className="projects-table-view project-expenses-table">
                            <thead>
                              <tr>
                                <th className="projects-table-check">
                                  <input
                                    type="checkbox"
                                    checked={allExpensesSelected}
                                    onChange={handleToggleSelectAllExpenses}
                                    aria-label="Select all project expenses"
                                  />
                                </th>
                                <th>Expense details</th>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Vendor</th>
                                <th>Amount</th>
                                <th>Receipt</th>
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
                                return (
                                  <tr
                                    key={expenseId || `${detailTitle}-${expense?.expense_date || ""}`}
                                    className="project-expense-row"
                                  >
                                    <td className="projects-table-check">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleExpenseSelection(expenseId)}
                                        aria-label={`Select expense ${detailTitle}`}
                                      />
                                    </td>
                                    <td>
                                      <div className="project-expense-main">
                                        <span
                                          className={`project-expense-category-icon project-expense-tone-${categoryTone}`}
                                          aria-hidden="true"
                                        >
                                          <Icon name={categoryIcon} size={18} />
                                        </span>
                                        <div className="project-expense-detail">
                                          <strong>{detailTitle}</strong>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="project-expense-date">{formatDate(expense?.expense_date)}</td>
                                    <td>
                                      <span
                                        className={`project-expense-category-pill project-expense-tone-${categoryTone}`}
                                      >
                                        {categoryLabel}
                                      </span>
                                    </td>
                                    <td className="project-expense-vendor-cell">
                                      <ProjectExpenseVendorCell
                                        expense={expense}
                                        partnerByName={expensePartnerByName}
                                      />
                                    </td>
                                    <td className="projects-table-money project-expense-amount">
                                      {formatCurrency(expense?.amount)}
                                    </td>
                                    <td>
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
                                        ) : (
                                          <span
                                            className={`projects-table-status${
                                              expense?.receipt || expense?.payment_reference ? "" : " hidden"
                                            }`}
                                          >
                                            {expense?.receipt || expense?.payment_reference ? "Available" : "Missing"}
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
                  </div>
                )}
                {detailTab === "documents" && (
                  <div className="project-detail-section">
                    <div className="project-detail-section-head">
                      <h4>Documents</h4>
                      <div className="project-detail-section-head-actions">
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
                        {selectedDocumentIds.length === 1 && canCreateProject ? (
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
                        {selectedDocumentIds.length > 0 && canCreateProject ? (
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
                        {projectDocumentMode === "upload" ? (
                          <>
                            <button
                              type="button"
                              className="project-detail-action"
                              onClick={triggerProjectDocumentPicker}
                              disabled={
                                !canCreateProject ||
                                uploadingProjectDocument ||
                                deletingDocuments ||
                                emittingProjectDocument ||
                                renamingDocument
                              }
                              title={
                                !canCreateProject
                                  ? "Only project managers and admins can upload documents."
                                  : undefined
                              }
                            >
                              {uploadingProjectDocument ? "Uploading..." : "Upload document"}
                            </button>
                            <input
                              ref={projectDocumentInputRef}
                              type="file"
                              className="project-documents-file-input"
                              accept={PROJECT_DOCUMENT_ACCEPT}
                              multiple
                              onChange={handleProjectDocumentFileSelection}
                              disabled={
                                !canCreateProject ||
                                uploadingProjectDocument ||
                                deletingDocuments ||
                                emittingProjectDocument ||
                                renamingDocument
                              }
                            />
                          </>
                        ) : (
                          <button
                            type="button"
                            className="project-detail-action"
                            onClick={handlePrepareEmitDocument}
                            disabled={
                              !canCreateProject ||
                              emittingProjectDocument ||
                              uploadingProjectDocument ||
                              deletingDocuments ||
                              renamingDocument
                            }
                            title={
                              !canCreateProject
                                ? "Only project managers and admins can emit documents."
                                : undefined
                            }
                          >
                            {emittingProjectDocument ? "Emitting..." : "Emit document"}
                          </button>
                        )}
                      </div>
                    </div>
                    {projectDocumentMode === "upload" ? (
                      <p className="project-documents-hint">
                        Allowed file types: <strong>.docx</strong>, <strong>.pdf</strong>, and image files.
                      </p>
                    ) : (
                      <div className="project-documents-emit">
                        <label className="project-detail-filter project-detail-filter--search">
                          <span>Document template</span>
                          <select
                            value={emitDocumentType}
                            onChange={(event) => setEmitDocumentType(event.target.value)}
                            disabled={!canCreateProject || emittingProjectDocument || renamingDocument}
                          >
                            {PROJECT_EMIT_DOCUMENT_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <p className="project-documents-emit-note">
                          All templates emit generated PDFs using current project data and KPI summaries.
                        </p>
                      </div>
                    )}
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
                        <div className="project-expenses-selection-note">
                          {selectedDocumentIds.length} selected
                        </div>
                        <div className="projects-table-wrap project-expenses-table-wrap">
                          <table className="projects-table-view project-expenses-table project-documents-table">
                            <thead>
                              <tr>
                                <th className="projects-table-check">
                                  <input
                                    type="checkbox"
                                    checked={allDocumentsSelected}
                                    onChange={handleToggleSelectAllDocuments}
                                    aria-label="Select all project documents"
                                  />
                                </th>
                                <th>Document</th>
                                <th>Type</th>
                                <th>Size</th>
                                <th>Uploaded</th>
                                <th>By</th>
                                <th>Action</th>
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
                                    <td className="projects-table-check">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleDocumentSelection(documentId)}
                                        aria-label={`Select document ${fileName}`}
                                      />
                                    </td>
                                    <td>
                                      <div className="project-expense-detail project-document-detail">
                                        <strong>{fileName}</strong>
                                        <p>{String(document?.file_path || "").split("/").pop() || "Stored document"}</p>
                                      </div>
                                    </td>
                                    <td>{getProjectDocumentTypeLabel(document)}</td>
                                    <td>{formatFileSize(document?.file_size_bytes)}</td>
                                    <td>{formatDate(document?.uploaded_at)}</td>
                                    <td>{document?.uploader_name || "—"}</td>
                                    <td>
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
                  </div>
                )}
                {detailTab === "tasks" && (
                  <div className="project-detail-section project-detail-tasks">
                    <div className="project-detail-section-head">
                      <h4>Tasks</h4>
                      <div className="project-detail-section-head-actions">
                        {selectedTaskIds.length > 0 ? (
                          <>
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={openEditSelectedTaskModal}
                              disabled={selectedTasks.length !== 1 || savingTask || deletingTasks}
                            >
                              Edit selected
                            </button>
                            <button
                              type="button"
                              className="project-detail-action ghost danger"
                              onClick={requestDeleteSelectedTasks}
                              disabled={deletingTasks || savingTask}
                            >
                              Delete selected
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="project-detail-action"
                          onClick={openTaskModal}
                          disabled={savingTask || deletingTasks}
                        >
                          Add task
                        </button>
                      </div>
                    </div>
                    {projectTasksError ? (
                      <p className="project-detail-expense-error">{projectTasksError}</p>
                    ) : null}
                    {projectTasks.length > 0 ? (
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
                        <div className="project-expenses-selection-note">
                          {selectedTaskIds.length} selected
                        </div>
                        <div className="project-expenses-selection-note">
                          Showing {filteredProjectTasks.length} of {projectTasks.length} tasks.
                        </div>
                        <div className="projects-table-wrap project-expenses-table-wrap">
                          <table className="projects-table-view project-expenses-table project-tasks-table">
                            <thead>
                              <tr>
                                <th className="projects-table-check">
                                  <input
                                    type="checkbox"
                                    checked={allTasksSelected}
                                    onChange={handleToggleSelectAllTasks}
                                    aria-label="Select all project tasks"
                                  />
                                </th>
                                <th>Task details</th>
                                <th>Assignee</th>
                                <th>Due date</th>
                                <th>Priority</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredProjectTasks.map((task) => {
                                const taskId = String(task?.id ?? "");
                                const isChecked = selectedTaskIds.includes(taskId);
                                const safePriority = String(task?.priority || "normal")
                                  .trim()
                                  .toLowerCase();
                                const safeStatus = String(task?.status || "open")
                                  .trim()
                                  .toLowerCase();
                                const priorityLabel = TASK_PRIORITY_LABELS[safePriority] || "Normal";
                                const statusLabel = TASK_STATUS_LABELS[safeStatus] || "Open";
                                const assignee =
                                  task?.assignee_name ||
                                  (task?.assignee_member_id ? `Member #${task.assignee_member_id}` : "Unassigned");
                                return (
                                  <tr key={taskId || `${task?.title || "task"}-${task?.due_date || ""}`}>
                                    <td className="projects-table-check">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleTaskSelection(taskId)}
                                        aria-label={`Select task ${task?.title || taskId}`}
                                      />
                                    </td>
                                    <td>
                                      <div className="project-expense-detail project-task-detail">
                                        <strong>{task?.title || "Untitled task"}</strong>
                                        {task?.details ? <p>{task.details}</p> : null}
                                      </div>
                                    </td>
                                    <td>{assignee}</td>
                                    <td>{formatDate(task?.due_date)}</td>
                                    <td>
                                      <span
                                        className={`project-task-badge is-priority-${safePriority.replace(/[^a-z_]+/g, "")}`}
                                      >
                                        {priorityLabel}
                                      </span>
                                    </td>
                                    <td>
                                      <span
                                        className={`project-task-badge is-status-${safeStatus.replace(/[^a-z_]+/g, "")}`}
                                      >
                                        {statusLabel}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {detailTab === "notes" && (
                  <div className="project-detail-section project-detail-notes">
                    <div className="project-detail-section-head">
                      <h4>Notes</h4>
                      <div className="project-detail-section-head-actions">
                        {selectedNoteIds.length > 0 ? (
                          <>
                            <button
                              type="button"
                              className="project-detail-action ghost"
                              onClick={openEditSelectedNoteModal}
                              disabled={selectedNotes.length !== 1 || savingNote || deletingNotes}
                            >
                              Edit selected
                            </button>
                            <button
                              type="button"
                              className="project-detail-action ghost danger"
                              onClick={requestDeleteSelectedNotes}
                              disabled={deletingNotes || savingNote}
                            >
                              Delete selected
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="project-detail-action"
                          onClick={openNoteModal}
                          disabled={savingNote || deletingNotes}
                        >
                          Add note
                        </button>
                      </div>
                    </div>
                    {projectNotesError ? (
                      <p className="project-detail-expense-error">{projectNotesError}</p>
                    ) : null}
                    {projectNotes.length > 0 ? (
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
                    ) : projectNotes.length === 0 ? (
                      <div className="project-detail-empty">
                        <Icon name="notes" size={24} />
                        <span>No notes yet.</span>
                      </div>
                    ) : filteredProjectNotes.length === 0 ? (
                      <div className="project-detail-empty">
                        <Icon name="search" size={24} />
                        <span>No notes match the selected filters.</span>
                      </div>
                    ) : (
                      <>
                        <div className="project-expenses-selection-note">
                          {selectedNoteIds.length} selected
                        </div>
                        <div className="project-expenses-selection-note">
                          Showing {filteredProjectNotes.length} of {projectNotes.length} notes.
                        </div>
                        <div className="projects-table-wrap project-expenses-table-wrap">
                          <table className="projects-table-view project-expenses-table project-notes-table">
                            <thead>
                              <tr>
                                <th className="projects-table-check">
                                  <input
                                    type="checkbox"
                                    checked={allNotesSelected}
                                    onChange={handleToggleSelectAllNotes}
                                    aria-label="Select all project notes"
                                  />
                                </th>
                                <th>Note details</th>
                                <th>Visibility</th>
                                <th>Author</th>
                                <th>Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredProjectNotes.map((note) => {
                                const noteId = String(note?.id ?? "");
                                const isChecked = selectedNoteIds.includes(noteId);
                                const safeVisibility = String(note?.visibility || "project_team")
                                  .trim()
                                  .toLowerCase();
                                return (
                                  <tr key={noteId || `${note?.title || "note"}-${note?.created_at || ""}`}>
                                    <td className="projects-table-check">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleToggleNoteSelection(noteId)}
                                        aria-label={`Select note ${note?.title || noteId}`}
                                      />
                                    </td>
                                    <td>
                                      <div className="project-expense-detail project-note-detail">
                                        <strong>{note?.title || "Untitled note"}</strong>
                                        {note?.body ? <p>{note.body}</p> : null}
                                      </div>
                                    </td>
                                    <td>
                                      <span className="project-note-visibility">
                                        {NOTE_VISIBILITY_LABELS[safeVisibility] || "Project team"}
                                      </span>
                                    </td>
                                    <td>
                                      {note?.author_name ||
                                        (note?.author_member_id ? `Member #${note.author_member_id}` : "—")}
                                    </td>
                                    <td>{formatDate(note?.updated_at || note?.created_at)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DataModal>

      <DataModal
        open={showExpenseModal}
        onClose={closeExpenseModal}
        title={editingExpenseId ? "Edit Expense" : "Add Expense"}
        subtitle={
          editingExpenseId
            ? "Update the selected expense entry."
            : "Record a project expense to keep finances accurate."
        }
        icon="receipt"
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
                    <th>Category</th>
                    <th>Used in expenses</th>
                    <th>Actions</th>
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
                        <td>
                          <span className="project-category-chip">{categoryName || "—"}</span>
                        </td>
                        <td>{usageCount}</td>
                        <td>
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
        open={showNoteModal}
        onClose={closeNoteModal}
        title={editingNoteId ? "Edit Note" : "Add Note"}
        subtitle="Capture important decisions or context for the team."
        icon="notes"
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
        open={showDeleteTasksModal}
        onClose={closeDeleteTasksModal}
        title={`Delete ${selectedTasks.length} task${selectedTasks.length === 1 ? "" : "s"}?`}
        subtitle="This action cannot be undone."
        icon="alert"
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
