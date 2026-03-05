import { buildPdfFileFromCanvasPages } from "./pdfImageDocument.js";
import { formatCurrencyAmount, normalizeCurrencyCode } from "../currency.js";
import {
  REPORT_PAGE,
  createReportCanvasPage,
  drawDivider,
  drawRoundedRect,
  drawTextBlock,
  getReportInitials,
  loadReportImage,
  releaseReportImage,
} from "./reportCanvas.js";

const COLORS = {
  page: "#f6f8f8",
  panel: "#ffffff",
  line: "#d4dbe0",
  header: "#3f5259",
  headerAlt: "#5b727a",
  ink: "#1d2a30",
  muted: "#5b6c78",
  accent: "#1f7a8c",
  accentSoft: "#e7f7f4",
  success: "#15803d",
  warning: "#b45309",
  tableHead: "#eef2f4",
  footer: "#4b5563",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const trimText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const shorten = (value, maxLength = 90) => {
  const text = trimText(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (value, fallback = "N/A") => {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return fallback;
  return DATE_FORMATTER.format(new Date(parsed));
};

const formatDateTime = (value, fallback = "N/A") => {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return fallback;
  return DATETIME_FORMATTER.format(new Date(parsed));
};

const formatPercent = (value) => {
  const parsed = toNumber(value);
  if (parsed === null) return "N/A";
  const safe = Math.max(0, Math.min(100, parsed));
  return `${Math.round(safe)}%`;
};

const formatMoney = (value, currencyCode) => {
  const parsed = toNumber(value);
  if (parsed === null) return "N/A";
  return formatCurrencyAmount(parsed, {
    currencyCode,
    maximumFractionDigits: 0,
  });
};

const toReadableLabel = (value, fallback = "Unknown") => {
  const text = trimText(value);
  if (!text) return fallback;
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
};

const getUserLabel = (user) => {
  const name = trimText(user?.name);
  if (name) return name;
  const email = trimText(user?.email);
  return email || "Workspace user";
};

const hasExpenseProof = (expense) =>
  Boolean(expense?.receipt_url || expense?.proof_url || expense?.proof_path || expense?.receipt_path);

const resolveTenantContacts = (tenantBrand = {}, user = {}) => {
  const contactBlock = tenantBrand?.contact && typeof tenantBrand.contact === "object" ? tenantBrand.contact : {};
  const profileBlock =
    tenantBrand?.organization_profile && typeof tenantBrand.organization_profile === "object"
      ? tenantBrand.organization_profile
      : {};

  const location =
    trimText(tenantBrand?.location) ||
    trimText(tenantBrand?.address) ||
    trimText(contactBlock?.location) ||
    trimText(contactBlock?.address);
  const email =
    trimText(tenantBrand?.contactEmail) ||
    trimText(tenantBrand?.email) ||
    trimText(contactBlock?.email) ||
    trimText(user?.email);
  const phone =
    trimText(tenantBrand?.contactPhone) ||
    trimText(tenantBrand?.phone) ||
    trimText(contactBlock?.phone);
  const website =
    trimText(tenantBrand?.website) ||
    trimText(profileBlock?.website) ||
    trimText(contactBlock?.website);

  const lines = [];
  if (location) lines.push(location);
  const contactParts = [];
  if (phone) contactParts.push(`Phone: ${phone}`);
  if (email) contactParts.push(`Email: ${email}`);
  if (contactParts.length) lines.push(contactParts.join(" | "));
  if (website) lines.push(`Website: ${website}`);
  return lines;
};

const getReportReference = ({ tenantBrand, context }) => {
  const slug =
    trimText(tenantBrand?.slug || tenantBrand?.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "") || "TENANT";
  const projectKey =
    trimText(context?.projectName)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8) || "PROJECT";
  const date = new Date(context?.now || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
  return `PP-${slug}-${projectKey}-${date}`;
};

const drawHeaderLogo = (context, tenantBrand, logoImage) => {
  const x = 78;
  const y = 82;
  const size = 74;
  drawRoundedRect(context, x, y, size, size, 14, {
    fill: "rgba(255,255,255,0.14)",
    stroke: "rgba(255,255,255,0.26)",
    lineWidth: 1.2,
  });

  if (logoImage) {
    const ratio = Math.min((size * 0.68) / logoImage.width, (size * 0.68) / logoImage.height);
    const drawWidth = logoImage.width * ratio;
    const drawHeight = logoImage.height * ratio;
    context.drawImage(
      logoImage,
      x + (size - drawWidth) / 2,
      y + (size - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    return;
  }

  drawTextBlock(context, {
    text: getReportInitials(tenantBrand?.name || "HB"),
    x,
    y: y + 19,
    maxWidth: size,
    size: 28,
    weight: 700,
    color: "#ffffff",
    align: "center",
    maxLines: 1,
  });
};

const drawHeader = ({
  context,
  tenantBrand,
  logoImage,
  reportTitle,
  reportSubtitle,
  reportReference,
  generatedAt,
}) => {
  drawRoundedRect(context, 56, 56, REPORT_PAGE.width - 112, 170, 0, {
    fill: COLORS.header,
  });
  context.beginPath();
  context.arc(REPORT_PAGE.width - 136, 126, 86, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,0.11)";
  context.fill();
  context.beginPath();
  context.arc(REPORT_PAGE.width - 202, 124, 58, 0, Math.PI * 2);
  context.fillStyle = COLORS.headerAlt;
  context.fill();

  drawHeaderLogo(context, tenantBrand, logoImage);
  drawTextBlock(context, {
    text: tenantBrand?.name || "Habuks Workspace",
    x: 172,
    y: 84,
    maxWidth: 640,
    size: 26,
    weight: 700,
    color: "#ffffff",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: trimText(tenantBrand?.tagline) || "Community operations workspace",
    x: 172,
    y: 116,
    maxWidth: 640,
    size: 15,
    weight: 500,
    color: "#d8e5e8",
    maxLines: 2,
    lineHeight: 20,
  });
  drawTextBlock(context, {
    text: reportTitle,
    x: 78,
    y: 154,
    maxWidth: 760,
    size: 34,
    weight: 700,
    color: "#ffffff",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: reportSubtitle,
    x: 78,
    y: 190,
    maxWidth: 760,
    size: 14,
    weight: 500,
    color: "#e5eef0",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: reportReference,
    x: 786,
    y: 156,
    maxWidth: 360,
    size: 13,
    weight: 700,
    color: "#ffffff",
    align: "right",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: `Generated ${generatedAt}`,
    x: 786,
    y: 178,
    maxWidth: 360,
    size: 12,
    weight: 500,
    color: "#e5eef0",
    align: "right",
    maxLines: 1,
  });
};

const drawSectionTitle = (context, text, y) => {
  drawTextBlock(context, {
    text,
    x: 56,
    y,
    maxWidth: 720,
    size: 28,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
};

const drawBullets = (context, options = {}) => {
  const x = Number(options.x) || 0;
  let y = Number(options.y) || 0;
  const width = Number(options.width) || 400;
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const bulletColor = options.bulletColor || COLORS.accent;

  rows.forEach((row) => {
    context.beginPath();
    context.arc(x + 6, y + 8, 3, 0, Math.PI * 2);
    context.fillStyle = bulletColor;
    context.fill();
    const block = drawTextBlock(context, {
      text: row,
      x: x + 18,
      y,
      maxWidth: width - 18,
      size: 14,
      weight: 500,
      color: COLORS.ink,
      lineHeight: 20,
      maxLines: 3,
    });
    y += block.height + 8;
  });

  return y;
};

const drawKeyValueTable = (context, options = {}) => {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 600;
  const rowHeight = Number(options.rowHeight) || 44;
  const keyWidth = Number(options.keyWidth) || Math.round(width * 0.3);
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const height = Math.max(rowHeight, rows.length * rowHeight);

  drawRoundedRect(context, x, y, width, height, 8, {
    fill: COLORS.panel,
    stroke: COLORS.line,
    lineWidth: 1,
  });

  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      drawDivider(context, x, rowY, width, { color: COLORS.line, lineWidth: 1 });
    }
    context.beginPath();
    context.moveTo(x + keyWidth, rowY);
    context.lineTo(x + keyWidth, rowY + rowHeight);
    context.strokeStyle = COLORS.line;
    context.lineWidth = 1;
    context.stroke();

    drawTextBlock(context, {
      text: trimText(row?.label),
      x: x + 14,
      y: rowY + 12,
      maxWidth: keyWidth - 24,
      size: 13,
      weight: 700,
      color: COLORS.muted,
      maxLines: 2,
      lineHeight: 16,
    });
    drawTextBlock(context, {
      text: trimText(row?.value) || "N/A",
      x: x + keyWidth + 14,
      y: rowY + 12,
      maxWidth: width - keyWidth - 24,
      size: 13,
      weight: 500,
      color: COLORS.ink,
      maxLines: 2,
      lineHeight: 16,
    });
  });

  return y + height;
};

const drawDataTable = (context, options = {}) => {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 600;
  const headerHeight = Number(options.headerHeight) || 38;
  const rowHeight = Number(options.rowHeight) || 52;
  const headers = Array.isArray(options.headers) ? options.headers : [];
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const ratios =
    Array.isArray(options.columnRatios) && options.columnRatios.length === headers.length
      ? options.columnRatios
      : headers.map(() => 1);
  const ratioTotal = ratios.reduce((sum, value) => sum + Math.max(0.1, Number(value) || 1), 0);
  const colWidths = ratios.map((ratio) => (width * Math.max(0.1, Number(ratio) || 1)) / ratioTotal);
  const height = headerHeight + rows.length * rowHeight;

  drawRoundedRect(context, x, y, width, height, 10, {
    fill: COLORS.panel,
    stroke: COLORS.line,
    lineWidth: 1,
  });
  drawRoundedRect(context, x, y, width, headerHeight, 10, {
    fill: COLORS.tableHead,
  });

  let cursorX = x;
  for (let col = 0; col < headers.length; col += 1) {
    const colWidth = colWidths[col];
    if (col > 0) {
      context.beginPath();
      context.moveTo(cursorX, y);
      context.lineTo(cursorX, y + height);
      context.strokeStyle = COLORS.line;
      context.lineWidth = 1;
      context.stroke();
    }
    drawTextBlock(context, {
      text: String(headers[col] || "").toUpperCase(),
      x: cursorX + 10,
      y: y + 10,
      maxWidth: colWidth - 20,
      size: 12,
      weight: 700,
      color: COLORS.muted,
      maxLines: 2,
      lineHeight: 14,
    });
    cursorX += colWidth;
  }

  rows.forEach((row, index) => {
    const rowY = y + headerHeight + index * rowHeight;
    if (index > 0) {
      drawDivider(context, x, rowY, width, {
        color: COLORS.line,
        lineWidth: 1,
      });
    }
    let cellX = x;
    for (let col = 0; col < headers.length; col += 1) {
      const colWidth = colWidths[col];
      drawTextBlock(context, {
        text: shorten(row?.[col], 74) || "N/A",
        x: cellX + 10,
        y: rowY + 10,
        maxWidth: colWidth - 20,
        size: 13,
        weight: 500,
        color: COLORS.ink,
        maxLines: 3,
        lineHeight: 16,
      });
      cellX += colWidth;
    }
  });

  return y + height;
};

const drawFooter = (context, options = {}) => {
  const tenantBrand = options.tenantBrand || {};
  const user = options.user || {};
  const generatedAt = options.generatedAt || "N/A";
  const pageNumber = Number(options.pageNumber) || 1;
  const pageCount = Number(options.pageCount) || 1;

  drawDivider(context, 56, 1606, REPORT_PAGE.width - 112, {
    color: COLORS.line,
    lineWidth: 1,
  });

  const contacts = resolveTenantContacts(tenantBrand, user);
  drawTextBlock(context, {
    text: trimText(tenantBrand?.name) || "Habuks Workspace",
    x: 56,
    y: 1624,
    maxWidth: 430,
    size: 13,
    weight: 700,
    color: COLORS.footer,
    maxLines: 1,
  });

  contacts.slice(0, 3).forEach((line, index) => {
    drawTextBlock(context, {
      text: line,
      x: 56,
      y: 1644 + index * 18,
      maxWidth: 480,
      size: 12,
      weight: 500,
      color: COLORS.footer,
      maxLines: 1,
    });
  });

  drawTextBlock(context, {
    text: `Prepared by ${getUserLabel(user)} · ${generatedAt}`,
    x: 560,
    y: 1638,
    maxWidth: 620,
    size: 12,
    weight: 500,
    color: COLORS.footer,
    align: "right",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: `Page ${pageNumber} of ${pageCount}`,
    x: 920,
    y: 1670,
    maxWidth: 260,
    size: 12,
    weight: 700,
    color: COLORS.footer,
    align: "right",
    maxLines: 1,
  });
};

const buildObjectives = (context, currencyCode) => {
  const activeTasks = Math.max(0, Number(context?.taskTotals?.open || 0) + Number(context?.taskTotals?.in_progress || 0));
  const completionTarget = Math.min(100, Math.max(35, Math.round((toNumber(context?.taskCompletionPercent) || 0) + 15)));
  return [
    `Raise task completion performance from ${formatPercent(
      context?.taskCompletionPercent
    )} to at least ${completionTarget}% within the next reporting cycle.`,
    `Reduce operational backlog by closing ${Math.min(activeTasks, 6)} high-value open activities and clearing overdue items.`,
    `Protect financial controls by maintaining expense evidence coverage above ${formatPercent(
      context?.expenseProofPercent
    )} while scaling delivery.`,
    `Mobilize funding support against the current plan of ${formatMoney(
      context?.revenueAmount,
      currencyCode
    )} and ensure resources reach ${Math.max(0, Number(context?.memberCount) || 0)} members.`,
  ];
};

const buildImplementationRows = (context) => {
  const rows = Array.isArray(context?.recentTasks) ? context.recentTasks : [];
  if (!rows.length) {
    return [["No activity plan captured yet", "Project lead", "N/A", "Open"]];
  }
  return rows.slice(0, 5).map((task) => [
    task?.title || "Untitled activity",
    trimText(task?.assignee_name) || "Unassigned",
    formatDate(task?.due_date),
    toReadableLabel(task?.status, "Open"),
  ]);
};

const buildExpenseRows = (context, currencyCode) => {
  const rows = Array.isArray(context?.recentExpenses) ? context.recentExpenses : [];
  if (!rows.length) {
    return [["N/A", "No expenses recorded", "N/A", "N/A", "Pending"]];
  }
  return rows.slice(0, 5).map((expense) => [
    formatDate(expense?.expense_date || expense?.created_at),
    expense?.category || "Uncategorized",
    expense?.vendor || "N/A",
    formatMoney(expense?.amount, currencyCode),
    hasExpenseProof(expense) ? "Attached" : "Missing",
  ]);
};

const buildRiskRows = (context) => {
  const rows = [];
  const overdueCount = Math.max(0, Number(context?.overdueTaskCount) || 0);
  const highPriorityCount = Math.max(0, Number(context?.highPriorityOpenTaskCount) || 0);
  const totalExpenses = Math.max(0, Number(context?.expenses?.length) || 0);
  const proofPercent = toNumber(context?.expenseProofPercent) || 0;
  const missingProofCount = Math.max(0, Math.round(totalExpenses * (100 - proofPercent) / 100));

  if (overdueCount > 0) {
    rows.push([
      `${overdueCount} overdue activities`,
      "Schedule slippage and delayed outcomes",
      "Weekly review with accountable owners and revised timelines",
    ]);
  }
  if (highPriorityCount > 0) {
    rows.push([
      `${highPriorityCount} high-priority open items`,
      "Execution pressure on core milestones",
      "Prioritize staffing and track in daily action huddles",
    ]);
  }
  if (missingProofCount > 0) {
    rows.push([
      `${missingProofCount} expense records missing proof`,
      "Reduced donor confidence and audit risk",
      "Enforce receipt capture and monthly finance reconciliation",
    ]);
  }
  if (!rows.length) {
    rows.push([
      "No major risks identified in current records",
      "Low operational risk profile",
      "Continue routine monitoring and monthly reporting",
    ]);
  }

  return rows.slice(0, 4);
};

const buildMonitoringRows = (context) => [
  `Weekly: review progress indicators and outstanding action points (${Math.max(
    0,
    Number(context?.taskTotals?.open || 0) + Number(context?.taskTotals?.in_progress || 0)
  )} active tasks).`,
  `Monthly: reconcile spend (${formatMoney(context?.spentAmount, "USD")} equivalent trend) and verify proof coverage (${formatPercent(
    context?.expenseProofPercent
  )}).`,
  `Quarterly: evaluate milestone delivery against proposal objectives and update partner commitments.`,
  `Evidence baseline: ${Math.max(0, Number(context?.documents?.length) || 0)} documents and ${Math.max(
    0,
    Number(context?.notes?.length) || 0
  )} operational notes available.`,
];

const buildFundingConclusion = (context, currencyCode) => {
  const remaining = formatMoney(context?.remainingAmount, currencyCode);
  const totalBudget = formatMoney(context?.budgetAmount, currencyCode);
  const expectedFunding = formatMoney(context?.revenueAmount, currencyCode);
  return `${context?.projectName || "This project"} is requesting continued support to sustain delivery momentum, close remaining execution gaps, and protect accountability standards. Current budget is ${totalBudget}, expected funding target is ${expectedFunding}, and available balance is ${remaining}. Funding will prioritize overdue activities, high-priority tasks, and documentation compliance to keep implementation on track.`;
};

const renderFirstPage = ({ tenantBrand, user, context, logoImage, currencyCode, reportReference, generatedAt }) => {
  const page = createReportCanvasPage({ background: COLORS.page });
  const canvasContext = page.context;

  drawRoundedRect(canvasContext, 32, 32, REPORT_PAGE.width - 64, REPORT_PAGE.height - 64, 22, {
    fill: COLORS.panel,
  });

  drawHeader({
    context: canvasContext,
    tenantBrand,
    logoImage,
    reportTitle: "Project Proposal",
    reportSubtitle: "Funding request, operational priorities, and implementation plan.",
    reportReference,
    generatedAt,
  });

  const metadataRows = [
    { label: "Project title", value: context?.projectName || "Project" },
    { label: "Proposal reference", value: reportReference },
    { label: "Category / module", value: `${context?.category || "General"} · ${context?.moduleKey || "N/A"}` },
    { label: "Status", value: toReadableLabel(context?.status, "Active") },
    { label: "Start date", value: context?.startDateLabel || "N/A" },
    { label: "Prepared date", value: formatDate(context?.now || new Date()) },
  ];

  let cursorY = drawKeyValueTable(canvasContext, {
    x: 56,
    y: 252,
    width: REPORT_PAGE.width - 112,
    rowHeight: 42,
    keyWidth: 286,
    rows: metadataRows,
  });

  cursorY += 28;
  drawSectionTitle(canvasContext, "1. Problem Statement", cursorY);
  cursorY += 40;
  const problemBlock = drawTextBlock(canvasContext, {
    text:
      trimText(context?.summary) ||
      "No project summary has been captured. This proposal highlights funding need for planned activities.",
    x: 56,
    y: cursorY,
    maxWidth: REPORT_PAGE.width - 112,
    size: 15,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 22,
    maxLines: 5,
  });
  cursorY += problemBlock.height + 12;
  cursorY = drawBullets(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    rows: [
      `Current progress: ${formatPercent(context?.progressPercent)}.`,
      `Tasks tracked: ${Math.max(0, Number(context?.taskCount) || 0)} (${Math.max(
        0,
        Number(context?.taskTotals?.done) || 0
      )} completed).`,
      `Members currently engaged: ${Math.max(0, Number(context?.memberCount) || 0)}.`,
    ],
    bulletColor: COLORS.accent,
  });

  cursorY += 16;
  drawSectionTitle(canvasContext, "2. Proposal Objectives", cursorY);
  cursorY += 40;
  cursorY = drawBullets(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    rows: buildObjectives(context, currencyCode),
    bulletColor: COLORS.success,
  });

  cursorY += 12;
  drawSectionTitle(canvasContext, "3. Implementation Approach", cursorY);
  cursorY += 40;
  drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Planned Activity", "Lead", "Target Date", "Status"],
    columnRatios: [1.9, 1.0, 0.9, 0.8],
    rowHeight: 52,
    rows: buildImplementationRows(context),
  });

  drawFooter(canvasContext, {
    tenantBrand,
    user,
    generatedAt,
    pageNumber: 1,
    pageCount: 2,
  });

  return page.canvas;
};

