import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  createProjectExpense,
  deleteProjectExpense,
  getJgfBatches,
  getJppBatches,
  getProjectExpenseCategories,
  getProjectExpenses,
  getProjectsWithMembership,
  updateProjectExpense,
} from "../../lib/dataService.js";

const EXPENSE_CONFIGS = {
  JPP: {
    getBatches: getJppBatches,
  },
  JGF: {
    getBatches: getJgfBatches,
  },
};

export default function ExpensesPage({ user }) {
  const today = new Date().toISOString().slice(0, 10);

  const initialExpenseForm = {
    batch_id: "",
    expense_date: today,
    category: "",
    amount: "",
    vendor: "",
    description: "",
    receipt: false,
  };

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [batches, setBatches] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canViewAllProjects = ["admin", "superadmin", "project_manager"].includes(user?.role);

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const loadExpenseData = async (projectId, showLoading = true, config) => {
    if (!projectId) {
      setExpenses([]);
      setBatches([]);
      return;
    }
    if (showLoading) {
      setExpensesLoading(true);
    }
    try {
      resetMessages();
      const batchPromise = config?.getBatches ? config.getBatches() : Promise.resolve([]);
      const [batchRes, expenseRes] = await Promise.allSettled([
        batchPromise,
        getProjectExpenses(projectId),
      ]);

      const safeBatches = batchRes.status === "fulfilled" ? batchRes.value || [] : [];
      const safeExpenses = expenseRes.status === "fulfilled" ? expenseRes.value || [] : [];

      setBatches(safeBatches);
      setExpenses(safeExpenses);

      const errors = [batchRes, expenseRes]
        .filter((res) => res.status === "rejected")
        .map((res) => res.reason?.message || "Failed to load expense data.");

      if (errors.length > 0) {
        setErrorMessage(errors.join(" "));
      }
    } catch (error) {
      console.error("Error loading expense data:", error);
      setErrorMessage("Failed to load expense data.");
    } finally {
      if (showLoading) {
        setExpensesLoading(false);
      }
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      resetMessages();
      const data = await getProjectsWithMembership(user?.id);
      const accessibleProjects = (data || []).filter((project) => {
        if (canViewAllProjects) {
          return true;
        }
        return Boolean(project.membership) || project.project_leader === user?.id;
      });
      const sortedProjects = accessibleProjects.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
      setProjects(sortedProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
      setErrorMessage("Failed to load projects.");
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const projectLookup = useMemo(() => {
    return new Map(projects.map((project) => [String(project.id), project]));
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId && !projectLookup.has(selectedProjectId)) {
      setSelectedProjectId("");
      setShowExpenseForm(false);
      setEditingExpenseId(null);
      setExpenseForm(initialExpenseForm);
    }
  }, [projectLookup, selectedProjectId]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projectLookup.get(selectedProjectId) || null;
  }, [projectLookup, selectedProjectId]);

  const selectedProjectCode = selectedProject?.code
    ? String(selectedProject.code).trim().toUpperCase()
    : "";
  const expenseConfig = useMemo(() => {
    return EXPENSE_CONFIGS[selectedProjectCode] || null;
  }, [selectedProjectCode]);

  useEffect(() => {
    if (!selectedProjectId) {
      setExpenses([]);
      setBatches([]);
      setExpenseCategories([]);
      setExpensesLoading(false);
      return;
    }
    loadExpenseData(selectedProjectId, true, expenseConfig);
  }, [selectedProjectId, expenseConfig]);

  const loadExpenseCategories = async (projectCode) => {
    if (!projectCode) {
      setExpenseCategories([]);
      return;
    }
    setCategoriesLoading(true);
    try {
      const categories = await getProjectExpenseCategories(projectCode);
      setExpenseCategories(categories);
    } catch (error) {
      console.error("Error loading expense categories:", error);
      setErrorMessage("Failed to load expense categories.");
      setExpenseCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedProjectId) {
      setExpenseCategories([]);
      setCategoriesLoading(false);
      return;
    }
    loadExpenseCategories(selectedProjectCode);
  }, [selectedProjectId, selectedProjectCode]);

  useEffect(() => {
    if (!expenseForm.category && expenseCategories.length > 0) {
      setExpenseForm((prev) => ({ ...prev, category: expenseCategories[0] }));
    }
  }, [expenseCategories, expenseForm.category]);

  const batchLookup = useMemo(() => {
    return new Map(batches.map((batch) => [String(batch.id), batch]));
  }, [batches]);

  const getBatchLabel = (batchId) => {
    if (!batchId) return "Unassigned";
    const batch = batchLookup.get(String(batchId));
    if (!batch) return "Unknown";
    return batch.batch_code || batch.batch_name || "Batch";
  };

  const getMobileSubLabel = (expense) => {
    const batchLabel = getBatchLabel(expense.batch_id);
    if (batchLabel === "Unassigned" && expense.vendor) {
      return expense.vendor;
    }
    return batchLabel;
  };

  const parseOptionalNumber = (value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeOptional = (value) => {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = typeof value === "string" ? value.trim() : value;
    return trimmed === "" ? null : trimmed;
  };

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatCurrency = (value) => `Ksh. ${toNumber(value).toLocaleString("en-KE")}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const formatDateParts = (dateStr) => {
    if (!dateStr) {
      return { day: "--", weekday: "Unknown date", monthYear: "" };
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return { day: "--", weekday: "Unknown date", monthYear: "" };
    }
    return {
      day: String(date.getDate()).padStart(2, "0"),
      weekday: date.toLocaleDateString("en-KE", { weekday: "long" }),
      monthYear: date.toLocaleDateString("en-KE", { month: "long", year: "numeric" }),
    };
  };
  const formatExpenseTotal = (value) => {
    const numeric = Math.abs(toNumber(value));
    if (!numeric) {
      return formatCurrency(0);
    }
    return `-${formatCurrency(numeric)}`;
  };

  const categoryTones = [
    "emerald",
    "blue",
    "amber",
    "orange",
    "rose",
    "teal",
    "cyan",
    "slate",
  ];
  const getCategoryTone = (category) => {
    if (!category) return "slate";
    let hash = 0;
    for (let i = 0; i < category.length; i += 1) {
      hash = (hash * 31 + category.charCodeAt(i)) % 2147483647;
    }
    return categoryTones[Math.abs(hash) % categoryTones.length];
  };
  const getCategoryInitial = (category) => {
    if (!category) return "?";
    const trimmed = category.trim();
    return trimmed ? trimmed[0].toUpperCase() : "?";
  };

  const groupedExpenses = useMemo(() => {
    if (!expenses.length) {
      return [];
    }
    const buckets = new Map();
    expenses.forEach((expense) => {
      const key = expense.expense_date || "unknown";
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(expense);
    });
    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
      const aTime = new Date(a).getTime();
      const bTime = new Date(b).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
    return sortedKeys.map((key) => {
      const items = buckets.get(key) || [];
      const total = items.reduce((sum, item) => sum + toNumber(item.amount), 0);
      return { date: key, items, total };
    });
  }, [expenses]);

  const handleProjectSelect = (event) => {
    const value = event.target.value;
    setSelectedProjectId(value);
    setShowExpenseForm(false);
    setEditingExpenseId(null);
    setExpandedExpenseId(null);
    setExpenseForm({
      ...initialExpenseForm,
      category: "",
    });
    resetMessages();
  };

  const handleExpenseChange = (event) => {
    const { name, value, type, checked } = event.target;
    setExpenseForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    resetMessages();
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }

    if (!expenseForm.expense_date) {
      setErrorMessage("Expense date is required.");
      return;
    }

    if (!expenseForm.category) {
      setErrorMessage("Expense category is required.");
      return;
    }

    if (expenseCategories.length > 0 && !expenseCategories.includes(expenseForm.category)) {
      setErrorMessage("Select a valid category.");
      return;
    }

    const amount = parseOptionalNumber(expenseForm.amount);
    if (amount === null) {
      setErrorMessage("Expense amount is required.");
      return;
    }

    const payload = {
      batch_id: normalizeOptional(expenseForm.batch_id),
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      amount,
      vendor: normalizeOptional(expenseForm.vendor),
      description: normalizeOptional(expenseForm.description),
      receipt: expenseForm.receipt,
    };

    try {
      if (editingExpenseId) {
        await updateProjectExpense(editingExpenseId, payload);
        setStatusMessage("Expense updated.");
      } else {
        await createProjectExpense(selectedProjectId, payload);
        setStatusMessage("Expense logged.");
      }
      setExpenseForm(initialExpenseForm);
      setEditingExpenseId(null);
      setShowExpenseForm(false);
      await loadExpenseData(selectedProjectId, false, expenseConfig);
    } catch (error) {
      setErrorMessage(error.message || "Failed to save expense.");
    }
  };

  const handleExpenseEdit = (expense) => {
    setExpenseForm({
      ...initialExpenseForm,
      ...expense,
      batch_id: expense.batch_id ? String(expense.batch_id) : "",
      expense_date: expense.expense_date || today,
      amount: expense.amount ?? "",
      vendor: expense.vendor ?? "",
      description: expense.description ?? "",
      receipt: Boolean(expense.receipt),
      category: expense.category || expenseCategories[0] || "",
    });
    setEditingExpenseId(expense.id);
    setShowExpenseForm(true);
    setExpandedExpenseId(null);
    resetMessages();
  };

  const handleExpenseDelete = async (expenseId) => {
    if (!confirm("Delete this expense entry?")) {
      return;
    }
    resetMessages();
    try {
      await deleteProjectExpense(expenseId);
      setStatusMessage("Expense deleted.");
      setExpandedExpenseId(null);
      await loadExpenseData(selectedProjectId, false, expenseConfig);
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete expense.");
    }
  };

  const handleExpenseCancel = () => {
    setExpenseForm(initialExpenseForm);
    setEditingExpenseId(null);
    setShowExpenseForm(false);
  };

  const handleNewExpense = () => {
    if (!selectedProjectId) {
      setErrorMessage("Select a project first.");
      return;
    }
    resetMessages();
    setExpandedExpenseId(null);
    setExpenseForm({
      ...initialExpenseForm,
      category: expenseCategories[0] || "",
    });
    setEditingExpenseId(null);
    setShowExpenseForm(true);
  };

  const toggleExpenseDetails = (expenseId) => {
    setExpandedExpenseId((prev) => (prev === expenseId ? null : expenseId));
  };

  if (projectsLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="jpp-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Expense</h1>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="admin-card jpp-empty-card">
          <h3>No accessible projects</h3>
          <p className="admin-help">You do not have access to any projects yet.</p>
        </div>
      ) : (
        <div className="admin-card expense-project-card">
          <div className="section-header">
            <h3>
              <Icon name="briefcase" size={18} /> Project
            </h3>
          </div>
          <div className="admin-form-field">
            <label>Select Project</label>
            <select value={selectedProjectId} onChange={handleProjectSelect}>
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name} ({project.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className={`jpp-tab-grid expense-grid${showExpenseForm ? "" : " is-collapsed"}`}>
        {showExpenseForm && (
          <div className="admin-card">
            <h3>{editingExpenseId ? "Edit Expense" : "Add Expense"}</h3>
            <form className="admin-form" onSubmit={handleExpenseSubmit}>
              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label>Batch</label>
                  <select
                    name="batch_id"
                    value={expenseForm.batch_id}
                    onChange={handleExpenseChange}
                  >
                    <option value="">Unassigned</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={String(batch.id)}>
                        {batch.batch_code || batch.batch_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-field">
                  <label>Expense Date *</label>
                  <input
                    type="date"
                    name="expense_date"
                    value={expenseForm.expense_date}
                    onChange={handleExpenseChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={expenseForm.category}
                    onChange={handleExpenseChange}
                    disabled={categoriesLoading || expenseCategories.length === 0}
                  >
                    <option value="">
                      {categoriesLoading ? "Loading categories..." : "Select category"}
                    </option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {expenseCategories.length === 0 && !categoriesLoading && (
                    <p className="admin-help">No categories configured for this project.</p>
                  )}
                </div>
                <div className="admin-form-field">
                  <label>Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="amount"
                    value={expenseForm.amount}
                    onChange={handleExpenseChange}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Vendor</label>
                  <input
                    name="vendor"
                    value={expenseForm.vendor}
                    onChange={handleExpenseChange}
                  />
                </div>
                <div className="admin-form-field admin-form-field--full">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={expenseForm.description}
                    onChange={handleExpenseChange}
                    rows={3}
                  />
                </div>
                <div className="admin-form-field">
                  <label className="jpp-checkbox-inline">
                    <input
                      type="checkbox"
                      name="receipt"
                      checked={expenseForm.receipt}
                      onChange={handleExpenseChange}
                    />
                    Receipt available
                  </label>
                </div>
              </div>

              <div className="admin-form-actions">
                <button className="btn-primary" type="submit">
                  {editingExpenseId ? "Save Changes" : "Add Expense"}
                </button>
                <button className="btn-secondary" type="button" onClick={handleExpenseCancel}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={`admin-card expense-history-card${showExpenseForm ? "" : " is-full"}`}>
          <div className="section-header expense-section-header">
            <h3>
              <Icon name="receipt" size={18} /> Expense History
            </h3>
            <div className="expense-header-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={handleNewExpense}
                disabled={!selectedProjectId}
              >
                <Icon name="plus" size={16} />
                New Expense
              </button>
            </div>
          </div>
          {!selectedProjectId ? (
            <div className="empty-state">
              <Icon name="briefcase" size={40} />
              <h3>Select a project</h3>
              <p>Choose a project to view its expenses.</p>
            </div>
          ) : expensesLoading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading expenses...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="empty-state">
              <Icon name="receipt" size={40} />
              <h3>No expenses yet</h3>
              <p>Log project expenses to track spend by batch.</p>
            </div>
          ) : (
            <>
              <div className="jpp-table-wrap">
                <table className="jpp-table expense-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Batch</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Vendor</th>
                      <th>Receipt</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>{formatDate(expense.expense_date)}</td>
                        <td>{getBatchLabel(expense.batch_id)}</td>
                        <td>{expense.category}</td>
                        <td>{formatCurrency(expense.amount)}</td>
                        <td>{expense.vendor || "-"}</td>
                        <td>{expense.receipt ? "Yes" : "No"}</td>
                        <td>
                          <div className="jpp-table-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleExpenseEdit(expense)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button jpp-danger"
                              onClick={() => handleExpenseDelete(expense.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="expense-mobile-list" aria-label="Expense history mobile view">
                {groupedExpenses.map((group) => {
                  const dateParts = formatDateParts(group.date);
                  return (
                    <div className="expense-day-group" key={group.date}>
                      <div className="expense-day-card">
                        <div className="expense-day-date">
                          <span className="expense-day-number">{dateParts.day}</span>
                          <div className="expense-day-meta">
                            <span className="expense-day-weekday">{dateParts.weekday}</span>
                            <span className="expense-day-month">{dateParts.monthYear}</span>
                          </div>
                        </div>
                        <span className="expense-day-total">
                          {formatExpenseTotal(group.total)}
                        </span>
                      </div>
                      <div className="expense-day-list">
                        {group.items.map((expense) => {
                          const isExpanded = expandedExpenseId === expense.id;
                          const categoryLabel = expense.category || "Other";
                          const subLabel = getMobileSubLabel(expense);
                          const tone = getCategoryTone(categoryLabel);
                          return (
                            <div
                              key={expense.id}
                              className={`expense-mobile-card${isExpanded ? " is-open" : ""}`}
                            >
                              <div className="expense-mobile-item">
                                <div className={`expense-category-icon expense-tone-${tone}`}>
                                  {getCategoryInitial(categoryLabel)}
                                </div>
                                <div className="expense-mobile-body">
                                  <span className="expense-mobile-title">{categoryLabel}</span>
                                  <span className="expense-mobile-sub">{subLabel}</span>
                                </div>
                                <div className="expense-mobile-meta">
                                  <span className="expense-mobile-amount">
                                    {formatCurrency(expense.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    className="btn-icon small expense-mobile-more"
                                    onClick={() => toggleExpenseDetails(expense.id)}
                                    aria-expanded={isExpanded}
                                    aria-label="More details"
                                  >
                                    <Icon name="more-horizontal" size={16} />
                                  </button>
                                </div>
                              </div>
                              <div className="expense-mobile-details">
                                <div className="expense-mobile-detail-grid">
                                  <div className="expense-mobile-detail">
                                    <span className="expense-mobile-label">Vendor</span>
                                    <span className="expense-mobile-value">
                                      {expense.vendor || "-"}
                                    </span>
                                  </div>
                                  <div className="expense-mobile-detail">
                                    <span className="expense-mobile-label">Receipt</span>
                                    <span className="expense-mobile-value">
                                      {expense.receipt ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  {expense.description ? (
                                    <div className="expense-mobile-detail is-full">
                                      <span className="expense-mobile-label">Notes</span>
                                      <span className="expense-mobile-value">
                                        {expense.description}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="expense-mobile-actions">
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => handleExpenseEdit(expense)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="link-button jpp-danger"
                                    onClick={() => handleExpenseDelete(expense.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
