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
import { fetchItemBatches, mergePurchaseBatchIntoList, type ItemBatchWithId } from './batch-utils';
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

      // Pre-load batches for any legacy items that haven't been embedded yet
      const existingItemSnapshots = itemSnapshots
          .filter(snap => !snap.empty)
          .map(snap => snap.docs[0]);

      const batchMap: Record<string, ItemBatchWithId[]> = {};
      await Promise.all(
          existingItemSnapshots.map(async (docSnap) => {
              const itemData = docSnap.data() as Item;
              batchMap[docSnap.id] = await fetchItemBatches(userId, docSnap.id, itemData);
          })
      );

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
                  const bookData = bookDoc.data() as Item;
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
                  
                  const existingBatches = batchMap[bookDoc.id] || [];
                  const updatedBatches = mergePurchaseBatchIntoList(
                      existingBatches,
                      purchaseId,
                      item,
                      capitalizedCost
                  );
                  batchMap[bookDoc.id] = updatedBatches;

                  const updateData: any = {
                      stock: newStock,
                      productionPrice: newProductionPrice,
                      sellingPrice: newSellingPrice,
                      isSalable: salable,
                      ignoredWarning: false,
                      batches: updatedBatches,
                  };
                  if (item.medicineGroup) updateData.medicineGroup = item.medicineGroup;
                  if (item.company) updateData.company = item.company;
                  // Keep the EARLIEST known expiry so an older batch's shelf
                  // life is never silently overwritten by a newer invoice.
                  if (item.expiryDate) updateData.expiryDate = earlierExpiry(bookData.expiryDate, item.expiryDate);
                  if (item.location) updateData.location = item.location;

                  transaction.update(bookDoc.ref, updateData);
              } else {
                  const newItemRef = doc(itemsCollection);
                  const salable = resolveIsSalable({ categoryName: item.categoryName });

                  const sellingPrice = salable
                                        ? (item.sellingPrice && item.sellingPrice > 0 ? item.sellingPrice : capitalizedCost * 1.5)
                                        : 0;
                  
                  const initialBatch = {
                      id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                      batchNo: (item.batchNo || '').trim() || `AUTO-${purchaseId}`,
                      expiryDate: item.expiryDate ?? null,
                      quantity: Number(item.quantity) || 0,
                      initialQuantity: Number(item.quantity) || 0,
                      cost: capitalizedCost,
                      purchaseId,
                  };

                  const newItemData: any = {
                      title: trimmedName,
                      categoryId: item.categoryId,
                      categoryName: item.categoryName,
                      stock: item.quantity,
                      productionPrice: capitalizedCost,
                      sellingPrice: sellingPrice,
                      isSalable: salable,
                      ignoredWarning: false,
                      batches: [initialBatch],
                  };

                  if (item.medicineGroup) newItemData.medicineGroup = item.medicineGroup;
                  if (item.company) newItemData.company = item.company;
                  if (item.expiryDate) newItemData.expiryDate = item.expiryDate;
                  if (item.location) newItemData.location = item.location;

                  transaction.set(newItemRef, newItemData);
                  batchMap[newItemRef.id] = [initialBatch];
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
