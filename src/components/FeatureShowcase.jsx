import { useEffect, useState } from "react";

const normalizeSlides = (section) => {
  const slides = Array.isArray(section.slides) ? section.slides : [];
  if (slides.length) return slides;
  const items = Array.isArray(section.items) ? section.items : [];
  return items.map((item) => ({
    title: item.title,
    description: item.description,
    image: item.image,
  }));
};

export default function FeatureShowcase({ data }) {
  const section = data?.featuresSection ?? {};
  const id = section.id ?? "features";
  const slides = normalizeSlides(section);
  const intervalMs = Number.isFinite(section.intervalMs) ? section.intervalMs : 2200;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return undefined;
    if (typeof window === "undefined") return undefined;
    if (intervalMs <= 0) return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [slides.length, intervalMs]);

  if (!section.title && !section.description && !slides.length) {
    return null;
  }

  const activeSlide = slides[activeIndex] ?? {};
  const image = activeSlide.image ?? {};

  const handlePrev = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  return (
    <section className="feature-carousel" id={id}>
      <div className="container feature-carousel-header">
        {section.kicker ? <p className="feature-kicker">{section.kicker}</p> : null}
        {section.title ? <h2>{section.title}</h2> : null}
        {section.description ? <p>{section.description}</p> : null}
      </div>

      <div className="container feature-carousel-body">
        <div className="feature-carousel-content">
          {activeSlide.title ? <h3>{activeSlide.title}</h3> : null}
          {activeSlide.description ? <p>{activeSlide.description}</p> : null}
        </div>
        <div className="feature-carousel-media">
          {image.src ? (
            <img src={image.src} alt={image.alt ?? activeSlide.title ?? ""} loading="lazy" />
          ) : (
            <div className="feature-carousel-placeholder" aria-hidden="true" />
          )}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="container feature-carousel-controls">
          <button type="button" className="feature-nav-btn" onClick={handlePrev} aria-label="Previous feature">
            ‹
          </button>
          <div className="feature-dots" aria-hidden="true">
            {slides.map((_, index) => (
              <span
                key={`feature-dot-${index}`}
                className={index === activeIndex ? "is-active" : ""}
              />
            ))}
          </div>
          <button type="button" className="feature-nav-btn" onClick={handleNext} aria-label="Next feature">
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
