import { buildPdfFileFromCanvasPages } from "./pdfImageDocument.js";
import { normalizeCurrencyCode } from "../currency.js";
import {
  REPORT_PAGE,
  createReportCanvasPage,
  drawDivider,
  drawTextBlock,
  getReportInitials,
  loadReportImage,
  releaseReportImage,
  setReportFont,
  wrapReportText,
} from "./reportCanvas.js";

const COLORS = {
  page: "#ffffff",
  ink: "#111111",
  muted: "#444444",
  line: "#d1d5db",
  footer: "#555555",
};

const OFFICIAL_FONT = '"Times New Roman", Times, serif';
const PAGE_MARGIN_X = 72;
const PAGE_WIDTH = REPORT_PAGE.width - PAGE_MARGIN_X * 2;
const HEADER_LINE_Y = 112;
const CONTENT_START_Y = 136;
const CONTENT_END_Y = 1590;
const FOOTER_Y = 1672;
const LOGO_BOX_SIZE = 42;

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

const isHeadingLine = (line) => {
  const text = trimText(line);
  if (!text) return false;
  if (/^\d+\.\s+[A-Z]/.test(text)) return true;
  if (/^[A-Z0-9&()./\- ]+$/.test(text) && /[A-Z]/.test(text) && text.length <= 70) return true;
  return false;
};

const isBulletLine = (line) => /^\d+\.\s+/.test(trimText(line)) || /^[-•]\s+/.test(trimText(line));

const normalizeContentLines = (lines, templateLabel) => {
  const normalized = Array.isArray(lines) ? lines : [];
  const output = [];
  normalized.forEach((line) => {
    const text = trimText(line);
    if (!text) {
      output.push({ type: "spacer", height: 10 });
      return;
    }
    if (/^generated:/i.test(text)) return;
    if (text.toLowerCase() === trimText(templateLabel).toLowerCase()) return;
    if (isHeadingLine(text)) {
      output.push({ type: "heading", text });
      return;
    }
    if (/\s\|\s/.test(text)) {
      output.push({ type: "paragraph", text: text.replace(/\s\|\s/g, "  |  ") });
      return;
    }
    if (isBulletLine(text)) {
      output.push({ type: "bullet", text: text.replace(/^[-•]\s+/, "") });
      return;
    }
    output.push({ type: "paragraph", text });
  });

  const deduped = [];
  output.forEach((entry) => {
    if (
      entry.type === "spacer" &&
      deduped.length > 0 &&
      deduped[deduped.length - 1].type === "spacer"
    ) {
      return;
    }
    deduped.push(entry);
  });
  return deduped;
};

const measureTextHeight = (context, text, options = {}) => {
  const size = Number(options.size) || 12;
  const lineHeight = Number(options.lineHeight) || Math.round(size * 1.5);
  const maxWidth = Number(options.maxWidth) || PAGE_WIDTH;
  setReportFont(context, {
    size,
    weight: options.weight || 500,
    family: options.family || OFFICIAL_FONT,
  });
  const lines = wrapReportText(context, text, maxWidth);
  return Math.max(lineHeight, lines.length * lineHeight);
};

const drawOfficialText = (context, options = {}) =>
  drawTextBlock(context, {
    family: OFFICIAL_FONT,
    color: COLORS.ink,
    ...options,
  });

const drawHeader = (context, tenantBrand, logoImage) => {
  if (logoImage) {
    const ratio = Math.min(LOGO_BOX_SIZE / logoImage.width, LOGO_BOX_SIZE / logoImage.height);
    const drawWidth = logoImage.width * ratio;
    const drawHeight = logoImage.height * ratio;
    context.drawImage(
      logoImage,
      PAGE_MARGIN_X,
      60,
      drawWidth,
      drawHeight
    );
  } else {
    context.strokeStyle = COLORS.line;
    context.lineWidth = 1;
    context.strokeRect(PAGE_MARGIN_X, 58, LOGO_BOX_SIZE, LOGO_BOX_SIZE);
    drawOfficialText(context, {
      text: getReportInitials(tenantBrand?.name || "HB"),
      x: PAGE_MARGIN_X,
      y: 69,
      maxWidth: LOGO_BOX_SIZE,
      size: 12,
      weight: 600,
      align: "left",
      maxLines: 1,
    });
  }
  drawDivider(context, PAGE_MARGIN_X, HEADER_LINE_Y, PAGE_WIDTH, {
    color: COLORS.line,
    lineWidth: 1,
  });
};

