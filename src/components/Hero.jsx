import { useEffect, useState, useRef } from "react";
import { Icon } from "./icons.jsx";

export default function Hero({ data }) {
  const template = data?.heroTemplate ?? "default";
  const heroBackgroundImage =
    data?.heroBackgroundImage || data?.heroImage || data?.heroImages?.[0]?.src || "";
  const heroImages = Array.isArray(data?.heroImages) ? data.heroImages : [];
  const intervalMs = Number.isFinite(data?.heroIntervalMs)
    ? data.heroIntervalMs
    : 2000;
  const variant = data?.heroVariant ?? "default";
  const headline = data?.heroHeadline ?? "";
  const eyebrow = data?.heroEyebrow ?? "";
  const intro = Array.isArray(data?.heroIntro)
    ? data.heroIntro
    : data?.heroIntro
      ? [data.heroIntro]
      : [];
  // detect long headlines (or the specific landing headline) so we can apply
  // a smaller style without changing all h1s globally
  const isLongHeadline = Boolean(
    (typeof headline === "string" && headline.length > 36) ||
      (typeof headline === "string" &&
        headline.includes("Stop Managing Your Organization on Spreadsheets"))
  );
  const actions = Array.isArray(data?.cta) ? data.cta : [];
  // remove the site-level "Start free trial" CTA from the hero specifically
  const heroActions = Array.isArray(actions)
    ? actions.filter((a) => String(a.label).trim() !== "Start free trial")
    : [];
  const primaryHeroAction = heroActions[0] ?? null;
  const panelTitle = data?.whatWeDoTitle ?? "";
  const panelItems = Array.isArray(data?.whatWeDo) ? data.whatWeDo : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const secondaryLink = data?.heroSecondaryLink ?? null;
  const heroTrust = Array.isArray(data?.heroTrust) ? data.heroTrust : [];
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setActiveIndex(0);
  }, [heroImages.length]);

  // Mount animations + optional mouse parallax (respects prefers-reduced-motion)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      // don't run entrance or parallax for reduced motion
      return undefined;
    }

    // trigger mount-based staggered animations
    const mountTimer = window.setTimeout(() => setMounted(true), 60);

    // lightweight mouse-based parallax: writes CSS vars on the section element
    const el = heroRef.current;
    let raf = null;
    function onMove(e) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5..0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${(x * 28).toFixed(2)}px`);
        el.style.setProperty("--my", `${(y * 18).toFixed(2)}px`);
      });
    }

    function resetVars() {
      if (!el) return;
      el.style.setProperty("--mx", `0px`);
      el.style.setProperty("--my", `0px`);
    }

    if (el) {
      el.addEventListener("mousemove", onMove, { passive: true });
      el.addEventListener("mouseleave", resetVars, { passive: true });
    }

    return () => {
      window.clearTimeout(mountTimer);
      if (el) {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", resetVars);
      }
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  const splitHeadline = (value) => {
    const safeValue = String(value || "").trim();
    if (!safeValue) return null;
    const words = safeValue.split(/\s+/);
    if (words.length < 2) return safeValue;
    const accent = words.pop();
    const prefix = words.join(" ");
    return (
      <>
        {prefix} <span className="hero-title-accent">{accent}</span>
      </>
    );
  };

  const hasHeroCarousel = heroImages.length > 1;
  const activeHeroImage = heroImages[activeIndex] || null;
  const activeHeroImageSrc = activeHeroImage?.src || heroBackgroundImage || "";
  const heroCoverStyle = activeHeroImageSrc
    ? {
        "--hero-cover-image": `url("${String(activeHeroImageSrc).replace(/"/g, '\\"')}")`,
      }
    : undefined;

  const goToPreviousHeroImage = () => {
    if (!hasHeroCarousel) return;
    setActiveIndex((current) => (current - 1 + heroImages.length) % heroImages.length);
  };

  const goToNextHeroImage = () => {
    if (!hasHeroCarousel) return;
    setActiveIndex((current) => (current + 1) % heroImages.length);
  };

  if (template === "minimal") {
    return (
      <section
        ref={heroRef}
        className={`hero hero-minimal hero-minimal-cover ${mounted ? "is-mounted has-parallax" : ""}`}
        style={heroCoverStyle}
      >
        <div className="container hero-minimal-inner hero-minimal-cover-inner">
          <div className="hero-minimal-card">
            {headline ? (
              <h1 className={isLongHeadline ? "hero-long-headline" : ""}>{splitHeadline(headline)}</h1>
            ) : null}
            {intro[0] ? <p>{intro[0]}</p> : null}

            {primaryHeroAction ? (
              <div className="hero-actions">
                <a
                  className={`btn ${
                    primaryHeroAction.style === "ghost"
                      ? "btn-ghost"
                      : primaryHeroAction.style === "outline"
                        ? "btn-outline"
                        : "btn-primary"
                  }`}
                  href={primaryHeroAction.href}
                >
                  {primaryHeroAction.label}
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {hasHeroCarousel ? (
          <div className="hero-minimal-controls">
            <button
              type="button"
              onClick={goToPreviousHeroImage}
              className="hero-minimal-control prev"
              aria-label="Previous hero image"
            >
              <Icon name="arrow-left" size={15} />
            </button>
            <button
              type="button"
              onClick={goToNextHeroImage}
              className="hero-minimal-control next"
              aria-label="Next hero image"
            >
              <Icon name="arrow-right" size={15} />
            </button>
          </div>
        ) : null}

        {hasHeroCarousel ? (
          <div className="hero-minimal-indicators" aria-hidden="true">
            {heroImages.map((_, index) => (
              <span
                key={`hero-minimal-indicator-${index}`}
                className={index === activeIndex ? "is-active" : ""}
              />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (variant === "split") {
    const heroImage =
      data?.heroImage || heroBackgroundImage || heroImages[0]?.src || "";
    return (
      <section ref={heroRef} className={`hero hero-split ${mounted ? "is-mounted has-parallax" : ""}`}>
        <div className="container hero-split-inner">
          <div className="hero-split-content">
            {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
            {headline ? <h1 className={isLongHeadline ? "hero-long-headline" : ""}>{headline}</h1> : null}
            {intro.map((line, index) => (
              <p key={`${line}-${index}`}>{line}</p>
            ))}
            {heroActions.length ? (
              <div className="hero-actions">
                {heroActions.map((item) => (
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
            {secondaryLink?.href ? (
              <a className="hero-secondary-link" href={secondaryLink.href}>
                {secondaryLink.label}
              </a>
            ) : null}
          </div>

          <div className="hero-split-media">
            <div className="hero-device">
              {heroImage ? (
                <img src={heroImage} alt={headline || "Habuks workspace"} loading="eager" />
              ) : (
                <div className="hero-device-placeholder" aria-hidden="true"></div>
              )}
            </div>

            {heroTrust.length ? (
              <div className="hero-trust">
                {heroTrust.map((item) => (
                  <div className="hero-trust-item" key={item.name}>
                    <span>{item.score}</span>
                    <p>{item.name}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={heroRef} className={`hero ${heroImages.length ? "has-images" : ""} ${mounted ? "is-mounted has-parallax" : ""}`}>
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
          {headline ? <h1 className={isLongHeadline ? "hero-long-headline" : ""}>{headline}</h1> : null}
          {intro.map((line, index) => (
            <p key={`${line}-${index}`}>{line}</p>
          ))}
          {heroActions.length ? (
            <div className="hero-actions">
              {heroActions.map((item) => (
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
