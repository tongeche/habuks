export default function Highlight({ data }) {
  const highlight = data?.highlight ?? {};
  const items = highlight.items?.length
    ? highlight.items
    : data?.about?.values ?? [];
  const sectionId = highlight.id ?? "highlights";
  const image = highlight.image ?? {};
  const badge = highlight.badge ?? {};
  const cta = highlight.cta ?? {};
  const kicker = highlight.kicker ?? "";
  const title = highlight.title ?? "";
  const description = highlight.description ?? "";

  return (
    <section className="highlight" id={sectionId}>
      <div className="container highlight-grid">
        <div className="highlight-media">
          <div className="highlight-pattern" aria-hidden="true"></div>
          {image.src ? (
            <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
          ) : (
            <div className="highlight-placeholder" aria-hidden="true"></div>
          )}
          {badge.number || badge.label ? (
            <div className="highlight-badge">
              {badge.number ? <span className="badge-number">{badge.number}</span> : null}
              {badge.label ? <span className="badge-label">{badge.label}</span> : null}
            </div>
          ) : null}
        </div>

        <div className="highlight-content">
          {kicker ? <p className="highlight-kicker">{kicker}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {description ? <p className="highlight-description">{description}</p> : null}

          {items.length ? (
            <div className="highlight-list">
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {cta.label ? (
            <div className="highlight-actions">
              <a className="btn btn-primary" href={cta.href}>
                {cta.label}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
