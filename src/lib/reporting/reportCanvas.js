const DEFAULT_FONT_STACK = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

export const REPORT_PAGE = {
  width: 1240,
  height: 1754,
};

const hasBrowserCanvas = () =>
  typeof document !== "undefined" && typeof document.createElement === "function";

const normalizeFontWeight = (value) => {
  const weight = String(value ?? "400").trim();
  return weight || "400";
};

export function createReportCanvasPage(options = {}) {
  if (!hasBrowserCanvas()) {
    throw new Error("Document rendering is only available in the browser.");
  }
  const width = Number(options.width) || REPORT_PAGE.width;
  const height = Number(options.height) || REPORT_PAGE.height;
  const background = String(options.background || "#ffffff");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialise the report canvas.");
  }
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.textBaseline = "top";
  return { canvas, context, width, height };
}

export function setReportFont(context, options = {}) {
  const size = Number(options.size) || 16;
  const weight = normalizeFontWeight(options.weight);
  const family = String(options.family || DEFAULT_FONT_STACK);
  context.font = `${weight} ${size}px ${family}`;
}

export function wrapReportText(context, value, maxWidth) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return [""];
  const safeMaxWidth = Number(maxWidth) > 0 ? Number(maxWidth) : 1;
  const words = text.split(" ");
  const lines = [];
  let current = "";

  const pushWord = (word) => {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= safeMaxWidth) {
      current = next;
      return;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (context.measureText(word).width <= safeMaxWidth) {
      current = word;
      return;
    }
    let slice = "";
    for (const character of word) {
      const nextSlice = `${slice}${character}`;
      if (context.measureText(nextSlice).width <= safeMaxWidth || !slice) {
        slice = nextSlice;
        continue;
      }
      lines.push(slice);
      slice = character;
    }
    current = slice;
  };

  words.forEach((word) => {
    if (!word) return;
    pushWord(word);
  });
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

export function truncateReportText(context, value, maxWidth, maxLines = 2) {
  const safeMaxLines = Math.max(1, Number(maxLines) || 1);
  const lines = wrapReportText(context, value, maxWidth);
  if (lines.length <= safeMaxLines) return lines;
  const trimmed = lines.slice(0, safeMaxLines);
  let lastLine = trimmed[safeMaxLines - 1] || "";
  while (lastLine && context.measureText(`${lastLine}...`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1);
  }
  trimmed[safeMaxLines - 1] = lastLine ? `${lastLine}...` : "...";
  return trimmed;
}

export function drawTextBlock(context, options = {}) {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const maxWidth = Number(options.maxWidth) || REPORT_PAGE.width;
  const color = String(options.color || "#0f172a");
  const align = String(options.align || "left");
  const size = Number(options.size) || 16;
  const lineHeight = Number(options.lineHeight) || Math.round(size * 1.45);
  const maxLines = Number(options.maxLines) || 0;
  setReportFont(context, {
    size,
    weight: options.weight,
    family: options.family,
  });
  context.fillStyle = color;
  context.textAlign = align;
  const lines = maxLines > 0
    ? truncateReportText(context, options.text, maxWidth, maxLines)
    : wrapReportText(context, options.text, maxWidth);
  lines.forEach((line, index) => {
    const drawX = align === "center" ? x + maxWidth / 2 : align === "right" ? x + maxWidth : x;
    context.fillText(line, drawX, y + index * lineHeight);
  });
  context.textAlign = "left";
  return {
    lines,
    height: lines.length * lineHeight,
    lineHeight,
  };
}

export function drawRoundedRect(context, x, y, width, height, radius = 24, options = {}) {
  const safeRadius = Math.max(0, Math.min(Number(radius) || 0, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
  if (options.fill) {
    context.fillStyle = options.fill;
    context.fill();
  }
  if (options.stroke) {
    context.strokeStyle = options.stroke;
    context.lineWidth = Number(options.lineWidth) || 1;
    context.stroke();
  }
}

export function drawDivider(context, x, y, width, options = {}) {
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.strokeStyle = String(options.color || "#cbd5e1");
  context.lineWidth = Number(options.lineWidth) || 1;
  context.stroke();
}

export function drawPill(context, options = {}) {
  const x = Number(options.x) || 0;
  const y = Number(options.y) || 0;
  const width = Number(options.width) || 180;
  const height = Number(options.height) || 34;
  const radius = Number.isFinite(Number(options.radius)) ? Number(options.radius) : height / 2;
  drawRoundedRect(context, x, y, width, height, radius, {
    fill: options.fill || "#eff6ff",
    stroke: options.stroke || "transparent",
    lineWidth: options.lineWidth || 1,
  });
  drawTextBlock(context, {
    text: options.text || "",
    x,
    y: y + Math.max((height - (Number(options.size) || 14)) / 2 - 2, 6),
    maxWidth: width,
    size: options.size || 14,
    weight: options.weight || 700,
    color: options.color || "#1d4ed8",
    align: "center",
    maxLines: 1,
  });
}

export function drawDonutChart(context, options = {}) {
  const centerX = Number(options.centerX) || 0;
  const centerY = Number(options.centerY) || 0;
  const radius = Number(options.radius) || 80;
  const thickness = Number(options.thickness) || 18;
  const startAngle = Number.isFinite(options.startAngle) ? Number(options.startAngle) : -Math.PI / 2;
  const trackColor = String(options.trackColor || "#e2e8f0");
  const segments = Array.isArray(options.segments) ? options.segments : [];

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.strokeStyle = trackColor;
  context.lineWidth = thickness;
  context.stroke();

  let cursor = startAngle;
  segments.forEach((segment) => {
    const value = Math.max(0, Math.min(1, Number(segment?.value) || 0));
    if (value <= 0) return;
    const angle = value * Math.PI * 2;
    context.beginPath();
    context.arc(centerX, centerY, radius, cursor, cursor + angle);
    context.strokeStyle = String(segment?.color || "#1f7a8c");
    context.lineWidth = thickness;
    context.lineCap = "round";
    context.stroke();
    cursor += angle;
  });

  if (options.valueLabel) {
    drawTextBlock(context, {
      text: options.valueLabel,
      x: centerX - radius + 20,
      y: centerY - 26,
      maxWidth: radius * 2 - 40,
      size: options.valueSize || 42,
      weight: options.valueWeight || 700,
      color: options.valueColor || "#0f172a",
      align: "center",
      maxLines: 1,
    });
  }
  if (options.caption) {
    drawTextBlock(context, {
      text: options.caption,
      x: centerX - radius + 18,
      y: centerY + 22,
      maxWidth: radius * 2 - 36,
      size: options.captionSize || 14,
      weight: options.captionWeight || 500,
      color: options.captionColor || "#64748b",
      align: "center",
      maxLines: 2,
      lineHeight: options.captionLineHeight || 18,
    });
  }
}

export async function loadReportImage(url) {
  const source = String(url || "").trim();
  if (!source || typeof window === "undefined" || typeof fetch !== "function") {
    return null;
  }

  let objectUrl = "";
  try {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Image request failed with status ${response.status}`);
    }
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    await new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to decode image"));
      image.src = objectUrl;
    });
    image.__reportObjectUrl = objectUrl;
    return image;
  } catch (error) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    return null;
  }
}

export function releaseReportImage(image) {
  const objectUrl = image?.__reportObjectUrl;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getReportInitials(value) {
  const text = String(value || "").trim();
  if (!text) return "HB";
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
