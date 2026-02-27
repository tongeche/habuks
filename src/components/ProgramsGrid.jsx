import { Icon } from "./icons.jsx";

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

const toText = (value) => String(value || "").trim();

const clampWords = (value, maxWords = 20) => {
  const source = toText(value);
  if (!source) return "";
  const words = source.split(/\s+/);
  if (words.length <= maxWords) return source;
  return `${words.slice(0, maxWords).join(" ")}…`;
};

const resolveProgramIcon = (item = {}) => {
  const source = `${toText(item?.tag)} ${toText(item?.title)} ${toText(item?.description)}`.toLowerCase();
  if (source.includes("food") || source.includes("hunger") || source.includes("nutrition")) return "heart";
  if (source.includes("health") || source.includes("medical") || source.includes("treatment")) return "check-circle";
  if (source.includes("transport") || source.includes("logistics") || source.includes("delivery")) return "truck";
  if (source.includes("training") || source.includes("education") || source.includes("youth")) return "users";
  if (source.includes("agri") || source.includes("farm")) return "layers";
  return "target";
};

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
  const visibleItems = items.slice(0, 5);
  const promoTitle = toText(section.promoTitle) || "Contribute Today To Make A Difference";
  const promoDescription =
    toText(section.promoDescription) ||
    toText(data?.ctaBanner?.description) ||
    "Your contribution makes change possible today.";
  const promoAction = data?.tenantCta ?? data?.ctaBanner?.cta ?? { label: "Join us now", href: "#contact" };
  const promoImage =
    toText(section?.promoImage?.src || section?.promoImage) ||
    toText(data?.heroBackgroundImage || data?.heroImages?.[0]?.src || visibleItems[0]?.image?.src);
  const promoStyle = promoImage
    ? {
        backgroundImage: `linear-gradient(160deg, rgba(6, 25, 43, 0.82), rgba(13, 56, 52, 0.56)), url("${promoImage.replace(
          /"/g,
          '\\"'
        )}")`,
      }
    : undefined;

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
        {visibleItems.map((item, index) => {
          const image = item.image ?? {};
          const cta = item.cta ?? {};
          const summary = clampWords(item.description || item.overview || item.detail || item.highlights?.[0], 20);
          const iconName = resolveProgramIcon(item);

          return (
            <article className="program-card program-card--inspire" key={`${item.title}-${index}`}>
              <div className="program-card-media">
                {image?.src ? (
                  <img src={image.src} alt={image.alt ?? item.title ?? "Program"} loading="lazy" />
                ) : (
                  <div className="program-card-media-placeholder" aria-hidden="true"></div>
                )}
                <span className="program-card-badge" aria-hidden="true">
                  <Icon name={iconName} size={16} />
                </span>
              </div>

              <div className="program-card-content">
                {item.title ? <h3>{item.title}</h3> : null}
                {summary ? <p className="program-description">{summary}</p> : null}
                {item.tag ? <p className="program-card-meta">{item.tag}</p> : null}
              </div>

              {cta?.label ? (
                <a className="program-card-link" href={cta.href ?? "#"}>
                  {cta.label}
                </a>
              ) : null}
            </article>
          );
        })}

        <article className="program-card program-card--promo">
          <div className="program-card-promo-surface" style={promoStyle}>
            <h3>{promoTitle}</h3>
            {promoDescription ? <p>{clampWords(promoDescription, 24)}</p> : null}
            {promoAction?.label ? (
              <a className="program-promo-btn" href={promoAction?.href ?? "#contact"}>
                {promoAction.label}
              </a>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
