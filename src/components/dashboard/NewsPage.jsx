import { useEffect, useState } from "react";
import { getNews } from "../../lib/dataService.js";

export default function NewsPage({ user, tenantId }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const data = await getNews(tenantId);
        setNews(data || []);
      } catch (error) {
        console.error("Error loading news:", error);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, [tenantId]);

  if (loading) {
    return <div className="news-page loading">Loading updates...</div>;
  }

  return (
    <div className="news-page">
      {news.length ? (
        <div className="news-list">
          {news.map((item) => {
            const type = item.type || item.category || "News";
            const date = item.date || item.date_posted || item.created_at;
            const rawExcerpt = item.excerpt || item.summary || item.content || "";
            const excerpt =
              rawExcerpt && String(rawExcerpt).length > 180
                ? `${String(rawExcerpt).slice(0, 177)}...`
                : rawExcerpt;
            return (
            <div className="news-card" key={item.id}>
              <div className="news-meta">
                <span className={`news-type ${String(type).toLowerCase()}`}>
                  {type}
                </span>
                <span className="news-date">{date ? String(date).slice(0, 10) : "—"}</span>
              </div>
              <h3 className="news-title">{item.title}</h3>
              {excerpt ? <p className="news-excerpt">{excerpt}</p> : null}
              {item.link ? (
                <a className="news-read-more" href={item.link}>
                  Read more →
                </a>
              ) : (
                <button className="news-read-more" type="button" disabled>
                  Read more →
                </button>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="no-data">
          <p>No updates yet.</p>
        </div>
      )}
    </div>
  );
}
