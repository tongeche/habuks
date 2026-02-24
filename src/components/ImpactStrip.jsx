export default function ImpactStrip({ data }) {
  const section = data?.impactStrip ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const id = section.id ?? "impact";
  const kicker = section.kicker ?? "";
  const title = section.title ?? "";
  const description = section.description ?? "";

  if (!items.length && !title && !description) {
    return null;
  }

  return (
    <section className="impact-strip" id={id}>
      <div className="container impact-strip-inner">
        <div className="impact-strip-copy">
          {kicker ? <p className="impact-kicker">{kicker}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {description ? <p className="impact-description">{description}</p> : null}
        </div>

        <div className="impact-strip-grid">
          {items.map((item, index) => (
            <div className="impact-card" key={`${item.label}-${index}`}>
              {item.value ? <span className="impact-value">{item.value}</span> : null}
              {item.label ? <span className="impact-label">{item.label}</span> : null}
              {item.detail ? <span className="impact-detail">{item.detail}</span> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
