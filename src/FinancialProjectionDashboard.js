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
  <div className={classNames('overflow-visible bg-white shadow-md rounded-lg', className)}>{children}</div>
);

const CardContent = ({ children, className }) => (
  <div className={classNames('p-4', className)}>{children}</div>
);

const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={classNames('border rounded px-2 py-1 w-full', className)}
    {...props}
  />
));
Input.displayName = 'Input';

const Button = ({ className, ...props }) => (
  <button
    className={classNames('bg-blue-500 text-white px-4 py-2 rounded', className)}
    {...props}
  />
);

const Label = ({ htmlFor, children, className }) => (
  <label htmlFor={htmlFor} className={classNames('block mb-1', className)}>
    {children}
  </label>
);

/** Small “i” control; tooltip shows only when hovering or focusing this icon. */
function InfoHint({ text, label, className }) {
  return (
    <span className={classNames('group/hint relative inline-flex shrink-0', className)}>
      <button
        type="button"
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-slate-400 bg-white text-[10px] font-semibold italic leading-none text-slate-600 shadow-sm hover:border-slate-500 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-label={label}
      >
        i
      </button>
      <p
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-[100] mt-1 w-64 max-w-[min(22rem,calc(100vw-2rem))] rounded-md border border-slate-600 bg-slate-900 px-2.5 py-2 text-left text-xs font-normal not-italic leading-snug text-white shadow-xl opacity-0 transition-opacity duration-150 group-hover/hint:opacity-100 group-focus-within/hint:opacity-100"
      >
        {text}
      </p>
    </span>
  );
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

  useEffect(() => {
    if (ratesStatus !== 'ready' || !ratesUsd) {
      prevCurrencyRef.current = currency;
      return;
    }
    const prev = prevCurrencyRef.current;
    if (prev === currency) return;

    setParams((p) => {
      const next = { ...p };
      for (const name of MONEY_FIELD_NAMES) {
        next[name] = convertAmountRounded(p[name], prev, currency, ratesUsd);
      }
      return next;
    });
    setResults([]);
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
    let years = 0;
    let portfolio = params.initialPortfolio;
    const projectionData = [{
      year: 0,
      portfolio: portfolio,
      growth: 0,
      investment: 0,
      expenses: params.initialExpenses,
      income: params.initialPostTaxIncome
    }];

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
        income: Math.round(postTaxIncome)
      });
    }

    setResults(projectionData);
  }, [params]);

  const { divisor: chartDivisor, unitLabel: chartUnitLabel } = chartScale;

  const chartData = useMemo(
    () => ({
      labels: results.map((row) => row.year),
      datasets: [
        {
          label: 'Portfolio Value',
          data: results.map((row) => row.portfolio / chartDivisor),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        },
        {
          label: 'Annual Income',
          data: results.map((row) => row.income / chartDivisor),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
        },
        {
          label: 'Annual Expenses',
          data: results.map((row) => row.expenses / chartDivisor),
          borderColor: 'rgb(255, 205, 86)',
          tension: 0.1,
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
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Financial Projection Over Time',
        },
        tooltip: {
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
              borderColor: 'rgb(255, 0, 0)',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                display: true,
                content: 'Target Value',
                position: 'start',
              },
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: yMax || 1,
          title: {
            display: true,
            text: `Amount (${chartUnitLabel})`,
          },
        },
        x: {
          title: {
            display: true,
            text: 'Year',
          },
        },
      },
    };
  }, [params.targetValue, results, chartDivisor, chartUnitLabel, formatMoney]);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="overflow-visible">
        <div className="mb-4 grid grid-cols-2 gap-4 overflow-visible">
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
              className="form-checkbox h-5 w-5 shrink-0 text-blue-600"
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
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Projection Results</h3>
            <p>Years to reach target: {results.length - 1}</p>
            <p>Final portfolio value: {formatMoney(results[results.length - 1].portfolio)}</p>
            <div className="mt-4 mb-4 h-96">
              <Line data={chartData} options={chartOptions} />
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {PROJECTION_TABLE_COLUMNS.map((label, i) => (
                      <th
                        key={label}
                        className={classNames(
                          'sticky top-0 z-10 border-b border-r border-t border-gray-300 bg-gray-100 p-2 shadow-[0_1px_0_0_rgb(209_213_219)]',
                          i === 0 && 'border-l',
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.year} className="hover:bg-gray-50">
                      <td className="border-b border-l border-r border-gray-300 p-2">{row.year}</td>
                      <td className="border-b border-r border-gray-300 p-2">{formatMoney(row.portfolio)}</td>
                      <td className="border-b border-r border-gray-300 p-2">{formatMoney(row.growth)}</td>
                      <td className="border-b border-r border-gray-300 p-2">{formatMoney(row.investment)}</td>
                      <td className="border-b border-r border-gray-300 p-2">{formatMoney(row.income)}</td>
                      <td className="border-b border-r border-gray-300 p-2">{formatMoney(row.expenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialProjectionDashboard;
