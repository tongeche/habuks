import { useState, useEffect, useMemo } from "react";
import {
  getDashboardStats,
  getMemberContributions,
  getContributionSplits,
  getPayoutSchedule,
  getProjects
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

export default function DashboardOverview({ user }) {
  const [stats, setStats] = useState({
    totalContributions: 0,
    welfareBalance: 0,
    payoutTurn: null,
    payoutDate: null,
    currentCycle: 0,
    totalMembers: 12,
    nextRecipient: null,
    nextPayoutDate: null,
  });
  const [recentContributions, setRecentContributions] = useState([]);
  const [contributionSplits, setContributionSplits] = useState([]);
  const [upcomingPayouts, setUpcomingPayouts] = useState([]);
  const [payoutSchedule, setPayoutSchedule] = useState([]);
  const [projects, setProjects] = useState([]);
  const [transactionView, setTransactionView] = useState("summary");
  const [loading, setLoading] = useState(true);

  const buildContributionSplits = (contributions) => {
    if (!Array.isArray(contributions)) return [];
    return contributions.flatMap((contribution) => {
      const total = Number(contribution.amount || 0);
      if (!total) return [];
      const welfareAmount = Number((total / 6).toFixed(2));
      const lendingAmount = Number((total - welfareAmount).toFixed(2));
      const cycle = contribution.cycle_number ?? "—";
      const date = contribution.date;
      return [
        {
          id: `${contribution.id}-lending`,
          split_type: "lending_contribution",
          amount: lendingAmount,
          date,
          cycle_number: String(cycle),
        },
        {
          id: `${contribution.id}-welfare`,
          split_type: "welfare_savings",
          amount: welfareAmount,
          date,
          cycle_number: String(cycle),
        },
      ];
    });
  };

  useEffect(() => {
    async function loadData() {
      try {
        const memberId = user?.id;
        if (!memberId) {
          setLoading(false);
          return;
        }
        
        const [statsData, contributions, splits, payouts, projectsData] = await Promise.all([
          getDashboardStats(memberId),
          getMemberContributions(memberId),
          getContributionSplits(memberId),
          getPayoutSchedule(),
          getProjects(),
        ]);
        
        setStats(statsData);
        setRecentContributions(contributions.slice(0, 5));
        setContributionSplits(
          splits && splits.length > 0
            ? splits
            : buildContributionSplits(contributions)
        );
        
        // Get upcoming payouts (not yet received)
        const today = new Date();
        const upcoming = payouts.filter(p => new Date(p.date) >= today).slice(0, 4);
        setUpcomingPayouts(upcoming);
        setPayoutSchedule(payouts);
        setProjects(projectsData);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user?.id]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "short",
    });
  };

  const formatCardDate = (dateStr) => {
    if (!dateStr) return "JAN 2026";
    const date = new Date(dateStr);
    const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    return `${month} ${year}`;
  };

  const formatCurrency = (value) => {
    const amount = Number(value || 0);
    const hasDecimals = Math.abs(amount % 1) > 0.001;
    return amount.toLocaleString("en-KE", {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    });
  };

  const payoutNameByCycle = useMemo(() => {
    const map = new Map();
    payoutSchedule.forEach((p) => {
      if (p?.cycle_number == null) return;
      map.set(String(p.cycle_number), p.members?.name || "Member");
    });
    return map;
  }, [payoutSchedule]);

  const displayTransactions = useMemo(() => {
    if (transactionView === "split") {
      return contributionSplits.map((split) => ({
        id: split.id || `${split.contribution_id}-${split.split_type}`,
        title:
          split.split_type === "lending_contribution"
            ? `Payment to ${payoutNameByCycle.get(String(split.cycle_number || "")) || "member"}`
            : `Welfare savings · Cycle ${split.cycle_number || "—"}`,
        date: split.date,
        amount: split.amount,
        kind: split.split_type,
      }));
    }

    return recentContributions.map((c) => ({
      id: c.id,
      title: `Contribution - Cycle ${c.cycle_number}`,
      date: c.date,
      amount: c.amount,
      kind: "summary",
    }));
  }, [transactionView, contributionSplits, recentContributions, payoutNameByCycle]);

  // Calculate days until next group payout
  const getDaysUntilNextPayout = () => {
    const payoutDate = stats.nextPayoutDate || stats.payoutDate;
    if (!payoutDate) return null;
    const today = new Date();
    const nextDate = new Date(payoutDate);
    const diffTime = nextDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="dashboard-overview loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  const daysUntilNext = getDaysUntilNextPayout();

  return (
    <div className="dashboard-overview-modern">
      <div className="dashboard-row-4col">
        <div className="member-debit-card">
          <div className="debit-card-bg">
            <div className="debit-stripe debit-stripe-1"></div>
            <div className="debit-stripe debit-stripe-2"></div>
            <div className="debit-stripe debit-stripe-3"></div>
          </div>
          <div className="debit-card-content">
            <div className="debit-card-header">
              <div className="debit-card-logo">
                <span className="logo-text">JONGOL</span>
                <span className="logo-sub">FOUNDATION</span>
              </div>
              <span className="debit-card-type">MEMBER</span>
            </div>
            <div className="debit-card-chip">
              <div className="chip-lines">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div className="debit-card-number">
              <span>JNG</span>
              <span>{String(user?.id || 8).padStart(4, "0")}</span>
              <span>{user?.national_id?.slice(0, 4) || "••••"}</span>
              <span>{user?.national_id?.slice(4, 8) || "••••"}</span>
            </div>
            <div className="debit-card-details">
              <div className="debit-detail">
                <span className="debit-label">MEMBER SINCE</span>
                <span className="debit-value">{formatCardDate(user?.join_date)}</span>
              </div>
              <div className="debit-detail">
                <span className="debit-label">PAYOUT #</span>
                <span className="debit-value">
                  {String(stats.payoutTurn || 8).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="debit-card-holder">
              <span className="holder-name">{user?.name?.toUpperCase() || "MEMBER NAME"}</span>
              <span className="holder-phone">{user?.phone_number || user?.email}</span>
            </div>
            <div className="debit-card-footer">
              <div className="debit-status">
                <span className={`status-dot ${user?.status || "active"}`}></span>
                <span>{user?.status?.toUpperCase() || "ACTIVE"}</span>
              </div>
              <div className="debit-logo-icon">
                <Icon name="users" size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="transactions-card">
          <div className="card-header">
            <h3><Icon name="receipt" size={20} /> Transaction History</h3>
            <a href="#" className="view-all-link">View All</a>
          </div>
          <div className="transaction-toggle">
            <button
              type="button"
              className={`toggle-btn ${transactionView === "summary" ? "is-active" : ""}`}
              onClick={() => setTransactionView("summary")}
            >
              Summary
            </button>
            <button
              type="button"
              className={`toggle-btn ${transactionView === "split" ? "is-active" : ""}`}
              onClick={() => setTransactionView("split")}
            >
              Split
            </button>
          </div>
          <div className="transactions-list">
            {displayTransactions.length > 0 ? (
              displayTransactions.map((transaction) => (
                <div className="transaction-item" key={transaction.id}>
                  <div
                    className={`transaction-icon ${
                      transaction.kind === "lending_contribution"
                        ? "transaction-icon--lending"
                        : transaction.kind === "welfare_savings"
                        ? "transaction-icon--welfare"
                        : "transaction-icon--contribution"
                    }`}
                  >
                    <Icon
                      name={
                        transaction.kind === "lending_contribution"
                          ? "coins"
                          : transaction.kind === "welfare_savings"
                          ? "heart"
                          : "trending-up"
                      }
                      size={18}
                    />
                  </div>
                  <div className="transaction-details">
                    <span className="transaction-title">{transaction.title}</span>
                    <span className="transaction-date">{formatDate(transaction.date)}</span>
                  </div>
                  <div className="transaction-amount transaction-amount--positive">
                    +Ksh. {formatCurrency(transaction.amount)}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-transactions">
                <Icon name="wallet" size={32} />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="upcoming-payouts-card">
          <div className="card-header">
            <h3><Icon name="users" size={20} /> Upcoming Payouts</h3>
          </div>
          <div className="upcoming-list">
            {upcomingPayouts.length > 0 ? (
              upcomingPayouts.map((p) => (
                <div
                  className={`upcoming-item ${p.member_id === user?.id ? "upcoming-item--me" : ""}`}
                  key={p.id}
                >
                  <div className="upcoming-rank">#{p.cycle_number}</div>
                  <div className="upcoming-info">
                    <span className="upcoming-name">
                      {p.member_id === user?.id ? "You" : p.members?.name || "Member"}
                    </span>
                    <span className="upcoming-date">{formatShortDate(p.date)}</span>
                  </div>
                  <div className="upcoming-amount">Ksh. {p.amount}</div>
                </div>
              ))
            ) : (
              <p className="no-data-small">No upcoming payouts</p>
            )}
          </div>
        </div>

        <div className="projects-overview-card">
          <div className="card-header">
            <h3><Icon name="briefcase" size={20} /> IGA Projects</h3>
          </div>
          <div className="projects-mini-grid">
            {projects.length > 0 ? (
              projects.map((project) => (
                <div className="project-mini-card" key={project.id}>
                  <div
                    className={`project-mini-icon ${project.status === "active" ? "active" : "dev"}`}
                  >
                    {project.name.includes("Poultry") ? "🐔" : "🥜"}
                  </div>
                  <div className="project-mini-info">
                    <span className="project-mini-name">{project.name.split("–")[0].trim()}</span>
                    <span className={`project-mini-status ${project.status}`}>{project.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-data-small">No active projects</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
