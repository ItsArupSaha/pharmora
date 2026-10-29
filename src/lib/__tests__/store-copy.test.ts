import { describe, expect, it } from 'vitest';
import { fallbackStoreName } from '../store-copy';

describe('fallbackStoreName', () => {
  it('uses the company name when set, regardless of business type', () => {
    expect(fallbackStoreName({ companyName: 'MediCare', storeType: 'pharmacy' })).toBe('MediCare');
    expect(fallbackStoreName({ companyName: 'My Shop', storeType: 'general' })).toBe('My Shop');
  });

  it('falls back to Pharmacy for pharmacy businesses without a name', () => {
    expect(fallbackStoreName({ storeType: 'pharmacy' })).toBe('Pharmacy');
  });

  it('falls back to Store for general businesses without a name', () => {
    expect(fallbackStoreName({ storeType: 'general' })).toBe('Store');
  });

  it('treats a missing storeType as pharmacy (legacy accounts)', () => {
    expect(fallbackStoreName({})).toBe('Pharmacy');
    expect(fallbackStoreName({ companyName: null })).toBe('Pharmacy');
  });

  it('handles null users', () => {
    expect(fallbackStoreName(null)).toBe('Pharmacy');
    expect(fallbackStoreName(undefined)).toBe('Pharmacy');
  });
});
