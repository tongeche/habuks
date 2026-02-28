import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";

const recordsSeed = [
  {
    id: "r1",
    name: "Agnes Otieno",
    note: "Member contribution",
    project: "Core Savings",
    type: "contribution",
    status: "paid",
    date: "2026-02-20",
    amount: 5000,
  },
  {
    id: "r2",
    name: "Brian Mwangi",
    note: "Member contribution",
    project: "Core Savings",
    type: "contribution",
    status: "paid",
    date: "2026-02-18",
    amount: 2000,
  },
  {
    id: "r3",
    name: "School support payout",
    note: "Welfare disbursement",
    project: "Welfare Fund",
    type: "payout",
    status: "approved",
    date: "2026-02-16",
    amount: -12000,
  },
  {
    id: "r4",
    name: "Feed purchase",
    note: "Project expense",
    project: "JPP Poultry",
    type: "expense",
    status: "posted",
    date: "2026-02-15",
    amount: -6500,
  },
  {
    id: "r5",
    name: "Market sales",
    note: "IGA revenue",
    project: "JGF Groundnuts",
    type: "welfare",
    status: "received",
    date: "2026-02-13",
    amount: 18500,
  },
  {
    id: "r6",
    name: "Office stationery",
    note: "Admin expense",
    project: "General Ops",
    type: "expense",
    status: "pending",
    date: "2026-02-11",
    amount: -1800,
  },
  {
    id: "r7",
    name: "Charles Kamau",
    note: "Member contribution",
    project: "Core Savings",
    type: "contribution",
    status: "pending",
    date: "2026-02-10",
    amount: 3000,
  },
  {
    id: "r8",
    name: "Medical support payout",
    note: "Welfare request",
    project: "Welfare Fund",
    type: "payout",
    status: "scheduled",
    date: "2026-02-08",
    amount: -9000,
  },
];

const typeLabels = {
  all: "All records",
  contribution: "Contributions",
  expense: "Expenses",
  payout: "Payouts",
  welfare: "Welfare inflows",
};

const periodLabels = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const statusOptions = ["pending", "paid", "posted", "approved", "received", "scheduled"];
const outflowTypes = new Set(["expense", "payout"]);

const getDefaultFormType = (initialType) =>
  initialType && initialType !== "all" ? initialType : "contribution";

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const createInitialForm = (initialType, suggestedProject = "") => ({
  type: getDefaultFormType(initialType),
  status: "pending",
  name: "",
  project: suggestedProject && suggestedProject !== "all" ? suggestedProject : "",
  date: getTodayIso(),
  amount: "",
  note: "",
});

