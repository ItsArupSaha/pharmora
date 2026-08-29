import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

import { db } from '../firebase';
import type { Item } from '../types';
import { isNonSalableCategory, resolveIsSalable } from '../item-flags';
import { sumBatchQuantities, distributeStockDelta } from '../batch-allocation';
import { batchesCollectionRef, batchDocRef, fetchItemBatches } from './batch-utils';
import { cachedCollection, invalidateCollectionCache } from './collection-cache';
import { stripUndefinedFields } from './firestore-payload';
import { invalidateAppData, readCatalogVersion } from './data-version';



// --- Items Actions ---
export async function getItems(userId: string): Promise<Item[]> {
  if (!db || !userId) return [];
  // The catalog version (one cheap read of the user doc) makes this cache
  // multi-instance safe: mutations bump it in Firestore, so a version change
  // forces a refetch here even inside the TTL.
  const version = await readCatalogVersion(userId);
  return cachedCollection('items', userId, async () => {
    const itemsCollection = collection(db!, 'users', userId, 'items');
    const snapshot = await getDocs(query(itemsCollection, orderBy('title')));
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Item));

    // Auto-migrate legacy docs: backfill isSalable (from category) and force
    // non-salable items to a zero selling price.
    const legacyItems = items.filter(item => {
      const nonSalable = isNonSalableCategory(item.categoryName);
      const missingFlag = typeof item.isSalable !== 'boolean';
      return (nonSalable && missingFlag) || (nonSalable && item.sellingPrice !== 0);
    });

    if (legacyItems.length > 0) {
      await Promise.all(legacyItems.map(async (item) => {
        try {
          const itemRef = doc(db!, 'users', userId, 'items', item.id);
          await updateDoc(itemRef, { isSalable: false, sellingPrice: 0 });
          item.isSalable = false;
          item.sellingPrice = 0;
        } catch (e) {
          console.error(`Failed to auto-migrate item ${item.id}:`, e);
        }
      }));
    }

    // Auto-migrate legacy docs without embedded batches array in background
    const unmigratedBatchItems = items.filter(item => !item.batches && (Number(item.stock) || 0) > 0);
    if (unmigratedBatchItems.length > 0) {
      Promise.all(unmigratedBatchItems.map(async (item) => {
        try {
          const subBatches = await fetchItemBatches(userId, item.id);
          if (subBatches.length > 0) {
            const itemRef = doc(db!, 'users', userId, 'items', item.id);
            await updateDoc(itemRef, { batches: subBatches });
            item.batches = subBatches;
          }
        } catch (e) {
          console.error(`Failed to auto-migrate batches for item ${item.id}:`, e);
        }
      })).catch(() => {});
    }

    return items;
  }, { version });
}

