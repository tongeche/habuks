const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidProjectId = (value) => UUID_PATTERN.test(String(value || "").trim());

export const normalizeProjectId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isUuidProjectId(raw)) return raw.toLowerCase();
  if (/^\d+$/.test(raw)) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return String(parsed);
    }
  }
  return "";
};

export const normalizeProjectIdList = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }
  return Array.from(
    new Set(
      values
        .map((value) => normalizeProjectId(value))
        .filter(Boolean)
    )
  );
};

