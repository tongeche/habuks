import { Icon } from "./icons.jsx";

const toText = (value) => String(value || "").trim();

const uniqueList = (values) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((entry) => {
    const value = toText(entry);
    if (!value) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function ObjectivesBlock({ data }) {
  const section = data?.objectivesSection ?? {};
  const objectives = uniqueList(section.objectives);
  const goals = uniqueList(section.goals);
  const id = section.id ?? "objectives";
  const kicker = toText(section.kicker) || "Welcome, let's make a difference!";
  const title = toText(section.title) || "A Trusted Non-Profit Community Organization";
  const description =
    toText(section.description) ||
    "Our mission is to create measurable impact by supporting underserved communities with practical programs.";
  const image = section.image ?? {};
  const allPoints = uniqueList([...objectives, ...goals]);
  const listPoints = allPoints.length ? allPoints.slice(0, 3) : [description];
  const featureOne = objectives[0] || allPoints[0] || "Be a Hero";
  const featureTwo = goals[0] || allPoints[1] || "Help Communities";
  const ctaSource = section.cta ?? data?.tenantCta ?? data?.ctaBanner?.cta ?? {};
  const ctaLabel = toText(ctaSource.label) || "Support now";
  const ctaHref = toText(ctaSource.href) || "#contact";

  if (!objectives.length && !goals.length && !title && !description && !image?.src) {
    return null;
  }

  return (
    <section className="objectives objectives-showcase" id={id}>
      <div className="container objectives-showcase-shell">
        <div className="objectives-showcase-media-wrap">
          <span className="objectives-showcase-media-decor" aria-hidden="true"></span>
          <div className="objectives-showcase-media">
            {image.src ? (
              <img src={image.src} alt={image.alt ?? title} loading="lazy" />
            ) : (
              <div className="objectives-placeholder" aria-hidden="true"></div>
            )}
          </div>
        </div>

        <div className="objectives-showcase-content">
          {kicker ? <p className="objectives-showcase-kicker">{kicker}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {description ? <p className="objectives-showcase-description">{description}</p> : null}

          <div className="objectives-showcase-features">
            <article className="objectives-showcase-feature">
              <span className="objectives-showcase-feature-icon is-heart" aria-hidden="true">
                <Icon name="heart" size={13} />
              </span>
              <div>
                <strong>{section.objectivesTitle ?? "Be a Hero"}</strong>
                <p>{featureOne}</p>
              </div>
            </article>
            <article className="objectives-showcase-feature">
              <span className="objectives-showcase-feature-icon is-target" aria-hidden="true">
                <Icon name="target" size={13} />
              </span>
              <div>
                <strong>{section.goalsTitle ?? "Help Communities"}</strong>
                <p>{featureTwo}</p>
              </div>
            </article>
          </div>

          <ul className="objectives-showcase-list">
            {listPoints.map((item) => (
              <li key={item}>
                <Icon name="check" size={12} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <a className="objectives-showcase-cta" href={ctaHref}>
            {ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
