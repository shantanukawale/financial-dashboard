import {
  convertAmountRounded,
  normalizeFrankfurterUsdResponse,
} from './exchangeRates';

describe('normalizeFrankfurterUsdResponse', () => {
  it('merges USD base 1 with API rates', () => {
    const { date, ratesUsd } = normalizeFrankfurterUsdResponse({
      date: '2026-05-15',
      rates: { EUR: 0.86, INR: 96 },
    });
    expect(date).toBe('2026-05-15');
    expect(ratesUsd.USD).toBe(1);
    expect(ratesUsd.EUR).toBe(0.86);
    expect(ratesUsd.INR).toBe(96);
  });
});

describe('convertAmountRounded', () => {
  const ratesUsd = { USD: 1, EUR: 0.86, INR: 86, GBP: 0.75 };

  it('returns same rounded amount when currencies match', () => {
    expect(convertAmountRounded(123.4, 'USD', 'USD', ratesUsd)).toBe(123);
  });

  it('converts USD to EUR via pivot', () => {
    expect(convertAmountRounded(100, 'USD', 'EUR', ratesUsd)).toBe(86);
  });

  it('converts EUR to USD', () => {
    expect(convertAmountRounded(86, 'EUR', 'USD', ratesUsd)).toBe(100);
  });

  it('converts EUR to INR cross', () => {
    // 100 EUR -> USD -> INR: (100 / 0.86) * 86 = 10000
    expect(convertAmountRounded(100, 'EUR', 'INR', ratesUsd)).toBe(10000);
  });
});
