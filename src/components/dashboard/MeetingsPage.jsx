export default function MeetingsPage({ user }) {
  const meetings = [
    {
      id: 1,
      date: "2026-01-12",
      type: "General Meeting",
      agenda: "Welfare review, project updates, payout schedule",
      minutes: null,
      status: "Upcoming",
    },
    {
      id: 2,
      date: "2025-12-08",
      type: "General Meeting",
      agenda: "Year-end review, 2026 planning",
      minutes: "Minutes available",
      status: "Completed",
    },
    {
      id: 3,
      date: "2025-11-10",
      type: "Project Committee",
      agenda: "JPP progress, budget review",
      minutes: "Minutes available",
      status: "Completed",
    },
  ];

  return (
    <div className="meetings-page">
      <div className="meetings-table-wrap">
        <table className="meetings-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Agenda</th>
              <th>Minutes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td>{m.date}</td>
                <td>{m.type}</td>
                <td>{m.agenda}</td>
                <td>
                  {m.minutes ? (
                    <a href="#" className="minutes-link">View</a>
                  ) : (
                    <span className="no-minutes">—</span>
                  )}
                </td>
                <td>
                  <span className={`status-badge ${m.status.toLowerCase()}`}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
