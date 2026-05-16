import { render, screen } from '@testing-library/react';
import App from './App';

test('renders dashboard and currency selector', () => {
  render(<App />);
  expect(screen.getByText(/Financial Projection Dashboard/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^currency$/i)).toBeInTheDocument();
});
