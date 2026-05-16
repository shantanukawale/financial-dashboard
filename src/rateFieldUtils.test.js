import {
  decimalRateToWholePercent,
  wholePercentToDecimal,
  normalizeRatePercentInputValue,
  formatRatePercentForInput,
} from './rateFieldUtils';

describe('rateFieldUtils', () => {
  test('decimalRateToWholePercent', () => {
    expect(decimalRateToWholePercent(0.05)).toBe(5);
    expect(decimalRateToWholePercent(0.25)).toBe(25);
    expect(decimalRateToWholePercent(0.125)).toBe(13);
    expect(decimalRateToWholePercent(-0.1)).toBe(0);
  });

  test('wholePercentToDecimal', () => {
    expect(wholePercentToDecimal(12)).toBe(0.12);
    expect(wholePercentToDecimal(-3)).toBe(0);
    expect(wholePercentToDecimal(0)).toBe(0);
  });

  test('normalizeRatePercentInputValue strips leading zeros when value > 0', () => {
    expect(normalizeRatePercentInputValue('012')).toBe('12');
    expect(normalizeRatePercentInputValue('00125')).toBe('125');
    expect(normalizeRatePercentInputValue('0')).toBe('0');
    expect(normalizeRatePercentInputValue('00')).toBe('0');
    expect(normalizeRatePercentInputValue('')).toBe('');
  });

  test('formatRatePercentForInput has no leading zeros', () => {
    expect(formatRatePercentForInput(0.13)).toBe('13');
    expect(formatRatePercentForInput(0.06)).toBe('6');
    expect(formatRatePercentForInput(0)).toBe('0');
  });
});
