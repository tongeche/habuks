export const TENANT_TEMPLATE_ONE_KEY = "minimal-hero-v1";

export const TENANT_TEMPLATE_PRESETS = [
  {
    key: TENANT_TEMPLATE_ONE_KEY,
    id: "template-1",
    label: "Template 1 · Hope",
    description: "Rounded dark-emerald shell with warm accent highlights.",
    shell: "template-1",
  },
];

const TEMPLATE_KEY_ALIASES = new Map([
  ["template-1", TENANT_TEMPLATE_ONE_KEY],
  ["template-one", TENANT_TEMPLATE_ONE_KEY],
  ["hope", TENANT_TEMPLATE_ONE_KEY],
  ["minimal", TENANT_TEMPLATE_ONE_KEY],
  ["minimal-hero-v1", TENANT_TEMPLATE_ONE_KEY],
  // Legacy aliases still map to the single supported template.
  ["template-2", TENANT_TEMPLATE_ONE_KEY],
  ["template-two", TENANT_TEMPLATE_ONE_KEY],
  ["kindflow", TENANT_TEMPLATE_ONE_KEY],
  ["classic", TENANT_TEMPLATE_ONE_KEY],
  ["classic-hero-v1", TENANT_TEMPLATE_ONE_KEY],
]);

export const DEFAULT_TENANT_TEMPLATE_KEY = TENANT_TEMPLATE_ONE_KEY;
export const DEFAULT_TENANT_SITE_SHELL =
  TENANT_TEMPLATE_PRESETS.find((preset) => preset.key === DEFAULT_TENANT_TEMPLATE_KEY)?.shell ||
  "template-1";

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export function normalizeTenantTemplateKey(value) {
  const normalized = normalize(value);
  if (!normalized) return DEFAULT_TENANT_TEMPLATE_KEY;
  return TEMPLATE_KEY_ALIASES.get(normalized) || DEFAULT_TENANT_TEMPLATE_KEY;
}

export function getTenantTemplatePreset(templateKey) {
  const normalizedKey = normalizeTenantTemplateKey(templateKey);
  return (
    TENANT_TEMPLATE_PRESETS.find((preset) => preset.key === normalizedKey) ||
    TENANT_TEMPLATE_PRESETS.find((preset) => preset.key === DEFAULT_TENANT_TEMPLATE_KEY) ||
    TENANT_TEMPLATE_PRESETS[0]
  );
}

export function getTenantTemplateSelectOptions(rawTemplates = []) {
  const rawByKey = new Map(
    (Array.isArray(rawTemplates) ? rawTemplates : []).map((template) => [
      normalize(template?.key),
      template,
    ])
  );
  return TENANT_TEMPLATE_PRESETS.map((preset) => {
    const source = rawByKey.get(normalize(preset.key)) || null;
    return {
      key: preset.key,
      label: source?.label || preset.label,
      description: source?.description || preset.description,
      data: source?.data || null,
      is_active: source?.is_active ?? true,
      shell: preset.shell,
      presetId: preset.id,
    };
  });
}

export function resolveTenantSiteShell({ templateKey } = {}) {
  return getTenantTemplatePreset(templateKey)?.shell || DEFAULT_TENANT_SITE_SHELL;
}

const toObject = (value) => (value && typeof value === "object" ? value : {});
const toArray = (value) => (Array.isArray(value) ? value : []);
const toText = (value) => String(value || "").trim();

const toStringList = (value) =>
  toArray(value)
    .map((item) => toText(item))
    .filter(Boolean);

const toLinkObject = (value, defaults = {}) => {
  const source = toObject(value);
  const label = toText(source.label || defaults.label || "");
  const href = toText(source.href || defaults.href || "");
  if (!label || !href) return null;
  const style = toText(source.style || defaults.style || "");
  return style ? { label, href, style } : { label, href };
};

const sanitizeLinkList = (value) =>
  toArray(value)
    .map((item) => {
      const source = toObject(item);
      const label = toText(source.label);
      const href = toText(source.href);
      if (!label || !href) return null;
      const icon = toText(source.icon);
      return icon ? { label, href, icon } : { label, href };
    })
    .filter(Boolean);

const sanitizeActionList = (value) =>
  toArray(value)
    .map((item) => {
      const source = toObject(item);
      const label = toText(source.label);
      const href = toText(source.href);
      if (!label || !href) return null;
      const style = toText(source.style);
      return style ? { label, href, style } : { label, href };
    })
    .filter(Boolean);

