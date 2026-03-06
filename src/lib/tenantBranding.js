import { getPlanFeatureSet, resolveTenantSubscriptionPlanId } from "./subscriptionPlans.js";

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
  const overrideContact = toObject(overrides.contact);
  const baseContact = toObject(baseData.contact);
  const overrideProfile = toObject(overrides.organization_profile);
  const baseProfile = toObject(baseData.organization_profile);
  return {
    id: tenant?.id ?? null,
    name: overrides.orgName ?? tenant?.name ?? baseData.orgName ?? "Habuks",
    tagline: overrides.orgTagline ?? tenant?.tagline ?? baseData.orgTagline ?? "",
    logoUrl: overrides.logoUrl ?? tenant?.logo_url ?? baseData.logoUrl ?? "/assets/logo.png",
    slug: tenant?.slug ?? null,
    contactEmail:
      overrides.contactEmail ??
      tenant?.contact_email ??
      overrideContact.email ??
      baseData.contactEmail ??
      baseContact.email ??
      "",
    contactPhone:
      overrides.contactPhone ??
      tenant?.contact_phone ??
      overrideContact.phone ??
      baseData.contactPhone ??
      baseContact.phone ??
      "",
    location: overrides.location ?? tenant?.location ?? overrideContact.location ?? baseContact.location ?? "",
    address: overrides.address ?? overrideContact.address ?? baseContact.address ?? "",
    website: overrides.website ?? overrideProfile.website ?? baseProfile.website ?? baseData.website ?? "",
    contact: {
      email:
        overrides.contactEmail ??
        tenant?.contact_email ??
        overrideContact.email ??
        baseData.contactEmail ??
        baseContact.email ??
        "",
      phone:
        overrides.contactPhone ??
        tenant?.contact_phone ??
        overrideContact.phone ??
        baseData.contactPhone ??
        baseContact.phone ??
        "",
      location: overrides.location ?? tenant?.location ?? overrideContact.location ?? baseContact.location ?? "",
      address: overrides.address ?? overrideContact.address ?? baseContact.address ?? "",
      website: overrides.website ?? overrideProfile.website ?? baseProfile.website ?? baseData.website ?? "",
    },
    organization_profile: {
      website: overrides.website ?? overrideProfile.website ?? baseProfile.website ?? baseData.website ?? "",
    },
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
  const subscriptionFeatures = getPlanFeatureSet(
    resolveTenantSubscriptionPlanId(tenant, "starter"),
    "starter"
  );
  const overrideFeatures = toObject(overrides.features);
  const merged = {
    ...DEFAULT_FEATURES,
    ...baseFeatures,
    ...subscriptionFeatures,
    ...overrideFeatures,
  };
  Object.entries(subscriptionFeatures).forEach(([featureKey, isEnabled]) => {
    if (isEnabled === false) {
      merged[featureKey] = false;
    }
  });
  return merged;
}
