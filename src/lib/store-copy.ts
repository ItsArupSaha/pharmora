import type { StoreType } from './types';

interface StoreNameSource {
  companyName?: string | null;
  storeType?: StoreType;
}

/**
 * Name printed on exports, memos and statements. Falls back to a
 * business-type-appropriate noun when the user never set a company name
 * ('Pharmacy' for pharmacy accounts, 'Store' for general businesses).
 */
export function fallbackStoreName(user: StoreNameSource | null | undefined): string {
  if (!user) return 'Pharmacy';
  return user.companyName || (user.storeType === 'general' ? 'Store' : 'Pharmacy');
}
