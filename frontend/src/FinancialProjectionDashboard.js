import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import classNames from 'classnames';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { useCurrency } from './CurrencyContext';
import { convertAmountRounded } from './exchangeRates';
import { normalizeRatePercentInputValue, wholePercentToDecimal, formatRatePercentForInput } from './rateFieldUtils';

const MONEY_FIELD_NAMES = new Set([
  'initialPortfolio',
  'initialExpenses',
  'targetValue',
  'initialPostTaxIncome',
]);

const PROJECTION_TABLE_COLUMNS = [
  'Year',
  'Portfolio Value',
  'Annual Growth',
  'Annual Investment',
  'Annual Income',
  'Annual Expenses',
];

/** Help copy for each field — shown when the small info icon is hovered or focused. */
const FIELD_TOOLTIPS = {
  initialPortfolio:
    'Total portfolio value at the start (year 0): cash plus investments before the projection runs.',
  initialPostTaxIncome:
    'Take-home income in year 0 after taxes. Together with expenses, this sets how much you can invest each year.',
  initialExpenses:
    'Total annual spending in year 0. Investment each year is post-tax income minus expenses.',
  incomeGrowthRate:
    'Expected yearly increase in take-home pay, as a whole percent (e.g. 13 means 13% per year).',
  expenseGrowthRate:
    'Expected yearly increase in spending, as a whole percent (e.g. 5 means 5% per year).',
  xirr:
    'Expected annual portfolio return, as a whole percent (e.g. 25 means 25% per year).',
  targetValue:
    'Portfolio value you are aiming for. The model runs year by year until your portfolio first reaches or passes this amount.',
  inflationRate:
    'Expected yearly inflation as a whole percent (e.g. 6 means 6%). Used only when "Adjust for inflation" is on.',
  adjustForInflation:
    'When enabled, portfolio return is reduced by inflation and income growth is interpreted in inflation-adjusted terms.',
  calculateProjection:
    'Run the simulation with the numbers above and show years to target, charts, and the year-by-year table.',
};

/** Count decimal digits strictly to the left of `index` in `str`. */
function countDigitsBeforeIndex(str, index) {
  const end = Math.min(Math.max(0, index), str.length);
  let n = 0;
  for (let i = 0; i < end; i += 1) {
    const ch = str[i];
    if (ch >= '0' && ch <= '9') n += 1;
  }
  return n;
}

/** Caret position in `str` after `digitCount` digits (0 → start). */
function indexAfterDigitCount(str, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch >= '0' && ch <= '9') {
      seen += 1;
      if (seen >= digitCount) return i + 1;
    }
  }
  return str.length;
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, annotationPlugin);


// Custom components to replace the imported ones
const Card = ({ className, children }) => (
  <div
    className={classNames(
      'overflow-visible rounded-2xl border border-white/70 bg-white/85 shadow-soft ring-1 ring-slate-900/[0.04] backdrop-blur-sm',
      className,
    )}
  >
    {children}
  </div>
);

const CardContent = ({ children, className }) => (
  <div className={classNames('p-5 sm:p-6', className)}>{children}</div>
);

