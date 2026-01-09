import { Icon } from "./icons.jsx";

export default function AboutSection({ data }) {
  const about = data?.aboutSection ?? {};
  const cards = Array.isArray(about.cards) ? about.cards : [];
  const stats = about.stats ?? {};
  const image = about.image ?? {};

  return (
    <section className="about" id={about.id ?? "about"}>
      <div className="container about-grid">
        <div className="about-content">
          {about.kicker ? <p className="about-kicker">{about.kicker}</p> : null}
          {about.title ? <h2>{about.title}</h2> : null}
          {about.description ? <p className="about-description">{about.description}</p> : null}

          {cards.length ? (
            <div className="about-cards">
              {cards.map((card) => (
                <div className="about-card" key={card.title}>
                  <span className="about-card-icon" aria-hidden="true">
                    <Icon name={card.icon} size={18} />
                  </span>
                  <span className="about-card-title">{card.title}</span>
                </div>
              ))}
            </div>
          ) : null}

          {stats.label ? (
            <div className="about-stats">
              <div className="about-avatars">
                {stats.avatars?.map((avatar, index) => (
                  <img
                    key={`${avatar.src}-${index}`}
                    src={avatar.src}
                    alt={avatar.alt ?? ""}
                    loading="lazy"
                  />
                ))}
              </div>
              <div>
                <p className="about-stat-value">{stats.value}</p>
                <p className="about-stat-label">{stats.label}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="about-media">
          {image.src ? (
            <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
          ) : (
            <div className="about-image-placeholder" aria-hidden="true"></div>
          )}
        </div>
      </div>
    </section>
  );
}
