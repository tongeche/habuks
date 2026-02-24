import { Icon } from "./icons.jsx";

export default function SiteFooter({ data, anchorBase = "/" }) {
  const footer = data?.footer ?? {};
  const contact = data?.contact ?? {};
  const links = footer.quickLinks?.length ? footer.quickLinks : data?.nav ?? [];
  const socialLinks = data?.socialLinks ?? [];
  const orgName = data?.orgName ?? "Jongol Foundation";
  const logoUrl = data?.logoUrl || "/assets/logo.png";
  const blurb = footer.blurb ?? data?.footerNote ?? "";
  const year = data?.year ?? new Date().getFullYear();
  const phoneHref = data?.phoneHref || "";
  const phoneText = contact.phone || "";
  const phoneIsPlaceholder = data?.phoneIsPlaceholder ?? !phoneText;
  const locationText = contact.location || "";
  const emailText = contact.email || "";
  const columns = Array.isArray(footer.columns) ? footer.columns : [];
  const legalLinks = Array.isArray(footer.legalLinks) ? footer.legalLinks : [];
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

  if (columns.length) {
    return (
      <footer className="site-footer footer--modern" id="contact">
        <div className="container footer-columns">
          {columns.map((column) => (
            <div className="footer-column footer-column--groups" key={column.title}>
              <h3>{column.title}</h3>
              {column.links?.length ? (
                <ul>
                  {column.links.map((item) => (
                    <li key={`${column.title}-${item.label}`}>
                      <a href={resolveHref(item.href)}>{item.label}</a>
                    </li>
                  ))}
                </ul>
              ) : (
                (column.groups || []).map((group) => (
                  <div className="footer-group" key={`${column.title}-${group.title}`}>
                    {group.title ? (
                      <p className="footer-group-title">{group.title}</p>
                    ) : null}
                    <ul>
                      {(group.links || []).map((item) => (
                        <li key={`${group.title}-${item.label}`}>
                          <a href={resolveHref(item.href)}>{item.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        <div className="footer-wave" aria-hidden="true"></div>

        <div className="footer-bottom-bar">
          <div className="container footer-bottom-top">
            <div className="footer-lang">
              <span className="footer-lang-icon" aria-hidden="true">
                <Icon name="globe" size={16} />
              </span>
              English
            </div>
            {socialLinks.length ? (
              <div className="footer-socials">
                {socialLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    aria-label={item.label}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name={item.icon} size={18} />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="container footer-bottom-inner">
            <p>{footer.legal ?? `${orgName}.`}</p>
            {legalLinks.length ? (
              <div className="footer-bottom-links">
                {legalLinks.map((item) => (
                  <a key={item.label} href={resolveHref(item.href)}>
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
            <p>{year}</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="site-footer" id="contact">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={logoUrl} alt={`${orgName} logo`} width="52" height="52" />
          <div>
            <p className="footer-name">{orgName}</p>
            <p className="footer-blurb">{blurb}</p>
          </div>
        </div>

        <div className="footer-column">
          <h3>{footer.quickLinksTitle ?? "Quick Links"}</h3>
          <ul>
            {links.map((item) => (
              <li key={item.label}>
                <a href={resolveHref(item.href)}>{item.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-column">
          <h3>{footer.contactTitle ?? "Contact"}</h3>
          <ul className="footer-contact">
            {locationText ? (
              <li>
                <span>Location:</span>
                <span>{locationText}</span>
              </li>
            ) : null}
            {phoneText ? (
              <li>
                <span>Phone:</span>
                {phoneIsPlaceholder ? (
                  <span>{phoneText}</span>
                ) : (
                  <a href={phoneHref}>{phoneText}</a>
                )}
              </li>
            ) : null}
            {emailText ? (
              <li>
                <span>Email:</span>
                <a href={`mailto:${emailText}`}>{emailText}</a>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="footer-column">
          <h3>{footer.socialTitle ?? "Follow Us"}</h3>
          <div className="footer-socials">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={resolveHref(item.href)}
                aria-label={item.label}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name={item.icon} size={18} />
              </a>
            ))}
          </div>
          {/* Customer sign-in styled link */}
          <div className="footer-member-auth" style={{ marginTop: '1rem', textAlign: 'center' }}>
            <a href="/login" className="footer-auth-link" style={{
              display: 'inline-block',
              padding: '0.5em 1.5em',
              background: '#2d7a46',
              color: '#fff',
              borderRadius: '24px',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#256437'}
            onMouseOut={e => e.currentTarget.style.background = '#2d7a46'}
            >
              Sign In
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>{footer.legal ?? `${orgName}.`}</p>
          <p>{year}</p>
        </div>
      </div>
    </footer>
  );
}
