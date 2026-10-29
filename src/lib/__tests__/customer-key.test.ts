import { describe, expect, it } from 'vitest';
import { normalizeCustomerKey } from '../search-utils';

describe('normalizeCustomerKey', () => {
  it('is case-insensitive', () => {
    expect(normalizeCustomerKey('Rahim Store')).toBe(normalizeCustomerKey('rahim store'));
  });

  it('collapses extra whitespace', () => {
    expect(normalizeCustomerKey('  Rahim   Store  ')).toBe('rahim store');
  });

  it('treats differently-spaced names as the same shop', () => {
    expect(normalizeCustomerKey('Rahim  Store')).toBe(normalizeCustomerKey('Rahim Store'));
  });

  it('keeps distinct names distinct', () => {
    expect(normalizeCustomerKey('Rahim Store')).not.toBe(normalizeCustomerKey('Karim Store'));
  });

  it('handles null and undefined', () => {
    expect(normalizeCustomerKey(null)).toBe('');
    expect(normalizeCustomerKey(undefined)).toBe('');
    expect(normalizeCustomerKey('')).toBe('');
  });
});
