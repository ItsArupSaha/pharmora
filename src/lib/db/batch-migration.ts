import { collection, doc, getDocs, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { Item, ItemBatch } from '../types';
import { batchesCollectionRef, type ItemBatchWithId } from './batch-utils';
import { invalidateAppData } from './data-version';

export interface MigrationResult {
  success: boolean;
  itemsMigrated: number;
  totalBatchesCopied: number;
  error?: string;
}

/**
 * Non-destructive batch migration:
 * Reads legacy sub-collection batches (/users/{userId}/items/{itemId}/batches)
 * and copies them directly into the item document's embedded `batches` array.
 * Original sub-collection documents remain intact as an untouched backup.
 */
export async function migrateBatchesToItemDocs(userId: string): Promise<MigrationResult> {
  if (!db || !userId) {
    return { success: false, itemsMigrated: 0, totalBatchesCopied: 0, error: 'Database not connected' };
  }

  try {
    const itemsCollection = collection(db, 'users', userId, 'items');
    const itemsSnapshot = await getDocs(itemsCollection);
    
    let itemsMigrated = 0;
    let totalBatchesCopied = 0;
    let batch = writeBatch(db);
    let pendingBatchWrites = 0;

    for (const itemDoc of itemsSnapshot.docs) {
      const itemData = itemDoc.data() as Item;
      
      // If item already has embedded batches, skip
      if (itemData.batches && Array.isArray(itemData.batches) && itemData.batches.length > 0) {
        continue;
      }

      // Check legacy sub-collection
      const batchesSnap = await getDocs(query(batchesCollectionRef(userId, itemDoc.id), orderBy('batchNo')));
      if (batchesSnap.empty) {
        continue;
      }

      const legacyBatches: ItemBatchWithId[] = batchesSnap.docs.map(bDoc => ({
        ...(bDoc.data() as ItemBatch),
        id: bDoc.id,
      }));

      batch.update(itemDoc.ref, { batches: legacyBatches });
      pendingBatchWrites++;
      itemsMigrated++;
      totalBatchesCopied += legacyBatches.length;

      if (pendingBatchWrites >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        pendingBatchWrites = 0;
      }
    }

    if (pendingBatchWrites > 0) {
      await batch.commit();
    }

    if (itemsMigrated > 0) {
      await invalidateAppData(userId);
    }

    return {
      success: true,
      itemsMigrated,
      totalBatchesCopied,
    };
  } catch (error: any) {
    console.error('Batch migration failed:', error);
    return {
      success: false,
      itemsMigrated: 0,
      totalBatchesCopied: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
