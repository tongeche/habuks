export const DEFAULT_CURRENCY_CODE = "KES";
export const DEFAULT_CURRENCY_LOCALE = "en-KE";

const COMMON_CURRENCY_LABELS = {
  KES: "Kenyan Shilling",
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  UGX: "Ugandan Shilling",
  TZS: "Tanzanian Shilling",
  RWF: "Rwandan Franc",
  NGN: "Nigerian Naira",
  ZAR: "South African Rand",
  INR: "Indian Rupee",
};

export const COMMON_CURRENCY_OPTIONS = Object.entries(COMMON_CURRENCY_LABELS).map(
  ([value, label]) => ({
    value,
    label: `${label} (${value})`,
  })
);

export const normalizeCurrencyCode = (value, fallback = DEFAULT_CURRENCY_CODE) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  const fallbackCode = String(fallback || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(fallbackCode) ? fallbackCode : DEFAULT_CURRENCY_CODE;
};

const createNumberFormatter = (options = {}) => {
  const { locale = DEFAULT_CURRENCY_LOCALE, ...formatterOptions } = options;
  return new Intl.NumberFormat(locale, formatterOptions);
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const formatAmountNumber = (value, options = {}) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return options.fallback ?? "0";
  }

  return createNumberFormatter({
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    locale: options.locale,
  }).format(parsed);
};

export const formatCurrencyAmount = (value, options = {}) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return options.fallback ?? "—";
  }

  const currencyCode = normalizeCurrencyCode(options.currencyCode);
  const formatterOptions = {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: options.currencyDisplay ?? "code",
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    locale: options.locale,
  };

  return createNumberFormatter(formatterOptions).format(
    options.absolute ? Math.abs(parsed) : parsed
  );
};

export const formatCompactCurrencyAmount = (value, options = {}) => {
  const parsed = toFiniteNumber(value);
  if (!Number.isFinite(parsed)) {
    return options.fallback ?? "—";
  }

  const currencyCode = normalizeCurrencyCode(options.currencyCode);
  return createNumberFormatter({
    style: "currency",
    currency: currencyCode,
    currencyDisplay: options.currencyDisplay ?? "code",
    notation: "compact",
    compactDisplay: "short",
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    locale: options.locale,
  }).format(options.absolute ? Math.abs(parsed) : parsed);
};

export const formatCurrencyFieldLabel = (label, currencyCode) =>
  `${String(label || "").trim() || "Amount"} (${normalizeCurrencyCode(currencyCode)})`;

export const getCurrencyOptionLabel = (currencyCode) => {
  const normalized = normalizeCurrencyCode(currencyCode);
  const label = COMMON_CURRENCY_LABELS[normalized];
  return label ? `${label} (${normalized})` : normalized;
};
