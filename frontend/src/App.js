import React from 'react';
import FinancialProjectionDashboard from './FinancialProjectionDashboard';
import { CurrencyProvider, SUPPORTED_CURRENCIES, useCurrency } from './CurrencyContext';

function CurrencyBar() {
  const {
    currency,
    setCurrency,
    ratesStatus,
    ratesDate,
    ratesError,
    refreshRates,
  } = useCurrency();

  return (
    <header className="relative w-full border-b border-teal-200/40 bg-white/70 shadow-sm shadow-teal-900/5 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
      <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-3 px-4 py-4 sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={`${process.env.PUBLIC_URL}/favicon.svg`}
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 rounded-md border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5 sm:h-10 sm:w-10"
            decoding="async"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700/90">Projection</p>
            <h1 className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-800 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
              Financial Projection Dashboard
            </h1>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:items-end">
          {ratesStatus === 'loading' && (
            <span className="max-w-xs text-right text-xs text-slate-600 sm:max-w-md">
              Loading exchange rates… You can change currency; amounts convert after rates load.
            </span>
          )}
          {ratesStatus === 'error' && (
            <div className="flex max-w-xs flex-col items-end gap-1 text-right text-xs sm:max-w-md">
              <div className="flex flex-col items-end gap-1 text-red-700 sm:flex-row sm:items-center sm:gap-2">
                <span className="break-words">{ratesError}</span>
                <button
                  type="button"
                  onClick={refreshRates}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
                >
                  Retry
                </button>
              </div>
              <span className="text-amber-800">
                You can still change currency; amounts are not converted until rates load.
              </span>
            </div>
          )}
          {ratesStatus === 'ready' && ratesDate && (
            <span
              className="text-right text-xs text-slate-500"
              title="Reference rates from the European Central Bank, published by Frankfurter. Updated on business days."
            >
              FX rates (ECB): {ratesDate}
            </span>
          )}
          <select
            aria-label="Currency"
            className="rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 shadow-sm ring-1 ring-slate-900/5 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <CurrencyProvider>
      <div className="App min-h-screen bg-slate-50 bg-mesh-page pb-10">
        <CurrencyBar />
        <div className="pt-8">
          <FinancialProjectionDashboard />
        </div>
      </div>
    </CurrencyProvider>
  );
}

export default App;
