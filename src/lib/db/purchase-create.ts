import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  where
} from 'firebase/firestore';
import { invalidateAppData } from './data-version';
import { stripUndefinedFields } from './firestore-payload';
import { db } from '../firebase';
import type { Item, ItemBatch, Metadata, Purchase } from '../types';
import { earlierExpiry } from '../batch-allocation';
import { batchesCollectionRef, receivePurchaseBatch } from './batch-utils';
import { computePurchaseTotals, mergeReceivedStock, planPurchaseSettlements } from './purchase-calculation';
import { resolveIsSalable } from '../item-flags';

export async function addPurchase(userId: string, data: Omit<Purchase, 'id' | 'date' | 'totalAmount' | 'purchaseId'> & { dueDate: string }) {
  if (!db || !userId) return { success: false, error: 'Database not connected' };

  try {
      const userRef = doc(db!, 'users', userId);
      const itemsCollection = collection(userRef, 'items');

      const mappedItems = data.items.map(item => ({
          ...item,
          itemName: item.itemName.trim()
      }));

      // Pre-fetch all candidate item documents in parallel (1 concurrent round-trip)
      const itemSnapshots = await Promise.all(
          mappedItems.map(item => {
              const trimmedName = item.itemName;
              let q = query(itemsCollection, where("title", "==", trimmedName));
              if (item.expiryDate) {
                  q = query(itemsCollection, where("title", "==", trimmedName), where("expiryDate", "==", item.expiryDate));
              }
              return getDocs(q);
          })
      );

      // Pre-load batches for all matched existing items in parallel
      const existingItemIds = Array.from(
          new Set(
              itemSnapshots
                  .filter(snap => !snap.empty)
                  .map(snap => snap.docs[0].id)
          )
      );

      const batchSnapshots = await Promise.all(
          existingItemIds.map(async (itemId) => {
              const snap = await getDocs(query(batchesCollectionRef(userId, itemId)));
              return {
                  itemId,
                  batches: snap.docs.map(d => ({ ref: d.ref, data: d.data() as ItemBatch }))
              };
          })
      );
      const batchesByItemId: Record<string, Array<{ ref: any; data: ItemBatch }>> = {};
      for (const b of batchSnapshots) {
          batchesByItemId[b.itemId] = b.batches;
      }

      const result = await runTransaction(db, async (transaction) => {
          const metadataRef = doc(userRef, 'metadata', 'counters');
          const purchasesCollection = collection(userRef, 'purchases');
          const expensesCollection = collection(userRef, 'expenses');
          const transactionsCollection = collection(userRef, 'transactions');
          
          const purchaseDate = new Date();

          const metadataDoc = await transaction.get(metadataRef);
          let lastPurchaseNumber = 0;
          if (metadataDoc.exists()) {
              lastPurchaseNumber = (metadataDoc.data() as Metadata).lastPurchaseNumber || 0;
          }
          const newPurchaseNumber = lastPurchaseNumber + 1;
          const purchaseId = `PUR-${String(newPurchaseNumber).padStart(4, '0')}`;
          
          const { totalAmount, vatAmount, finalAmount, factor } = computePurchaseTotals({
              items: data.items,
              discountAmount: data.discountAmount,
              vatType: data.vatType,
              vatValue: data.vatValue,
          });

          const newPurchaseRef = doc(purchasesCollection);
          const purchaseData = stripUndefinedFields({
              ...data,
              items: mappedItems,
              purchaseId,
              date: Timestamp.fromDate(purchaseDate),
              dueDate: Timestamp.fromDate(new Date(data.dueDate)),
              totalAmount: totalAmount,
              discountAmount: data.discountAmount || 0,
              vatType: data.vatType || 'amount',
              vatValue: data.vatValue || 0,
              vatAmount: vatAmount,
          });
          transaction.set(newPurchaseRef, purchaseData);
          transaction.set(metadataRef, { lastPurchaseNumber: newPurchaseNumber }, { merge: true });

          for (let idx = 0; idx < mappedItems.length; idx++) {
              const item = mappedItems[idx];
              const trimmedName = item.itemName;
              const bookSnapshot = itemSnapshots[idx];
              const capitalizedCost = Number(item.cost) * factor;

              if (!bookSnapshot.empty) {
                  const bookDoc = bookSnapshot.docs[0];
                  const bookData = bookDoc.data();
                  const { newStock, newProductionPrice } = mergeReceivedStock(
                      Number(bookData.stock) || 0,
                      Number(bookData.productionPrice) || 0,
                      Number(item.quantity),
                      capitalizedCost
                  );
                  
                  const salable = resolveIsSalable({ isSalable: bookData.isSalable, categoryName: item.categoryName });

                  // Optionally keep the higher selling price or recalculate standard markup
                  const newSellingPrice = salable
                                            ? (item.sellingPrice && item.sellingPrice > 0 
                                                ? item.sellingPrice 
                                                : Math.max(bookData.sellingPrice || 0, newProductionPrice * 1.5))
                                            : 0;
                  
                  const updateData: any = {
                      stock: newStock,
                      productionPrice: newProductionPrice,
                      sellingPrice: newSellingPrice,
                      isSalable: salable,
                      ignoredWarning: false
                  };
                  if (item.medicineGroup) updateData.medicineGroup = item.medicineGroup;
                  if (item.company) updateData.company = item.company;
                  // Keep the EARLIEST known expiry so an older batch's shelf
                  // life is never silently overwritten by a newer invoice.
                  if (item.expiryDate) updateData.expiryDate = earlierExpiry(bookData.expiryDate, item.expiryDate);
                  if (item.location) updateData.location = item.location;

                  transaction.update(bookDoc.ref, updateData);

                  // Receive the line into its batch (merge same batch number using preloaded batches)
                  const itemBatches = batchesByItemId[bookDoc.ref.id] ||= [];
                  await receivePurchaseBatch(
                      userId,
                      transaction,
                      bookDoc.ref.id,
                      purchaseId,
                      item,
                      capitalizedCost,
                      itemBatches
                  );
              } else {
                  const newItemRef = doc(itemsCollection);
                  const salable = resolveIsSalable({ categoryName: item.categoryName });

                  const sellingPrice = salable
                                        ? (item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : capitalizedCost * 1.5)
                                        : 0;
                  
                  const newItemData: any = {
                      title: trimmedName,
                      categoryId: item.categoryId,
                      categoryName: item.categoryName,
                      stock: item.quantity,
                      productionPrice: capitalizedCost,
                      sellingPrice: sellingPrice,
                      isSalable: salable,
                      ignoredWarning: false
                  };

                  if (item.medicineGroup) newItemData.medicineGroup = item.medicineGroup;
                  if (item.company) newItemData.company = item.company;
                  if (item.expiryDate) newItemData.expiryDate = item.expiryDate;
                  if (item.location) newItemData.location = item.location;

                  transaction.set(newItemRef, newItemData);

                  // Every received line gets a batch record for FEFO
                  const itemBatches = batchesByItemId[newItemRef.id] ||= [];
                  await receivePurchaseBatch(
                      userId,
                      transaction,
                      newItemRef.id,
                      purchaseId,
                      item,
                      capitalizedCost,
                      itemBatches
                  );
              }
          }

          // Plan ledger writes (expense now / payable owed) for this purchase
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

          const now = new Date();
          for (const write of settlement.writes) {
              if (write.kind === 'expense') {
                  transaction.set(doc(expensesCollection), {
                      ...write.data,
                      date: Timestamp.fromDate(now),
                  });
              } else {
                  transaction.set(doc(transactionsCollection), {
                      ...write.data,
                      dueDate: Timestamp.fromDate(new Date(data.dueDate)),
                  });
              }
          }

          if (settlement.lastExpenseNumber > nextExpenseNumber) {
              transaction.set(metadataRef, { lastExpenseNumber: settlement.lastExpenseNumber }, { merge: true });
          }

          return { success: true, purchase: { id: newPurchaseRef.id, ...purchaseData, date: purchaseDate.toISOString(), dueDate: data.dueDate } };
      });

      await invalidateAppData(userId);
      return result;
  } catch (e) {
      console.error("Purchase creation failed: ", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
