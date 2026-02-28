import { buildPdfFileFromCanvasPages } from "./pdfImageDocument.js";
import {
  REPORT_PAGE,
  createReportCanvasPage,
  drawDivider,
  drawTextBlock,
  setReportFont,
  wrapReportText,
} from "./reportCanvas.js";

const COLORS = {
  ink: "#111111",
  muted: "#2f2f2f",
  soft: "#666666",
  line: "#d4d4d4",
  footer: "#505050",
};

const FONT_FAMILY = '"Times New Roman", Times, Georgia, serif';
const PAGE_MARGIN_X = 120;
const PAGE_BODY_TOP = 96;
const PAGE_BODY_BOTTOM = 1560;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-KE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const toText = (value) => String(value || "").trim();

const toUpperText = (value) => toText(value).toUpperCase();

const toDateLabel = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? DATE_FORMATTER.format(new Date(parsed)) : "Date Not Recorded";
};

const toUpperDateLabel = (value) => toDateLabel(value).toUpperCase();

const toClockHrsLabel = (value) => {
  const text = toText(value);
  if (!text) return "TIME NOT RECORDED";

  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) {
    return `${TIME_FORMATTER.format(new Date(parsed)).replace(":", "")}HRS`;
  }

  const twelveHourMatch = text.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (twelveHourMatch) {
    let hours = Number.parseInt(twelveHourMatch[1], 10);
    const minutes = twelveHourMatch[2];
    const meridiem = twelveHourMatch[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}${minutes}HRS`;
  }

  const twentyFourHourMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHourMatch) {
    return `${String(Number.parseInt(twentyFourHourMatch[1], 10)).padStart(2, "0")}${twentyFourHourMatch[2]}HRS`;
  }

  return text.toUpperCase();
};

const buildParagraph = (...parts) =>
  parts
    .map((part) => toText(part))
    .filter(Boolean)
    .join(" ");

const buildNumberedItems = (rows = [], formatter = (row) => row) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return ["NIL"];
  }
  return safeRows.map((row) => toUpperText(formatter(row)));
};

const buildBulletItems = (items = []) => {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems.map((item) => toText(item)).filter(Boolean);
};

const buildMeetingTitle = (meeting = {}) => {
  const meetingTitle = toUpperText(meeting?.title) || "MEETING";
  const dateLabel = toUpperDateLabel(meeting?.date);
  const locationLabel = toUpperText(meeting?.location) || "LOCATION NOT RECORDED";
  const timeLabel = toClockHrsLabel(meeting?.startAtLabel);
  return `MINUTES OF ${meetingTitle} HELD ON ${dateLabel} AT ${locationLabel} FROM ${timeLabel}.`;
};

const createMinutesBlocks = (meeting = {}, context = {}) => {
  const minutesData = context?.minutesData || {};
  const agendaItems = Array.isArray(context?.agendaItems) ? context.agendaItems : [];
  const presentRows = Array.isArray(context?.presentRows) ? context.presentRows : [];
  const apologyRows = Array.isArray(context?.apologyRows) ? context.apologyRows : [];
  const absentRows = Array.isArray(context?.absentRows) ? context.absentRows : [];

  const blocks = [
    { type: "title", text: buildMeetingTitle(meeting) },
    {
      type: "section",
      text: "MEMBERS PRESENT:",
    },
    {
      type: "list",
      listStyle: "numbered",
      items: buildNumberedItems(presentRows, (row) => row?.name || "Member"),
    },
    {
      type: "section",
      text: "ABSENT WITH APOLOGY:",
    },
    {
      type: "list",
      listStyle: "numbered",
      items: buildNumberedItems(apologyRows, (row) => row?.name || "Member"),
    },
    {
      type: "section",
      text: "ABSENT WITHOUT APOLOGY:",
    },
    {
      type: "list",
      listStyle: "numbered",
      items: buildNumberedItems(absentRows, (row) => row?.name || "Member"),
    },
    {
      type: "section",
      text: "MIN 01 - PRELIMINARIES",
    },
    {
      type: "paragraph",
      text: toText(minutesData?.preliminaries) || "No preliminaries captured.",
    },
    {
      type: "section",
      text: "MIN 02 - CONFIRMATION OF PREVIOUS MINUTES",
    },
    {
      type: "paragraph",
      text:
        buildParagraph(
          toText(minutesData?.previous_minutes?.status)
            ? `Status: ${minutesData.previous_minutes.status}.`
            : "Status not recorded.",
          toText(minutesData?.previous_minutes?.notes) || "No notes captured."
        ) || "No previous minutes notes captured.",
    },
    {
      type: "section",
      text: "MIN 03 - AGENDA",
    },
    {
      type: "list",
      listStyle: "bullet",
      items: buildBulletItems(
        agendaItems.length ? agendaItems.map((item) => item?.title || "Agenda item") : [meeting?.agenda]
      ),
    },
  ];

  agendaItems.forEach((item, index) => {
    const minuteNumber = String(index + 4).padStart(2, "0");
    blocks.push({
      type: "section",
      text: `MIN ${minuteNumber} - ${toUpperText(item?.title) || "AGENDA ITEM"}`,
    });
    blocks.push({
      type: "paragraph",
      text: toText(item?.details) || "No discussion recorded.",
    });
    const resolutions = buildBulletItems(item?.resolutions);
    if (resolutions.length) {
      blocks.push({
        type: "list",
        listStyle: "bullet",
        items: resolutions,
      });
    }
  });

  const nextMinuteNumber = String(agendaItems.length + 4).padStart(2, "0");
  const nextMeetingMinuteNumber = String(agendaItems.length + 5).padStart(2, "0");
  const adjournmentMinuteNumber = String(agendaItems.length + 6).padStart(2, "0");

  blocks.push(
    {
      type: "section",
      text: `MIN ${nextMinuteNumber} - FINANCIAL MATTERS`,
    },
    {
      type: "paragraph",
      text:
        buildParagraph(
          toText(minutesData?.financial_matters?.discussion) || "No financial discussion recorded.",
          toText(minutesData?.financial_matters?.resolution)
            ? `Resolution: ${minutesData.financial_matters.resolution}.`
            : "Resolution not recorded."
        ) || "No financial matters captured.",
    },
    {
      type: "section",
      text: `MIN ${nextMeetingMinuteNumber} - DATE OF NEXT MEETING`,
    },
    {
      type: "paragraph",
      text:
        buildParagraph(
          minutesData?.next_meeting?.date
            ? `The next meeting will be held on ${toDateLabel(minutesData.next_meeting.date)}.`
            : "Next meeting date not recorded.",
          toText(minutesData?.next_meeting?.note)
        ) || "Next meeting details not recorded.",
    },
    {
      type: "section",
      text: `MIN ${adjournmentMinuteNumber} - ADJOURNMENT`,
    },
    {
      type: "paragraph",
      text:
        buildParagraph(
          toText(minutesData?.adjournment?.time)
            ? `The meeting adjourned at ${toText(minutesData.adjournment.time)}.`
            : "Adjournment time not recorded.",
          toText(minutesData?.adjournment?.note)
        ) || "Adjournment note not recorded.",
    },
    {
      type: "signature",
      chairpersonName: toUpperText(context?.chairpersonName) || "CHAIRPERSON",
      secretaryName: toUpperText(context?.secretaryName) || "SECRETARY",
    }
  );

  return blocks;
};

const getTextLines = (context, text, options = {}) => {
  setReportFont(context, {
    size: options.size,
    weight: options.weight,
    family: options.family || FONT_FAMILY,
  });
  return wrapReportText(context, text, options.maxWidth);
};

const measureBlockHeight = (context, block, maxWidth) => {
  if (!block) return 0;

  if (block.type === "title") {
    const lineHeight = 34;
    const lines = getTextLines(context, block.text, {
      size: 18,
      weight: 700,
      maxWidth,
    });
    return lines.length * lineHeight + 26;
  }

  if (block.type === "section") {
    const lineHeight = 28;
    const lines = getTextLines(context, block.text, {
      size: 16,
      weight: 700,
      maxWidth,
    });
    return lines.length * lineHeight + 18;
  }

  if (block.type === "paragraph") {
    const lineHeight = 28;
    const lines = getTextLines(context, block.text, {
      size: 15,
      weight: 400,
      maxWidth,
    });
    return lines.length * lineHeight + 14;
  }

  if (block.type === "list") {
    const items = Array.isArray(block.items) ? block.items : [];
    const lineHeight = 27;
    return (
      items.reduce((sum, item, index) => {
        const prefix = block.listStyle === "numbered" ? `${index + 1}. ` : "\u2022 ";
        const lines = getTextLines(context, `${prefix}${item}`, {
          size: 15,
          weight: 400,
          maxWidth: maxWidth - 30,
        });
        return sum + lines.length * lineHeight + 8;
      }, 0) + 8
    );
  }

  if (block.type === "signature") {
    return 120;
  }

  return 0;
};

const drawUnderlinedHeading = (context, text, x, y, maxWidth, options = {}) => {
  const rendered = drawTextBlock(context, {
    text,
    x,
    y,
    maxWidth,
    size: options.size || 16,
    weight: options.weight || 700,
    color: options.color || COLORS.ink,
    family: options.family || FONT_FAMILY,
    maxLines: 0,
    lineHeight: options.lineHeight || 28,
  });

  setReportFont(context, {
    size: options.size || 16,
    weight: options.weight || 700,
    family: options.family || FONT_FAMILY,
  });
  const underlineWidth = Math.min(
    maxWidth,
    Math.max(...rendered.lines.map((line) => context.measureText(line).width), 0)
  );
  drawDivider(context, x, y + rendered.height + 4, underlineWidth, {
    color: options.color || COLORS.ink,
    lineWidth: 1.2,
  });

  return rendered.height + 12;
};

const drawFooter = (page, context, pageNumber) => {
  const canvasContext = page.context;
  drawDivider(canvasContext, PAGE_MARGIN_X, REPORT_PAGE.height - 128, REPORT_PAGE.width - PAGE_MARGIN_X * 2, {
    color: COLORS.line,
  });
  drawTextBlock(canvasContext, {
    text: `Generated by ${toText(context?.generatedBy) || "Habuks"} on ${toDateLabel(context?.generatedAt)}`,
    x: PAGE_MARGIN_X,
    y: REPORT_PAGE.height - 102,
    maxWidth: 600,
    size: 12,
    weight: 400,
    color: COLORS.footer,
    family: FONT_FAMILY,
    maxLines: 1,
    lineHeight: 16,
  });
  drawTextBlock(canvasContext, {
    text: toText(context?.footerNote) || "Confirm attendance and resolutions before sharing externally.",
    x: PAGE_MARGIN_X,
    y: REPORT_PAGE.height - 76,
    maxWidth: 760,
    size: 11,
    weight: 400,
    color: COLORS.soft,
    family: FONT_FAMILY,
    maxLines: 2,
    lineHeight: 14,
  });
  drawTextBlock(canvasContext, {
    text: `Page ${pageNumber}`,
    x: REPORT_PAGE.width - PAGE_MARGIN_X - 120,
    y: REPORT_PAGE.height - 100,
    maxWidth: 120,
    size: 12,
    weight: 400,
    color: COLORS.footer,
    family: FONT_FAMILY,
    align: "right",
    maxLines: 1,
    lineHeight: 16,
  });
};

const renderMinutesBlock = (page, block, cursorY, maxWidth) => {
  const canvasContext = page.context;

  if (block.type === "title") {
    return (
      cursorY +
      drawUnderlinedHeading(canvasContext, block.text, PAGE_MARGIN_X, cursorY, maxWidth, {
        size: 18,
        weight: 700,
        color: COLORS.ink,
        lineHeight: 32,
      }) +
      18
    );
  }

  if (block.type === "section") {
    return (
      cursorY +
      drawUnderlinedHeading(canvasContext, block.text, PAGE_MARGIN_X, cursorY, maxWidth, {
        size: 16,
        weight: 700,
        color: COLORS.ink,
        lineHeight: 28,
      }) +
      8
    );
  }

  if (block.type === "paragraph") {
    const rendered = drawTextBlock(canvasContext, {
      text: block.text,
      x: PAGE_MARGIN_X,
      y: cursorY,
      maxWidth,
      size: 15,
      weight: 400,
      color: COLORS.muted,
      family: FONT_FAMILY,
      maxLines: 0,
      lineHeight: 28,
    });
    return cursorY + rendered.height + 14;
  }

  if (block.type === "list") {
    let nextY = cursorY;
    (Array.isArray(block.items) ? block.items : []).forEach((item, index) => {
      const prefix = block.listStyle === "numbered" ? `${index + 1}. ` : "\u2022 ";
      const rendered = drawTextBlock(canvasContext, {
        text: `${prefix}${item}`,
        x: PAGE_MARGIN_X + 28,
        y: nextY,
        maxWidth: maxWidth - 28,
        size: 15,
        weight: 400,
        color: COLORS.muted,
        family: FONT_FAMILY,
        maxLines: 0,
        lineHeight: 27,
      });
      nextY += rendered.height + 8;
    });
    return nextY + 2;
  }

  if (block.type === "signature") {
    const lineWidth = 280;
    const lineY = cursorY + 28;
    drawDivider(canvasContext, PAGE_MARGIN_X, lineY, lineWidth, {
      color: COLORS.ink,
      lineWidth: 1,
    });
    drawDivider(canvasContext, REPORT_PAGE.width - PAGE_MARGIN_X - lineWidth, lineY, lineWidth, {
      color: COLORS.ink,
      lineWidth: 1,
    });
    drawTextBlock(canvasContext, {
      text: block.chairpersonName,
      x: PAGE_MARGIN_X,
      y: lineY + 12,
      maxWidth: lineWidth,
      size: 13,
      weight: 700,
      color: COLORS.ink,
      family: FONT_FAMILY,
      align: "center",
      maxLines: 1,
      lineHeight: 18,
    });
    drawTextBlock(canvasContext, {
      text: "CHAIRPERSON",
      x: PAGE_MARGIN_X,
      y: lineY + 34,
      maxWidth: lineWidth,
      size: 12,
      weight: 400,
      color: COLORS.soft,
      family: FONT_FAMILY,
      align: "center",
      maxLines: 1,
      lineHeight: 16,
    });
    drawTextBlock(canvasContext, {
      text: block.secretaryName,
      x: REPORT_PAGE.width - PAGE_MARGIN_X - lineWidth,
      y: lineY + 12,
      maxWidth: lineWidth,
      size: 13,
      weight: 700,
      color: COLORS.ink,
      family: FONT_FAMILY,
      align: "center",
      maxLines: 1,
      lineHeight: 18,
    });
    drawTextBlock(canvasContext, {
      text: "SECRETARY",
      x: REPORT_PAGE.width - PAGE_MARGIN_X - lineWidth,
      y: lineY + 34,
      maxWidth: lineWidth,
      size: 12,
      weight: 400,
      color: COLORS.soft,
      family: FONT_FAMILY,
      align: "center",
      maxLines: 1,
      lineHeight: 16,
    });
    return lineY + 78;
  }

  return cursorY;
};

const renderMeetingMinutesPages = ({ context }) => {
  const blocks = createMinutesBlocks(context?.meeting, context);
  const pages = [];
  const maxWidth = REPORT_PAGE.width - PAGE_MARGIN_X * 2;

  const createPage = () => {
    const page = createReportCanvasPage();
    drawFooter(page, context, pages.length + 1);
    pages.push(page);
    return page;
  };

  let page = createPage();
  let cursorY = PAGE_BODY_TOP;

  blocks.forEach((block) => {
    const blockHeight = measureBlockHeight(page.context, block, maxWidth);
    if (cursorY + blockHeight > PAGE_BODY_BOTTOM) {
      page = createPage();
      cursorY = PAGE_BODY_TOP;
    }
    cursorY = renderMinutesBlock(page, block, cursorY, maxWidth);
  });

  return pages.map((entry) => entry.canvas);
};

export async function buildMeetingMinutesReportFile(options = {}) {
  const fileName = String(options.fileName || "meeting-minutes.pdf");
  const context = options.context || {};
  const canvases = renderMeetingMinutesPages({ context });
  return buildPdfFileFromCanvasPages({
    canvases,
    fileName,
    quality: 0.94,
  });
}