const isLoginLinkLike = (value = {}) => {
  const source = toObject(value);
  const label = toText(source.label).toLowerCase();
  const href = toText(source.href).toLowerCase();
  return (
    label.includes("login") ||
    label.includes("member") ||
    href === "/login" ||
    href.endsWith("/login")
  );
};

const normalizeProgramItem = (
  item,
  { fallbackHref = "#contact", fallbackIndex = 0, ctaLabel = "Learn more" } = {}
) => {
  const source = toObject(item);
  const title =
    toText(source.title) ||
    toText(source.name) ||
    toText(source.code) ||
    (typeof item === "string" ? toText(item) : "");
  if (!title) return null;

  const description =
    toText(source.description) || toText(source.short_description) || toText(source.overview);
  const tag = toText(source.tag) || toText(source.type) || toText(source.module_key);
  const status = toText(source.status);
  const highlights = toStringList(
    source.highlights || source.objectives || source.focus || source.impact
  ).slice(0, 4);
  const imageUrl = toText(source.image_url || source.imageUrl);
  const cta = toLinkObject(source.cta, {
    label: ctaLabel,
    href: fallbackHref,
  });

  return {
    title,
    description,
    tag: tag || `Program ${fallbackIndex + 1}`,
    status,
    highlights,
    cta,
    image: imageUrl ? { src: imageUrl, alt: `${title} image` } : null,
  };
};

const buildProgramsSection = ({ tenantSiteData, publicProjects }) => {
  const section = toObject(tenantSiteData.programsSection);
  const settingsByProjectId = new Map(
    toArray(section.projectSettings)
      .map((entry) => {
        const source = toObject(entry);
        const projectId = toText(source.project_id || source.projectId || source.id);
        if (!projectId) return null;
        return [
          projectId,
          {
            is_visible: source.is_visible !== false,
            href: toText(source.href || source.link || source.url),
          },
        ];
      })
      .filter(Boolean)
  );

  const projectItems = toArray(publicProjects);
  const fallbackItems = [
    ...toArray(section.items),
    ...toArray(tenantSiteData.publicPrograms),
    ...toArray(tenantSiteData.public_programs),
    ...toArray(tenantSiteData.projects),
  ];
  const rawItems = projectItems.length ? projectItems : fallbackItems;
  const seen = new Set();
  const items = rawItems
    .map((item, index) => {
      const source = toObject(item);
      const projectId = toText(source.id || source.project_id || source.projectId);
      const projectSetting = projectId ? settingsByProjectId.get(projectId) : null;
      if (projectSetting && projectSetting.is_visible === false) {
        return null;
      }
      const normalized = normalizeProgramItem(item, {
        fallbackHref: projectSetting?.href || "#contact",
        fallbackIndex: index,
      });
      if (!normalized) return null;
      const dedupeKey = `${projectId || ""}|${toText(normalized.title).toLowerCase()}`;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return normalized;
    })
    .filter(Boolean)
    .slice(0, 8);

  if (!items.length) return null;

  return {
    id: toText(section.id) || "programs",
    kicker: toText(section.kicker) || "PROGRAMS",
    title: toText(section.title) || "Programs",
    description: toText(section.description) || "Programs and initiatives currently published by this workspace.",
    items,
  };
};

const buildObjectivesSection = ({ tenantSiteData, source }) => {
  const section = toObject(tenantSiteData.objectivesSection);
  const organizationProfile = toObject(tenantSiteData.organization_profile);
  const mission = toText(organizationProfile.mission || tenantSiteData.mission);
  const vision = toText(organizationProfile.vision || tenantSiteData.vision);

  const objectives = toStringList(section.objectives);
  const goals = toStringList(section.goals);
  const finalObjectives = objectives.length ? objectives : mission ? [mission] : [];
  const finalGoals = goals.length ? goals : vision ? [vision] : [];

  if (!finalObjectives.length && !finalGoals.length && !toText(source.orgBio)) {
    return null;
  }

  return {
    id: toText(section.id) || "about",
    kicker: toText(section.kicker) || "ABOUT",
    title: toText(section.title) || "Objectives & goals",
    description:
      toText(section.description) ||
      toText(source.orgBio) ||
      "How this workspace is organized and what outcomes it is pursuing.",
    objectivesTitle: toText(section.objectivesTitle) || "Objectives",
    goalsTitle: toText(section.goalsTitle) || "Goals",
    objectives: finalObjectives,
    goals: finalGoals,
    image: toObject(section.image),
  };
};

