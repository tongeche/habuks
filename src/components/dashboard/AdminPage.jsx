import { useEffect, useMemo, useState } from "react";
import {
  createMemberAdmin,
  updateMemberAdmin,
  getMembersWithTotalWelfare,
  getMemberInvites,
  createMemberInvite,
  revokeMemberInvite,
  getProjects,
  getProjectExpensesForProjects,
  getProjectSalesForProjects,
  createProjectExpense,
  updateProjectExpense,
  deleteProjectExpense,
  createProjectSale,
  updateProjectSale,
  deleteProjectSale,
  getProjectMembersAdmin,
  addProjectMemberAdmin,
  removeProjectMemberAdmin,
  updateProjectMemberAdmin,
  getWelfareAccounts,
  getWelfareCycles,
  getWelfareTransactionsAdmin,
  createWelfareTransaction,
  updateWelfareTransaction,
  deleteWelfareTransaction,
  isAdminUser,
  getTenantMemberships,
  getTenantById,
  updateTenant,
  getTenantSiteTemplates,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";
import {
  DEFAULT_TENANT_TEMPLATE_KEY,
  TENANT_TEMPLATE_ONE_KEY,
  getTenantTemplatePreset,
  getTenantTemplateSelectOptions,
  normalizeTenantTemplateKey,
} from "../../lib/tenantSiteShell.js";

const initialMemberForm = {
  name: "",
  email: "",
  phone_number: "",
  role: "member",
  status: "active",
  join_date: new Date().toISOString().slice(0, 10),
  gender: "",
  national_id: "",
  occupation: "",
  address: "",
  county: "",
  sub_county: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
};

const initialInviteForm = {
  tenant_id: "",
  email: "",
  phone_number: "",
  role: "member",
  expires_in_days: "30",
  notes: "",
};

const initialWelfareForm = {
  member_id: "",
  welfare_account_id: "",
  cycle_id: "",
  amount: "",
  transaction_type: "contribution",
  status: "Completed",
  date: new Date().toISOString().slice(0, 10),
  description: "",
};

const initialExpenseForm = {
  project_id: "",
  expense_date: new Date().toISOString().slice(0, 10),
  category: "",
  amount: "",
  vendor: "",
  description: "",
  receipt: false,
  approved: false,
};

const initialSaleForm = {
  project_id: "",
  sale_date: new Date().toISOString().slice(0, 10),
  product_type: "",
  quantity_units: "",
  unit_price: "",
  total_amount: "",
  customer_name: "",
  customer_type: "retail",
  payment_status: "paid",
};

const DEFAULT_TENANT_THEME = {
  sidebar: "#0b1226",
  sidebarAlt: "#14203a",
  sidebarAlt2: "#1b2b4f",
  primary: "#1f7a8c",
  primaryDark: "#0f5f63",
  secondary: "#2dd4bf",
  accent: "#f97316",
  accentDark: "#ea580c",
  ink: "#0f172a",
  offWhite: "#f8fafc",
};

const DEFAULT_TENANT_FEATURES = {
  welfare: true,
  projects: true,
  expenses: true,
  reports: true,
  news: true,
  documents: true,
  meetings: true,
};

const tenantConfigSteps = [
  {
    key: "template",
    title: "Website Template",
    description: "Choose a shared layout theme.",
  },
  {
    key: "branding",
    title: "Branding",
    description: "Name, logo, and contact details.",
  },
  {
    key: "theme",
    title: "Theme",
    description: "Choose colors for the tenant UI.",
  },
  {
    key: "navigation",
    title: "Navigation",
    description: "Set header, footer, and social links.",
  },
  {
    key: "features",
    title: "Features & Bio",
    description: "Toggle modules and update the org bio.",
  },
];

const TEMPLATE_SECTION_OUTLINES = {
  [TENANT_TEMPLATE_ONE_KEY]: {
    title: "Minimal template section outline",
    sections: [
      "Header and navigation",
      "Hero (clean minimal spotlight)",
      "Programs section",
      "Objectives and goals",
      "Impact highlights",
      "Call-to-action banner",
      "Testimonials",
      "Contact section",
      "Footer",
    ],
  },
};

const initialTenantConfig = {
  templateKey: DEFAULT_TENANT_TEMPLATE_KEY,
  name: "",
  tagline: "",
  logoUrl: "",
  contact_email: "",
  contact_phone: "",
  location: "",
  orgBio: "",
  theme: { ...DEFAULT_TENANT_THEME },
  navItems: [],
  footerLinks: [],
  socialLinks: [],
  programsTitle: "",
  programsDescription: "",
  programsItemsText: "",
  objectivesTitle: "",
  objectivesDescription: "",
  objectivesText: "",
  goalsText: "",
  impactTitle: "",
  impactDescription: "",
  impactItemsText: "",
  testimonialsTitle: "",
  testimonialsDescription: "",
  testimonialsItemsText: "",
  ctaTitle: "",
  ctaDescription: "",
  ctaLabel: "",
  ctaHref: "",
  publicContactTitle: "",
  publicContactIntro: "",
  publicContactPanelTitle: "",
  publicContactPanelDescription: "",
  features: { ...DEFAULT_TENANT_FEATURES },
};

const normalizeLinkList = (items, fallback, extraKeys = []) => {
  const source = Array.isArray(items) ? items : Array.isArray(fallback) ? fallback : [];
  return source.map((item) => {
    const base = {
      label: typeof item?.label === "string" ? item.label : "",
      href: typeof item?.href === "string" ? item.href : "",
    };
    extraKeys.forEach((key) => {
      base[key] = typeof item?.[key] === "string" ? item[key] : "";
    });
    return base;
  });
};

const sanitizeLinkList = (items, extraKeys = []) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      const entry = {
        label: String(item?.label || "").trim(),
        href: String(item?.href || "").trim(),
      };
      extraKeys.forEach((key) => {
        entry[key] = String(item?.[key] || "").trim();
      });
      return entry;
    })
    .filter((item) => item.label && item.href);
};

const toSafeObject = (value) => (value && typeof value === "object" ? value : {});
const toSafeArray = (value) => (Array.isArray(value) ? value : []);
const toText = (value) => String(value || "").trim();

const normalizeLineColumns = (line) =>
  String(line || "")
    .split("|")
    .map((part) => part.trim());

const joinLineColumns = (columns) => {
  const values = [...columns];
  while (values.length && !values[values.length - 1]) {
    values.pop();
  }
  return values.join(" | ");
};

const parseLines = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const serializeSimpleList = (items) =>
  toSafeArray(items)
    .map((item) => toText(item))
    .filter(Boolean)
    .join("\n");

const parseProgramsLines = (value) =>
  parseLines(value)
    .map((line) => {
      const [title, description, tag, status] = normalizeLineColumns(line);
      if (!title) return null;
      return {
        title,
        ...(description ? { description } : {}),
        ...(tag ? { tag } : {}),
        ...(status ? { status } : {}),
      };
    })
    .filter(Boolean);

const serializeProgramsLines = (items) =>
  toSafeArray(items)
    .map((item) => {
      const source = toSafeObject(item);
      const title = toText(source.title || source.name || source.code);
      if (!title) return "";
      const description = toText(source.description || source.short_description || source.overview);
      const tag = toText(source.tag || source.type || source.module_key);
      const status = toText(source.status);
      return joinLineColumns([title, description, tag, status]);
    })
    .filter(Boolean)
    .join("\n");

const parseImpactLines = (value) =>
  parseLines(value)
    .map((line) => {
      const [rawValue, label, detail] = normalizeLineColumns(line);
      const metricValue = toText(rawValue);
      if (!metricValue || !label) return null;
      return {
        value: metricValue,
        label,
        ...(detail ? { detail } : {}),
      };
    })
    .filter(Boolean);

const serializeImpactLines = (items) =>
  toSafeArray(items)
    .map((item) => {
      const source = toSafeObject(item);
      const metricValue = toText(source.value);
      const label = toText(source.label);
      if (!metricValue || !label) return "";
      const detail = toText(source.detail);
      return joinLineColumns([metricValue, label, detail]);
    })
    .filter(Boolean)
    .join("\n");

const parseTestimonialLines = (value) =>
  parseLines(value)
    .map((line) => {
      const [quote, name, role] = normalizeLineColumns(line);
      if (!quote || !name) return null;
      return {
        quote,
        name,
        ...(role ? { role } : {}),
      };
    })
    .filter(Boolean);

const serializeTestimonialLines = (items) =>
  toSafeArray(items)
    .map((item) => {
      const source = toSafeObject(item);
      const quote = toText(source.quote || source.message || source.text);
      const name = toText(source.name || source.author);
      if (!quote || !name) return "";
      const role = toText(source.role || source.title);
      return joinLineColumns([quote, name, role]);
    })
    .filter(Boolean)
    .join("\n");

const adminModules = [
  {
    key: "tenant-config",
    title: "Tenant Settings",
    description: "Branding, navigation, and feature toggles.",
    icon: "layers",
    sections: ["tenant-config"],
    tone: "indigo",
  },
  {
    key: "members",
    title: "Members & Roles",
    description: "Add members, assign roles, and manage access.",
    icon: "users",
    sections: ["members-list"],
    tone: "emerald",
  },
  {
    key: "invites",
    title: "Invite Codes",
    description: "Create onboarding invites and revoke access.",
    icon: "mail",
    sections: ["invites-form", "invites-list"],
    tone: "blue",
  },
  {
    key: "projects",
    title: "Projects",
    description: "Create, assign leaders, and manage project status.",
    icon: "briefcase",
    sections: ["projects-manage"],
    tone: "violet",
  },
  {
    key: "finance",
    title: "Expenses & Sales",
    description: "Review project spend, sales, and approvals.",
    icon: "receipt",
    sections: ["finance-dashboard"],
    tone: "amber",
  },
  {
    key: "welfare",
    title: "Welfare Cycles",
    description: "Configure contributions, payouts, and balances.",
    icon: "wallet",
    sections: ["welfare-form", "welfare-list"],
    tone: "teal",
  },
  {
    key: "documents",
    title: "Documents",
    description: "Templates, downloads, and upload approvals.",
    icon: "folder",
    tone: "indigo",
  },
  {
    key: "news",
    title: "News & Updates",
    description: "Publish announcements and member updates.",
    icon: "newspaper",
    tone: "rose",
  },
  {
    key: "reports",
    title: "Reports & Insights",
    description: "Exports, KPIs, and performance summaries.",
    icon: "trending-up",
    tone: "cyan",
  },
  {
    key: "compliance",
    title: "Compliance",
    description: "Audit trails, approvals, and data checks.",
    icon: "check-circle",
    tone: "slate",
  },
  {
    key: "support",
    title: "Support Inbox",
    description: "Handle member issues and requests.",
    icon: "clock-alert",
    tone: "orange",
  },
];

