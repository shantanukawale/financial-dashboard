import React, { createContext, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'financial-dashboard-currency';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
];

function getCurrencySymbol(currencyCode) {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

/**
 * INR ≥ ₹1 crore: integer crores (no commas) + "," + remainder in fixed XX,XX,XXX
 * (e.g. 20000000 → 2,00,00,000; 200000000000 → 20000,00,00,000).
 */
function formatINRFromCroresUp(absRounded) {
  const crores = Math.floor(absRounded / 1e7);
  const rem = absRounded % 1e7;
  const remStr = String(rem).padStart(7, '0');
  const remGrouped = `${remStr.slice(0, 2)},${remStr.slice(2, 4)},${remStr.slice(4, 7)}`;
  return `${String(crores)},${remGrouped}`;
}

/** Formatted value for money text inputs when not focused. */
export function formatMoneyInputDisplay(value, currencyCode) {
  const r = Math.round(Number(value));
  if (!Number.isFinite(r)) return '';
  if (r === 0) return '0';

  if (currencyCode === 'INR') {
    if (Math.abs(r) >= 1e7) {
      const sign = r < 0 ? '-' : '';
      return sign + formatINRFromCroresUp(Math.abs(r));
    }
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(r);
  }

  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(r);
}

/**
 * Parse money text input.
 * INR: optional "Cr" suffix → value is crores × 1e7.
 */
export function parseMoneyInput(draft, currencyCode) {
  const raw = String(draft).trim();
  if (!raw) return NaN;

  if (currencyCode === 'INR') {
    const croreSuffix = /\s*Cr\s*$/i;
    const hadCrSuffix = croreSuffix.test(raw);
    let s = raw.replace(croreSuffix, '').replace(/,/g, '').trim();
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return NaN;
    if (hadCrSuffix) {
      return Math.round(n * 1e7);
    }
    return Math.round(n);
  }

  const s = raw.replace(/,/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

/** Compact money: INR uses Lakh / Crore; all others use K / M / B. */
export function formatCompactMoney(value, currencyCode) {
  const sym = getCurrencySymbol(currencyCode);
  const n = Number(value);
  if (!Number.isFinite(n)) return `${sym} —`;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (currencyCode === 'INR') {
    if (abs >= 1e7) return `${sign}${sym}${(abs / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `${sign}${sym}${(abs / 1e5).toFixed(2)} L`;
    const formatted = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: abs >= 1 ? 0 : 2,
    }).format(abs);
    return `${sign}${sym}${formatted}`;
  }

  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(2)}K`;
  const decimals = abs >= 1 && Number.isInteger(n) ? 0 : 2;
  return `${sign}${sym}${abs.toFixed(decimals)}`;
}

/** Scale for chart Y values (single numeric series). */
export function getChartMoneyScale(currencyCode) {
  if (currencyCode === 'INR') {
    return { divisor: 1e7, unitLabel: 'Crores' };
  }
  return { divisor: 1e6, unitLabel: 'Millions' };
}

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED_CURRENCIES.some((c) => c.code === saved)) return saved;
    } catch {
      /* ignore */
    }
    return 'INR';
  });

  const setCurrency = (code) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      formatMoney: (amount) => formatCompactMoney(amount, currency),
      formatMoneyInputDisplay: (amount) => formatMoneyInputDisplay(amount, currency),
      parseMoneyInput: (draft) => parseMoneyInput(draft, currency),
      chartScale: getChartMoneyScale(currency),
      currencySymbol: getCurrencySymbol(currency),
    }),
    [currency]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
