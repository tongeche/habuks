import { Icon } from "./icons.jsx";

export default function HostedSiteSection({ data }) {
  const section = data?.hostedSiteSection ?? {};
  const features = Array.isArray(section.features) ? section.features : [];
  const id = section.id ?? "hosted-site";
  const image = section.image ?? {};
  const cta = section.cta ?? {};

  if (!section.title && !section.description && !features.length) {
    return null;
  }

  return (
    <section className="hosted-site" id={id} data-animate="fade-up">
      <div className="container hosted-site-inner">
        <div className="hosted-site-copy">
          {section.kicker ? <p className="hosted-site-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p>{section.description}</p> : null}
          {features.length ? (
            <div className="hosted-site-features">
              {features.map((feature, index) => (
                <div className="hosted-site-feature" key={`${feature.title}-${index}`}>
                  <div className="hosted-site-feature-head">
                    {feature.icon ? (
                      <span className={`hosted-site-icon icon-${index % 3}`} aria-hidden="true">
                        <Icon name={feature.icon} size={18} />
                      </span>
                    ) : null}
                    {feature.title ? <h3>{feature.title}</h3> : null}
                  </div>
                  {feature.description ? <p>{feature.description}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {cta.label ? (
            <a className="btn btn-primary" href={cta.href ?? "#"}>
              {cta.label}
            </a>
          ) : null}
        </div>

        <div className="hosted-site-media">
          {image.src ? (
            <img src={image.src} alt={image.alt ?? ""} loading="lazy" />
          ) : (
            <div className="hosted-site-placeholder" aria-hidden="true"></div>
          )}
        </div>
      </div>
    </section>
  );
}
