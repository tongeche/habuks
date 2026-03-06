import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import DataModal from "./DataModal.jsx";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";
import {
  createContributionRecord,
  createPayoutRecord,
  createProjectExpense,
  createWelfareTransaction,
  getMembersAdmin,
  getProjectExpensesForProjects,
  getProjectSalesForProjects,
  getProjectsWithMembership,
  getTenantContributions,
  getTenantPayouts,
  getWelfareTransactionsAdmin,
} from "../../lib/dataService.js";

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

const statusOptions = ["pending", "paid", "posted", "approved", "received", "scheduled", "completed"];
const financePageKeys = new Set(["contributions", "expenses", "documents", "welfare", "payouts"]);
const adminRoles = new Set(["admin", "superadmin", "supervisor"]);

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

const normalizeLookup = (value) => String(value || "").trim().toLowerCase();

const toIsoDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const toPositiveAmount = (value) => Math.abs(Number(value) || 0);
const isMockRecordId = (value) => String(value || "").startsWith("mock-");

const formatProductLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized
    .split("_")
    .map((segment) => {
      if (!segment) return segment;
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join(" ");
};

export function FinanceRecordsPage({
  user = null,
  tenantId = null,
  initialType = "all",
  activePage = "",
}) {
  const { formatCurrency, formatFieldLabel } = useTenantCurrency();
  const [records, setRecords] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [addRecordForm, setAddRecordForm] = useState(() => createInitialForm(initialType));
  const showMobileFab = financePageKeys.has(String(activePage || "").trim().toLowerCase());
  const formatAmount = (value) =>
    formatCurrency(Math.abs(Number(value) || 0), { maximumFractionDigits: 0 });

  const canViewAllProjects = adminRoles.has(normalizeLookup(user?.role));

  const memberLookup = useMemo(() => {
    const lookup = new Map();
    members.forEach((member) => {
      const keys = [member?.id, member?.name, member?.email, member?.phone_number];
      keys.forEach((key) => {
        const normalized = normalizeLookup(key);
        if (normalized) {
          lookup.set(normalized, member);
        }
      });
    });
    return lookup;
  }, [members]);

  const projectLookup = useMemo(() => {
    const lookup = new Map();
    projects.forEach((project) => {
      const keys = [project?.id, project?.name, project?.code, project?.module_key];
      keys.forEach((key) => {
        const normalized = normalizeLookup(key);
        if (normalized) {
          lookup.set(normalized, project);
        }
      });
    });
    return lookup;
  }, [projects]);

  useEffect(() => {
    setTypeFilter(initialType || "all");
    setAddRecordForm((prev) => ({
      ...prev,
      type: getDefaultFormType(initialType),
    }));
  }, [initialType]);

  useEffect(() => {
    let isMounted = true;

    const loadFinanceRecords = async () => {
      if (!tenantId || !user?.id) {
        if (!isMounted) return;
        setProjects([]);
        setMembers([]);
        setRecords([]);
        setLoading(false);
        setLoadingError("Workspace context is missing.");
        return;
      }

      setLoading(true);
      setLoadingError("");

      try {
        const [projectRows, memberRows] = await Promise.all([
          getProjectsWithMembership(user.id, tenantId),
          getMembersAdmin(tenantId).catch(() => []),
        ]);

        if (!isMounted) return;

        const visibleProjects = (projectRows || []).filter((project) => {
          if (canViewAllProjects) return true;
          return Boolean(project?.membership) || project?.project_leader === user.id;
        });
        const sortedProjects = [...visibleProjects].sort((left, right) =>
          String(left?.name || "").localeCompare(String(right?.name || ""))
        );
        const projectNameById = new Map(
          sortedProjects
            .filter((project) => project?.id)
            .map((project) => [String(project.id), String(project?.name || "").trim() || "Project"])
        );
        const memberNameById = new Map(
          (memberRows || [])
            .filter((member) => member?.id)
            .map((member) => [String(member.id), String(member?.name || "").trim() || "Member"])
        );
        const projectIds = sortedProjects.map((project) => project?.id).filter(Boolean);

        const [
          contributionRows,
          payoutRows,
          welfareRows,
          expenseRows,
          saleRows,
        ] = await Promise.all([
          getTenantContributions(tenantId),
          getTenantPayouts(tenantId),
          getWelfareTransactionsAdmin(tenantId),
          projectIds.length ? getProjectExpensesForProjects(projectIds, tenantId) : Promise.resolve([]),
          projectIds.length ? getProjectSalesForProjects(projectIds, tenantId) : Promise.resolve([]),
        ]);

        if (!isMounted) return;

        const contributionRecords = (contributionRows || []).map((row) => {
          const amount = toPositiveAmount(row?.amount);
          const date = toIsoDate(row?.date || row?.created_at || row?.updated_at) || getTodayIso();
          const memberId = normalizeLookup(row?.member_id);
          const fallbackLabel = row?.id ? `Contribution #${row.id}` : "Contribution";
          return {
            id: `contribution-${row?.id ?? Math.random()}`,
            name: memberNameById.get(memberId) || fallbackLabel,
            note: String(row?.notes || row?.description || "Member contribution"),
            project: "Core Savings",
            type: "contribution",
            status: normalizeLookup(row?.status) || "paid",
            date,
            amount,
          };
        });

        const payoutRecords = (payoutRows || []).map((row) => {
          const amount = -toPositiveAmount(row?.amount);
          const date = toIsoDate(row?.date || row?.created_at || row?.updated_at) || getTodayIso();
          const memberId = normalizeLookup(row?.member_id);
          const fallbackLabel = row?.id ? `Payout #${row.id}` : "Payout";
          return {
            id: `payout-${row?.id ?? Math.random()}`,
            name: memberNameById.get(memberId) || fallbackLabel,
            note: String(row?.notes || row?.description || "Welfare payout"),
            project: "Welfare Fund",
            type: "payout",
            status: normalizeLookup(row?.status) || "approved",
            date,
            amount,
          };
        });

        const welfareRecords = (welfareRows || []).map((row) => {
          const numericAmount = Number(row?.amount) || 0;
          const transactionType = normalizeLookup(row?.transaction_type);
          const isOutflow =
            transactionType === "disbursement" || transactionType === "payout" || numericAmount < 0;
          const amount = isOutflow ? -toPositiveAmount(numericAmount) : toPositiveAmount(numericAmount);
          const date = toIsoDate(row?.date || row?.created_at || row?.updated_at) || getTodayIso();
          const memberName =
            String(row?.member?.name || "").trim() ||
            memberNameById.get(normalizeLookup(row?.member_id)) ||
            "";
          return {
            id: `welfare-${row?.id ?? Math.random()}`,
            name: memberName || "Welfare transaction",
            note: String(row?.description || (isOutflow ? "Welfare disbursement" : "Welfare contribution")),
            project: "Welfare Fund",
            type: isOutflow ? "payout" : "welfare",
            status: normalizeLookup(row?.status) || (isOutflow ? "approved" : "received"),
            date,
            amount,
          };
        });

        const expenseRecords = (expenseRows || [])
          .filter((row) => !isMockRecordId(row?.id))
          .map((row) => {
          const amount = -toPositiveAmount(row?.amount);
          const date = toIsoDate(row?.expense_date || row?.created_at || row?.updated_at) || getTodayIso();
          const projectName = projectNameById.get(String(row?.project_id || "")) || "Project expense";
          const category = String(row?.category || "").trim();
          const vendor = String(row?.vendor || "").trim();
          const note = [category, vendor].filter(Boolean).join(" · ") || "Project expense";
          return {
            id: `expense-${row?.id ?? Math.random()}`,
            name: String(row?.description || "").trim() || category || "Project expense",
            note,
            project: projectName,
            type: "expense",
            status: normalizeLookup(row?.status) || "posted",
            date,
            amount,
          };
          });

        const saleRecords = (saleRows || [])
          .filter((row) => !isMockRecordId(row?.id))
          .map((row) => {
          const amount = toPositiveAmount(row?.total_amount ?? row?.amount);
          const date = toIsoDate(row?.sale_date || row?.created_at || row?.updated_at) || getTodayIso();
          const projectName = projectNameById.get(String(row?.project_id || "")) || "Project sale";
          const productLabel = formatProductLabel(row?.product_type);
          const customerType = formatProductLabel(row?.customer_type);
          const note = [productLabel, customerType].filter(Boolean).join(" · ") || "Project revenue";
          return {
            id: `sale-${row?.id ?? Math.random()}`,
            name: String(row?.customer_name || "").trim() || productLabel || "Project sale",
            note,
            project: projectName,
            type: "welfare",
            status: normalizeLookup(row?.payment_status) || "received",
            date,
            amount,
          };
          });

        const merged = [
          ...contributionRecords,
          ...payoutRecords,
          ...welfareRecords,
          ...expenseRecords,
          ...saleRecords,
        ].sort((left, right) => {
          const leftTime = new Date(left?.date || 0).getTime();
          const rightTime = new Date(right?.date || 0).getTime();
          return rightTime - leftTime;
        });

        setProjects(sortedProjects);
        setMembers(memberRows || []);
        setRecords(merged);
      } catch (error) {
        console.error("Error loading finance records:", error);
        if (!isMounted) return;
        setProjects([]);
        setMembers([]);
        setRecords([]);
        setLoadingError(error?.message || "Failed to load records.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadFinanceRecords();
    return () => {
      isMounted = false;
    };
  }, [tenantId, user?.id, user?.role, canViewAllProjects, refreshTick]);

  const projectOptions = useMemo(() => {
    const set = new Set();
    projects.forEach((project) => {
      const name = String(project?.name || "").trim();
      if (name) set.add(name);
    });
    records.forEach((item) => {
      const project = String(item?.project || "").trim();
      if (project) set.add(project);
    });
    return ["all", ...Array.from(set)];
  }, [projects, records]);

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
    const suggestedProject =
      projectFilter && projectFilter !== "all" ? projectFilter : String(projects[0]?.name || "");
    setFormError("");
    setAddRecordForm(createInitialForm(initialType, suggestedProject));
    setShowAddRecordModal(true);
  };

  const handleFormChange = (field, value) => {
    setAddRecordForm((prev) => ({ ...prev, [field]: value }));
  };

  const findMemberByInput = (value) => {
    const normalized = normalizeLookup(value);
    if (!normalized) return null;
    return memberLookup.get(normalized) || null;
  };

  const findProjectByInput = (value) => {
    const normalized = normalizeLookup(value);
    if (!normalized) return null;
    return projectLookup.get(normalized) || null;
  };

  const handleAddRecordSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const normalizedName = addRecordForm.name.trim();
    const normalizedProject = addRecordForm.project.trim();
    const normalizedNote = addRecordForm.note.trim();
    const amountValue = Number(addRecordForm.amount);
    if (
      !normalizedName ||
      !addRecordForm.date ||
      !Number.isFinite(amountValue) ||
      amountValue <= 0
    ) {
      setFormError("Fill all required fields with valid values.");
      return;
    }
    if (addRecordForm.type === "expense" && !normalizedProject) {
      setFormError("Project is required for expense records.");
      return;
    }

    try {
      setIsSaving(true);
      if (addRecordForm.type === "expense") {
        const selectedProject = findProjectByInput(normalizedProject);
        if (!selectedProject?.id) {
          throw new Error("Select a valid existing project for this expense.");
        }
        await createProjectExpense(
          selectedProject.id,
          {
            expense_date: addRecordForm.date,
            category: normalizedName,
            amount: toPositiveAmount(amountValue),
            description: normalizedNote || normalizedName,
            receipt: false,
          },
          tenantId
        );
      } else if (addRecordForm.type === "contribution") {
        const selectedMember = findMemberByInput(normalizedName);
        if (!selectedMember?.id) {
          throw new Error("Select a valid member name for contribution records.");
        }
        await createContributionRecord(
          {
            member_id: selectedMember.id,
            amount: toPositiveAmount(amountValue),
            date: addRecordForm.date,
            status: addRecordForm.status || "paid",
            notes: normalizedNote || "Member contribution",
          },
          tenantId
        );
      } else if (addRecordForm.type === "payout") {
        const selectedMember = findMemberByInput(normalizedName);
        if (!selectedMember?.id) {
          throw new Error("Select a valid member name for payout records.");
        }
        await createPayoutRecord(
          {
            member_id: selectedMember.id,
            amount: toPositiveAmount(amountValue),
            date: addRecordForm.date,
            status: addRecordForm.status || "approved",
            notes: normalizedNote || "Welfare payout",
          },
          tenantId
        );
      } else if (addRecordForm.type === "welfare") {
        const selectedMember = findMemberByInput(normalizedName);
        await createWelfareTransaction(
          {
            member_id: selectedMember?.id || null,
            amount: toPositiveAmount(amountValue),
            transaction_type: "contribution",
            status: addRecordForm.status || "Completed",
            date: addRecordForm.date,
            description: normalizedNote || normalizedName,
          },
          tenantId
        );
      }
      setTypeFilter(addRecordForm.type);
      setProjectFilter("all");
      setSearch("");
      setShowAddRecordModal(false);
      setRefreshTick((value) => value + 1);
    } catch (error) {
      setFormError(error?.message || "Failed to save record.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className={`finance-records-page dashboard-mobile-shell${
          activePage === "expenses" ? " finance-records-page--expenses" : ""
        }${showMobileFab ? " finance-records-page--mobile-action" : ""}`}
      >
        {loadingError ? <p className="data-modal-feedback data-modal-feedback--error">{loadingError}</p> : null}
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
              disabled={loading || !tenantId}
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
              {loading ? (
                <div className="finance-records-empty">
                  <span>Loading records...</span>
                </div>
              ) : filteredRecords.length ? (
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
          {formError ? <p className="data-modal-feedback data-modal-feedback--error">{formError}</p> : null}
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
                list="finance-record-member-options"
                required
                placeholder="e.g. Grace Wanjiku or Feed purchase"
                value={addRecordForm.name}
                onChange={(event) => handleFormChange("name", event.target.value)}
              />
            </label>
            <label className="data-modal-field">
              Project
              <input
                type="text"
                list="finance-record-project-options"
                required={addRecordForm.type === "expense"}
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
            <button
              type="submit"
              className="data-modal-btn data-modal-btn--primary"
              disabled={isSaving || loading}
            >
              {isSaving ? "Saving..." : "Save record"}
            </button>
          </div>
        </form>
        <datalist id="finance-record-member-options">
          {members.map((member) => (
            <option key={member.id} value={member.name} />
          ))}
        </datalist>
      </DataModal>
      {showMobileFab ? (
        <button
          type="button"
          className="dashboard-page-fab"
          onClick={handleOpenAddRecord}
          aria-label="Add record transaction"
          disabled={loading || !tenantId}
        >
          <Icon name="plus" size={20} />
        </button>
      ) : null}
    </>
  );
}

export default FinanceRecordsPage;
