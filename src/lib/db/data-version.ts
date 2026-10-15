import { doc, getDoc, increment, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Sale } from '../types';
import { applySalesMasterPatch, type SalesMasterPatch } from '../sales-master-patch';
import { cachedCollection, invalidateCollectionCache, invalidateCollectionCacheFamily, patchCachedCollection } from './collection-cache';

// Every read cache in the app is guarded by version counters stored on the
// user document, mirroring the pattern that already keeps item stock live:
//
//   read → 1 cheap version read → serve cached data when the version matches,
//           refetch only when a mutation actually changed the data.
//
// Two counters keep refetches proportional to what changed:
//   catalogVersion — items, batches, categories
//   ledgerVersion  — sales, purchases, expenses, transactions, customers,
//                    returns, capital, deposits (the financial ledger)
//
// A mutation bumps only the counters for the data it touched — in a single
// updateDoc, so a sale never pays two extra writes.

export interface DataVersions {
  catalog: number;
  ledger: number;
}

// The version document read itself is cached briefly and shared: a page that
// mounts the catalog and the ledger pays one user-doc read, not one per
// component. Cross-instance staleness is bounded by this TTL (seconds, not
// minutes), which keeps the app feel live without per-view re-reads.
const VERSION_TTL_MS = 3_000;

async function fetchVersions(userId: string): Promise<DataVersions> {
  if (!db) return { catalog: 0, ledger: 0 };
  const snapshot = await getDoc(doc(db, 'users', userId));
  const data = snapshot.data();
  return { catalog: Number(data?.catalogVersion) || 0, ledger: Number(data?.ledgerVersion) || 0 };
}

export async function readDataVersions(userId: string): Promise<DataVersions> {
  if (!db) return { catalog: 0, ledger: 0 };
  return cachedCollection('data-versions', userId, () => fetchVersions(userId), {
    ttlMs: VERSION_TTL_MS,
  });
}

export async function readCatalogVersion(userId: string): Promise<number> {
  return (await readDataVersions(userId)).catalog;
}

export async function readLedgerVersion(userId: string): Promise<number> {
  return (await readDataVersions(userId)).ledger;
}

// Caches that derive from each counter. Ledger-derived views also read the
// catalog (stock values, sale costs), so a catalog bump must evict them too —
// hence the ledger list living inside both branches below.
function evictCatalogCaches(userId: string): void {
  invalidateCollectionCache('items', userId);
  invalidateCollectionCache('categories', userId);
}

function evictLedgerCaches(userId: string): void {
  invalidateCollectionCacheFamily('sales-master', userId);
  invalidateCollectionCacheFamily('expenses-master', userId);
  invalidateCollectionCacheFamily('purchases-master', userId);
  invalidateCollectionCacheFamily('sales-returns-master', userId);
  invalidateCollectionCacheFamily('transactions', userId);
  invalidateCollectionCache('customers', userId);
  invalidateCollectionCacheFamily('dashboard-stats', userId);
  invalidateCollectionCacheFamily('ledger-master', userId);
}

export type InvalidateScope = 'all' | 'ledger' | 'catalog';

export interface InvalidateOptions {
  /**
   * 'all' (default): bump both counters — for mutations that touch stock or
   * the catalog (sales, purchases, returns, item edits), since every ledger
   * view also derives from items. 'ledger': bump only ledgerVersion — for
   * pure money movements (payments, payables, expenses, capital) that never
   * change the catalog, so the items cache stays warm. 'catalog': bump only
   * catalogVersion — for category add/rename/delete, which nothing in the
   * ledger derives from.
   */
  scope?: InvalidateScope;
  /**
   * Level-1 incremental sync for the sales master: the mutation already holds
   * the exact sale document it wrote, so instead of dropping the cached sales
   * list (which would force a full-history refetch on the next read) it is
   * patched in place and stamped with the freshly bumped version. Skipped
   * automatically when no fresh entry exists — then behavior is the plain
   * eviction. Only idempotent upsert/remove patches are accepted.
   */
  salesMasterPatch?: SalesMasterPatch;
}

/**
 * The single invalidation entry point for every mutation: bumps the counters
 * in one write, drops the version memo, and evicts the local caches derived
 * from them.
 */
export async function invalidateAppData(
  userId: string,
  options: InvalidateOptions = {}
): Promise<void> {
  const ledgerOnly = options.scope === 'ledger';
  const catalogOnly = options.scope === 'catalog';

  if (!db) {
    // Evict locally even without a database handle so this instance never
    // serves data it knows is stale.
    invalidateCollectionCache('data-versions', userId);
    if (!ledgerOnly) evictCatalogCaches(userId);
    if (!catalogOnly) evictLedgerCaches(userId);
    return;
  }

  const updates: Record<string, ReturnType<typeof increment>> = {};
  if (!catalogOnly) updates.ledgerVersion = increment(1);
  if (!ledgerOnly) updates.catalogVersion = increment(1);
  try {
    await updateDoc(doc(db, 'users', userId), updates);
  } catch (error) {
    // Local evictions below still run, so this instance stays correct; other
    // instances fall back to the short version-memo window.
    console.error('Failed to bump data version:', error);
  }

  let salesMasterRetained = false;
  if (options.salesMasterPatch) {
    // Read back the version we just wrote so the patched entry is stamped
    // with exactly what the next reader will see (idempotent patch, so a race
    // with a concurrent refetch stays correct).
    const versions = await fetchVersions(userId);
    salesMasterRetained = patchCachedCollection<Sale[]>(
      'sales-master',
      userId,
      versions.ledger,
      (sales) => applySalesMasterPatch(sales, options.salesMasterPatch!)
    );
  }

  invalidateCollectionCache('data-versions', userId);
  if (!ledgerOnly) evictCatalogCaches(userId);
  if (catalogOnly) return;

  if (salesMasterRetained) {
    // Evict every ledger-derived cache except the patched sales master.
    invalidateCollectionCacheFamily('expenses-master', userId);
    invalidateCollectionCacheFamily('purchases-master', userId);
    invalidateCollectionCacheFamily('sales-returns-master', userId);
    invalidateCollectionCacheFamily('transactions', userId);
    invalidateCollectionCache('customers', userId);
    invalidateCollectionCacheFamily('dashboard-stats', userId);
    invalidateCollectionCacheFamily('ledger-master', userId);
  } else {
    evictLedgerCaches(userId);
  }
}
