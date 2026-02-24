import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const titleize = (value) =>
  String(value ?? "")
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

export default function SupportPage() {
  const data = useMemo(getLandingData, []);
  const [searchParams] = useSearchParams();
  const faqSection = data?.faqSection ?? {};
  const supportPage = faqSection.supportPage ?? {};
  const items = Array.isArray(faqSection.popular) ? faqSection.popular : [];
  const resources = Array.isArray(faqSection.resources) ? faqSection.resources : [];
  const categories = Array.isArray(faqSection.categories) ? faqSection.categories : [];
  const query = searchParams.get("q") ?? "";
  const categoryQuery = searchParams.get("category") ?? "";
  const normalizedQuery = slugify(decodeURIComponent(query));
  const normalizedCategory = slugify(decodeURIComponent(categoryQuery));

  const activeCategory =
    resources.find((resource) => slugify(resource.slug ?? resource.title) === normalizedCategory) ?? null;

  const filteredItems = normalizedCategory
    ? items.filter((item) => slugify(item.category ?? "") === normalizedCategory)
    : items;

  const categoryList = categories.length
    ? categories
    : Array.from(new Set(items.map((item) => slugify(item.category ?? "general")))).map(
        (slug) => ({ slug, label: titleize(slug) })
      );

  const visibleCategories = normalizedCategory
    ? categoryList.filter((category) => slugify(category.slug) === normalizedCategory)
    : categoryList;

  const activeItem =
    filteredItems.find((item) => slugify(item.question) === normalizedQuery) ??
    items.find((item) => slugify(item.question) === normalizedQuery) ??
    filteredItems[0] ??
    items[0];

  return (
    <div className="app-shell support-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      <main id="main" className="support-page">
        <section className="support-hero">
          <div className="container support-hero-inner">
            <div className="support-hero-copy">
              <div className="support-breadcrumb">
                <a href="/">Home</a>
                <span>/</span>
                <span>Support</span>
                {activeCategory?.title ? (
                  <>
                    <span>/</span>
                    <span>{activeCategory.title}</span>
                  </>
                ) : null}
                {activeItem?.question ? (
                  <>
                    <span>/</span>
                    <span>{activeItem.question}</span>
                  </>
                ) : null}
              </div>
              <h1>{supportPage.title ?? "Habuks Help Center"}</h1>
              <p>{supportPage.description ?? "Find answers to common questions."}</p>
              {activeCategory?.title ? (
                <p className="support-category">Category: {activeCategory.title}</p>
              ) : null}
            </div>
            <div className="support-search">
              <input type="search" placeholder="Search help" aria-label="Search help" />
            </div>
          </div>
        </section>

        <section className="support-body">
          <div className="container support-body-inner">
            <aside className="support-sidebar">
              <p className="support-sidebar-title">
                {supportPage.sidebarTitle ?? "Popular questions"}
              </p>
              <nav className="support-sidebar-list">
                {visibleCategories.map((category) => {
                  const categorySlug = slugify(category.slug);
                  const categoryItems = (filteredItems.length ? filteredItems : items).filter(
                    (item) => slugify(item.category ?? "general") === categorySlug
                  );

                  if (!categoryItems.length) {
                    return null;
                  }

                  return (
                    <div className="support-category-group" key={category.slug}>
                      <p className="support-category-label">{category.label}</p>
                      <div className="support-category-links">
                        {categoryItems.map((item) => {
                          const slug = item.slug ?? slugify(item.question);
                          const isActive =
                            slug === normalizedQuery || (!normalizedQuery && item === activeItem);
                          return (
                            <a
                              key={item.question}
                              href={`/support?q=${slug}`}
                              className={`support-sidebar-link${isActive ? " is-active" : ""}`}
                            >
                              {item.question}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </nav>
            </aside>

            <article className="support-article">
              <h2>{activeItem?.question ?? "Support"}</h2>
              <p>{activeItem?.answer ?? "Select a question to see the answer."}</p>
              <div className="support-article-note">
                <p>
                  Need more help? Contact our support team and we’ll walk you through the next
                  steps.
                </p>
              </div>
            </article>
          </div>
        </section>

        {supportPage.cta?.title ? (
          <section className="support-cta">
            <div className="container">
              <div className="support-cta-card">
                <h3>{supportPage.cta.title}</h3>
                {supportPage.cta.description ? <p>{supportPage.cta.description}</p> : null}
                {supportPage.cta.button?.label ? (
                  <a className="support-cta-button" href={supportPage.cta.button.href ?? "#"}>
                    {supportPage.cta.button.label}
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter data={data} />
    </div>
  );
}
