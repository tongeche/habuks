export default function ResourcesSection({ data }) {
  const section = data?.resourcesSection ?? {};
  const featured = section.featured ?? null;
  const items = Array.isArray(section.items) ? section.items : [];
  const id = section.id ?? "resources";

  if (!section.title && !section.description && !featured && !items.length) {
    return null;
  }

  return (
    <section className="resources" id={id} data-animate="fade-up">
      <div className="container">
        <div className="resources-header">
          {section.kicker ? <p className="resources-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
        </div>

        <div className="resources-grid">
          {featured ? (
            <article className="resource-card resource-card--featured">
              {featured.image?.src ? (
                <div className="resource-media">
                  <img src={featured.image.src} alt={featured.image.alt ?? ""} loading="lazy" />
                </div>
              ) : null}
              <div className="resource-body">
                {featured.title ? <h3>{featured.title}</h3> : null}
                {featured.description ? <p>{featured.description}</p> : null}
                {featured.author ? (
                  <div className="resource-meta">
                    {featured.author.avatar ? (
                      <img
                        className="resource-avatar"
                        src={featured.author.avatar}
                        alt={featured.author.name ?? ""}
                      />
                    ) : null}
                    <div>
                      {featured.author.name ? (
                        <p className="resource-author">{featured.author.name}</p>
                      ) : null}
                      {(featured.author.date || featured.author.readTime) ? (
                        <p className="resource-submeta">
                          {featured.author.date ?? ""}
                          {featured.author.date && featured.author.readTime ? " · " : ""}
                          {featured.author.readTime ?? ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          {items.length ? (
            <div className="resource-stack">
              {items.map((item, index) => (
                <article className="resource-card resource-card--compact" key={`${item.title}-${index}`}>
                  {item.image?.src ? (
                    <div className="resource-media">
                      <img src={item.image.src} alt={item.image.alt ?? ""} loading="lazy" />
                    </div>
                  ) : null}
                  <div className="resource-body">
                    {item.title ? <h3>{item.title}</h3> : null}
                    {item.description ? <p>{item.description}</p> : null}
                    {item.author ? (
                      <div className="resource-meta">
                        {item.author.avatar ? (
                          <img
                            className="resource-avatar"
                            src={item.author.avatar}
                            alt={item.author.name ?? ""}
                          />
                        ) : null}
                        <div>
                          {item.author.name ? (
                            <p className="resource-author">{item.author.name}</p>
                          ) : null}
                          {(item.author.date || item.author.readTime) ? (
                            <p className="resource-submeta">
                              {item.author.date ?? ""}
                              {item.author.date && item.author.readTime ? " · " : ""}
                              {item.author.readTime ?? ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
