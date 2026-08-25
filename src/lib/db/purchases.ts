import type { Purchase } from '../types';
import {
  getPurchases as getPurchasesImpl,
  getPurchasesPaginated as getPurchasesPaginatedImpl,
  getPurchasesForDateRange as getPurchasesForDateRangeImpl,
  getPurchasesForMonth as getPurchasesForMonthImpl,
  getPurchasesForDay as getPurchasesForDayImpl,
  searchPurchases as searchPurchasesImpl,
} from './purchase-queries';
import { addPurchase as addPurchaseImpl } from './purchase-create';
import { updatePurchase as updatePurchaseImpl } from './purchase-update';

export async function getPurchases(userId: string): Promise<Purchase[]> {
  return getPurchasesImpl(userId);
}

export async function searchPurchases(userId: string, searchTerm: string): Promise<Purchase[]> {
  return searchPurchasesImpl(userId, searchTerm);
}

export async function getPurchasesPaginated(params: {
  userId: string;
  pageLimit?: number;
  lastVisibleId?: string;
}): Promise<{ purchases: Purchase[]; hasMore: boolean }> {
  return getPurchasesPaginatedImpl(params);
}

export async function getPurchasesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Purchase[]> {
  return getPurchasesForDateRangeImpl(userId, startDate, endDate);
}

export async function getPurchasesForMonth(userId: string, year: number, month: number, offsetMinutes?: number): Promise<Purchase[]> {
  return getPurchasesForMonthImpl(userId, year, month, offsetMinutes);
}

export async function getPurchasesForDay(userId: string, dateString: string, offsetMinutes?: number): Promise<Purchase[]> {
  return getPurchasesForDayImpl(userId, dateString, offsetMinutes);
}

export async function addPurchase(
  userId: string,
  data: Omit<Purchase, 'id' | 'date' | 'totalAmount' | 'purchaseId'> & { dueDate: string }
) {
  return addPurchaseImpl(userId, data);
}

export async function updatePurchase(
  userId: string,
  purchaseDocId: string,
  data: Omit<Purchase, 'id' | 'date' | 'totalAmount' | 'purchaseId'> & { dueDate: string }
) {
  return updatePurchaseImpl(userId, purchaseDocId, data);
}
