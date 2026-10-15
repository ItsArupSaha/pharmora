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
import type { Purchase } from '../types';
import { isFuzzyMatch } from '../search-utils';
import { docToPurchase } from './utils';
import { cachedCollection } from './collection-cache';
import { readLedgerVersion } from './data-version';

// --- Purchases Actions ---
export async function getPurchases(userId: string): Promise<Purchase[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection('purchases-master', userId, async () => {
        const purchasesCollection = collection(db!, 'users', userId, 'purchases');
        const snapshot = await getDocs(query(purchasesCollection, orderBy('date', 'desc')));
        return snapshot.docs.map(docToPurchase);
    }, { version });
}

// Searches the version-guarded 'purchases-master' cache, so repeated searches
// cost no extra Firestore reads; mutations bump the ledger version and force
// an honest refetch. Matches by memo number (PUR-0001) or any item name.
export async function searchPurchases(userId: string, searchTerm: string): Promise<Purchase[]> {
    if (!db || !userId || !searchTerm.trim()) return [];

    const term = searchTerm.trim().toLowerCase();
    // Memo-style queries (digits or a PUR- prefix) match strictly. The fuzzy
    // layer exists for medicine-name typos, and running it on memo queries
    // made e.g. "pur-0170" phonetically match "pur"~"para" (Paracetamol) and
    // return a large slice of the catalog.
    const isMemoQuery = term.startsWith('pur') || /\d/.test(term);

    const allPurchases = await getPurchases(userId);

    return allPurchases.filter((purchase) => {
        const memo = (purchase.purchaseId || '').toLowerCase();
        if (memo.includes(term)) return true;
        return purchase.items.some((item) => {
            const name = (item.itemName || '').toLowerCase();
            if (name.includes(term)) return true;
            return !isMemoQuery && isFuzzyMatch(item.itemName, term);
        });
    });
}

export async function getPurchasesForDateRange(userId: string, startDate: Date, endDate: Date): Promise<Purchase[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection(
        `ledger-master:report:purchases:${startDate.toISOString()}:${endDate.toISOString()}`,
        userId,
        async () => {
            const purchasesCollection = collection(db!, 'users', userId, 'purchases');
            const q = query(
                purchasesCollection,
                where('date', '>=', Timestamp.fromDate(startDate)),
                where('date', '<=', Timestamp.fromDate(endDate)),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(docToPurchase);
        },
        { version }
    );
}

export async function getPurchasesForMonth(userId: string, year: number, month: number, offsetMinutes?: number): Promise<Purchase[]> {
    if (offsetMinutes !== undefined) {
        let startMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
        let endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
        startMs += offsetMinutes * 60 * 1000;
        endMs += offsetMinutes * 60 * 1000;
        return getPurchasesForDateRange(userId, new Date(startMs), new Date(endMs));
    }
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return getPurchasesForDateRange(userId, startDate, endDate);
}

export async function getPurchasesForDay(userId: string, dateString: string, offsetMinutes?: number): Promise<Purchase[]> {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();

    if (offsetMinutes !== undefined) {
        let startMs = Date.UTC(year, month, day, 0, 0, 0, 0);
        let endMs = Date.UTC(year, month, day, 23, 59, 59, 999);
        startMs += offsetMinutes * 60 * 1000;
        endMs += offsetMinutes * 60 * 1000;
        return getPurchasesForDateRange(userId, new Date(startMs), new Date(endMs));
    }

    const startDate = new Date(year, month, day, 0, 0, 0, 0);
    const endDate = new Date(year, month, day, 23, 59, 59, 999);
    return getPurchasesForDateRange(userId, startDate, endDate);
}

export async function getPurchasesPaginated({ userId, pageLimit = 5, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ purchases: Purchase[], hasMore: boolean }> {
  if (!db || !userId) return { purchases: [], hasMore: false };

  const purchasesCollection = collection(db, 'users', userId, 'purchases');
  let q = query(
      purchasesCollection,
      orderBy('date', 'desc'),
      limit(pageLimit)
  );

  if (lastVisibleId) {
      const lastVisibleDoc = await getDoc(doc(purchasesCollection, lastVisibleId));
      if (lastVisibleDoc.exists()) {
          q = query(q, startAfter(lastVisibleDoc));
      }
  }

  const snapshot = await getDocs(q);
  const purchases = snapshot.docs.map(docToPurchase);
  
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  let hasMore = false;
  if(lastDoc) {
    const nextQuery = query(purchasesCollection, orderBy('date', 'desc'), startAfter(lastDoc), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    hasMore = !nextSnapshot.empty;
  }

  return { purchases, hasMore };
}
