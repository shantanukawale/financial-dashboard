/** Frankfurter public API — use api.frankfurter.dev (api.frankfurter.app 301s without CORS, which breaks browser fetch). */
const FRANKFURTER_LATEST = 'https://api.frankfurter.dev/v1/latest';

/**
 * @param {string[]} supportedCodes e.g. ['INR','USD',...]
 * @returns {Promise<{ date: string, ratesUsd: Record<string, number> }>}
 */
export async function fetchUsdQuotedRates(supportedCodes) {
  const codes = [...new Set(supportedCodes.map((c) => String(c).toUpperCase()))];
  if (!codes.includes('USD')) {
    throw new Error('fetchUsdQuotedRates: USD must be in supportedCodes');
  }
  const targets = codes.filter((c) => c !== 'USD').join(',');
  const qs = new URLSearchParams({ from: 'USD', to: targets });
  const url = `${FRANKFURTER_LATEST}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Exchange rate request failed (${res.status})`);
  }
  const data = await res.json();
  return normalizeFrankfurterUsdResponse(data);
}

/** @param {{ date?: string, rates?: Record<string, number> }} data */
export function normalizeFrankfurterUsdResponse(data) {
  const date = data?.date ?? '';
  const rates = data?.rates && typeof data.rates === 'object' ? data.rates : {};
  const ratesUsd = { USD: 1 };
  for (const [code, rate] of Object.entries(rates)) {
    const n = Number(rate);
    if (Number.isFinite(n) && n > 0) {
      ratesUsd[String(code).toUpperCase()] = n;
    }
  }
  return { date, ratesUsd };
}

/**
 * Convert a whole amount between currencies using Frankfurter-style rates:
 * `ratesUsd[X]` = how many units of X you get for 1 USD.
 */
export function convertAmountRounded(amount, from, to, ratesUsd) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const f = String(from).toUpperCase();
  const t = String(to).toUpperCase();
  if (f === t) return Math.round(n);
  const rf = ratesUsd[f];
  const rt = ratesUsd[t];
  if (!(Number(rf) > 0) || !(Number(rt) > 0)) return Math.round(n);
  const inUsd = f === 'USD' ? n : n / rf;
  const out = t === 'USD' ? inUsd : inUsd * rt;
  return Math.round(out);
}
