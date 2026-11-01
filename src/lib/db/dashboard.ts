import {
  collection,
  count,
  doc,
  getAggregateFromServer,
  getDoc,
  getDocs,
  query,
  sum,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getExpensesForMonth } from './expenses';
import { docToSale, docToSalesReturn, isOperatingExpense } from './utils';
import { cachedCollection } from './collection-cache';
import { readLedgerVersion } from './data-version';
import type { Sale, SalesReturn } from '../types';

// Profit is computed from the frozen `costAtSale` on FEFO batch allocations
// (phase 2 schema). Only lines lacking allocations — sales recorded before the
// migration — fall back to the item's current production price, fetched per
// referenced item id so the catalog is never streamed whole.

function saleFrozenCost(sale: Sale, legacyCosts: Map<string, number>): number {
  return sale.items.reduce((total, line) => {
    if (line.batches?.length) {
      return total + line.batches.reduce((sum, batch) => sum + batch.costAtSale * batch.quantity, 0);
    }
    return total + (legacyCosts.get(line.itemId) ?? 0) * line.quantity;
  }, 0);
}

function returnCost(saleReturn: SalesReturn, legacyCosts: Map<string, number>): number {
  // New sale-linked returns freeze the returned units' batch cost at record
  // time; free-form returns fall back to the item's current production price.
  if (saleReturn.totalReturnCost !== undefined) {
    return Number(saleReturn.totalReturnCost) || 0;
  }
  return saleReturn.items.reduce((sum, line) => sum + (legacyCosts.get(line.itemId) ?? 0) * line.quantity, 0);
}

async function fetchLegacyItemCosts(
  userId: string,
  sales: Sale[],
  returns: SalesReturn[]
): Promise<Map<string, number>> {
  const ids = new Set<string>();
  for (const sale of sales) {
    for (const line of sale.items) {
      if (!line.batches?.length) ids.add(line.itemId);
    }
  }
  for (const saleReturn of returns) {
    for (const line of saleReturn.items) ids.add(line.itemId);
  }

  const costs = new Map<string, number>();
  await Promise.all(
    [...ids].map(async (itemId) => {
      const snapshot = await getDoc(doc(db!, 'users', userId, 'items', itemId));
      if (snapshot.exists()) {
        costs.set(itemId, snapshot.data().productionPrice ?? 0);
      }
    })
  );
  return costs;
}

export async function getDashboardStats(userId: string, offsetMinutes?: number) {
    if (!db || !userId) {
        return {
            monthlySalesValue: 0,
            monthlySalesCount: 0,
            monthlyExpenses: 0,
            netProfit: 0,
            receivablesAmount: 0,
            pendingReceivablesCount: 0,
        };
    }

    // Cached per timezone offset and guarded by the ledger version: the
    // dashboard is re-requested on every visit but its inputs only change on
    // ledger mutations, which bump the version both locally and for other
    // server instances.
    const version = await readLedgerVersion(userId);
    const database = db;
    return cachedCollection(`dashboard-stats:${offsetMinutes ?? 'utc'}`, userId, async () => {

    const userRef = doc(database, 'users', userId);
    const salesCollection = collection(userRef, 'sales');
    const returnsCollection = collection(userRef, 'sales_returns');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let startDate: Date;
    let endDate: Date;

    if (offsetMinutes !== undefined) {
        let startMs = Date.UTC(year, month, 1, 0, 0, 0, 0);
        let endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);
        startMs += offsetMinutes * 60 * 1000;
        endMs += offsetMinutes * 60 * 1000;
        startDate = new Date(startMs);
        endDate = new Date(endMs);
    } else {
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    const salesQuery = query(
        salesCollection,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    const returnsQuery = query(
        returnsCollection,
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    // Wrap snapshot fetching in try/catch to handle cases where collections don't exist yet for new users.
    const safeGetDocs = async (q: ReturnType<typeof query>) => {
        try {
            return await getDocs(q);
        } catch (error) {
            console.warn("Could not fetch collection, it might not exist for a new user.", error);
            return { docs: [] }; // Return an empty snapshot
        }
    };

    const [
        salesSnapshot, 
        returnsSnapshot, 
        receivablesAggregate
    ] = await Promise.all([
        safeGetDocs(salesQuery),
        safeGetDocs(returnsQuery),
        // Aggregate query: ~1 billed read per 1,000 index entries instead of
        // streaming every due-customer document.
        getAggregateFromServer(
            query(collection(db!, 'users', userId, 'customers'), where('dueBalance', '>', 0)),
            { totalDue: sum('dueBalance'), dueCount: count() }
        ).catch(() => null)
    ]);

    const salesThisMonth = salesSnapshot.docs.map(docToSale);
    const returnsThisMonth = returnsSnapshot.docs.map(docToSalesReturn);
    // Sale-adjusted returns already shrank their sale documents (fewer units,
    // lower totals), so their cost left gross profit with the sale — counting
    // them again here would double-subtract. Only legacy returns (recorded
    // before sale-adjustment existed) still reduce profit via returnCost.
    const standaloneReturns = returnsThisMonth.filter((r) => !r.saleAdjusted);
    const expensesThisMonth = await getExpensesForMonth(userId, year, month, offsetMinutes);
    const legacyCosts = await fetchLegacyItemCosts(userId, salesThisMonth, standaloneReturns);

    const monthlySalesValue = salesThisMonth.reduce((sum, sale) => sum + sale.total, 0);
    const monthlySalesCount = salesThisMonth.length;

    const operatingExpensesThisMonth = expensesThisMonth.filter((expense: any) => isOperatingExpense(expense.description));
    const monthlyExpenses = operatingExpensesThisMonth.reduce((sum: number, expense: any) => sum + expense.amount, 0);

    const grossProfitThisMonth = salesThisMonth.reduce(
        (totalProfit, sale) => totalProfit + (sale.total - saleFrozenCost(sale, legacyCosts)),
        0
    );

    const totalReturnCost = standaloneReturns.reduce(
        (totalCost, saleReturn) => totalCost + returnCost(saleReturn, legacyCosts),
        0
    );

    const netProfit = grossProfitThisMonth - monthlyExpenses - totalReturnCost;

    const receivablesAmount = receivablesAggregate?.data().totalDue ?? 0;
    const pendingReceivablesCount = receivablesAggregate?.data().dueCount ?? 0;

    return {
        monthlySalesValue,
        monthlySalesCount,
        monthlyExpenses,
        netProfit,
        receivablesAmount,
        pendingReceivablesCount,
    };
}, { version });
}
