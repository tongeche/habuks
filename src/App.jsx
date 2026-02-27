import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TenantHeader from "./components/TenantHeader.jsx";
import TenantFooter from "./components/TenantFooter.jsx";
import TenantSiteShell from "./components/TenantSiteShell.jsx";
import {
  getPublicTenantProjects,
  getTenantBySlug,
  getTenantSiteTemplate,
} from "./lib/dataService.js";
import { buildTenantBrand, buildTenantThemeVars } from "./lib/tenantBranding.js";
import {
  applyTenantTemplateDataDefaults,
  normalizeTenantTemplateKey,
  resolveTenantSiteShell,
} from "./lib/tenantSiteShell.js";

const getSiteData = () => {
  if (typeof window !== "undefined" && window.siteData) {
    return window.siteData();
  }
  return {};
};

const mergeTenantData = (base, tenant, template) => {
  if (!tenant) {
    return base;
  }

  const siteData =
    tenant.site_data && typeof tenant.site_data === "object" ? tenant.site_data : {};
  const overrideSource =
    siteData?.overrides && typeof siteData.overrides === "object" ? siteData.overrides : siteData;
  const { templateKey: _templateKey, overrides: _nestedOverrides, ...overrides } = overrideSource;
  const templateData = template && typeof template === "object" ? template : {};
  const templateContact = templateData.contact ?? {};
  const overrideContact = overrides.contact ?? {};
  const templateFooter = templateData.footer ?? {};
  const overrideFooter = overrides.footer ?? {};

  const merged = {
    theme: base.theme,
    tenantNav: overrides.tenantNav ?? templateData.tenantNav ?? base.tenantNav ?? base.nav ?? [],
    tenantCta: overrides.tenantCta ?? templateData.tenantCta ?? base.tenantCta,
    socialLinks: overrides.socialLinks ?? templateData.socialLinks ?? base.socialLinks ?? [],
    ...templateData,
    ...overrides,
  };

  merged.orgName = overrides.orgName ?? tenant.name ?? base.orgName ?? "";
  merged.orgTagline = overrides.orgTagline ?? tenant.tagline ?? "";
  merged.logoUrl = overrides.logoUrl ?? tenant.logo_url ?? base.logoUrl ?? "";

  merged.contact = {
    ...templateContact,
    ...overrideContact,
    email: tenant.contact_email ?? overrideContact.email ?? "",
    phone: tenant.contact_phone ?? overrideContact.phone ?? "",
    location: tenant.location ?? overrideContact.location ?? "",
  };

  merged.footer = {
    ...templateFooter,
    ...overrideFooter,
  };

  if (!overrides.heroHeadline && !templateData.heroHeadline && tenant.name) {
    merged.heroHeadline = tenant.name;
  }

  const orgBio = overrides.orgBio ?? overrides.aboutSection?.description;
  if (orgBio !== undefined) {
    merged.aboutSection = {
      ...(overrides.aboutSection ?? {}),
      description: orgBio,
    };
  }

  return merged;
};

export default function App() {
  const baseData = useMemo(getSiteData, []);
  const { slug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [templateData, setTemplateData] = useState(null);
  const [publicProjects, setPublicProjects] = useState([]);
  const selectedTemplateKey = useMemo(
    () => normalizeTenantTemplateKey(tenant?.site_data?.templateKey ?? tenant?.site_data?.template_key ?? ""),
    [tenant?.site_data?.templateKey, tenant?.site_data?.template_key]
  );

  useEffect(() => {
    let active = true;
    if (!slug) {
      setTenant(null);
      setTemplateData(null);
      return () => {
        active = false;
      };
    }

    const loadTenant = async () => {
      const result = await getTenantBySlug(slug);
      if (active) {
        setTenant(result);
      }
    };

    loadTenant();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    if (!slug || !tenant) {
      setTemplateData(null);
      return () => {
        active = false;
      };
    }
    const templateKey = selectedTemplateKey;
    if (!templateKey) {
      setTemplateData(null);
      return () => {
        active = false;
      };
    }

    const loadTemplate = async () => {
      const result = await getTenantSiteTemplate(templateKey);
      if (active) {
        setTemplateData(result);
      }
    };

    loadTemplate();
    return () => {
      active = false;
    };
  }, [selectedTemplateKey]);

  useEffect(() => {
    let active = true;
    const tenantId = tenant?.id;
    if (!tenantId) {
      setPublicProjects([]);
      return () => {
        active = false;
      };
    }

    const loadPublicProjects = async () => {
      const rows = await getPublicTenantProjects(tenantId, { limit: 8 });
      if (active) {
        setPublicProjects(Array.isArray(rows) ? rows : []);
      }
    };

    loadPublicProjects();
    return () => {
      active = false;
    };
  }, [tenant?.id]);

  const mergedData = useMemo(
    () => mergeTenantData(baseData, tenant, templateData),
    [baseData, tenant, templateData]
  );
  const data = useMemo(
    () =>
      applyTenantTemplateDataDefaults({
        data: mergedData,
        templateKey: selectedTemplateKey,
        tenantSiteData: tenant?.site_data,
        publicProjects,
      }),
    [mergedData, selectedTemplateKey, tenant?.site_data, publicProjects]
  );
  const siteShell = useMemo(
    () => resolveTenantSiteShell({ templateKey: selectedTemplateKey }),
    [selectedTemplateKey]
  );
  const tenantTheme = useMemo(() => {
    if (!tenant) {
      return buildTenantThemeVars(tenant, baseData);
    }
    return buildTenantThemeVars({ ...tenant, site_data: data }, baseData);
  }, [tenant, data, baseData]);
  const tenantBrand = useMemo(() => buildTenantBrand(tenant, baseData), [tenant, baseData]);

  return (
    <div className={`app-shell tenant-site-shell tenant-site-shell--${siteShell}`} style={tenantTheme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TenantHeader
        data={data}
        tenant={{ ...tenant, ...tenantBrand }}
        anchorBase={slug ? `/tenant/${slug}` : "/tenant"}
      />
      <main id="main" className={`page-body tenant-site-body tenant-site-body--${siteShell}`}>
        <TenantSiteShell data={data} shell={siteShell} />
      </main>
      <TenantFooter data={data} tenant={{ ...tenant, ...tenantBrand }} />
    </div>
  );
}
