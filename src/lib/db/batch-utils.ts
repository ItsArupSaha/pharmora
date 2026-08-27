import { collection, doc, getDocs, orderBy, query, Timestamp, type Transaction } from 'firebase/firestore';
import { db } from '../firebase';
import type { ItemBatch, PurchaseItem } from '../types';
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

export async function fetchItemBatches(userId: string, itemId: string): Promise<ItemBatchWithId[]> {
  const snapshot = await getDocs(query(batchesCollectionRef(userId, itemId), orderBy('batchNo')));
  return snapshot.docs.map(d => ({ ...(d.data() as ItemBatch), id: d.id }));
}

export function buildBatchData(batch: Omit<ItemBatch, 'createdAt'>): ItemBatch {
  return { ...batch, createdAt: Timestamp.now() };
}

/**
 * Receives a purchase line into the item's batches inside the caller's
 * transaction: merges quantity and weighted-average cost when the batch
 * number already exists, otherwise creates the batch record.
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
