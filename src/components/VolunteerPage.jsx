import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import { Icon } from "./icons.jsx";
import { getPublicProjects } from "../lib/dataService.js";

const getSiteData = () => {
  if (typeof window !== "undefined" && window.siteData) {
    return window.siteData();
  }
  return {};
};

export default function VolunteerPage() {
  const data = useMemo(getSiteData, []);

  return (
    <div className="app-shell volunteer-page-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} />
      
      <main id="main" className="page-body">
        {/* Hero Section */}
        <VolunteerHero />
        
        {/* What is Volunteering */}
        <WhatIsSection />
        
        {/* How It Works */}
        <HowItWorksSection />
        
        {/* Projects to Join */}
        <ProjectsSection />
        
        {/* Why Join Us */}
        <WhyJoinSection />
        
        {/* Testimonials */}
        <TestimonialsSection />
        
        {/* Signup CTA Banner */}
        <SignupBanner />
      </main>
      
      <SiteFooter data={data} />
    </div>
  );
}


/* ===== HERO SECTION ===== */
function VolunteerHero() {
  return (
    <section className="volunteer-hero">
      <div className="volunteer-hero-bg" aria-hidden="true">
        <div className="volunteer-hero-shape shape-1"></div>
        <div className="volunteer-hero-shape shape-2"></div>
        <div className="volunteer-hero-shape shape-3"></div>
      </div>
      <div className="container volunteer-hero-inner">
        <div className="volunteer-hero-content">
          <p className="volunteer-hero-eyebrow">Make a Difference</p>
          <h1>Become a Volunteer</h1>
          <p className="volunteer-hero-intro">
            Join our community of dedicated volunteers making real impact. 
            Offer your time, skills, or resources to support community action 
            and help build sustainable livelihoods in your community.
          </p>
          <div className="volunteer-hero-actions">
            <a className="btn btn-primary" href="/#contact">
              Request an Invite
            </a>
            <a className="btn btn-ghost" href="#why-volunteer">
              Learn More
            </a>
          </div>
        </div>
        <div className="volunteer-hero-visual">
          <svg viewBox="0 0 400 350" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Community illustration */}
            <ellipse cx="200" cy="320" rx="180" ry="25" fill="#e6f7f2"/>
            <circle cx="200" cy="115" r="32" fill="#398426"/>
            <rect x="175" y="205" width="50" height="80" rx="6" fill="#2d7a46"/>
            
            {/* Left figure */}
            <circle cx="90" cy="180" r="35" fill="#6ca71f"/>
            <circle cx="90" cy="145" r="25" fill="#398426"/>
            <rect x="70" y="215" width="40" height="65" rx="5" fill="#6ca71f"/>
            
            {/* Right figure */}
            <circle cx="310" cy="180" r="35" fill="#6ca71f"/>
            <circle cx="310" cy="145" r="25" fill="#398426"/>
            <rect x="290" y="215" width="40" height="65" rx="5" fill="#6ca71f"/>
            
            {/* Connection arcs */}
            <path d="M125 170 Q165 130 175 160" stroke="#b6ead1" strokeWidth="3" strokeDasharray="6 3" fill="none"/>
            <path d="M275 170 Q235 130 225 160" stroke="#b6ead1" strokeWidth="3" strokeDasharray="6 3" fill="none"/>
            
            {/* Heart symbol above */}
            <path d="M200 60 C185 45 160 50 160 70 C160 90 200 110 200 110 C200 110 240 90 240 70 C240 50 215 45 200 60Z" fill="#d21f2b"/>
            
            {/* Decorative circles */}
            <circle cx="50" cy="80" r="10" fill="#b6ead1"/>
            <circle cx="350" cy="70" r="12" fill="#b6ead1"/>
            <circle cx="380" cy="200" r="8" fill="#2d7a46"/>
            <circle cx="20" cy="220" r="6" fill="#2d7a46"/>
            <circle cx="140" cy="50" r="6" fill="#6ca71f"/>
            <circle cx="260" cy="45" r="5" fill="#6ca71f"/>
            <circle cx="330" cy="280" r="7" fill="#b6ead1"/>
            <circle cx="70" cy="290" r="5" fill="#b6ead1"/>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ===== WHAT IS SECTION ===== */
function WhatIsSection() {
  return (
    <section className="volunteer-what-is">
      <div className="container">
        <div className="what-is-grid">
          <div className="what-is-image">
            <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Volunteers working together illustration */}
              <rect x="20" y="20" width="360" height="260" rx="20" fill="#f0fdf4"/>
              
              {/* Ground */}
              <ellipse cx="200" cy="260" rx="160" ry="20" fill="#e6f7f2"/>
              
              {/* Left person planting */}
              <circle cx="100" cy="160" r="25" fill="#2d7a46"/>
              <circle cx="100" cy="135" r="18" fill="#398426"/>
              <path d="M85 185 Q100 210 115 185" fill="#2d7a46"/>
              
              {/* Center person with tools */}
              <circle cx="200" cy="140" r="30" fill="#2d7a46"/>
              <circle cx="200" cy="110" r="22" fill="#398426"/>
              <rect x="185" y="170" width="30" height="60" rx="4" fill="#2d7a46"/>
              
              {/* Right person helping */}
              <circle cx="300" cy="160" r="25" fill="#6ca71f"/>
              <circle cx="300" cy="135" r="18" fill="#398426"/>
              <path d="M285 185 Q300 210 315 185" fill="#6ca71f"/>
              
              {/* Plants/seedlings */}
              <path d="M70 240 Q75 220 80 240" stroke="#2d7a46" strokeWidth="3" fill="none"/>
              <circle cx="75" cy="215" r="8" fill="#6ca71f"/>
              
              <path d="M150 235 Q155 210 160 235" stroke="#2d7a46" strokeWidth="3" fill="none"/>
              <circle cx="155" cy="205" r="10" fill="#398426"/>
              
              <path d="M245 238 Q250 215 255 238" stroke="#2d7a46" strokeWidth="3" fill="none"/>
              <circle cx="250" cy="210" r="9" fill="#6ca71f"/>
              
              <path d="M320 242 Q325 225 330 242" stroke="#2d7a46" strokeWidth="3" fill="none"/>
              <circle cx="325" cy="220" r="7" fill="#398426"/>
              
              {/* Sun */}
              <circle cx="340" cy="60" r="25" fill="#fbbf24"/>
              <path d="M340 25 V15 M340 95 V105 M305 60 H295 M375 60 H385 M315 35 L308 28 M365 85 L372 92 M365 35 L372 28 M315 85 L308 92" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
              
              {/* Hearts/connection symbols */}
              <path d="M140 100 C135 95 125 97 125 105 C125 113 140 120 140 120 C140 120 155 113 155 105 C155 97 145 95 140 100Z" fill="#d21f2b" opacity="0.7"/>
              <path d="M260 95 C257 92 251 93 251 98 C251 103 260 107 260 107 C260 107 269 103 269 98 C269 93 263 92 260 95Z" fill="#d21f2b" opacity="0.7"/>
            </svg>
          </div>
          <div className="what-is-content">
            <h2>What Does It Mean to Get Involved?</h2>
            <p>
              At Jongol Foundation, we believe in the power of community action. 
              Getting involved means becoming part of a network of dedicated individuals 
              who share a common goal: improving livelihoods and creating sustainable change.
            </p>
            <p>
              Whether you have a few hours to spare or want to make a long-term commitment, 
              your contribution matters. Every action, big or small, helps us move closer 
              to our vision of a self-reliant and empowered community.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== TYPES SECTION (Volunteer vs Member) ===== */
function TypesSection({ onSelectType }) {
  return (
    <section className="volunteer-types" id="types">
      <div className="container">
        <div className="types-header">
          <h2>Choose How You Want to Contribute</h2>
          <p>We offer two ways to get involved based on your availability and commitment level.</p>
        </div>
        
        <div className="types-grid">
          {/* Volunteer Card */}
          <div className="type-detail-card">
            <div className="type-icon-large">
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" fill="#e6f7f2"/>
                <path d="M40 22c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z" fill="#2d7a46"/>
                <path d="M40 40c-8 0-24 4-24 12v8h48v-8c0-8-16-12-24-12z" fill="#2d7a46"/>
                <path d="M56 30h-10M51 25v10" stroke="#398426" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Volunteer</h3>
            <p className="type-tagline">Offer Your Time & Skills</p>
            <p className="type-description">
              A volunteer is anyone willing to offer their time, skills, or resources 
              to support community action. No long-term commitment required — contribute 
              when you can.
            </p>
            <ul className="type-features">
              <li><Icon name="check" size={16} /> Flexible time commitment</li>
              <li><Icon name="check" size={16} /> Use your unique skills</li>
              <li><Icon name="check" size={16} /> Project-based involvement</li>
              <li><Icon name="check" size={16} /> Community networking</li>
              <li><Icon name="check" size={16} /> Personal growth opportunities</li>
            </ul>
            <button 
              className="btn btn-primary type-btn"
              onClick={() => onSelectType("volunteer")}
            >
              Become a Volunteer
            </button>
          </div>
          
          {/* Member Card */}
          <div className="type-detail-card featured">
            <div className="featured-badge">Most Popular</div>
            <div className="type-icon-large">
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" fill="#e6f7f2"/>
                <path d="M28 24c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z" fill="#2d7a46"/>
                <path d="M52 24c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z" fill="#2d7a46"/>
                <path d="M28 38c-5 0-14 2.5-14 7.5V52h28v-6.5c0-5-9-7.5-14-7.5z" fill="#2d7a46"/>
                <path d="M52 38c-5 0-14 2.5-14 7.5V52h28v-6.5c0-5-9-7.5-14-7.5z" fill="#2d7a46"/>
              </svg>
            </div>
            <h3>Member</h3>
            <p className="type-tagline">Join Our Community</p>
            <p className="type-description">
              A member is one who has joined the group and supports its mission 
              through shared responsibility. Enjoy full benefits and participate 
              in governance.
            </p>
            <ul className="type-features">
              <li><Icon name="check" size={16} /> Full voting rights</li>
              <li><Icon name="check" size={16} /> Access to welfare programs</li>
              <li><Icon name="check" size={16} /> Share in group benefits</li>
              <li><Icon name="check" size={16} /> Leadership opportunities</li>
              <li><Icon name="check" size={16} /> Priority project participation</li>
            </ul>
            <button 
              className="btn btn-accent type-btn"
              onClick={() => onSelectType("member")}
            >
              Become a Member
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===== WHY JOIN SECTION ===== */
function WhyJoinSection() {
  const reasons = [
    {
      icon: "heart",
      title: "Make Real Impact",
      description: "Your contribution directly improves livelihoods and creates lasting change in the community."
    },
    {
      icon: "users",
      title: "Build Connections",
      description: "Join a network of like-minded individuals committed to community development."
    },
    {
      icon: "briefcase",
      title: "Develop Skills",
      description: "Gain hands-on experience in project management, agriculture, and enterprise development."
    }
  ];

  return (
    <section className="volunteer-why-join" id="why-volunteer">
      <div className="container">
        <h2>Why Join Jongol Foundation?</h2>
        <div className="why-join-grid">
          {reasons.map((reason) => (
            <div className="why-join-card" key={reason.title}>
              <div className="why-join-icon">
                <Icon name={reason.icon} size={28} />
              </div>
              <h3>{reason.title}</h3>
              <p>{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== HOW IT WORKS SECTION ===== */
function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "Pick a Project",
      description: "Browse our active projects and find one that matches your skills and interests."
    },
    {
      number: "2",
      title: "Get in Touch",
      description: "Reach out via our contact page to express your interest and learn more."
    },
    {
      number: "3",
      title: "Onboarding",
      description: "Attend an orientation session and start contributing to the community."
    }
  ];

  return (
    <section className="volunteer-how-it-works">
      <div className="container">
        <h2>How It Works</h2>
        <div className="how-steps">
          {steps.map((step, index) => (
            <div className="how-step" key={step.number}>
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
              {index < steps.length - 1 && <div className="step-connector" aria-hidden="true"></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== PROJECTS SECTION ===== */
function ProjectsSection() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await getPublicProjects();
        setProjects(data);
      } catch (err) {
        console.error("Error loading projects:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  // Helper to format skills array for display
  const formatSkills = (skills) => {
    if (!skills || skills.length === 0) return "Various skills welcome";
    return skills.slice(0, 3).join(", ");
  };

  // Render project illustration based on code
  const renderProjectIllustration = (code) => {
    if (code === "JPP") {
      return (
        <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" rx="12" fill="#f0fdf4"/>
          <ellipse cx="200" cy="260" rx="150" ry="20" fill="#e6f7f2"/>
          <rect x="80" y="140" width="120" height="100" fill="#8B4513"/>
          <polygon points="140,100 60,140 220,140" fill="#d97706"/>
          <rect x="120" y="180" width="40" height="60" fill="#5a3510"/>
          <ellipse cx="280" cy="220" rx="25" ry="20" fill="#fff"/>
          <circle cx="295" cy="205" r="12" fill="#fff"/>
          <path d="M295 200 L305 195 L295 198" fill="#d21f2b"/>
          <circle cx="300" cy="203" r="2" fill="#000"/>
          <ellipse cx="320" cy="230" rx="22" ry="18" fill="#fbbf24"/>
          <circle cx="335" cy="218" r="10" fill="#fbbf24"/>
          <path d="M335 215 L343 211 L335 214" fill="#d21f2b"/>
          <ellipse cx="260" cy="250" rx="10" ry="12" fill="#fef3c7"/>
          <ellipse cx="340" cy="255" rx="8" ry="10" fill="#fef3c7"/>
          <circle cx="350" cy="50" r="25" fill="#fbbf24"/>
        </svg>
      );
    }
    // Default groundnut illustration
    return (
      <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" rx="12" fill="#fef3c7"/>
        <ellipse cx="200" cy="260" rx="150" ry="20" fill="#fde68a"/>
        <rect x="150" y="120" width="100" height="130" rx="10" fill="#92400e"/>
        <rect x="155" y="110" width="90" height="20" rx="5" fill="#78350f"/>
        <rect x="165" y="145" width="70" height="40" rx="4" fill="#fef3c7"/>
        <text x="200" y="170" textAnchor="middle" fontSize="10" fill="#78350f">PEANUT</text>
        <ellipse cx="80" cy="200" rx="25" ry="12" fill="#d97706"/>
        <ellipse cx="90" cy="200" rx="25" ry="12" fill="#b45309"/>
        <ellipse cx="320" cy="210" rx="22" ry="10" fill="#d97706"/>
        <ellipse cx="330" cy="210" rx="22" ry="10" fill="#b45309"/>
        <ellipse cx="100" cy="240" rx="20" ry="9" fill="#d97706"/>
        <ellipse cx="300" cy="245" rx="18" ry="8" fill="#b45309"/>
        <path d="M200 120 Q190 80 170 70" stroke="#16a34a" strokeWidth="3" fill="none"/>
        <ellipse cx="165" cy="65" rx="15" ry="10" fill="#22c55e"/>
        <path d="M200 120 Q210 80 230 70" stroke="#16a34a" strokeWidth="3" fill="none"/>
        <ellipse cx="235" cy="65" rx="15" ry="10" fill="#22c55e"/>
      </svg>
    );
  };

  if (loading) {
    return (
      <section className="volunteer-projects">
        <div className="container">
          <div className="projects-header">
            <h2>Projects You Can Join</h2>
            <p>Choose a project that matches your skills and interests.</p>
          </div>
          <div className="projects-loading">
            <div className="loading-spinner"></div>
            <p>Loading projects...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="volunteer-projects">
      <div className="container">
        <div className="projects-header">
          <h2>Projects You Can Join</h2>
          <p>Choose a project that matches your skills and interests.</p>
        </div>
        
        {projects.map((project) => (
          <div className="project-feature-card" key={project.code}>
            <div className="project-feature-content">
              <h3>{project.name}</h3>
              <div className="project-details-grid">
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="heart" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Purpose</span>
                    <span className="detail-value">{project.short_description || project.tagline}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="calendar" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Timeline</span>
                    <span className="detail-value">{project.timeline_status}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="briefcase" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Skills needed</span>
                    <span className="detail-value">{formatSkills(project.skills_needed)}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="clock" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Time commitment</span>
                    <span className="detail-value">{project.time_commitment}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="users" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Team size</span>
                    <span className="detail-value">{project.team_size}</span>
                  </div>
                </div>
                <div className="project-detail-item">
                  <div className="detail-icon">
                    <Icon name="location" size={20} />
                  </div>
                  <div className="detail-text">
                    <span className="detail-label">Location</span>
                    <span className="detail-value">{project.location}</span>
                  </div>
                </div>
              </div>
              <div className="project-feature-actions">
                <Link to={`/projects/${project.code}`} className="btn btn-primary">
                  Learn More
                </Link>
              </div>
            </div>
            <div className="project-feature-image">
              <div className="project-image-placeholder">
                {renderProjectIllustration(project.code)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===== TESTIMONIALS SECTION ===== */
function TestimonialsSection() {
  const testimonials = [
    {
      quote: "Joining Jongol has transformed my life. I've learned valuable skills and made lifelong friends.",
      name: "Mary Akinyi",
      role: "Member since 2023"
    },
    {
      quote: "Volunteering here gave me purpose. Seeing the direct impact of our work is incredibly rewarding.",
      name: "John Ochieng",
      role: "Volunteer"
    },
    {
      quote: "The community support is amazing. We truly work together to uplift each other.",
      name: "Grace Atieno",
      role: "Committee Member"
    }
  ];

  return (
    <section className="volunteer-testimonials">
      <div className="container">
        <h2>What Our Members Say</h2>
        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <div className="testimonial-card" key={testimonial.name}>
              <div className="testimonial-quote">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <path d="M10 16H6c0-4.4 3.6-8 8-8v4c-2.2 0-4 1.8-4 4zm12 0h-4c0-4.4 3.6-8 8-8v4c-2.2 0-4 1.8-4 4z" fill="#2d7a46" opacity="0.3"/>
                </svg>
                <p>"{testimonial.quote}"</p>
              </div>
              <div className="testimonial-author">
                <div className="author-avatar">
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="author-name">{testimonial.name}</p>
                  <p className="author-role">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ===== SIGNUP CTA BANNER ===== */
function SignupBanner() {
  return (
    <section className="volunteer-signup-banner">
      <div className="container">
        <div className="signup-banner-inner">
          <div className="signup-banner-content">
            <h2>Ready to Make a Difference?</h2>
            <p>
              We are invite-only. Contact us to request access and we will set up your account.
            </p>
          </div>
          <div className="signup-banner-actions">
            <a className="btn btn-accent btn-large" href="/#contact">
              Request an Invite
            </a>
            <a href="/" className="btn btn-ghost-light">
              Back to Home
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
