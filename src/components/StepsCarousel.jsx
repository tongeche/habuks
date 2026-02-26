import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NewProjectFormDemo from "./steps-demos/NewProjectFormDemo.jsx";

const STEP_LABELS = [
  "Quick setup",
  "Team coordination",
  "Project operations",
];

const STEP_HIGHLIGHTS = [
  [
    "Configure your workspace, modules, and permissions in minutes.",
    "Invite members with role-based access from day one.",
    "Start with a structure that scales with your group.",
  ],
  [
    "Assign responsibilities and approvals clearly.",
    "Keep member activity visible without noise.",
    "Reduce confusion with shared workflows.",
  ],
  [
    "Capture project details and timelines consistently.",
    "Track contributions, costs, and progress in one place.",
    "Generate cleaner operational records for reporting.",
  ],
];

const getWrappedIndex = (index, total) => {
  if (!total) return 0;
  return ((index % total) + total) % total;
};

export default function StepsCarousel({ steps }) {
  const safeSteps = useMemo(
    () => (Array.isArray(steps) ? steps.filter(Boolean) : []),
    [steps]
  );

  const rootRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const explicitDemoIndex = useMemo(
    () => safeSteps.findIndex((step) => step?.demo === "new-project"),
    [safeSteps]
  );
  const hasExplicitDemo = explicitDemoIndex >= 0;
  const fallbackDemoIndex = Math.max(0, Math.min(2, safeSteps.length - 1));

  const goToSlide = useCallback(
    (targetIndex) => {
      if (!safeSteps.length) return;
      setActiveIndex(getWrappedIndex(targetIndex, safeSteps.length));
    },
    [safeSteps.length]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setPrefersReducedMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const root = rootRef.current;
    if (!root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.3 }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused || !isInView || safeSteps.length < 2) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((prev) => getWrappedIndex(prev + 1, safeSteps.length));
    }, 5600);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, isPaused, isInView, safeSteps.length]);

  if (!safeSteps.length) return null;

  return (
    <section
      className="steps-carousel"
      ref={rootRef}
      aria-roledescription="carousel"
      aria-label="How Habuks works"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      <div className="steps-carousel-window">
        <div
          className="steps-carousel-track"
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {safeSteps.map((step, index) => {
            const isDemoStep = hasExplicitDemo
              ? step?.demo === "new-project"
              : index === fallbackDemoIndex;
            const label = (typeof step?.tag === "string" && step.tag.trim()) || STEP_LABELS[index] || "Workflow";
            const highlights = Array.isArray(step?.highlights) ? step.highlights.filter(Boolean) : STEP_HIGHLIGHTS[index] || [];
            const isMediaRight = step?.layout === "media-right";

            return (
              <article
                key={`${step.title || "step"}-${index}`}
                className="steps-feature-slide"
                aria-roledescription="slide"
                aria-label={`${step.title || `Step ${index + 1}`}`}
              >
                <div className={`steps-feature-card${isMediaRight ? " steps-feature-card--media-right" : ""}`}>
                  <div className={`steps-feature-media${isDemoStep ? " is-demo" : ""}`}>
                    {isDemoStep ? (
                      <NewProjectFormDemo className="steps-feature-demo" mode="pause-offscreen" blend />
                    ) : step.image?.src ? (
                      <img src={step.image.src} alt={step.image.alt ?? ""} loading="lazy" />
                    ) : (
                      <div className="step-media-placeholder" aria-hidden="true"></div>
                    )}
                  </div>

                  <div className="steps-feature-content">
                    <span className="steps-feature-tag">{label}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {highlights.length ? (
                      <ul className="steps-feature-list">
                        {highlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="steps-carousel-dots" role="tablist" aria-label="Slide controls">
        {safeSteps.map((step, index) => (
          <button
            key={`${step.title || "dot"}-${index}`}
            type="button"
            role="tab"
            className={`steps-carousel-dot${index === activeIndex ? " is-active" : ""}`}
            aria-selected={index === activeIndex}
            aria-label={`Go to ${step.title || `slide ${index + 1}`}`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </section>
  );
}
