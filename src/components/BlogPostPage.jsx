import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";
import "../styles/blog.css";

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

// Simple markdown to HTML converter
function markdownToHtml(md) {
  if (!md) return "";
  let html = md;

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy" />');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Inline code
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Paragraphs
  html = html
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (
        block.startsWith("<h") ||
        block.startsWith("<ul") ||
        block.startsWith("<ol") ||
        block.startsWith("<blockquote") ||
        block.startsWith("<pre") ||
        block.startsWith("<hr")
      ) {
        return block;
      }
      return `<p>${block.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return html;
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const data = useMemo(getLandingData, []);
  const blog = useMemo(getBlogData, []);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Find post data from blog-data.js
  const allPosts = blog?.posts ?? [];
  const featured = blog?.featured ?? {};
  
  const post = useMemo(() => {
    // Check if it's the featured post
    if (featured.href === `/blog/${slug}`) {
      return featured;
    }
    // Check regular posts
    return allPosts.find((p) => p.href === `/blog/${slug}`);
  }, [slug, allPosts, featured]);

  // Fetch markdown content
  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(false);

    fetch(`/blog/${slug}.md`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [slug]);

  const htmlContent = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div className="app-shell blog-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader data={data} hideTopBar anchorBase="/" />

      <main id="main" className="blog-page blog-post-page">
        {/* Decorative Background */}
        <div className="blog-bg" aria-hidden="true">
          <div className="blog-bg-gradient" />
          <div className="blog-bg-shape blog-bg-shape--1" />
          <div className="blog-bg-shape blog-bg-shape--2" />
        </div>

        <article className="blog-post-container">
          <div className="container">
            {/* Back Link */}
            <Link to="/blog" className="blog-post-back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to Blog
            </Link>

            {loading && (
              <div className="blog-post-loading">
                <div className="blog-post-spinner" />
                <p>Loading article...</p>
              </div>
            )}

            {error && !loading && (
              <div className="blog-post-error">
                <h2>Article Not Found</h2>
                <p>Sorry, this article doesn't exist or hasn't been published yet.</p>
                <Link to="/blog" className="blog-post-error-link">
                  Return to Blog
                </Link>
              </div>
            )}

            {!loading && !error && post && (
              <>
                {/* Post Header */}
                <header className="blog-post-header">
                  <span className="blog-post-category-badge">{post.category}</span>
                  <h1 className="blog-post-title">{post.title}</h1>
                  <p className="blog-post-excerpt-large">{post.excerpt}</p>
                  
                  <div className="blog-post-meta-header">
                    <div className="blog-post-author-info">
                      <img
                        src={post.author?.avatar}
                        alt=""
                        className="blog-post-author-avatar"
                      />
                      <div>
                        <span className="blog-post-author-name">{post.author?.name}</span>
                        {post.author?.role && (
                          <span className="blog-post-author-role">{post.author?.role}</span>
                        )}
                      </div>
                    </div>
                    <div className="blog-post-date-info">
                      <span>{post.date}</span>
                      <span className="blog-post-dot">·</span>
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </header>

                {/* Featured Image */}
                {post.image && (
                  <div className="blog-post-featured-image">
                    <img src={post.image} alt="" loading="lazy" />
                  </div>
                )}

                {/* Post Content */}
                <div
                  className="blog-post-content"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />

                {/* Post Footer */}
                <footer className="blog-post-footer">
                  <div className="blog-post-share">
                    <span>Share this article:</span>
                    <div className="blog-post-share-links">
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="blog-post-share-btn"
                        aria-label="Share on Twitter"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </a>
                      <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="blog-post-share-btn"
                        aria-label="Share on LinkedIn"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(window.location.href)}
                        className="blog-post-share-btn"
                        aria-label="Copy link"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <Link to="/blog" className="blog-post-back-bottom">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to all articles
                  </Link>
                </footer>
              </>
            )}
          </div>
        </article>
      </main>

      <SiteFooter data={data} />
    </div>
  );
}
