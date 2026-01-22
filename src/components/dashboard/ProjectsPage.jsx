import { useState, useEffect } from "react";
import { getProjectsWithMembership, joinProject, leaveProject } from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

const projectPageMap = {
  JPP: "projects-jpp",
  JGF: "projects-jgf",
};

export default function ProjectsPage({ user, setActivePage }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    loadProjects();
  }, [user]);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await getProjectsWithMembership(user?.id);
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleJoin = async (projectId) => {
    if (!user?.id) return;
    
    setJoiningId(projectId);
    try {
      await joinProject(projectId, user.id);
      await loadProjects(); // Refresh to show updated status
    } catch (error) {
      console.error("Error joining project:", error);
      alert(error.message);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (projectId) => {
    if (!user?.id) return;
    
    if (!confirm("Are you sure you want to leave this project?")) return;
    
    setJoiningId(projectId);
    try {
      await leaveProject(projectId, user.id);
      await loadProjects();
    } catch (error) {
      console.error("Error leaving project:", error);
      alert(error.message);
    } finally {
      setJoiningId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active": return "#10b981";
      case "planning": return "#f59e0b";
      case "completed": return "#6b7280";
      default: return "#10b981";
    }
  };

  const getProjectImage = (project) => {
    const code = project?.code ? String(project.code).trim().toUpperCase() : "";
    if (code === "JPP") return "/assets/jpp_farm-bg.png";
    if (code === "JGF") return "/assets/hero-2.webp";
    return "/assets/hero-1.png";
  };

  const getProjectBadgeIcon = (project) => {
    const code = project?.code ? String(project.code).trim().toUpperCase() : "";
    if (code === "JPP") return "feather";
    if (code === "JGF") return "coins";
    return "briefcase";
  };

  const getProjectLead = (project) => {
    const base =
      project?.short_description ||
      project?.lead_description ||
      project?.description ||
      "";
    if (base) {
      const trimmed = String(base).trim();
      if (trimmed.length <= 90) return trimmed;
      return `${trimmed.slice(0, 87)}...`;
    }
    const code = project?.code ? String(project.code).trim().toUpperCase() : "";
    if (code === "JPP") return "Reducing poultry losses and improving member incomes.";
    if (code === "JGF") return "Adding value to groundnuts for reliable household earnings.";
    return "Supporting member-led income activities in the community.";
  };

  const handleManageProject = (project) => {
    const code = project?.code ? String(project.code).trim().toUpperCase() : "";
    const target = projectPageMap[code];
    if (target && setActivePage) {
      setActivePage(target);
    }
  };

  if (loading) {
    return (
      <div className="projects-page-modern">
        <div className="page-header">
          <h1>IGA Projects</h1>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="projects-page-modern">
      <div className="page-header">
        <div className="page-header-text">
          <h1>IGA Projects</h1>
          <p>Income Generating Activities to support our members</p>
        </div>
      </div>

      <div className="projects-tabs">
        <button className="project-tab active">
          Active <span className="tab-count">{projects.filter(p => p.status?.toLowerCase() === 'active').length}</span>
        </button>
        <button className="project-tab">
          Completed <span className="tab-count">{projects.filter(p => p.status?.toLowerCase() === 'completed').length}</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <Icon name="folder" size={48} />
          <h3>No projects yet</h3>
          <p>IGA projects will appear here once they are created.</p>
        </div>
      ) : (
        <div className="projects-list-modern">
          {projects.map((project) => {
            const role = project.membership?.role || "";
            const isProjectManager = !!(
              user && (
                user.role === "admin" ||
                user.role === "superadmin" ||
                project.project_leader === user.id ||
                ["project manager", "project_manager", "admin"].includes(role?.toLowerCase())
              )
            );

            return (
              <div className="project-card-modern" key={project.id}>
                <div className="project-card-media">
                  <img src={getProjectImage(project)} alt={`${project.name} cover`} loading="lazy" />
                  <span className="project-card-badge">
                    <Icon name={getProjectBadgeIcon(project)} size={16} />
                  </span>
                </div>
                <div className="project-card-main">
                  <div className="project-icon">
                    <Icon name="star" size={24} />
                  </div>
                  <div className="project-info">
                    <div className="project-title-row">
                      <h3>{project.name}</h3>
                      {project.code && (
                        <span className="project-code-pill">{project.code}</span>
                      )}
                    </div>
                    <p className="project-lead">{getProjectLead(project)}</p>
                    <p className="project-desc">{project.description}</p>
                  </div>
                  <div className="project-progress">
                    <div className="progress-label">
                      <span 
                        className="status-dot" 
                        style={{ background: getStatusColor(project.status) }}
                      ></span>
                      <span>{project.status || "Active"}</span>
                    </div>
                    <div className="progress-bar-wrapper">
                      <div 
                        className="progress-bar-fill" 
                        style={{ 
                          width: project.status?.toLowerCase() === 'active' ? '50%' : 
                                 project.status?.toLowerCase() === 'completed' ? '100%' : '25%' 
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="project-actions-col">
                  {isProjectManager && (
                      <button
                        type="button"
                        className="btn-manage-project"
                        title="Manage project"
                        aria-label={`Manage ${project.name}`}
                        onClick={() => handleManageProject(project)}
                        disabled={!projectPageMap[String(project.code || "").trim().toUpperCase()]}
                      >
                        <Icon name="briefcase" size={16} />
                      </button>
                  )}
                    <a 
                      href={`/projects/${project.code || project.id}`}
                      className="btn-view-project"
                      title="View project details"
                    >
                      <Icon name="arrow-right" size={18} />
                    </a>
                  </div>
                </div>

                <div className="project-card-mobile-meta">
                  <span>
                    <Icon name="calendar" size={14} />
                    {formatDate(project.start_date)}
                  </span>
                  <span>
                    <Icon name="member" size={14} />
                    {project.member_count || 0} members
                  </span>
                  <span>
                    <Icon name="check-circle" size={14} />
                    {project.status || "Active"}
                  </span>
                </div>
                <div className="project-card-mobile-actions">
                  {isProjectManager && (
                    <button
                      type="button"
                      className="btn-manage-project is-compact"
                      aria-label={`Manage ${project.name}`}
                      onClick={() => handleManageProject(project)}
                      disabled={!projectPageMap[String(project.code || "").trim().toUpperCase()]}
                    >
                      <Icon name="briefcase" size={16} />
                      Manage
                    </button>
                  )}
                  {project.membership ? (
                    <button
                      className="btn-leave is-compact"
                      onClick={() => handleLeave(project.id)}
                      disabled={joiningId === project.id}
                    >
                      {joiningId === project.id ? "..." : "Leave"}
                    </button>
                  ) : (
                    <button
                      className="btn-join is-compact"
                      onClick={() => handleJoin(project.id)}
                      disabled={joiningId === project.id}
                    >
                      {joiningId === project.id ? "Joining..." : "Join"}
                    </button>
                  )}
                  <a
                    href={`/projects/${project.code || project.id}`}
                    className="btn-view-project is-compact"
                    title="View project details"
                  >
                    <Icon name="arrow-right" size={16} />
                  </a>
                </div>

                <div className="project-card-details">
                  <div className="project-detail-row">
                    <div className="detail-item">
                      <Icon name="calendar" size={14} />
                      <span>Started: {formatDate(project.start_date)}</span>
                    </div>
                    <div className="detail-item">
                      <Icon name="member" size={14} />
                      <span>{project.member_count} members</span>
                    </div>
                  </div>

                  <div className="project-membership">
                    {project.membership ? (
                      <div className="membership-status">
                        <div className="member-badge">
                          <Icon name="check-circle" size={16} />
                          <span>Member since {formatDate(project.membership.term_start)}</span>
                          {project.membership.role && project.membership.role !== "Member" && (
                            <span className="role-tag">{project.membership.role}</span>
                          )}
                        </div>
                        <button 
                          className="btn-leave"
                          onClick={() => handleLeave(project.id)}
                          disabled={joiningId === project.id}
                        >
                          {joiningId === project.id ? "..." : "Leave"}
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn-join"
                        onClick={() => handleJoin(project.id)}
                        disabled={joiningId === project.id}
                      >
                        {joiningId === project.id ? (
                          "Joining..."
                        ) : (
                          <>
                            <Icon name="plus" size={16} />
                            Join Project
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="projects-mobile-nav">
        <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("overview")}>
          <Icon name="home" size={20} />
          <span>Home</span>
        </button>
        <button type="button" className="projects-mobile-nav-btn active">
          <Icon name="briefcase" size={20} />
          <span>Projects</span>
        </button>
        <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("reports")}>
          <Icon name="trending-up" size={20} />
          <span>Reports</span>
        </button>
        <button type="button" className="projects-mobile-nav-btn" onClick={() => setActivePage?.("profile")}>
          <Icon name="user" size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