export default function AdminPage({ user, tenantId, tenantRole, onTenantUpdated }) {
  const baseSiteData = useMemo(() => {
    if (typeof window !== "undefined" && typeof window.siteData === "function") {
      return window.siteData() || {};
    }
    return {};
  }, []);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [inviteForm, setInviteForm] = useState(initialInviteForm);
  const [tenantOptions, setTenantOptions] = useState([]);
  const [tenantConfig, setTenantConfig] = useState(initialTenantConfig);
  const [tenantConfigLoading, setTenantConfigLoading] = useState(false);
  const [tenantConfigSaving, setTenantConfigSaving] = useState(false);
  const [tenantConfigStep, setTenantConfigStep] = useState(0);
  const [tenantSiteData, setTenantSiteData] = useState({});
  const [tenantRecord, setTenantRecord] = useState(null);
  const [templateOptions, setTemplateOptions] = useState(() => getTenantTemplateSelectOptions([]));
  const [templateLoading, setTemplateLoading] = useState(false);

  const selectedTemplate = useMemo(() => {
    return templateOptions.find((template) => template.key === tenantConfig.templateKey);
  }, [templateOptions, tenantConfig.templateKey]);
  const selectedTemplatePreset = useMemo(
    () => getTenantTemplatePreset(tenantConfig.templateKey),
    [tenantConfig.templateKey]
  );
  const selectedTemplateOutline = useMemo(
    () => TEMPLATE_SECTION_OUTLINES[selectedTemplatePreset?.key] || null,
    [selectedTemplatePreset?.key]
  );
  const [welfareForm, setWelfareForm] = useState(initialWelfareForm);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [saleForm, setSaleForm] = useState(initialSaleForm);
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [selectedWelfareId, setSelectedWelfareId] = useState(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [search, setSearch] = useState("");
  const [welfareSearch, setWelfareSearch] = useState("");
  const [financeSearch, setFinanceSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingWelfare, setLoadingWelfare] = useState(false);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingProjectMembers, setLoadingProjectMembers] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeModule, setActiveModule] = useState(null);
  const [financeTab, setFinanceTab] = useState("expenses");
  const [financeRangeDays, setFinanceRangeDays] = useState(30);
  const [financeProjectId, setFinanceProjectId] = useState("");
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [welfareTransactions, setWelfareTransactions] = useState([]);
  const [welfareAccounts, setWelfareAccounts] = useState([]);
  const [welfareCycles, setWelfareCycles] = useState([]);
  const [financeExpenses, setFinanceExpenses] = useState([]);
  const [financeSales, setFinanceSales] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectMembers, setProjectMembers] = useState([]);
  const [addingProjectMember, setAddingProjectMember] = useState(false);
  const [removingProjectMemberId, setRemovingProjectMemberId] = useState(null);
  const [savingProjectMemberId, setSavingProjectMemberId] = useState(null);
  const [projectMemberRoleEdits, setProjectMemberRoleEdits] = useState({});
  const [projectMemberForm, setProjectMemberForm] = useState({
    member_id: "",
    role: "Member",
    term_start: new Date().toISOString().slice(0, 10),
  });

  const isAdmin =
    isAdminUser(user) || ["admin", "superadmin"].includes(String(tenantRole || "").toLowerCase());

  const filteredMembers = useMemo(() => {
    if (!search.trim()) {
      return members;
    }
    const query = search.toLowerCase();
    return members.filter((member) => {
      return (
        member.name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query) ||
        member.phone_number?.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  const filteredWelfareTransactions = useMemo(() => {
    if (!welfareSearch.trim()) {
      return welfareTransactions;
    }
    const query = welfareSearch.toLowerCase();
    return welfareTransactions.filter((txn) => {
      const memberName = txn.member?.name || "";
      const description = txn.description || "";
      const type = txn.transaction_type || "";
      return (
        memberName.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        type.toLowerCase().includes(query)
      );
    });
  }, [welfareTransactions, welfareSearch]);

  const welfareAccountMap = useMemo(() => {
    return new Map(welfareAccounts.map((account) => [account.id, account]));
  }, [welfareAccounts]);

  const welfareCycleMap = useMemo(() => {
    return new Map(welfareCycles.map((cycle) => [cycle.id, cycle]));
  }, [welfareCycles]);

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [String(project.id), project]));
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === String(selectedProjectId)),
    [projects, selectedProjectId]
  );

  const availableProjectMembers = useMemo(() => {
    const assignedIds = new Set(projectMembers.map((item) => String(item.member_id)));
    return members.filter((member) => !assignedIds.has(String(member.id)));
  }, [members, projectMembers]);

  const filteredProjectMembers = useMemo(() => {
    if (!projectSearch.trim()) {
      return projectMembers;
    }
    const query = projectSearch.toLowerCase();
    return projectMembers.filter((member) => {
      const person = member.members || {};
      return (
        String(person.name || "").toLowerCase().includes(query) ||
        String(person.email || "").toLowerCase().includes(query) ||
        String(person.phone_number || "").toLowerCase().includes(query)
      );
    });
  }, [projectMembers, projectSearch]);

  const filterByRange = (items, days, dateKey) => {
    if (!days) return items;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return items.filter((item) => {
      const raw = item?.[dateKey];
      if (!raw) return false;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return false;
      return date >= start && date <= end;
    });
  };

  const filteredExpenses = useMemo(() => {
    let items = financeExpenses;
    if (financeProjectId) {
      items = items.filter((expense) => String(expense.project_id) === String(financeProjectId));
    }
    items = filterByRange(items, financeRangeDays, "expense_date");
    if (!financeSearch.trim()) {
      return items;
    }
    const query = financeSearch.toLowerCase();
    return items.filter((expense) => {
      return (
        String(expense.category || "").toLowerCase().includes(query) ||
        String(expense.vendor || "").toLowerCase().includes(query) ||
        String(expense.description || "").toLowerCase().includes(query)
      );
    });
  }, [financeExpenses, financeProjectId, financeRangeDays, financeSearch]);

  const filteredSales = useMemo(() => {
    let items = financeSales;
    if (financeProjectId) {
      items = items.filter((sale) => String(sale.project_id) === String(financeProjectId));
    }
    items = filterByRange(items, financeRangeDays, "sale_date");
    if (!financeSearch.trim()) {
      return items;
    }
    const query = financeSearch.toLowerCase();
    return items.filter((sale) => {
      return (
        String(sale.product_type || "").toLowerCase().includes(query) ||
        String(sale.customer_name || "").toLowerCase().includes(query) ||
        String(sale.customer_type || "").toLowerCase().includes(query)
      );
    });
  }, [financeSales, financeProjectId, financeRangeDays, financeSearch]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    loadMembers();
    loadInvites();
    loadTenantOptions();
    loadTenantConfig();
    loadTenantTemplates();
    loadProjects();
    loadWelfareMeta();
    loadWelfareTransactions();
  }, [isAdmin, user?.id, tenantId]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    if (activeModule !== "finance") {
      return;
    }
    loadFinanceData();
  }, [activeModule, projects, isAdmin]);

  useEffect(() => {
    if (activeModule !== "members") {
      setShowMemberForm(false);
      setSelectedMemberId(null);
      setMemberForm(initialMemberForm);
    }
    if (activeModule !== "welfare") {
      setSelectedWelfareId(null);
      setWelfareForm(initialWelfareForm);
      setWelfareSearch("");
    }
    if (activeModule !== "projects") {
      setProjectSearch("");
      setAddingProjectMember(false);
      setRemovingProjectMemberId(null);
      setSavingProjectMemberId(null);
      setProjectMemberRoleEdits({});
      setProjectMemberForm({
        member_id: "",
        role: "Member",
        term_start: new Date().toISOString().slice(0, 10),
      });
    }
    if (activeModule !== "finance") {
      setFinanceSearch("");
      setFinanceProjectId("");
      setFinanceRangeDays(30);
      setFinanceTab("expenses");
      setExpenseForm(initialExpenseForm);
      setSaleForm(initialSaleForm);
      setSelectedExpenseId(null);
      setSelectedSaleId(null);
    }
  }, [activeModule]);

  useEffect(() => {
    if (selectedProjectId) {
      setProjectMemberForm((prev) => ({
        ...prev,
        member_id: "",
        role: "Member",
      }));
      setProjectMemberRoleEdits({});
      setSavingProjectMemberId(null);
      loadProjectMembers(selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedWelfareId && welfareAccounts.length && !welfareForm.welfare_account_id) {
      setWelfareForm((prev) => ({
        ...prev,
        welfare_account_id: String(welfareAccounts[0].id),
      }));
    }
  }, [welfareAccounts, welfareForm.welfare_account_id, selectedWelfareId]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await getMembersWithTotalWelfare(tenantId);
      setMembers(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load members.");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const data = await getMemberInvites(tenantId);
      setInvites(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load invites.");
    } finally {
      setLoadingInvites(false);
    }
  };

  const loadTenantOptions = async () => {
    if (!user?.id) {
      setTenantOptions([]);
      return;
    }
    setLoadingTenants(true);
    try {
      const memberships = await getTenantMemberships(user.id);
      const options = (memberships || [])
        .map((membership) => ({
          id: membership.tenant?.id || membership.tenant_id,
          name: membership.tenant?.name || "Tenant workspace",
          slug: membership.tenant?.slug || "",
        }))
        .filter((tenant) => Boolean(tenant.id));
      setTenantOptions(options);
      setInviteForm((prev) => {
        if (options.length === 1 && !prev.tenant_id) {
          return { ...prev, tenant_id: options[0].id };
        }
        if (prev.tenant_id && !options.some((tenant) => tenant.id === prev.tenant_id)) {
          return { ...prev, tenant_id: "" };
        }
        return prev;
      });
    } catch (error) {
      setErrorMessage(error.message || "Failed to load tenant workspaces.");
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadTenantConfig = async () => {
    if (!tenantId) {
      setTenantConfig(initialTenantConfig);
      setTenantSiteData({});
      setTenantRecord(null);
      setTenantConfigStep(0);
      return;
    }
    setTenantConfigLoading(true);
    try {
      const tenant = await getTenantById(tenantId);
      const siteData = tenant?.site_data ?? {};
      const baseTheme = baseSiteData?.theme ?? {};
      const theme = {
        ...DEFAULT_TENANT_THEME,
        ...baseTheme,
        ...(siteData?.theme ?? {}),
      };
      const features = {
        ...DEFAULT_TENANT_FEATURES,
        ...(baseSiteData?.features ?? {}),
        ...(siteData?.features ?? {}),
      };
      const navItems = normalizeLinkList(siteData?.tenantNav, baseSiteData?.tenantNav ?? baseSiteData?.nav);
      const footerLinks = normalizeLinkList(
        siteData?.footer?.quickLinks,
        baseSiteData?.footer?.quickLinks ?? baseSiteData?.nav
      );
      const socialLinks = normalizeLinkList(siteData?.socialLinks, baseSiteData?.socialLinks, ["icon"]);
      const programsSection = toSafeObject(siteData?.programsSection);
      const objectivesSection = toSafeObject(siteData?.objectivesSection);
      const impactSection = toSafeObject(siteData?.impactStrip);
      const testimonialsSection = toSafeObject(siteData?.testimonialsSection);
      const ctaBannerSection = toSafeObject(siteData?.ctaBanner);
      const contactSection = toSafeObject(siteData?.contact);
      const programItems = toSafeArray(programsSection.items).length
        ? programsSection.items
        : siteData?.publicPrograms ?? siteData?.public_programs;
      const testimonialItems = toSafeArray(testimonialsSection.items).length
        ? testimonialsSection.items
        : siteData?.testimonials;
      const ctaAction = toSafeObject(ctaBannerSection.cta);

      setTenantRecord(tenant);
      setTenantSiteData(siteData);
      const normalizedTemplateKey = normalizeTenantTemplateKey(
        siteData?.templateKey ?? siteData?.template_key ?? ""
      );
      const selectedPreset = getTenantTemplatePreset(normalizedTemplateKey);
      setTenantConfig({
        templateKey: selectedPreset?.key || normalizedTemplateKey,
        name: siteData?.orgName ?? tenant?.name ?? "",
        tagline: siteData?.orgTagline ?? tenant?.tagline ?? "",
        logoUrl: siteData?.logoUrl ?? tenant?.logo_url ?? "",
        contact_email: tenant?.contact_email ?? siteData?.contact?.email ?? "",
        contact_phone: tenant?.contact_phone ?? siteData?.contact?.phone ?? "",
        location: tenant?.location ?? siteData?.contact?.location ?? "",
        orgBio: siteData?.orgBio ?? siteData?.aboutSection?.description ?? "",
        theme,
        navItems,
        footerLinks,
        socialLinks,
        programsTitle: toText(programsSection.title),
        programsDescription: toText(programsSection.description),
        programsItemsText: serializeProgramsLines(programItems),
        objectivesTitle: toText(objectivesSection.title),
        objectivesDescription: toText(objectivesSection.description),
        objectivesText: serializeSimpleList(objectivesSection.objectives),
        goalsText: serializeSimpleList(objectivesSection.goals),
        impactTitle: toText(impactSection.title),
        impactDescription: toText(impactSection.description),
        impactItemsText: serializeImpactLines(impactSection.items),
        testimonialsTitle: toText(testimonialsSection.title),
        testimonialsDescription: toText(testimonialsSection.description),
        testimonialsItemsText: serializeTestimonialLines(testimonialItems),
        ctaTitle: toText(ctaBannerSection.title),
        ctaDescription: toText(ctaBannerSection.description),
        ctaLabel: toText(ctaAction.label),
        ctaHref: toText(ctaAction.href),
        publicContactTitle: toText(contactSection.title),
        publicContactIntro: toText(contactSection.intro),
        publicContactPanelTitle: toText(contactSection.panelTitle),
        publicContactPanelDescription: toText(contactSection.panelDescription),
        features,
      });
      setTenantConfigStep(0);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load tenant settings.");
    } finally {
      setTenantConfigLoading(false);
    }
  };

  const loadTenantTemplates = async () => {
    setTemplateLoading(true);
    try {
      const templates = await getTenantSiteTemplates();
      setTemplateOptions(getTenantTemplateSelectOptions(templates || []));
    } catch (error) {
      setTemplateOptions(getTenantTemplateSelectOptions([]));
      setErrorMessage(error.message || "Failed to load website templates.");
    } finally {
      setTemplateLoading(false);
    }
  };

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const data = await getProjects(tenantId);
      setProjects(data || []);
      if (!selectedProjectId && data?.length) {
        setSelectedProjectId(String(data[0].id));
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to load projects.");
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectMembers = async (projectId) => {
    if (!projectId) {
      setProjectMembers([]);
      return;
    }
    setLoadingProjectMembers(true);
    try {
      const data = await getProjectMembersAdmin(projectId, tenantId);
      setProjectMembers(data || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load project members.");
      setProjectMembers([]);
    } finally {
      setLoadingProjectMembers(false);
    }
  };

  const loadWelfareMeta = async () => {
    try {
      const [accounts, cycles] = await Promise.all([
        getWelfareAccounts(tenantId),
        getWelfareCycles(tenantId),
      ]);
      setWelfareAccounts(accounts);
      setWelfareCycles(cycles);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load welfare metadata.");
    }
  };

  const loadWelfareTransactions = async () => {
    setLoadingWelfare(true);
    try {
      const data = await getWelfareTransactionsAdmin(tenantId);
      setWelfareTransactions(data);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load welfare transactions.");
    } finally {
      setLoadingWelfare(false);
    }
  };

  const loadFinanceData = async () => {
    if (!projects.length) {
      setFinanceExpenses([]);
      setFinanceSales([]);
      return;
    }
    setLoadingFinance(true);
    try {
      const projectIds = projects.map((project) => project.id);
      const [expenseData, saleData] = await Promise.all([
        getProjectExpensesForProjects(projectIds, tenantId),
        getProjectSalesForProjects(projectIds, tenantId),
      ]);
      setFinanceExpenses(expenseData || []);
      setFinanceSales(saleData || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load finance data.");
      setFinanceExpenses([]);
      setFinanceSales([]);
    } finally {
      setLoadingFinance(false);
    }
  };

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const formatProjectMembershipError = (error, fallback) => {
    const message = String(error?.message || "");
    if (message.toLowerCase().includes("row-level security")) {
      return "Permission denied by database policy. Update the Supabase RLS policy on iga_committee_members to allow admins to manage project members.";
    }
    return fallback;
  };

  const formatFinanceError = (error, fallback) => {
    const message = String(error?.message || "");
    if (message.toLowerCase().includes("row-level security")) {
      return "Permission denied by database policy. Update Supabase RLS policies for project_expenses and project_sales to allow admin edits.";
    }
    if (message.toLowerCase().includes("invalid input syntax")) {
      return "Invalid data format. Check amount, dates, and IDs.";
    }
    return fallback;
  };

  const handleModuleClick = (module) => {
    if (!module?.sections?.length) {
      return;
    }
    setActiveModule((prev) => (prev === module.key ? null : module.key));
  };

  const activeModuleConfig = adminModules.find((module) => module.key === activeModule);
  const activeSections = new Set(activeModuleConfig?.sections || []);

  const handleMemberChange = (e) => {
    const { name, value } = e.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleInviteChange = (e) => {
    const { name, value } = e.target;
    setInviteForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleWelfareChange = (e) => {
    const { name, value } = e.target;
    setWelfareForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleExpenseChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    setExpenseForm((prev) => ({ ...prev, [name]: nextValue }));
    resetMessages();
  };

  const handleSaleChange = (e) => {
    const { name, value } = e.target;
    setSaleForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleTenantConfigChange = (e) => {
    const { name, value } = e.target;
    setTenantConfig((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleTenantThemeChange = (key, value) => {
    setTenantConfig((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        [key]: value,
      },
    }));
    resetMessages();
  };

  const handleTenantFeatureToggle = (key) => {
    setTenantConfig((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features?.[key],
      },
    }));
    resetMessages();
  };

  const updateLinkListItem = (listKey, index, field, value) => {
    setTenantConfig((prev) => {
      const list = Array.isArray(prev[listKey]) ? [...prev[listKey]] : [];
      list[index] = { ...(list[index] || {}), [field]: value };
      return { ...prev, [listKey]: list };
    });
    resetMessages();
  };

  const addLinkListItem = (listKey, extra = {}) => {
    setTenantConfig((prev) => {
      const list = Array.isArray(prev[listKey]) ? [...prev[listKey]] : [];
      list.push({ label: "", href: "", ...extra });
      return { ...prev, [listKey]: list };
    });
    resetMessages();
  };

  const removeLinkListItem = (listKey, index) => {
    setTenantConfig((prev) => {
      const list = Array.isArray(prev[listKey]) ? prev[listKey].filter((_, i) => i !== index) : [];
      return { ...prev, [listKey]: list };
    });
    resetMessages();
  };

  const handleTenantConfigSave = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!tenantId) {
      setErrorMessage("Tenant workspace not found.");
      return;
    }

    try {
      setTenantConfigSaving(true);
      const nameValue = tenantConfig.name.trim() || tenantRecord?.name || "Tenant";
      const taglineValue = tenantConfig.tagline.trim();
      const logoValue = tenantConfig.logoUrl.trim();
      const contactEmail = tenantConfig.contact_email.trim();
      const contactPhone = tenantConfig.contact_phone.trim();
      const locationValue = tenantConfig.location.trim();
      const orgBioValue = tenantConfig.orgBio.trim();
      const programsTitleValue = tenantConfig.programsTitle.trim();
      const programsDescriptionValue = tenantConfig.programsDescription.trim();
      const programsItems = parseProgramsLines(tenantConfig.programsItemsText);
      const objectivesTitleValue = tenantConfig.objectivesTitle.trim();
      const objectivesDescriptionValue = tenantConfig.objectivesDescription.trim();
      const objectivesItems = parseLines(tenantConfig.objectivesText);
      const goalsItems = parseLines(tenantConfig.goalsText);
      const impactTitleValue = tenantConfig.impactTitle.trim();
      const impactDescriptionValue = tenantConfig.impactDescription.trim();
      const impactItems = parseImpactLines(tenantConfig.impactItemsText);
      const testimonialsTitleValue = tenantConfig.testimonialsTitle.trim();
      const testimonialsDescriptionValue = tenantConfig.testimonialsDescription.trim();
      const testimonialItems = parseTestimonialLines(tenantConfig.testimonialsItemsText);
      const ctaTitleValue = tenantConfig.ctaTitle.trim();
      const ctaDescriptionValue = tenantConfig.ctaDescription.trim();
      const ctaLabelValue = tenantConfig.ctaLabel.trim();
      const ctaHrefValue = tenantConfig.ctaHref.trim();
      const contactTitleValue = tenantConfig.publicContactTitle.trim();
      const contactIntroValue = tenantConfig.publicContactIntro.trim();
      const contactPanelTitleValue = tenantConfig.publicContactPanelTitle.trim();
      const contactPanelDescriptionValue = tenantConfig.publicContactPanelDescription.trim();
      const ctaActionValue =
        ctaLabelValue && ctaHrefValue
          ? {
              label: ctaLabelValue,
              href: ctaHrefValue,
            }
          : null;

      const nextSiteData = {
        ...(tenantSiteData || {}),
        templateKey: normalizeTenantTemplateKey(tenantConfig.templateKey),
        orgName: nameValue,
        orgTagline: taglineValue || null,
        logoUrl: logoValue || null,
        orgBio: orgBioValue || null,
        theme: { ...tenantConfig.theme },
        tenantNav: sanitizeLinkList(tenantConfig.navItems),
        socialLinks: sanitizeLinkList(tenantConfig.socialLinks, ["icon"]),
        features: { ...(tenantConfig.features || {}) },
        contact: {
          ...(tenantSiteData?.contact ?? {}),
          title: contactTitleValue || null,
          intro: contactIntroValue || null,
          panelTitle: contactPanelTitleValue || null,
          panelDescription: contactPanelDescriptionValue || null,
          email: contactEmail || null,
          phone: contactPhone || null,
          location: locationValue || null,
        },
        footer: {
          ...(tenantSiteData?.footer ?? {}),
          quickLinks: sanitizeLinkList(tenantConfig.footerLinks),
        },
        aboutSection: {
          ...(tenantSiteData?.aboutSection ?? {}),
          description: orgBioValue || "",
        },
        programsSection: {
          ...(tenantSiteData?.programsSection ?? {}),
          title: programsTitleValue || null,
          description: programsDescriptionValue || null,
          items: programsItems,
        },
        objectivesSection: {
          ...(tenantSiteData?.objectivesSection ?? {}),
          title: objectivesTitleValue || null,
          description: objectivesDescriptionValue || null,
          objectives: objectivesItems,
          goals: goalsItems,
        },
        impactStrip: {
          ...(tenantSiteData?.impactStrip ?? {}),
          title: impactTitleValue || null,
          description: impactDescriptionValue || null,
          items: impactItems,
        },
        testimonialsSection: {
          ...(tenantSiteData?.testimonialsSection ?? {}),
          title: testimonialsTitleValue || null,
          description: testimonialsDescriptionValue || null,
          items: testimonialItems,
        },
        ctaBanner: {
          ...(tenantSiteData?.ctaBanner ?? {}),
          title: ctaTitleValue || null,
          description: ctaDescriptionValue || null,
          cta: ctaActionValue,
        },
      };

      const updated = await updateTenant(tenantId, {
        name: nameValue,
        tagline: taglineValue || null,
        logo_url: logoValue || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        location: locationValue || null,
        site_data: nextSiteData,
      });

      setTenantRecord(updated);
      setTenantSiteData(updated?.site_data ?? nextSiteData);
      const normalizedTemplateKey = normalizeTenantTemplateKey(
        updated?.site_data?.templateKey ?? tenantConfig.templateKey
      );
      if (typeof onTenantUpdated === "function") {
        onTenantUpdated(updated);
      }
      setTenantConfig((prev) => ({
        ...prev,
        templateKey: normalizedTemplateKey,
        name: nameValue,
        tagline: taglineValue,
        logoUrl: logoValue,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        location: locationValue,
        orgBio: orgBioValue,
        programsTitle: programsTitleValue,
        programsDescription: programsDescriptionValue,
        programsItemsText: serializeProgramsLines(programsItems),
        objectivesTitle: objectivesTitleValue,
        objectivesDescription: objectivesDescriptionValue,
        objectivesText: serializeSimpleList(objectivesItems),
        goalsText: serializeSimpleList(goalsItems),
        impactTitle: impactTitleValue,
        impactDescription: impactDescriptionValue,
        impactItemsText: serializeImpactLines(impactItems),
        testimonialsTitle: testimonialsTitleValue,
        testimonialsDescription: testimonialsDescriptionValue,
        testimonialsItemsText: serializeTestimonialLines(testimonialItems),
        ctaTitle: ctaTitleValue,
        ctaDescription: ctaDescriptionValue,
        ctaLabel: ctaLabelValue,
        ctaHref: ctaHrefValue,
        publicContactTitle: contactTitleValue,
        publicContactIntro: contactIntroValue,
        publicContactPanelTitle: contactPanelTitleValue,
        publicContactPanelDescription: contactPanelDescriptionValue,
      }));
      setStatusMessage("Tenant settings updated.");
    } catch (error) {
      setErrorMessage(error.message || "Failed to update tenant settings.");
    } finally {
      setTenantConfigSaving(false);
    }
  };

  const handleTenantStepChange = (nextStep) => {
    setTenantConfigStep((prev) => {
      const clamped = Math.min(Math.max(nextStep, 0), tenantConfigSteps.length - 1);
      return Number.isFinite(clamped) ? clamped : prev;
    });
  };

  const handleProjectMemberRoleChange = (projectMemberId, value) => {
    setProjectMemberRoleEdits((prev) => ({
      ...prev,
      [projectMemberId]: value,
    }));
    resetMessages();
  };

  const handleProjectMemberChange = (e) => {
    const { name, value } = e.target;
    setProjectMemberForm((prev) => ({ ...prev, [name]: value }));
    resetMessages();
  };

  const handleProjectMemberSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    if (!projectMemberForm.member_id) {
      setErrorMessage("Select a member to add.");
      return;
    }

    try {
      setAddingProjectMember(true);
      await addProjectMemberAdmin({
        projectId: selectedProjectId,
        memberId: projectMemberForm.member_id,
        role: projectMemberForm.role,
        term_start: projectMemberForm.term_start,
        tenantId,
      });
      setStatusMessage("Member added to project.");
      setProjectMemberForm((prev) => ({
        ...prev,
        member_id: "",
        role: "Member",
      }));
      await loadProjectMembers(selectedProjectId);
    } catch (error) {
      setErrorMessage(formatProjectMembershipError(error, error.message || "Failed to add member to project."));
    } finally {
      setAddingProjectMember(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!expenseForm.project_id) {
      setErrorMessage("Select a project for this expense.");
      return;
    }
    if (!expenseForm.category.trim()) {
      setErrorMessage("Expense category is required.");
      return;
    }
    const amountValue = Number.parseFloat(expenseForm.amount);
    if (!Number.isFinite(amountValue)) {
      setErrorMessage("Expense amount is required.");
      return;
    }

    try {
      const payload = {
        project_id: expenseForm.project_id,
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        amount: amountValue,
        vendor: expenseForm.vendor,
        description: expenseForm.description,
        receipt: expenseForm.receipt,
        approved_by: expenseForm.approved ? user?.id || null : null,
        created_by: user?.id || null,
      };

      if (selectedExpenseId) {
        await updateProjectExpense(selectedExpenseId, payload, tenantId);
        setStatusMessage("Expense updated.");
      } else {
        await createProjectExpense(expenseForm.project_id, payload, tenantId);
        setStatusMessage("Expense created.");
      }

      setExpenseForm({
        ...initialExpenseForm,
        project_id: financeProjectId || expenseForm.project_id || "",
      });
      setSelectedExpenseId(null);
      await loadFinanceData();
    } catch (error) {
      setErrorMessage(formatFinanceError(error, error.message || "Failed to save expense."));
    }
  };

  const handleExpenseEdit = (expense) => {
    setSelectedExpenseId(expense.id);
    setExpenseForm({
      project_id: String(expense.project_id || ""),
      expense_date: expense.expense_date ? String(expense.expense_date).slice(0, 10) : "",
      category: expense.category || "",
      amount: expense.amount ?? "",
      vendor: expense.vendor || "",
      description: expense.description || "",
      receipt: Boolean(expense.receipt),
      approved: Boolean(expense.approved_by),
    });
    resetMessages();
  };

  const handleExpenseCancel = () => {
    setSelectedExpenseId(null);
    setExpenseForm({
      ...initialExpenseForm,
      project_id: financeProjectId || "",
    });
    resetMessages();
  };

  const handleExpenseDelete = async (expenseId) => {
    if (!expenseId) return;
    if (!window.confirm("Delete this expense? This cannot be undone.")) {
      return;
    }
    resetMessages();
    try {
      await deleteProjectExpense(expenseId, tenantId);
      setStatusMessage("Expense deleted.");
      await loadFinanceData();
    } catch (error) {
      setErrorMessage(formatFinanceError(error, error.message || "Failed to delete expense."));
    }
  };

  const handleExpenseApprove = async (expenseId) => {
    if (!expenseId) return;
    resetMessages();
    try {
      await updateProjectExpense(expenseId, { approved_by: user?.id || null }, tenantId);
      setStatusMessage("Expense approved.");
      await loadFinanceData();
    } catch (error) {
      setErrorMessage(formatFinanceError(error, error.message || "Failed to approve expense."));
    }
  };

  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!saleForm.project_id) {
      setErrorMessage("Select a project for this sale.");
      return;
    }
    if (!saleForm.sale_date) {
      setErrorMessage("Sale date is required.");
      return;
    }
    const unitPrice = Number.parseFloat(saleForm.unit_price) || 0;
    const quantityUnits = Number.parseFloat(saleForm.quantity_units) || 0;
    const totalAmount =
      saleForm.total_amount !== "" && saleForm.total_amount !== null
        ? Number.parseFloat(saleForm.total_amount)
        : unitPrice * quantityUnits;

    try {
      const payload = {
        project_id: saleForm.project_id,
        sale_date: saleForm.sale_date,
        product_type: saleForm.product_type,
        quantity_units: quantityUnits,
        unit_price: unitPrice,
        total_amount: Number.isFinite(totalAmount) ? totalAmount : 0,
        customer_name: saleForm.customer_name,
        customer_type: saleForm.customer_type,
        payment_status: saleForm.payment_status,
        created_by: user?.id || null,
      };

      if (selectedSaleId) {
        await updateProjectSale(selectedSaleId, payload, tenantId);
        setStatusMessage("Sale updated.");
      } else {
        await createProjectSale(saleForm.project_id, payload, tenantId);
        setStatusMessage("Sale created.");
      }

      setSaleForm({
        ...initialSaleForm,
        project_id: financeProjectId || saleForm.project_id || "",
      });
      setSelectedSaleId(null);
      await loadFinanceData();
    } catch (error) {
      setErrorMessage(formatFinanceError(error, error.message || "Failed to save sale."));
    }
  };

  const handleSaleEdit = (sale) => {
    setSelectedSaleId(sale.id);
    setSaleForm({
      project_id: String(sale.project_id || ""),
      sale_date: sale.sale_date ? String(sale.sale_date).slice(0, 10) : "",
      product_type: sale.product_type || "",
      quantity_units: sale.quantity_units ?? "",
      unit_price: sale.unit_price ?? "",
      total_amount: sale.total_amount ?? "",
      customer_name: sale.customer_name || "",
      customer_type: sale.customer_type || "retail",
      payment_status: sale.payment_status || "paid",
    });
    resetMessages();
  };

  const handleSaleCancel = () => {
    setSelectedSaleId(null);
    setSaleForm({
      ...initialSaleForm,
      project_id: financeProjectId || "",
    });
    resetMessages();
  };

  const handleSaleDelete = async (saleId) => {
    if (!saleId) return;
    if (!window.confirm("Delete this sale? This cannot be undone.")) {
      return;
    }
    resetMessages();
    try {
      await deleteProjectSale(saleId, tenantId);
      setStatusMessage("Sale deleted.");
      await loadFinanceData();
    } catch (error) {
      setErrorMessage(formatFinanceError(error, error.message || "Failed to delete sale."));
    }
  };

  const handleRemoveProjectMember = async (projectMember) => {
    if (!projectMember?.id) {
      return;
    }
    if (!window.confirm("Remove this member from the project?")) {
      return;
    }
    resetMessages();
    try {
      setRemovingProjectMemberId(projectMember.id);
      await removeProjectMemberAdmin(projectMember.id, tenantId);
      setStatusMessage("Member removed from project.");
      await loadProjectMembers(selectedProjectId);
      setProjectMemberRoleEdits((prev) => {
        const next = { ...prev };
        delete next[projectMember.id];
        return next;
      });
    } catch (error) {
      setErrorMessage(formatProjectMembershipError(error, error.message || "Failed to remove member."));
    } finally {
      setRemovingProjectMemberId(null);
    }
  };

  const handleSaveProjectMemberRole = async (projectMember) => {
    if (!projectMember?.id) {
      return;
    }
    const currentRole = projectMember.role || "Member";
    const nextRole = projectMemberRoleEdits[projectMember.id] || currentRole;
    if (nextRole === currentRole) {
      return;
    }
    resetMessages();
    try {
      setSavingProjectMemberId(projectMember.id);
      await updateProjectMemberAdmin(projectMember.id, { role: nextRole }, tenantId);
      setStatusMessage("Project role updated.");
      await loadProjectMembers(selectedProjectId);
      setProjectMemberRoleEdits((prev) => {
        const next = { ...prev };
        delete next[projectMember.id];
        return next;
      });
    } catch (error) {
      setErrorMessage(
        formatProjectMembershipError(error, error.message || "Failed to update project role.")
      );
    } finally {
      setSavingProjectMemberId(null);
    }
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!memberForm.name.trim()) {
      setErrorMessage("Member name is required.");
      return;
    }

    if (!memberForm.phone_number.trim()) {
      setErrorMessage("Phone number is required.");
      return;
    }

    try {
      if (selectedMemberId) {
        await updateMemberAdmin(selectedMemberId, memberForm);
        setStatusMessage("Member updated successfully.");
      } else {
        await createMemberAdmin(memberForm);
        setStatusMessage("Member created successfully.");
      }
      setMemberForm(initialMemberForm);
      setSelectedMemberId(null);
      setShowMemberForm(false);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save member.");
    }
  };

  const handleEditMember = (member) => {
    setMemberForm({
      ...initialMemberForm,
      ...member,
    });
    setSelectedMemberId(member.id);
    setShowMemberForm(true);
    resetMessages();
  };

  const handleMemberCancel = () => {
    setMemberForm(initialMemberForm);
    setSelectedMemberId(null);
    setShowMemberForm(false);
    resetMessages();
  };

  const handleNewMember = () => {
    setMemberForm(initialMemberForm);
    setSelectedMemberId(null);
    setShowMemberForm(true);
    resetMessages();
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    if (!inviteForm.tenant_id) {
      setErrorMessage("Select a tenant workspace for this invite.");
      return;
    }

    if (!inviteForm.phone_number.trim()) {
      setErrorMessage("Phone number is required for invites.");
      return;
    }

    try {
      const days = Number.parseInt(inviteForm.expires_in_days, 10);
      const expiresAt = Number.isFinite(days)
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { invite, code } = await createMemberInvite({
        tenant_id: inviteForm.tenant_id,
        email: inviteForm.email,
        phone_number: inviteForm.phone_number,
        role: inviteForm.role,
        expires_at: expiresAt,
        notes: inviteForm.notes,
        created_by: user?.id,
      });

      setGeneratedInvite({ code, invite });
      setInviteForm((prev) => ({
        ...initialInviteForm,
        tenant_id: prev.tenant_id,
      }));
      setStatusMessage("Invite created. Share the code with the member.");
      await loadInvites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to create invite.");
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    resetMessages();
    try {
      await revokeMemberInvite(inviteId);
      setStatusMessage("Invite revoked.");
      await loadInvites();
    } catch (error) {
      setErrorMessage(error.message || "Failed to revoke invite.");
    }
  };

  const handleCopyInvite = async () => {
    if (!generatedInvite?.code) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedInvite.code);
        setStatusMessage("Invite code copied to clipboard.");
      }
    } catch (error) {
      setErrorMessage("Unable to copy invite code.");
    }
  };

  const handleWelfareSubmit = async (e) => {
    e.preventDefault();
    resetMessages();

    const amountValue = Number.parseFloat(welfareForm.amount);
    if (!Number.isFinite(amountValue)) {
      setErrorMessage("Amount is required.");
      return;
    }

    if (!welfareForm.date) {
      setErrorMessage("Transaction date is required.");
      return;
    }

    const payload = {
      welfare_account_id: welfareForm.welfare_account_id
        ? Number.parseInt(welfareForm.welfare_account_id, 10)
        : null,
      cycle_id: welfareForm.cycle_id ? Number.parseInt(welfareForm.cycle_id, 10) : null,
      member_id: welfareForm.member_id ? Number.parseInt(welfareForm.member_id, 10) : null,
      amount: amountValue,
      transaction_type: welfareForm.transaction_type,
      status: welfareForm.status,
      date: welfareForm.date,
      description: welfareForm.description,
    };

    try {
      if (selectedWelfareId) {
        await updateWelfareTransaction(selectedWelfareId, payload, tenantId);
        setStatusMessage("Welfare transaction updated.");
      } else {
        await createWelfareTransaction(payload, tenantId);
        setStatusMessage("Welfare transaction recorded.");
      }

      setWelfareForm({
        ...initialWelfareForm,
        welfare_account_id:
          welfareForm.welfare_account_id ||
          (welfareAccounts[0] ? String(welfareAccounts[0].id) : ""),
      });
      setSelectedWelfareId(null);
      await loadWelfareTransactions();
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to save welfare transaction.");
    }
  };

  const handleEditWelfare = (transaction) => {
    setWelfareForm({
      member_id: transaction.member_id ? String(transaction.member_id) : "",
      welfare_account_id: transaction.welfare_account_id
        ? String(transaction.welfare_account_id)
        : "",
      cycle_id: transaction.cycle_id ? String(transaction.cycle_id) : "",
      amount: transaction.amount ?? "",
      transaction_type: transaction.transaction_type || "contribution",
      status: transaction.status || "Completed",
      date: transaction.date ? String(transaction.date).slice(0, 10) : initialWelfareForm.date,
      description: transaction.description || "",
    });
    setSelectedWelfareId(transaction.id);
    resetMessages();
  };

  const handleWelfareCancel = () => {
    setWelfareForm({
      ...initialWelfareForm,
      welfare_account_id: welfareAccounts[0] ? String(welfareAccounts[0].id) : "",
    });
    setSelectedWelfareId(null);
    resetMessages();
  };

  const handleDeleteWelfare = async (transactionId) => {
    if (!transactionId) {
      return;
    }
    if (!window.confirm("Delete this welfare transaction? This cannot be undone.")) {
      return;
    }
    resetMessages();
    try {
      await deleteWelfareTransaction(transactionId, tenantId);
      setStatusMessage("Welfare transaction deleted.");
      await loadWelfareTransactions();
      await loadMembers();
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete welfare transaction.");
    }
  };

  const formatWelfareAmount = (amount) => {
    const numericAmount =
      typeof amount === "string" ? Number.parseFloat(amount) : Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return "-";
    }
    return numericAmount.toLocaleString("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    });
  };

  const formatWelfareDate = (date) => {
    if (!date) {
      return "-";
    }
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return "KES 0";
    }
    return numeric.toLocaleString("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    });
  };

  const financeTotals = useMemo(() => {
    const expenseTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const salesTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const pendingApprovals = filteredExpenses.filter((expense) => !expense.approved_by).length;
    return {
      expenseTotal,
      salesTotal,
      netTotal: salesTotal - expenseTotal,
      pendingApprovals,
    };
  }, [filteredExpenses, filteredSales]);

  const formatShortDate = (date) => {
    if (!date) {
      return "-";
    }
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div className="admin-card">
          <h2>Admin Access Required</h2>
          <p>You do not have permission to access admin tools.</p>
        </div>
      </div>
    );
  }

  // Get first 5 modules for mobile nav (most commonly used)
  const mobileNavModules = adminModules.filter(m => m.sections?.length).slice(0, 5);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-search admin-search--top">
          <Icon name="search" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members, invites, email or phone"
          />
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      {!activeModule && (
        <div className="admin-card admin-launchpad">
          <div className="admin-launchpad-header">
            <div>
              <h3>Admin Shortcuts</h3>
              <p className="admin-help">
                Quick access to the most common admin tools and workflows.
              </p>
            </div>
          </div>
          <div className="admin-launchpad-grid">
            {adminModules.map((module) => {
              const isEnabled = Boolean(module.sections?.length);
              const isOpen = isEnabled && activeModule === module.key;
              return (
                <button
                  key={module.key}
                  type="button"
                  className={`admin-launchpad-card${isEnabled ? "" : " is-disabled"}${
                    isOpen ? " is-open" : ""
                  }`}
                  onClick={() => handleModuleClick(module)}
                  disabled={!isEnabled}
                  aria-disabled={!isEnabled}
                >
                  <span className={`admin-launchpad-icon tone-${module.tone || "emerald"}`}>
                    <Icon name={module.icon} size={20} />
                  </span>
                  <span className="admin-launchpad-content">
                    <span className="admin-launchpad-title">{module.title}</span>
                    <span className="admin-launchpad-desc">{module.description}</span>
                    <span className="admin-launchpad-meta">
                      {isEnabled ? (isOpen ? "Focused" : "Open") : "Coming soon"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="admin-launchpad-note">
            Select a tile to open its tools below.
          </p>
        </div>
      )}

      {(showMemberForm || activeSections.has("invites-form") || activeSections.has("welfare-form")) && (
        <div className="admin-grid">
          {showMemberForm && (
            <div className="admin-card" id="admin-members">
              <div className="admin-card-header">
                <h3>{selectedMemberId ? "Edit Member" : "Create Member"}</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setShowMemberForm(false)}
                >
                  Back to list
                </button>
              </div>
              <p className="admin-help">
                Create a member profile. Members can log in later using the invite link sent to their email.
              </p>
              <form className="admin-form" onSubmit={handleMemberSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Name *</label>
                    <input
                      name="name"
                      value={memberForm.name}
                      onChange={handleMemberChange}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Email</label>
                    <input
                      name="email"
                      type="email"
                      value={memberForm.email}
                      onChange={handleMemberChange}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Phone Number *</label>
                    <input
                      name="phone_number"
                      value={memberForm.phone_number}
                      onChange={handleMemberChange}
                      placeholder="+254 700 000 000"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Role</label>
                    <select name="role" value={memberForm.role} onChange={handleMemberChange}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="project_manager">Project Manager</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Status</label>
                    <select name="status" value={memberForm.status} onChange={handleMemberChange}>
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Join Date</label>
                    <input
                      type="date"
                      name="join_date"
                      value={memberForm.join_date}
                      onChange={handleMemberChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Gender</label>
                    <select name="gender" value={memberForm.gender} onChange={handleMemberChange}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Occupation</label>
                    <input
                      name="occupation"
                      value={memberForm.occupation}
                      onChange={handleMemberChange}
                      placeholder="Occupation"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>National ID</label>
                    <input
                      name="national_id"
                      value={memberForm.national_id}
                      onChange={handleMemberChange}
                      placeholder="ID number"
                    />
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Address</label>
                    <input
                      name="address"
                      value={memberForm.address}
                      onChange={handleMemberChange}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>County</label>
                    <input
                      name="county"
                      value={memberForm.county}
                      onChange={handleMemberChange}
                      placeholder="County"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Sub-County</label>
                    <input
                      name="sub_county"
                      value={memberForm.sub_county}
                      onChange={handleMemberChange}
                      placeholder="Sub-county"
                    />
                  </div>
                </div>

                <h4 className="admin-section-title">
                  <Icon name="heart" size={16} /> Emergency Contact
                </h4>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Name</label>
                    <input
                      name="emergency_contact_name"
                      value={memberForm.emergency_contact_name}
                      onChange={handleMemberChange}
                      placeholder="Contact name"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Phone</label>
                    <input
                      name="emergency_contact_phone"
                      value={memberForm.emergency_contact_phone}
                      onChange={handleMemberChange}
                      placeholder="Contact phone"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Relationship</label>
                    <select
                      name="emergency_contact_relationship"
                      value={memberForm.emergency_contact_relationship}
                      onChange={handleMemberChange}
                    >
                      <option value="">Select</option>
                      <option value="spouse">Spouse</option>
                      <option value="parent">Parent</option>
                      <option value="sibling">Sibling</option>
                      <option value="child">Child</option>
                      <option value="friend">Friend</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    {selectedMemberId ? "Save Changes" : "Create Member"}
                  </button>
                  {selectedMemberId && (
                    <button className="btn-secondary" type="button" onClick={handleMemberCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {activeSections.has("invites-form") && (
            <div className="admin-card" id="admin-invites">
              <div className="admin-card-header">
                <h3>Generate Invite Code</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setActiveModule(null)}
                >
                  Back to console
                </button>
              </div>
              <p className="admin-help">
                Create a one-time invite code to track onboarding. Share the code securely with the
                member.
              </p>
              <form className="admin-form" onSubmit={handleInviteSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Tenant Workspace *</label>
                    <select
                      name="tenant_id"
                      value={inviteForm.tenant_id}
                      onChange={handleInviteChange}
                    >
                      <option value="">
                        {loadingTenants ? "Loading workspaces..." : "Select a workspace"}
                      </option>
                      {tenantOptions.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name}
                          {tenant.slug ? ` (${tenant.slug})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Email (optional)</label>
                    <input
                      name="email"
                      type="email"
                      value={inviteForm.email}
                      onChange={handleInviteChange}
                      placeholder="member@example.com"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Phone *</label>
                    <input
                      name="phone_number"
                      value={inviteForm.phone_number}
                      onChange={handleInviteChange}
                      placeholder="+254 700 000 000"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Role</label>
                    <select name="role" value={inviteForm.role} onChange={handleInviteChange}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="project_manager">Project Manager</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Expires (days)</label>
                    <input
                      name="expires_in_days"
                      value={inviteForm.expires_in_days}
                      onChange={handleInviteChange}
                      placeholder="30"
                    />
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={inviteForm.notes}
                      onChange={handleInviteChange}
                      placeholder="Optional notes for this invite"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    Generate Invite
                  </button>
                </div>
              </form>

              {generatedInvite ? (
                <div className="admin-invite-output">
                  <div>
                    <span className="admin-invite-label">Invite Code</span>
                    <strong>{generatedInvite.code}</strong>
                  </div>
                  <button className="btn-secondary" type="button" onClick={handleCopyInvite}>
                    Copy Code
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {activeSections.has("welfare-form") && (
            <div className="admin-card" id="admin-welfare">
              <div className="admin-card-header">
                <h3>{selectedWelfareId ? "Edit Welfare Transaction" : "Record Welfare Transaction"}</h3>
                <button
                  type="button"
                  className="link-button admin-card-dismiss"
                  onClick={() => setActiveModule(null)}
                >
                  Back to console
                </button>
              </div>
              <p className="admin-help">
                Log contributions, disbursements, or adjustments. Member totals update automatically
                from recorded transactions.
              </p>
              <form className="admin-form" onSubmit={handleWelfareSubmit}>
                <div className="admin-form-grid">
                  <div className="admin-form-field">
                    <label>Member</label>
                    <select
                      name="member_id"
                      value={welfareForm.member_id}
                      onChange={handleWelfareChange}
                    >
                      <option value="">Group Welfare (no member)</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || `Member #${member.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Amount *</label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      value={welfareForm.amount}
                      onChange={handleWelfareChange}
                      placeholder="1000"
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Transaction Type</label>
                    <select
                      name="transaction_type"
                      value={welfareForm.transaction_type}
                      onChange={handleWelfareChange}
                    >
                      <option value="contribution">Contribution</option>
                      <option value="disbursement">Disbursement</option>
                      <option value="emergency">Emergency</option>
                      <option value="support">Support</option>
                      <option value="adjustment">Adjustment</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Status</label>
                    <select name="status" value={welfareForm.status} onChange={handleWelfareChange}>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Date *</label>
                    <input
                      type="date"
                      name="date"
                      value={welfareForm.date}
                      onChange={handleWelfareChange}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label>Cycle</label>
                    <select name="cycle_id" value={welfareForm.cycle_id} onChange={handleWelfareChange}>
                      <option value="">Select cycle</option>
                      {welfareCycles.map((cycle) => (
                        <option key={cycle.id} value={cycle.id}>
                          Cycle {cycle.cycle_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field">
                    <label>Welfare Account</label>
                    <select
                      name="welfare_account_id"
                      value={welfareForm.welfare_account_id}
                      onChange={handleWelfareChange}
                    >
                      <option value="">Select account</option>
                      {welfareAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-form-field admin-form-field--full">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={welfareForm.description}
                      onChange={handleWelfareChange}
                      placeholder="Optional note about this welfare entry"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="btn-primary" type="submit">
                    {selectedWelfareId ? "Save Changes" : "Record Transaction"}
                  </button>
                  {selectedWelfareId && (
                    <button className="btn-secondary" type="button" onClick={handleWelfareCancel}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {activeSections.has("tenant-config") && (
        <div className="admin-card" id="admin-tenant-config">
          <div className="admin-card-header">
            <h3>Tenant Configuration</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          <p className="admin-help">
            Update branding, navigation, and feature access for this tenant workspace.
          </p>
          {tenantConfigLoading ? (
            <p className="admin-help">Loading tenant settings...</p>
          ) : (
            <form className="admin-form" onSubmit={handleTenantConfigSave}>
              <div className="admin-stepper">
                {tenantConfigSteps.map((step, index) => {
                  const isActive = index === tenantConfigStep;
                  const isComplete = index < tenantConfigStep;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      className={`admin-step${isActive ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                      onClick={() => handleTenantStepChange(index)}
                    >
                      <span className="admin-step-index">{index + 1}</span>
                      <span className="admin-step-text">
                        <span className="admin-step-title">{step.title}</span>
                        <span className="admin-step-desc">{step.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="admin-step-panel">
                {tenantConfigStep === 0 && (
                  <>
                    <h4 className="admin-section-title">
                      <Icon name="layers" size={16} /> Website Template
                    </h4>
                    <div className="admin-form-grid">
                      <div className="admin-form-field admin-form-field--full">
                        <label>Template</label>
                        <select
                          name="templateKey"
                          value={tenantConfig.templateKey}
                          onChange={handleTenantConfigChange}
                        >
                          {templateOptions.map((template) => (
                            <option key={template.key} value={template.key}>
                              {template.label}
                            </option>
                          ))}
                        </select>
                        {templateLoading ? (
                          <p className="admin-help">Loading templates...</p>
                        ) : selectedTemplate?.description ? (
                          <p className="admin-help">{selectedTemplate.description}</p>
                        ) : (
                          <p className="admin-help">
                            This workspace uses the shared public website template.
                          </p>
                        )}
                        {selectedTemplateOutline ? (
                          <div className="admin-template-outline" role="note" aria-label="Template section outline">
                            <p className="admin-template-outline-title">{selectedTemplateOutline.title}</p>
                            <ol className="admin-template-outline-list">
                              {selectedTemplateOutline.sections.map((section, index) => (
                                <li key={`${selectedTemplatePreset?.key || "template"}-outline-${section}`}>
                                  <span className="admin-template-outline-index">{index + 1}</span>
                                  <span>{section}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}

                {tenantConfigStep === 1 && (
                  <>
                    <h4 className="admin-section-title">
                      <Icon name="layers" size={16} /> Branding
                    </h4>
                    <div className="admin-form-grid">
                      <div className="admin-form-field">
                        <label>Organization Name *</label>
                        <input
                          name="name"
                          value={tenantConfig.name}
                          onChange={handleTenantConfigChange}
                          placeholder="Tenant name"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Tagline</label>
                        <input
                          name="tagline"
                          value={tenantConfig.tagline}
                          onChange={handleTenantConfigChange}
                          placeholder="Short tagline"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Logo URL</label>
                        <input
                          name="logoUrl"
                          value={tenantConfig.logoUrl}
                          onChange={handleTenantConfigChange}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Contact Email</label>
                        <input
                          name="contact_email"
                          type="email"
                          value={tenantConfig.contact_email}
                          onChange={handleTenantConfigChange}
                          placeholder="hello@example.com"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Contact Phone</label>
                        <input
                          name="contact_phone"
                          value={tenantConfig.contact_phone}
                          onChange={handleTenantConfigChange}
                          placeholder="+254 700 000 000"
                        />
                      </div>
                      <div className="admin-form-field">
                        <label>Location</label>
                        <input
                          name="location"
                          value={tenantConfig.location}
                          onChange={handleTenantConfigChange}
                          placeholder="City, Country"
                        />
                      </div>
                    </div>
                  </>
                )}

                {tenantConfigStep === 2 && (
                  <>
                    <h4 className="admin-section-title">
                      <Icon name="target" size={16} /> Theme Colors
                    </h4>
                    <div className="admin-form-grid">
                      {[
                        { key: "sidebar", label: "Sidebar" },
                        { key: "sidebarAlt", label: "Sidebar Alt" },
                        { key: "sidebarAlt2", label: "Sidebar Alt 2" },
                        { key: "primary", label: "Primary" },
                        { key: "primaryDark", label: "Primary Dark" },
                        { key: "secondary", label: "Secondary" },
                        { key: "accent", label: "Accent" },
                        { key: "accentDark", label: "Accent Dark" },
                        { key: "ink", label: "Ink" },
                        { key: "offWhite", label: "Off White" },
                      ].map((item) => (
                        <div className="admin-form-field admin-color-field" key={item.key}>
                          <label>{item.label}</label>
                          <div className="admin-color-control">
                            <input
                              type="color"
                              value={tenantConfig.theme[item.key]}
                              onChange={(e) => handleTenantThemeChange(item.key, e.target.value)}
                            />
                            <span className="admin-color-value">{tenantConfig.theme[item.key]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tenantConfigStep === 3 && (
                  <>
                    <h4 className="admin-section-title">
                      <Icon name="menu" size={16} /> Navigation
                    </h4>
                    {tenantConfig.navItems.length ? (
                      tenantConfig.navItems.map((item, index) => (
                        <div className="admin-form-grid" key={`nav-${index}`}>
                          <div className="admin-form-field">
                            <label>Label</label>
                            <input
                              value={item.label}
                              onChange={(e) =>
                                updateLinkListItem("navItems", index, "label", e.target.value)
                              }
                              placeholder="Home"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Link</label>
                            <input
                              value={item.href}
                              onChange={(e) =>
                                updateLinkListItem("navItems", index, "href", e.target.value)
                              }
                              placeholder="#about"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Actions</label>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => removeLinkListItem("navItems", index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="admin-help">No navigation links yet.</p>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => addLinkListItem("navItems")}
                    >
                      Add navigation link
                    </button>

                    <h4 className="admin-section-title">
                      <Icon name="tag" size={16} /> Footer Links
                    </h4>
                    {tenantConfig.footerLinks.length ? (
                      tenantConfig.footerLinks.map((item, index) => (
                        <div className="admin-form-grid" key={`footer-${index}`}>
                          <div className="admin-form-field">
                            <label>Label</label>
                            <input
                              value={item.label}
                              onChange={(e) =>
                                updateLinkListItem("footerLinks", index, "label", e.target.value)
                              }
                              placeholder="Contact"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Link</label>
                            <input
                              value={item.href}
                              onChange={(e) =>
                                updateLinkListItem("footerLinks", index, "href", e.target.value)
                              }
                              placeholder="#contact"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Actions</label>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => removeLinkListItem("footerLinks", index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="admin-help">No footer links yet.</p>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => addLinkListItem("footerLinks")}
                    >
                      Add footer link
                    </button>

                    <h4 className="admin-section-title">
                      <Icon name="users" size={16} /> Social Links
                    </h4>
                    {tenantConfig.socialLinks.length ? (
                      tenantConfig.socialLinks.map((item, index) => (
                        <div className="admin-form-grid" key={`social-${index}`}>
                          <div className="admin-form-field">
                            <label>Label</label>
                            <input
                              value={item.label}
                              onChange={(e) =>
                                updateLinkListItem("socialLinks", index, "label", e.target.value)
                              }
                              placeholder="Facebook"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Link</label>
                            <input
                              value={item.href}
                              onChange={(e) =>
                                updateLinkListItem("socialLinks", index, "href", e.target.value)
                              }
                              placeholder="https://..."
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Icon</label>
                            <input
                              value={item.icon || ""}
                              onChange={(e) =>
                                updateLinkListItem("socialLinks", index, "icon", e.target.value)
                              }
                              placeholder="facebook"
                            />
                          </div>
                          <div className="admin-form-field">
                            <label>Actions</label>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => removeLinkListItem("socialLinks", index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="admin-help">No social links yet.</p>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => addLinkListItem("socialLinks", { icon: "" })}
                    >
                      Add social link
                    </button>
                  </>
                )}

                {tenantConfigStep === 4 && (
                  <>
                    <h4 className="admin-section-title">
                      <Icon name="check-circle" size={16} /> Feature Access
                    </h4>
                    <div className="admin-form-grid">
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.welfare)}
                          onChange={() => handleTenantFeatureToggle("welfare")}
                        />
                        Welfare
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.projects)}
                          onChange={() => handleTenantFeatureToggle("projects")}
                        />
                        Projects
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.expenses)}
                          onChange={() => handleTenantFeatureToggle("expenses")}
                        />
                        Expenses
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.reports)}
                          onChange={() => handleTenantFeatureToggle("reports")}
                        />
                        Reports
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.news)}
                          onChange={() => handleTenantFeatureToggle("news")}
                        />
                        News
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.documents)}
                          onChange={() => handleTenantFeatureToggle("documents")}
                        />
                        Documents
                      </label>
                      <label className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={Boolean(tenantConfig.features.meetings)}
                          onChange={() => handleTenantFeatureToggle("meetings")}
                        />
                        Meetings
                      </label>
                    </div>

                    <h4 className="admin-section-title">
                      <Icon name="feather" size={16} /> Organization Bio
                    </h4>
                    <div className="admin-form-grid">
                      <div className="admin-form-field admin-form-field--full">
                        <label>Bio</label>
                        <textarea
                          name="orgBio"
                          value={tenantConfig.orgBio}
                          onChange={handleTenantConfigChange}
                          rows={4}
                          placeholder="Describe the tenant so we can use it on the website and profile."
                        />
                      </div>
                    </div>

                  </>
                )}
              </div>

              <div className="admin-step-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleTenantStepChange(tenantConfigStep - 1)}
                  disabled={tenantConfigStep === 0}
                >
                  Back
                </button>
                {tenantConfigStep < tenantConfigSteps.length - 1 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleTenantStepChange(tenantConfigStep + 1)}
                  >
                    Next
                  </button>
                ) : (
                  <button className="btn-primary" type="submit" disabled={tenantConfigSaving}>
                    {tenantConfigSaving ? "Saving..." : "Save Settings"}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {activeSections.has("projects-manage") && (
        <div className="admin-card" id="admin-projects">
          <div className="admin-card-header">
            <h3>Project Memberships</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          <p className="admin-help">Add or remove members from IGA projects.</p>

          <div className="admin-projects-toolbar">
            <div className="admin-form-field admin-projects-select">
              <label>Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} {project.code ? `(${project.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {loadingProjects ? (
              <span className="admin-inline-muted">Loading projects...</span>
            ) : selectedProject ? (
              <div className="admin-projects-meta">
                <span
                  className={`admin-pill ${
                    String(selectedProject.status || "").toLowerCase() === "completed"
                      ? "is-completed"
                      : "is-active"
                  }`}
                >
                  {selectedProject.status || "Active"}
                </span>
                {selectedProject.code && (
                  <span className="admin-projects-code">{selectedProject.code}</span>
                )}
                {selectedProject.start_date && (
                  <span className="admin-projects-start">
                    Started {formatShortDate(selectedProject.start_date)}
                  </span>
                )}
              </div>
            ) : (
              <span className="admin-inline-muted">Select a project to manage.</span>
            )}
          </div>

          {selectedProjectId ? (
            <div className="admin-projects-grid">
              <div className="admin-projects-panel">
                <h4>Add member</h4>
                <form className="admin-form" onSubmit={handleProjectMemberSubmit}>
                  <div className="admin-form-grid">
                    <div className="admin-form-field">
                      <label>Member</label>
                      <select
                        name="member_id"
                        value={projectMemberForm.member_id}
                        onChange={handleProjectMemberChange}
                      >
                        <option value="">Select member</option>
                        {availableProjectMembers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name || member.email || `Member #${member.id}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>Role</label>
                      <select
                        name="role"
                        value={projectMemberForm.role}
                        onChange={handleProjectMemberChange}
                      >
                        <option value="Member">Member</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Treasurer">Treasurer</option>
                        <option value="Secretary">Secretary</option>
                        <option value="Chair">Chair</option>
                      </select>
                    </div>
                    <div className="admin-form-field">
                      <label>Start date</label>
                      <input
                        type="date"
                        name="term_start"
                        value={projectMemberForm.term_start}
                        onChange={handleProjectMemberChange}
                      />
                    </div>
                  </div>
                  <div className="admin-form-actions">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={addingProjectMember || !availableProjectMembers.length}
                    >
                      {addingProjectMember ? "Adding..." : "Add to project"}
                    </button>
                  </div>
                  {!availableProjectMembers.length && (
                    <p className="admin-helper-inline">
                      All members are already assigned to this project.
                    </p>
                  )}
                </form>
              </div>
              <div className="admin-projects-panel">
                <div className="admin-list-header">
                  <div className="admin-search">
                    <Icon name="search" size={16} />
                    <input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search project members"
                    />
                  </div>
                  <span className="admin-projects-count">{projectMembers.length} members</span>
                </div>
                {loadingProjectMembers ? (
                  <p>Loading project members...</p>
                ) : filteredProjectMembers.length === 0 ? (
                  <p className="admin-help">No members assigned yet.</p>
                ) : (
                  <>
                    <div className="admin-table admin-table--projects desktop-only">
                      <div className="admin-table-row admin-table-head">
                        <span>Member</span>
                        <span>Phone</span>
                        <span>Role</span>
                        <span>Start Date</span>
                        <span>Actions</span>
                      </div>
                      {filteredProjectMembers.map((member) => {
                        const currentRole = member.role || "Member";
                        const selectedRole = projectMemberRoleEdits[member.id] || currentRole;
                        const isSaving = savingProjectMemberId === member.id;
                        const canSave = selectedRole !== currentRole;
                        return (
                          <div className="admin-table-row" key={member.id}>
                            <span>{member.members?.name || `Member #${member.member_id}`}</span>
                            <span>{member.members?.phone_number || "-"}</span>
                            <span className="admin-role-cell">
                              <select
                                value={selectedRole}
                                onChange={(e) =>
                                  handleProjectMemberRoleChange(member.id, e.target.value)
                                }
                              >
                                <option value="Member">Member</option>
                                <option value="Project Manager">Project Manager</option>
                                <option value="Treasurer">Treasurer</option>
                                <option value="Secretary">Secretary</option>
                                <option value="Chair">Chair</option>
                              </select>
                            </span>
                            <span>{formatShortDate(member.term_start)}</span>
                            <span className="admin-table-actions">
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => handleSaveProjectMemberRole(member)}
                                disabled={!canSave || isSaving}
                              >
                                {isSaving ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                className="link-button is-danger"
                                onClick={() => handleRemoveProjectMember(member)}
                                disabled={removingProjectMemberId === member.id}
                              >
                                {removingProjectMemberId === member.id ? "Removing..." : "Remove"}
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="admin-project-members-list mobile-only">
                      {filteredProjectMembers.map((member) => {
                        const currentRole = member.role || "Member";
                        const selectedRole = projectMemberRoleEdits[member.id] || currentRole;
                        const isSaving = savingProjectMemberId === member.id;
                        const canSave = selectedRole !== currentRole;
                        return (
                          <div className="admin-project-member-card" key={member.id}>
                            <div className="admin-project-member-header">
                              <div>
                                <strong>{member.members?.name || `Member #${member.member_id}`}</strong>
                                <span>{member.members?.phone_number || "-"}</span>
                              </div>
                              <span className="admin-project-member-date">
                                {formatShortDate(member.term_start)}
                              </span>
                            </div>
                            <div className="admin-project-member-row">
                              <label>Role</label>
                              <select
                                value={selectedRole}
                                onChange={(e) =>
                                  handleProjectMemberRoleChange(member.id, e.target.value)
                                }
                              >
                                <option value="Member">Member</option>
                                <option value="Project Manager">Project Manager</option>
                                <option value="Treasurer">Treasurer</option>
                                <option value="Secretary">Secretary</option>
                                <option value="Chair">Chair</option>
                              </select>
                            </div>
                            <div className="admin-project-member-actions">
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSaveProjectMemberRole(member)}
                                disabled={!canSave || isSaving}
                              >
                                {isSaving ? "Saving..." : "Save role"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary is-danger"
                                onClick={() => handleRemoveProjectMember(member)}
                                disabled={removingProjectMemberId === member.id}
                              >
                                {removingProjectMemberId === member.id ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="admin-help">Choose a project to manage its members.</p>
          )}
        </div>
      )}

      {activeSections.has("members-list") && (
        <div className="admin-card" id="admin-members-list">
          <div className="admin-card-header">
            <h3>Members</h3>
            <div className="admin-card-actions desktop-only">
              <button type="button" className="btn-primary small" onClick={handleNewMember}>
                <Icon name="plus" size={16} />
                New Member
              </button>
              <button
                type="button"
                className="link-button admin-card-dismiss"
                onClick={() => setActiveModule(null)}
              >
                Back to console
              </button>
            </div>
          </div>
          {loadingMembers ? (
            <p>Loading members...</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="admin-table desktop-only">
                <div className="admin-table-row admin-table-head">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Phone</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Total Welfare</span>
                  <span>Actions</span>
                </div>
                {filteredMembers.map((member) => (
                  <div className="admin-table-row" key={member.id}>
                    <span>{member.name}</span>
                    <span>{member.email || "-"}</span>
                    <span>{member.phone_number || "-"}</span>
                    <span>{member.role || "member"}</span>
                    <span>{member.status || "active"}</span>
                    <span>{typeof member.total_welfare === 'number' ? member.total_welfare.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }) : '-'}</span>
                    <span>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleEditMember(member)}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              {/* Mobile List View */}
              <div className="members-list-mobile mobile-only">
                {filteredMembers.map((member) => (
                  <div className="member-list-item" key={member.id}>
                    <div className="member-list-main" onClick={() => handleEditMember(member)}>
                      <div className="member-avatar">
                        {member.name ? member.name.charAt(0).toUpperCase() : <Icon name="user" size={18} />}
                      </div>
                      <div className="member-list-info">
                        <div className="member-list-name">{member.name}</div>
                        <div className="member-list-role">{member.role || "member"}</div>
                        <div className="member-list-phone">{member.phone_number || "-"}</div>
                        <div className="member-list-welfare">
                          <span className="welfare-label">Total Welfare:</span>
                          <span className="welfare-value">{typeof member.total_welfare === 'number' ? member.total_welfare.toLocaleString('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }) : '-'}</span>
                        </div>
                      </div>
                      <button className="member-list-edit" onClick={e => { e.stopPropagation(); handleEditMember(member); }}>
                        <Icon name="edit" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* Sticky action bar for mobile */}
          <div className="members-mobile-actionbar mobile-only">
            <button className="btn-primary" onClick={handleNewMember}>
              <Icon name="plus" size={18} /> Add Member
            </button>
            <button className="btn-secondary">
              <Icon name="filter" size={18} /> Filter
            </button>
          </div>
        </div>
      )}

      {activeSections.has("invites-list") && (
        <div className="admin-card" id="admin-invite-list">
          <div className="admin-card-header">
            <h3>Invite Codes</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          {loadingInvites ? (
            <p>Loading invites...</p>
          ) : (
            <>
              <div className="admin-table desktop-only">
                <div className="admin-table-row admin-table-head">
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span>Code</span>
                  <span>Expires</span>
                  <span>Actions</span>
                </div>
                {invites.map((invite) => (
                  <div className="admin-table-row" key={invite.id}>
                    <span>{invite.email}</span>
                    <span>{invite.role}</span>
                    <span>{invite.status}</span>
                    <span>{invite.code_prefix}</span>
                    <span>
                      {invite.expires_at
                        ? new Date(invite.expires_at).toLocaleDateString()
                        : "-"}
                    </span>
                    <span>
                      {invite.status === "pending" ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          Revoke
                        </button>
                      ) : (
                        "-"
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="admin-invite-list mobile-only">
                {invites.map((invite) => (
                  <div className="admin-invite-card" key={invite.id}>
                    <div className="admin-invite-header">
                      <div>
                        <strong>{invite.email}</strong>
                        <span className="admin-invite-role">{invite.role}</span>
                      </div>
                      <span
                        className={`admin-invite-chip status-${String(invite.status || "")
                          .toLowerCase()
                          .replace(/\\s+/g, "-")}`}
                      >
                        {invite.status}
                      </span>
                    </div>
                    <div className="admin-invite-meta">
                      <div>
                        <span>Code</span>
                        <strong>{invite.code_prefix}</strong>
                      </div>
                      <div>
                        <span>Expires</span>
                        <strong>
                          {invite.expires_at
                            ? new Date(invite.expires_at).toLocaleDateString()
                            : "-"}
                        </strong>
                      </div>
                    </div>
                    {invite.status === "pending" && (
                      <button
                        type="button"
                        className="btn-secondary is-danger"
                        onClick={() => handleRevokeInvite(invite.id)}
                      >
                        Revoke Invite
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {activeSections.has("finance-dashboard") && (
        <div className="admin-card" id="admin-finance">
          <div className="admin-card-header">
            <h3>Expenses & Sales</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          <p className="admin-help">Track spend, sales, and approvals across projects.</p>

          <div className="admin-finance-toolbar">
            <div className="admin-finance-tabs">
              <button
                type="button"
                className={`admin-finance-tab${financeTab === "expenses" ? " is-active" : ""}`}
                onClick={() => setFinanceTab("expenses")}
              >
                Expenses
              </button>
              <button
                type="button"
                className={`admin-finance-tab${financeTab === "sales" ? " is-active" : ""}`}
                onClick={() => setFinanceTab("sales")}
              >
                Sales
              </button>
            </div>
            <div className="admin-finance-filters">
              <div className="admin-form-field admin-finance-select">
                <label>Project</label>
                <select
                  value={financeProjectId}
                  onChange={(e) => {
                    setFinanceProjectId(e.target.value);
                    setExpenseForm((prev) => ({ ...prev, project_id: e.target.value || "" }));
                    setSaleForm((prev) => ({ ...prev, project_id: e.target.value || "" }));
                  }}
                >
                  <option value="">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} {project.code ? `(${project.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-finance-range">
                {[7, 30, 90].map((range) => (
                  <button
                    key={range}
                    type="button"
                    className={`admin-finance-range-btn${financeRangeDays === range ? " is-active" : ""}`}
                    onClick={() => setFinanceRangeDays(range)}
                  >
                    {range} days
                  </button>
                ))}
              </div>
              <div className="admin-search admin-finance-search">
                <Icon name="search" size={16} />
                <input
                  value={financeSearch}
                  onChange={(e) => setFinanceSearch(e.target.value)}
                  placeholder={`Search ${financeTab}`}
                />
              </div>
            </div>
          </div>

          <div className="admin-finance-summary">
            <div className="admin-finance-card">
              <span>Total Expenses</span>
              <strong>{formatCurrency(financeTotals.expenseTotal)}</strong>
            </div>
            <div className="admin-finance-card">
              <span>Total Sales</span>
              <strong>{formatCurrency(financeTotals.salesTotal)}</strong>
            </div>
            <div className="admin-finance-card">
              <span>Net</span>
              <strong>{formatCurrency(financeTotals.netTotal)}</strong>
            </div>
            <div className="admin-finance-card">
              <span>Pending Approvals</span>
              <strong>{financeTotals.pendingApprovals}</strong>
            </div>
          </div>

          {loadingFinance ? (
            <p>Loading finance data...</p>
          ) : (
            <>
              {financeTab === "expenses" ? (
                <div className="admin-finance-grid">
                  <div className="admin-finance-panel">
                    <h4>{selectedExpenseId ? "Edit Expense" : "Add Expense"}</h4>
                    <form className="admin-form" onSubmit={handleExpenseSubmit}>
                      <div className="admin-form-grid">
                        <div className="admin-form-field">
                          <label>Project *</label>
                          <select
                            name="project_id"
                            value={expenseForm.project_id}
                            onChange={handleExpenseChange}
                          >
                            <option value="">Select project</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name} {project.code ? `(${project.code})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-form-field">
                          <label>Date *</label>
                          <input
                            type="date"
                            name="expense_date"
                            value={expenseForm.expense_date}
                            onChange={handleExpenseChange}
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Category *</label>
                          <input
                            name="category"
                            value={expenseForm.category}
                            onChange={handleExpenseChange}
                            placeholder="Feed, Utilities"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Amount *</label>
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            value={expenseForm.amount}
                            onChange={handleExpenseChange}
                            placeholder="1000"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Vendor</label>
                          <input
                            name="vendor"
                            value={expenseForm.vendor}
                            onChange={handleExpenseChange}
                            placeholder="Supplier name"
                          />
                        </div>
                        <div className="admin-form-field admin-form-field--full">
                          <label>Description</label>
                          <input
                            name="description"
                            value={expenseForm.description}
                            onChange={handleExpenseChange}
                            placeholder="Optional description"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label className="admin-checkbox">
                            <input
                              type="checkbox"
                              name="receipt"
                              checked={expenseForm.receipt}
                              onChange={handleExpenseChange}
                            />
                            Receipt available
                          </label>
                        </div>
                        <div className="admin-form-field">
                          <label className="admin-checkbox">
                            <input
                              type="checkbox"
                              name="approved"
                              checked={expenseForm.approved}
                              onChange={handleExpenseChange}
                            />
                            Mark approved
                          </label>
                        </div>
                      </div>
                      <div className="admin-form-actions">
                        <button className="btn-primary" type="submit">
                          {selectedExpenseId ? "Save Expense" : "Add Expense"}
                        </button>
                        {selectedExpenseId && (
                          <button className="btn-secondary" type="button" onClick={handleExpenseCancel}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="admin-finance-panel">
                    <div className="admin-list-header">
                      <h4>Expense History</h4>
                      <span className="admin-projects-count">{filteredExpenses.length} items</span>
                    </div>
                    <div className="admin-table admin-table--finance desktop-only">
                      <div className="admin-table-row admin-table-head">
                        <span>Expense</span>
                        <span>Project</span>
                        <span>Amount</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      {filteredExpenses.map((expense) => (
                        <div className="admin-table-row" key={expense.id}>
                          <span>
                            {expense.category}
                            <span className="admin-table-subtext">
                              {expense.expense_date ? formatShortDate(expense.expense_date) : "-"}
                            </span>
                          </span>
                          <span>{projectMap.get(String(expense.project_id))?.name || "-"}</span>
                          <span>{formatCurrency(expense.amount)}</span>
                          <span>
                            <span
                              className={`admin-pill ${
                                expense.approved_by ? "is-active" : "is-completed"
                              }`}
                            >
                              {expense.approved_by ? "Approved" : "Pending"}
                            </span>
                          </span>
                          <span className="admin-table-actions">
                            {!expense.approved_by && (
                              <button
                                type="button"
                                className="link-button"
                                onClick={() => handleExpenseApprove(expense.id)}
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleExpenseEdit(expense)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button is-danger"
                              onClick={() => handleExpenseDelete(expense.id)}
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="admin-finance-cards mobile-only">
                      {filteredExpenses.map((expense) => (
                        <div className="admin-finance-item" key={expense.id}>
                          <div className="admin-finance-item-top">
                            <div>
                              <strong>{expense.category}</strong>
                              <span>{projectMap.get(String(expense.project_id))?.name || "-"}</span>
                            </div>
                            <div className="admin-finance-amount-block">
                              <span className="admin-finance-amount">
                                {formatCurrency(expense.amount)}
                              </span>
                              <span
                                className={`admin-finance-status ${
                                  expense.approved_by ? "is-approved" : "is-pending"
                                }`}
                              >
                                {expense.approved_by ? "Approved" : "Pending"}
                              </span>
                            </div>
                          </div>
                          <div className="admin-finance-item-meta">
                            <span className="admin-finance-date">
                              {expense.expense_date ? formatShortDate(expense.expense_date) : "-"}
                            </span>
                          </div>
                          <div className="admin-finance-actions admin-finance-actions--cards">
                            {!expense.approved_by ? (
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleExpenseApprove(expense.id)}
                              >
                                Approve
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-secondary is-danger"
                                onClick={() => handleExpenseDelete(expense.id)}
                              >
                                Delete
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleExpenseEdit(expense)}
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="admin-finance-grid">
                  <div className="admin-finance-panel">
                    <h4>{selectedSaleId ? "Edit Sale" : "Add Sale"}</h4>
                    <form className="admin-form" onSubmit={handleSaleSubmit}>
                      <div className="admin-form-grid">
                        <div className="admin-form-field">
                          <label>Project *</label>
                          <select
                            name="project_id"
                            value={saleForm.project_id}
                            onChange={handleSaleChange}
                          >
                            <option value="">Select project</option>
                            {projects.map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name} {project.code ? `(${project.code})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-form-field">
                          <label>Date *</label>
                          <input
                            type="date"
                            name="sale_date"
                            value={saleForm.sale_date}
                            onChange={handleSaleChange}
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Product</label>
                          <input
                            name="product_type"
                            value={saleForm.product_type}
                            onChange={handleSaleChange}
                            placeholder="Eggs, Peanut butter"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Units</label>
                          <input
                            name="quantity_units"
                            type="number"
                            value={saleForm.quantity_units}
                            onChange={handleSaleChange}
                            placeholder="0"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Unit price</label>
                          <input
                            name="unit_price"
                            type="number"
                            value={saleForm.unit_price}
                            onChange={handleSaleChange}
                            placeholder="0"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Total amount</label>
                          <input
                            name="total_amount"
                            type="number"
                            value={saleForm.total_amount}
                            onChange={handleSaleChange}
                            placeholder="Auto calc"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Customer</label>
                          <input
                            name="customer_name"
                            value={saleForm.customer_name}
                            onChange={handleSaleChange}
                            placeholder="Customer name"
                          />
                        </div>
                        <div className="admin-form-field">
                          <label>Customer type</label>
                          <select
                            name="customer_type"
                            value={saleForm.customer_type}
                            onChange={handleSaleChange}
                          >
                            <option value="retail">Retail</option>
                            <option value="wholesale">Wholesale</option>
                            <option value="member">Member</option>
                          </select>
                        </div>
                        <div className="admin-form-field">
                          <label>Payment status</label>
                          <select
                            name="payment_status"
                            value={saleForm.payment_status}
                            onChange={handleSaleChange}
                          >
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="partial">Partial</option>
                          </select>
                        </div>
                      </div>
                      <div className="admin-form-actions">
                        <button className="btn-primary" type="submit">
                          {selectedSaleId ? "Save Sale" : "Add Sale"}
                        </button>
                        {selectedSaleId && (
                          <button className="btn-secondary" type="button" onClick={handleSaleCancel}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="admin-finance-panel">
                    <div className="admin-list-header">
                      <h4>Sales History</h4>
                      <span className="admin-projects-count">{filteredSales.length} items</span>
                    </div>
                    <div className="admin-table admin-table--finance desktop-only">
                      <div className="admin-table-row admin-table-head">
                        <span>Sale</span>
                        <span>Project</span>
                        <span>Total</span>
                        <span>Status</span>
                        <span>Actions</span>
                      </div>
                      {filteredSales.map((sale) => (
                        <div className="admin-table-row" key={sale.id}>
                          <span>
                            {sale.product_type || "Sale"}
                            <span className="admin-table-subtext">
                              {sale.sale_date ? formatShortDate(sale.sale_date) : "-"}
                            </span>
                          </span>
                          <span>{projectMap.get(String(sale.project_id))?.name || "-"}</span>
                          <span>{formatCurrency(sale.total_amount)}</span>
                          <span>
                            <span className="admin-pill is-active">
                              {sale.payment_status || "paid"}
                            </span>
                          </span>
                          <span className="admin-table-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleSaleEdit(sale)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button is-danger"
                              onClick={() => handleSaleDelete(sale.id)}
                            >
                              Delete
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="admin-finance-cards mobile-only">
                      {filteredSales.map((sale) => (
                        <div className="admin-finance-item" key={sale.id}>
                          <div className="admin-finance-item-top">
                            <div>
                              <strong>{sale.product_type || "Sale"}</strong>
                              <span>{projectMap.get(String(sale.project_id))?.name || "-"}</span>
                            </div>
                            <div className="admin-finance-amount-block">
                              <span className="admin-finance-amount">
                                {formatCurrency(sale.total_amount)}
                              </span>
                              <span className="admin-finance-status is-approved">
                                {sale.payment_status || "paid"}
                              </span>
                            </div>
                          </div>
                          <div className="admin-finance-item-meta">
                            <span className="admin-finance-date">
                              {sale.sale_date ? formatShortDate(sale.sale_date) : "-"}
                            </span>
                          </div>
                          <div className="admin-finance-actions admin-finance-actions--cards">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleSaleEdit(sale)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn-secondary is-danger"
                              onClick={() => handleSaleDelete(sale.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeSections.has("welfare-list") && (
        <div className="admin-card" id="admin-welfare-list">
          <div className="admin-card-header">
            <h3>Welfare Transactions</h3>
            <button
              type="button"
              className="link-button admin-card-dismiss"
              onClick={() => setActiveModule(null)}
            >
              Back to console
            </button>
          </div>
          <div className="admin-list-header">
            <div className="admin-search">
              <Icon name="search" size={16} />
              <input
                value={welfareSearch}
                onChange={(e) => setWelfareSearch(e.target.value)}
                placeholder="Search welfare transactions"
              />
            </div>
            <div className="admin-card-actions">
              <button className="btn-secondary small" type="button" onClick={handleWelfareCancel}>
                Clear Form
              </button>
            </div>
          </div>
          {loadingWelfare ? (
            <p>Loading welfare transactions...</p>
          ) : filteredWelfareTransactions.length === 0 ? (
            <p className="admin-help">No welfare transactions found.</p>
          ) : (
            <div className="admin-table admin-table--welfare">
              <div className="admin-table-row admin-table-head">
                <span>Date</span>
                <span>Member</span>
                <span>Type</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filteredWelfareTransactions.map((transaction) => {
                const cycle = welfareCycleMap.get(transaction.cycle_id);
                const account = welfareAccountMap.get(transaction.welfare_account_id);
                return (
                  <div className="admin-table-row" key={transaction.id}>
                    <span>{formatWelfareDate(transaction.date)}</span>
                    <span>{transaction.member?.name || "Group Welfare"}</span>
                    <span>
                      {(transaction.transaction_type || "contribution").replace(/_/g, " ")}
                      {(transaction.description || cycle || account) && (
                        <span className="admin-table-subtext">
                          {transaction.description
                            ? transaction.description
                            : cycle
                            ? `Cycle ${cycle.cycle_number}`
                            : account?.name}
                        </span>
                      )}
                    </span>
                    <span>{formatWelfareAmount(transaction.amount)}</span>
                    <span>{transaction.status || "Completed"}</span>
                    <span className="admin-table-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleEditWelfare(transaction)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button is-danger"
                        onClick={() => handleDeleteWelfare(transaction.id)}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <div className="admin-mobile-nav">
        <button
          type="button"
          className={`admin-mobile-nav-btn ${!activeModule ? 'active' : ''}`}
          onClick={() => setActiveModule(null)}
        >
          <Icon name="home" size={20} />
          <span>Home</span>
        </button>
        {mobileNavModules.map((module) => (
          <button
            key={module.key}
            type="button"
            className={`admin-mobile-nav-btn ${activeModule === module.key ? 'active' : ''}`}
            onClick={() => handleModuleClick(module)}
          >
            <Icon name={module.icon} size={20} />
            <span>{module.title.split(' ')[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