const buildImpactSection = ({ tenantSiteData, source, publicProjects }) => {
  const section = toObject(tenantSiteData.impactStrip);
  const organizationProfile = toObject(tenantSiteData.organization_profile);
  const partners = toArray(organizationProfile.partners);
  const activeProjects = toArray(publicProjects).filter((project) => {
    const status = toText(project?.status).toLowerCase();
    return status === "active" || status === "planning" || status === "in_progress";
  }).length;

  const generatedItems = [];
  if (toArray(publicProjects).length) {
    generatedItems.push({
      value: `${toArray(publicProjects).length}`,
      label: "Public projects",
    });
  }
  if (activeProjects) {
    generatedItems.push({
      value: `${activeProjects}`,
      label: "Active projects",
    });
  }
  if (partners.length) {
    generatedItems.push({
      value: `${partners.length}`,
      label: "Partners",
    });
  }
  if (toText(source?.contact?.location)) {
    generatedItems.push({
      value: toText(source.contact.location),
      label: "Location",
    });
  }

  if (!generatedItems.length) return null;

  return {
    id: toText(section.id) || "impact",
    kicker: toText(section.kicker) || "IMPACT",
    title: "Project impact snapshot",
    description: "Live indicators generated from visible projects and organization profile data.",
    items: generatedItems,
  };
};