const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={classNames(
      'w-full rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-slate-900 shadow-inner shadow-slate-200/40 transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Button = ({ className, ...props }) => (
  <button
    className={classNames(
      'rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-700/25 transition hover:from-teal-500 hover:to-emerald-500 hover:shadow-lg hover:shadow-teal-600/30 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:ring-offset-2 active:scale-[0.99]',
      className,
    )}
    {...props}
  />
);

const Label = ({ htmlFor, children, className }) => (
  <label htmlFor={htmlFor} className={classNames('mb-0 block text-sm font-medium text-slate-600', className)}>
    {children}
  </label>
);

/** Small “i” control; tooltip shows only when hovering or focusing this icon. */
function InfoHint({ text, label, className }) {
  return (
    <span className={classNames('group/hint relative inline-flex shrink-0', className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-teal-300/80 bg-teal-50 text-[10px] font-semibold italic leading-none text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-1"
        aria-label={label}
      >
        i
      </button>
      <p
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-[100] mt-1.5 w-64 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-700/80 bg-slate-900/95 px-3 py-2.5 text-left text-xs font-normal not-italic leading-snug text-slate-100 shadow-glow opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100"
      >
        {text}
      </p>
    </span>
  );
}

/** Pure projection timeline from current numeric params (same model as the Calculate button). */
function computeProjectionData(params) {
  let years = 0;
  let portfolio = params.initialPortfolio;
  const projectionData = [
    {
      year: 0,
      portfolio,
      growth: 0,
      investment: 0,
      expenses: params.initialExpenses,
      income: params.initialPostTaxIncome,
    },
  ];

  const adjustedXIRR = params.adjustForInflation ? params.xirr - params.inflationRate : params.xirr;
  const adjustedIncomeGrowthRate = params.adjustForInflation
    ? (1 + params.incomeGrowthRate) / (1 + params.inflationRate) - 1
    : params.incomeGrowthRate;

  while (portfolio < params.targetValue) {
    const postTaxIncome = params.initialPostTaxIncome * Math.pow(1 + adjustedIncomeGrowthRate, years);
    const expenses = params.initialExpenses * Math.pow(1 + params.expenseGrowthRate, years);
    const investment = postTaxIncome - expenses;
    const previousPortfolio = portfolio;
    portfolio = portfolio * (1 + adjustedXIRR) + investment;
    years += 1;

    projectionData.push({
      year: years,
      portfolio: Math.round(portfolio),
      growth: Math.round(portfolio - previousPortfolio),
      investment: Math.round(investment),
      expenses: Math.round(expenses),
      income: Math.round(postTaxIncome),
    });
  }

  return projectionData;
}

const FinancialProjectionDashboard = () => {
  const {
    currency,
    formatMoney,
    formatMoneyInputDisplay,
    parseMoneyInput,
    chartScale,
    ratesUsd,
    ratesStatus,
  } = useCurrency();

  const [moneyFocus, setMoneyFocus] = useState(null);
  const moneyFieldRefs = useRef({});
  const moneyCursorRef = useRef(null);

  useEffect(() => {
    setMoneyFocus(null);
  }, [currency]);

  useLayoutEffect(() => {
    const meta = moneyCursorRef.current;
    if (!meta || !moneyFocus || moneyFocus.field !== meta.field) return;
    moneyCursorRef.current = null;
    const el = moneyFieldRefs.current[moneyFocus.field];
    if (!el || document.activeElement !== el) return;
    const formatted =
      moneyFocus.digits === ''
        ? ''
        : formatMoneyInputDisplay(Number(moneyFocus.digits));
    const pos = indexAfterDigitCount(formatted, meta.digitCountBefore);
    el.setSelectionRange(pos, pos);
  }, [moneyFocus, formatMoneyInputDisplay]);

  const [params, setParams] = useState({
    initialPortfolio: 20000000,
    initialExpenses: 1200000,
    incomeGrowthRate: 0.1,
    expenseGrowthRate: 0.05,
    xirr: 0.15,
    targetValue: 8000000000,
    initialPostTaxIncome: 6500000,
    inflationRate: 0.06,
    adjustForInflation: false,
  });

  const [results, setResults] = useState([]);
  const prevCurrencyRef = useRef(currency);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    if (ratesStatus !== 'ready' || !ratesUsd) {
      prevCurrencyRef.current = currency;
      return;
    }
    const prev = prevCurrencyRef.current;
    if (prev === currency) return;

    const hadProjection = resultsRef.current.length > 0;
    const p = paramsRef.current;
    const next = { ...p };
    for (const name of MONEY_FIELD_NAMES) {
      next[name] = convertAmountRounded(p[name], prev, currency, ratesUsd);
    }

    setParams(next);
    setResults(hadProjection ? computeProjectionData(next) : []);
    prevCurrencyRef.current = currency;
  }, [currency, ratesUsd, ratesStatus]);

  const handleInputChange = (e) => {
    const { name, type, checked } = e.target;
    if (type === 'checkbox') {
      setParams((prev) => ({ ...prev, [name]: checked }));
    }
  };

  const handleRateInputChange = (e) => {
    const { name, value } = e.target;
    const digits = value.replace(/\D/g, '');
    if (digits === '') {
      setParams((prev) => ({ ...prev, [name]: 0 }));
      return;
    }
    const cleaned = normalizeRatePercentInputValue(digits);
    const whole = Math.max(0, parseInt(cleaned, 10) || 0);
    setParams((prev) => ({ ...prev, [name]: wholePercentToDecimal(whole) }));
  };

  const displayMoneyField = (name) => {
    if (moneyFocus?.field === name) {
      if (moneyFocus.digits === '') return '';
      const n = Number(moneyFocus.digits);
      if (!Number.isFinite(n)) return '';
      return formatMoneyInputDisplay(n);
    }
    return formatMoneyInputDisplay(params[name]);
  };

  const handleMoneyFocus = (name) => {
    if (!MONEY_FIELD_NAMES.has(name)) return;
    const r = Math.round(Number(params[name])) || 0;
    const digits = String(r);
    setMoneyFocus({ field: name, digits });
    moneyCursorRef.current = {
      field: name,
      digitCountBefore: digits.length,
    };
  };

  const handleMoneyChange = (e) => {
    const { name, value } = e.target;
    const cursorPos = e.target.selectionStart ?? value.length;
    const digitCountBefore = countDigitsBeforeIndex(value, cursorPos);
    const newDigits = value.replace(/\D/g, '');
    moneyCursorRef.current = {
      field: name,
      digitCountBefore: Math.min(digitCountBefore, newDigits.length),
    };
    setMoneyFocus((prev) => {
      if (!prev || prev.field !== name) return prev;
      return { field: name, digits: newDigits };
    });
  };

  const handleMoneyBlur = (name) => {
    setMoneyFocus((prev) => {
      if (!prev || prev.field !== name) return prev;
      if (prev.digits === '') {
        return null;
      }
      const parsed = parseMoneyInput(prev.digits);
      if (Number.isFinite(parsed) && parsed >= 0) {
        setParams((p) => ({ ...p, [name]: parsed }));
      }
      return null;
    });
  };

  const calculateProjection = useCallback(() => {
    setResults(computeProjectionData(params));
  }, [params]);

  const { divisor: chartDivisor, unitLabel: chartUnitLabel } = chartScale;

  const chartData = useMemo(
    () => ({
      labels: results.map((row) => row.year),
      datasets: [
        {
          label: 'Portfolio Value',
          data: results.map((row) => row.portfolio / chartDivisor),
          borderColor: 'rgb(13 148 136)',
          backgroundColor: 'rgba(13, 148, 136, 0.08)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Annual Income',
          data: results.map((row) => row.income / chartDivisor),
          borderColor: 'rgb(99 102 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.06)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Annual Expenses',
          data: results.map((row) => row.expenses / chartDivisor),
          borderColor: 'rgb(217 119 6)',
          backgroundColor: 'rgba(217, 119, 6, 0.06)',
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    }),
    [results, chartDivisor]
  );

  const chartOptions = useMemo(() => {
    const targetScaled = params.targetValue / chartDivisor;
    const maxPortfolioScaled = results.length
      ? Math.max(...results.map((row) => row.portfolio / chartDivisor))
      : 0;
    const yMax = Math.max(targetScaled, maxPortfolioScaled) * 1.1;

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#475569',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 18,
            font: { size: 12, family: "'DM Sans', sans-serif" },
          },
        },
        title: {
          display: true,
          text: 'Financial Projection Over Time',
          color: '#0f172a',
          font: { size: 16, weight: '600', family: "'DM Sans', sans-serif" },
          padding: { bottom: 8 },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleFont: { size: 12, weight: '600', family: "'DM Sans', sans-serif" },
          bodyFont: { size: 12, family: "'DM Sans', sans-serif" },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label(ctx) {
              const y = ctx.parsed?.y;
              if (y == null || Number.isNaN(y)) return ctx.dataset.label ?? '';
              const raw = y * chartDivisor;
              return `${ctx.dataset.label}: ${formatMoney(raw)}`;
            },
          },
        },
        annotation: {
          annotations: {
            targetLine: {
              type: 'line',
              yMin: targetScaled,
              yMax: targetScaled,
              borderColor: 'rgb(225 29 72)',
              borderWidth: 2,
              borderDash: [8, 6],
              label: {
                display: true,
                content: 'Target Value',
                position: 'start',
                color: '#fff',
                backgroundColor: 'rgba(225, 29, 72, 0.92)',
                borderRadius: 6,
                padding: 6,
                font: { size: 11, weight: '600', family: "'DM Sans', sans-serif" },
              },
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: yMax || 1,
          grid: {
            color: 'rgba(148, 163, 184, 0.22)',
            drawBorder: false,
          },
          ticks: {
            color: '#64748b',
            font: { size: 11, family: "'DM Sans', sans-serif" },
          },
          title: {
            display: true,
            text: `Amount (${chartUnitLabel})`,
            color: '#475569',
            font: { size: 12, weight: '600', family: "'DM Sans', sans-serif" },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 11, family: "'DM Sans', sans-serif" },
          },
          title: {
            display: true,
            text: 'Year',
            color: '#475569',
            font: { size: 12, weight: '600', family: "'DM Sans', sans-serif" },
          },
        },
      },
    };
  }, [params.targetValue, results, chartDivisor, chartUnitLabel, formatMoney]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="overflow-visible">
        <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 overflow-visible">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="initialPortfolio" className="mb-0 min-w-0 flex-1">
                Initial Portfolio ({currency})
              </Label>
              <InfoHint
                text={FIELD_TOOLTIPS.initialPortfolio}
                label="Help: initial portfolio"
              />
            </div>
            <Input
              id="initialPortfolio"
              name="initialPortfolio"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={displayMoneyField('initialPortfolio')}
              ref={(el) => {
                moneyFieldRefs.current.initialPortfolio = el;
              }}
              onFocus={() => handleMoneyFocus('initialPortfolio')}
              onChange={handleMoneyChange}
              onBlur={() => handleMoneyBlur('initialPortfolio')}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="initialPostTaxIncome" className="mb-0 min-w-0 flex-1">
                Initial Post-Tax Income ({currency})
              </Label>
              <InfoHint
                text={FIELD_TOOLTIPS.initialPostTaxIncome}
                label="Help: initial post-tax income"
              />
            </div>
            <Input
              id="initialPostTaxIncome"
              name="initialPostTaxIncome"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={displayMoneyField('initialPostTaxIncome')}
              ref={(el) => {
                moneyFieldRefs.current.initialPostTaxIncome = el;
              }}
              onFocus={() => handleMoneyFocus('initialPostTaxIncome')}
              onChange={handleMoneyChange}
              onBlur={() => handleMoneyBlur('initialPostTaxIncome')}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="initialExpenses" className="mb-0 min-w-0 flex-1">
                Initial Expenses ({currency})
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.initialExpenses} label="Help: initial expenses" />
            </div>
            <Input
              id="initialExpenses"
              name="initialExpenses"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={displayMoneyField('initialExpenses')}
              ref={(el) => {
                moneyFieldRefs.current.initialExpenses = el;
              }}
              onFocus={() => handleMoneyFocus('initialExpenses')}
              onChange={handleMoneyChange}
              onBlur={() => handleMoneyBlur('initialExpenses')}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="incomeGrowthRate" className="mb-0 min-w-0 flex-1">
                Income Growth Rate (%)
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.incomeGrowthRate} label="Help: income growth rate" />
            </div>
            <Input
              id="incomeGrowthRate"
              name="incomeGrowthRate"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatRatePercentForInput(params.incomeGrowthRate)}
              onChange={handleRateInputChange}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="expenseGrowthRate" className="mb-0 min-w-0 flex-1">
                Expense Growth Rate (%)
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.expenseGrowthRate} label="Help: expense growth rate" />
            </div>
            <Input
              id="expenseGrowthRate"
              name="expenseGrowthRate"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatRatePercentForInput(params.expenseGrowthRate)}
              onChange={handleRateInputChange}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="xirr" className="mb-0 min-w-0 flex-1">
                XIRR (%)
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.xirr} label="Help: expected portfolio return (XIRR)" />
            </div>
            <Input
              id="xirr"
              name="xirr"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatRatePercentForInput(params.xirr)}
              onChange={handleRateInputChange}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="targetValue" className="mb-0 min-w-0 flex-1">
                Target Value ({currency})
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.targetValue} label="Help: target portfolio value" />
            </div>
            <Input
              id="targetValue"
              name="targetValue"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={displayMoneyField('targetValue')}
              ref={(el) => {
                moneyFieldRefs.current.targetValue = el;
              }}
              onFocus={() => handleMoneyFocus('targetValue')}
              onChange={handleMoneyChange}
              onBlur={() => handleMoneyBlur('targetValue')}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <Label htmlFor="inflationRate" className="mb-0 min-w-0 flex-1">
                Inflation Rate (%)
              </Label>
              <InfoHint text={FIELD_TOOLTIPS.inflationRate} label="Help: inflation rate" />
            </div>
            <Input
              id="inflationRate"
              name="inflationRate"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={formatRatePercentForInput(params.inflationRate)}
              onChange={handleRateInputChange}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="adjustForInflation"
              name="adjustForInflation"
              checked={params.adjustForInflation}
              onChange={handleInputChange}
              className="h-5 w-5 shrink-0 rounded border-slate-300 text-teal-600 accent-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/35"
            />
            <Label htmlFor="adjustForInflation" className="mb-0 min-w-0 flex-1">
              Adjust for Inflation
            </Label>
            <InfoHint
              text={FIELD_TOOLTIPS.adjustForInflation}
              label="Help: adjust projection for inflation"
            />
          </div>
        </div>
        <div className="flex w-full items-center gap-2">
          <Button
            type="button"
            onClick={calculateProjection}
            className="mb-4 min-w-0 flex-1"
          >
            Calculate Projection
          </Button>
          <InfoHint
            text={FIELD_TOOLTIPS.calculateProjection}
            label="Help: calculate projection"
            className="mb-4 shrink-0 self-center"
          />
        </div>
        {results.length > 0 && (
          <div className="mt-2 border-t border-slate-200/80 pt-6">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Projection results</h3>
              <p className="text-sm text-slate-500">Based on your inputs and growth assumptions.</p>
            </div>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50/80 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800/80">Years to target</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-teal-950">{results.length - 1}</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/70 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800/80">Final portfolio</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-950">
                  {formatMoney(results[results.length - 1].portfolio)}
                </p>
              </div>
            </div>
            <div className="mb-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-inner shadow-slate-200/40 sm:p-4">
              <div className="h-96">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>
            <div className="mt-2 max-h-96 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm">
              <div className="max-h-96 overflow-y-auto">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    {PROJECTION_TABLE_COLUMNS.map((label, i) => (
                      <th
                        key={label}
                        className={classNames(
                          'sticky top-0 z-10 border-b border-slate-200/90 bg-gradient-to-b from-slate-100 to-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]',
                          i === 0 && 'rounded-tl-xl',
                          i === PROJECTION_TABLE_COLUMNS.length - 1 && 'rounded-tr-xl',
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr
                      key={row.year}
                      className={classNames(
                        'transition-colors hover:bg-teal-50/50',
                        idx % 2 === 1 && 'bg-slate-50/60',
                      )}
                    >
                      <td className="border-b border-slate-100 px-3 py-2 font-medium text-slate-700">{row.year}</td>
                      <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-slate-800">
                        {formatMoney(row.portfolio)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-slate-700">
                        {formatMoney(row.growth)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-slate-700">
                        {formatMoney(row.investment)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-indigo-900/90">
                        {formatMoney(row.income)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 tabular-nums text-amber-900/90">
                        {formatMoney(row.expenses)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialProjectionDashboard;
