// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          amount: 1,
          base: 'USD',
          date: '2026-01-15',
          rates: { INR: 85, EUR: 0.9, GBP: 0.8, JPY: 150, AUD: 1.5, CAD: 1.35 },
        }),
    })
  );
});
