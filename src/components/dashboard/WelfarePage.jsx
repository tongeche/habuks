import { useState, useEffect } from "react";
import { getWelfareSummary, getWelfareTransactions } from "../../lib/dataService.js";
import { Icon } from "../icons.jsx";

export default function WelfarePage({ user }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function loadWelfare() {
      try {
        const [summaryData, txns] = await Promise.all([
          getWelfareSummary(),
          getWelfareTransactions(user?.id),
        ]);
        setSummary(summaryData);
        setTransactions(txns);
      } catch (error) {
        console.error("Error loading welfare data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadWelfare();
  }, [user?.id]);

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

  const progressPercent = summary ? (summary.completedCycles / summary.totalCycles) * 100 : 0;
  const remainingCycles = (summary?.totalCycles || 12) - (summary?.completedCycles || 0);

  return (
    <div className="welfare-page-modern">
      {/* Header */}
      <div className="page-header">
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
          <div className="welfare-card-value">{formatCurrency(summary?.currentBalance || 0)}</div>
          <div className="welfare-card-change positive">
            <Icon name="trending-up" size={12} />
            <span>+{formatCurrency(summary?.contributionPerCycle || 1000)} per cycle</span>
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
          <div className="welfare-card-value">{summary?.completedCycles || 0} Cycles</div>
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
          <div className="welfare-card-value">{formatCurrency(summary?.finalAmount || 12000)}</div>
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
          <div className="welfare-card-value">{formatCurrency(summary?.contributionPerCycle || 1000)}</div>
          <div className="welfare-card-change neutral">
            <span>From each payout</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="welfare-tabs">
        <button 
          className={`welfare-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="calendar" size={16} />
          Overview
        </button>
        <button 
          className={`welfare-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <Icon name="wallet" size={16} />
          Transactions
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
                <span className="summary-value">{formatCurrency(summary?.currentBalance || 0)}</span>
              </div>
            </div>
            <div className="summary-item">
              <div className="summary-icon summary-icon--check">
                <Icon name="check-circle" size={20} />
              </div>
              <div className="summary-content">
                <span className="summary-label">Completed</span>
                <span className="summary-value">{summary?.completedCycles || 0} / {summary?.totalCycles || 12}</span>
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
                <span className="summary-value">{formatCurrency(summary?.finalAmount || 12000)}</span>
              </div>
            </div>
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
