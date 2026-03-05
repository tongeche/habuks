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
  page: "#f5f6f4",
  panel: "#ffffff",
  line: "#d5d8d4",
  header: "#6d7a6a",
  headerAlt: "#859481",
  ink: "#1f2b2d",
  muted: "#5b6874",
  accent: "#2f8f6d",
  info: "#3a78a6",
  tableHead: "#f0eee7",
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
  if (contactParts.length) {
    lines.push(contactParts.join(" | "));
  }
  if (website) lines.push(`Website: ${website}`);
  return lines;
};

const getReportReference = ({ tenantBrand, context }) => {
  const slug = trimText(tenantBrand?.slug || tenantBrand?.name).toUpperCase().replace(/[^A-Z0-9]+/g, "") || "TENANT";
  const projectKey =
    trimText(context?.projectName).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "PROJECT";
  const date = new Date(context?.now || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
  return `AR-${slug}-${projectKey}-${date}`;
};

const getTaskStatusLabel = (value) => {
  const normalized = trimText(value).toLowerCase();
  if (normalized === "done") return "Completed";
  if (normalized === "in_progress") return "In progress";
  if (normalized === "open") return "Open";
  if (normalized === "cancelled") return "Cancelled";
  return toReadableLabel(value, "Open");
};

const drawHeaderLogo = (context, tenantBrand, logoImage) => {
  const x = 78;
  const y = 82;
  const size = 78;
  drawRoundedRect(context, x, y, size, size, 14, {
    fill: "rgba(255,255,255,0.14)",
    stroke: "rgba(255,255,255,0.32)",
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
    text: getReportInitials(tenantBrand?.name || "Habuks"),
    x,
    y: y + 20,
    maxWidth: size,
    size: 30,
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
  context.arc(REPORT_PAGE.width - 138, 126, 86, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fill();
  context.beginPath();
  context.arc(REPORT_PAGE.width - 206, 126, 56, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fill();
  context.beginPath();
  context.arc(REPORT_PAGE.width - 104, 100, 24, 0, Math.PI * 2);
  context.fillStyle = COLORS.headerAlt;
  context.fill();

  drawHeaderLogo(context, tenantBrand, logoImage);
  drawTextBlock(context, {
    text: tenantBrand?.name || "Habuks Workspace",
    x: 176,
    y: 84,
    maxWidth: 650,
    size: 26,
    weight: 700,
    color: "#ffffff",
    maxLines: 1,
  });
  drawTextBlock(context, {
    text: trimText(tenantBrand?.tagline) || "Community operations workspace",
    x: 176,
    y: 116,
    maxWidth: 640,
    size: 15,
    weight: 500,
    color: "#e3e9e5",
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
    color: "#edf2ef",
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
    color: "#edf2ef",
    align: "right",
    maxLines: 1,
  });
};

const drawKeyValueTable = (context, options = {}) => {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 600;
  const rowHeight = Number(options.rowHeight) || 48;
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
      y: rowY + 14,
      maxWidth: keyWidth - 24,
      size: 14,
      weight: 700,
      color: COLORS.muted,
      maxLines: 2,
      lineHeight: 17,
    });
    drawTextBlock(context, {
      text: trimText(row?.value) || "N/A",
      x: x + keyWidth + 14,
      y: rowY + 14,
      maxWidth: width - keyWidth - 24,
      size: 14,
      weight: 500,
      color: COLORS.ink,
      maxLines: 2,
      lineHeight: 17,
    });
  });

  return y + height;
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

const drawDataTable = (context, options = {}) => {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 600;
  const headerHeight = Number(options.headerHeight) || 38;
  const rowHeight = Number(options.rowHeight) || 56;
  const headers = Array.isArray(options.headers) ? options.headers : [];
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const ratios = Array.isArray(options.columnRatios) && options.columnRatios.length === headers.length
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
        text: shorten(row?.[col], 76) || "N/A",
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
    maxWidth: 420,
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
      maxWidth: 470,
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

const buildCriteriaRows = (context) => {
  const progress = formatPercent(context?.progressPercent);
  const completion = formatPercent(context?.taskCompletionPercent);
  const proof = formatPercent(context?.expenseProofPercent);
  return [
    `Delivery progress: ${progress} overall execution against the planned project scope.`,
    `Task completion quality: ${completion} of tracked activities are recorded as done.`,
    `Documentation quality: ${proof} of expenses include proof or payment references.`,
  ];
};

const buildActivityDetailRows = (context) => {
  const tasks = Array.isArray(context?.recentTasks) ? context.recentTasks : [];
  if (!tasks.length) {
    return [["No task activities captured yet", "N/A", "Pending", "No record", "Add tasks in the Tasks tab"]];
  }

  return tasks.slice(0, 5).map((task) => {
    const status = trimText(task?.status).toLowerCase();
    const dueDate = formatDate(task?.due_date);
    const isOverdue =
      Number.isFinite(Date.parse(String(task?.due_date || ""))) &&
      Date.parse(String(task?.due_date || "")) < Date.now() &&
      status !== "done" &&
      status !== "cancelled";
    const issue = isOverdue ? "Overdue" : status === "in_progress" ? "On track" : status === "open" ? "Not started" : "Closed";
    return [
      task?.title || "Untitled activity",
      dueDate,
      getTaskStatusLabel(task?.status),
      issue,
      shorten(task?.description || task?.details || "No additional notes.", 70),
    ];
  });
};

const buildIssueRows = (context) => {
  const rows = [];
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
  const expenses = Array.isArray(context?.expenses) ? context.expenses : [];
  const todayMs = Date.now();

  tasks.forEach((task) => {
    if (rows.length >= 4) return;
    const status = trimText(task?.status).toLowerCase();
    const dueMs = Date.parse(String(task?.due_date || ""));
    if (!Number.isFinite(dueMs) || dueMs >= todayMs || status === "done" || status === "cancelled") return;
    rows.push([
      `Task overdue: ${task?.title || "Untitled task"}`,
      "Project operations",
      trimText(task?.assignee_name) || "Project lead",
      "Replan timeline and assign immediate follow-up.",
      formatDate(task?.due_date),
    ]);
  });

  expenses.forEach((expense) => {
    if (rows.length >= 4) return;
    const hasProof = Boolean(expense?.receipt_url || expense?.proof_url || expense?.proof_path || expense?.receipt_path);
    if (hasProof) return;
    rows.push([
      `Missing proof for ${trimText(expense?.category) || "expense entry"}`,
      "Finance records",
      "Finance focal person",
      "Attach receipt or payment reference.",
      "Immediate",
    ]);
  });

  if (!rows.length) {
    rows.push([
      "No major non-compliance issues identified in this reporting period.",
      "Project",
      "Project team",
      "Continue routine monitoring and documentation.",
      "N/A",
    ]);
  }

  return rows;
};

const buildCorrectiveActionRows = (context) => {
  const tasks = Array.isArray(context?.tasks) ? context.tasks : [];
  const openRows = tasks
    .filter((task) => {
      const status = trimText(task?.status).toLowerCase();
      return status === "open" || status === "in_progress";
    })
    .slice(0, 5);

  if (!openRows.length) {
    return [["No pending corrective actions", "Project team", "N/A", "Closed", "Continue periodic reviews."]];
  }

  return openRows.map((task) => [
    shorten(task?.title || "Follow-up action", 48),
    trimText(task?.assignee_name) || "Unassigned",
    formatDate(task?.due_date),
    getTaskStatusLabel(task?.status),
    shorten(task?.description || task?.details || "Track to completion.", 58),
  ]);
};

const buildFinalResultRows = (context) => {
  const taskCount = Math.max(0, Number(context?.taskCount) || 0);
  const doneCount = Math.max(0, Number(context?.taskTotals?.done) || 0);
  const openCount = Math.max(0, Number(context?.taskTotals?.open) || 0);
  const inProgressCount = Math.max(0, Number(context?.taskTotals?.in_progress) || 0);
  const overdue = Math.max(0, Number(context?.overdueTaskCount) || 0);
  const proofCoverage = formatPercent(context?.expenseProofPercent);
  const rating =
    overdue === 0 && doneCount >= Math.max(1, Math.round(taskCount * 0.6))
      ? "Satisfactory"
      : doneCount >= Math.max(1, Math.round(taskCount * 0.35))
        ? "Needs improvement"
        : "Critical follow-up required";

  return [
    `Total activities tracked: ${taskCount}`,
    `Completed activities: ${doneCount}`,
    `Open activities: ${openCount} · In progress: ${inProgressCount}`,
    `Overdue activities: ${overdue}`,
    `Expense documentation coverage: ${proofCoverage}`,
    `Overall activity rating: ${rating}`,
  ];
};

const buildConclusionText = (context, currencyCode) => {
  return [
    `${context?.projectName || "This project"} is currently at ${formatPercent(
      context?.progressPercent
    )} overall progress, with ${Math.max(0, Number(context?.taskTotals?.done) || 0)} activities completed out of ${Math.max(
      0,
      Number(context?.taskCount) || 0
    )}.`,
    `Financial execution shows ${formatMoney(context?.spentAmount, currencyCode)} spent against a budget of ${formatMoney(
      context?.budgetAmount,
      currencyCode
    )}, leaving ${formatMoney(context?.remainingAmount, currencyCode)} available.`,
    `Immediate follow-up is required for overdue and open activities to sustain delivery momentum and maintain compliance quality.`,
  ].join(" ");
};

const renderFirstPage = ({
  tenantBrand,
  user,
  context,
  logoImage,
  reportReference,
  generatedAt,
  generatedAtDate,
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
    reportTitle: "Project Activity Report",
    reportSubtitle: "Implementation quality, activity details, compliance issues, and corrective actions.",
    reportReference,
    generatedAt,
  });

  const metadataRows = [
    { label: "Project title", value: context?.projectName || "Project" },
    { label: "Project number", value: reportReference },
    {
      label: "Report period",
      value: `${context?.startDateLabel || "N/A"} to ${formatDate(context?.now || generatedAtDate)}`,
    },
    { label: "Project location", value: trimText(tenantBrand?.location) || "N/A" },
    { label: "Prepared by", value: getUserLabel(user) },
    { label: "Inspection date", value: formatDate(context?.now || generatedAtDate) },
  ];
  let cursorY = drawKeyValueTable(canvasContext, {
    x: 56,
    y: 252,
    width: REPORT_PAGE.width - 112,
    rowHeight: 46,
    keyWidth: 292,
    rows: metadataRows,
  });

  cursorY += 34;
  drawTextBlock(canvasContext, {
    text: "Inspection Criteria",
    x: 56,
    y: cursorY,
    maxWidth: 420,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 42;
  cursorY = drawBullets(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    rows: buildCriteriaRows(context),
    bulletColor: COLORS.accent,
  });

  cursorY += 24;
  drawTextBlock(canvasContext, {
    text: "Inspection Details",
    x: 56,
    y: cursorY,
    maxWidth: 440,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 44;
  cursorY = drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Component", "Schedule", "Compliance Check", "Defects Identified", "Comments / Findings"],
    columnRatios: [1.2, 1.0, 1.0, 1.0, 1.5],
    rowHeight: 54,
    rows: buildActivityDetailRows(context),
  });

  cursorY += 22;
  drawTextBlock(canvasContext, {
    text: "Non-Compliance Issues",
    x: 56,
    y: cursorY,
    maxWidth: 520,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 42;
  drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Issue Description", "Location", "Responsible Party", "Corrective Action Required", "Due Date"],
    columnRatios: [1.45, 0.8, 0.95, 1.35, 0.7],
    rowHeight: 52,
    rows: buildIssueRows(context),
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
    reportTitle: "Project Activity Report",
    reportSubtitle: "Continuation: corrective actions, final results, and conclusion.",
    reportReference,
    generatedAt,
  });

  let cursorY = 270;
  drawTextBlock(canvasContext, {
    text: "Corrective Actions",
    x: 56,
    y: cursorY,
    maxWidth: 420,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 44;
  cursorY = drawDataTable(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    headers: ["Action Item", "Assigned To", "Target Completion", "Status", "Comments"],
    columnRatios: [1.5, 0.95, 0.9, 0.75, 1.3],
    rowHeight: 54,
    rows: buildCorrectiveActionRows(context),
  });

  cursorY += 30;
  drawTextBlock(canvasContext, {
    text: "Final Inspection Results",
    x: 56,
    y: cursorY,
    maxWidth: 520,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 44;
  cursorY = drawBullets(canvasContext, {
    x: 56,
    y: cursorY,
    width: REPORT_PAGE.width - 112,
    rows: buildFinalResultRows(context),
    bulletColor: COLORS.info,
  });

  cursorY += 16;
  drawTextBlock(canvasContext, {
    text: "Conclusion",
    x: 56,
    y: cursorY,
    maxWidth: 280,
    size: 30,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  cursorY += 44;
  const conclusionBlock = drawTextBlock(canvasContext, {
    text: buildConclusionText(context, currencyCode),
    x: 56,
    y: cursorY,
    maxWidth: REPORT_PAGE.width - 112,
    size: 15,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 22,
    maxLines: 6,
  });

  cursorY += conclusionBlock.height + 46;
  drawTextBlock(canvasContext, {
    text: "Inspector Signature",
    x: 56,
    y: cursorY,
    maxWidth: 280,
    size: 13,
    weight: 700,
    color: COLORS.footer,
    maxLines: 1,
  });
  cursorY += 26;
  drawTextBlock(canvasContext, {
    text: getUserLabel(user),
    x: 56,
    y: cursorY,
    maxWidth: 300,
    size: 44,
    weight: 500,
    color: COLORS.ink,
    family: '"Brush Script MT", "Lucida Handwriting", cursive',
    maxLines: 1,
  });
  drawDivider(canvasContext, 56, cursorY + 54, 240, {
    color: COLORS.line,
    lineWidth: 1,
  });

  drawTextBlock(canvasContext, {
    text: formatDate(context?.now || new Date()),
    x: 56,
    y: cursorY + 66,
    maxWidth: 240,
    size: 13,
    weight: 500,
    color: COLORS.footer,
    maxLines: 1,
  });

  drawRoundedRect(canvasContext, 620, cursorY - 20, 564, 162, 12, {
    fill: "#f8faf8",
    stroke: COLORS.line,
    lineWidth: 1,
  });
  drawTextBlock(canvasContext, {
    text: "Financial Snapshot",
    x: 646,
    y: cursorY,
    maxWidth: 250,
    size: 20,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Budget: ${formatMoney(context?.budgetAmount, currencyCode)}`,
    x: 646,
    y: cursorY + 38,
    maxWidth: 520,
    size: 14,
    weight: 600,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Spent: ${formatMoney(context?.spentAmount, currencyCode)}`,
    x: 646,
    y: cursorY + 62,
    maxWidth: 520,
    size: 14,
    weight: 600,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Balance: ${formatMoney(context?.remainingAmount, currencyCode)}`,
    x: 646,
    y: cursorY + 86,
    maxWidth: 520,
    size: 14,
    weight: 600,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Evidence coverage: ${formatPercent(context?.expenseProofPercent)}`,
    x: 646,
    y: cursorY + 110,
    maxWidth: 520,
    size: 14,
    weight: 600,
    color: COLORS.ink,
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

export async function buildActivityReportFile(options = {}) {
  const fileName = String(options.fileName || "activity-report.pdf");
  const tenantBrand = options.tenantBrand || {};
  const user = options.user || {};
  const context = options.context;
  const currencyCode = normalizeCurrencyCode(options.currencyCode);

  if (!context) {
    throw new Error("Activity report data is missing.");
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
      reportReference,
      generatedAt,
      generatedAtDate,
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
