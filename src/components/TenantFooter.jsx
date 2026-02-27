import { Icon } from "./icons.jsx";

export default function TenantFooter({ data, tenant }) {
  const footer = data?.footer ?? {};
  const contact = data?.contact ?? {};
  const links = footer.quickLinks?.length
    ? footer.quickLinks
    : data?.tenantNav ?? data?.nav ?? [];
  const socialLinks = data?.socialLinks?.length
    ? data.socialLinks
    : [
        { label: "X", href: "#", icon: "x" },
        { label: "YouTube", href: "#", icon: "youtube" },
        { label: "LinkedIn", href: "#", icon: "linkedin" },
        { label: "Instagram", href: "#", icon: "instagram" },
        { label: "Facebook", href: "#", icon: "facebook" },
      ];
  const orgName = tenant?.name || data?.orgName || "Tenant";
  const logoUrl = tenant?.logo_url || tenant?.logoUrl || data?.logoUrl || "/assets/logo.png";
  const blurb = footer.blurb ?? data?.footerNote ?? "";
  const year = data?.year ?? new Date().getFullYear();
  const sanitizePhoneForTel = (value) => String(value || "").replace(/[^\d+]/g, "");
  const phoneHref = data?.phoneHref || (contact.phone ? `tel:${sanitizePhoneForTel(contact.phone)}` : "#contact");
  const phoneText = contact.phone || "";
  const emailText = contact.email || "";
  const rawTenantCta = data?.tenantCta ?? null;
  const ctaLabel = String(rawTenantCta?.label || "").trim();
  const ctaHref = String(rawTenantCta?.href || "").trim();
  const ctaLabelKey = ctaLabel.toLowerCase();
  const isLoginCta =
    ctaLabelKey.includes("login") ||
    ctaLabelKey.includes("member") ||
    ctaHref === "/login" ||
    ctaHref.endsWith("/login");
  const cta = isLoginCta
    ? {
        label: String(footer?.publicCtaLabel || "Donate").trim() || "Donate",
        href: String(footer?.publicCtaHref || "#contact").trim() || "#contact",
      }
    : {
        label: ctaLabel || "Donate",
        href: ctaHref || "#contact",
      };
  const legal = footer.legal ?? `© ${year} ${orgName} Foundation | All Rights Reserved`;
  const privacyHref = footer?.privacyHref || "/privacy-policy";
  const termsHref = footer?.termsHref || "/terms-of-service";

  return (
    <footer className="site-footer tenant-footer tenant-footer-minimal" id="footer">
      <div className="container tenant-footer-shell">
        <div className="tenant-footer-top-row">
          <a className="tenant-footer-donate-btn" href={cta.href}>
            {cta.label}
          </a>
        </div>

        <div className="tenant-footer-main-grid">
          <div className="tenant-footer-brand-block">
            <a className="tenant-footer-brand-inline" href="#top">
              <img src={logoUrl} alt={`${orgName} logo`} width="44" height="44" />
              <span>{orgName}</span>
            </a>
            {blurb ? <p className="tenant-footer-blurb">{blurb}</p> : null}
            <div className="tenant-footer-socials">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                >
                  <Icon name={item.icon} size={14} />
                </a>
              ))}
            </div>
          </div>

          <div className="tenant-footer-links-block">
            <h3>{footer.quickLinksTitle ?? "Quick Links"}</h3>
            <ul>
              {links.map((item) => (
                <li key={item.label}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="tenant-footer-contact-block">
            <h3>{footer.contactTitle ?? "Contact Us"}</h3>
            {emailText ? (
              <a className="tenant-footer-contact-action" href={`mailto:${emailText}`}>
                <span className="tenant-footer-contact-icon">
                  <Icon name="mail" size={13} />
                </span>
                <span>Send Email</span>
              </a>
            ) : null}
            {phoneText ? (
              <a className="tenant-footer-contact-action" href={phoneHref}>
                <span className="tenant-footer-contact-icon">
                  <Icon name="phone" size={13} />
                </span>
                <span>Make a call</span>
              </a>
            ) : null}
          </div>
        </div>

        <div className="tenant-footer-bottom-row">
          <p className="tenant-footer-legal">{legal}</p>
          <p className="tenant-footer-policy-links">
            <a href={privacyHref}>Privacy Policy</a>
            <span>|</span>
            <a href={termsHref}>Terms of Service</a>
          </p>
          <a className="tenant-footer-back-top" href="#top">
            <span>Back to top</span>
            <span className="tenant-footer-back-icon">
              <Icon name="arrow-right" size={13} />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}
