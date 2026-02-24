import { Icon } from "./icons.jsx";

export default function AdvantageSection({ data }) {
  const section = data?.advantageSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const id = section.id ?? "advantage";
  const image = section.image ?? {};

  if (!section.title && !section.description && !items.length) {
    return null;
  }

  return (
    <section className="advantage-section" id={id} data-animate="fade-up">
      <div className="container advantage-inner">
        <div className="advantage-header">
          {section.kicker ? <p className="advantage-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
        </div>

        <div className="advantage-grid">
          <div className="advantage-media">
            {image.src ? (
              <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
            ) : (
              <div className="advantage-media-placeholder" aria-hidden="true" />
            )}
          </div>

          <div className="advantage-cards">
            {items.map((item) => (
              <div className="advantage-card" key={item.title}>
                <div className="advantage-icon" aria-hidden="true">
                  {item.icon ? <Icon name={item.icon} size={18} /> : null}
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