const buildTestimonialsSection = ({ tenantSiteData, publicProjects }) => {
  const section = toObject(tenantSiteData.testimonialsSection);
  const organizationProfile = toObject(tenantSiteData.organization_profile);
  const partnerItems = toArray(organizationProfile.partners)
    .map((partner) => {
      const source = toObject(partner);
      const quote = toText(source.notes || source.summary || source.description);
      if (!quote) return null;
      const name = toText(source.contact_person || source.name);
      if (!name) return null;
      const role = toText(source.kind) || "Partner";
      const avatarSrc = toText(source.logo_url || source.logo || source.avatar_url || source.image_url);
      return {
        quote,
        name,
        role,
        avatar: avatarSrc ? { src: avatarSrc, alt: `${name} avatar` } : null,
      };
    })
    .filter(Boolean);
  const projectItems = toArray(publicProjects)
    .map((project) => {
      const source = toObject(project);
      const quote = toText(source.short_description || source.description);
      if (!quote) return null;
      const name = toText(source.name || source.code);
      if (!name) return null;
      const status = toText(source.status);
      return {
        quote,
        name,
        role: status ? `${status} project` : "Project",
        avatar: null,
      };
    })
    .filter(Boolean);
  const combined = [...partnerItems, ...projectItems];
  const seen = new Set();
  const items = combined
    .filter((item) => {
      const key = `${toText(item.name).toLowerCase()}|${toText(item.quote).toLowerCase()}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);

  if (!items.length) return null;

  return {
    id: toText(section.id) || "testimonials",
    kicker: toText(section.kicker) || "STORIES",
    title: "Voices from our work",
    description: "Live highlights generated from partner notes and published project summaries.",
    items,
  };
};

const buildCtaBanner = ({ tenantSiteData, source }) => {
  const section = toObject(tenantSiteData.ctaBanner);
  const ctaLabel = toText(toObject(section.cta).label) || "Contact team";
  const cta = {
    label: ctaLabel,
    href: "#contact",
  };

  return {
    id: toText(section.id) || "get-involved",
    kicker: toText(section.kicker) || "GET INVOLVED",
    title: toText(section.title) || `Support ${toText(source.orgName) || "this organization"}`,
    description:
      toText(section.description) ||
      toText(source.orgTagline) ||
      "Reach out for partnerships, contributions, or collaboration.",
    cta,
  };
};

const buildContactSection = ({ tenantSiteData, source }) => {
  const section = toObject(tenantSiteData.contact);
  const email = toText(source?.contact?.email);
  const defaultActions = email
    ? [
        { label: "Email us", href: `mailto:${email}`, style: "primary" },
        { label: "Member Login", href: "/login", style: "ghost" },
      ]
    : [
        { label: "Member Login", href: "/login", style: "primary" },
        { label: "Join workspace", href: "/register", style: "ghost" },
      ];

  return {
    id: toText(section.id) || "contact",
    kicker: toText(section.kicker) || "CONTACT",
    title: toText(section.title) || "Contact us",
    intro:
      toText(section.intro) ||
      `Connect with ${toText(source.orgName) || "this workspace"} for collaboration and support.`,
    panelTitle: toText(section.panelTitle) || "Ready to collaborate?",
    panelDescription:
      toText(section.panelDescription) || "We respond as soon as possible.",
    actions: defaultActions,
    email: email || null,
    phone: toText(source?.contact?.phone) || null,
    location: toText(source?.contact?.location) || null,
  };
};

const buildTenantNav = (tenantSiteData) => {
  const links = sanitizeLinkList(tenantSiteData.tenantNav);
  if (links.length) return links;
  return [
    { label: "Home", href: "#top" },
    { label: "Programs", href: "#programs" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
  ];
};

export function applyTenantTemplateDataDefaults({
  data,
  templateKey,
  tenantSiteData,
  publicProjects,
} = {}) {
  const source = toObject(data);
  const siteData = toObject(tenantSiteData);
  const sectionPrograms = buildProgramsSection({
    tenantSiteData: siteData,
    publicProjects: toArray(publicProjects),
  });
  const sectionObjectives = buildObjectivesSection({
    tenantSiteData: siteData,
    source,
  });
  const sectionImpact = buildImpactSection({
    tenantSiteData: siteData,
    source,
    publicProjects: toArray(publicProjects),
  });
  const sectionTestimonials = buildTestimonialsSection({
    tenantSiteData: siteData,
    publicProjects: toArray(publicProjects),
  });
  const sectionCta = buildCtaBanner({ tenantSiteData: siteData, source });
  const sectionContact = buildContactSection({ tenantSiteData: siteData, source });
  const tenantNav = buildTenantNav(siteData);
  const footer = {
    ...toObject(source.footer),
    ...toObject(siteData.footer),
    quickLinks:
      sanitizeLinkList(toObject(siteData.footer).quickLinks).length > 0
        ? sanitizeLinkList(toObject(siteData.footer).quickLinks)
        : tenantNav,
  };
  const fallbackTenantCta = {
    label: "Donate",
    href: "#contact",
  };
  const configuredTenantCta = toLinkObject(siteData.tenantCta, fallbackTenantCta);
  const tenantCta =
    configuredTenantCta && !isLoginLinkLike(configuredTenantCta)
      ? configuredTenantCta
      : fallbackTenantCta;
  const heroHeadline = toText(siteData.heroHeadline) || toText(source.orgName) || "Organization";
  const heroEyebrow = toText(siteData.heroEyebrow || siteData.heroKicker);
  const heroIntroFromSite = toArray(siteData.heroIntro).map((item) => toText(item)).filter(Boolean);
  const heroIntro = heroIntroFromSite.length
    ? [heroIntroFromSite[0]]
    : ["Supporting communities through transparent programs and measurable outcomes."];
  const websiteMedia = toObject(siteData.websiteMedia);
  const websiteMediaImages = toArray(websiteMedia.images)
    .map((image) => {
      const sourceImage = toObject(image);
      const src = toText(sourceImage.src);
      if (!src) return null;
      return {
        src,
        alt: toText(sourceImage.alt) || `${heroHeadline} image`,
      };
    })
    .filter(Boolean);
  const heroImages = websiteMediaImages.length
    ? websiteMediaImages
    : toArray(siteData.heroImages)
        .map((image) => {
          const sourceImage = toObject(image);
          const src = toText(sourceImage.src);
          if (!src) return null;
          return {
            src,
            alt: toText(sourceImage.alt) || `${heroHeadline} image`,
          };
        })
        .filter(Boolean);
  const heroBackgroundImage = toText(
    websiteMedia.heroBackgroundImage ||
      siteData.heroBackgroundImage ||
      siteData.heroImage ||
      heroImages[0]?.src
  );
  const heroCta = sanitizeActionList(siteData.cta);
  const nonLoginHeroCta = heroCta.filter((item) => !isLoginLinkLike(item));
  const finalHeroCta = nonLoginHeroCta.length
    ? [{ ...nonLoginHeroCta[0], style: "primary" }]
    : tenantCta
      ? [{ ...tenantCta, style: "primary" }]
      : [];
  const heroSecondaryLink = null;

  return {
    ...source,
    tenantNav,
    tenantCta,
    socialLinks: sanitizeLinkList(siteData.socialLinks),
    footer,
    heroEyebrow,
    heroHeadline,
    heroIntro,
    heroImages,
    heroBackgroundImage,
    cta: finalHeroCta,
    heroSecondaryLink,
    programsSection: sectionPrograms,
    objectivesSection: sectionObjectives,
    impactStrip: sectionImpact,
    testimonialsSection: sectionTestimonials,
    ctaBanner: sectionCta,
    contact: sectionContact,
    heroTemplate: "minimal",
    heroVariant: "default",
    siteShell: "template-1",
  };
}
