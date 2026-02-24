export default function ContactSection({ data }) {
  const contact = data?.contact ?? {};
  const id = contact.id ?? "contact";
  const title = contact.title ?? "";
  const intro = contact.intro ?? "";
  const actions = Array.isArray(contact.actions) ? contact.actions : [];
  const email = contact.email ?? "";
  const phone = contact.phone ?? "";
  const location = contact.location ?? "";

  if (!title && !intro && !email && !phone && !location) {
    return null;
  }

  const phoneIsPlaceholder =
    data?.phoneIsPlaceholder ?? (!phone || String(phone).includes("Add"));
  const phoneHref = !phoneIsPlaceholder
    ? `tel:${String(phone).replace(/[^+\\d]/g, "")}`
    : "";

  const details = [
    location ? { label: "Location", value: location } : null,
    phone ? { label: "Phone", value: phone, href: phoneHref } : null,
    email ? { label: "Email", value: email, href: `mailto:${email}` } : null,
  ].filter(Boolean);

  return (
    <section className="contact-section" id={id}>
      <div className="container contact-grid">
        <div className="contact-copy">
          {contact.kicker ? <p className="contact-kicker">{contact.kicker}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {intro ? <p className="contact-intro">{intro}</p> : null}

          {details.length ? (
            <div className="contact-details">
              {details.map((item) => (
                <div className="contact-detail" key={item.label}>
                  <span className="contact-label">{item.label}</span>
                  {item.href ? (
                    <a href={item.href} className="contact-value">
                      {item.value}
                    </a>
                  ) : (
                    <span className="contact-value">{item.value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="contact-panel">
          <div className="contact-panel-inner">
            <h3>{contact.panelTitle ?? "Ready to collaborate?"}</h3>
            <p>{contact.panelDescription ?? "We respond within two business days."}</p>
            <div className="contact-actions">
              {actions.map((action) => (
                <a
                  key={action.label}
                  className={`btn ${action.style === "ghost" ? "btn-ghost" : "btn-primary"}`}
                  href={action.href ?? "#"}
                >
                  {action.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
