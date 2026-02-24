import { Icon } from "./icons.jsx";

export default function TenantFooter({ data, tenant }) {
  const footer = data?.footer ?? {};
  const contact = data?.contact ?? {};
  const links = footer.quickLinks?.length
    ? footer.quickLinks
    : data?.tenantNav ?? data?.nav ?? [];
  const socialLinks = data?.socialLinks ?? [];
  const orgName = tenant?.name || data?.orgName || "Tenant";
  const logoUrl = tenant?.logo_url || tenant?.logoUrl || data?.logoUrl || "/assets/logo.png";
  const blurb = footer.blurb ?? data?.footerNote ?? "";
  const year = data?.year ?? new Date().getFullYear();
  const phoneHref = data?.phoneHref || "";
  const phoneText = contact.phone || "";
  const phoneIsPlaceholder = data?.phoneIsPlaceholder ?? !phoneText;
  const locationText = contact.location || "";
  const emailText = contact.email || "";
  const poweredBy = data?.poweredBy ?? "Powered by Habuks";

  return (
    <footer className="site-footer tenant-footer" id="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={logoUrl} alt={`${orgName} logo`} width="52" height="52" />
          <div>
            <p className="footer-name">{orgName}</p>
            <p className="footer-blurb">{blurb}</p>
            <p className="tenant-powered">{poweredBy}</p>
          </div>
        </div>

        <div className="footer-column">
          <h3>{footer.quickLinksTitle ?? "Quick Links"}</h3>
          <ul>
            {links.map((item) => (
              <li key={item.label}>
                <a href={item.href}>{item.label}</a>
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
                href={item.href}
                aria-label={item.label}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name={item.icon} size={18} />
              </a>
            ))}
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
