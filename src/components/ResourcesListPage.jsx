import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import "../styles/resources.css";

const getLandingData = () => {
  if (typeof window !== "undefined" && window.landingData) {
    return window.landingData();
  }
  return {};
};

const getResourcesData = () => {
  if (typeof window !== "undefined" && window.resourcesData) {
    return window.resourcesData();
  }
  return { resources: [], categories: [], hero: {} };
};

export default function ResourcesListPage() {
  const data = useMemo(getLandingData, []);
  const resourcesData = useMemo(getResourcesData, []);
  const [activeCategory, setActiveCategory] = useState("All");
  const [progressMap, setProgressMap] = useState({});

  const { hero, categories, resources } = resourcesData;

  // Load progress from localStorage
  useEffect(() => {
    const progress = {};
    resources?.forEach((resource) => {
      const saved = localStorage.getItem(`resource-progress-${resource.slug}`);
      if (saved) {
        const completed = JSON.parse(saved);
        progress[resource.slug] = Math.round(
          (completed.length / resource.chapters) * 100
        );
      }
    });
    setProgressMap(progress);
  }, [resources]);

  const filteredResources = useMemo(() => {
    if (activeCategory === "All") {
      return resources || [];
    }
    return (resources || []).filter((r) => r.category === activeCategory);
  }, [resources, activeCategory]);

  return (
    <div className="resource-shell">
      <SiteHeader data={data} hideTopBar anchorBase="/" />

      <main className="resource-page resources-list-page">
        {/* Hero Section */}
        <section className="resources-hero">
          <div className="container">
            <h1>
              {hero?.title || "Learn"} <span>Habuks</span>
            </h1>
            <p>{hero?.subtitle || "Master your organization management."}</p>

            {/* Stats */}
            <div className="resources-stats">
              {hero?.stats?.map((stat, index) => (
                <div key={index} className="resources-stat">
                  <span className="resources-stat-value">{stat.value}</span>
                  <span className="resources-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Category Filters */}
            <div className="resources-filters">
              {categories?.map((category) => (
                <button
                  key={category}
                  className={`filter-pill ${activeCategory === category ? "active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Course Grid */}
        <section className="resources-grid-section">
          <div className="container">
            <div className="resources-grid">
              {filteredResources.map((resource) => {
                const progress = progressMap[resource.slug] || 0;
                return (
                  <Link
                    key={resource.slug}
                    to={`/resources/${resource.slug}`}
                    className="course-card"
                  >
                    <div className="course-card-image">
                      <img
                        src={resource.image}
                        alt={resource.title}
                        onError={(e) => {
                          e.target.src = "/assets/placeholder-course.jpg";
                        }}
                      />
                      <span
                        className={`course-card-badge ${resource.difficulty?.toLowerCase()}`}
                      >
                        {resource.difficulty}
                      </span>
                    </div>

                    <div className="course-card-content">
                      <span className="course-card-category">
                        {resource.category}
                      </span>
                      <h3 className="course-card-title">{resource.title}</h3>
                      <p className="course-card-description">
                        {resource.description}
                      </p>

                      <div className="course-card-meta">
                        <span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          {resource.chapters} chapters
                        </span>
                        <span>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {resource.duration}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="course-card-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {progress > 0 ? `${progress}% complete` : "Not started"}
                        </span>
                      </div>

                      <div className="course-card-btn">
                        {progress > 0 ? "Continue Learning" : "Start Learning"}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
