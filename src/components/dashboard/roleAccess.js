const ADMIN_ROLES = ["admin", "superadmin"];

const ALL_PAGES = [
  "overview",
  "welfare",
  "payouts",
  "contributions",
  "projects",
  "projects-jpp",
  "projects-jgf",
  "expenses",
  "reports",
  "news",
  "documents",
  "meetings",
  "members",
  "settings",
  "admin",
];

const DEFAULT_FEATURES = {
  welfare: true,
  projects: true,
  expenses: true,
  reports: true,
  news: true,
  documents: true,
  meetings: true,
};

const ensureSet = (items) => new Set(items.filter(Boolean));

const normalizeFeatures = (features) => ({
  ...DEFAULT_FEATURES,
  ...(features && typeof features === "object" ? features : {}),
});

const applyFeatureAccess = (pages, features) => {
  const allowed = new Set(pages);
  if (!features.welfare) {
    allowed.delete("welfare");
    allowed.delete("payouts");
    allowed.delete("contributions");
  }
  if (!features.projects) {
    allowed.delete("projects");
    allowed.delete("projects-jpp");
    allowed.delete("projects-jgf");
  }
  if (!features.expenses) {
    allowed.delete("expenses");
  }
  if (!features.reports) {
    allowed.delete("reports");
  }
  if (!features.news) {
    allowed.delete("news");
  }
  if (!features.documents) {
    allowed.delete("documents");
  }
  if (!features.meetings) {
    allowed.delete("meetings");
  }
  return allowed;
};

const resolveDefaultPage = (preferred, allowedPages) => {
  if (allowedPages.has(preferred)) {
    return preferred;
  }
  if (allowedPages.has("overview")) {
    return "overview";
  }
  return Array.from(allowedPages)[0] || "overview";
};

export const getRoleAccess = ({ role, projectModules = [], features }) => {
  const normalizedRole = String(role || "member").toLowerCase();
  const allowedProjectModules = new Set(
    projectModules.map((moduleKey) => String(moduleKey).trim().toLowerCase())
  );
  const featureFlags = normalizeFeatures(features);

  if (ADMIN_ROLES.includes(normalizedRole)) {
    let adminPages = new Set(ALL_PAGES);
    if (!allowedProjectModules.has("jpp")) {
      adminPages.delete("projects-jpp");
    }
    if (!allowedProjectModules.has("jgf")) {
      adminPages.delete("projects-jgf");
    }
    adminPages = applyFeatureAccess(adminPages, featureFlags);
    return {
      allowedPages: adminPages,
      defaultPage: resolveDefaultPage("overview", adminPages),
      allowedProjectModules,
    };
  }

  if (normalizedRole === "supervisor") {
    const supervisorPages = applyFeatureAccess(
      ensureSet([
        "overview",
        "reports",
        "expenses",
        "meetings",
        "documents",
        "members",
        "settings",
      ]),
      featureFlags
    );
    return {
      allowedPages: supervisorPages,
      defaultPage: resolveDefaultPage("overview", supervisorPages),
      allowedProjectModules,
    };
  }

  if (normalizedRole === "project_manager") {
    const projectPages = [];
    if (allowedProjectModules.has("jpp")) projectPages.push("projects-jpp");
    if (allowedProjectModules.has("jgf")) projectPages.push("projects-jgf");
    const managerPages = applyFeatureAccess(
      ensureSet([
        "overview",
        "projects",
        "members",
        "settings",
        ...projectPages,
      ]),
      featureFlags
    );
    return {
      allowedPages: managerPages,
      defaultPage: resolveDefaultPage("overview", managerPages),
      allowedProjectModules,
    };
  }

  const memberProjectPages = [];
  if (allowedProjectModules.has("jpp")) memberProjectPages.push("projects-jpp");
  if (allowedProjectModules.has("jgf")) memberProjectPages.push("projects-jgf");

  const memberPages = applyFeatureAccess(
    ensureSet([
      "overview",
      "welfare",
      "payouts",
      "contributions",
      "meetings",
      "documents",
      "projects",
      "members",
      "settings",
      ...memberProjectPages,
    ]),
    featureFlags
  );
  return {
    allowedPages: memberPages,
    defaultPage: resolveDefaultPage("overview", memberPages),
    allowedProjectModules,
  };
};

export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role || "").toLowerCase());
