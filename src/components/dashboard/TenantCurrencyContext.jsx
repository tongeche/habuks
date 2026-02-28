import { createContext, useContext } from "react";
import {
  DEFAULT_CURRENCY_CODE,
  formatAmountNumber,
  formatCompactCurrencyAmount,
  formatCurrencyAmount,
  formatCurrencyFieldLabel,
  normalizeCurrencyCode,
} from "../../lib/currency.js";

const defaultContextValue = {
  currencyCode: DEFAULT_CURRENCY_CODE,
  formatCurrency: (value, options = {}) => formatCurrencyAmount(value, options),
  formatCompactCurrency: (value, options = {}) =>
    formatCompactCurrencyAmount(value, options),
  formatNumber: (value, options = {}) => formatAmountNumber(value, options),
  formatFieldLabel: (label) => formatCurrencyFieldLabel(label, DEFAULT_CURRENCY_CODE),
};

const TenantCurrencyContext = createContext(defaultContextValue);

export function TenantCurrencyProvider({ tenant, children }) {
  const currencyCode = normalizeCurrencyCode(tenant?.currency_code);

  return (
    <TenantCurrencyContext.Provider
      value={{
        currencyCode,
        formatCurrency: (value, options = {}) =>
          formatCurrencyAmount(value, { currencyCode, ...options }),
        formatCompactCurrency: (value, options = {}) =>
          formatCompactCurrencyAmount(value, { currencyCode, ...options }),
        formatNumber: (value, options = {}) => formatAmountNumber(value, options),
        formatFieldLabel: (label) => formatCurrencyFieldLabel(label, currencyCode),
      }}
    >
      {children}
    </TenantCurrencyContext.Provider>
  );
}

export const useTenantCurrency = () => useContext(TenantCurrencyContext);
