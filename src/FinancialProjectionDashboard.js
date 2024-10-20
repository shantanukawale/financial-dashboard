import React, { useState, useCallback } from 'react';
import classNames from 'classnames';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);


// Custom components to replace the imported ones
const Card = ({ className, children }) => (
  <div className={classNames('bg-white shadow-md rounded-lg', className)}>{children}</div>
);

const CardHeader = ({ children }) => <div className="p-4 border-b">{children}</div>;
const CardTitle = ({ children }) => <h2 className="text-xl font-bold">{children}</h2>;
const CardContent = ({ children }) => <div className="p-4">{children}</div>;

const Input = ({ className, ...props }) => (
  <input
    className={classNames('border rounded px-2 py-1 w-full', className)}
    {...props}
  />
);

const Button = ({ className, ...props }) => (
  <button
    className={classNames('bg-blue-500 text-white px-4 py-2 rounded', className)}
    {...props}
  />
);

const Label = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block mb-1">
    {children}
  </label>
);

const FinancialProjectionDashboard = () => {
  const [params, setParams] = useState({
    initialPortfolio: 20000000,
    initialIncome: 10000000,
    initialExpenses: 1200000,
    incomeGrowthRate: 0.125,
    expenseGrowthRate: 0.05,
    xirr: 0.25,
    targetValue: 8000000000,
    initialPostTaxIncome: 6500000,
    inflationRate: 0.06,
    adjustForInflation: false,
  });

  const [results, setResults] = useState([]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : parseFloat(value)
    }));
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

  const formatCrore = (value) => {
    return (value / 10000000).toFixed(2) + " Cr";
  };

  const chartData = {
    labels: results.map(row => row.year),
    datasets: [
      {
        label: 'Portfolio Value',
        data: results.map(row => row.portfolio / 10000000), // Convert to Crores
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Annual Income',
        data: results.map(row => row.income / 10000000), // Convert to Crores
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Annual Expenses',
        data: results.map(row => row.expenses / 10000000), // Convert to Crores
        borderColor: 'rgb(255, 205, 86)',
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Financial Projection Over Time',
      },
    },
    scales: {
      y: {
        title: {
          display: true,
          text: 'Amount (Crores)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Year'
        }
      }
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Financial Projection Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="initialPortfolio">Initial Portfolio (INR)</Label>
            <Input
              id="initialPortfolio"
              name="initialPortfolio"
              type="number"
              value={params.initialPortfolio}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="initialIncome">Initial Income (INR)</Label>
            <Input
              id="initialIncome"
              name="initialIncome"
              type="number"
              value={params.initialIncome}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="initialExpenses">Initial Expenses (INR)</Label>
            <Input
              id="initialExpenses"
              name="initialExpenses"
              type="number"
              value={params.initialExpenses}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="incomeGrowthRate">Income Growth Rate</Label>
            <Input
              id="incomeGrowthRate"
              name="incomeGrowthRate"
              type="number"
              step="0.01"
              value={params.incomeGrowthRate}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="expenseGrowthRate">Expense Growth Rate</Label>
            <Input
              id="expenseGrowthRate"
              name="expenseGrowthRate"
              type="number"
              step="0.01"
              value={params.expenseGrowthRate}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="xirr">XIRR</Label>
            <Input
              id="xirr"
              name="xirr"
              type="number"
              step="0.01"
              value={params.xirr}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="targetValue">Target Value (INR)</Label>
            <Input
              id="targetValue"
              name="targetValue"
              type="number"
              value={params.targetValue}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="initialPostTaxIncome">Initial Post-Tax Income (INR)</Label>
            <Input
              id="initialPostTaxIncome"
              name="initialPostTaxIncome"
              type="number"
              value={params.initialPostTaxIncome}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="inflationRate">Inflation Rate</Label>
            <Input
              id="inflationRate"
              name="inflationRate"
              type="number"
              step="0.01"
              value={params.inflationRate}
              onChange={handleInputChange}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="adjustForInflation"
              name="adjustForInflation"
              checked={params.adjustForInflation}
              onChange={handleInputChange}
              className="form-checkbox h-5 w-5 text-blue-600"
            />
            <Label htmlFor="adjustForInflation">Adjust for Inflation</Label>
          </div>
        </div>
        <Button onClick={calculateProjection} className="w-full mb-4">Calculate Projection</Button>
        {results.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Projection Results</h3>
            <p>Years to reach target: {results.length - 1}</p>
            <p>Final portfolio value: {formatCrore(results[results.length - 1].portfolio)}</p>
            <div className="mt-4 mb-4 h-96">
              <Line data={chartData} options={chartOptions} />
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-2">Year</th>
                    <th className="border p-2">Portfolio Value</th>
                    <th className="border p-2">Annual Growth</th>
                    <th className="border p-2">Annual Investment</th>
                    <th className="border p-2">Annual Income</th>
                    <th className="border p-2">Annual Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.year} className="hover:bg-gray-50">
                      <td className="border p-2">{row.year}</td>
                      <td className="border p-2">{formatCrore(row.portfolio)}</td>
                      <td className="border p-2">{formatCrore(row.growth)}</td>
                      <td className="border p-2">{formatCrore(row.investment)}</td>
                      <td className="border p-2">{formatCrore(row.income)}</td>
                      <td className="border p-2">{formatCrore(row.expenses)}</td>
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
