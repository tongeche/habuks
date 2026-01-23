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
  "profile",
  "admin",
];

const ensureSet = (items) => new Set(items.filter(Boolean));

export const getRoleAccess = ({ role, projectCodes = [] }) => {
  const normalizedRole = String(role || "member").toLowerCase();
  const allowedProjectCodes = new Set(projectCodes.map((code) => String(code).toUpperCase()));

  if (ADMIN_ROLES.includes(normalizedRole)) {
    return {
      allowedPages: ensureSet(ALL_PAGES),
      defaultPage: "overview",
      allowedProjectCodes: new Set(["JPP", "JGF", ...allowedProjectCodes]),
    };
  }

  if (normalizedRole === "supervisor") {
    return {
      allowedPages: ensureSet(["reports", "expenses", "meetings", "documents", "profile"]),
      defaultPage: "reports",
      allowedProjectCodes,
    };
  }

  if (normalizedRole === "project_manager") {
    const projectPages = [];
    if (allowedProjectCodes.has("JPP")) projectPages.push("projects-jpp");
    if (allowedProjectCodes.has("JGF")) projectPages.push("projects-jgf");
    return {
      allowedPages: ensureSet(["projects", "profile", ...projectPages]),
      defaultPage: "projects",
      allowedProjectCodes,
    };
  }

  const memberProjectPages = [];
  if (allowedProjectCodes.has("JPP")) memberProjectPages.push("projects-jpp");
  if (allowedProjectCodes.has("JGF")) memberProjectPages.push("projects-jgf");

  return {
    allowedPages: ensureSet([
      "welfare",
      "payouts",
      "contributions",
      "meetings",
      "documents",
      "projects",
      "profile",
      ...memberProjectPages,
    ]),
    defaultPage: "welfare",
    allowedProjectCodes,
  };
};

export const isAdminRole = (role) => ADMIN_ROLES.includes(String(role || "").toLowerCase());
