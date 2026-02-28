import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons.jsx";
import DashboardMobileNav from "./DashboardMobileNav.jsx";
import {
  getProjectExpensesForProjects,
  getProjectSalesForProjects,
  getProjectsWithMembership,
} from "../../lib/dataService.js";
import { useTenantCurrency } from "./TenantCurrencyContext.jsx";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Week", days: 7 },
  { label: "Month", days: 30 },
  { label: "Custom", days: 90 },
];

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "poultry", label: "Poultry" },
  { key: "groundnuts", label: "Groundnuts" },
  { key: "group", label: "Group" },
  { key: "mine", label: "My cont" },
];

const formatLabel = (value) => {
  if (!value) return "";
  const text = String(value).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const resolveModuleKey = (project) => {
  const raw = project?.module_key || project?.code || "";
  const lower = String(raw).trim().toLowerCase();
  if (lower === "jpp" || lower === "jgf") return lower;
  const upper = String(raw).trim().toUpperCase();
  if (upper === "JPP") return "jpp";
  if (upper === "JGF") return "jgf";
  return "";
};

export default function ReportsPage({ user, access, setActivePage, tenantId }) {
  const { formatCurrency } = useTenantCurrency();
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(7);
  const [filterKey, setFilterKey] = useState("all");
  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.key === filterKey)?.label || "All";

  const canViewAllProjects = ["admin", "superadmin", "supervisor"].includes(user?.role);

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const data = await getProjectsWithMembership(user?.id, tenantId);
        const accessible = (data || []).filter((project) => {
          if (canViewAllProjects) return true;
          return Boolean(project.membership) || project.project_leader === user?.id;
        });
        setProjects(accessible);
      } catch (error) {
        console.error("Error loading projects:", error);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, [user, canViewAllProjects, tenantId]);

  const filteredProjects = useMemo(() => {
    if (filterKey === "all") return projects;
    if (filterKey === "poultry") {
      return projects.filter((project) => resolveModuleKey(project) === "jpp");
    }
    if (filterKey === "groundnuts") {
      return projects.filter((project) => resolveModuleKey(project) === "jgf");
    }
    if (filterKey === "mine" && canViewAllProjects) {
      return projects.filter(
        (project) => Boolean(project.membership) || project.project_leader === user?.id
      );
    }
    return projects;
  }, [projects, filterKey, canViewAllProjects, user?.id]);

  const filteredProjectIds = useMemo(
    () => filteredProjects.map((project) => project.id).filter(Boolean),
    [filteredProjects]
  );

  useEffect(() => {
    if (!filteredProjectIds.length) {
      setExpenses([]);
      setSales([]);
      return;
    }
    const loadData = async () => {
      try {
        const [expenseData, salesData] = await Promise.all([
          getProjectExpensesForProjects(filteredProjectIds, tenantId),
          getProjectSalesForProjects(filteredProjectIds, tenantId),
        ]);
        setExpenses(expenseData || []);
        setSales(salesData || []);
      } catch (error) {
        console.error("Error loading report data:", error);
        setExpenses([]);
        setSales([]);
      }
    };
    loadData();
  }, [filteredProjectIds, tenantId]);

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatMoney = (value) => formatCurrency(toNumber(value), { maximumFractionDigits: 0 });

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

  const getDateRange = (days, offset = 0) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - offset);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(end.getDate() - (days - 1));
    return { start, end };
  };

  const filterByRange = (items, days, dateKey, offset = 0) => {
    if (!days) return items;
    const { start, end } = getDateRange(days, offset);
    return items.filter((item) => {
      const value = item?.[dateKey];
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return date >= start && date <= end;
    });
  };

  const rangedExpenses = useMemo(
    () => filterByRange(expenses, rangeDays, "expense_date"),
    [expenses, rangeDays]
  );
  const rangedSales = useMemo(
    () => filterByRange(sales, rangeDays, "sale_date"),
    [sales, rangeDays]
  );
  const prevExpenses = useMemo(
    () => filterByRange(expenses, rangeDays, "expense_date", rangeDays),
    [expenses, rangeDays]
  );
  const prevSales = useMemo(
    () => filterByRange(sales, rangeDays, "sale_date", rangeDays),
    [sales, rangeDays]
  );

  const incomeTotal = rangedSales.reduce((sum, sale) => sum + getSalesTotal(sale), 0);
  const costTotal = rangedExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const profitTotal = incomeTotal - costTotal;

  const prevIncomeTotal = prevSales.reduce((sum, sale) => sum + getSalesTotal(sale), 0);
  const prevCostTotal = prevExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  const prevProfitTotal = prevIncomeTotal - prevCostTotal;

  const percentChange = (current, previous) => {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
  };

  const incomeDelta = percentChange(incomeTotal, prevIncomeTotal);
  const costDelta = percentChange(costTotal, prevCostTotal);
  const profitDelta = percentChange(profitTotal, prevProfitTotal);

  const monthKeys = (count) => {
    const items = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      items.push({
        key,
        label: date.toLocaleDateString("en-KE", { month: "short" }),
      });
    }
    return items;
  };

  const recentMonths = useMemo(() => monthKeys(3), []);
  const trendMonths = useMemo(() => monthKeys(6), []);

  const sumByMonth = (items, dateKey, accessor) => {
    const map = new Map();
    items.forEach((item) => {
      const raw = item?.[dateKey];
      if (!raw) return;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + accessor(item));
    });
    return map;
  };

  const incomeByMonth = useMemo(
    () => sumByMonth(rangedSales, "sale_date", getSalesTotal),
    [rangedSales]
  );
  const costByMonth = useMemo(
    () => sumByMonth(rangedExpenses, "expense_date", (item) => toNumber(item.amount)),
    [rangedExpenses]
  );
  const profitByMonth = useMemo(() => {
    const map = new Map();
    trendMonths.forEach((month) => {
      const income = incomeByMonth.get(month.key) || 0;
      const cost = costByMonth.get(month.key) || 0;
      map.set(month.key, income - cost);
    });
    return map;
  }, [trendMonths, incomeByMonth, costByMonth]);

  const barMax = Math.max(
    1,
    ...recentMonths.map((month) => incomeByMonth.get(month.key) || 0),
    ...recentMonths.map((month) => costByMonth.get(month.key) || 0)
  );

  const trendSeries = trendMonths.map((month) => profitByMonth.get(month.key) || 0);
  const trendMin = Math.min(0, ...trendSeries);
  const trendMax = Math.max(0, ...trendSeries);
  const trendRange = trendMax - trendMin || 1;

  const buildSeriesPoints = (series, width, height, padding = 12) => {
    if (!series.length) return [];
    if (series.length === 1) {
      const x = width / 2;
      const ratio = (series[0] - trendMin) / trendRange;
      const y = height - padding - ratio * (height - padding * 2);
      return [{ x, y }];
    }
    return series.map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (series.length - 1);
      const ratio = (value - trendMin) / trendRange;
      const y = height - padding - ratio * (height - padding * 2);
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

  const chartWidth = 320;
  const chartHeight = 140;
  const trendPoints = buildSeriesPoints(trendSeries, chartWidth, chartHeight);
  const trendLinePath = buildSmoothPath(trendPoints);
  const lastTrendPoint = trendPoints.length ? trendPoints[trendPoints.length - 1] : null;

  const activityItems = useMemo(() => {
    const items = [
      ...rangedSales.map((sale) => ({
        id: `sale-${sale.id}`,
        type: "income",
        label: `Sale: ${formatLabel(sale.product_type || "Income")}`,
        date: sale.sale_date,
        amount: getSalesTotal(sale),
      })),
      ...rangedExpenses.map((expense) => ({
        id: `expense-${expense.id}`,
        type: "cost",
        label: expense.category || "Expense",
        date: expense.expense_date,
        amount: toNumber(expense.amount),
      })),
    ];
    return items
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 3);
  }, [rangedSales, rangedExpenses]);

  const contributionItems = useMemo(() => {
    const incomeByProject = new Map();
    rangedSales.forEach((sale) => {
      const key = sale.project_id || "unknown";
      incomeByProject.set(key, (incomeByProject.get(key) || 0) + getSalesTotal(sale));
    });
    const total = Array.from(incomeByProject.values()).reduce((sum, value) => sum + value, 0);
    const colors = ["#f2c94c", "#c08457", "#94a3b8"];
    return filteredProjects
      .map((project, index) => {
        const value = incomeByProject.get(project.id) || 0;
        return {
          id: project.id,
          label: project.code || project.name,
          value,
          percent: total ? (value / total) * 100 : 0,
          color: colors[index % colors.length],
        };
      })
      .filter((item) => item.value > 0);
  }, [filteredProjects, rangedSales]);

  const splitGradient = useMemo(() => {
    if (!contributionItems.length) {
      return "conic-gradient(#e5e7eb 0% 100%)";
    }
    let acc = 0;
    const stops = contributionItems.map((item) => {
      const start = acc;
      const end = acc + item.percent;
      acc = end;
      return `${item.color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [contributionItems]);

  const activeProjectsCount = filteredProjects.filter(
    (project) => String(project.status || "").toLowerCase() !== "completed"
  ).length;

  return (
    <div className="reports-page dashboard-mobile-shell">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Reports</h1>
        </div>
        <button className="reports-header-btn" type="button" aria-label="Add report">
          <Icon name="plus" size={20} />
        </button>
      </div>

      <div className="reports-range-tabs">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`reports-range-tab${rangeDays === option.days ? " is-active" : ""}`}
            onClick={() => setRangeDays(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="reports-filter-tabs">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`reports-filter-tab${filterKey === option.key ? " is-active" : ""}`}
            onClick={() => setFilterKey(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading reports...</p>
        </div>
      ) : (
        <>
          <div className="reports-summary-grid">
            <div className="report-summary-card tone-emerald">
              <div className="report-summary-icon">
                <Icon name="wallet" size={20} />
              </div>
              <div>
                <span>Total Income</span>
                <strong>{formatMoney(incomeTotal)}</strong>
                <em className={incomeDelta >= 0 ? "is-positive" : "is-negative"}>
                  {incomeDelta >= 0 ? "+" : "-"} {Math.abs(incomeDelta).toFixed(0)}%
                </em>
              </div>
            </div>
            <div className="report-summary-card tone-rose">
              <div className="report-summary-icon">
                <Icon name="receipt" size={20} />
              </div>
              <div>
                <span>Total Costs</span>
                <strong>{formatMoney(costTotal)}</strong>
                <em className={costDelta >= 0 ? "is-negative" : "is-positive"}>
                  {costDelta >= 0 ? "+" : "-"} {Math.abs(costDelta).toFixed(0)}%
                </em>
              </div>
            </div>
            <div className="report-summary-card tone-green">
              <div className="report-summary-icon">
                <Icon name="trending-up" size={20} />
              </div>
              <div>
                <span>Net Profit</span>
                <strong>{formatMoney(profitTotal)}</strong>
                <em className={profitDelta >= 0 ? "is-positive" : "is-negative"}>
                  {profitDelta >= 0 ? "+" : "-"} {Math.abs(profitDelta).toFixed(0)}%
                </em>
              </div>
            </div>
            <div className="report-summary-card tone-slate">
              <div className="report-summary-icon">
                <Icon name="folder" size={20} />
              </div>
              <div>
                <span>Active Projects</span>
                <strong>{activeProjectsCount}</strong>
                <em>Running now</em>
              </div>
            </div>
          </div>

          <div className="reports-card">
            <div className="reports-card-header">
              <h3>Income vs Costs</h3>
              <span className="reports-card-sub">
                {filterKey === "all" ? "ALL" : activeFilterLabel}
              </span>
            </div>
            <div className="report-bar-chart">
              {recentMonths.map((month) => {
                const income = incomeByMonth.get(month.key) || 0;
                const cost = costByMonth.get(month.key) || 0;
                return (
                  <div className="report-bar-group" key={month.key}>
                    <div
                      className="report-bar income"
                      style={{ height: `${(income / barMax) * 100}%` }}
                    ></div>
                    <div
                      className="report-bar cost"
                      style={{ height: `${(cost / barMax) * 100}%` }}
                    ></div>
                    <span className="report-bar-label">{month.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="report-bar-legend">
              <span className="legend income">Income</span>
              <span className="legend cost">Costs</span>
              <span className="legend month">Month</span>
            </div>
          </div>

          <div className="reports-card">
            <div className="reports-card-header">
              <h3>Profit Trend</h3>
              <span className="reports-card-sub">Last 6 months</span>
            </div>
            <div className="report-line-chart">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="profitFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7ac27a" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#7ac27a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={trendLinePath} stroke="#2f5b34" strokeWidth="2.5" fill="none" />
                {lastTrendPoint && (
                  <circle
                    cx={lastTrendPoint.x}
                    cy={lastTrendPoint.y}
                    r="4"
                    fill="#2f5b34"
                    stroke="#ecfdf3"
                    strokeWidth="2"
                  />
                )}
                <path d={`${trendLinePath} L ${chartWidth - 12} ${chartHeight - 12} L 12 ${chartHeight - 12} Z`} fill="url(#profitFill)" opacity="0.6" />
              </svg>
              <div className="report-line-axis">
                {trendMonths.map((month) => (
                  <span key={month.key}>{month.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="reports-section-header">
            <h3>Recent Activity</h3>
            <button type="button" className="reports-link">
              View all
            </button>
          </div>
          <div className="reports-card reports-activity-card">
            {activityItems.length === 0 ? (
              <p className="reports-empty">No activity in this range yet.</p>
            ) : (
              activityItems.map((item) => (
                <div className="report-activity-item" key={item.id}>
                  <div className={`report-activity-icon ${item.type}`}>
                    <Icon name={item.type === "income" ? "trending-up" : "receipt"} size={16} />
                  </div>
                  <span className="report-activity-title">{item.label}</span>
                  <span className={`report-activity-amount ${item.type}`}>
                    {item.type === "income" ? "+" : "-"} {formatMoney(item.amount)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="reports-section-header">
            <h3>Contribution Split</h3>
          </div>
          <div className="reports-card reports-split-card">
            <div className="report-split-chart" style={{ background: splitGradient }}></div>
            <div className="report-split-list">
              {contributionItems.length === 0 ? (
                <span className="reports-empty">No income data yet.</span>
              ) : (
                contributionItems.map((item) => (
                  <div className="report-split-item" key={item.id}>
                    <span className="report-split-dot" style={{ background: item.color }}></span>
                    <span>
                      {item.label} {formatMoney(item.value)} / {item.percent.toFixed(0)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <DashboardMobileNav activePage="reports" access={access} setActivePage={setActivePage} />
    </div>
  );
}