export async function getItemsPaginated({ userId, pageLimit = 10, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ items: Item[], hasMore: boolean }> {
  if (!db || !userId) return { items: [], hasMore: false };

  const itemsCollection = collection(db, 'users', userId, 'items');
  let q = query(
      itemsCollection,
      orderBy('title'),
      limit(pageLimit)
  );

  if (lastVisibleId) {
      const lastVisibleDoc = await getDoc(doc(itemsCollection, lastVisibleId));
      if (lastVisibleDoc.exists()) {
          q = query(q, startAfter(lastVisibleDoc));
      }
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => {
    const data = doc.data();
    const salable = resolveIsSalable({ isSalable: data.isSalable, categoryName: data.categoryName });
    return {
      id: doc.id,
      ...data,
      isSalable: salable,
      sellingPrice: salable ? (data.sellingPrice || 0) : 0,
    } as Item;
  });
  
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  let hasMore = false;
  if(lastDoc) {
    const nextQuery = query(itemsCollection, orderBy('title'), startAfter(lastDoc), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    hasMore = !nextSnapshot.empty;
  }

  return { items, hasMore };
}

export async function addItem(userId: string, data: Omit<Item, 'id'>) {
  if (!db || !userId) return;
  const salable = resolveIsSalable(data);
  const itemsCollection = collection(db, 'users', userId, 'items');
  const newDocRef = await addDoc(itemsCollection, stripUndefinedFields({
    ...data,
    isSalable: salable,
    sellingPrice: salable ? data.sellingPrice : 0,
  }));
  await invalidateAppData(userId);
  return { id: newDocRef.id, ...data, isSalable: salable };
}

export async function updateItem(userId: string, id: string, data: Omit<Item, 'id'>) {
  if (!db || !userId) return;
  const salable = resolveIsSalable(data);
  const itemRef = doc(db, 'users', userId, 'items', id);

  // Manual stock edits must flow into batches when batch tracking is active,
  // otherwise the next FEFO sale would see a stale quantity.
  const batches = data.batches || await fetchItemBatches(userId, id);
  let updatedBatches = batches;

  if (batches.length > 0) {
    const delta = data.stock - sumBatchQuantities(batches);
    if (delta !== 0) {
      const { updates, surplus } = distributeStockDelta(batches, delta);
      const updateMap = new Map(updates.map(u => [u.id, u.quantity]));
      updatedBatches = batches.map(b => updateMap.has(b.id) ? { ...b, quantity: updateMap.get(b.id)! } : b);
      if (surplus > 0) {
        updatedBatches.push({
          id: `b_adj_${Date.now()}`,
          batchNo: 'ADJUSTMENT',
          expiryDate: null,
          quantity: surplus,
          initialQuantity: surplus,
          cost: data.productionPrice || 0,
        });
      }
    }
  }

  await updateDoc(itemRef, stripUndefinedFields({
    ...data,
    isSalable: salable,
    sellingPrice: salable ? data.sellingPrice : 0,
    batches: updatedBatches,
  }));

  await invalidateAppData(userId);
}

export async function deleteItem(userId: string, id: string) {
  if (!db || !userId) return;
  const itemRef = doc(db, 'users', userId, 'items', id);
  await deleteDoc(itemRef);
  await invalidateAppData(userId);
}

export async function ignoreItemWarning(userId: string, id: string, ignore: boolean) {
  if (!db || !userId) return;
  const itemRef = doc(db, 'users', userId, 'items', id);
  await updateDoc(itemRef, { ignoredWarning: ignore });
  await invalidateAppData(userId);
}

export async function bulkUpdateItemLocationByCompany(
  userId: string,
  companyName: string,
  newLocation: string
) {
  if (!db || !userId || !companyName) {
    return { success: false, error: 'Missing required parameters.' };
  }
  try {
    const itemsCollection = collection(db, 'users', userId, 'items');
    const snapshot = await getDocs(itemsCollection);
    
    const batchPromises = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        return data.company && data.company.trim().toLowerCase() === companyName.trim().toLowerCase();
      })
      .map(doc => {
        const docRef = doc.ref;
        return updateDoc(docRef, { location: newLocation });
      });

    if (batchPromises.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    await Promise.all(batchPromises);
    await invalidateAppData(userId);
    return { success: true, updatedCount: batchPromises.length };
  } catch (error: any) {
    console.error('Failed to bulk update location:', error);
    return { success: false, error: error?.message || 'Failed to update location' };
  }
}

export async function resetAllIgnoredWarnings(userId: string) {
  if (!db || !userId) return { success: false, count: 0 };
  try {
    const itemsCollection = collection(db, 'users', userId, 'items');
    const q = query(itemsCollection, where('ignoredWarning', '==', true));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return { success: true, count: 0 };

    const batchPromises = snapshot.docs.map((docSnap) => {
      return updateDoc(docSnap.ref, { ignoredWarning: false });
    });
    await Promise.all(batchPromises);

    await invalidateAppData(userId);
    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error('Failed to reset ignored warnings:', error);
    return { success: false, error: error?.message || 'Failed to reset ignored warnings' };
  }
}