const isInsidePeriod = (dateStr, period) => {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const range = { "7d": 7, "30d": 30, "90d": 90 }[period] ?? 30;
  const diff = now.getTime() - parsed.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= range;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function FinanceRecordsPage({
  initialType = "all",
  activePage = "",
  access,
  setActivePage,
}) {
  const { formatCurrency, formatFieldLabel } = useTenantCurrency();
  const [records, setRecords] = useState(recordsSeed);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [addRecordForm, setAddRecordForm] = useState(() => createInitialForm(initialType));
  const formatAmount = (value) =>
    formatCurrency(Math.abs(Number(value) || 0), { maximumFractionDigits: 0 });

  useEffect(() => {
    setTypeFilter(initialType || "all");
    setAddRecordForm((prev) => ({
      ...prev,
      type: getDefaultFormType(initialType),
    }));
  }, [initialType]);

  const projectOptions = useMemo(() => {
    const unique = Array.from(new Set(records.map((item) => item.project)));
    return ["all", ...unique];
  }, [records]);

  const scopedRecords = useMemo(
    () => records.filter((item) => isInsidePeriod(item.date, period)),
    [records, period]
  );

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scopedRecords.filter((item) => {
      const typeMatch = typeFilter === "all" ? true : item.type === typeFilter;
      const projectMatch = projectFilter === "all" ? true : item.project === projectFilter;
      const searchMatch = query
        ? `${item.name} ${item.note} ${item.project} ${item.status}`.toLowerCase().includes(query)
        : true;
      return typeMatch && projectMatch && searchMatch;
    });
  }, [scopedRecords, typeFilter, projectFilter, search]);

  const summary = useMemo(() => {
    const inflow = scopedRecords
      .filter((item) => item.amount > 0)
      .reduce((sum, item) => sum + item.amount, 0);
    const outflow = scopedRecords
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const net = inflow - outflow;
    const pending = scopedRecords.filter((item) => item.status === "pending").length;
    return { inflow, outflow, net, pending };
  }, [scopedRecords]);

  const recentPayments = useMemo(
    () =>
      scopedRecords
        .filter((item) => item.type === "contribution" || item.type === "payout")
        .slice(0, 4),
    [scopedRecords]
  );

  const handleOpenAddRecord = () => {
    setAddRecordForm(createInitialForm(initialType, projectFilter));
    setShowAddRecordModal(true);
  };

  const handleFormChange = (field, value) => {
    setAddRecordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddRecordSubmit = (event) => {
    event.preventDefault();
    const normalizedName = addRecordForm.name.trim();
    const normalizedProject = addRecordForm.project.trim();
    const amountValue = Number(addRecordForm.amount);
    if (!normalizedName || !normalizedProject || !addRecordForm.date || !Number.isFinite(amountValue) || amountValue <= 0) {
      return;
    }

    const nextRecord = {
      id: `r-${Date.now()}`,
      name: normalizedName,
      note: addRecordForm.note.trim() || "Manual record entry",
      project: normalizedProject,
      type: addRecordForm.type,
      status: addRecordForm.status,
      date: addRecordForm.date,
      amount: outflowTypes.has(addRecordForm.type) ? -Math.abs(amountValue) : Math.abs(amountValue),
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setTypeFilter(addRecordForm.type);
    setProjectFilter("all");
    setSearch("");
    setShowAddRecordModal(false);
  };

  return (
    <>
      <div
        className={`finance-records-page dashboard-mobile-shell${
          activePage === "expenses" ? " finance-records-page--expenses" : ""
        }`}
      >
        <div className="finance-records-stats">
          <article className="finance-stat-card">
            <p>Total inflow</p>
            <h3>{formatAmount(summary.inflow)}</h3>
            <span>{periodLabels[period]}</span>
          </article>
          <article className="finance-stat-card">
            <p>Total outflow</p>
            <h3 className="negative">{formatAmount(summary.outflow)}</h3>
            <span>{periodLabels[period]}</span>
          </article>
          <article className="finance-stat-card">
            <p>Net balance</p>
            <h3 className={summary.net < 0 ? "negative" : ""}>{formatAmount(summary.net)}</h3>
            <span>Current period</span>
          </article>
          <article className="finance-stat-card">
            <p>Pending items</p>
            <h3>{summary.pending}</h3>
            <span>Needs review</span>
          </article>
        </div>

        <div className="finance-records-toolbar">
          <div className="finance-records-toolbar-left">
            <div className="finance-records-search">
              <Icon name="search" size={16} />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search records, member, or project..."
              />
            </div>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All records</option>
              <option value="contribution">Contributions</option>
              <option value="expense">Expenses</option>
              <option value="payout">Payouts</option>
              <option value="welfare">Welfare inflows</option>
            </select>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              {projectOptions.map((project) => (
                <option key={project} value={project}>
                  {project === "all" ? "All projects" : project}
                </option>
              ))}
            </select>
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div className="finance-records-toolbar-right">
            <button type="button" className="finance-toolbar-btn finance-toolbar-btn--ghost" disabled>
              Export
            </button>
            <button
              type="button"
              className="finance-toolbar-btn finance-toolbar-btn--primary finance-toolbar-btn--add"
              onClick={handleOpenAddRecord}
            >
              + Add record
            </button>
          </div>
        </div>

        <div className="finance-records-grid">
          <section className="finance-records-main">
            <div className="finance-records-main-head">
              <h3>{typeLabels[typeFilter] || "Records"}</h3>
              <span>{filteredRecords.length} items</span>
            </div>

            <div className="finance-records-table-head">
              <span>Record</span>
              <span>Project</span>
              <span>Date</span>
              <span>Amount</span>
            </div>

            <div className="finance-records-table-body">
              {filteredRecords.length ? (
                filteredRecords.map((item) => (
                  <article className="finance-record-row" key={item.id}>
                    <div className="finance-record-main">
                      <strong>{item.name}</strong>
                      <span>{item.note}</span>
                    </div>
                    <div className="finance-record-project">{item.project}</div>
                    <div className="finance-record-date">{formatDate(item.date)}</div>
                    <div className={`finance-record-amount ${item.amount < 0 ? "negative" : "positive"}`}>
                      {item.amount < 0 ? "-" : "+"}
                      {formatAmount(item.amount)}
                    </div>
                  </article>
                ))
              ) : (
                <div className="finance-records-empty">
                  <Icon name="wallet" size={20} />
                  <span>No records match the selected filters.</span>
                </div>
              )}
            </div>
          </section>

          <aside className="finance-records-side">
            <article className="finance-side-card">
              <div className="finance-side-card-head">
                <h4>Recent payments</h4>
                <button type="button">View all</button>
              </div>
              <div className="finance-payments-list">
                {recentPayments.length ? (
                  recentPayments.map((item) => (
                    <div className="finance-payment-row" key={`pay-${item.id}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{formatDate(item.date)}</span>
                      </div>
                      <div className={item.amount < 0 ? "negative" : "positive"}>
                        {item.amount < 0 ? "-" : "+"}
                        {formatAmount(item.amount)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="finance-records-empty">No recent payments</div>
                )}
              </div>
            </article>

            <article className="finance-side-card finance-side-card--tips">
              <div className="finance-tip-row">
                <span className="finance-tip-icon">
                  <Icon name="calendar" size={16} />
                </span>
                <div>
                  <strong>Easily track cycle payments</strong>
                  <p>See who has paid, who is pending, and what is overdue.</p>
                </div>
              </div>
              <div className="finance-tip-row">
                <span className="finance-tip-icon finance-tip-icon--alt">
                  <Icon name="target" size={16} />
                </span>
                <div>
                  <strong>Set savings goals</strong>
                  <p>Track cycle targets and monitor progress in one place.</p>
                </div>
              </div>
            </article>
          </aside>
        </div>
      </div>

      <DataModal
        open={showAddRecordModal}
        onClose={() => setShowAddRecordModal(false)}
        title="Add record"
        subtitle="Capture contributions, expenses, payouts, and welfare inflows."
        icon="receipt"
      >
        <form className="data-modal-form" onSubmit={handleAddRecordSubmit}>
          <div className="data-modal-grid">
            <label className="data-modal-field">
              Record type
              <select
                value={addRecordForm.type}
                onChange={(event) => handleFormChange("type", event.target.value)}
              >
                <option value="contribution">Contribution</option>
                <option value="expense">Expense</option>
                <option value="payout">Payout</option>
                <option value="welfare">Welfare inflow</option>
              </select>
            </label>
            <label className="data-modal-field">
              Status
              <select
                value={addRecordForm.status}
                onChange={(event) => handleFormChange("status", event.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="data-modal-field">
              Record name
              <input
                type="text"
                required
                placeholder="e.g. Grace Wanjiku contribution"
                value={addRecordForm.name}
                onChange={(event) => handleFormChange("name", event.target.value)}
              />
            </label>
            <label className="data-modal-field">
              Project
              <input
                type="text"
                list="finance-record-project-options"
                required
                placeholder="e.g. Core Savings"
                value={addRecordForm.project}
                onChange={(event) => handleFormChange("project", event.target.value)}
              />
            </label>
            <label className="data-modal-field">
              Date
              <input
                type="date"
                required
                value={addRecordForm.date}
                onChange={(event) => handleFormChange("date", event.target.value)}
              />
            </label>
            <label className="data-modal-field">
              {formatFieldLabel("Amount")}
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                required
                placeholder="0.00"
                value={addRecordForm.amount}
                onChange={(event) => handleFormChange("amount", event.target.value)}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Note
              <textarea
                rows={3}
                placeholder="Optional description for this entry..."
                value={addRecordForm.note}
                onChange={(event) => handleFormChange("note", event.target.value)}
              />
            </label>
            <label className="data-modal-field data-modal-field--full">
              Attachment
              <div className="data-modal-upload">
                <span>Upload receipt, statement, or supporting document (optional).</span>
                <input type="file" />
              </div>
            </label>
          </div>
          <datalist id="finance-record-project-options">
            {projectOptions
              .filter((project) => project !== "all")
              .map((project) => (
                <option key={project} value={project} />
              ))}
          </datalist>
          <div className="data-modal-actions">
            <button
              type="button"
              className="data-modal-btn"
              onClick={() => setShowAddRecordModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="data-modal-btn data-modal-btn--primary">
              Save record
            </button>
          </div>
        </form>
      </DataModal>
      {activePage === "expenses" ? (
        <button
          type="button"
          className="dashboard-page-fab"
          onClick={handleOpenAddRecord}
          aria-label="Add expense"
        >
          <Icon name="plus" size={20} />
        </button>
      ) : null}
      {activePage === "expenses" ? (
        <DashboardMobileNav activePage={activePage} access={access} setActivePage={setActivePage} />
      ) : null}
    </>
  );
}
