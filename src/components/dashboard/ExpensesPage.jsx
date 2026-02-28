import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import {
  createProjectExpense,
  deleteProjectExpense,
  getJgfBatches,
  getJppBatches,
  getProjectExpenseCategories,
  getProjectExpensesForProjects,
  getProjectSalesForProjects,
  getProjectsWithMembership,
  updateProjectExpense,
} from "../../lib/dataService.js";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";

const EXPENSE_CONFIGS = {
  jpp: {
    getBatches: getJppBatches,
  },
  jgf: {
    getBatches: getJgfBatches,
  },
};

const EXPENSE_RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "Custom", days: 0 },
];

export default function ExpensesPage({ user, tenantId }) {
  const { formatCurrency: formatTenantCurrency } = useTenantCurrency();
  const today = new Date().toISOString().slice(0, 10);

  const initialExpenseForm = {
    project_id: "",
    batch_id: "",
    expense_date: today,
    category: "",
    amount: "",
    vendor: "",
    description: "",
    receipt: false,
  };

  const [projects, setProjects] = useState([]);
  const [batchesByProject, setBatchesByProject] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [mobileRangeDays, setMobileRangeDays] = useState(7);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canViewAllProjects = ["admin", "superadmin", "supervisor"].includes(user?.role);

  const resetMessages = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const loadExpenseData = async (projectIds, showLoading = true) => {
    if (!projectIds.length) {
      setExpenses([]);
      return;
    }
    if (showLoading) {
      setExpensesLoading(true);
    }
    try {
      resetMessages();
      const data = await getProjectExpensesForProjects(projectIds, tenantId);
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expense data:", error);
      setErrorMessage("Failed to load expense data.");
      setExpenses([]);
    } finally {
      if (showLoading) {
        setExpensesLoading(false);
      }
    }
  };

  const loadSalesData = async (projectIds) => {
    if (!projectIds.length) {
      setSales([]);
      return;
    }
    try {
      const data = await getProjectSalesForProjects(projectIds, tenantId);
      setSales(data || []);
    } catch (error) {
      console.error("Error loading project sales:", error);
      setSales([]);
    }
  };

  const loadBatchesForProjects = async (projectList) => {
    if (!projectList.length) {
      setBatchesByProject({});
      return;
    }
    const baseMap = {};
    projectList.forEach((project) => {
      if (project?.id) {
        baseMap[String(project.id)] = [];
      }
    });
    const tasks = projectList.map((project) => {
      const raw = project?.module_key || project?.code || "";
      const moduleKey = String(raw).trim().toLowerCase();
      const config = EXPENSE_CONFIGS[moduleKey];
      if (!config?.getBatches || !project?.id) {
        return Promise.resolve({ projectId: project?.id, list: [] });
      }
      return config
        .getBatches(tenantId, project.id)
        .then((list) => ({ projectId: project.id, list: list || [] }));
    });

    setBatchesLoading(true);
    try {
      const results = await Promise.allSettled(tasks);
      const nextMap = { ...baseMap };
      const errors = [];
      results.forEach((result, index) => {
        const project = projectList[index];
        if (!project?.id) {
          return;
        }
        if (result.status === "fulfilled") {
          nextMap[String(project.id)] = result.value.list || [];
        } else {
          nextMap[String(project.id)] = [];
          errors.push(result.reason?.message || "Failed to load batch data.");
        }
      });
      setBatchesByProject(nextMap);
      if (errors.length > 0) {
        setErrorMessage(errors.join(" "));
      }
    } catch (error) {
      console.error("Error loading batches:", error);
      setErrorMessage("Failed to load batch data.");
      setBatchesByProject(baseMap);
    } finally {
      setBatchesLoading(false);
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      resetMessages();
      const data = await getProjectsWithMembership(user?.id, tenantId);
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
  }, [user, tenantId]);

  const projectLookup = useMemo(() => {
    return new Map(projects.map((project) => [String(project.id), project]));
  }, [projects]);

  const accessibleProjectIds = useMemo(() => {
    return projects.map((project) => project.id).filter(Boolean);
  }, [projects]);
  const defaultProjectId = useMemo(() => {
    return accessibleProjectIds.length ? String(accessibleProjectIds[0]) : "";
  }, [accessibleProjectIds]);

  useEffect(() => {
    if (projectsLoading) {
      return;
    }
    if (accessibleProjectIds.length === 0) {
      setExpenses([]);
      setSales([]);
      setExpenseCategories([]);
      setBatchesByProject({});
      setExpensesLoading(false);
      setSalesLoading(false);
      return;
    }
    loadExpenseData(accessibleProjectIds);
    loadSalesData(accessibleProjectIds);
    loadBatchesForProjects(projects);
  }, [accessibleProjectIds, projects, projectsLoading]);

  useEffect(() => {
    if (projectsLoading) {
      return;
    }
    if (accessibleProjectIds.length === 0) {
      setExpenseForm(initialExpenseForm);
      setEditingExpenseId(null);
      setShowExpenseForm(false);
      return;
    }
    setExpenseForm((prev) => {
      const currentId = prev.project_id ? String(prev.project_id) : "";
      if (currentId && projectLookup.has(currentId)) {
        return prev;
      }
      return { ...prev, project_id: String(accessibleProjectIds[0]) };
    });
  }, [accessibleProjectIds, projectLookup, projectsLoading]);

  const formProjectId = expenseForm.project_id ? String(expenseForm.project_id) : "";
  const formProject = useMemo(() => {
    if (!formProjectId) return null;
    return projectLookup.get(formProjectId) || null;
  }, [formProjectId, projectLookup]);
  const categoryProjectRef = formProjectId;
  const formBatches = useMemo(() => {
    if (!formProjectId) return [];
    return batchesByProject[formProjectId] || [];
  }, [batchesByProject, formProjectId]);

  const loadExpenseCategories = async (projectRef) => {
    if (!projectRef) {
      setExpenseCategories([]);
      return;
    }
    setCategoriesLoading(true);
    try {
      const categories = await getProjectExpenseCategories(projectRef, tenantId);
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
    if (!formProjectId) {
      setExpenseCategories([]);
      setCategoriesLoading(false);
      return;
    }
    setExpenseCategories([]);
    loadExpenseCategories(categoryProjectRef);
  }, [categoryProjectRef, formProjectId]);

  useEffect(() => {
    if (!expenseForm.category && expenseCategories.length > 0) {
      setExpenseForm((prev) => ({ ...prev, category: expenseCategories[0] }));
    }
  }, [expenseCategories, expenseForm.category]);

  const batchLookupByProject = useMemo(() => {
    const lookup = new Map();
    Object.entries(batchesByProject).forEach(([projectId, list]) => {
      const map = new Map((list || []).map((batch) => [String(batch.id), batch]));
      lookup.set(String(projectId), map);
    });
    return lookup;
  }, [batchesByProject]);

  const getBatchLabel = (batchId, projectId) => {
    if (!batchId) return "Unassigned";
    const projectKey = projectId ? String(projectId) : "";
    const projectMap = projectKey ? batchLookupByProject.get(projectKey) : null;
    if (projectMap?.has(String(batchId))) {
      const batch = projectMap.get(String(batchId));
      return batch?.batch_code || batch?.batch_name || "Batch";
    }
    if (!projectKey) {
      for (const map of batchLookupByProject.values()) {
        if (map.has(String(batchId))) {
          const batch = map.get(String(batchId));
          return batch?.batch_code || batch?.batch_name || "Batch";
        }
      }
    }
    return "Unknown";
  };

  const getProjectLabel = (projectId) => {
    if (!projectId) return "";
    const project = projectLookup.get(String(projectId));
    return project?.name || project?.code || project?.module_key || "";
  };

  const getMobileSubLabel = (expense) => {
    const batchLabel = getBatchLabel(expense.batch_id, expense.project_id);
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

  const formatCurrency = (value) =>
    formatTenantCurrency(toNumber(value), { maximumFractionDigits: 0 });
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
    return `- ${formatCurrency(numeric)}`;
  };

  const toDateKey = (value) => {
    if (!value) return "";
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  };

  const filterByRange = (items, days, dateKey) => {
    if (!days) return items;
    const todayDate = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(todayDate.getDate() - (days - 1));
    return items.filter((item) => {
      const value = item?.[dateKey];
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date >= start && date <= todayDate;
    });
  };

  const getSalesTotal = (sale) => {
    if (!sale) return 0;
    if (sale.total_amount !== undefined && sale.total_amount !== null) {
      return toNumber(sale.total_amount);
    }
    const units = toNumber(sale.quantity_units);
    const unitPrice = toNumber(sale.unit_price);
    const kg = toNumber(sale.quantity_kg);
    return units * unitPrice || kg * unitPrice;
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
    const normalized = String(category).toLowerCase();
    if (normalized.includes("feed")) return "emerald";
    if (normalized.includes("med")) return "amber";
    if (normalized.includes("transport")) return "orange";
    if (normalized.includes("utilit")) return "orange";
    if (normalized.includes("packag")) return "blue";
    if (normalized.includes("labour")) return "teal";
    if (normalized.includes("marketing")) return "rose";
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
  const toneColors = {
    emerald: "#4f8f54",
    blue: "#60a5fa",
    amber: "#fbbf24",
    orange: "#fb923c",
    rose: "#f472b6",
    teal: "#2dd4bf",
    cyan: "#38bdf8",
    slate: "#94a3b8",
  };
  const getToneColor = (tone) => toneColors[tone] || toneColors.slate;

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

  const activeRangeDays = mobileRangeDays || 30;

  const rangedExpenses = useMemo(() => {
    return filterByRange(expenses, activeRangeDays, "expense_date");
  }, [expenses, activeRangeDays]);

  const rangedSales = useMemo(() => {
    return filterByRange(sales, activeRangeDays, "sale_date");
  }, [sales, activeRangeDays]);

  const rangeTotals = useMemo(() => {
    const spendTotal = rangedExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const salesTotal = rangedSales.reduce((sum, sale) => sum + getSalesTotal(sale), 0);
    const avgPerDay = activeRangeDays ? spendTotal / activeRangeDays : spendTotal;
    const profit = salesTotal - spendTotal;
    return {
      spendTotal,
      salesTotal,
      avgPerDay,
      profit,
    };
  }, [rangedExpenses, rangedSales, activeRangeDays]);

  const profitPercent = rangeTotals.spendTotal
    ? (rangeTotals.profit / rangeTotals.spendTotal) * 100
    : 0;

  const breakdown = useMemo(() => {
    const totals = new Map();
    rangedExpenses.forEach((expense) => {
      const category = expense.category || "Other";
      totals.set(category, (totals.get(category) || 0) + toNumber(expense.amount));
    });
    const grandTotal = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
    const items = Array.from(totals.entries())
      .map(([category, total]) => ({
        category,
        total,
        percent: grandTotal ? (total / grandTotal) * 100 : 0,
        tone: getCategoryTone(category),
      }))
      .sort((a, b) => b.total - a.total);
    return { items, grandTotal };
  }, [rangedExpenses]);

  const highestCategory = breakdown.items[0];

  const sortedRangedExpenses = useMemo(() => {
    return [...rangedExpenses].sort((a, b) => {
      const aTime = new Date(a.expense_date || 0).getTime();
      const bTime = new Date(b.expense_date || 0).getTime();
      return bTime - aTime;
    });
  }, [rangedExpenses]);

  const chartDays = useMemo(() => {
    const days = activeRangeDays;
    const result = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(base);
      date.setDate(base.getDate() - i);
      result.push(toDateKey(date));
    }
    return result;
  }, [activeRangeDays]);

  const chartSeries = useMemo(() => {
    const expenseSeries = chartDays.map((day) => {
      return rangedExpenses
        .filter((expense) => toDateKey(expense.expense_date) === day)
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    });
    const salesSeries = chartDays.map((day) => {
      return rangedSales
        .filter((sale) => toDateKey(sale.sale_date) === day)
        .reduce((sum, sale) => sum + getSalesTotal(sale), 0);
    });
    return { expenseSeries, salesSeries };
  }, [chartDays, rangedExpenses, rangedSales]);

  const chartTicks = useMemo(() => {
    if (chartDays.length <= 1) return chartDays;
    const step = Math.max(1, Math.floor((chartDays.length - 1) / 4));
    return chartDays.filter((_, index) => index % step === 0 || index === chartDays.length - 1);
  }, [chartDays]);

  const chartMax = Math.max(
    1,
    ...chartSeries.expenseSeries,
    ...chartSeries.salesSeries
  );

  const buildSeriesPoints = (series, width, height, padding = 12) => {
    if (!series.length) return [];
    if (series.length === 1) {
      const x = width / 2;
      const y =
        height -
        padding -
        (series[0] / chartMax) * (height - padding * 2);
      return [{ x, y }];
    }
    return series.map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (series.length - 1);
      const y =
        height - padding - (value / chartMax) * (height - padding * 2);
      return { x, y };
    });
  };

  const buildSmoothPath = (points) => {
    if (!points.length) return "";
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y}`;
    }
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const buildAreaPath = (points, width, height, padding = 12) => {
    if (!points.length) return "";
    const linePath = buildSmoothPath(points);
    const lastPoint = points[points.length - 1];
    const baseY = height - padding;
    return `${linePath} L ${lastPoint.x} ${baseY} L ${points[0].x} ${baseY} Z`;
  };

  const chartWidth = 320;
  const chartHeight = 140;
  const expensePoints = buildSeriesPoints(
    chartSeries.expenseSeries,
    chartWidth,
    chartHeight
  );
  const salesPoints = buildSeriesPoints(
    chartSeries.salesSeries,
    chartWidth,
    chartHeight
  );
  const expenseLinePath = buildSmoothPath(expensePoints);
  const salesLinePath = buildSmoothPath(salesPoints);
  const expenseAreaPath = buildAreaPath(expensePoints, chartWidth, chartHeight);

  const lastExpensePoint = expensePoints.length
    ? expensePoints[expensePoints.length - 1]
    : null;
  const lastSalesPoint = salesPoints.length
    ? salesPoints[salesPoints.length - 1]
    : null;

  const handleExpenseChange = (event) => {
    const { name, value, type, checked } = event.target;
    setExpenseForm((prev) => {
      const nextValue = type === "checkbox" ? checked : value;
      const nextState = { ...prev, [name]: nextValue };
      if (name === "project_id") {
        nextState.batch_id = "";
        nextState.category = "";
      }
      return nextState;
    });
    resetMessages();
  };

  const handleExpenseSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    const activeProjectId = expenseForm.project_id
      ? String(expenseForm.project_id)
      : "";

    if (!activeProjectId || !projectLookup.has(activeProjectId)) {
      setErrorMessage("Select a valid project.");
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
        await updateProjectExpense(editingExpenseId, payload, tenantId);
        setStatusMessage("Expense updated.");
      } else {
        await createProjectExpense(activeProjectId, payload, tenantId);
        setStatusMessage("Expense logged.");
      }
      setExpenseForm({
        ...initialExpenseForm,
        project_id: activeProjectId,
      });
      setEditingExpenseId(null);
      setShowExpenseForm(false);
      await loadExpenseData(accessibleProjectIds, false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to save expense.");
    }
  };

  const handleExpenseEdit = (expense) => {
    setExpenseForm({
      ...initialExpenseForm,
      ...expense,
      project_id: expense.project_id ? String(expense.project_id) : "",
      batch_id: expense.batch_id ? String(expense.batch_id) : "",
      expense_date: expense.expense_date || today,
      amount: expense.amount ?? "",
      vendor: expense.vendor ?? "",
      description: expense.description ?? "",
      receipt: Boolean(expense.receipt),
      category: expense.category || "",
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
      await deleteProjectExpense(expenseId, tenantId);
      setStatusMessage("Expense deleted.");
      setExpandedExpenseId(null);
      await loadExpenseData(accessibleProjectIds, false);
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete expense.");
    }
  };

  const handleExpenseCancel = () => {
    setExpenseForm({
      ...initialExpenseForm,
      project_id: defaultProjectId,
    });
    setEditingExpenseId(null);
    setShowExpenseForm(false);
    setExpandedExpenseId(null);
    resetMessages();
  };

  const handleNewExpense = () => {
    if (!defaultProjectId) {
      setErrorMessage("No accessible projects.");
      return;
    }
    resetMessages();
    setExpandedExpenseId(null);
    setExpenseForm({
      ...initialExpenseForm,
      project_id: defaultProjectId,
      category: "",
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
          <h1>Expenses</h1>
          <p>All projects</p>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`admin-alert ${errorMessage ? "is-error" : "is-success"}`}>
          <span>{errorMessage || statusMessage}</span>
        </div>
      )}

      {projects.length > 0 && (
        <div className="expense-mobile-header">
          <div className="expense-mobile-title-row">
            <div className="expense-mobile-title">
              <h2>Expenses</h2>
              <p>All projects</p>
            </div>
            <button className="expense-filter-btn" type="button" aria-label="Filter expenses">
              <Icon name="filter" size={18} />
            </button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="admin-card jpp-empty-card">
          <h3>No accessible projects</h3>
          <p className="admin-help">You do not have access to any projects yet.</p>
        </div>
      ) : null}

      <div className={`jpp-tab-grid expense-grid${showExpenseForm ? "" : " is-collapsed"}`}>
        {showExpenseForm && (
          <div className="admin-card">
            <h3>{editingExpenseId ? "Edit Expense" : "Add Expense"}</h3>
            <form className="admin-form" onSubmit={handleExpenseSubmit}>
              <div className="admin-form-grid">
                <div className="admin-form-field">
                  <label>Project *</label>
                  <select
                    name="project_id"
                    value={expenseForm.project_id}
                    onChange={handleExpenseChange}
                    disabled={Boolean(editingExpenseId)}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {project.name} ({project.code || String(project.module_key || "").toUpperCase()})
                      </option>
                    ))}
                  </select>
                  {editingExpenseId && (
                    <p className="admin-help">Project cannot be changed.</p>
                  )}
                </div>
                <div className="admin-form-field">
                  <label>Batch</label>
                  <select
                    name="batch_id"
                    value={expenseForm.batch_id}
                    onChange={handleExpenseChange}
                    disabled={batchesLoading || formBatches.length === 0}
                  >
                    <option value="">Unassigned</option>
                    {formBatches.map((batch) => (
                      <option key={batch.id} value={String(batch.id)}>
                        {batch.batch_code || batch.batch_name}
                      </option>
                    ))}
                  </select>
                  {formBatches.length === 0 && !batchesLoading && (
                    <p className="admin-help">No batches available for this project.</p>
                  )}
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

        <div
          className={`admin-card expense-history-card${
            showExpenseForm ? " is-form-open" : " is-full"
          }`}
        >
          <div className="section-header expense-section-header">
            <h3>
              <Icon name="receipt" size={18} /> Expense History
            </h3>
            <div className="expense-header-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={handleNewExpense}
                disabled={!defaultProjectId}
              >
                <Icon name="plus" size={16} />
                New Expense
              </button>
            </div>
          </div>
          {projects.length > 0 && (
            <div className="expense-mobile-dashboard">
              <div className="expense-mobile-summary-card">
                <div className="expense-mobile-summary-header">
                  <div>
                    <span className="expense-mobile-summary-label">Total spend</span>
                    <span className="expense-mobile-summary-sub">
                      Last {activeRangeDays} days
                    </span>
                  </div>
                  <span className="expense-mobile-summary-pill">
                    All projects
                  </span>
                </div>
                <div className="expense-mobile-summary-grid">
                  <div>
                    <div className="expense-mobile-summary-value is-negative">
                      {formatExpenseTotal(rangeTotals.spendTotal)}
                    </div>
                    <div className="expense-mobile-summary-meta">
                      <span>Avg / day</span>
                      <strong>{formatCurrency(rangeTotals.avgPerDay)}</strong>
                    </div>
                    <div className="expense-mobile-summary-meta">
                      <span>Highest category</span>
                      <strong>
                        {highestCategory
                          ? `${highestCategory.category} (${highestCategory.percent.toFixed(0)}%)`
                          : "N/A"}
                      </strong>
                    </div>
                  </div>
                  <div className="expense-mobile-summary-divider" aria-hidden="true"></div>
                  <div>
                    <div className="expense-mobile-summary-value">
                      {formatCurrency(rangeTotals.salesTotal)}
                    </div>
                    <div
                      className={`expense-mobile-summary-change${
                        rangeTotals.profit >= 0 ? " is-positive" : " is-negative"
                      }`}
                    >
                      {rangeTotals.profit >= 0 ? "+" : "-"}
                      {Math.abs(profitPercent).toFixed(0)}%
                    </div>
                    <div className="expense-mobile-summary-meta">
                      <span>Profit</span>
                      <strong>{formatCurrency(rangeTotals.profit)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="expense-mobile-range-tabs" role="tablist">
                {EXPENSE_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={`expense-mobile-range${
                      mobileRangeDays === option.days ? " is-active" : ""
                    }`}
                    onClick={() => setMobileRangeDays(option.days)}
                    role="tab"
                    aria-selected={mobileRangeDays === option.days}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="expense-mobile-chart-card">
                <div className="expense-mobile-chart-header">
                  <div>
                    <h4>Expense vs. Sales</h4>
                    <span>Last {activeRangeDays} days</span>
                  </div>
                  <div className="expense-mobile-chart-legend">
                    <span className="legend-item sales">Sales</span>
                    <span className="legend-item expenses">Expenses</span>
                  </div>
                </div>
                <div className="expense-mobile-chart">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    aria-hidden="true"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#8fbc8f" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#8fbc8f" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={expenseAreaPath} fill="url(#expenseFill)" />
                    <path
                      d={salesLinePath}
                      stroke="#b5c1d0"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={expenseLinePath}
                      stroke="#3a6d47"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {lastExpensePoint && (
                      <circle
                        cx={lastExpensePoint.x}
                        cy={lastExpensePoint.y}
                        r="4"
                        fill="#3a6d47"
                        stroke="#f0f5ed"
                        strokeWidth="2"
                      />
                    )}
                    {lastSalesPoint && (
                      <circle
                        cx={lastSalesPoint.x}
                        cy={lastSalesPoint.y}
                        r="3"
                        fill="#b5c1d0"
                        stroke="#f8fafc"
                        strokeWidth="2"
                      />
                    )}
                  </svg>
                  <div className="expense-mobile-chart-axis">
                    {chartTicks.map((tick) => (
                      <span key={tick}>{new Date(tick).getDate()}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="expense-mobile-breakdown-card">
                <div className="expense-mobile-breakdown-header">
                  <h4>Expenses Breakdown</h4>
                  <span>{formatCurrency(breakdown.grandTotal)}</span>
                </div>
                {breakdown.items.length === 0 ? (
                  <p className="expense-mobile-empty">No expenses recorded in this range.</p>
                ) : (
                  <div className="expense-mobile-breakdown-list">
                    {breakdown.items.map((item) => (
                      <div className="expense-breakdown-row" key={item.category}>
                        <div className={`expense-category-icon expense-tone-${item.tone}`}>
                          {getCategoryInitial(item.category)}
                        </div>
                        <div className="expense-breakdown-info">
                          <div className="expense-breakdown-title">
                            <span>{item.category}</span>
                            <strong>{formatCurrency(item.total)}</strong>
                          </div>
                          <div className="expense-breakdown-bar">
                            <span
                              style={{
                                width: `${item.percent}%`,
                                background: getToneColor(item.tone),
                              }}
                            ></span>
                          </div>
                        </div>
                        <span className="expense-breakdown-percent">
                          {item.percent.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="expense-mobile-history-card">
                <div className="expense-mobile-history-header">
                  <h4>Expense History</h4>
                  <span>{sortedRangedExpenses.length} items</span>
                </div>
                {expensesLoading ? (
                  <p className="expense-mobile-empty">Loading expenses...</p>
                ) : sortedRangedExpenses.length === 0 ? (
                  <p className="expense-mobile-empty">No expenses logged yet.</p>
                ) : (
                  <div className="expense-mobile-history-list">
                    {sortedRangedExpenses.map((expense) => {
                      const categoryLabel = expense.category || "Other";
                      const tone = getCategoryTone(categoryLabel);
                      const batchLabel = getBatchLabel(
                        expense.batch_id,
                        expense.project_id
                      );
                      const meta = [
                        getProjectLabel(expense.project_id),
                        formatDate(expense.expense_date),
                        batchLabel !== "Unassigned" ? batchLabel : null,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <div className="expense-history-item" key={`mobile-${expense.id}`}>
                          <div className={`expense-category-icon expense-tone-${tone}`}>
                            {getCategoryInitial(categoryLabel)}
                          </div>
                          <div className="expense-history-info">
                            <span className="expense-history-title">{categoryLabel}</span>
                            <span className="expense-history-sub">{meta || "Unassigned"}</span>
                          </div>
                          <span className="expense-history-amount">
                            {formatExpenseTotal(expense.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {projects.length > 0 && !showExpenseForm && (
            <button
              type="button"
              className="expense-mobile-fab"
              onClick={handleNewExpense}
              aria-label="Add expense"
            >
              <Icon name="plus" size={22} />
            </button>
          )}
          {projects.length === 0 ? (
            <div className="empty-state">
              <Icon name="briefcase" size={40} />
              <h3>No accessible projects</h3>
              <p>Request access to a project to view expenses.</p>
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
                      <th>Project</th>
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
                        <td>{getProjectLabel(expense.project_id) || "-"}</td>
                        <td>{getBatchLabel(expense.batch_id, expense.project_id)}</td>
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
                                    <span
                                      className={`expense-mobile-value expense-mobile-tag${
                                        expense.receipt ? " is-yes" : " is-no"
                                      }`}
                                    >
                                      {expense.receipt ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  {expense.description ? (
                                    <div className="expense-mobile-detail is-full">
                                      <span className="expense-mobile-label">Notes</span>
                                      <span className="expense-mobile-value expense-mobile-notes">
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
