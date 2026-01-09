import { useMemo } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

const getSiteData = () => {
  if (typeof window !== "undefined" && window.siteData) {
    return window.siteData();
  }
  return {};
};

const standFor = [
  {
    title: "Dignity over dependency",
    description:
      "We do not exist to save anyone. We exist to make it easier for families to stand on their feet and stay there."
  },
  {
    title: "Practical change",
    description:
      "We focus on solutions that meet daily life: income, food security, skills, and community support."
  },
  {
    title: "Trust and accountability",
    description:
      "We keep clear records, track results, and share what we learn because every donor, volunteer, and member deserves transparency."
  },
  {
    title: "Community leadership",
    description:
      "The people most affected by the challenges are the ones leading the solutions. Support should strengthen local ownership, not replace it."
  }
];

const whyWeDoThis = [
  "We have seen youth give up on meaningful work because nothing reliable comes after effort.",
  "We have seen women carry entire households with little support.",
  "We have seen families with skills and discipline still lose progress because the system around them is fragile.",
  "When a community gets organised, people become confident, problems become manageable, and small wins turn into real stability."
];

const principles = [
  {
    title: "Start small, do it well",
    description: "Prove the model before expanding."
  },
  {
    title: "Train and support",
    description: "Skills, follow-up, and peer learning matter as much as equipment."
  },
  {
    title: "Reinvest and grow",
    description: "Projects should become stronger over time, not remain dependent."
  }
];

const donorSupport = [
  "Tools that create income",
  "Training that reduces losses",
  "Follow-up that ensures success",
  "Accountability that protects every shilling"
];

const commitments = [
  "We will be honest about what is working and what is not.",
  "We will share progress, results, and lessons learned.",
  "We will protect the dignity of our members and the communities we serve.",
  "We will keep building carefully, transparently, and with purpose."
];

