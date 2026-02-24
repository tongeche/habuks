const mapFallbackPrograms = (projects) =>
  projects.map((project) => ({
    title: project.name ?? project.code ?? "Program",
    description: project.overview ?? project.detail ?? "",
    tag: project.type ?? "Program",
    status: project.status ?? "",
    highlights: Array.isArray(project.focus)
      ? project.focus
      : Array.isArray(project.objectives)
        ? project.objectives
        : Array.isArray(project.impact)
          ? project.impact
          : [],
    cta: project.cta ?? null,
    image: project.image ?? null,
  }));

export default function ProgramsGrid({ data }) {
  const section = data?.programsSection ?? {};
  const id = section.id ?? "programs";
  const kicker = section.kicker ?? "";
  const title = section.title ?? "";
  const description = section.description ?? "";

  const fallbackProjects = Array.isArray(data?.projects) ? data.projects : [];
  const items = Array.isArray(section.items) && section.items.length
    ? section.items
    : fallbackProjects.length
      ? mapFallbackPrograms(fallbackProjects)
      : [];

  if (!items.length && !title && !description) {
    return null;
  }

  return (
    <section className="programs" id={id}>
      <div className="container programs-header">
        {kicker ? <p className="programs-kicker">{kicker}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <p className="programs-description">{description}</p> : null}
      </div>

      <div className="container programs-grid">
        {items.map((item, index) => {
          const highlights = Array.isArray(item.highlights) ? item.highlights : [];
          const image = item.image ?? {};
          const cta = item.cta ?? {};

          return (
            <article className="program-card" key={`${item.title}-${index}`}>
              <div className="program-card-top">
                {item.tag ? <span className="program-tag">{item.tag}</span> : null}
                {item.status ? <span className="program-status">{item.status}</span> : null}
              </div>

              {item.title ? <h3>{item.title}</h3> : null}
              {item.description ? <p className="program-description">{item.description}</p> : null}

              {image?.src ? (
                <div className="program-image">
                  <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                </div>
              ) : null}

              {highlights.length ? (
                <ul className="program-highlights">
                  {highlights.slice(0, 3).map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}

              {cta?.label ? (
                <a className="btn btn-dark" href={cta.href ?? "#"}>
                  {cta.label}
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
