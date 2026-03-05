import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../icons.jsx";
import { signOut, createMagicLinkInvite, getProjects } from "../../lib/dataService.js";
import * as UserDropdownModule from "./UserDropdown.jsx";
import NotificationBell from "./NotificationBell.jsx";
import DataModal from "./DataModal.jsx";
import ResponseModal from "./ResponseModal.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import { usePwaInstall } from "../../hooks/usePwaInstall.js";
const UserDropdown = UserDropdownModule.UserDropdown || UserDropdownModule.default;
const baseMenuItems = [
  {
    key: "overview",
    label: "Overview",
    icon: "home",
    group: "primary",
    accent: "#3b82f6",
    accentBg: "#e6efff"
  },
  {
    key: "projects",
    label: "Projects",
    icon: "folder",
    group: "primary",
    accent: "#2563eb",
    accentBg: "#e6efff",
  },
  {
    key: "settings",
    label: "Settings",
    icon: "settings",
    group: "primary",
    accent: "#0f766e",
    accentBg: "#e6fffb",
  },
  {
    key: "meetings",
    label: "Activities",
    icon: "flag",
    group: "primary",
    accent: "#8b5cf6",
    accentBg: "#efe7ff"
  },
  {
    key: "contributions",
    label: "Contributions",
    icon: "wallet",
    group: "finance",
    accent: "#10b981",
    accentBg: "#e7f8f1"
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: "receipt",
    group: "finance",
    accent: "#f59e0b",
    accentBg: "#fff4df"
  },
  {
    key: "welfare",
    label: "Welfare Fund",
    icon: "heart",
    group: "finance",
    accent: "#f97316",
    accentBg: "#fff0e5"
  },
  {
    key: "documents",
    label: "Transactions",
    icon: "coins",
    group: "finance",
    accent: "#0ea5e9",
    accentBg: "#e0f2fe"
  },
  {
    key: "members",
    label: "People",
    icon: "users",
    group: "people",
    accent: "#6366f1",
    accentBg: "#ecebff"
  },
  {
    key: "admin",
    label: "Roles & Permissions",
    icon: "shield",
    group: "people",
    accent: "#1d4ed8",
    accentBg: "#e0ecff"
  },
  {
    key: "reports",
    label: "Reports",
    icon: "trending-up",
    group: "reporting",
    accent: "#06b6d4",
    accentBg: "#e0f7fa"
  },
  {
    key: "news",
    label: "Updates",
    icon: "check-circle",
    group: "reporting",
    accent: "#14b8a6",
    accentBg: "#e6fffb"
  },
  {
    key: "payouts",
    label: "Payout Schedule",
    icon: "calendar",
    group: "management",
    accent: "#22c55e",
    accentBg: "#e7f8f1"
  },
];

const createInviteForm = () => ({
  name: "",
  email: "",
  phone_number: "",
  role: "member",
  notes: "",
  project_access_scope: "selected",
  project_ids: [],
});

const normalizeInviteProjectScope = (scope) => {
  const normalized = String(scope || "").trim().toLowerCase();
  if (normalized === "all" || normalized === "selected" || normalized === "none") {
    return normalized;
  }
  return "none";
};

const normalizeInviteProjectIds = (projectIds) => {
  if (!Array.isArray(projectIds)) {
    return [];
  }
  return Array.from(
    new Set(
      projectIds
        .map((projectId) => Number.parseInt(String(projectId || ""), 10))
        .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
    )
  );
};

const isInviteAdminRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "superadmin";
};

const DASHBOARD_THEME_STORAGE_KEY = "dashboard-theme-mode";
const DASHBOARD_QUIET_MODE_STORAGE_KEY = "dashboard-quiet-mode-until";

const getInitialDashboardThemeMode = () => {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialQuietModeUntil = () => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(DASHBOARD_QUIET_MODE_STORAGE_KEY);
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= Date.now()) {
    window.localStorage.removeItem(DASHBOARD_QUIET_MODE_STORAGE_KEY);
    return null;
  }
  return parsed;
};

