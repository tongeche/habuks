export default function ProfilesSection({ data }) {
  const section = data?.profilesSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const actions = Array.isArray(section.actions) ? section.actions : [];
  const layout = section.layout ?? "grid";
  const id = section.id ?? "profiles";

  if (!section.title && !section.description && !items.length) {
    return null;
  }

  return (
    <section
      className={`profiles-section${layout === "carousel" ? " is-carousel" : ""}`}
      id={id}
      data-animate="fade-up"
    >
      <div className="container profiles-inner">
        <div className="profiles-header">
          {section.kicker ? <p className="profiles-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
          {actions.length ? (
            <div className="profiles-actions">
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
          ) : null}
        </div>

        <div className="profiles-grid">
          {items.map((item, index) => {
            const image = item.image ?? {};
            return (
              <article className="profiles-card" key={`${item.title ?? "profile"}-${index}`}>
                <div className="profiles-card-body">
                  {item.title ? <h3>{item.title}</h3> : null}
                  {item.description ? <p>{item.description}</p> : null}
                </div>
                <div className="profiles-card-media">
                  {image.src ? (
                    <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                  ) : (
                    <div className="profiles-card-placeholder" aria-hidden="true"></div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
