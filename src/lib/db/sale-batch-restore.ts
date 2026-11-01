import type { Transaction } from 'firebase/firestore';
import type { SaleItem } from '../types';
import { buildBatchData, batchDocRef } from './batch-utils';

export type BatchRestorePlan = {
  ref: ReturnType<typeof batchDocRef>;
  exists: boolean;
  currentQty: number;
  alloc: NonNullable<SaleItem['batches']>[number];
};

/**
 * Read phase of batch restoration: fetches every batch document a sale line's
 * allocations point at via transaction reads. Firestore requires all
 * transaction reads before the first staged write, so planning and applying
 * are separate steps. Shared by sale deletion, sale updates and sale returns —
 * anything that puts sold units back into stock.
 */
export async function planBatchRestores(
  transaction: Transaction,
  userId: string,
  line: SaleItem
): Promise<BatchRestorePlan[]> {
  if (!line.batches?.length) return [];

  const plans: BatchRestorePlan[] = [];
  for (const alloc of line.batches) {
    const ref = batchDocRef(userId, line.itemId, alloc.batchId);
    const snap = await transaction.get(ref);
    plans.push({
      ref,
      exists: snap.exists(),
      currentQty: snap.exists() ? Number(snap.data().quantity) || 0 : 0,
      alloc,
    });
  }
  return plans;
}

/** Write phase of batch restoration; pairs with planBatchRestores. */
export function applyBatchRestores(
  transaction: Transaction,
  plans: BatchRestorePlan[]
): void {
  for (const plan of plans) {
    if (plan.exists) {
      transaction.update(plan.ref, { quantity: plan.currentQty + plan.alloc.quantity });
    } else {
      transaction.set(plan.ref, buildBatchData({
        batchNo: plan.alloc.batchNo,
        expiryDate: plan.alloc.expiryDate ?? null,
        quantity: plan.alloc.quantity,
        initialQuantity: plan.alloc.quantity,
        cost: plan.alloc.costAtSale,
      }));
    }
  }
}
