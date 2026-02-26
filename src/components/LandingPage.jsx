import { useEffect, useMemo, useState } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import Hero from "./Hero.jsx";
import { BenefitsSection } from "./BenefitsSection.jsx";
import ProfilesSection from "./ProfilesSection.jsx";
import AdvantageSection from "./AdvantageSection.jsx";
import StatsFeatureSection from "./StatsFeatureSection.jsx";
import HostedSiteSection from "./HostedSiteSection.jsx";
import FaqSection from "./FaqSection.jsx";
import PricingSection from "./PricingSection.jsx";
import CtaBanner from "./CtaBanner.jsx";
import StepsCarousel from "./StepsCarousel.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

function LandingPage() {
  const data = useMemo(getLandingData, []);
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  const [showPricing, setShowPricing] = useState(false);
  const [scrollToPricing, setScrollToPricing] = useState(false);

  // Callback for when pricing link is clicked
  const handleShowPricing = () => {
    setShowPricing(true);
    setScrollToPricing(true);
  };

  // Scroll to pricing after it's rendered
  useEffect(() => {
    if (scrollToPricing && showPricing) {
      // Use setTimeout to ensure DOM is fully updated after React render
      const timer = setTimeout(() => {
        const pricingEl = document.getElementById("pricing");
        if (pricingEl) {
          pricingEl.scrollIntoView({ behavior: "smooth" });
        }
        setScrollToPricing(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [scrollToPricing, showPricing]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const elements = Array.from(document.querySelectorAll("[data-animate]"));
    if (!elements.length) {
      return;
    }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell landing-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar anchorBase="" onNavClick={handleShowPricing} />
      <main id="main" className="page-body landing-page">
        <Hero data={data} />
        {steps.length ? (
          <section
            className="landing-steps"
            id={data?.stepsId ?? "how-it-works"}
            data-animate="fade-up"
          >
            <div className="container">
              <div className="landing-section-header">
                {data?.stepsKicker ? (
                  <p className="landing-kicker">{data.stepsKicker}</p>
                ) : null}
                {data?.stepsTitle ? <h2>{data.stepsTitle}</h2> : null}
                {data?.stepsDescription ? (
                  <p className="landing-description">{data.stepsDescription}</p>
                ) : null}
              </div>
              <StepsCarousel steps={steps} />
            </div>
          </section>
        ) : null}

        <BenefitsSection data={data} />
        <ProfilesSection data={data} />
        <AdvantageSection data={data} />

        <StatsFeatureSection data={data} />
        <HostedSiteSection data={data} />
        <FaqSection data={data} />
        
        {showPricing && <PricingSection data={data} />}

        <CtaBanner data={data} />
      </main>
      <SiteFooter data={data} anchorBase="" />
    </div>
  );
}

export default LandingPage;
