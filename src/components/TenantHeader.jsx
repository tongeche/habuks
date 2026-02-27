import { useState } from "react";
import { Icon } from "./icons.jsx";

export default function TenantHeader({ data, tenant, anchorBase = "/tenant" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const orgName = tenant?.name || data?.orgName || "Tenant";
  const orgTagline = tenant?.tagline || data?.orgTagline || "";
  const logoUrl = tenant?.logo_url || tenant?.logoUrl || data?.logoUrl || "/assets/logo.png";
  const navItems = data?.tenantNav?.length ? data.tenantNav : data?.nav ?? [];
  const cta = data?.tenantCta ?? { label: "Donate", href: "#contact" };
  const contactPhone = tenant?.contact_phone || data?.contact?.phone || "";
  const menuLabel = data?.header?.menuLabel ?? "Menu";

  const resolveHref = (href) => {
    if (!href) return "#";
    if (href.startsWith("#")) {
      return `${anchorBase}${href}`;
    }
    return href;
  };

  const sanitizePhoneForTel = (value) => String(value || "").replace(/[^\d+]/g, "");
  const contactHref = contactPhone ? `tel:${sanitizePhoneForTel(contactPhone)}` : resolveHref("#contact");
  const headerLogoBackground = logoUrl ? `url("${String(logoUrl).replace(/"/g, '\\"')}")` : "none";
  const handleToggle = () => setMenuOpen((open) => !open);
  const handleNavClick = () => setMenuOpen(false);

  return (
    <header className="site-header tenant-header" id="top">
      <div className="main-bar tenant-main-bar" style={{ "--tenant-header-logo": headerLogoBackground }}>
        <div className="container main-bar-inner tenant-main-bar-inner">
          <a className="brand tenant-brand" href={resolveHref("#top")}>
            <img
              className="tenant-brand-logo"
              src={logoUrl}
              alt={`${orgName} logo`}
              width="44"
              height="44"
            />
            <div className="tenant-brand-copy">
              <span className="brand-name">{orgName}</span>
              <span className="brand-tagline">{orgTagline}</span>
            </div>
          </a>

          <button
            className="menu-toggle tenant-menu-toggle"
            type="button"
            onClick={handleToggle}
            aria-expanded={menuOpen}
            aria-controls="tenant-navigation"
          >
            <Icon name="menu" size={20} />
            <span>{menuLabel}</span>
          </button>

          <nav
            id="tenant-navigation"
            className={`main-nav tenant-main-nav${menuOpen ? " is-open" : ""}`}
            aria-label="Tenant"
          >
            <ul>
              {navItems.map((item) => (
                <li key={item.label}>
                  <a href={resolveHref(item.href)} onClick={handleNavClick}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="tenant-header-actions">
            <a
              className="tenant-contact-cta"
              href={contactHref}
              aria-label={contactPhone ? `Call ${orgName}` : "Go to contact section"}
              title={contactPhone || "Contact organization"}
            >
              <Icon name="phone" size={17} />
            </a>
            <a className="tenant-cta tenant-donate-cta" href={resolveHref(cta.href)}>
              {cta.label}
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