export default function AboutPage() {
  const data = useMemo(getSiteData, []);
  const orgName = data?.orgName ?? "Jongol Foundation";
  const groupName = data?.groupName ?? "JONGOL Self Help Group";

  return (
    <div className="app-shell about-page-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      <main id="main" className="about-page">
        <section className="about-page-hero" id="about">
          <div className="container about-page-hero-inner">
            <div className="about-page-hero-content">
              <div className="about-page-breadcrumb">
                <a href="/">Home</a>
                <span>/</span>
                <span>About</span>
              </div>
              <span className="section-kicker">About Us</span>
              <h1>About {groupName}</h1>
              <p>
                JONGOL is a community-led self help group built by ordinary people who are
                tired of watching hard work lead to the same struggle year after year.
              </p>
              <p>
                We come from households where a single unexpected cost - a hospital visit,
                a failed harvest, school fees - can quietly undo months of effort. In places
                like ours, people do not lack ambition. We lack steady opportunity, reliable
                systems, and the kind of support that turns small effort into lasting progress.
              </p>
              <div className="about-page-hero-callout">
                <span>So we organised ourselves.</span>
              </div>
              <div className="about-page-hero-actions">
                <a className="btn btn-primary" href="/volunteer">
                  Become a Volunteer
                </a>
                <a className="btn btn-dark" href="#contact">
                  Partner With Us
                </a>
              </div>
            </div>
            <div className="about-page-hero-media">
              <div className="about-page-photo is-main">
                <img src="/assets/about-1.png" alt="Community support and livelihoods in action." />
              </div>
              <div className="about-page-photo is-top">
                <img src="/assets/highlight-1.png" alt="Community collaboration and shared effort." />
              </div>
              <div className="about-page-photo is-small">
                <img src="/assets/hero-1.png" alt="Members working together in green fields." />
              </div>
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-who">
          <div className="container about-page-two-col">
            <div className="about-page-text">
              <div className="section-header">
                <span className="section-kicker">Who We Are</span>
                <h2>Local people building reliable livelihoods</h2>
              </div>
              <p>
                JONGOL is a local group of members who pool time, skills, and resources to build
                practical solutions for livelihoods and family wellbeing.
              </p>
              <p>
                We believe that dignity grows when people can earn, plan, and provide without
                having to depend on luck or emergency help.
              </p>
              <p>
                We work closely with community members, listen first, and design projects that are
                simple, honest, and realistic - projects that can survive beyond the excitement of
                the launch.
              </p>
            </div>
            <div className="about-page-card about-page-card-accent">
              <h3>What We Do</h3>
              <p>
                We focus on income, food security, skills, and community support while keeping our
                systems clear and transparent.
              </p>
              <div className="about-page-pill-list">
                <span>Community-led</span>
                <span>Practical enterprise</span>
                <span>Transparent records</span>
                <span>Member-owned</span>
              </div>
              <div className="about-page-card-footer">
                <p>
                  This is how we turn small effort into lasting progress for households in Kosele
                  and across Rachuonyo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-values alt">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">What We Stand For</span>
              <h2>Values that guide our work</h2>
            </div>
            <div className="about-page-values-grid">
              {standFor.map((value) => (
                <div className="about-page-card" key={value.title}>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-why">
          <div className="container about-page-two-col">
            <div className="about-page-text">
              <div className="section-header">
                <span className="section-kicker">Why We Do This Work</span>
                <h2>Because we have seen what happens when people are left alone</h2>
              </div>
              <ul className="about-page-list">
                {whyWeDoThis.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="about-page-media-card">
              <img src="/assets/updates-2.webp" alt="Community-led enterprise work in action." />
              <div className="about-page-media-caption">
                <p>
                  We have also seen what happens when a community gets organised. Confidence rises,
                  collaboration grows, and stability becomes possible.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-principles alt">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">How We Work</span>
              <h2>Three principles shape every project</h2>
            </div>
            <div className="about-page-principles-grid">
              {principles.map((principle, index) => (
                <div className="about-page-principle" key={principle.title}>
                  <div className="about-page-principle-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-partners">
          <div className="container">
            <div className="section-header center">
              <span className="section-kicker">Support Our Work</span>
              <h2>Where volunteers and donors fit in</h2>
            </div>
            <div className="about-page-partner-grid">
              <div className="about-page-card">
                <h3>Volunteers</h3>
                <p>
                  You are here to walk with us, strengthen systems, share skills, and help us
                  document and learn. You help good ideas become organised, measurable, and
                  scalable.
                </p>
                <a className="btn btn-primary" href="/volunteer">
                  Become a Volunteer
                </a>
              </div>
              <div className="about-page-card">
                <h3>Donors</h3>
                <p>Your support becomes more than a donation. It becomes:</p>
                <ul className="about-page-list">
                  {donorSupport.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a className="btn btn-dark" href="#contact">
                  Support Our Work
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="about-page-section about-page-commitment alt">
          <div className="container about-page-two-col">
            <div className="about-page-text">
              <div className="section-header">
                <span className="section-kicker">Our Commitment</span>
                <h2>What you can expect from {orgName}</h2>
              </div>
              <p>
                We will protect the dignity of our members and keep building with purpose. Our
                commitment is rooted in honesty, transparency, and shared learning.
              </p>
            </div>
            <ul className="about-page-list about-page-commitment-list">
              {commitments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="about-page-cta">
          <div className="container about-page-cta-inner">
            <div>
              <span className="section-kicker">Join Us</span>
              <h2>
                {orgName} is for people who believe rural communities need partnership, tools, and
                trust.
              </h2>
              <p>
                If you are ready to support real, community-led change, we would be honoured to
                work with you.
              </p>
            </div>
            <div className="about-page-cta-actions">
              <a className="btn btn-light" href="/volunteer">
                Become a Volunteer
              </a>
              <a className="btn btn-ghost-light" href="#contact">
                Support Our Work
              </a>
              <a className="btn btn-ghost-light" href="#contact">
                Partner With Us
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
