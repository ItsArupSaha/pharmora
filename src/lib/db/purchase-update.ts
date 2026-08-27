import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  type CollectionReference,
  type DocumentReference,
  type Transaction
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Metadata, Purchase, PurchaseItem } from '../types';
import { resolveIsSalable } from '../item-flags';
import { earlierExpiry } from '../batch-allocation';
import { BatchWriteLedger } from './batch-ledger';
import { invalidateAppData } from './data-version';
import { stripUndefinedFields } from './firestore-payload';
import {
  computePurchaseTotals,
  planPurchaseSettlements,
  reconcileItemState,
  type SettlementWrite
} from './purchase-calculation';

function itemKey(item: { itemName: string; expiryDate?: string }): string {
  return `${item.itemName.trim()}||${item.expiryDate || ''}`;
}

/**
 * Ledger docs written since the `purchaseId` field existed link back by exact
 * field equality. Older docs are matched against the exact description
 * templates historically written for this purchase — equality, never
 * substring, so PUR-00001 entries can never attach to PUR-0001.
 */
function makePurchaseLedgerMatcher(purchaseId: string, suppliers: string[]) {
  const legacyDescriptions = new Set<string>([
    `Payment for Purchase ${purchaseId}`,
    `Partial payment for Purchase ${purchaseId}`,
  ]);
  for (const supplier of suppliers) {
    legacyDescriptions.add(`Purchase ${purchaseId} from ${supplier}`);
    legacyDescriptions.add(`Balance for Purchase ${purchaseId} from ${supplier}`);
  }

  return (data: { purchaseId?: string; description?: string }): boolean =>
    data.purchaseId === purchaseId || legacyDescriptions.has(data.description || '');
}

function applySettlementWrite(
  transaction: Transaction,
  write: SettlementWrite,
  expensesCollection: CollectionReference,
  transactionsCollection: CollectionReference,
  dueDate: Date
) {
  if (write.kind === 'expense') {
    transaction.set(doc(expensesCollection), {
      ...write.data,
      date: Timestamp.fromDate(new Date()),
    });
  } else {
    transaction.set(doc(transactionsCollection), {
      ...write.data,
      dueDate: Timestamp.fromDate(dueDate),
    });
  }
}

