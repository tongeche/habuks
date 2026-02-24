export default function ObjectivesBlock({ data }) {
  const section = data?.objectivesSection ?? {};
  const objectives = Array.isArray(section.objectives) ? section.objectives : [];
  const goals = Array.isArray(section.goals) ? section.goals : [];
  const id = section.id ?? "objectives";
  const kicker = section.kicker ?? "";
  const title = section.title ?? "";
  const description = section.description ?? "";
  const image = section.image ?? {};

  if (!objectives.length && !goals.length && !title && !description) {
    return null;
  }

  return (
    <section className="objectives" id={id}>
      <div className="container objectives-header">
        {kicker ? <p className="objectives-kicker">{kicker}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <p className="objectives-description">{description}</p> : null}
      </div>

      <div className="container objectives-grid">
        <div className="objectives-columns">
          <div className="objectives-card">
            <h3>{section.objectivesTitle ?? "Objectives"}</h3>
            {objectives.length ? (
              <ul className="objectives-list">
                {objectives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="objectives-card">
            <h3>{section.goalsTitle ?? "Goals"}</h3>
            {goals.length ? (
              <ul className="objectives-list">
                {goals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="objectives-media">
          {image.src ? (
            <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
          ) : (
            <div className="objectives-placeholder" aria-hidden="true"></div>
          )}
        </div>
      </div>
    </section>
  );
}
