import { useState } from "react";
import { Icon } from "./icons.jsx";

export default function SiteHeader({ data, hideTopBar = false, anchorBase = "/", onNavClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const header = data?.header ?? {};
  const navItems = header.nav?.length ? header.nav : data?.nav ?? [];
  const emails = header.topEmails?.length
    ? header.topEmails
    : data?.contact?.email
      ? [data.contact.email]
      : [];
  const socialLinks = data?.socialLinks ?? [];
  const donate = header.donate ?? { label: "Donate", href: "#donate" };
  const headerActions = header.actions ?? {};
  const loginAction = headerActions.login;
  const primaryAction = headerActions.primary;
  const orgName = data?.orgName ?? "Jongol Foundation";
  const orgTagline = data?.orgTagline ?? "";
  const logoUrl = data?.logoUrl || "/assets/logo.png";
  const menuLabel = header.menuLabel ?? "Menu";
  const resolveHref = (href) => {
    if (!href) {
      return "#";
    }
    if (href.startsWith("#")) {
      if (!anchorBase) {
        return href;
      }
      return `${anchorBase}${href}`;
    }
    return href;
  };

  const handleToggle = () => {
    setMenuOpen((open) => !open);
  };

  const handleNavClick = (e, item) => {
    setMenuOpen(false);
    // Check if this is a pricing link and callback exists
    if (item.href === "#pricing" && onNavClick) {
      e.preventDefault();
      onNavClick();
    }
  };

  return (
    <header className="site-header" id="top">
      {!hideTopBar ? (
        <div className="top-bar">
          <div className="container top-bar-inner">
            <div className="top-contacts">
              {emails.map((email, index) => (
                <a className="top-link" href={`mailto:${email}`} key={`${email}-${index}`}>
                  <Icon name="mail" size={16} />
                  <span>{email}</span>
                </a>
              ))}
            </div>
            <div className="top-actions">
              <div className="social-links">
                {socialLinks.map((item) => (
                  <a
                    key={item.label}
                    className="social-link"
                    href={item.href}
                    aria-label={item.label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name={item.icon} size={16} />
                  </a>
                ))}
              </div>
              <a className="donate-btn" href={resolveHref(donate.href)}>
                {donate.label}
              </a>
            </div>
          </div>
        </div>
      ) : null}

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
            aria-controls="primary-navigation"
          >
            <Icon name="menu" size={20} />
            <span>{menuLabel}</span>
          </button>

          <nav
            id="primary-navigation"
            className={`main-nav${menuOpen ? " is-open" : ""}`}
            aria-label="Primary"
          >
            <ul>
              {navItems.map((item) => (
                <li key={item.label}>
                  <a href={resolveHref(item.href)} onClick={(e) => handleNavClick(e, item)}>
                    {item.label}
                    {item.hasDropdown ? <Icon name="chevron" size={14} /> : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {(loginAction || primaryAction) && (
            <div className="header-actions">
              {loginAction ? (
                <a className="header-login" href={resolveHref(loginAction.href)}>
                  {loginAction.label}
                </a>
              ) : null}
              {primaryAction ? (
                <a className="header-primary" href={resolveHref(primaryAction.href)}>
                  {primaryAction.label}
                </a>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
