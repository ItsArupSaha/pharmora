import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { cachedCollection } from './collection-cache';
import { readLedgerVersion } from './data-version';
import type { Sale } from '../types';
import { isFuzzyMatch } from '../search-utils';
import { docToSale } from './utils';
import { getItems } from './items';
import { getCustomers } from './customers';

// --- Sales Actions ---
export async function getSales(userId: string): Promise<Sale[]> {
  if (!db || !userId) return [];
  const salesCollection = collection(db, 'users', userId, 'sales');
  const snapshot = await getDocs(query(salesCollection, orderBy('date', 'desc')));
  return snapshot.docs.map(docToSale);
}

/**
 * Master sales list, ledger-version guarded: one fetch per data change, then
 * served from memory. Search, closing stock, and the overview all share it,
 * so none of them re-scans the whole history on every call.
 */
export async function getSalesMaster(userId: string): Promise<Sale[]> {
  if (!db || !userId) return [];
  const version = await readLedgerVersion(userId);
  return cachedCollection('sales-master', userId, () => getSales(userId), { version });
}

export async function getSalesPaginated({ userId, pageLimit = 5, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ sales: Sale[], hasMore: boolean }> {
  if (!db || !userId) return { sales: [], hasMore: false };

  const salesCollection = collection(db, 'users', userId, 'sales');
  let q = query(
    salesCollection,
    orderBy('date', 'desc'),
    limit(pageLimit)
  );

  if (lastVisibleId) {
    const lastVisibleDoc = await getDoc(doc(salesCollection, lastVisibleId));
    if (lastVisibleDoc.exists()) {
      q = query(q, startAfter(lastVisibleDoc));
    }
  }

  const snapshot = await getDocs(q);
  const sales = snapshot.docs.map(docToSale);

  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  let hasMore = false;
  if (lastDoc) {
    const nextQuery = query(salesCollection, orderBy('date', 'desc'), startAfter(lastDoc), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    hasMore = !nextSnapshot.empty;
  }

  return { sales, hasMore };
}

export async function getSalesForCustomer(userId: string, customerId: string): Promise<Sale[]> {
  if (!db || !userId) return [];
  const salesCollection = collection(db, 'users', userId, 'sales');
  const snapshot = await getDocs(
    query(salesCollection, where('customerId', '==', customerId), orderBy('date', 'desc'))
  );
  return snapshot.docs.map(docToSale);
}

export async function getSalesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Sale[]> {
  if (!db || !userId) return [];
  const version = await readLedgerVersion(userId);
  return cachedCollection(
    `ledger-master:report:sales:${startDate.toISOString()}:${endDate.toISOString()}`,
    userId,
    async () => {
      const salesCollection = collection(db!, 'users', userId, 'sales');
      const q = query(
        salesCollection,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate)),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docToSale);
    },
    { version }
  );
}

export async function getSalesForMonth(userId: string, year: number, month: number, offsetMinutes?: number): Promise<Sale[]> {
  if (offsetMinutes !== undefined) {
    let startMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
    let endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
    startMs += offsetMinutes * 60 * 1000;
    endMs += offsetMinutes * 60 * 1000;
    return getSalesForDateRange(userId, new Date(startMs), new Date(endMs));
  }
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return getSalesForDateRange(userId, startDate, endDate);
}

export async function getSalesForDay(userId: string, dateString: string, offsetMinutes?: number): Promise<Sale[]> {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (offsetMinutes !== undefined) {
    let startMs = Date.UTC(year, month, day, 0, 0, 0, 0);
    let endMs = Date.UTC(year, month, day, 23, 59, 59, 999);
    startMs += offsetMinutes * 60 * 1000;
    endMs += offsetMinutes * 60 * 1000;
    return getSalesForDateRange(userId, new Date(startMs), new Date(endMs));
  }

  const startDate = new Date(year, month, day, 0, 0, 0, 0);
  const endDate = new Date(year, month, day, 23, 59, 59, 999);
  return getSalesForDateRange(userId, startDate, endDate);
}

export async function searchSales(userId: string, searchTerm: string): Promise<Sale[]> {
  if (!db || !userId || !searchTerm) return [];

  const searchLower = searchTerm.toLowerCase();

  // 1. Fuzzy-match customers by name
  const allCustomers = await getCustomers(userId);
  const matchingCustomerIds = allCustomers
    .filter(customer => {
      const name = (customer.name || '').toLowerCase();
      return name.includes(searchLower) || isFuzzyMatch(customer.name, searchLower);
    })
    .map(customer => customer.id);

  // 2. Fuzzy-match medicines so sales can be found by item name/typo
  const allItems = await getItems(userId);
  const matchingItemIds = new Set(
    allItems
      .filter(item => (
        isFuzzyMatch(item.title, searchLower) ||
        isFuzzyMatch(item.medicineGroup, searchLower) ||
        isFuzzyMatch(item.company, searchLower)
      ))
      .map(item => item.id)
  );

  // 3. Filter the version-guarded master list — repeated searches cost zero
  //    reads; the list refetches only when a ledger mutation actually changed it.
  const allSales = await getSalesMaster(userId);

  // 4. Filter: sale id, customer name, or any line item's medicine
  return allSales.filter(sale => {
    const matchesSaleId = sale.saleId.toLowerCase().includes(searchLower);
    const matchesCustomer = matchingCustomerIds.includes(sale.customerId);
    const matchesItem = sale.items.some(item => matchingItemIds.has(item.itemId));
    return matchesSaleId || matchesCustomer || matchesItem;
  });
}
