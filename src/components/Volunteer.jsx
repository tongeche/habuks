import { Icon } from "./icons.jsx";

export default function Volunteer({ data }) {
  const section = data?.volunteerSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const stats = Array.isArray(section.stats) ? section.stats : [];
  const image = section.image ?? {};
  const cta = section.cta ?? {};
  const id = section.id ?? "volunteer";
  const kicker = section.kicker ?? "";
  const title = section.title ?? "";
  const description = section.description ?? "";

  return (
    <section className="volunteer" id={id}>
      <div className="container">
        <div className="volunteer-card">
          <div className="volunteer-card-inner">
            <div className="volunteer-media">
              <span className="volunteer-dots volunteer-dots-top" aria-hidden="true"></span>
              {image.src ? (
                <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
              ) : (
                <div className="volunteer-image-placeholder" aria-hidden="true"></div>
              )}
            </div>

            <div className="volunteer-content">
              <span className="volunteer-dots volunteer-dots-bottom" aria-hidden="true"></span>
              {kicker ? <p className="volunteer-kicker">{kicker}</p> : null}
              {title ? <h2>{title}</h2> : null}
              {description ? <p className="volunteer-description">{description}</p> : null}

              <div className="volunteer-items">
                {items.map((item) => (
                  <div className="volunteer-item" key={item.title}>
                    <span className="volunteer-icon" aria-hidden="true">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {cta.label ? (
                <div className="volunteer-actions">
                  <a className="btn btn-accent" href={cta.href}>
                    {cta.label}
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {stats.length ? (
        <div className="volunteer-stats">
          <span className="volunteer-mark" aria-hidden="true"></span>
          <div className="container stats-grid">
            {stats.map((stat) => (
              <div className="stat" key={stat.label}>
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
                <span className="stat-line" aria-hidden="true"></span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
