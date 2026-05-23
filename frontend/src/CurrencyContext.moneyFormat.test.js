import {
  formatMoneyInputDisplay,
  parseMoneyInput,
} from './CurrencyContext';

describe('formatMoneyInputDisplay', () => {
  test('INR uses lakhs grouping below 1 crore', () => {
    expect(formatMoneyInputDisplay(1200000, 'INR')).toBe('12,00,000');
    expect(formatMoneyInputDisplay(9999999, 'INR')).toBe('99,99,999');
  });

  test('INR from 1 crore: whole crores + comma + 00,00,000 block', () => {
    expect(formatMoneyInputDisplay(20000000, 'INR')).toBe('2,00,00,000');
    expect(formatMoneyInputDisplay(8000000000, 'INR')).toBe('800,00,00,000');
    expect(formatMoneyInputDisplay(200000000000, 'INR')).toBe('20000,00,00,000');
  });

  test('INR with sub-crore remainder uses padded XX,XX,XXX tail', () => {
    expect(formatMoneyInputDisplay(26500000, 'INR')).toBe('2,65,00,000');
    expect(formatMoneyInputDisplay(20000001, 'INR')).toBe('2,00,00,001');
  });

  test('non-INR uses Western grouping', () => {
    expect(formatMoneyInputDisplay(100000000000, 'USD')).toBe('100,000,000,000');
    expect(formatMoneyInputDisplay(1234567, 'EUR')).toBe('1,234,567');
  });
});

describe('parseMoneyInput', () => {
  test('INR Cr suffix', () => {
    expect(parseMoneyInput('800 Cr', 'INR')).toBe(8000000000);
    expect(parseMoneyInput('2.5 Cr', 'INR')).toBe(25000000);
  });

  test('INR plain digits', () => {
    expect(parseMoneyInput('8000000000', 'INR')).toBe(8000000000);
    expect(parseMoneyInput('1200000', 'INR')).toBe(1200000);
  });

  test('strips commas', () => {
    expect(parseMoneyInput('12,00,000', 'INR')).toBe(1200000);
    expect(parseMoneyInput('1,000,000', 'USD')).toBe(1000000);
  });
});
