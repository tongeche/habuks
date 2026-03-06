const MEGABYTE = 1024 * 1024;
const GIGABYTE = 1024 * MEGABYTE;

const DEFAULT_PLAN_ID = "starter";

const PLAN_DEFINITIONS = {
  demo: {
    id: "demo",
    name: "Demo",
    priceMonthlyKes: 0,
    trialDays: 0,
    features: {
      members_management: true,
      finance_tracking: true,
      projects_management: true,
      tasks: true,
      partner_directory: true,
      document_generator: true,
      file_uploads: true,
      reports: true,
      reports_mode: "advanced",
      csv_import_export: false,
      audit_logs: false,
      automation: false,
      api_access: false,
      member_invites: false,
      welfare: true,
      projects: true,
      expenses: true,
      news: true,
      documents: true,
      meetings: true,
    },
    limits: {
      members: 20,
      projects: 5,
      partners: 5,
      financial_records: 100,
      documents: 20,
      storage_bytes: 50 * MEGABYTE,
    },
  },
  free: {
    id: "free",
    name: "Free",
    priceMonthlyKes: 0,
    trialDays: 0,
    features: {
      members_management: true,
      finance_tracking: true,
      projects_management: true,
      tasks: true,
      partner_directory: false,
      document_generator: true,
      file_uploads: true,
      reports: true,
      reports_mode: "basic",
      csv_import_export: false,
      audit_logs: false,
      automation: false,
      api_access: false,
      member_invites: true,
      welfare: true,
      projects: true,
      expenses: true,
      news: true,
      documents: true,
      meetings: true,
    },
    limits: {
      members: 15,
      projects: 3,
      partners: 0,
      financial_records: 200,
      documents: 20,
      storage_bytes: 100 * MEGABYTE,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyKes: 0,
    trialDays: 30,
    features: {
      members_management: true,
      finance_tracking: true,
      projects_management: true,
      tasks: true,
      partner_directory: true,
      document_generator: true,
      file_uploads: true,
      reports: true,
      reports_mode: "advanced",
      csv_import_export: true,
      audit_logs: false,
      automation: false,
      api_access: false,
      member_invites: true,
      welfare: true,
      projects: true,
      expenses: true,
      news: true,
      documents: true,
      meetings: true,
    },
    limits: {
      members: 50,
      projects: null,
      partners: 50,
      financial_records: 5000,
      documents: 200,
      storage_bytes: 2 * GIGABYTE,
    },
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthlyKes: 1900,
    trialDays: 30,
    features: {
      members_management: true,
      finance_tracking: true,
      projects_management: true,
      tasks: true,
      partner_directory: true,
      document_generator: true,
      file_uploads: true,
      reports: true,
      reports_mode: "advanced",
      csv_import_export: true,
      audit_logs: true,
      automation: true,
      api_access: false,
      member_invites: true,
      welfare: true,
      projects: true,
      expenses: true,
      news: true,
      documents: true,
      meetings: true,
    },
    limits: {
      members: null,
      projects: null,
      partners: null,
      financial_records: null,
      documents: null,
      storage_bytes: 10 * GIGABYTE,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyKes: 2900,
    trialDays: 15,
    features: {
      members_management: true,
      finance_tracking: true,
      projects_management: true,
      tasks: true,
      partner_directory: true,
      document_generator: true,
      file_uploads: true,
      reports: true,
      reports_mode: "advanced",
      csv_import_export: true,
      audit_logs: true,
      automation: true,
      api_access: true,
      member_invites: true,
      welfare: true,
      projects: true,
      expenses: true,
      news: true,
      documents: true,
      meetings: true,
    },
    limits: {
      members: null,
      projects: null,
      partners: null,
      financial_records: null,
      documents: null,
      storage_bytes: 50 * GIGABYTE,
    },
  },
};

const PLAN_ALIASES = {
  trial: "starter",
  basic: "starter",
  enterprise: "pro",
};

const toObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function normalizePlanId(value, fallback = DEFAULT_PLAN_ID) {
  const normalizedFallback = normalizeKey(fallback) || DEFAULT_PLAN_ID;
  const normalized = normalizeKey(value);
  if (!normalized) return normalizedFallback;
  if (PLAN_DEFINITIONS[normalized]) return normalized;
  const alias = PLAN_ALIASES[normalized];
  if (alias && PLAN_DEFINITIONS[alias]) return alias;
  return normalizedFallback;
}

export function getSubscriptionPlan(value, fallback = DEFAULT_PLAN_ID) {
  const planId = normalizePlanId(value, fallback);
  return PLAN_DEFINITIONS[planId] || PLAN_DEFINITIONS[DEFAULT_PLAN_ID];
}

export function getPlanFeatureSet(value, fallback = DEFAULT_PLAN_ID) {
  const plan = getSubscriptionPlan(value, fallback);
  return { ...toObject(plan.features) };
}

export function getPlanLimitSet(value, fallback = DEFAULT_PLAN_ID) {
  const plan = getSubscriptionPlan(value, fallback);
  return { ...toObject(plan.limits) };
}

export function resolveTenantSubscriptionPlanId(tenant, fallback = DEFAULT_PLAN_ID) {
  const siteData = toObject(tenant?.site_data);
  const subscription = toObject(siteData.subscription);
  return normalizePlanId(
    subscription.plan || subscription.tier || siteData.plan || tenant?.plan || null,
    fallback
  );
}

export function isPlanFeatureEnabled(planId, featureKey, fallback = DEFAULT_PLAN_ID) {
  const features = getPlanFeatureSet(planId, fallback);
  return Boolean(features[normalizeKey(featureKey)] ?? features[featureKey]);
}

export function buildSubscriptionMetadata(planId, previousSubscription = {}, options = {}) {
  const existing = toObject(previousSubscription);
  const resolvedPlanId = normalizePlanId(planId, options.fallbackPlanId || DEFAULT_PLAN_ID);
  const nowIso = new Date().toISOString();
  return {
    ...existing,
    plan: resolvedPlanId,
    status: String(existing.status || options.status || "active")
      .trim()
      .toLowerCase(),
    source: String(existing.source || options.source || "system")
      .trim()
      .toLowerCase(),
    assigned_at: String(existing.assigned_at || options.assignedAt || nowIso).trim(),
  };
}

export const SUBSCRIPTION_PLANS = PLAN_DEFINITIONS;
export const DEFAULT_SUBSCRIPTION_PLAN_ID = DEFAULT_PLAN_ID;

