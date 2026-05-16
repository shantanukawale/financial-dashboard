import React from 'react';
import FinancialProjectionDashboard from './FinancialProjectionDashboard';
import { CurrencyProvider, SUPPORTED_CURRENCIES, useCurrency } from './CurrencyContext';

function CurrencyBar() {
  const { currency, setCurrency } = useCurrency();

  return (
    <header className="w-full border-b border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-4xl justify-end px-4 py-3">
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
