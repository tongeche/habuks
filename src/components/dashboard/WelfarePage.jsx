import { useState, useEffect } from "react";
import {
  getMemberPayout,
  getPayoutSchedule,
  getWelfareSummary,
  getWelfareTransactions,
} from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

export default function WelfarePage({ user, initialTab = "overview", tenantId }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [payoutSchedule, setPayoutSchedule] = useState([]);
  const [myPayout, setMyPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    async function loadWelfare() {
      try {
        const [summaryData, txns, schedule, memberPayout] = await Promise.all([
          getWelfareSummary(tenantId),
          getWelfareTransactions(user?.id, tenantId),
          getPayoutSchedule(tenantId),
          user?.id ? getMemberPayout(user.id, tenantId) : Promise.resolve(null),
        ]);
        setSummary(summaryData);
        setTransactions(txns);
        setPayoutSchedule(schedule);
        setMyPayout(memberPayout);
      } catch (error) {
        console.error("Error loading welfare data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadWelfare();
  }, [user?.id, tenantId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `Ksh. ${amount?.toLocaleString() || 0}`;
  };

  const getPayoutStatus = (payout) => {
    const today = new Date();
    const payoutDate = new Date(payout.date);

    if (payout.status === "completed") return "Received";
    if (payoutDate < today) return "Received";
    if (payoutDate.toDateString() === today.toDateString()) return "Today";
    return "Pending";
  };

  if (loading) {
    return (
      <div className="welfare-page-modern">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading welfare data...</p>
        </div>
      </div>
    );
  }

  const totalCycles = summary?.totalCycles ?? 0;
  const completedCycles = summary?.completedCycles ?? 0;
  const progressPercent = totalCycles > 0 ? (completedCycles / totalCycles) * 100 : 0;
  const remainingCycles = Math.max(totalCycles - completedCycles, 0);

  return (
    <div className="welfare-page-modern">
      {/* Mobile Hero Header - Banking App Style */}
      <div className="welfare-mobile-hero">
        <div className="welfare-hero-bg">
          <div className="hero-circle hero-circle-1"></div>
          <div className="hero-circle hero-circle-2"></div>
        </div>
        <div className="welfare-hero-content">
          <span className="hero-balance-label">BALANCE</span>
          <h2 className="hero-balance-amount">
            {formatCurrency(summary?.currentBalance ?? 0).replace("Ksh. ", "")}
            <span className="hero-currency">KES</span>
          </h2>
          <div className="hero-quick-actions">
            <button className="hero-action-btn">
              <div className="hero-action-icon">
                <Icon name="trending-up" size={18} />
              </div>
              <span>Contribute</span>
            </button>
            <button className="hero-action-btn">
              <div className="hero-action-icon">
                <Icon name="calendar" size={18} />
              </div>
              <span>Schedule</span>
            </button>
            <button className="hero-action-btn">
              <div className="hero-action-icon">
                <Icon name="wallet" size={18} />
              </div>
              <span>History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="page-header welfare-desktop-header">
        <div className="page-header-text">
          <h1>Welfare Fund</h1>
        </div>
      </div>

      {/* Main Stats Cards - 2 Column Layout */}
      <div className="welfare-dashboard-grid">
        {/* Balance Card - Primary */}
        <div className="welfare-card welfare-card--balance">
          <div className="welfare-card-header">
            <span className="welfare-card-label">Balance</span>
            <div className="welfare-card-action">
              <Icon name="arrow-right" size={14} />
            </div>
          </div>
          <div className="welfare-card-value">{formatCurrency(summary?.currentBalance ?? 0)}</div>
          <div className="welfare-card-change positive">
            <Icon name="trending-up" size={12} />
            <span>+{formatCurrency(summary?.contributionPerCycle ?? 0)} per cycle</span>
          </div>
        </div>

        {/* Completed Card */}
        <div className="welfare-card welfare-card--completed">
          <div className="welfare-card-header">
            <span className="welfare-card-label">Completed</span>
            <div className="welfare-card-action">
              <Icon name="arrow-right" size={14} />
            </div>
          </div>
          <div className="welfare-card-value">{completedCycles} Cycles</div>
          <div className="welfare-card-change neutral">
            <span>{remainingCycles} remaining</span>
          </div>
        </div>

        {/* Target Card */}
        <div className="welfare-card welfare-card--target">
          <div className="welfare-card-header">
            <span className="welfare-card-label">Target</span>
            <div className="welfare-card-action">
              <Icon name="arrow-right" size={14} />
            </div>
          </div>
          <div className="welfare-card-value">{formatCurrency(summary?.finalAmount ?? 0)}</div>
          <div className="welfare-card-change neutral">
            <span>After all cycles</span>
          </div>
        </div>

        {/* Per Cycle Card */}
        <div className="welfare-card welfare-card--cycle">
          <div className="welfare-card-header">
            <span className="welfare-card-label">Per Cycle</span>
            <div className="welfare-card-action">
              <Icon name="arrow-right" size={14} />
            </div>
          </div>
          <div className="welfare-card-value">{formatCurrency(summary?.contributionPerCycle ?? 0)}</div>
          <div className="welfare-card-change neutral">
            <span>From each payout</span>
          </div>
        </div>
      </div>

      {/* Mobile Stats Cards */}
      <div className="welfare-mobile-stats">
        <div className="mobile-stat-card">
          <div className="mobile-stat-icon completed">
            <Icon name="check-circle" size={20} />
          </div>
          <div className="mobile-stat-content">
            <span className="mobile-stat-label">Completed</span>
            <span className="mobile-stat-value">{completedCycles} Cycles</span>
          </div>
          <span className="mobile-stat-sub">{remainingCycles} remaining</span>
        </div>
        <div className="mobile-stat-card">
          <div className="mobile-stat-icon target">
            <Icon name="trending-up" size={20} />
          </div>
          <div className="mobile-stat-content">
            <span className="mobile-stat-label">Target</span>
            <span className="mobile-stat-value">{formatCurrency(summary?.finalAmount ?? 0)}</span>
          </div>
          <span className="mobile-stat-sub">After all cycles</span>
        </div>
        <div className="mobile-stat-card">
          <div className="mobile-stat-icon cycle">
            <Icon name="calendar" size={20} />
          </div>
          <div className="mobile-stat-content">
            <span className="mobile-stat-label">Per Cycle</span>
            <span className="mobile-stat-value">{formatCurrency(summary?.contributionPerCycle ?? 0)}</span>
          </div>
          <span className="mobile-stat-sub">From each payout</span>
        </div>
      </div>

      {/* Desktop Tabs */}
      <div className="welfare-tabs welfare-tabs-desktop">
        <button 
          className={`welfare-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="calendar" size={16} />
          Overview
        </button>
        <button 
          className={`welfare-tab ${activeTab === 'payouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('payouts')}
        >
          <Icon name="calendar" size={16} />
          Payout Schedule
        </button>
        <button 
          className={`welfare-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Icon name="wallet" size={16} />
          Transactions
        </button>
      </div>

      {/* Mobile Bottom Tab Navigation */}
      <div className="welfare-mobile-tabs">
        <button 
          className={`mobile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="home" size={20} />
          <span>Overview</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('payouts')}
        >
          <Icon name="calendar" size={20} />
          <span>Payouts</span>
        </button>
        <button 
          className={`mobile-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Icon name="wallet" size={20} />
          <span>History</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' ? (
        <div className="welfare-overview-section">
          {/* Summary Cards Row */}
          <div className="overview-summary-row">
            <div className="summary-item">
              <div className="summary-icon summary-icon--wallet">
                <Icon name="wallet" size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Total Saved</span>
                <span className="summary-value">{formatCurrency(summary?.currentBalance ?? 0)}</span>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon summary-icon--check">
                <Icon name="check-circle" size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Completed</span>
                <span className="summary-value">
                  {completedCycles} / {totalCycles}
                </span>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon summary-icon--clock">
                <Icon name="calendar" size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Next Cycle</span>
                <span className="summary-value">{formatDate(summary?.nextPayoutDate)}</span>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon summary-icon--star">
                <Icon name="star" size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Final Target</span>
                <span className="summary-value">{formatCurrency(summary?.finalAmount ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'payouts' ? (
        <div className="payouts-page">
          <div className="payouts-info">
            <div className="payout-highlight">
              <span className="payout-highlight-label">Your Turn</span>
              <span className="payout-highlight-value">#{myPayout?.cycle_number || "N/A"}</span>
            </div>
            <div className="payout-highlight">
              <span className="payout-highlight-label">Expected Date</span>
              <span className="payout-highlight-value">{formatDate(myPayout?.date)}</span>
            </div>
            <div className="payout-highlight">
              <span className="payout-highlight-label">Amount</span>
              <span className="payout-highlight-value">
                {myPayout?.amount ? `Ksh. ${myPayout.amount}` : "—"}
              </span>
            </div>
          </div>

          <div className="payouts-table-wrap">
            {payoutSchedule.length > 0 ? (
              <table className="payouts-table">
                <thead>
                  <tr>
                    <th>Turn</th>
                    <th>Member</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutSchedule.map((p) => {
                    const isMe = p.member_id === user?.id;
                    const status = getPayoutStatus(p);
                    return (
                      <tr key={p.id} className={isMe ? "highlight-row" : ""}>
                        <td data-label="Turn">#{p.cycle_number}</td>
                        <td data-label="Member">{isMe ? "You" : p.members?.name || "Member"}</td>
                        <td data-label="Date">{formatDate(p.date)}</td>
                        <td data-label="Status">
                          <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="no-data">No payout schedule available yet.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="welfare-transactions-layout">
          {/* Left Column - Recent Transactions List */}
          <div className="transactions-left-col">
            <div className="col-header">
              <h3>Recent Transaction</h3>
              <button className="more-btn">
                <Icon name="more-horizontal" size={16} />
              </button>
            </div>
            
            <div className="transactions-simple-list">
              {transactions.map((t) => {
                const isContribution = t.transaction_type === 'contribution' || t.amount > 0;
                const category = t.transaction_type || (isContribution ? 'contribution' : 'disbursement');
                const categoryIcons = {
                  contribution: 'trending-up',
                  disbursement: 'arrow-right',
                  emergency: 'newspaper',
                  support: 'users'
                };
                
                return (
                  <div key={t.id} className="simple-transaction-row">
                    <div className={`simple-tx-icon ${category}`}>
                      <Icon name={categoryIcons[category] || 'wallet'} size={18} />
                    </div>
                    <div className="simple-tx-info">
                      <span className="simple-tx-title">{t.recipient || 'Group Welfare'}</span>
                      <span className="simple-tx-subtitle">Cycle {t.cycle_id || 1} Contribution</span>
                    </div>
                    <span className={`simple-tx-amount ${isContribution ? 'positive' : 'negative'}`}>
                      {isContribution ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column - Categories + Table */}
          <div className="transactions-right-col">
            {/* Category Cards */}
            <div className="spending-section">
              <div className="col-header">
                <h3>Categories</h3>
                <button className="more-btn">
                  <Icon name="more-horizontal" size={16} />
                </button>
              </div>
              
              <div className="category-cards">
                <div className="category-card category-card--contribution">
                  <div className="category-icon">
                    <Icon name="trending-up" size={20} />
                  </div>
                  <span className="category-name">Contributions</span>
                  <span className="category-amount">{formatCurrency(summary?.currentBalance || 2000)}</span>
                </div>
                <div className="category-card category-card--disbursement">
                  <div className="category-icon">
                    <Icon name="arrow-right" size={20} />
                  </div>
                  <span className="category-name">Disbursements</span>
                  <span className="category-amount">{formatCurrency(0)}</span>
                </div>
                <div className="category-card category-card--emergency">
                  <div className="category-icon">
                    <Icon name="newspaper" size={20} />
                  </div>
                  <span className="category-name">Emergency</span>
                  <span className="category-amount">{formatCurrency(0)}</span>
                </div>
                <div className="category-card category-card--support">
                  <div className="category-icon">
                    <Icon name="users" size={20} />
                  </div>
                  <span className="category-name">Support</span>
                  <span className="category-amount">{formatCurrency(0)}</span>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="transactions-table-section">
              <div className="col-header">
                <h3>Transactions</h3>
                <div className="transactions-filter">
                  <button className="filter-btn active">Newest</button>
                  <button className="filter-btn">Oldest</button>
                </div>
              </div>
              
              {transactions.length > 0 ? (
                <div className="transactions-table-modern">
                  <div className="table-header-row">
                    <span>Name</span>
                    <span>Status</span>
                    <span>Date</span>
                    <span>Amount</span>
                  </div>
                  {transactions.map((t) => {
                    const isContribution = t.transaction_type === 'contribution' || t.amount > 0;
                    return (
                      <div key={t.id} className="table-data-row">
                        <div className="table-name-cell">
                          <div className="table-avatar">
                            <Icon name="user" size={14} />
                          </div>
                          <span>{t.recipient || 'Group Welfare'}</span>
                        </div>
                        <div className="table-status-cell">
                          <span className={`status-tag ${(t.status || 'completed').toLowerCase().replace(' ', '-')}`}>
                            {t.status || 'Completed'}
                          </span>
                        </div>
                        <div className="table-date-cell">
                          {formatDate(t.date_of_issue || t.date)}
                        </div>
                        <div className={`table-amount-cell ${isContribution ? 'positive' : 'negative'}`}>
                          {formatCurrency(Math.abs(t.amount))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Icon name="wallet" size={48} />
                  <h3>No transactions yet</h3>
                  <p>Welfare transactions will appear here as cycles complete.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