const renderSecondPage = ({
  tenantBrand,
  user,
  context,
  logoImage,
  currencyCode,
  reportReference,
  generatedAt,
}) => {
  const page = createReportCanvasPage({ background: COLORS.page });
  const canvasContext = page.context;

  drawRoundedRect(canvasContext, 32, 32, REPORT_PAGE.width - 64, REPORT_PAGE.height - 64, 22, {
    fill: COLORS.panel,
  });

  drawHeader({
    context: canvasContext,
    tenantBrand,
    logoImage,
    reportTitle: "Project Proposal",
    reportSubtitle: "Financial plan, risks, and monitoring framework.",
    reportReference,
    generatedAt,
  });

  let cursorY = 270;
  drawSectionTitle(canvasContext, "4. Budget & Funding Plan", cursorY);
  cursorY += 42;

  drawRoundedRect(canvasContext, 56, cursorY, REPORT_PAGE.width - 112, 150, 12, {
    fill: COLORS.accentSoft,
    stroke: "#c2ece4",
    lineWidth: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Total Budget: ${formatMoney(context?.budgetAmount, currencyCode)}`,
    x: 80,
    y: cursorY + 22,
    maxWidth: 360,
    size: 18,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Expected Funding: ${formatMoney(context?.revenueAmount, currencyCode)}`,
    x: 80,
    y: cursorY + 56,
    maxWidth: 360,
    size: 15,
    weight: 600,
    color: COLORS.muted,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Spent to Date: ${formatMoney(context?.spentAmount, currencyCode)}`,
    x: 80,
    y: cursorY + 84,
    maxWidth: 360,
    size: 15,
    weight: 600,
    color: COLORS.muted,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Balance: ${formatMoney(context?.remainingAmount, currencyCode)} · Utilization ${formatPercent(
      context?.budgetUtilizationPercent
    )}`,
    x: 80,
    y: cursorY + 112,
    maxWidth: 560,
    size: 15,
    weight: 600,
    color: COLORS.muted,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Expense records: ${Math.max(0, Number(context?.expenses?.length) || 0)} · Proof coverage: ${formatPercent(
      context?.expenseProofPercent
    )}`,
    x: 700,
    y: cursorY + 56,
    maxWidth: 410,
    size: 14,
    weight: 600,
    color: COLORS.muted,
    maxLines: 2,
    lineHeight: 20,
  });

  cursorY += 172;
  drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Date", "Category", "Vendor", "Amount", "Proof"],
    columnRatios: [0.8, 1.2, 1.0, 0.9, 0.7],
    rowHeight: 46,
    rows: buildExpenseRows(context, currencyCode),
  });

  cursorY += 280;
  drawSectionTitle(canvasContext, "5. Risk & Mitigation Matrix", cursorY);
  cursorY += 40;
  drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Key Risk", "Potential Effect", "Mitigation Action"],
    columnRatios: [1.1, 1.25, 1.45],
    rowHeight: 52,
    rows: buildRiskRows(context),
  });

  cursorY += 256;
  drawSectionTitle(canvasContext, "6. Monitoring & Reporting", cursorY);
  cursorY += 40;
  cursorY = drawBullets(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    rows: buildMonitoringRows(context),
    bulletColor: COLORS.warning,
  });

  cursorY += 8;
  drawTextBlock(canvasContext, {
    text: "Conclusion & Funding Ask",
    x: 56,
    y: cursorY,
    maxWidth: 520,
    size: 28,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 40;
  const conclusionBlock = drawTextBlock(canvasContext, {
    text: buildFundingConclusion(context, currencyCode),
    x: 56,
    y: cursorY,
    maxWidth: REPORT_PAGE.width - 112,
    size: 14,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 20,
    maxLines: 6,
  });

  const signatureY = Math.min(1510, cursorY + conclusionBlock.height + 26);
  drawTextBlock(canvasContext, {
    text: "Prepared by",
    x: 56,
    y: signatureY,
    maxWidth: 220,
    size: 13,
    weight: 700,
    color: COLORS.footer,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: getUserLabel(user),
    x: 56,
    y: signatureY + 20,
    maxWidth: 320,
    size: 20,
    weight: 600,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: formatDate(context?.now || new Date()),
    x: 56,
    y: signatureY + 48,
    maxWidth: 220,
    size: 12,
    weight: 500,
    color: COLORS.footer,
    maxLines: 1,
  });

  drawFooter(canvasContext, {
    tenantBrand,
    user,
    generatedAt,
    pageNumber: 2,
    pageCount: 2,
  });

  return page.canvas;
};

export async function buildProjectProposalReportFile(options = {}) {
  const fileName = String(options.fileName || "project-proposal.pdf");
  const tenantBrand = options.tenantBrand || {};
  const user = options.user || {};
  const context = options.context;
  const currencyCode = normalizeCurrencyCode(options.currencyCode);

  if (!context) {
    throw new Error("Project proposal data is missing.");
  }

  const generatedAtDate = context?.now || new Date();
  const generatedAt = formatDateTime(generatedAtDate);
  const reportReference = getReportReference({ tenantBrand, context });

  let logoImage = null;
  try {
    logoImage = await loadReportImage(tenantBrand?.logoUrl);
    const pageOne = renderFirstPage({
      tenantBrand,
      user,
      context,
      logoImage,
      currencyCode,
      reportReference,
      generatedAt,
    });
    const pageTwo = renderSecondPage({
      tenantBrand,
      user,
      context,
      logoImage,
      currencyCode,
      reportReference,
      generatedAt,
    });
    return buildPdfFileFromCanvasPages({
      canvases: [pageOne, pageTwo],
      fileName,
      quality: 0.94,
    });
  } finally {
    if (logoImage) {
      releaseReportImage(logoImage);
    }
  }
}