const drawFooter = (context, pageNumber) => {
  drawDivider(context, PAGE_MARGIN_X, FOOTER_Y - 14, PAGE_WIDTH, {
    color: COLORS.line,
    lineWidth: 1,
  });
  drawOfficialText(context, {
    text: `Page ${pageNumber}`,
    x: PAGE_MARGIN_X,
    y: FOOTER_Y,
    maxWidth: PAGE_WIDTH,
    size: 10,
    weight: 500,
    color: COLORS.footer,
    align: "right",
    maxLines: 1,
  });
};

const drawMetaTable = (context, rows, startY) => {
  const rowHeight = 34;
  const keyWidth = 238;
  const totalHeight = rows.length * rowHeight;

  context.strokeStyle = COLORS.line;
  context.lineWidth = 1;
  context.strokeRect(PAGE_MARGIN_X, startY, PAGE_WIDTH, totalHeight);
  context.beginPath();
  context.moveTo(PAGE_MARGIN_X + keyWidth, startY);
  context.lineTo(PAGE_MARGIN_X + keyWidth, startY + totalHeight);
  context.stroke();

  rows.forEach((row, index) => {
    const rowY = startY + index * rowHeight;
    if (index > 0) {
      drawDivider(context, PAGE_MARGIN_X, rowY, PAGE_WIDTH, {
        color: COLORS.line,
        lineWidth: 1,
      });
    }
    drawOfficialText(context, {
      text: row.label,
      x: PAGE_MARGIN_X + 12,
      y: rowY + 10,
      maxWidth: keyWidth - 24,
      size: 11,
      weight: 700,
      color: COLORS.muted,
      maxLines: 1,
    });
    drawOfficialText(context, {
      text: row.value,
      x: PAGE_MARGIN_X + keyWidth + 12,
      y: rowY + 10,
      maxWidth: PAGE_WIDTH - keyWidth - 24,
      size: 11,
      weight: 500,
      color: COLORS.ink,
      maxLines: 1,
    });
  });

  return startY + totalHeight;
};

const drawContentEntry = (context, entry, y) => {
  if (entry.type === "spacer") {
    return y + Number(entry.height || 8);
  }
  if (entry.type === "heading") {
    const block = drawOfficialText(context, {
      text: entry.text,
      x: PAGE_MARGIN_X,
      y,
      maxWidth: PAGE_WIDTH,
      size: 15,
      weight: 700,
      color: COLORS.ink,
      lineHeight: 21,
      maxLines: 2,
    });
    return y + block.height + 6;
  }
  if (entry.type === "bullet") {
    drawOfficialText(context, {
      text: "•",
      x: PAGE_MARGIN_X,
      y,
      maxWidth: 12,
      size: 12,
      weight: 700,
      color: COLORS.ink,
      maxLines: 1,
    });
    const block = drawOfficialText(context, {
      text: entry.text,
      x: PAGE_MARGIN_X + 14,
      y,
      maxWidth: PAGE_WIDTH - 14,
      size: 12,
      weight: 500,
      color: COLORS.ink,
      lineHeight: 18,
    });
    return y + block.height + 5;
  }
  const block = drawOfficialText(context, {
    text: entry.text,
    x: PAGE_MARGIN_X,
    y,
    maxWidth: PAGE_WIDTH,
    size: 12,
    weight: 500,
    color: COLORS.ink,
    lineHeight: 18,
  });
  return y + block.height + 5;
};