export async function updatePurchase(
  userId: string,
  purchaseDocId: string,
  data: Omit<Purchase, 'id' | 'date' | 'totalAmount' | 'purchaseId'> & { dueDate: string }
) {
  if (!db || !userId || !purchaseDocId) return { success: false, error: 'Database not connected or invalid ID' };

  try {
      const userRef = doc(db, 'users', userId);
      const purchasesCollection = collection(userRef, 'purchases');
      const purchaseRef = doc(purchasesCollection, purchaseDocId);

      const oldPurchaseSnap = await getDoc(purchaseRef);
      if (!oldPurchaseSnap.exists()) {
          return { success: false, error: 'Purchase not found' };
      }

      const oldPurchase = oldPurchaseSnap.data() as Purchase;
      const purchaseId = oldPurchase.purchaseId;

      // Ledger docs stamped with purchaseId are matched with an equality query
      // (single-field, auto-indexed). The legacy description matcher runs only
      // when that finds nothing, so old pre-stamping docs still reconcile
      // without streaming whole collections on every edit.
      const matchLedgerDocs = async (
        col: ReturnType<typeof collection>
      ): Promise<DocumentReference[]> => {
        const byId = await getDocs(query(col, where('purchaseId', '==', purchaseId)));
        if (!byId.empty) return byId.docs.map(d => d.ref);
        const isPurchaseLedgerDoc = makePurchaseLedgerMatcher(purchaseId, [
          oldPurchase.supplier,
          data.supplier,
        ]);
        const legacy = await getDocs(col);
        return legacy.docs
          .filter(docSnap => isPurchaseLedgerDoc(docSnap.data()))
          .map(docSnap => docSnap.ref);
      };

      const [relatedExpenseRefs, relatedTransactionRefs] = await Promise.all([
        matchLedgerDocs(collection(userRef, 'expenses')),
        matchLedgerDocs(collection(userRef, 'transactions')),
      ]);

      // Find all items affected by either old or new purchase, keyed by title + expiry
      const itemsCollection = collection(userRef, 'items');
      const itemKeys = new Set<string>();
      oldPurchase.items.forEach(item => itemKeys.add(itemKey(item)));
      data.items.forEach(item => itemKeys.add(itemKey(item)));

      const itemKeyList = Array.from(itemKeys);
      const itemDocSnaps = await Promise.all(
        itemKeyList.map(key => {
          const [name, expiryDate] = key.split('||');
          let q: ReturnType<typeof query> = query(itemsCollection, where("title", "==", name));
          if (expiryDate) {
            q = query(itemsCollection, where("title", "==", name), where("expiryDate", "==", expiryDate));
          }
          return getDocs(q);
        })
      );

      const itemDocsMap: Record<string, { ref: any; data: any }> = {};
      for (let i = 0; i < itemKeyList.length; i++) {
        const key = itemKeyList[i];
        const snap = itemDocSnaps[i];
        if (!snap.empty) {
          itemDocsMap[key] = {
            ref: snap.docs[0].ref,
            data: snap.docs[0].data(),
          };
        }
      }

      const { totalAmount, vatAmount, finalAmount, factor } = computePurchaseTotals({
          items: data.items,
          discountAmount: data.discountAmount,
          vatType: data.vatType,
          vatValue: data.vatValue,
      });

      const result = await runTransaction(db, async (transaction) => {
          const metadataRef = doc(userRef, 'metadata', 'counters');
          const metadataDoc = await transaction.get(metadataRef);
          const batchLedger = new BatchWriteLedger(userId, transaction);

          // Get current state of each item inside the transaction to prevent race conditions (in parallel)
          const validItemEntries = Array.from(itemKeys).map(key => ({ key, ref: itemDocsMap[key]?.ref })).filter(e => !!e.ref);
          const itemSnapsInTx = await Promise.all(validItemEntries.map(e => transaction.get(e.ref)));
          const currentItemDataMap: Record<string, any> = {};
          for (let i = 0; i < validItemEntries.length; i++) {
              const snap = itemSnapsInTx[i];
              if (snap.exists()) {
                  currentItemDataMap[validItemEntries[i].key] = snap.data();
              }
          }

          // For each affected key, reconcile stock/cost against old and new invoice lines
          const oldItemsByKey: Record<string, PurchaseItem[]> = {};
          for (const oldItem of oldPurchase.items) {
              const key = itemKey(oldItem);
              (oldItemsByKey[key] ||= []).push(oldItem);
          }

          for (const key of itemKeys) {
              const [name, expiryDate] = key.split('||');
              const currentData = currentItemDataMap[key];
              const oldLines = oldItemsByKey[key] || [];
              const newLines = data.items.filter(i => itemKey(i) === key);

              const reconciled = reconcileItemState(
                  currentData ? (Number(currentData.stock) || 0) : 0,
                  currentData ? (Number(currentData.productionPrice) || 0) : 0,
                  oldLines.map(i => ({ quantity: i.quantity, cost: i.cost })),
                  newLines.map(i => ({ quantity: i.quantity, cost: i.cost * factor }))
              );

              const itemRef = itemDocsMap[key]?.ref;
              const newItem = newLines[0];

              // Take old invoice lines back out of their batches, then
              // receive the new lines. When batches were already active for
              // this item, batch quantities become the stock source of truth.
              let batchesWereActive = false;
              if (itemRef) {
                  batchesWereActive = await batchLedger.hasCommittedBatches(itemRef.id);
                  for (const oldLine of oldLines) {
                      await batchLedger.withdraw(itemRef.id, purchaseId, oldLine);
                  }
              }

              if (itemRef && currentData) {
                  const salable = resolveIsSalable({ isSalable: currentData.isSalable, categoryName: currentData.categoryName });
                  const updateData: any = {
                      stock: reconciled.stock,
                      productionPrice: reconciled.productionPrice,
                      isSalable: salable,
                      ignoredWarning: false
                  };

                  if (newItem) {
                      if (salable && newItem.sellingPrice && newItem.sellingPrice > 0) {
                          updateData.sellingPrice = newItem.sellingPrice;
                      }
                      if (!salable) updateData.sellingPrice = 0;
                      if (newItem.medicineGroup) updateData.medicineGroup = newItem.medicineGroup;
                      if (newItem.company) updateData.company = newItem.company;
                      if (newItem.expiryDate) updateData.expiryDate = earlierExpiry(currentData.expiryDate, newItem.expiryDate);
                      if (newItem.location) updateData.location = newItem.location;
                  }

                  for (const newLine of newLines) {
                      await batchLedger.receive(itemRef.id, purchaseId, newLine, newLine.cost * factor);
                  }

                  if (batchesWereActive) {
                      updateData.stock = await batchLedger.totalQuantity(itemRef.id);
                  }

                  transaction.update(itemRef, updateData);
              } else if (newItem) {
                  const newItemRef = doc(itemsCollection);
                  const capitalizedCost = newItem.cost * factor;
                  const salable = resolveIsSalable({ categoryName: newItem.categoryName });
                  const sellingPrice = salable
                    ? (newItem.sellingPrice && newItem.sellingPrice > 0 ? newItem.sellingPrice : capitalizedCost * 1.5)
                    : 0;
                  const newItemData: any = {
                      title: name,
                      categoryId: newItem.categoryId,
                      categoryName: newItem.categoryName,
                      stock: reconciled.stock,
                      productionPrice: reconciled.productionPrice,
                      sellingPrice: sellingPrice,
                      isSalable: salable,
                      ignoredWarning: false
                  };
                  if (newItem.medicineGroup) newItemData.medicineGroup = newItem.medicineGroup;
                  if (newItem.company) newItemData.company = newItem.company;
                  if (newItem.expiryDate) newItemData.expiryDate = newItem.expiryDate;
                  if (newItem.location) newItemData.location = newItem.location;

                  transaction.set(newItemRef, newItemData);

                  for (const newLine of newLines) {
                      await batchLedger.receive(newItemRef.id, purchaseId, newLine, newLine.cost * factor);
                  }
              }
          }

          // Apply every staged batch mutation exactly once per doc.
          batchLedger.flush();

          // Delete old expenses and transactions
          relatedExpenseRefs.forEach(ref => transaction.delete(ref));
          relatedTransactionRefs.forEach(ref => transaction.delete(ref));

          const mappedItems = data.items.map(item => ({
              ...item,
              itemName: item.itemName.trim()
          }));
          // Set updated purchase data
          const purchaseData = stripUndefinedFields({
              ...data,
              items: mappedItems,
              purchaseId,
              date: oldPurchase.date, // keep original date
              dueDate: Timestamp.fromDate(new Date(data.dueDate)),
              totalAmount,
              discountAmount: data.discountAmount || 0,
              vatType: data.vatType || 'amount',
              vatValue: data.vatValue || 0,
              vatAmount,
          });
          transaction.set(purchaseRef, purchaseData);

          // Regenerate expense/payable writes for the edited purchase
          const nextExpenseNumber = (metadataDoc.data() as Metadata)?.lastExpenseNumber || 0;
          const settlement = planPurchaseSettlements({
              purchaseId,
              supplier: data.supplier,
              finalAmount,
              paymentMethod: data.paymentMethod,
              amountPaid: data.amountPaid,
              splitPaymentMethod: data.splitPaymentMethod,
              nextExpenseNumber,
          });
          for (const write of settlement.writes) {
              applySettlementWrite(transaction, write, collection(userRef, 'expenses'), collection(userRef, 'transactions'), new Date(data.dueDate));
          }

          if (settlement.lastExpenseNumber > nextExpenseNumber) {
              transaction.set(metadataRef, { lastExpenseNumber: settlement.lastExpenseNumber }, { merge: true });
          }

          return { success: true };
      });

      await invalidateAppData(userId);
      return result;
  } catch (e) {
      console.error("Purchase update failed: ", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