function DashboardLayout({
  activePage,
  setActivePage,
  children,
  user,
  access,
  tenant,
  tenantRole,
  tenantTheme,
  onRequestSettingsTab,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load from localStorage on initial render
    const saved = localStorage.getItem("dashboard-sidebar-collapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [dashboardThemeMode, setDashboardThemeMode] = useState(getInitialDashboardThemeMode);
  const [quietModeUntil, setQuietModeUntil] = useState(getInitialQuietModeUntil);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [inviteForm, setInviteForm] = useState(() => createInviteForm());
  const [inviteProjects, setInviteProjects] = useState([]);
  const [loadingInviteProjects, setLoadingInviteProjects] = useState(false);
  const [responseData, setResponseData] = useState({
    type: "success",
    title: "",
    message: "",
    code: null,
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false
  );
  const [showMobileSearchDrawer, setShowMobileSearchDrawer] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [mobileSearchDrawerOffsetY, setMobileSearchDrawerOffsetY] = useState(0);
  const [showMobileMoreDrawer, setShowMobileMoreDrawer] = useState(false);
  const [mobileMoreDrawerOffsetY, setMobileMoreDrawerOffsetY] = useState(0);
  const [showInstallInstructionsDrawer, setShowInstallInstructionsDrawer] = useState(false);
  const [installInstructionsDrawerOffsetY, setInstallInstructionsDrawerOffsetY] = useState(0);
  const [installToastMessage, setInstallToastMessage] = useState("");
  const mobileSearchInputRef = useRef(null);
  const mobileSearchTouchStartRef = useRef(null);
  const mobileMoreTouchStartRef = useRef(null);
  const installDrawerTouchStartRef = useRef(null);
  const wasInstalledRef = useRef(false);
  const navigate = useNavigate();
  const {
    canInstall,
    canPromptInstall,
    dismissInstallBannerForDays,
    hideInstallBanner,
    isAndroid,
    isInstalled,
    isIosSafari,
    requestInstall,
    shouldShowInstallBanner,
  } = usePwaInstall();

  // Persist sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("dashboard-sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const applyMediaState = () => {
      setIsMobileViewport(mediaQuery.matches);
    };
    applyMediaState();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyMediaState);
      return () => mediaQuery.removeEventListener("change", applyMediaState);
    }
    mediaQuery.addListener(applyMediaState);
    return () => mediaQuery.removeListener(applyMediaState);
  }, []);

  useEffect(() => {
    if (isMobileViewport && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobileViewport, sidebarOpen]);

  useEffect(() => {
    if (isMobileViewport) return;
    if (!showMobileSearchDrawer) return;
    setShowMobileSearchDrawer(false);
    setMobileSearchQuery("");
    setMobileSearchDrawerOffsetY(0);
  }, [isMobileViewport, showMobileSearchDrawer]);

  useEffect(() => {
    if (isMobileViewport) return;
    if (!showMobileMoreDrawer) return;
    setShowMobileMoreDrawer(false);
    setMobileMoreDrawerOffsetY(0);
  }, [isMobileViewport, showMobileMoreDrawer]);

  useEffect(() => {
    if (!showMobileSearchDrawer && !showMobileMoreDrawer && !showInstallInstructionsDrawer) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (showMobileSearchDrawer) {
      window.requestAnimationFrame(() => {
        mobileSearchInputRef.current?.focus();
      });
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showInstallInstructionsDrawer, showMobileSearchDrawer, showMobileMoreDrawer]);

  useEffect(() => {
    if (!showMobileMoreDrawer) return;
    setShowMobileMoreDrawer(false);
    setMobileMoreDrawerOffsetY(0);
    mobileMoreTouchStartRef.current = null;
  }, [activePage, showMobileMoreDrawer]);

  useEffect(() => {
    if (!showInstallInstructionsDrawer) return;
    setShowInstallInstructionsDrawer(false);
    setInstallInstructionsDrawerOffsetY(0);
    installDrawerTouchStartRef.current = null;
  }, [activePage, showInstallInstructionsDrawer]);

  useEffect(() => {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, dashboardThemeMode);
  }, [dashboardThemeMode]);

  useEffect(() => {
    if (!quietModeUntil || quietModeUntil <= Date.now()) {
      window.localStorage.removeItem(DASHBOARD_QUIET_MODE_STORAGE_KEY);
      return undefined;
    }
    window.localStorage.setItem(DASHBOARD_QUIET_MODE_STORAGE_KEY, String(quietModeUntil));
    const timer = window.setTimeout(() => {
      setQuietModeUntil(null);
    }, quietModeUntil - Date.now());
    return () => window.clearTimeout(timer);
  }, [quietModeUntil]);

  useEffect(() => {
    if (!installToastMessage) return undefined;
    const timer = window.setTimeout(() => {
      setInstallToastMessage("");
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [installToastMessage]);

  useEffect(() => {
    if (!wasInstalledRef.current && isInstalled) {
      setInstallToastMessage("Habuks installed successfully");
      setShowInstallInstructionsDrawer(false);
      setInstallInstructionsDrawerOffsetY(0);
      installDrawerTouchStartRef.current = null;
    }
    wasInstalledRef.current = isInstalled;
  }, [isInstalled]);

  const brandName = tenant?.name || "Habuks";
  const brandTagline = tenant?.tagline || "";
  const logoUrl = tenant?.logoUrl || "/assets/logo.png";
  const homeHref = tenant?.slug ? `/tenant/${tenant.slug}` : "/";
  const activeTenantId = tenant?.id || user?.tenant_id || null;
  const allowedPages = access?.allowedPages || new Set();
  const menuItems = baseMenuItems
    .map((item) => {
      if (item.subItems?.length) {
        const filteredSub = item.subItems.filter((sub) => allowedPages.has(sub.key));
        if (!allowedPages.has(item.key) && filteredSub.length === 0) {
          return null;
        }
        return { ...item, subItems: filteredSub };
      }
      return allowedPages.has(item.key) ? item : null;
    })
    .filter(Boolean);

  const groupLabels = {
    finance: "Records",
    people: "People",
    reporting: "Reporting",
    management: "Management",
  };

  const groupOrder = ["primary", "finance", "people", "reporting", "management"];
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    const group = item.group || "primary";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const flatMenuItems = menuItems.flatMap((item) =>
    item.subItems ? [item, ...item.subItems] : [item]
  );
  const financePages = new Set(["contributions", "expenses", "welfare", "documents"]);
  const pageTitle =
    (financePages.has(activePage)
      ? "Records"
      : activePage === "notifications"
        ? "Notifications"
      : flatMenuItems.find((m) => m.key === activePage)?.label) ||
    (activePage === "settings" ? "Settings" : "Dashboard");

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      // Force redirect even on error
      navigate("/login");
    }
  };

  // Invite handlers
  const handleInviteFormChange = (field, value) => {
    setInviteForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "role") {
        if (isInviteAdminRole(value)) {
          next.project_access_scope = "all";
          next.project_ids = [];
        } else {
          const currentScope = normalizeInviteProjectScope(prev.project_access_scope);
          next.project_access_scope = currentScope === "all" ? "selected" : currentScope;
        }
      }
      if (field === "project_access_scope") {
        const normalizedScope = normalizeInviteProjectScope(value);
        next.project_access_scope = normalizedScope;
        if (normalizedScope !== "selected") {
          next.project_ids = [];
        }
      }
      return next;
    });
  };

  const handleInviteProjectToggle = (projectId) => {
    const parsedProjectId = Number.parseInt(String(projectId || ""), 10);
    if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
      return;
    }
    setInviteForm((prev) => {
      const current = normalizeInviteProjectIds(prev.project_ids);
      const hasProject = current.includes(parsedProjectId);
      return {
        ...prev,
        project_ids: hasProject
          ? current.filter((id) => id !== parsedProjectId)
          : [...current, parsedProjectId],
      };
    });
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

      // Get tenant ID from the current page context
      // For now, we'll need to pass it from the parent or get it from user context
      if (!activeTenantId) {
        throw new Error("Tenant ID is not available");
      }

      const role = String(inviteForm.role || "member").trim().toLowerCase();
      const adminInvite = isInviteAdminRole(role);
      const projectAccessScope = adminInvite
        ? "all"
        : normalizeInviteProjectScope(inviteForm.project_access_scope || "selected");
      const selectedProjectIds =
        projectAccessScope === "selected"
          ? normalizeInviteProjectIds(inviteForm.project_ids)
          : [];
      if (!adminInvite && projectAccessScope === "selected" && inviteProjects.length > 0 && selectedProjectIds.length === 0) {
        throw new Error("Select at least one project or choose a different project access scope.");
      }

      const payload = {
        email: inviteForm.email,
        phone_number: inviteForm.phone_number || null,
        role: role || "member",
        notes: inviteForm.notes || null,
        tenant_id: activeTenantId,
        project_access_scope: projectAccessScope,
        project_ids: selectedProjectIds,
      };

      const result = await createMagicLinkInvite(payload);

      // Show success response with invite number
      setResponseData({
        type: "success",
        title: "Invite Created!",
        message: `Share this invite number with ${inviteForm.email}. They can join at /register (or /join).`,
        code: result?.inviteNumber,
      });
      setShowResponseModal(true);

      // Reset form
      setInviteForm(createInviteForm());
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
    setInviteForm(createInviteForm());
  };

  const closeResponseModal = () => {
    setShowResponseModal(false);
  };

  useEffect(() => {
    if (!showInviteModal || !activeTenantId) {
      return;
    }

    let cancelled = false;
    setLoadingInviteProjects(true);
    getProjects(activeTenantId)
      .then((data) => {
        if (cancelled) return;
        setInviteProjects(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Error loading invite projects:", error);
        if (cancelled) return;
        setInviteProjects([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingInviteProjects(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showInviteModal, activeTenantId]);

  const inviteProjectIds = normalizeInviteProjectIds(inviteForm.project_ids);
  const inviteRoleIsAdmin = isInviteAdminRole(inviteForm.role);
  const inviteProjectScope = inviteRoleIsAdmin
    ? "all"
    : normalizeInviteProjectScope(inviteForm.project_access_scope);

  const toggleSection = (key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSidebarMouseEnter = () => {
    setSidebarHovered(true);
    // Only expand on hover if currently collapsed
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const handleSidebarMouseLeave = () => {
    setSidebarHovered(false);
    // Don't auto-collapse on leave - user must manually collapse
  };

  const handleHeaderDoubleClick = (e) => {
    // Only toggle if clicking on empty space (not on interactive elements)
    if (e.target === e.currentTarget) {
      setIsCollapsed((prev) => !prev);
    }
  };

  const sidebarWidth = isCollapsed ? "96px" : "280px";
  const isDarkMode = dashboardThemeMode === "dark";
  const openSettingsTab = (tabKey) => {
    onRequestSettingsTab?.(tabKey);
    setActivePage("settings");
  };
  const normalizedTenantRole = String(tenantRole || user?.role || "member").trim().toLowerCase();
  const canManageWorkspace =
    normalizedTenantRole === "admin" ||
    normalizedTenantRole === "superadmin" ||
    normalizedTenantRole === "project_manager" ||
    normalizedTenantRole === "supervisor";
  const showInstallEntry = canInstall;
  const installActionDescription = canPromptInstall
    ? "Install for faster access and offline use."
    : "Show how to add Habuks to your home screen.";
  const closeInstallInstructionsDrawer = () => {
    setShowInstallInstructionsDrawer(false);
    setInstallInstructionsDrawerOffsetY(0);
    installDrawerTouchStartRef.current = null;
  };
  const handleInstallAction = async () => {
    if (!showInstallEntry) return;
    hideInstallBanner();
    const result = await requestInstall();
    if (result?.status === "accepted") {
      setInstallToastMessage("Install request sent. Confirm in your browser.");
      return;
    }
    if (result?.status === "dismissed") {
      setInstallToastMessage("Install dismissed. You can retry anytime.");
      return;
    }
    if (result?.status === "manual") {
      setShowInstallInstructionsDrawer(true);
      return;
    }
  };
  const handleInstallBannerNotNow = () => {
    dismissInstallBannerForDays(7);
    setInstallToastMessage("Install reminder hidden for 7 days.");
  };
  const handleInstallDrawerTouchStart = (event) => {
    if (!event.touches?.length) return;
    installDrawerTouchStartRef.current = event.touches[0].clientY;
  };
  const handleInstallDrawerTouchMove = (event) => {
    if (!event.touches?.length || installDrawerTouchStartRef.current === null) return;
    const deltaY = event.touches[0].clientY - installDrawerTouchStartRef.current;
    if (deltaY <= 0) {
      setInstallInstructionsDrawerOffsetY(0);
      return;
    }
    setInstallInstructionsDrawerOffsetY(Math.min(deltaY, 180));
  };
  const handleInstallDrawerTouchEnd = () => {
    const shouldClose = installInstructionsDrawerOffsetY > 84;
    installDrawerTouchStartRef.current = null;
    setInstallInstructionsDrawerOffsetY(0);
    if (shouldClose) {
      closeInstallInstructionsDrawer();
    }
  };
  const openMobileSearchDrawer = () => {
    if (!isMobileViewport) return;
    setShowMobileMoreDrawer(false);
    setMobileMoreDrawerOffsetY(0);
    mobileMoreTouchStartRef.current = null;
    closeInstallInstructionsDrawer();
    setShowMobileSearchDrawer(true);
  };
  const closeMobileSearchDrawer = () => {
    setShowMobileSearchDrawer(false);
    setMobileSearchDrawerOffsetY(0);
    mobileSearchTouchStartRef.current = null;
  };
  const handleMobileSearchTouchStart = (event) => {
    if (!event.touches?.length) return;
    mobileSearchTouchStartRef.current = event.touches[0].clientY;
  };
  const handleMobileSearchTouchMove = (event) => {
    if (!event.touches?.length || mobileSearchTouchStartRef.current === null) return;
    const deltaY = event.touches[0].clientY - mobileSearchTouchStartRef.current;
    if (deltaY <= 0) {
      setMobileSearchDrawerOffsetY(0);
      return;
    }
    setMobileSearchDrawerOffsetY(Math.min(deltaY, 180));
  };
  const handleMobileSearchTouchEnd = () => {
    const shouldClose = mobileSearchDrawerOffsetY > 84;
    mobileSearchTouchStartRef.current = null;
    setMobileSearchDrawerOffsetY(0);
    if (shouldClose) {
      closeMobileSearchDrawer();
    }
  };
  const openMobileMoreDrawer = () => {
    if (!isMobileViewport) return;
    setShowMobileSearchDrawer(false);
    setMobileSearchDrawerOffsetY(0);
    mobileSearchTouchStartRef.current = null;
    closeInstallInstructionsDrawer();
    setShowMobileMoreDrawer(true);
  };
  const closeMobileMoreDrawer = () => {
    setShowMobileMoreDrawer(false);
    setMobileMoreDrawerOffsetY(0);
    mobileMoreTouchStartRef.current = null;
  };
  const handleMobileMoreTouchStart = (event) => {
    if (!event.touches?.length) return;
    mobileMoreTouchStartRef.current = event.touches[0].clientY;
  };
  const handleMobileMoreTouchMove = (event) => {
    if (!event.touches?.length || mobileMoreTouchStartRef.current === null) return;
    const deltaY = event.touches[0].clientY - mobileMoreTouchStartRef.current;
    if (deltaY <= 0) {
      setMobileMoreDrawerOffsetY(0);
      return;
    }
    setMobileMoreDrawerOffsetY(Math.min(deltaY, 180));
  };
  const handleMobileMoreTouchEnd = () => {
    const shouldClose = mobileMoreDrawerOffsetY > 84;
    mobileMoreTouchStartRef.current = null;
    setMobileMoreDrawerOffsetY(0);
    if (shouldClose) {
      closeMobileMoreDrawer();
    }
  };
  const normalizedMobileSearchQuery = String(mobileSearchQuery || "").trim().toLowerCase();
  const mobileSearchSections = [
    {
      key: "projects",
      title: "Projects",
      items: allowedPages.has("projects")
        ? [
            {
              id: "search-projects",
              label: "All projects",
              description: "Open project workspace",
              tokens: "projects project workspace",
              onClick: () => setActivePage("projects"),
            },
          ]
        : [],
    },
    {
      key: "tasks",
      title: "Tasks",
      items: allowedPages.has("projects")
        ? [
            {
              id: "search-project-tasks",
              label: "Project tasks",
              description: "Open tasks inside projects",
              tokens: "tasks task tracker",
              onClick: () => setActivePage("projects"),
            },
          ]
        : [],
    },
    {
      key: "members",
      title: "Members",
      items: allowedPages.has("members")
        ? [
            {
              id: "search-members",
              label: "Member directory",
              description: "Open people workspace",
              tokens: "members member people directory",
              onClick: () => setActivePage("members"),
            },
          ]
        : [],
    },
    {
      key: "documents",
      title: "Documents",
      items: [
        allowedPages.has("documents")
          ? {
              id: "search-finance-records",
              label: "Transaction records",
              description: "Open record transactions",
              tokens: "documents document records transactions",
              onClick: () => setActivePage("documents"),
            }
          : null,
        canManageWorkspace
          ? {
              id: "search-org-records",
              label: "Organization records",
              description: "Open organization settings records",
              tokens: "documents document records organization settings",
              onClick: () => openSettingsTab("organization-settings"),
            }
          : null,
      ].filter(Boolean),
    },
  ];
  const filteredMobileSearchSections = mobileSearchSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (!normalizedMobileSearchQuery) return true;
      const haystack = `${item.label} ${item.description} ${item.tokens}`.toLowerCase();
      return haystack.includes(normalizedMobileSearchQuery);
    }),
  }));
  const mobileSearchHasResults = filteredMobileSearchSections.some((section) => section.items.length > 0);
  const handleMobileSearchResultSelect = (item) => {
    item?.onClick?.();
    closeMobileSearchDrawer();
    setMobileSearchQuery("");
  };
  const canOpenAdminConsole = allowedPages.has("admin");
  const canInviteMembers = canManageWorkspace;
  const mobileMoreActions = [
    canManageWorkspace
      ? {
          key: "more-org-settings",
          label: "Organization settings",
          description: "Members, templates, and records workspace",
          icon: "layers",
          onClick: () => openSettingsTab("organization-settings"),
        }
      : null,
    canManageWorkspace
      ? {
          key: "more-templates",
          label: "Templates",
          description: "Manage shared organization templates",
          icon: "notes",
          onClick: () => openSettingsTab("organization-settings"),
        }
      : null,
    canManageWorkspace
      ? {
          key: "more-records",
          label: "Records",
          description: "Open organization records and activities",
          icon: "folder",
          onClick: () => openSettingsTab("organization-settings"),
        }
      : null,
    canManageWorkspace
      ? {
          key: "more-partners",
          label: "Partners",
          description: "Manage partner and donor relationships",
          icon: "users",
          onClick: () => openSettingsTab("organization-settings"),
        }
      : null,
    allowedPages.has("settings")
      ? {
          key: "more-app-settings",
          label: "App settings",
          description: "Personal profile and account preferences",
          icon: "settings",
          onClick: () => openSettingsTab("my-settings"),
        }
      : null,
    showInstallEntry
      ? {
          key: "more-install",
          label: "Install app",
          description: installActionDescription,
          icon: "download",
          onClick: handleInstallAction,
        }
      : null,
    {
      key: "more-help",
      label: "Help",
      description: "Open guides and support resources",
      icon: "newspaper",
      onClick: () => navigate("/resources"),
    },
  ].filter(Boolean);
  const handleMobileMoreActionSelect = (action) => {
    action?.onClick?.();
    closeMobileMoreDrawer();
  };
  const workspaceAppItems = [
    allowedPages.has("projects")
      ? {
          key: "projects",
          label: "Projects",
          icon: "folder",
          tone: "blue",
          onClick: () => setActivePage("projects"),
        }
      : null,
    allowedPages.has("meetings")
      ? {
          key: "activities",
          label: "Activities",
          icon: "flag",
          tone: "violet",
          onClick: () => setActivePage("meetings"),
        }
      : null,
    allowedPages.has("members")
      ? {
          key: "people",
          label: "People",
          icon: "users",
          tone: "indigo",
          onClick: () => setActivePage("members"),
        }
      : null,
    allowedPages.has("reports")
      ? {
          key: "reports",
          label: "Reports",
          icon: "trending-up",
          tone: "teal",
          onClick: () => setActivePage("reports"),
        }
      : null,
    allowedPages.has("expenses") || allowedPages.has("documents") || allowedPages.has("contributions")
      ? {
          key: "finance",
          label: "Records",
          icon: "wallet",
          tone: "emerald",
          onClick: () => {
            if (allowedPages.has("expenses")) {
              setActivePage("expenses");
              return;
            }
            if (allowedPages.has("contributions")) {
              setActivePage("contributions");
              return;
            }
            setActivePage("documents");
          },
        }
      : null,
    allowedPages.has("notifications")
      ? {
          key: "inbox",
          label: "Inbox",
          icon: "bell",
          tone: "amber",
          onClick: () => setActivePage("notifications"),
        }
      : null,
    allowedPages.has("news")
      ? {
          key: "updates",
          label: "Updates",
          icon: "check-circle",
          tone: "mint",
          onClick: () => setActivePage("news"),
        }
      : null,
    canOpenAdminConsole
      ? {
          key: "roles",
          label: "Access",
          icon: "shield",
          tone: "sky",
          onClick: () => setActivePage("admin"),
        }
      : null,
  ]
    .filter(Boolean)
    .slice(0, 6);
  const installInstructions = isIosSafari
    ? [
        "Tap the Share icon in Safari.",
        'Scroll and choose "Add to Home Screen".',
        "Tap Add to install Habuks.",
      ]
    : isAndroid
      ? [
          "Open your browser menu.",
          'Tap "Install app" or "Add to Home screen".',
          "Confirm the install action.",
        ]
      : [
          "Open your browser menu.",
          'Look for "Install app" or "Add to Home Screen".',
          "Confirm to save Habuks to your device.",
        ];
  const installInstructionsHint = isIosSafari
    ? "Safari does not show the automatic install prompt, so use these manual steps."
    : "If you do not see install options, try Chrome or Edge for full PWA support.";

  return (
    <div
      className={`dashboard-layout${isDarkMode ? " is-dark" : ""}${isMobileViewport ? " is-mobile-nav-only" : ""}`}
      style={{ ...tenantTheme, "--dashboard-sidebar-width": sidebarWidth }}
    >
      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar${sidebarOpen ? " open" : ""}${
          isCollapsed ? " is-collapsed" : ""
        }`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <div className="dashboard-sidebar-card">
          <div className="dashboard-sidebar-header" onDoubleClick={handleHeaderDoubleClick}>
            <a href={homeHref} className="dashboard-logo">
              <span className="dashboard-logo-mark">
                <img src={logoUrl} alt={`${brandName} logo`} />
              </span>
            </a>
            <div className="dashboard-sidebar-actions">
              <button
                className="dashboard-collapse-toggle"
                onClick={() => setIsCollapsed((prev) => !prev)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Icon name="menu" size={20} />
              </button>
              <button
                className="dashboard-sidebar-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                ×
              </button>
            </div>
          </div>
          <nav className="dashboard-nav">
            {groupOrder.map((groupKey) => {
              const groupItems = groupedMenuItems[groupKey] || [];
              if (!groupItems.length) return null;
              return (
                <div className="dashboard-nav-group" key={groupKey}>
                  {groupLabels[groupKey] ? (
                    <div className="dashboard-nav-group-title">
                      <span>{groupLabels[groupKey]}</span>
                    </div>
                  ) : null}
                  <ul className="dashboard-nav-list">
                    {groupItems.map((item) => {
                      const hasSubItems = Boolean(item.subItems?.length);
                      const isActive =
                        activePage === item.key ||
                        item.subItems?.some((sub) => sub.key === activePage);
                      const isExpanded =
                        hasSubItems && !isCollapsed && (openSections.has(item.key) || isActive);
                      const accentStyle = item.accent
                        ? {
                            "--item-accent": item.accent,
                            "--item-accent-soft": item.accentBg,
                            "--icon-color": item.accent,
                            "--icon-bg": item.accentBg,
                          }
                        : undefined;

                      return (
                        <li key={item.key}>
                          <button
                            className={`dashboard-nav-item${isActive ? " active" : ""}${
                              hasSubItems ? " has-children" : ""
                            }`}
                            onClick={() => {
                              if (isCollapsed && hasSubItems) {
                                setIsCollapsed(false);
                              }
                              if (hasSubItems) {
                                toggleSection(item.key);
                                if (allowedPages.has(item.key)) {
                                  setActivePage(item.key);
                                }
                              } else {
                                setActivePage(item.key);
                              }
                              setSidebarOpen(false);
                            }}
                            title={isCollapsed ? item.label : undefined}
                            style={accentStyle}
                          >
                            <span className="dashboard-nav-item-main">
                              <span className="dashboard-nav-icon">
                                <Icon name={item.icon} size={18} />
                              </span>
                              <span className="dashboard-nav-label">{item.label}</span>
                            </span>
                            {hasSubItems && (
                              <span
                                className={`dashboard-nav-caret${isExpanded ? " is-open" : ""}`}
                                aria-hidden="true"
                              >
                                <Icon name="chevron" size={16} />
                              </span>
                            )}
                          </button>
                          {hasSubItems && isExpanded && (
                            <ul className="dashboard-nav-sublist">
                              {item.subItems.map((subItem) => (
                                <li key={subItem.key}>
                                  <button
                                    className={`dashboard-nav-subitem${
                                      activePage === subItem.key ? " active" : ""
                                    }`}
                                    onClick={() => {
                                      setActivePage(subItem.key);
                                      setSidebarOpen(false);
                                    }}
                                    title={isCollapsed ? subItem.label : undefined}
                                  >
                                    <Icon name={subItem.icon} size={14} />
                                    <span>{subItem.label}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
          <div className="dashboard-sidebar-footer">
            <button
              className="dashboard-switch-tenant"
              onClick={() => navigate("/select-tenant")}
              title={isCollapsed ? "Switch workspace" : undefined}
            >
              <Icon name="layers" size={20} />
              <span>Switch workspace</span>
            </button>
            <button
              className="dashboard-logout"
              onClick={handleLogout}
              title={isCollapsed ? "Logout" : undefined}
            >
              <Icon name="logout" size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`dashboard-main${isCollapsed ? " is-collapsed" : ""}`}>
        <header className={`dashboard-header${isMobileViewport ? " is-mobile" : ""}`}>
          {isMobileViewport ? (
            <>
              <div className="dashboard-mobile-header-row">
                <UserDropdown
                  user={user}
                  tenant={tenant}
                  tenantRole={normalizedTenantRole}
                  canInviteMembers={canInviteMembers}
                  canManageWorkspace={canManageWorkspace}
                  canOpenAdminConsole={canOpenAdminConsole}
                  themeMode={dashboardThemeMode}
                  onThemeModeChange={setDashboardThemeMode}
                  quietModeUntil={quietModeUntil}
                  onQuietModeUntilChange={setQuietModeUntil}
                  onOpenInviteModal={() => setShowInviteModal(true)}
                  onOpenProfileSettings={() => openSettingsTab("my-settings")}
                  onOpenWorkspaceSettings={() => openSettingsTab("organization-settings")}
                  onOpenAdminConsole={() => setActivePage("admin")}
                  onOpenNotifications={() => setActivePage("notifications")}
                  onSwitchWorkspace={() => navigate("/select-tenant")}
                  onOpenHelp={() => navigate("/resources")}
                  canInstallApp={showInstallEntry}
                  onInstallApp={handleInstallAction}
                  installActionDescription={installActionDescription}
                  workspaceAppItems={workspaceAppItems}
                  isMobile={true}
                />
                <button
                  type="button"
                  className="dashboard-mobile-search-trigger"
                  onClick={openMobileSearchDrawer}
                  aria-label="Open global search"
                >
                  <Icon name="search" size={18} />
                  <span>Search projects, members, documents</span>
                </button>
                <NotificationBell
                  tenantId={activeTenantId}
                  user={user}
                  setActivePage={setActivePage}
                  quietModeUntil={quietModeUntil}
                  isMobile={true}
                />
              </div>
              <div className="dashboard-mobile-title-row">{pageTitle}</div>
            </>
          ) : (
            <>
              <div className="dashboard-header-left">
                <button
                  className="dashboard-menu-toggle"
                  onClick={() => {
                    if (isMobileViewport) return;
                    setSidebarOpen(!sidebarOpen);
                  }}
                  aria-label="Toggle menu"
                  aria-hidden={isMobileViewport}
                >
                  <Icon name="menu" size={22} />
                </button>
                <div className="dashboard-header-title-block">
                  <span className="dashboard-header-kicker">{tenant?.name || "Workspace"}</span>
                  <h1>{pageTitle}</h1>
                </div>
              </div>
              <div className="dashboard-header-search">
                <Icon name="search" size={18} />
                <input type="search" placeholder="Search for something" aria-label="Search dashboard" />
              </div>
              <div className="dashboard-header-actions">
                <div className="dashboard-header-action-dock">
                  <button
                    className={`dashboard-icon-btn dashboard-theme-toggle${isDarkMode ? " is-dark" : ""}`}
                    type="button"
                    aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    aria-pressed={isDarkMode}
                    title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    onClick={() =>
                      setDashboardThemeMode((prev) => (prev === "dark" ? "light" : "dark"))
                    }
                  >
                    <Icon name={isDarkMode ? "sun" : "moon"} size={18} />
                  </button>
                  <button
                    className={`dashboard-icon-btn${activePage === "settings" ? " active" : ""}`}
                    type="button"
                    aria-label="Settings"
                    onClick={() => openSettingsTab("my-settings")}
                  >
                    <Icon name="settings" size={18} />
                  </button>
                  <NotificationBell
                    tenantId={activeTenantId}
                    user={user}
                    setActivePage={setActivePage}
                    quietModeUntil={quietModeUntil}
                    isMobile={false}
                  />
                </div>
                <UserDropdown
                  user={user}
                  tenant={tenant}
                  tenantRole={normalizedTenantRole}
                  canInviteMembers={canInviteMembers}
                  canManageWorkspace={canManageWorkspace}
                  canOpenAdminConsole={canOpenAdminConsole}
                  themeMode={dashboardThemeMode}
                  onThemeModeChange={setDashboardThemeMode}
                  quietModeUntil={quietModeUntil}
                  onQuietModeUntilChange={setQuietModeUntil}
                  onOpenInviteModal={() => setShowInviteModal(true)}
                  onOpenProfileSettings={() => openSettingsTab("my-settings")}
                  onOpenWorkspaceSettings={() => openSettingsTab("organization-settings")}
                  onOpenAdminConsole={() => setActivePage("admin")}
                  onOpenNotifications={() => setActivePage("notifications")}
                  onSwitchWorkspace={() => navigate("/select-tenant")}
                  onOpenHelp={() => navigate("/resources")}
                  canInstallApp={showInstallEntry}
                  onInstallApp={handleInstallAction}
                  installActionDescription={installActionDescription}
                  workspaceAppItems={workspaceAppItems}
                  isMobile={false}
                />
              </div>
            </>
          )}
        </header>
        <section className="dashboard-content">
          {shouldShowInstallBanner ? (
            <div className="dashboard-install-banner" role="region" aria-label="Install Habuks app">
              <div className="dashboard-install-banner-copy">
                <strong>Habuks works better as an app</strong>
                <span>Install for faster access, offline use, and one-tap launch.</span>
              </div>
              <div className="dashboard-install-banner-actions">
                <button
                  type="button"
                  className="dashboard-install-banner-btn dashboard-install-banner-btn--primary"
                  onClick={handleInstallAction}
                >
                  Install
                </button>
                <button
                  type="button"
                  className="dashboard-install-banner-btn dashboard-install-banner-btn--ghost"
                  onClick={handleInstallBannerNotNow}
                >
                  Not now
                </button>
              </div>
            </div>
          ) : null}
          {children}
        </section>
      </main>
      <DashboardMobileNav
        activePage={activePage}
        access={access}
        setActivePage={setActivePage}
        onMoreTap={openMobileMoreDrawer}
      />

      {showMobileSearchDrawer && isMobileViewport ? (
        <>
          <button
            type="button"
            className="dashboard-mobile-drawer-backdrop"
            aria-label="Close search"
            onClick={closeMobileSearchDrawer}
          />
          <div
            className="dashboard-mobile-search-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            style={{ transform: `translateY(${mobileSearchDrawerOffsetY}px)` }}
            onTouchStart={handleMobileSearchTouchStart}
            onTouchMove={handleMobileSearchTouchMove}
            onTouchEnd={handleMobileSearchTouchEnd}
          >
            <div className="dashboard-mobile-search-handle" aria-hidden="true" />
            <div className="dashboard-mobile-search-head">
              <strong>Search</strong>
              <button type="button" className="dashboard-mobile-search-close" onClick={closeMobileSearchDrawer}>
                Close
              </button>
            </div>
            <label className="dashboard-mobile-search-input">
              <Icon name="search" size={18} />
              <input
                ref={mobileSearchInputRef}
                type="search"
                placeholder="Search projects, members, documents"
                value={mobileSearchQuery}
                onChange={(event) => setMobileSearchQuery(event.target.value)}
              />
            </label>
            <div className="dashboard-mobile-search-results">
              {filteredMobileSearchSections.map((section) => (
                <section key={section.key} className="dashboard-mobile-search-group">
                  <h3>{section.title}</h3>
                  {section.items.length ? (
                    section.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="dashboard-mobile-search-result"
                        onClick={() => handleMobileSearchResultSelect(item)}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </button>
                    ))
                  ) : (
                    <p className="dashboard-mobile-search-empty">No matches.</p>
                  )}
                </section>
              ))}
              {!mobileSearchHasResults ? (
                <div className="dashboard-mobile-search-none">No results found for this query.</div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      {showMobileMoreDrawer && isMobileViewport ? (
        <>
          <button
            type="button"
            className="dashboard-mobile-drawer-backdrop"
            aria-label="Close more menu"
            onClick={closeMobileMoreDrawer}
          />
          <div
            className="dashboard-mobile-more-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="More actions"
            style={{ transform: `translateY(${mobileMoreDrawerOffsetY}px)` }}
            onTouchStart={handleMobileMoreTouchStart}
            onTouchMove={handleMobileMoreTouchMove}
            onTouchEnd={handleMobileMoreTouchEnd}
          >
            <div className="dashboard-mobile-search-handle" aria-hidden="true" />
            <div className="dashboard-mobile-search-head">
              <strong>More</strong>
              <button type="button" className="dashboard-mobile-search-close" onClick={closeMobileMoreDrawer}>
                Close
              </button>
            </div>
            <div className="dashboard-mobile-more-actions">
              {mobileMoreActions.length ? (
                mobileMoreActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="dashboard-mobile-more-action"
                    onClick={() => handleMobileMoreActionSelect(action)}
                  >
                    <span className="dashboard-mobile-more-action-icon">
                      <Icon name={action.icon} size={18} />
                    </span>
                    <span className="dashboard-mobile-more-action-copy">
                      <strong>{action.label}</strong>
                      <span>{action.description}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="dashboard-mobile-search-none">No actions available for this account.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
      {showInstallInstructionsDrawer ? (
        <>
          <button
            type="button"
            className="dashboard-mobile-drawer-backdrop"
            aria-label="Close install instructions"
            onClick={closeInstallInstructionsDrawer}
          />
          <div
            className="dashboard-mobile-install-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Install Habuks"
            style={{ transform: `translateY(${installInstructionsDrawerOffsetY}px)` }}
            onTouchStart={handleInstallDrawerTouchStart}
            onTouchMove={handleInstallDrawerTouchMove}
            onTouchEnd={handleInstallDrawerTouchEnd}
          >
            <div className="dashboard-mobile-search-handle" aria-hidden="true" />
            <div className="dashboard-mobile-search-head">
              <strong>Install Habuks</strong>
              <button
                type="button"
                className="dashboard-mobile-search-close"
                onClick={closeInstallInstructionsDrawer}
              >
                Close
              </button>
            </div>
            <div className="dashboard-install-drawer-body">
              <p className="dashboard-install-drawer-intro">{installInstructionsHint}</p>
              <ol className="dashboard-install-drawer-steps">
                {installInstructions.map((step, index) => (
                  <li key={`install-step-${index}`}>{step}</li>
                ))}
              </ol>
              <button
                type="button"
                className="dashboard-install-banner-btn dashboard-install-banner-btn--primary"
                onClick={closeInstallInstructionsDrawer}
              >
                Done
              </button>
            </div>
          </div>
        </>
      ) : null}
      {installToastMessage ? (
        <div className="dashboard-install-toast" role="status" aria-live="polite">
          {installToastMessage}
        </div>
      ) : null}

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

            {!inviteRoleIsAdmin && (
              <div className="data-modal-field data-modal-field--full">
                <label>Project Access</label>
                <select
                  value={inviteProjectScope}
                  onChange={(e) => handleInviteFormChange("project_access_scope", e.target.value)}
                  disabled={submittingInvite}
                >
                  <option value="selected">Selected projects</option>
                  <option value="all">All projects</option>
                  <option value="none">No project access yet</option>
                </select>
              </div>
            )}

            {!inviteRoleIsAdmin && inviteProjectScope === "selected" && (
              <div className="data-modal-field data-modal-field--full">
                <label>Projects</label>
                <div className="data-modal-checkbox-list">
                  {loadingInviteProjects ? (
                    <p className="data-modal-hint">Loading projects...</p>
                  ) : inviteProjects.length ? (
                    inviteProjects.map((project) => {
                      const projectId = Number.parseInt(String(project?.id || ""), 10);
                      if (!Number.isInteger(projectId) || projectId <= 0) return null;
                      const checked = inviteProjectIds.includes(projectId);
                      return (
                        <label key={projectId} className="data-modal-checkbox-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleInviteProjectToggle(projectId)}
                            disabled={submittingInvite}
                          />
                          <span>{project?.name || `Project ${projectId}`}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="data-modal-hint">No projects available in this workspace yet.</p>
                  )}
                </div>
              </div>
            )}

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

      {/* Overlay for mobile */}
      {sidebarOpen && !isMobileViewport && (
        <div className="dashboard-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

export { DashboardLayout };
export default DashboardLayout;
