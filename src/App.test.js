import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders dashboard and currency selector', async () => {
  render(<App />);
  expect(screen.getByText(/Financial Projection Dashboard/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^currency$/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^currency$/i)).not.toBeDisabled();
  await waitFor(() => {
    expect(screen.getByText(/FX rates \(ECB\):/i)).toBeInTheDocument();
  });
});
