export default function StatsFeatureSection({ data }) {
  const section = data?.security ?? {};
  const cards = Array.isArray(section.cards) ? section.cards : [];
  const id = section.id ?? "security";

  if (!section.title && !section.description && !cards.length) {
    return null;
  }

  return (
    <section className="stats-feature" id={id} data-animate="fade-up">
      <div className="container stats-feature-header">
        {section.kicker ? <p className="stats-kicker">{section.kicker}</p> : null}
        {section.title ? <h2>{section.title}</h2> : null}
        {section.description ? <p>{section.description}</p> : null}
      </div>

      <div className="container stats-feature-grid">
        {cards.map((card, index) => {
          const image = card.image ?? {};
          return (
            <article className="stats-feature-card" key={`${card.title}-${index}`}>
              <div className="stats-feature-content">
                {card.title ? <h3>{card.title}</h3> : null}
                {card.description ? <p>{card.description}</p> : null}
              </div>
              <div className="stats-feature-media">
                {image.src ? (
                  <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                ) : (
                  <div className="stats-feature-placeholder" aria-hidden="true"></div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
