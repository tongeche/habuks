import { buildPdfFileFromCanvasPages } from "./pdfImageDocument.js";
import { formatCurrencyAmount, normalizeCurrencyCode } from "../currency.js";
import {
  REPORT_PAGE,
  createReportCanvasPage,
  drawDivider,
  drawDonutChart,
  drawPill,
  drawRoundedRect,
  drawTextBlock,
  getReportInitials,
  loadReportImage,
  releaseReportImage,
} from "./reportCanvas.js";

const COLORS = {
  ink: "#10263f",
  muted: "#5f7289",
  subtle: "#8ea0b4",
  line: "#d7e3ef",
  card: "#f6f9fc",
  cardAlt: "#edf5fb",
  surface: "#f7fafc",
  surfaceAlt: "#f2f6fa",
  accent: "#2396c5",
  accentSoft: "#dff3fb",
  success: "#2fa37e",
  warning: "#f59e0b",
  danger: "#dc6a73",
  teal: "#39b8c3",
  footer: "#64748b",
};

const INNER_CARD_RADIUS = 14;
const INNER_PILL_RADIUS = 10;

const DISCLAIMER_TEXT =
  "Generated from live Habuks workspace records. Confirm approvals and source attachments before sharing externally.";

const TEMPLATE_TEXT = "Powered by Habuks Templates";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clampPercent = (value) => {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed));
};

const formatCurrency = (value, currencyCode) => {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) return "—";
  return formatCurrencyAmount(parsed, {
    currencyCode,
    maximumFractionDigits: 0,
  });
};

const formatPercent = (value) => {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return "—";
  return `${Math.round(clampPercent(parsed))}%`;
};

const formatDate = (value) => {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "N/A";
  return DATE_FORMATTER.format(new Date(parsed));
};

const formatDateTime = (value) => {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "N/A";
  return DATETIME_FORMATTER.format(new Date(parsed));
};

const formatCount = (value, singular, plural = `${singular}s`) => {
  const parsed = Math.max(0, Number(value) || 0);
  return `${parsed.toLocaleString("en-KE")} ${parsed === 1 ? singular : plural}`;
};

