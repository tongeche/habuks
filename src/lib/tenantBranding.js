const DEFAULT_THEME = {
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

const DEFAULT_FEATURES = {
  welfare: false,
  projects: true,
  expenses: true,
  reports: true,
  news: true,
  documents: true,
  meetings: true,
};

const toObject = (value) => (value && typeof value === "object" ? value : {});

export function buildTenantBrand(tenant, baseData = {}) {
  const overrides = toObject(tenant?.site_data);
  return {
    id: tenant?.id ?? null,
    name: overrides.orgName ?? tenant?.name ?? baseData.orgName ?? "Habuks",
    tagline: overrides.orgTagline ?? tenant?.tagline ?? baseData.orgTagline ?? "",
    logoUrl: overrides.logoUrl ?? tenant?.logo_url ?? baseData.logoUrl ?? "/assets/logo.png",
    slug: tenant?.slug ?? null,
  };
}

export function buildTenantThemeVars(tenant, baseData = {}) {
  const overrides = toObject(tenant?.site_data);
  const baseTheme = toObject(baseData.theme);
  const overrideTheme = toObject(overrides.theme);
  const theme = {
    ...DEFAULT_THEME,
    ...baseTheme,
    ...overrideTheme,
  };

  return {
    "--navy-900": theme.sidebar,
    "--navy-800": theme.sidebarAlt,
    "--navy-700": theme.sidebarAlt2,
    "--green-primary": theme.primary,
    "--green-dark": theme.primaryDark,
    "--green-secondary": theme.secondary,
    "--accent": theme.accent,
    "--accent-dark": theme.accentDark,
    "--ink": theme.ink,
    "--off-white": theme.offWhite,
  };
}

export function buildTenantFeatures(tenant, baseData = {}) {
  const overrides = toObject(tenant?.site_data);
  const baseFeatures = toObject(baseData.features);
  const overrideFeatures = toObject(overrides.features);
  return {
    ...DEFAULT_FEATURES,
    ...baseFeatures,
    ...overrideFeatures,
  };
}
