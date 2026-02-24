import { Icon } from "./icons.jsx";

export function BenefitsSection({ data }) {
  const section = data?.benefitsSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const centerImage = section.centerImage ?? {};
  const imageTags = Array.isArray(section.imageTags) ? section.imageTags : [];
  const layout = section.layout ?? (centerImage.src ? "image" : "cards");
  const actions = Array.isArray(section.actions) ? section.actions : [];
  const id = section.id ?? "benefits";

  if (!section.title && !section.description && !items.length && !centerImage.src) {
    return null;
  }

  return (
    <section className="benefits-section" id={id} data-layout={layout} data-animate="fade-up">
      <div className="container benefits-inner">
        <div className="benefits-header">
          {section.kicker ? <p className="benefits-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
          {actions.length ? (
            <div className="benefits-actions">
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

        {layout === "image" ? (
          <div className="benefits-image">
            <div className="benefits-image-shell">
              {centerImage.src ? (
                <img src={centerImage.src} alt={centerImage.alt ?? ""} loading="lazy" />
              ) : (
                <div className="benefits-image-placeholder" aria-hidden="true"></div>
              )}
              {imageTags.map((tag, index) => (
                <span
                  key={`${tag.label}-${index}`}
                  className={`benefits-image-tag is-${tag.position ?? "left-top"}`}
                >
                  {tag.icon ? (
                    <span className="benefits-image-tag-icon" aria-hidden="true">
                      <Icon name={tag.icon} size={14} />
                    </span>
                  ) : null}
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="benefits-grid">
            {items.map((item, index) => {
              const image = item.image ?? {};
              const heading = item.title ?? item.value;
              const summary = item.description ?? item.source;
              return (
                <article className="benefit-card" key={`${item.title ?? "feature"}-${index}`}>
                  <div className="benefit-card-body">
                    {heading ? <h3>{heading}</h3> : null}
                    {summary ? <p>{summary}</p> : null}
                  </div>
                  <div className="benefit-card-media">
                    {image.src ? (
                      <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                    ) : (
                      <div className="benefit-card-placeholder" aria-hidden="true"></div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default BenefitsSection;
