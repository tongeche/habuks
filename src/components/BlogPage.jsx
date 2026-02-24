import { useMemo, useState, useEffect } from "react";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import NewsletterCard from "./NewsletterCard.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const getBlogData = () => {
  if (typeof window !== "undefined" && window.blogData) {
    return window.blogData();
  }
  return {};
};

export default function BlogPage() {
  const data = useMemo(getLandingData, []);
  const blog = useMemo(getBlogData, []);
  const [activeCategory, setActiveCategory] = useState("all");

  const hero = blog?.hero ?? {};
  const featured = blog?.featured ?? {};
  const categories = blog?.categories ?? [];
  const allPosts = blog?.posts ?? [];
  const newsletter = blog?.newsletter ?? {};

  const filteredPosts = useMemo(() => {
    if (activeCategory === "all") return allPosts;
    return allPosts.filter(
      (post) => post.category.toLowerCase().includes(activeCategory)
    );
  }, [activeCategory, allPosts]);

  // Scroll animation observer
  useEffect(() => {
    if (typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      document.querySelectorAll(".blog-animate")
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
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const elements = document.querySelectorAll(".blog-animate");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-shell blog-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar anchorBase="/" />

      <main id="main" className="blog-page">
        {/* Decorative Background */}
        <div className="blog-bg" aria-hidden="true">
          <div className="blog-bg-gradient" />
          <div className="blog-bg-shape blog-bg-shape--1" />
          <div className="blog-bg-shape blog-bg-shape--2" />
          <div className="blog-bg-shape blog-bg-shape--3" />
        </div>

        {/* Hero Section */}
        <section className="blog-hero">
          <div className="container blog-hero-inner">
            <div className="blog-hero-content blog-animate">
              <h1 className="blog-hero-title">{hero.title}</h1>
              <p className="blog-hero-subtitle">{hero.subtitle}</p>
            </div>
            {hero.stats && hero.stats.length > 0 && (
              <div className="blog-hero-stats blog-animate">
                {hero.stats.map((stat, idx) => (
                  <div key={idx} className="blog-hero-stat">
                    <span className="blog-hero-stat-value">{stat.value}</span>
                    <span className="blog-hero-stat-label">{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Featured Post */}
        {featured.title && (
          <section className="blog-featured">
            <div className="container">
              <div className="blog-featured-card blog-animate">
                <div className="blog-featured-image">
                  <img src={featured.image} alt="" loading="lazy" />
                  <span className="blog-featured-badge">{featured.category}</span>
                </div>
                <div className="blog-featured-content">
                  <h2 className="blog-featured-title">{featured.title}</h2>
                  <p className="blog-featured-excerpt">{featured.excerpt}</p>
                  <div className="blog-featured-meta">
                    <div className="blog-featured-author">
                      <img
                        src={featured.author?.avatar}
                        alt=""
                        className="blog-featured-avatar"
                      />
                      <div>
                        <span className="blog-featured-author-name">
                          {featured.author?.name}
                        </span>
                        <span className="blog-featured-author-role">
                          {featured.author?.role}
                        </span>
                      </div>
                    </div>
                    <div className="blog-featured-info">
                      <span>{featured.date}</span>
                      <span className="blog-featured-dot">·</span>
                      <span>{featured.readTime}</span>
                    </div>
                  </div>
                  <a href={featured.href} className="blog-featured-link">
                    Read article
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Categories & Posts */}
        <section className="blog-posts-section">
          <div className="container">
            {/* Category Filter */}
            <div className="blog-categories blog-animate">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`blog-category-btn ${activeCategory === cat.id ? "is-active" : ""}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Posts Grid */}
            <div className="blog-posts-grid">
              {filteredPosts.map((post, idx) => (
                <article
                  key={post.id}
                  className="blog-post-card blog-animate"
                  style={{ animationDelay: `${idx * 0.1}s` }}
                >
                  <div className="blog-post-image">
                    <img src={post.image} alt="" loading="lazy" />
                  </div>
                  <div className="blog-post-content">
                    <span className="blog-post-category">{post.category}</span>
                    <h3 className="blog-post-title">
                      <a href={post.href}>{post.title}</a>
                    </h3>
                    <p className="blog-post-excerpt">{post.excerpt}</p>
                    <div className="blog-post-meta">
                      <img
                        src={post.author?.avatar}
                        alt=""
                        className="blog-post-avatar"
                      />
                      <span className="blog-post-author">{post.author?.name}</span>
                      <span className="blog-post-dot">·</span>
                      <span className="blog-post-date">{post.readTime}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {filteredPosts.length === 0 && (
              <div className="blog-empty">
                <p>No posts found in this category.</p>
              </div>
            )}
          </div>
        </section>

        {/* Newsletter Section */}
        <section className="blog-newsletter">
          <div className="container">
            <div className="blog-animate">
              <NewsletterCard
                title={newsletter.title}
                subtitle={newsletter.subtitle}
                placeholder={newsletter.placeholder}
                buttonText={newsletter.buttonText}
                disclaimer={newsletter.disclaimer}
                source="blog"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter data={data} />
    </div>
  );
}
