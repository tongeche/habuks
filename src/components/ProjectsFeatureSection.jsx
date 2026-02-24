import React from "react";
import { Icon } from "./icons.jsx";

export default function ProjectsFeatureSection({ data }) {
  const section = data?.projectsSection ?? {
    id: "projects",
    kicker: "PROJECTS",
    title: "Project management made simple",
    description:
      "Plan, track, and report on income-generating activities with clarity — assign owners, log expenses, and see outcomes at a glance.",
    ctas: [
      { label: "Request a demo", href: "/request-demo", style: "outline" },
      { label: "See projects", href: "#modules", style: "primary" },
    ],
    images: [
      { src: "/assets/tenant-website-projects.png", alt: "Projects list" },
      { src: "/assets/updates-2.webp", alt: "Project details" },
    ],
  };

  return (
    <section className="projects-section" id={section.id} data-animate="fade-up">
      <div className="container projects-inner">
        <div className="projects-copy">
          {section.kicker ? <p className="landing-kicker">{section.kicker}</p> : null}
          {section.title ? <h2>{section.title}</h2> : null}
          {section.description ? <p className="landing-description">{section.description}</p> : null}

          <div className="projects-ctas">
            {Array.isArray(section.ctas) &&
              section.ctas.map((c) => (
                <a key={c.label} className={`btn ${c.style === "outline" ? "btn-outline" : "btn-primary"}`} href={c.href}>
                  {c.label}
                </a>
              ))}
          </div>
        </div>

        <div className="projects-media">
          {section.images && section.images.length ? (
            <div className="projects-screens">
              <div className="projects-screenshot projects-screenshot-1">
                <img src={section.images[0].src} alt={section.images[0].alt ?? ""} loading="lazy" />
              </div>
              <div className="projects-screenshot projects-screenshot-2">
                <img src={section.images[1]?.src ?? section.images[0].src} alt={section.images[1]?.alt ?? ""} loading="lazy" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
