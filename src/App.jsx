import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import TenantHeader from "./components/TenantHeader.jsx";
import TenantFooter from "./components/TenantFooter.jsx";
import Hero from "./components/Hero.jsx";
import ImpactStrip from "./components/ImpactStrip.jsx";
import ProgramsGrid from "./components/ProgramsGrid.jsx";
import ObjectivesBlock from "./components/ObjectivesBlock.jsx";
import TestimonialsSlider from "./components/TestimonialsSlider.jsx";
import CtaBanner from "./components/CtaBanner.jsx";
import ContactSection from "./components/ContactSection.jsx";
import { getTenantBySlug, getTenantSiteTemplate } from "./lib/dataService.js";
import { buildTenantBrand, buildTenantThemeVars } from "./lib/tenantBranding.js";

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

  merged.orgName = overrides.orgName ?? tenant.name ?? templateData.orgName ?? "";
  merged.orgTagline = overrides.orgTagline ?? tenant.tagline ?? templateData.orgTagline ?? "";
  merged.logoUrl = overrides.logoUrl ?? tenant.logo_url ?? templateData.logoUrl ?? "";

  merged.contact = {
    ...templateContact,
    ...overrideContact,
    email: tenant.contact_email ?? overrideContact.email ?? templateContact.email ?? "",
    phone: tenant.contact_phone ?? overrideContact.phone ?? templateContact.phone ?? "",
    location: tenant.location ?? overrideContact.location ?? templateContact.location ?? "",
  };

  merged.footer = {
    ...templateFooter,
    ...overrideFooter,
  };

  if (!overrides.heroHeadline && !templateData.heroHeadline && tenant.name) {
    merged.heroHeadline = tenant.name;
  }
  if (!overrides.heroIntro && !templateData.heroIntro && tenant.tagline) {
    merged.heroIntro = [tenant.tagline];
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
    const templateKey =
      tenant?.site_data?.templateKey ?? tenant?.site_data?.template_key ?? "";
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
  }, [tenant?.site_data?.templateKey, tenant?.site_data?.template_key]);

  const data = useMemo(
    () => mergeTenantData(baseData, tenant, templateData),
    [baseData, tenant, templateData]
  );
  const tenantTheme = useMemo(() => {
    if (!tenant) {
      return buildTenantThemeVars(tenant, baseData);
    }
    return buildTenantThemeVars({ ...tenant, site_data: data }, baseData);
  }, [tenant, data, baseData]);
  const tenantBrand = useMemo(() => buildTenantBrand(tenant, baseData), [tenant, baseData]);

  return (
    <div className="app-shell" style={tenantTheme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TenantHeader
        data={data}
        tenant={{ ...tenant, ...tenantBrand }}
        anchorBase={slug ? `/tenant/${slug}` : "/tenant"}
      />
      <main id="main" className="page-body">
        <Hero data={data} />
        <ImpactStrip data={data} />
        <ProgramsGrid data={data} />
        <ObjectivesBlock data={data} />
        <TestimonialsSlider data={data} />
        <CtaBanner data={data} />
        <ContactSection data={data} />
      </main>
      <TenantFooter data={data} tenant={{ ...tenant, ...tenantBrand }} />
    </div>
  );
}
