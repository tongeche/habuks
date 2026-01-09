import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { Icon } from "./icons.jsx";
import { getProjectByCode } from "../lib/dataService.js";

const getSiteData = () => {
  if (typeof window !== "undefined" && window.siteData) {
    return window.siteData();
  }
  return {};
};

export default function ProjectPage() {
  const { projectCode } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const data = getSiteData();

  useEffect(() => {
    async function fetchProject() {
      setLoading(true);
      setError(null);
      try {
        const projectData = await getProjectByCode(projectCode);
        if (!projectData) {
          setError("Project not found");
        } else {
          setProject(projectData);
        }
      } catch (err) {
        console.error("Error loading project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectCode]);

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  // Map icon names from DB to our icon component
  const getActivityIcon = (iconName) => {
    const iconMap = {
      'egg': 'heart',
      'book': 'newspaper',
      'truck': 'briefcase',
      'trending-up': 'target'
    };
    return iconMap[iconName] || 'check';
  };

  if (loading) {
    return (
      <div className="app-shell project-page-shell">
        <SiteHeader data={data} />
        <main className="page-body">
          <div className="container project-loading">
            <div className="loading-spinner"></div>
            <p>Loading project...</p>
          </div>
        </main>
        <SiteFooter data={data} />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="app-shell project-page-shell">
        <SiteHeader data={data} />
        <main className="page-body">
          <div className="container project-error">
            <Icon name="alert" size={48} />
            <h1>{error || "Project not found"}</h1>
            <p>The project you're looking for doesn't exist or is no longer available.</p>
            <Link to="/volunteer" className="btn btn-primary">
              View All Projects
            </Link>
          </div>
        </main>
        <SiteFooter data={data} />
      </div>
    );
  }

  return (
    <div className="app-shell project-page-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />

      <main id="main" className="page-body">
        {/* Breadcrumb */}
        <div className="project-breadcrumb">
          <div className="container">
            <Link to="/volunteer">← Back to Volunteer</Link>
          </div>
        </div>

        {/* Hero Section */}
        <section className="project-hero">
          <div className="project-hero-bg" aria-hidden="true">
            {project.image_url ? (
              <img src={project.image_url} alt="" />
            ) : (
              <div className="hero-pattern"></div>
            )}
          </div>
          <div className="project-hero-overlay" aria-hidden="true"></div>
          <div className="container">
            <div className="project-hero-content">
              <span className="project-code-badge">{project.code}</span>
              <h1>{project.name}</h1>
              <p className="project-tagline">{project.tagline}</p>
              <div className="hero-meta">
                {project.is_recruiting && (
                  <span className="recruiting-badge">
                    <Icon name="check" size={14} /> Now Recruiting
                  </span>
                )}
                <span className="location-badge">
                  <Icon name="location" size={14} /> {project.location}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Stats Bar */}
        <section className="project-stats">
          <div className="container">
            <div className="stats-grid">
              <div className="stat-item">
                <Icon name="clock" size={24} />
                <div>
                  <span className="stat-label">Time Commitment</span>
                  <span className="stat-value">{project.time_commitment || 'Flexible'}</span>
                </div>
              </div>
              <div className="stat-item">
                <Icon name="users" size={24} />
                <div>
                  <span className="stat-label">Team Size</span>
                  <span className="stat-value">{project.team_size || 'Growing team'}</span>
                </div>
              </div>
              <div className="stat-item">
                <Icon name="calendar" size={24} />
                <div>
                  <span className="stat-label">Status</span>
                  <span className="stat-value">{project.timeline_status || 'Ongoing'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Statement */}
        {project.short_description && (
          <section className="project-mission">
            <div className="container">
              <div className="mission-card">
                <Icon name="target" size={32} />
                <p>{project.short_description}</p>
              </div>
            </div>
          </section>
        )}

        {/* About Section with Image */}
        <section className="project-about">
          <div className="container">
            <div className="about-grid">
              <div className="about-image">
                <div className="image-pattern" aria-hidden="true"></div>
                <img 
                  src={project.gallery?.[0]?.image_url || '/assets/what-we-do-1.png'} 
                  alt={project.name}
                  loading="lazy"
                />
              </div>
              <div className="about-content">
                <span className="section-kicker">About the Project</span>
                <h2>{project.name}</h2>
                <div className="description-content">
                  {project.description.split('\n\n').slice(0, 2).map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What We Do - Activities */}
        {project.activities && project.activities.length > 0 && (
          <section className="project-activities">
            <div className="container">
              <div className="section-header">
                <span className="section-kicker">Our Approach</span>
                <h2>What We Do</h2>
              </div>
              <div className="activities-timeline">
                {project.activities.map((activity, index) => (
                  <article className={`activity-block ${index % 2 === 1 ? 'is-reversed' : ''}`} key={activity.id}>
                    <div className="activity-number">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="activity-content">
                      <h3>{activity.title}</h3>
                      <p>{activity.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Who This Helps - Beneficiaries */}
        {project.beneficiaries && (
          <section className="project-beneficiaries">
            <div className="container">
              <div className="beneficiaries-grid">
                <div className="beneficiaries-image">
                  <div className="image-pattern" aria-hidden="true"></div>
                  <img 
                    src={project.gallery?.[1]?.image_url || '/assets/highlight-1.png'} 
                    alt="Community beneficiaries"
                    loading="lazy"
                  />
                </div>
                <div className="beneficiaries-text">
                  <span className="section-kicker">Who We Serve</span>
                  <h2>Building Resilient Communities</h2>
                  <ul className="beneficiaries-list">
                    {project.beneficiaries.split('\n').filter(line => line.trim()).map((line, idx) => (
                      <li key={idx}>
                        <Icon name="check" size={18} />
                        <span>{line.replace(/^[•\-]\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Skills Needed */}
        {project.skills_needed && project.skills_needed.length > 0 && (
          <section className="project-skills">
            <div className="container">
              <div className="skills-banner">
                <div className="skills-intro">
                  <h2>Join Our Team</h2>
                  <p>We're looking for passionate volunteers with these skills:</p>
                </div>
                <div className="skills-cloud">
                  {project.skills_needed.map((skill, index) => (
                    <span className={`skill-pill skill-color-${(index % 4) + 1}`} key={index}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Impact Section - Goals & Outcomes combined */}
        {(project.goals?.length > 0 || project.expected_outcomes) && (
          <section className="project-impact">
            <div className="container">
              <div className="section-header center">
                <span className="section-kicker">Making a Difference</span>
                <h2>Goals & Impact</h2>
              </div>
              <div className="impact-grid">
                {project.goals && project.goals.length > 0 && (
                  <div className="impact-card goals-card">
                    <div className="impact-icon">
                      <Icon name="target" size={32} />
                    </div>
                    <h3>Our Goals</h3>
                    <ul>
                      {project.goals.slice(0, 4).map((item) => (
                        <li key={item.id}>{item.goal}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {project.expected_outcomes && (
                  <div className="impact-card outcomes-card">
                    <div className="impact-icon">
                      <Icon name="heart" size={32} />
                    </div>
                    <h3>Expected Outcomes</h3>
                    <ul>
                      {project.expected_outcomes.split('\n').filter(line => line.trim()).slice(0, 4).map((line, idx) => (
                        <li key={idx}>{line.replace(/^[•\-]\s*/, '')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* How You Can Help - Volunteer Roles */}
        {project.volunteerRoles && project.volunteerRoles.length > 0 && (
          <section className="project-roles">
            <div className="container">
              <div className="section-header center">
                <span className="section-kicker">Get Involved</span>
                <h2>Volunteer Opportunities</h2>
              </div>
              <div className="roles-showcase">
                {project.volunteerRoles.map((role, index) => {
                  const [title, ...descParts] = role.role_description.split(':');
                  const description = descParts.join(':').trim() || title;
                  return (
                    <div className="role-showcase-card" key={role.id}>
                      <div className={`role-accent accent-${(index % 4) + 1}`}></div>
                      <h4>{descParts.length > 0 ? title : 'Volunteer Role'}</h4>
                      <p>{description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        {project.faq && project.faq.length > 0 && (
          <section className="project-faq">
            <div className="container">
              <h2>Frequently Asked Questions</h2>
              <div className="faq-list">
                {project.faq.map((item) => (
                  <div 
                    className={`faq-item ${openFaq === item.id ? 'open' : ''}`} 
                    key={item.id}
                  >
                    <button 
                      className="faq-question"
                      onClick={() => toggleFaq(item.id)}
                      aria-expanded={openFaq === item.id}
                    >
                      <span>{item.question}</span>
                      <Icon name={openFaq === item.id ? 'chevron' : 'arrow-right'} size={20} />
                    </button>
                    {openFaq === item.id && (
                      <div className="faq-answer">
                        <p>{item.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="project-cta">
          <div className="container">
            <div className="cta-card">
              <h2>Ready to Make a Difference?</h2>
              <p>
                Join our team of dedicated volunteers and help us achieve our mission.
                Whether you can contribute a few hours a week or more, every bit helps.
              </p>
              <div className="cta-buttons">
                <a href="/#contact" className="btn btn-accent">
                  Apply to Volunteer
                </a>
                <a href="/#contact" className="btn btn-primary">
                  Partner With Us
                </a>
                <Link to="/volunteer" className="btn btn-ghost">
                  Explore Other Projects
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter data={data} />
    </div>
  );
}
