import { useState } from "react";
import { Icon } from "./icons.jsx";

export default function TenantHeader({ data, tenant, anchorBase = "/tenant" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const orgName = tenant?.name || data?.orgName || "Tenant";
  const orgTagline = tenant?.tagline || data?.orgTagline || "";
  const logoUrl = tenant?.logo_url || tenant?.logoUrl || data?.logoUrl || "/assets/logo.png";
  const navItems = data?.tenantNav?.length ? data.tenantNav : data?.nav ?? [];
  const cta = data?.tenantCta ?? { label: "Member Login", href: "/login" };
  const menuLabel = data?.header?.menuLabel ?? "Menu";

  const resolveHref = (href) => {
    if (!href) return "#";
    if (href.startsWith("#")) {
      return `${anchorBase}${href}`;
    }
    return href;
  };

  const handleToggle = () => setMenuOpen((open) => !open);
  const handleNavClick = () => setMenuOpen(false);

  return (
    <header className="site-header tenant-header" id="top">
      <div className="main-bar">
        <div className="container main-bar-inner">
          <a className="brand" href={resolveHref("#top")}>
            <img src={logoUrl} alt={`${orgName} logo`} width="56" height="56" />
            <div>
              <span className="brand-name">{orgName}</span>
              <span className="brand-tagline">{orgTagline}</span>
            </div>
          </a>

          <button
            className="menu-toggle"
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
            className={`main-nav${menuOpen ? " is-open" : ""}`}
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

          <a className="tenant-cta" href={resolveHref(cta.href)}>
            {cta.label}
          </a>
        </div>
      </div>
    </header>
  );
}
