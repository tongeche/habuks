export default function FaqSection({ data }) {
  const section = data?.faqSection ?? {};
  const resources = Array.isArray(section.resources) ? section.resources : [];
  const popular = Array.isArray(section.popular)
    ? section.popular
    : Array.isArray(section.items)
      ? section.items
      : [];
  const popularLimit = Number.isFinite(section.popularLimit) ? section.popularLimit : 6;
  const popularList = popular.slice(0, popularLimit);
  const cta = section.cta ?? {};
  const id = section.id ?? "faq";

  const slugify = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  if (!section.title && !section.description && !resources.length && !popular.length && !cta.title) {
    return null;
  }

  return (
    <section className="faq" id={id} data-animate="fade-up">
      <div className="container">
        <div className="faq-header">
          {section.kicker ? <p className="faq-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
        </div>

        {resources.length ? (
          <div className="faq-resources">
            {resources.map((resource, index) => (
              <a
                className="faq-resource-card"
                href={resource.href ?? `/support?category=${resource.slug ?? slugify(resource.title)}`}
                key={`${resource.title}-${index}`}
              >
                {resource.image?.src ? (
                  <div className="faq-resource-media">
                    <img src={resource.image.src} alt={resource.image.alt ?? ""} loading="lazy" />
                  </div>
                ) : null}
                <div className="faq-resource-body">
                  {resource.title ? <h3>{resource.title}</h3> : null}
                  {resource.description ? <p>{resource.description}</p> : null}
                </div>
              </a>
            ))}
          </div>
        ) : null}

        {popularList.length ? (
          <div className="faq-popular">
            <p className="faq-popular-label">{section.popularLabel ?? "POPULAR"}</p>
            <div className="faq-popular-grid">
              {popularList.map((item, index) => {
                const label = item.question ?? item.title ?? item;
                const slug = item.slug ?? slugify(label);
                const href = item.href ?? `/support?q=${slug}`;
                return (
                  <a className="faq-popular-item" href={href} key={`${label}-${index}`}>
                    <span>{label}</span>
                    <span className="faq-popular-arrow" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M7 17l10-10M9 7h8v8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {cta.title ? (
          <div className="faq-cta">
            <div>
              <h3>{cta.title}</h3>
              {cta.description ? <p>{cta.description}</p> : null}
            </div>
            {cta.button?.label ? (
              <a className="faq-cta-button" href={cta.button.href ?? "#"}>
                {cta.button.label}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
