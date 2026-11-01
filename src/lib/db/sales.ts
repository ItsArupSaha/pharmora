import type { Sale } from '../types';
import type { DueCustomerInput } from './due-customer-resolution';
import {
  getSalesMaster,
  getSalesPaginated as getSalesPaginatedImpl,
  getSalesForCustomer as getSalesForCustomerImpl,
  getSalesForMonth as getSalesForMonthImpl,
  getSalesForDay as getSalesForDayImpl,
  searchSales as searchSalesImpl,
} from './sales-queries';
import {
  addSale as addSaleImpl,
  deleteSale as deleteSaleImpl,
  updateSale as updateSaleImpl,
} from './sales-actions';

export type { DueCustomerInput };

export async function getSales(userId: string): Promise<Sale[]> {
  return getSalesMaster(userId);
}

export async function getSalesPaginated(params: {
  userId: string;
  pageLimit?: number;
  lastVisibleId?: string;
}): Promise<{ sales: Sale[]; hasMore: boolean }> {
  return getSalesPaginatedImpl(params);
}

export async function getSalesForCustomer(userId: string, customerId: string): Promise<Sale[]> {
  return getSalesForCustomerImpl(userId, customerId);
}

export async function getSalesForMonth(userId: string, year: number, month: number, offsetMinutes?: number): Promise<Sale[]> {
  return getSalesForMonthImpl(userId, year, month, offsetMinutes);
}

export async function getSalesForDay(userId: string, dateString: string, offsetMinutes?: number): Promise<Sale[]> {
  return getSalesForDayImpl(userId, dateString, offsetMinutes);
}

export async function searchSales(userId: string, searchTerm: string): Promise<Sale[]> {
  return searchSalesImpl(userId, searchTerm);
}

export async function addSale(
  userId: string,
  data: Omit<Sale, 'id' | 'saleId' | 'subtotal' | 'total'> & { creditApplied?: number; total?: number }
): Promise<{ success: boolean; error?: string; sale?: Sale }> {
  return addSaleImpl(userId, data);
}

export async function updateSale(
  userId: string,
  saleDocId: string,
  data: Omit<Sale, 'id' | 'saleId' | 'subtotal' | 'total'> & {
    creditApplied?: number;
    total?: number;
    date?: string;
    dueCustomer?: DueCustomerInput;
  }
): Promise<{ success: boolean; error?: string; sale?: Sale }> {
  return updateSaleImpl(userId, saleDocId, data);
}

export async function deleteSale(userId: string, saleId: string): Promise<{ success: boolean; error?: string }> {
  return deleteSaleImpl(userId, saleId);
}

