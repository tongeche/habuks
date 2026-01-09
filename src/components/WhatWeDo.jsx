export default function WhatWeDo({ data }) {
  const section = data?.whatWeDoSection ?? {};
  const items = Array.isArray(section.items) ? section.items : [];
  const id = section.id ?? "what-we-do";
  const kicker = section.kicker ?? "";
  const title = section.title ?? "";
  const description = section.description ?? "";

  if (!items.length && !title && !description) {
    return null;
  }

  return (
    <section className="what-we-do" id={id}>
      <div className="container what-header">
        {kicker ? <p className="what-kicker">{kicker}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <p className="what-description">{description}</p> : null}
      </div>

      <div className="container">
        <div className="what-list">
          {items.map((item, index) => {
            const image = item.image ?? {};
            const cta = item.cta ?? {};
            return (
              <article
                key={`${item.title}-${index}`}
                className={`what-card ${index % 2 === 1 ? "is-reversed" : ""}`}
              >
                <div className="what-image">
                  {image.src ? (
                    <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
                  ) : (
                    <div className="what-image-placeholder" aria-hidden="true"></div>
                  )}
                  <span className="what-image-line" aria-hidden="true"></span>
                </div>

                <div className="what-content">
                  {item.title ? <h3>{item.title}</h3> : null}
                  {item.description ? <p>{item.description}</p> : null}
                  {cta.label ? (
                    <a className="btn btn-dark" href={cta.href}>
                      {cta.label}
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