const toReadableLabel = (value, fallback = "Unknown") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const trimSummary = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const shortenText = (value, maxLength = 120) => {
  const text = trimSummary(value);
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(maxLength - 3, 0)).trim()}...`;
};

const getUserLabel = (user) => {
  const name = String(user?.name || "").trim();
  if (name) return name;
  const email = String(user?.email || "").trim();
  return email || "Workspace member";
};

const getReportReference = ({ tenantBrand, context }) => {
  const slug = String(tenantBrand?.slug || "").trim().toUpperCase() || "TENANT";
  const projectKey = String(context?.projectName || "PROJECT")
    .trim()
    .replace(/[^A-Z0-9]+/gi, "")
    .slice(0, 8)
    .toUpperCase() || "PROJECT";
  const date = new Date(context?.now || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
  return `PCR-${slug}-${projectKey}-${date}`;
};

const buildExecutiveSummary = (context, summaryReport) => {
  const projectSummary = trimSummary(context?.summary) || "No narrative summary has been captured for this project.";
  const linkedPartners = Array.isArray(summaryReport?.linkedPartners)
    ? summaryReport.linkedPartners.filter(Boolean)
    : [];
  const partnerText = linkedPartners.length
    ? ` Delivery involved ${linkedPartners.length} linked partner${linkedPartners.length === 1 ? "" : "s"}.`
    : "";
  return `${context?.projectName || "This project"} closed out at ${formatPercent(
    context?.progressPercent
  )} overall progress with ${formatCount(context?.taskTotals?.done, "completed task")} recorded out of ${formatCount(
    context?.taskCount,
    "tracked task"
  )}. ${projectSummary}${partnerText}`;
};

const buildConclusion = (context, summaryReport, currencyCode) => {
  const remainingAmount = toNumber(context?.remainingAmount);
  const remainingText =
    remainingAmount !== null
      ? `${formatCurrency(remainingAmount, currencyCode)} remains`
      : "remaining budget is not yet mapped";
  const documentationText = `${formatCount(context?.documents?.length, "document")} and ${formatCount(
    context?.notes?.length,
    "operational note"
  )} support the close-out record.`;
  const sustainabilityLabel = String(summaryReport?.sustainabilityLabel || "").trim();
  const sustainabilityText = sustainabilityLabel
    ? ` Workspace readiness is assessed as ${sustainabilityLabel.toLowerCase()}.`
    : "";
  return `The current close-out position shows ${remainingText}, ${formatPercent(
    context?.expenseProofPercent
  )} evidence coverage, and ${formatCount(
    context?.taskTotals?.open + context?.taskTotals?.in_progress,
    "active action"
  )} still needing follow-through. ${documentationText}${sustainabilityText}`;
};

const buildAchievementRows = (context, summaryReport, currencyCode) => {
  const rows = [
    `${context?.taskTotals?.done || 0}/${context?.taskCount || 0} tracked tasks closed; ${
      context?.overdueTaskCount || 0
    } overdue.`,
    `${formatCurrency(context?.spentAmount, currencyCode)} spent of ${formatCurrency(
      context?.budgetAmount,
      currencyCode
    )} budget.`,
    `${formatPercent(context?.expenseProofPercent)} expense proof coverage recorded.`,
  ];
  if (Array.isArray(summaryReport?.linkedPartners) && summaryReport.linkedPartners.length) {
    rows.push(`Partners: ${shortenText(summaryReport.linkedPartners.join(", "), 48)}.`);
  } else {
    rows.push(`${formatCount(context?.documents?.length, "file")} and ${formatCount(context?.notes?.length, "note")} archived.`);
  }
  return rows.slice(0, 4);
};

const buildLessonRows = (context) => {
  const notes = Array.isArray(context?.recentNotes) ? context.recentNotes : [];
  const rows = notes
    .slice(0, 3)
    .map((note) => {
      const title = trimSummary(note?.title) || "Lesson note";
      const detail = shortenText(note?.details, 110);
      return detail ? `${title}: ${detail}` : title;
    })
    .filter(Boolean);
  if (rows.length) return rows;
  return [
    "Capture final beneficiary or member outcomes before archive.",
    "Reconcile outstanding spend and proof attachments during project close-out.",
    "Record follow-up actions for any open activities transferred to the next cycle.",
  ];
};

const buildFinancialRows = (context, summaryReport, currencyCode) => {
  const topCategory = summaryReport?.topCategories?.[0];
  return [
    {
      label: "Approved budget",
      value: formatCurrency(context?.budgetAmount, currencyCode),
      tone: COLORS.accent,
    },
    {
      label: "Total spent",
      value: formatCurrency(context?.spentAmount, currencyCode),
      tone: COLORS.danger,
    },
    {
      label: "Budget balance",
      value: formatCurrency(context?.remainingAmount, currencyCode),
      tone: COLORS.success,
    },
    {
      label: "Top expense line",
      value: topCategory
        ? `${topCategory.category} · ${formatCurrency(topCategory.amount, currencyCode)}`
        : "Not enough expense data",
      tone: COLORS.teal,
    },
    {
      label: "Compliance coverage",
      value: formatPercent(context?.expenseProofPercent),
      tone: COLORS.warning,
    },
  ];
};

const drawHeaderLogo = (context, tenantBrand, logoImage) => {
  const boxX = 92;
  const boxY = 74;
  const boxSize = 64;
  drawRoundedRect(context, boxX, boxY, boxSize, boxSize, 12, {
    fill: COLORS.cardAlt,
  });
  if (logoImage) {
    const ratio = Math.min(boxSize * 0.7 / logoImage.width, boxSize * 0.7 / logoImage.height);
    const drawWidth = logoImage.width * ratio;
    const drawHeight = logoImage.height * ratio;
    context.drawImage(
      logoImage,
      boxX + (boxSize - drawWidth) / 2,
      boxY + (boxSize - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    return;
  }
  drawRoundedRect(context, boxX + 12, boxY + 12, boxSize - 24, boxSize - 24, 14, {
    fill: COLORS.accent,
  });
  drawTextBlock(context, {
    text: getReportInitials(tenantBrand?.name || "Habuks"),
    x: boxX + 14,
    y: boxY + 21,
    maxWidth: boxSize - 28,
    size: 22,
    weight: 700,
    color: "#ffffff",
    align: "center",
    maxLines: 1,
  });
};

const drawMetricRows = (context, rows, options = {}) => {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 420;
  const rowHeight = Number(options.rowHeight) || 56;
  rows.forEach((row, index) => {
    const rowY = y + index * rowHeight;
    if (index > 0) {
      drawDivider(context, x, rowY - 10, width, { color: COLORS.line });
    }
    context.beginPath();
    context.arc(x + 12, rowY + 18, 5, 0, Math.PI * 2);
    context.fillStyle = row?.tone || COLORS.accent;
    context.fill();
    drawTextBlock(context, {
      text: row?.label || "",
      x: x + 28,
      y: rowY + 2,
      maxWidth: width - 210,
      size: 14,
      weight: 600,
      color: COLORS.muted,
      maxLines: 1,
    });
    drawTextBlock(context, {
      text: row?.value || "—",
      x: x + 28,
      y: rowY + 22,
      maxWidth: width - 28,
      size: 24,
      weight: 700,
      color: COLORS.ink,
      maxLines: 1,
    });
  });
};

const drawBulletRows = (context, rows, options = {}) => {
  const x = Number(options.x) || 0;
  let y = Number(options.y) || 0;
  const width = Number(options.width) || 420;
  const size = Number(options.size) || 15;
  const lineHeight = Number(options.lineHeight) || 20;
  rows.forEach((row) => {
    context.beginPath();
    context.arc(x + 7, y + 10, 3.5, 0, Math.PI * 2);
    context.fillStyle = String(options.bulletColor || COLORS.accent);
    context.fill();
    const block = drawTextBlock(context, {
      text: row,
      x: x + 20,
      y,
      maxWidth: width - 20,
      size,
      lineHeight,
      color: options.color || COLORS.ink,
    });
    y += block.height + 12;
  });
  return y;
};

const drawStatusRibbon = (context, value, x, y) => {
  const normalized = String(value || "").trim().toLowerCase();
  let fill = "#e0f2fe";
  let color = "#0f5f63";
  if (normalized === "completed" || normalized === "done") {
    fill = "#dcfce7";
    color = "#116149";
  } else if (normalized === "cancelled") {
    fill = "#fee2e2";
    color = "#b91c1c";
  } else if (normalized === "in progress" || normalized === "in_progress" || normalized === "active") {
    fill = "#dff3fb";
    color = "#0d7490";
  }
  drawPill(context, {
    x,
    y,
    width: 154,
    height: 38,
    radius: 12,
    text: toReadableLabel(value, "Active"),
    fill,
    color,
    size: 14,
    weight: 700,
  });
};

const renderProjectCompletionReportPage = ({
  tenantBrand,
  user,
  context,
  summaryReport,
  logoImage,
  currencyCode,
}) => {
  const page = createReportCanvasPage();
  const { context: canvasContext } = page;
  const reportReference = getReportReference({ tenantBrand, context });
  const closureScore = Math.round(
    (
      clampPercent(context?.progressPercent) +
      clampPercent(context?.taskCompletionPercent) +
      clampPercent(context?.expenseProofPercent)
    ) / 3
  );
  const executiveSummary = buildExecutiveSummary(context, summaryReport);
  const conclusion = buildConclusion(context, summaryReport, currencyCode);
  const achievements = buildAchievementRows(context, summaryReport, currencyCode);
  const lessonRows = buildLessonRows(context);
  const financialRows = buildFinancialRows(context, summaryReport, currencyCode);
  const overviewRows = [
    {
      label: "Project progress",
      value: formatPercent(context?.progressPercent),
      tone: COLORS.accent,
    },
    {
      label: "Task completion",
      value: `${context?.taskTotals?.done || 0} / ${context?.taskCount || 0}`,
      tone: COLORS.success,
    },
    {
      label: "Members reached",
      value: String(Math.max(0, Number(context?.memberCount) || 0)),
      tone: COLORS.teal,
    },
    {
      label: "Archived records",
      value: `${Math.max(0, Number(context?.documents?.length) || 0)} docs`,
      tone: COLORS.warning,
    },
  ];

  canvasContext.fillStyle = "#f8fbfe";
  canvasContext.fillRect(0, 0, REPORT_PAGE.width, REPORT_PAGE.height);
  drawRoundedRect(canvasContext, 32, 32, REPORT_PAGE.width - 64, REPORT_PAGE.height - 64, 40, {
    fill: "#ffffff",
  });

  canvasContext.beginPath();
  canvasContext.arc(1088, 128, 86, 0, Math.PI * 2);
  canvasContext.strokeStyle = COLORS.accent;
  canvasContext.lineWidth = 24;
  canvasContext.stroke();
  canvasContext.beginPath();
  canvasContext.arc(1088, 128, 36, 0, Math.PI * 2);
  canvasContext.fillStyle = "#ffffff";
  canvasContext.fill();

  drawHeaderLogo(canvasContext, tenantBrand, logoImage);
  drawTextBlock(canvasContext, {
    text: tenantBrand?.name || "Habuks Workspace",
    x: 176,
    y: 82,
    maxWidth: 480,
    size: 28,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: trimSummary(tenantBrand?.tagline) || "Community operations workspace",
    x: 176,
    y: 116,
    maxWidth: 520,
    size: 15,
    weight: 500,
    color: COLORS.muted,
    maxLines: 2,
    lineHeight: 20,
  });
  drawStatusRibbon(canvasContext, context?.status, 948, 88);
  drawTextBlock(canvasContext, {
    text: reportReference,
    x: 904,
    y: 136,
    maxWidth: 248,
    size: 13,
    weight: 700,
    color: COLORS.subtle,
    align: "right",
    maxLines: 1,
  });

  drawTextBlock(canvasContext, {
    text: "Project Completion Report",
    x: 92,
    y: 190,
    maxWidth: 760,
    size: 58,
    weight: 700,
    color: COLORS.ink,
    maxLines: 2,
    lineHeight: 64,
  });
  drawTextBlock(canvasContext, {
    text: "Close-out summary with branded letterhead, delivery status, financial position, and archive notes.",
    x: 92,
    y: 266,
    maxWidth: 760,
    size: 18,
    weight: 500,
    color: COLORS.muted,
    lineHeight: 24,
    maxLines: 2,
  });

  drawRoundedRect(canvasContext, 92, 320, 444, 34, 8, {
    fill: COLORS.accent,
  });
  drawTextBlock(canvasContext, {
    text: `Date: ${formatDate(context?.now || new Date())}`,
    x: 110,
    y: 327,
    maxWidth: 220,
    size: 14,
    weight: 700,
    color: "#ffffff",
    maxLines: 1,
  });

  const metaPills = [
    `Project: ${context?.projectName || "Project"}`,
    `Category: ${context?.category || "General"}`,
    `Started: ${context?.startDateLabel || "N/A"}`,
  ];
  metaPills.forEach((pillText, index) => {
    drawPill(canvasContext, {
      x: 92 + index * 248,
      y: 372,
      width: 226,
      height: 36,
      radius: INNER_PILL_RADIUS,
      text: pillText,
      fill: COLORS.surfaceAlt,
      color: COLORS.muted,
      size: 13,
      weight: 600,
    });
  });

  drawRoundedRect(canvasContext, 92, 432, 1056, 170, INNER_CARD_RADIUS, {
    fill: COLORS.surface,
  });
  drawTextBlock(canvasContext, {
    text: "Executive Summary",
    x: 118,
    y: 458,
    maxWidth: 340,
    size: 24,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: executiveSummary,
    x: 118,
    y: 498,
    maxWidth: 1000,
    size: 16,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 24,
    maxLines: 4,
  });

  drawTextBlock(canvasContext, {
    text: "Completion Overview",
    x: 92,
    y: 638,
    maxWidth: 380,
    size: 28,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawDivider(canvasContext, 92, 682, 1056, {
    color: COLORS.accent,
    lineWidth: 2,
  });

  drawRoundedRect(canvasContext, 92, 708, 496, 360, INNER_CARD_RADIUS, {
    fill: COLORS.surface,
  });
  drawTextBlock(canvasContext, {
    text: "Operational Close",
    x: 120,
    y: 734,
    maxWidth: 240,
    size: 22,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawMetricRows(canvasContext, overviewRows, {
    x: 120,
    y: 784,
    width: 438,
    rowHeight: 68,
  });

  drawRoundedRect(canvasContext, 620, 708, 528, 360, INNER_CARD_RADIUS, {
    fill: COLORS.surface,
  });
  drawTextBlock(canvasContext, {
    text: "Completion Score",
    x: 648,
    y: 734,
    maxWidth: 220,
    size: 22,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawDonutChart(canvasContext, {
    centerX: 776,
    centerY: 854,
    radius: 90,
    thickness: 18,
    trackColor: "#d9e7f2",
    segments: [
      { value: clampPercent(closureScore) / 100, color: COLORS.accent },
      { value: (100 - clampPercent(closureScore)) / 100, color: "#ebf2f8" },
    ],
    valueLabel: `${closureScore}%`,
    caption: "Composite close-out readiness",
    valueColor: COLORS.accent,
    valueSize: 44,
    captionSize: 14,
  });
  drawTextBlock(canvasContext, {
    text: "Key outcomes",
    x: 896,
    y: 774,
    maxWidth: 180,
    size: 16,
    weight: 700,
    color: COLORS.muted,
    maxLines: 1,
  });
  drawBulletRows(canvasContext, achievements, {
    x: 896,
    y: 806,
    width: 224,
    size: 13,
    lineHeight: 18,
    bulletColor: COLORS.accent,
    color: COLORS.ink,
  });

  drawRoundedRect(canvasContext, 92, 1102, 510, 336, INNER_CARD_RADIUS, {
    fill: COLORS.surface,
  });
  drawTextBlock(canvasContext, {
    text: "Financial Closure",
    x: 118,
    y: 1128,
    maxWidth: 260,
    size: 22,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawMetricRows(canvasContext, financialRows, {
    x: 118,
    y: 1178,
    width: 452,
    rowHeight: 54,
  });

  drawRoundedRect(canvasContext, 638, 1102, 510, 336, INNER_CARD_RADIUS, {
    fill: COLORS.surfaceAlt,
  });
  drawTextBlock(canvasContext, {
    text: "Evidence and Lessons",
    x: 666,
    y: 1128,
    maxWidth: 300,
    size: 22,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawBulletRows(canvasContext, lessonRows, {
    x: 666,
    y: 1176,
    width: 440,
    size: 15,
    lineHeight: 22,
    bulletColor: COLORS.teal,
    color: COLORS.ink,
  });

  drawRoundedRect(canvasContext, 92, 1468, 1056, 146, INNER_CARD_RADIUS, {
    fill: COLORS.surface,
  });
  drawTextBlock(canvasContext, {
    text: "Conclusion",
    x: 118,
    y: 1494,
    maxWidth: 240,
    size: 22,
    weight: 700,
    color: COLORS.ink,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: conclusion,
    x: 118,
    y: 1532,
    maxWidth: 1000,
    size: 16,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 24,
    maxLines: 3,
  });

  drawDivider(canvasContext, 92, 1648, 1056, {
    color: COLORS.line,
    lineWidth: 1,
  });
  drawTextBlock(canvasContext, {
    text: `Generated by ${getUserLabel(user)}${user?.email ? ` (${user.email})` : ""} on ${formatDateTime(
      context?.now || new Date()
    )}`,
    x: 92,
    y: 1666,
    maxWidth: 710,
    size: 13,
    weight: 600,
    color: COLORS.footer,
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: TEMPLATE_TEXT,
    x: 844,
    y: 1666,
    maxWidth: 304,
    size: 13,
    weight: 700,
    color: COLORS.accent,
    align: "right",
    maxLines: 1,
  });
  drawTextBlock(canvasContext, {
    text: DISCLAIMER_TEXT,
    x: 92,
    y: 1692,
    maxWidth: 1056,
    size: 12,
    weight: 500,
    color: COLORS.footer,
    lineHeight: 17,
    maxLines: 2,
  });

  return page.canvas;
};

export async function buildProjectCompletionReportFile(options = {}) {
  const fileName = String(options.fileName || "project-completion-report.pdf");
  const tenantBrand = options.tenantBrand || {};
  const user = options.user || {};
  const context = options.context;
  const summaryReport = options.summaryReport || {};
  const currencyCode = normalizeCurrencyCode(options.currencyCode);

  if (!context) {
    throw new Error("Project completion report data is missing.");
  }

  let logoImage = null;
  try {
    logoImage = await loadReportImage(tenantBrand?.logoUrl);
    const canvas = renderProjectCompletionReportPage({
      tenantBrand,
      user,
      context,
      summaryReport,
      logoImage,
      currencyCode,
    });
    return buildPdfFileFromCanvasPages({
      canvases: [canvas],
      fileName,
      quality: 0.94,
    });
  } finally {
    if (logoImage) {
      releaseReportImage(logoImage);
    }
  }
}
