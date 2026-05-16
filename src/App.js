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
    <header className="w-full border-b border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-wrap items-start justify-between gap-3 px-4 py-3 sm:items-center">
        <h1 className="text-xl font-bold text-slate-900">Financial Projection Dashboard</h1>
        <div className="flex min-w-0 flex-col items-stretch gap-1.5 sm:items-end">
          {ratesStatus === 'loading' && (
            <span className="max-w-xs text-right text-xs text-slate-500 sm:max-w-md">
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
                  className="shrink-0 rounded border border-red-300 bg-white px-2 py-0.5 font-medium text-red-800 hover:bg-red-50"
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
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
      <div className="App min-h-screen bg-slate-100 pb-8">
        <CurrencyBar />
        <div className="pt-6">
          <FinancialProjectionDashboard />
        </div>
      </div>
    </CurrencyProvider>
  );
}

export default App;
