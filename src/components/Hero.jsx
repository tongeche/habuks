import { useEffect, useState } from "react";

export default function Hero({ data }) {
  const heroImages = Array.isArray(data?.heroImages) ? data.heroImages : [];
  const intervalMs = Number.isFinite(data?.heroIntervalMs)
    ? data.heroIntervalMs
    : 2000;
  const headline = data?.heroHeadline ?? "";
  const eyebrow = data?.orgTagline ?? "";
  const intro = Array.isArray(data?.heroIntro) ? data.heroIntro : [];
  const actions = Array.isArray(data?.cta) ? data.cta : [];
  const panelTitle = data?.whatWeDoTitle ?? "";
  const panelItems = Array.isArray(data?.whatWeDo) ? data.whatWeDo : [];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [heroImages.length]);

  useEffect(() => {
    if (heroImages.length < 2) {
      return undefined;
    }
    if (typeof window === "undefined") {
      return undefined;
    }
    if (intervalMs <= 0) {
      return undefined;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroImages.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [heroImages.length, intervalMs]);

  return (
    <section className={`hero ${heroImages.length ? "has-images" : ""}`}>
      {heroImages.length ? (
        <div className="hero-media" aria-hidden="true">
          {heroImages.map((image, index) => (
            <div
              key={`${image.src}-${index}`}
              className={`hero-slide ${index === activeIndex ? "is-active" : ""}`}
            >
              <img
                src={image.src}
                alt={image.alt ?? ""}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div className="hero-overlay" aria-hidden="true"></div>

      <div className="container hero-inner">
        <div className="hero-card">
          {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
          {headline ? <h1>{headline}</h1> : null}
          {intro.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
          {actions.length ? (
            <div className="hero-actions">
              {actions.map((item) => (
                <a
                  key={item.label}
                  className={`btn ${item.style === "ghost" ? "btn-ghost" : "btn-primary"}`}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {panelItems.length && panelTitle ? (
          <aside className="hero-panel">
            <h2>{panelTitle}</h2>
            <ul>
              {panelItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      {heroImages.length > 1 ? (
        <div className="hero-indicators" aria-hidden="true">
          {heroImages.map((_, index) => (
            <span
              key={`indicator-${index}`}
              className={index === activeIndex ? "is-active" : ""}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
