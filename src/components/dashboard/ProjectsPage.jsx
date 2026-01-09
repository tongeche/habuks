import { useState, useEffect } from "react";
import { getProjectsWithMembership, joinProject, leaveProject } from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

export default function ProjectsPage({ user }) {
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
          {projects.map((project) => (
            <div className="project-card-modern" key={project.id}>
              <div className="project-card-main">
                <div className="project-icon">
                  <Icon name="star" size={24} />
                </div>
                <div className="project-info">
                  <h3>{project.name}</h3>
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
                  <a 
                    href={`/projects/${project.code || project.id}`}
                    className="btn-view-project"
                    title="View project details"
                  >
                    <Icon name="arrow-right" size={18} />
                  </a>
                </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