const getEntryHeight = (context, entry) => {
  if (entry.type === "spacer") return Number(entry.height || 8);
  if (entry.type === "heading") {
    return measureTextHeight(context, entry.text, {
      size: 15,
      weight: 700,
      maxWidth: PAGE_WIDTH,
      lineHeight: 21,
    }) + 6;
  }
  if (entry.type === "bullet") {
    return (
      measureTextHeight(context, entry.text, {
        size: 12,
        weight: 500,
        maxWidth: PAGE_WIDTH - 14,
        lineHeight: 18,
      }) + 5
    );
  }
  return (
    measureTextHeight(context, entry.text, {
      size: 12,
      weight: 500,
      maxWidth: PAGE_WIDTH,
      lineHeight: 18,
    }) + 5
  );
};

export async function buildProjectTemplateOfficialReportFile(options = {}) {
  const fileName = String(options.fileName || "project-document.pdf");
  const templateLabel = trimText(options.templateLabel || "Project Document");
  const context = options.context || {};
  const user = options.user || {};
  const tenantBrand = options.tenantBrand || {};
  const currencyCode = normalizeCurrencyCode(options.currencyCode);
  const bodyLines = normalizeContentLines(options.lines, templateLabel);

  const generatedAt = formatDateTime(context?.now || new Date());
  const documentDate = formatDate(context?.now || new Date());
  const reference = `${String(options.templateKey || "document")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()}-${new Date(context?.now || Date.now()).toISOString().slice(0, 10).replace(/-/g, "")}`;

  const metaRows = [
    { label: "Project title", value: trimText(context?.projectName) || "Project" },
    { label: "Project number", value: reference },
    { label: "Document type", value: templateLabel },
    { label: "Project category", value: trimText(context?.category) || "N/A" },
    { label: "Project status", value: toReadableLabel(context?.status, "Active") },
    {
      label: "Report period",
      value: `${trimText(context?.startDateLabel) || "N/A"} to ${formatDate(context?.now || new Date())}`,
    },
    { label: "Start date", value: trimText(context?.startDateLabel) || "N/A" },
    { label: "Prepared by", value: getUserLabel(user) },
    { label: "Prepared date", value: documentDate },
    { label: "Currency", value: currencyCode || "N/A" },
  ];

  const canvases = [];
  let pageNumber = 0;

  const createPage = () => {
    pageNumber += 1;
    const page = createReportCanvasPage({ background: COLORS.page });
    drawHeader(page.context, tenantBrand, logoImage);
    drawFooter(page.context, pageNumber);
    canvases.push(page.canvas);
    return page;
  };

  let logoImage = null;
  try {
    logoImage = await loadReportImage(tenantBrand?.logoUrl);

    let currentPage = createPage();
    let currentY = CONTENT_START_Y;

    drawOfficialText(currentPage.context, {
      text: templateLabel,
      x: PAGE_MARGIN_X,
      y: currentY,
      maxWidth: PAGE_WIDTH,
      size: 30,
      weight: 700,
      color: COLORS.ink,
      maxLines: 2,
      lineHeight: 34,
    });
    currentY += 42;
    drawOfficialText(currentPage.context, {
      text: `Generated ${generatedAt}`,
      x: PAGE_MARGIN_X,
      y: currentY,
      maxWidth: PAGE_WIDTH,
      size: 11,
      weight: 500,
      color: COLORS.muted,
      maxLines: 1,
    });
    currentY += 22;

    currentY = drawMetaTable(currentPage.context, metaRows, currentY);
    currentY += 16;

    bodyLines.forEach((entry) => {
      const entryHeight = getEntryHeight(currentPage.context, entry);
      if (currentY + entryHeight > CONTENT_END_Y) {
        currentPage = createPage();
        currentY = CONTENT_START_Y;
      }
      currentY = drawContentEntry(currentPage.context, entry, currentY);
    });

    return buildPdfFileFromCanvasPages({
      canvases,
      fileName,
      quality: 0.94,
    });
  } finally {
    if (logoImage) {
      releaseReportImage(logoImage);
    }
  }
}
