/** Stored as decimals in app state; edited as whole-number percents in the UI. */
export const RATE_FIELD_NAMES = new Set(['incomeGrowthRate', 'expenseGrowthRate', 'xirr', 'inflationRate']);

export function decimalRateToWholePercent(decimal) {
  const n = Number(decimal);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function wholePercentToDecimal(whole) {
  const n = Math.round(Number(whole));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n / 100;
}

/**
 * Strip leading zeros from typed whole-number percents (e.g. "012" → "12").
 * Keeps a single "0" when the value is only zeros. Empty / minus unchanged.
 */
export function normalizeRatePercentInputValue(value) {
  const s = String(value).trim();
  if (s === '' || s === '-') return s;
  if (/^0+$/.test(s)) return '0';
  const trimmed = s.replace(/^0+(?=\d)/, '');
  return trimmed === '' ? '0' : trimmed;
}

/** Canonical whole-percent string for controlled text inputs (no leading zeros). */
export function formatRatePercentForInput(decimal) {
  return String(decimalRateToWholePercent(decimal));
}
