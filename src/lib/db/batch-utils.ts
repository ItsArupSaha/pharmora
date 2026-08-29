import { collection, doc, getDocs, orderBy, query, Timestamp, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';
import type { Item, ItemBatch, PurchaseItem } from '../types';
import { earlierExpiry, mergeBatchCost } from '../batch-allocation';

export type ItemBatchWithId = ItemBatch & { id: string };

export function batchesCollectionRef(userId: string, itemId: string) {
  return collection(db!, 'users', userId, 'items', itemId, 'batches');
}

export function batchDocRef(userId: string, itemId: string, batchId: string) {
  return doc(db!, 'users', userId, 'items', itemId, 'batches', batchId);
}

export function newBatchDocRef(userId: string, itemId: string) {
  return doc(batchesCollectionRef(userId, itemId));
}

/**
 * Dual-read batch fetcher: Returns embedded batches instantly if present on
 * the item data, otherwise falls back to querying the legacy sub-collection.
 */
export async function fetchItemBatches(
  userId: string,
  itemId: string,
  itemData?: Item
): Promise<ItemBatchWithId[]> {
  if (itemData?.batches && Array.isArray(itemData.batches)) {
    return itemData.batches.map(b => ({ ...b }));
  }
  if (!db || !userId || !itemId) return [];
  try {
    const snapshot = await getDocs(query(batchesCollectionRef(userId, itemId), orderBy('batchNo')));
    return snapshot.docs.map(d => ({ ...(d.data() as ItemBatch), id: d.id }));
  } catch (e) {
    console.error(`Failed to fetch legacy batches for item ${itemId}:`, e);
    return [];
  }
}

export function buildBatchData(batch: Omit<ItemBatch, 'createdAt'>): ItemBatch {
  return { ...batch, createdAt: Timestamp.now() };
}

/**
 * Merges a purchase line into an item's in-memory batches list (embedded array).
 */
export function mergePurchaseBatchIntoList(
  existingBatches: ItemBatchWithId[] = [],
  purchaseId: string,
  line: PurchaseItem,
  capitalizedCost: number
): ItemBatchWithId[] {
  const batchNo = (line.batchNo || '').trim() || `AUTO-${purchaseId}`;
  const quantity = Number(line.quantity) || 0;
  const batches = existingBatches.map(b => ({ ...b }));
  const existingIndex = batches.findIndex(b => (b.batchNo || '') === batchNo);

  if (existingIndex >= 0) {
    const existing = batches[existingIndex];
    const currentQty = Number(existing.quantity) || 0;
    const currentCost = Number(existing.cost) || 0;
    const newQty = currentQty + quantity;
    batches[existingIndex] = {
      ...existing,
      quantity: newQty,
      cost: mergeBatchCost(currentQty, currentCost, quantity, capitalizedCost),
      expiryDate: earlierExpiry(existing.expiryDate, line.expiryDate),
    };
  } else {
    const newId = `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    batches.push({
      id: newId,
      batchNo,
      expiryDate: line.expiryDate ?? null,
      quantity,
      initialQuantity: quantity,
      cost: capitalizedCost,
      purchaseId,
    });
  }
  return batches;
}

/**
 * Backward-compatible sub-collection receive batch helper (kept for legacy writes if invoked directly).
 */
export async function receivePurchaseBatch(
  userId: string,
  transaction: Transaction,
  itemId: string,
  purchaseId: string,
  line: PurchaseItem,
  capitalizedCost: number,
  preloadedBatches?: Array<{ ref: any; data: ItemBatch }>
): Promise<void> {
  const batchNo = (line.batchNo || '').trim() || `AUTO-${purchaseId}`;
  const quantity = Number(line.quantity) || 0;

  let existing: { ref: any; data: ItemBatch } | undefined;

  if (preloadedBatches) {
    existing = preloadedBatches.find(d => (d.data.batchNo || '') === batchNo);
  } else {
    const snapshot = await getDocs(query(batchesCollectionRef(userId, itemId)));
    const match = snapshot.docs.find(d => (d.data().batchNo || '') === batchNo);
    if (match) {
      existing = { ref: match.ref, data: match.data() as ItemBatch };
    }
  }

  if (existing) {
    const data = existing.data;
    const currentQty = Number(data.quantity) || 0;
    const currentCost = Number(data.cost) || 0;
    const newQty = currentQty + quantity;
    transaction.update(existing.ref, {
      quantity: newQty,
      cost: mergeBatchCost(currentQty, currentCost, quantity, capitalizedCost),
      expiryDate: earlierExpiry(data.expiryDate, line.expiryDate),
    });
    data.quantity = newQty;
    data.cost = mergeBatchCost(currentQty, currentCost, quantity, capitalizedCost);
    data.expiryDate = earlierExpiry(data.expiryDate, line.expiryDate);
  } else {
    const newRef = newBatchDocRef(userId, itemId);
    const newBatch = buildBatchData({
      batchNo,
      expiryDate: line.expiryDate ?? null,
      quantity,
      initialQuantity: quantity,
      cost: capitalizedCost,
      purchaseId,
    });
    transaction.set(newRef, newBatch);
    if (preloadedBatches) {
      preloadedBatches.push({ ref: newRef, data: newBatch });
    }
  }
}
