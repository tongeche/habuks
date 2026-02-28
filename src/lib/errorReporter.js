import { isSupabaseConfigured, supabase } from "./supabase.js";

const TABLE_NAME = "app_error_events";
const MAX_QUEUE_SIZE = 50;
const MAX_BATCH_SIZE = 10;
const DEDUPE_WINDOW_MS = 5000;

let started = false;
let disabled = false;
let flushTimer = null;
let flushing = false;
let authSubscription = null;

const queue = [];
const recentSignatures = new Map();

const trimText = (value, max = 2000) => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, max);
};

const toJsonSafe = (value) => {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return trimText(value, 4000) || null;
  }
};

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );

const toMemberId = (value) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildSignature = (row) =>
  [row.level, row.area, row.action, row.code, row.message, row.page_path].map((item) => item || "").join("|");

const isDuplicate = (signature) => {
  const now = Date.now();
  for (const [key, time] of recentSignatures.entries()) {
    if (now - time > DEDUPE_WINDOW_MS) {
      recentSignatures.delete(key);
    }
  }
  const previous = recentSignatures.get(signature);
  if (previous && now - previous < DEDUPE_WINDOW_MS) {
    return true;
  }
  recentSignatures.set(signature, now);
  return false;
};

const getPagePath = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname || ""}${window.location.search || ""}${window.location.hash || ""}`;
};

const buildDetails = (detail, context) => {
  const payload = {
    time: detail?.time || new Date().toISOString(),
    name: trimText(detail?.name, 200),
    hint: trimText(detail?.hint, 1000),
    rawDetails: toJsonSafe(detail?.details),
    stack: trimText(detail?.stack, 12000),
    context: toJsonSafe(context),
  };

  if (typeof window !== "undefined") {
    payload.href = window.location.href;
    payload.userAgent = navigator.userAgent;
    payload.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return payload;
};

const normalizeDetailToRow = (detail = {}) => {
  const context = detail?.context && typeof detail.context === "object" ? detail.context : {};
  const row = {
    tenant_id: isUuid(context.tenantId) ? String(context.tenantId).trim() : null,
    member_id: toMemberId(context.memberId ?? context.userId),
    level: trimText(detail?.level || "error", 32) || "error",
    area: trimText(context.area, 120) || null,
    action: trimText(context.action, 160) || null,
    code: trimText(detail?.code, 120) || null,
    message: trimText(detail?.message || "Unknown application error"),
    page_path: trimText(getPagePath(), 500) || null,
    details: buildDetails(detail, context),
  };

  return row.message ? row : null;
};

const scheduleFlush = (delay = 1200) => {
  if (disabled || flushTimer || !queue.length) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delay);
};

const handleInsertFailure = (error) => {
  const message = String(error?.message || "").toLowerCase();
  if (
    error?.code === "42P01" ||
    (message.includes("relation") && message.includes(TABLE_NAME)) ||
    message.includes("does not exist")
  ) {
    disabled = true;
    console.warn(`[HabuksErrorReporter] Disabled: ${TABLE_NAME} table is not available yet.`);
    return;
  }

  console.warn("[HabuksErrorReporter] Failed to store app errors.", error);
};

const flushQueue = async () => {
  if (disabled || flushing || !queue.length || !isSupabaseConfigured || !supabase) return;

  flushing = true;
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn("[HabuksErrorReporter] Session check failed.", sessionError);
      return;
    }

    if (!session?.access_token) {
      return;
    }

    const batch = queue.splice(0, MAX_BATCH_SIZE);
    if (!batch.length) return;

    const { error } = await supabase.from(TABLE_NAME).insert(batch);
    if (error) {
      handleInsertFailure(error);
    }
  } finally {
    flushing = false;
    if (queue.length && !disabled) {
      scheduleFlush(400);
    }
  }
};

const enqueueDetail = (detail) => {
  if (disabled || typeof window === "undefined") return;
  const row = normalizeDetailToRow(detail);
  if (!row) return;

  const signature = buildSignature(row);
  if (isDuplicate(signature)) return;

  queue.push(row);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  scheduleFlush();
};

const handleAppErrorEvent = (event) => {
  enqueueDetail(event?.detail || {});
};

const handleWindowError = (event) => {
  enqueueDetail({
    level: "error",
    time: new Date().toISOString(),
    message: event?.message || event?.error?.message || "Unhandled window error",
    name: event?.error?.name || "WindowError",
    stack: event?.error?.stack || null,
    details: {
      filename: event?.filename || null,
      lineno: event?.lineno || null,
      colno: event?.colno || null,
    },
    context: {
      area: "client",
      action: "window_error",
    },
  });
};

const handleUnhandledRejection = (event) => {
  const reason = event?.reason;
  enqueueDetail({
    level: "error",
    time: new Date().toISOString(),
    message:
      (typeof reason === "string" ? reason : reason?.message) || "Unhandled promise rejection",
    name: reason?.name || "UnhandledRejection",
    code: reason?.code || null,
    stack: reason?.stack || null,
    details: typeof reason === "object" ? reason : { reason },
    context: {
      area: "client",
      action: "unhandled_rejection",
    },
  });
};

export const startErrorReporter = () => {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("habuks:error", handleAppErrorEvent);
  window.addEventListener("error", handleWindowError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  if (isSupabaseConfigured && supabase) {
    const subscription = supabase.auth.onAuthStateChange(() => {
      if (queue.length) {
        scheduleFlush(200);
      }
    });
    authSubscription = subscription?.data?.subscription || null;
  }
};

export const stopErrorReporter = () => {
  if (!started || typeof window === "undefined") return;
  started = false;

  window.removeEventListener("habuks:error", handleAppErrorEvent);
  window.removeEventListener("error", handleWindowError);
  window.removeEventListener("unhandledrejection", handleUnhandledRejection);

  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (authSubscription) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }
};
