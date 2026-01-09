import { useState, useEffect } from "react";
import { getMemberContributions } from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

export default function ContributionsPage({ user }) {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContributions() {
      if (!user?.id) return;
      
      try {
        const data = await getMemberContributions(user.id);
        setContributions(data);
      } catch (error) {
        console.error("Error loading contributions:", error);
      } finally {
        setLoading(false);
      }
    }
    loadContributions();
  }, [user?.id]);

  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  const contributionCount = contributions.length;

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate next due date (2 weeks from last contribution or from join date)
  const getNextDueDate = () => {
    if (contributions.length > 0) {
      const lastDate = new Date(contributions[0].date);
      lastDate.setDate(lastDate.getDate() + 14);
      return formatDate(lastDate);
    }
    return "N/A";
  };

  if (loading) {
    return <div className="contributions-page loading">Loading contributions...</div>;
  }

  return (
    <div className="contributions-page">
      <div className="contributions-summary">
        <div className="summary-card summary-card--total">
          <div className="summary-card-icon">
            <Icon name="coins" size={28} />
          </div>
          <div className="summary-card-content">
            <span className="summary-label">Total Contributed</span>
            <span className="summary-value">Ksh. {totalContributed.toLocaleString()}</span>
            <span className="summary-subtext">{contributionCount} payment{contributionCount !== 1 ? 's' : ''} made</span>
          </div>
        </div>
        <div className="summary-card summary-card--amount">
          <div className="summary-card-icon">
            <Icon name="receipt" size={28} />
          </div>
          <div className="summary-card-content">
            <span className="summary-label">Contribution Amount</span>
            <span className="summary-value">Ksh. 500</span>
            <span className="summary-subtext">Every 2 weeks</span>
          </div>
        </div>
        <div className="summary-card summary-card--due">
          <div className="summary-card-icon">
            <Icon name="clock-alert" size={28} />
          </div>
          <div className="summary-card-content">
            <span className="summary-label">Next Due</span>
            <span className="summary-value">{getNextDueDate()}</span>
            <span className="summary-subtext">Mark your calendar</span>
          </div>
        </div>
      </div>

      <div className="contributions-table-section">
        <div className="section-header">
          <h3><Icon name="wallet" size={20} /> Payment History</h3>
        </div>
        <div className="contributions-table-wrap">
          {contributions.length > 0 ? (
          <table className="contributions-table">
            <thead>
              <tr>
                <th><Icon name="calendar" size={16} /> Date</th>
                <th><Icon name="coins" size={16} /> Amount</th>
                <th><Icon name="trending-up" size={16} /> Cycle</th>
                <th><Icon name="check-circle" size={16} /> Status</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="table-cell-with-icon">
                      <span className="date-text">{formatDate(c.date)}</span>
                    </div>
                  </td>
                  <td>
                    <span className="amount-badge">Ksh. {c.amount}</span>
                  </td>
                  <td>
                    <span className="cycle-badge">Cycle {c.cycle_number}</span>
                  </td>
                  <td>
                    <span className="status-badge paid">
                      <Icon name="check-circle" size={14} /> Paid
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : (
            <div className="no-data">
              <Icon name="wallet" size={48} />
              <p>No contributions recorded yet.</p>
              <span>Your payment history will appear here once you make your first contribution.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
