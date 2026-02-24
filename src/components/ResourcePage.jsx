import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
  return { resources: [] };
};

const parseMarkdownToChapters = (markdown) => {
  const lines = markdown.split("\n");
  const chapters = [];
  let currentChapter = null;
  let currentContent = [];

  lines.forEach((line) => {
    if (line.startsWith("# ")) {
      if (currentChapter) {
        currentChapter.content = currentContent.join("\n");
        chapters.push(currentChapter);
      }
      currentChapter = {
        id: line.replace("# ", "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: line.replace("# ", ""),
        content: "",
        lessons: []
      };
      currentContent = [];
    } else if (line.startsWith("## ") && currentChapter) {
      currentChapter.lessons.push({
        id: line.replace("## ", "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: line.replace("## ", "")
      });
      currentContent.push(line);
    } else {
      currentContent.push(line);
    }
  });

  if (currentChapter) {
    currentChapter.content = currentContent.join("\n");
    chapters.push(currentChapter);
  }

  return chapters;
};

const markdownToHtml = (markdown) => {
  if (!markdown) return "";
  
  let html = markdown
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
    .replace(/^---$/gim, "<hr>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  html = "<p>" + html + "</p>";
  html = html.replace(/<\/li><br><li>/g, "</li><li>");
  html = html.replace(/<p><li>/g, "<ul><li>");
  html = html.replace(/<\/li><\/p>/g, "</li></ul>");
  html = html.replace(/<\/li><br>/g, "</li>");
  html = html.replace(/<\/blockquote><br><blockquote>/g, " ");
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p><br><\/p>/g, "");
  html = html.replace(/<p><h/g, "<h");
  html = html.replace(/<\/h(\d)><\/p>/g, "</h$1>");
  html = html.replace(/<p><hr><\/p>/g, "<hr>");
  html = html.replace(/<p><ul>/g, "<ul>");
  html = html.replace(/<\/ul><\/p>/g, "</ul>");

  return html;
};

export default function ResourcePage() {
  const { slug } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState(0);
  const [completedChapters, setCompletedChapters] = useState([]);

  const data = useMemo(getLandingData, []);
  const resourcesData = useMemo(getResourcesData, []);
  
  const resource = useMemo(
    () => resourcesData.resources?.find((r) => r.slug === slug),
    [resourcesData, slug]
  );
  
  const otherResources = useMemo(
    () => resourcesData.resources?.filter((r) => r.slug !== slug) || [],
    [resourcesData, slug]
  );

  useEffect(() => {
    if (!resource) {
      setLoading(false);
      return;
    }

    fetch(resource.markdown)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [slug, resource]);

  useEffect(() => {
    const saved = localStorage.getItem(`resource-progress-${slug}`);
    if (saved) {
      setCompletedChapters(JSON.parse(saved));
    }
  }, [slug]);

  const chapters = useMemo(
    () => (content ? parseMarkdownToChapters(content) : []),
    [content]
  );
  
  const currentChapter = chapters[activeChapter];
  
  const progress = useMemo(
    () => chapters.length > 0 ? Math.round((completedChapters.length / chapters.length) * 100) : 0,
    [chapters.length, completedChapters.length]
  );

  const markAsComplete = () => {
    if (!completedChapters.includes(activeChapter)) {
      const updated = [...completedChapters, activeChapter];
      setCompletedChapters(updated);
      localStorage.setItem(`resource-progress-${slug}`, JSON.stringify(updated));
    }
    if (activeChapter < chapters.length - 1) {
      setActiveChapter(activeChapter + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToChapter = (index) => {
    setActiveChapter(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="resource-shell">
        <SiteHeader data={data} hideTopBar anchorBase="/" />
        <main className="resource-page">
          <div className="resource-loading">
            <div className="loading-spinner"></div>
            <p>Loading course...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="resource-shell">
        <SiteHeader data={data} hideTopBar anchorBase="/" />
        <main className="resource-page">
          <div className="resource-not-found">
            <span className="not-found-icon">📚</span>
            <h1>Course Not Found</h1>
            <p>The course you are looking for does not exist.</p>
            <Link to="/resources" className="btn-primary">Browse All Courses</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="resource-shell">
      <SiteHeader data={data} hideTopBar anchorBase="/" />

      <main className="resource-page course-view">
        <div className="course-header">
          <div className="container">
            <Link to="/resources" className="course-back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              All Courses
            </Link>

            <div className="course-header-content">
              <div className="course-header-info">
                <span className={`course-difficulty ${resource.difficulty?.toLowerCase()}`}>
                  {resource.difficulty}
                </span>
                <h1>{resource.title}</h1>
                <p>{resource.description}</p>
                <div className="course-stats">
                  <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {chapters.length} Chapters
                  </span>
                  <span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {resource.duration}
                  </span>
                </div>
              </div>
              <div className="course-header-image">
                <img src={resource.image} alt={resource.title} />
                <div className="course-progress-ring">
                  <svg viewBox="0 0 100 100">
                    <circle className="progress-bg" cx="50" cy="50" r="45" />
                    <circle className="progress-fill" cx="50" cy="50" r="45" strokeDasharray={`${progress * 2.83} 283`} />
                  </svg>
                  <span className="progress-text">{progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="course-content-wrapper">
          <div className="container">
            <div className="course-layout">
              <aside className="course-sidebar">
                <div className="course-sidebar-inner">
                  <h3>Course Content</h3>
                  <div className="course-chapters">
                    {chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        className={`course-chapter-item ${activeChapter === index ? "active" : ""} ${completedChapters.includes(index) ? "completed" : ""}`}
                        onClick={() => goToChapter(index)}
                      >
                        <span className="chapter-number">
                          {completedChapters.includes(index) ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="chapter-title">{chapter.title}</span>
                        {chapter.lessons.length > 0 && (
                          <span className="chapter-lessons">{chapter.lessons.length} lessons</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {otherResources.length > 0 && (
                  <div className="course-sidebar-other">
                    <h4>Other Courses</h4>
                    {otherResources.slice(0, 2).map((other) => (
                      <Link key={other.slug} to={`/resources/${other.slug}`} className="other-course-card">
                        <img src={other.image} alt={other.title} />
                        <div className="other-course-info">
                          <span className="other-course-title">{other.title}</span>
                          <span className="other-course-meta">{other.chapters} chapters</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </aside>

              <div className="course-main">
                <div className="course-chapter-header">
                  <span className="chapter-label">Chapter {activeChapter + 1} of {chapters.length}</span>
                  <h2>{currentChapter?.title}</h2>
                </div>

                <div
                  className="course-chapter-content"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(currentChapter?.content || "") }}
                />

                <div className="course-chapter-actions">
                  <button
                    className="btn-prev"
                    onClick={() => goToChapter(activeChapter - 1)}
                    disabled={activeChapter === 0}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>

                  {activeChapter < chapters.length - 1 ? (
                    <button className="btn-next" onClick={markAsComplete}>
                      {completedChapters.includes(activeChapter) ? "Next Chapter" : "Mark Complete & Continue"}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="btn-complete"
                      onClick={markAsComplete}
                      disabled={completedChapters.includes(activeChapter)}
                    >
                      {completedChapters.includes(activeChapter) ? (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Course Completed!
                        </>
                      ) : (
                        <>
                          Finish Course
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
