export default function NewsPage({ user }) {
  const news = [
    {
      id: 1,
      title: "JPP Poultry Project Reaches 500 Chicks Milestone",
      date: "2026-01-06",
      excerpt: "Our poultry incubation initiative has successfully hatched its 500th chick, marking a major achievement for the group.",
      type: "News",
    },
    {
      id: 2,
      title: "Monthly Meeting Scheduled for January 12",
      date: "2026-01-04",
      excerpt: "All members are invited to attend the monthly general meeting. Agenda includes welfare review and project updates.",
      type: "Update",
    },
    {
      id: 3,
      title: "Groundnut Processing Training Completed",
      date: "2025-12-20",
      excerpt: "Members completed a 3-day training on peanut butter processing and hygiene standards.",
      type: "Blog",
    },
  ];

  return (
    <div className="news-page">
      <div className="news-list">
        {news.map((item) => (
          <div className="news-card" key={item.id}>
            <div className="news-meta">
              <span className={`news-type ${item.type.toLowerCase()}`}>{item.type}</span>
              <span className="news-date">{item.date}</span>
            </div>
            <h3 className="news-title">{item.title}</h3>
            <p className="news-excerpt">{item.excerpt}</p>
            <button className="news-read-more">Read more →</button>
          </div>
        ))}
      </div>
    </div>
  );
}
