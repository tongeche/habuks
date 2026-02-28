const TECHNICAL_TERMS = [
  "supabase",
  "rls",
  "row-level security",
  "policy",
  "migration",
  "schema",
  "column",
  "relation",
  "postgres",
  "sql",
  "rpc",
  "bucket",
  "storage",
  "auth_id",
  "constraint",
];

const includesAny = (value, terms) => terms.some((term) => value.includes(term));

export const getErrorMessage = (error) => {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  return String(error?.message || error?.details || error?.hint || "").trim();
};

const isLikelyTechnicalMessage = (message) => {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;
  return includesAny(normalized, TECHNICAL_TERMS);
};

const toActionLabel = (value, fallback = "complete that action") => {
  const label = String(value || "").trim();
  return label || fallback;
};

export const reportAppError = (error, context = {}) => {
  const payload = {
    time: new Date().toISOString(),
    context,
    message: getErrorMessage(error),
    code: error?.code || error?.status || error?.statusCode || null,
    details: error?.details || null,
    hint: error?.hint || null,
  };

  console.error("[HabuksAppError]", payload, error);

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("habuks:error", { detail: payload }));
  }

  return payload;
};

export const createFriendlyErrorModalData = (error, options = {}) => {
  const rawMessage = getErrorMessage(error);
  const normalizedMessage = rawMessage.toLowerCase();
  const normalizedCode = String(error?.code || error?.status || error?.statusCode || "").toLowerCase();
  const actionLabel = toActionLabel(options.actionLabel);
  const fallbackMessage = String(options.fallbackMessage || "").trim();
  const fallbackTitle = String(options.fallbackTitle || "").trim();

  const isPermissionError =
    normalizedCode === "42501" ||
    includesAny(normalizedMessage, [
      "row-level security",
      "rls",
      "permission denied",
      "not authorized",
      "not allowed",
      "forbidden",
      "insufficient privilege",
      "policy",
    ]);

  const isSetupError =
    includesAny(normalizedMessage, ["supabase not configured", "not configured"]) ||
    includesAny(normalizedMessage, ["migration", "schema", "relation", "column"]);

  const isNetworkError = includesAny(normalizedMessage, [
    "failed to fetch",
    "network",
    "fetcherror",
    "network request failed",
    "load failed",
    "timeout",
  ]);

  const isUploadError = includesAny(normalizedMessage, ["upload", "storage", "bucket", "file"]);

  if (isPermissionError) {
    return {
      type: "error",
      title: fallbackTitle || "Access issue",
      message: `We couldn't ${actionLabel} because this account does not currently have access to that data. Your information is safe. Please try again, or ask a workspace admin to review your access.`,
      code: null,
    };
  }

  if (isSetupError) {
    return {
      type: "error",
      title: fallbackTitle || "Workspace setup issue",
      message: `We couldn't ${actionLabel} because this workspace is missing part of its setup. Please try again later while the team reviews the configuration.`,
      code: null,
    };
  }

  if (isNetworkError) {
    return {
      type: "error",
      title: fallbackTitle || "Connection problem",
      message: `We couldn't ${actionLabel} because the connection was interrupted. Check your internet connection and try again.`,
      code: null,
    };
  }

  if (isUploadError) {
    return {
      type: "error",
      title: fallbackTitle || "Upload problem",
      message: `We couldn't ${actionLabel} because a file upload did not finish. Please try again in a moment.`,
      code: null,
    };
  }

  if (rawMessage && !isLikelyTechnicalMessage(rawMessage) && rawMessage.length <= 180) {
    return {
      type: "error",
      title: fallbackTitle || "Something went wrong",
      message: rawMessage,
      code: null,
    };
  }

  return {
    type: "error",
    title: fallbackTitle || "Something went wrong",
    message:
      fallbackMessage || `We couldn't ${actionLabel} right now. Please try again in a moment.`,
    code: null,
  };
};

export const presentAppError = (error, options = {}) => {
  reportAppError(error, options.context);
  return createFriendlyErrorModalData(error, options);
};
