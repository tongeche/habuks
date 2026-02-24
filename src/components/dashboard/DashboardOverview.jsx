import { Icon } from "../icons.jsx";

const statCards = [
  { label: "Agriculture", value: "$5,200", meta: "This month", icon: "trending-up", tone: "green" },
  { label: "Members", value: "28", meta: "Active", icon: "users", tone: "purple" },
  { label: "Contributions", value: "$18,990", meta: "Total", icon: "wallet", tone: "amber" },
  { label: "Active projects", value: "4", meta: "Ongoing", icon: "briefcase", tone: "blue" },
];

const recentActivities = [
  {
    title: "Poultry Keeping Project",
    subtitle: "4 egg sales logged",
    date: "Sep 15",
    avatar: "/assets/avatar-1.webp",
  },
  {
    title: "Member Emma Green",
    subtitle: "Profile updated",
    date: "Sep 12",
    avatar: "/assets/avatar-2.webp",
  },
  {
    title: "Community Gardening",
    subtitle: "10 members assigned",
    date: "Sep 3",
    avatar: "/assets/avatar-3.webp",
  },
  {
    title: "Expense: Welfare Supplies",
    subtitle: "2 receipts added",
    date: "Aug 29",
    avatar: "/assets/avatar-1.webp",
  },
  {
    title: "Member David Lee joined",
    subtitle: "Role: Member",
    date: "Aug 22",
    avatar: "/assets/avatar-2.webp",
  },
];

const projectCards = [
  {
    title: "Community Fish Farming",
    description: "Sustainable tilapia farming for local markets",
    date: "Started: 1 Jun 2025",
    members: "8 members",
    progress: 50,
    tag: "Agriculture",
    image: "/assets/jpp_farm-bg.png",
  },
  {
    title: "Community Gardening",
    description: "Urban gardening initiative to improve food access",
    date: "Started: 6 Nov 2025",
    members: "9 members",
    progress: 45,
    tag: "Agriculture",
    image: "/assets/highlight-1.png",
  },
];

export default function DashboardOverview() {
  return (
    <div className="overview-v2">
      <section className="overview-v2-intro">
        <h2>Overview</h2>
        <p>Welcome to your collective operations dashboard.</p>
      </section>

      <section className="overview-v2-stats">
        {statCards.map((card) => (
          <article key={card.label} className={`overview-v2-stat-card tone-${card.tone}`}>
            <div className="overview-v2-stat-head">
              <span>{card.label}</span>
              <Icon name={card.icon} size={15} />
            </div>
            <div className="overview-v2-stat-value">{card.value}</div>
            <p>{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="overview-v2-mid">
        <article className="overview-v2-card overview-v2-income">
          <div className="overview-v2-card-head">
            <h3>Income Progress</h3>
            <button type="button">Last 6 Months</button>
          </div>
          <div className="overview-v2-chart">
            <svg viewBox="0 0 640 230" preserveAspectRatio="none" aria-hidden="true">
              <path
                d="M0 170 L640 170"
                stroke="rgba(125,145,180,0.35)"
                strokeWidth="1"
                strokeDasharray="6 6"
                fill="none"
              />
              <path
                d="M0 55 L640 55"
                stroke="rgba(125,145,180,0.2)"
                strokeWidth="1"
                strokeDasharray="6 6"
                fill="none"
              />
              <polyline
                points="40,170 170,120 300,108 430,76 560,72"
                fill="none"
                stroke="#7bc6b2"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <polyline
                points="40,170 170,146 300,127 430,96 560,86"
                fill="none"
                stroke="#7bc6b2"
                strokeOpacity="0.45"
                strokeWidth="2"
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
              <circle cx="560" cy="72" r="5.5" fill="#66bca7" />
            </svg>
            <span className="overview-v2-chart-value">$5,200</span>
          </div>
          <div className="overview-v2-income-foot">
            <div>
              <strong>Total Income Year To Date</strong>
              <span>$78,400 / $90,000</span>
            </div>
            <div className="overview-v2-progress">
              <span style={{ width: "87%" }} />
            </div>
            <button type="button" className="overview-v2-primary-btn">
              Open Project
            </button>
          </div>
        </article>

        <article className="overview-v2-card overview-v2-activity">
          <h3>Recent Activity</h3>
          <div className="overview-v2-activity-list">
            {recentActivities.map((item) => (
              <div key={`${item.title}-${item.date}`} className="overview-v2-activity-item">
                <img src={item.avatar} alt="" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.subtitle}</p>
                </div>
                <span>{item.date}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="overview-v2-bottom">
        <article className="overview-v2-card overview-v2-projects">
          <div className="overview-v2-card-head">
            <h3>Active Projects</h3>
            <button type="button">View All Projects</button>
          </div>
          <div className="overview-v2-project-grid">
            {projectCards.map((project) => (
              <article key={project.title} className="overview-v2-project-card">
                <div className="overview-v2-project-image">
                  <img src={project.image} alt={project.title} loading="lazy" />
                  <span>{project.tag}</span>
                </div>
                <div className="overview-v2-project-body">
                  <h4>{project.title}</h4>
                  <p>{project.description}</p>
                  <small>
                    {project.date} · {project.members}
                  </small>
                  <div className="overview-v2-project-foot">
                    <button type="button" className="overview-v2-primary-btn">
                      Open Project
                    </button>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="overview-v2-progress">
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="overview-v2-card overview-v2-members">
          <div className="overview-v2-card-head">
            <h3>Members Activity</h3>
            <button type="button">View All</button>
          </div>
          <div className="overview-v2-members-wrap">
            <div className="overview-v2-members-stats">
              <p>
                <span className="dot active" />
                Active <strong>28</strong>
              </p>
              <p>
                <span className="dot inactive" />
                Inactive <strong>7</strong>
              </p>
            </div>
            <div className="overview-v2-donut" aria-hidden="true">
              <span>50%</span>
            </div>
          </div>
          <button type="button" className="overview-v2-primary-btn overview-v2-members-btn">
            View All Projects
          </button>
        </article>
      </section>
    </div>
  );
}
