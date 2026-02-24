import { useMemo, useEffect } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const getAboutData = () => {
  if (typeof window !== "undefined" && window.aboutData) {
    return window.aboutData();
  }
  return {};
};

export default function AboutPage() {
  const data = useMemo(getLandingData, []);
  const about = useMemo(getAboutData, []);

  const hero = about?.hero ?? {};
  const intro = about?.intro ?? {};
  const mission = about?.mission ?? {};
  const promise = about?.promise ?? {};
  const blog = about?.blog ?? {};
  const cta = about?.cta ?? {};

  // Scroll animation observer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      // Make all elements visible immediately
      document.querySelectorAll(".about-animate, .about-animate-left, .about-animate-right, .about-animate-scale, .about-animate-stagger")
        .forEach(el => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { 
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
      }
    );

    const elements = document.querySelectorAll(
      ".about-animate, .about-animate-left, .about-animate-right, .about-animate-scale, .about-animate-stagger"
    );
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell landing-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar anchorBase="/" />
      <main id="main" className="page-body landing-page about-page">
        
        {/* Animated Background Effect */}
        <div className="about-bg-effect" aria-hidden="true"></div>

        {/* Hero - Full Width Image */}
        {hero.image?.src && (
          <section className="about-hero about-animate-scale">
            <img 
              src={hero.image.src} 
              alt={hero.image.alt ?? "About us"} 
              className="about-hero-image"
            />
          </section>
        )}

        {/* About Us Section */}
        {intro.title && (
          <section className="about-intro">
            <div className="container about-intro-inner about-animate">
              <h1>{intro.title}</h1>
              {intro.paragraphs?.length > 0 && (
                <div className="about-intro-text">
                  {intro.paragraphs.map((para, index) => (
                    <p 
                      key={index} 
                      dangerouslySetInnerHTML={{ __html: para.text ?? para }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Mission Section */}
        {mission.title && (
          <section className="about-mission">
            <div className="container about-mission-inner">
              <div className="about-mission-media about-animate-left">
                {mission.illustration?.src && (
                  <img 
                    src={mission.illustration.src} 
                    alt={mission.illustration.alt ?? "Mission"} 
                    className="about-mission-illustration"
                  />
                )}
              </div>
              <div className="about-mission-content about-animate-right">
                <h2>{mission.title}</h2>
                {mission.paragraphs?.map((para, index) => (
                  <p key={index}>{para}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Promise Section */}
        {promise.title && (
          <section className="about-promise">
            <div className="container about-promise-inner">
              <div className="about-promise-content about-animate-left">
                <h2>{promise.title}</h2>
                {promise.text && (
                  <p dangerouslySetInnerHTML={{ __html: promise.text }} />
                )}
                {promise.link?.href && (
                  <a href={promise.link.href} className="about-promise-link">
                    {promise.link.label}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                )}
              </div>
              <div className="about-promise-media about-animate-right">
                {promise.image?.src && (
                  <img 
                    src={promise.image.src} 
                    alt={promise.image.alt ?? "Our promise"} 
                    className="about-promise-image"
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {/* Blog Section */}
        {blog.title && (
          <section className="about-blog">
            <div className="container about-blog-inner about-animate-stagger">
              <div className="about-blog-header">
                <h2>{blog.title}</h2>
                {blog.description && <p>{blog.description}</p>}
                {blog.link?.href && (
                  <a href={blog.link.href} className="about-blog-btn">
                    {blog.link.label}
                  </a>
                )}
              </div>
              
              {blog.featured && (
                <div className="about-blog-featured">
                  <a href={blog.featured.href}>
                    <img 
                      src={blog.featured.image} 
                      alt={blog.featured.title} 
                    />
                    <span className="about-blog-featured-title">
                      {blog.featured.title}
                    </span>
                  </a>
                </div>
              )}
              
              {blog.posts?.length > 0 && (
                <div className="about-blog-posts">
                  {blog.posts.map((post, index) => (
                    <div className="about-blog-post" key={index}>
                      <a href={post.href}>
                        <img src={post.image} alt={post.title} />
                        <span className="about-blog-post-title">
                          {post.title}
                        </span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA Section */}
        {cta.title && (
          <section className="about-cta">
            <div className="container about-cta-inner about-animate">
              <h2>{cta.title}</h2>
              {cta.description && <p>{cta.description}</p>}
              <div className="about-cta-actions">
                {cta.primaryAction?.href && (
                  <a 
                    href={cta.primaryAction.href} 
                    className="about-cta-btn about-cta-btn-primary"
                  >
                    {cta.primaryAction.label}
                  </a>
                )}
                {cta.secondaryAction?.href && (
                  <a 
                    href={cta.secondaryAction.href} 
                    className="about-cta-btn about-cta-btn-secondary"
                  >
                    {cta.secondaryAction.label}
                  </a>
                )}
              </div>
            </div>
          </section>
        )}

      </main>
      <SiteFooter data={data} anchorBase="/" />
    </div>
  );
}
