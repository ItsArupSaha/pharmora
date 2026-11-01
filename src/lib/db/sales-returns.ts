
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  startAfter,
  where,
  type DocumentSnapshot
} from 'firebase/firestore';
import { invalidateAppData, readLedgerVersion } from './data-version';
import { cachedCollection } from './collection-cache';
import { db } from '../firebase';
import { getCustomers } from './customers';
import { normalizeCustomerKey } from '../search-utils';
import type { Item, Metadata, Sale, SalesReturn, SaleBatchAllocation, SaleItem } from '../types';import { docToSale, docToSalesReturn } from './utils';
import { applyBatchRestores, planBatchRestores } from './sale-batch-restore';
import { saleReturnPriceFactor } from './sale-calculation';

// --- Sales Returns Queries ---
export async function getSalesReturns(userId: string): Promise<SalesReturn[]> {
    if (!db || !userId) return [];
    const version = await readLedgerVersion(userId);
    return cachedCollection('sales-returns-master', userId, async () => {
        const returnsCollection = collection(db!, 'users', userId, 'sales_returns');
        const snapshot = await getDocs(query(returnsCollection, orderBy('date', 'desc')));
        return snapshot.docs.map(docToSalesReturn);
    }, { version });
}

/** Prior returns recorded against one sale — drives the per-line return caps. */
export async function getSalesReturnsForSale(userId: string, saleDocId: string): Promise<SalesReturn[]> {
    if (!db || !userId || !saleDocId) return [];
    const returnsCollection = collection(db!, 'users', userId, 'sales_returns');
    const snapshot = await getDocs(query(returnsCollection, where('saleId', '==', saleDocId)));
    return snapshot.docs.map(docToSalesReturn);
}


export async function getSalesReturnsPaginated({ userId, pageLimit = 5, lastVisibleId }: { userId: string, pageLimit?: number, lastVisibleId?: string }): Promise<{ returns: SalesReturn[], hasMore: boolean }> {
  if (!db || !userId) return { returns: [], hasMore: false };

  const returnsCollection = collection(db, 'users', userId, 'sales_returns');
  let q = query(
      returnsCollection,
      orderBy('date', 'desc'),
      limit(pageLimit)
  );

  if (lastVisibleId) {
      const lastVisibleDoc = await getDoc(doc(returnsCollection, lastVisibleId));
      if (lastVisibleDoc.exists()) {
          q = query(q, startAfter(lastVisibleDoc));
      }
  }

  const snapshot = await getDocs(q);
  const returns = snapshot.docs.map(docToSalesReturn);
  
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  let hasMore = false;
  if(lastDoc) {
    const nextQuery = query(returnsCollection, orderBy('date', 'desc'), startAfter(lastDoc), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    hasMore = !nextSnapshot.empty;
  }

  return { returns, hasMore };
}

export interface SalesReturnDraftItem {
  itemId: string;
  quantity: number;
  /** Free-form returns only; sale-linked returns are priced by the sale. */
  price?: number;
}

export interface SalesReturnDraft {
  customerId?: string;
  /** Tie the return to a sale: caps, prices, customer and batch restoration come from it. */
  saleId?: string;
  items: SalesReturnDraftItem[];
  /** Add the returned units back into stock; false for defective/disposed goods. */
  restock?: boolean;
}

interface SoldLineAggregate {
  totalQty: number;
  price: number;
  allocations: SaleBatchAllocation[];
}

/**
 * Aggregates a sale's CURRENT lines per item — duplicate lines merge qty,
 * prices and batch allocations. Caps and pricing for a return come from this,
 * so quantities a previous sale-adjusted return already removed are naturally
 * gone from the aggregate.
 */
function aggregateSaleLines(sale: Sale): Map<string, SoldLineAggregate> {
  const byItem = new Map<string, SoldLineAggregate>();
  for (const line of sale.items) {
    const existing = byItem.get(line.itemId);
    if (existing) {
      existing.totalQty += Number(line.quantity) || 0;
      existing.allocations.push(...(line.batches || []));
    } else {
      byItem.set(line.itemId, {
        totalQty: Number(line.quantity) || 0,
        price: Number(line.price) || 0,
        allocations: [...(line.batches || [])],
      });
    }
  }
  return byItem;
}

/**
 * Walks a line's batch allocations and takes the batch slices covering
 * `quantity` units — the inverse of FEFO deduction, used to put stock back
 * where it came from.
 */
function takeAllocationSlices(allocations: SaleBatchAllocation[], quantity: number): SaleBatchAllocation[] {
  const slices: SaleBatchAllocation[] = [];
  let remaining = quantity;
  for (const alloc of allocations) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, alloc.quantity);
    if (take > 0) slices.push({ ...alloc, quantity: take });
    remaining -= take;
  }
  return slices;
}

/**
 * Removes returned units from the sale's own lines: quantities shrink,
 * batch allocations lose the same units, lines that reach zero disappear —
 * a sale of 6 with 1 returned becomes a 5-unit sale. Returns the remaining
 * lines and the recomputed item subtotal.
 */
function reduceSaleLines(
  lines: SaleItem[],
  returnedQtyByItem: Map<string, number>,
  slicesByItem: Map<string, SaleBatchAllocation[]>
): { items: SaleItem[]; subtotal: number } {
  const remaining: SaleItem[] = [];
  let subtotal = 0;
  for (const line of lines) {
    let qty = Number(line.quantity) || 0;
    let batches = line.batches ? [...line.batches] : undefined;
    const toTake = Math.min(qty, returnedQtyByItem.get(line.itemId) || 0);
    if (toTake > 0) {
      qty -= toTake;
      const slices = slicesByItem.get(line.itemId);
      if (batches && slices && slices.length > 0) {
        let left = toTake;
        batches = batches
          .map((alloc) => {
            const cut = Math.min(alloc.quantity, left);
            left -= cut;
            return { ...alloc, quantity: alloc.quantity - cut };
          })
          .filter((alloc) => alloc.quantity > 0);
        if (batches.length === 0) batches = undefined;
      }
    }
    if (qty <= 0) continue;
    subtotal += (Number(line.price) || 0) * qty;
    remaining.push({ ...line, quantity: qty, batches });
  }
  return { items: remaining, subtotal: Math.round(subtotal * 100) / 100 };
}

/**
 * The sale total after a return: the goods part scales with what remains, so
 * percentage discounts land exactly, manual overrides keep their ratio, and
 * the result never goes negative. Extra/service sales are unaffected.
 */
function scaleSaleTotal(sale: Sale, subtotalNew: number): number {
  const extra = Number(sale.extraSales) || 0;
  const subtotalOld = Number(sale.subtotal) || 0;
  const goodsOld = Math.max(0, (Number(sale.total) || 0) - extra);
  if (subtotalOld <= 0) return Math.round(Math.max(0, goodsOld) * 100) / 100;
  const goodsNew = goodsOld * (subtotalNew / subtotalOld);
  return Math.round(Math.max(0, goodsNew + extra) * 100) / 100;
}


export async function addSalesReturn(
    userId: string,
    data: SalesReturnDraft
  ): Promise<{ success: boolean; error?: string; salesReturn?: SalesReturn }> {
    if (!db || !userId) return { success: false, error: "Database not configured." };

    try {
      const restock = data.restock !== false;

      // Server-side law (M3), same as sales: whole positive quantities.
      for (const item of data.items) {
        const qty = Number(item.quantity);
        if (!item.itemId) throw new Error('Every return line needs an item.');
        if (!Number.isInteger(qty) || qty < 1) {
          throw new Error(`Return quantity must be a whole number of at least 1 (got ${item.quantity}).`);
        }
      }

      const userRef = doc(db!, 'users', userId);
      const metadataRef = doc(userRef, 'metadata', 'counters');
      const itemsCollection = collection(userRef, 'items');
      const customersCollection = collection(userRef, 'customers');
      const returnsCollection = collection(userRef, 'sales_returns');
      const salesCollection = collection(userRef, 'sales');

      // Sale-linked resolution happens outside the transaction (the
      // transaction query API is unavailable in this Firestore build): the
      // sale fixes customer, prices and per-line caps; prior returns set how
      // much of each line is still returnable. Returns recorded after this
      // feature started adjusting the sale document (`saleAdjusted`) are
      // already reflected in the sale's own lines and must not count twice.
      let linkedSale: Sale | null = null;
      let returnedByItem = new Map<string, number>();
      let pendingReceivablePaths: string[] = [];
      if (data.saleId) {
        const saleSnap = await getDoc(doc(salesCollection, data.saleId));
        if (!saleSnap.exists()) throw new Error('The original sale could not be found.');
        linkedSale = docToSale(saleSnap);
        const priorSnapshot = await getDocs(query(returnsCollection, where('saleId', '==', data.saleId)));
        for (const d of priorSnapshot.docs) {
          if (d.data()?.saleAdjusted) continue;
          for (const line of docToSalesReturn(d).items) {
            returnedByItem.set(line.itemId, (returnedByItem.get(line.itemId) || 0) + (Number(line.quantity) || 0));
          }
        }
        const receivablesSnapshot = await getDocs(query(
          collection(userRef, 'transactions'),
          where('saleId', '==', linkedSale.saleId),
          where('type', '==', 'Receivable'),
          where('status', '==', 'Pending')
        ));
        pendingReceivablePaths = receivablesSnapshot.docs.map((d) => d.ref.path);
      }

      let customerId = linkedSale ? linkedSale.customerId || '' : data.customerId || '';
      if (linkedSale && !customerId) {
        // Legacy sale without a customer: fall back to the Walk-in record.
        const existing = await getCustomers(userId); // cached, version-guarded
        const walkIn = existing.find((c) => normalizeCustomerKey(c.name) === 'walk-in customer');
        if (!walkIn) throw new Error('This sale has no customer record and no Walk-in Customer exists.');
        customerId = walkIn.id;
      }
      if (!customerId) throw new Error('A customer is required for a sales return.');

      const result = await runTransaction(db, async (transaction) => {
        const customerRef = doc(customersCollection, customerId);
        const itemRefs = data.items.map(item => doc(itemsCollection, item.itemId));
        const linkedSaleRef = data.saleId ? doc(salesCollection, data.saleId) : null;

        // All reads before the first write (Firestore transaction rule). The
        // sale's own lines are read inside the transaction so two racing
        // returns can never both pass the same cap.
        const reads = await Promise.all([
            transaction.get(metadataRef),
            transaction.get(customerRef),
            ...(linkedSaleRef ? [transaction.get(linkedSaleRef)] : []),
            ...itemRefs.map(ref => transaction.get(ref)),
            ...pendingReceivablePaths.map((path) => transaction.get(doc(db!, path))),
        ]);
        const metadataDoc = reads[0] as DocumentSnapshot;
        const customerDoc = reads[1] as DocumentSnapshot;
        const saleDoc = linkedSaleRef ? (reads[2] as DocumentSnapshot) : null;
        const itemDocs = reads.slice(linkedSaleRef ? 3 : 2, (linkedSaleRef ? 3 : 2) + data.items.length) as DocumentSnapshot[];
        const receivableDocs = reads.slice(linkedSaleRef ? 3 : 2 + data.items.length) as DocumentSnapshot[];

        if (!customerDoc.exists()) throw new Error(`Customer with id ${customerId} does not exist!`);

        // The sale's lines as they exist right now — previous sale-adjusted
        // returns are already subtracted, so caps and prices come from here.
        let currentSale: Sale | null = null;
        if (linkedSaleRef) {
          if (!saleDoc!.exists()) throw new Error('The original sale could not be found.');
          currentSale = docToSale(saleDoc!);
        }
        const soldByItem = currentSale ? aggregateSaleLines(currentSale) : new Map<string, SoldLineAggregate>();
        // Returns are credited at what the customer actually paid per unit:
        // a bill discounted from 100 to 80 makes a returned 20tk item worth 16.
        const returnPriceFactor = currentSale ? saleReturnPriceFactor(currentSale) : 1;

        const metadata = metadataDoc.data() as Metadata;
        const lastReturnNumber = metadata?.lastReturnNumber || 0;
        const newReturnNumber = lastReturnNumber + 1;
        const returnId = `RTN-${String(newReturnNumber).padStart(4, '0')}`;

        const itemDocsMap: Record<string, { ref: any; data: Item; id: string }> = {};
        itemDocs.forEach((d) => {
          if (d.exists()) {
            itemDocsMap[d.id] = { ref: d.ref, data: d.data() as Item, id: d.id };
          }
        });

        // Validation and pricing: sale-linked lines are priced by the sale and
        // capped at what remains returnable; free-form lines use the
        // submitted price (the item's own selling price is the fallback).
        const pricedItems: Array<{ itemId: string; quantity: number; price: number }> = [];
        let totalReturnValue = 0;
        let totalReturnCost = 0;
        const restoreByItem = new Map<string, SaleBatchAllocation[]>();

        for (let i = 0; i < data.items.length; i++) {
          const returnItem = data.items[i];
          const itemState = itemDocsMap[returnItem.itemId];
          if (!itemState) throw new Error(`Item with id ${returnItem.itemId} does not exist!`);
          const qty = Number(returnItem.quantity);
          let unitPrice: number;

          if (linkedSale) {
            const sold = soldByItem.get(returnItem.itemId);
            if (!sold) throw new Error(`"${itemState.data.title || returnItem.itemId}" was not sold in ${linkedSale.saleId}.`);
            const alreadyReturned = returnedByItem.get(returnItem.itemId) || 0;
            const returnable = sold.totalQty - alreadyReturned;
            if (qty > returnable) {
              throw new Error(`Only ${returnable} of "${itemState.data.title || returnItem.itemId}" can still be returned from ${linkedSale.saleId}.`);
            }
            unitPrice = Math.round(sold.price * returnPriceFactor * 100) / 100;
            const slices = takeAllocationSlices(sold.allocations, qty);
            if (slices.length > 0) {
              restoreByItem.set(returnItem.itemId, [
                ...(restoreByItem.get(returnItem.itemId) || []),
                ...slices,
              ]);
              for (const slice of slices) totalReturnCost += slice.quantity * slice.costAtSale;
            } else {
              totalReturnCost += (Number(itemState.data.productionPrice) || 0) * qty;
            }
          } else {
            unitPrice = Number(returnItem.price) || 0;
            totalReturnCost += (Number(itemState.data.productionPrice) || 0) * qty;
          }

          pricedItems.push({ itemId: returnItem.itemId, quantity: qty, price: unitPrice });
          totalReturnValue += unitPrice * qty;
        }

        // Stock: sale-linked returns go back into the exact batches they came
        // from (embedded array, or the legacy sub-collection for pre-batch
        // items). Free-form and no-restock returns leave stock untouched.
        for (let i = 0; i < pricedItems.length; i++) {
          if (!restock) break;
          const itemState = itemDocsMap[pricedItems[i].itemId];
          const allocations = restoreByItem.get(pricedItems[i].itemId) || [];
          const newStock = (Number(itemState.data.stock) || 0) + pricedItems[i].quantity;

          if (Array.isArray(itemState.data.batches)) {
            // Embedded-era item: put each unit back into its own batch.
            const batches = itemState.data.batches.map((b) => ({ ...b }));
            for (const alloc of allocations) {
              const batch = batches.find((b) => b.batchNo === alloc.batchNo) ||
                batches.find((b) => (b as any).id === alloc.batchId);
              if (batch) {
                batch.quantity = (Number(batch.quantity) || 0) + alloc.quantity;
              } else {
                batches.push({
                  id: alloc.batchId,
                  batchNo: alloc.batchNo,
                  expiryDate: alloc.expiryDate ?? null,
                  quantity: alloc.quantity,
                  initialQuantity: alloc.quantity,
                  cost: alloc.costAtSale,
                });
              }
            }
            transaction.update(itemState.ref, { stock: newStock, batches });
          } else if (allocations.length > 0) {
            // Pre-batch item with allocations somehow present: restore the
            // sub-collection docs exactly like sale deletion does.
            const plans = await planBatchRestores(transaction, userId, {
              itemId: pricedItems[i].itemId,
              quantity: pricedItems[i].quantity,
              price: pricedItems[i].price,
              batches: allocations,
            });
            transaction.update(itemState.ref, { stock: newStock });
            applyBatchRestores(transaction, plans);
          } else {
            transaction.update(itemState.ref, { stock: newStock });
          }
        }

        // The sale itself shrinks by what was returned: 6 sold with 1
        // returned becomes a 5-unit sale — in history, in reports and in the
        // edit dialog. The return document stays as the audit record.
        if (linkedSaleRef && currentSale) {
          const returnedQtyByItem = new Map<string, number>();
          for (const line of pricedItems) {
            returnedQtyByItem.set(line.itemId, (returnedQtyByItem.get(line.itemId) || 0) + line.quantity);
          }
          const { items: remainingLines, subtotal: subtotalNew } = reduceSaleLines(
            currentSale.items,
            returnedQtyByItem,
            restoreByItem
          );
          transaction.update(linkedSaleRef, {
            items: remainingLines,
            subtotal: subtotalNew,
            total: scaleSaleTotal(currentSale, subtotalNew),
          });

          // The pending receivable follows the bill down; any value beyond
          // what is still outstanding is covered by the balance credit below.
          let creditLeft = totalReturnValue;
          for (const snap of receivableDocs) {
            if (!snap.exists() || creditLeft <= 0) continue;
            const amount = Number(snap.data().amount) || 0;
            if (amount <= 0) continue;
            const cut = Math.min(amount, creditLeft);
            const newAmount = Math.round((amount - cut) * 100) / 100;
            creditLeft -= cut;
            const profit = Number(snap.data().remainingProfit) || 0;
            const newProfit = Math.round(profit * (newAmount / amount) * 100) / 100;
            transaction.update(snap.ref, newAmount > 0
              ? { amount: newAmount, remainingProfit: newProfit }
              : { amount: newAmount, remainingProfit: 0, status: 'Paid', isHiddenFromHistory: true });
          }
        }

        const newReturnRef = doc(returnsCollection);
        const returnDataToSave = {
          customerId,
          items: pricedItems,
          returnId,
          totalReturnValue,
          totalReturnCost,
          restocked: restock,
          ...(linkedSale ? { saleId: data.saleId, saleAdjusted: true } : {}),
          date: Timestamp.fromDate(new Date()),
        };
        transaction.set(newReturnRef, returnDataToSave);
        transaction.set(metadataRef, { lastReturnNumber: newReturnNumber }, { merge: true });

        // The return value is credited to the customer's account: it reduces
        // what they owe, or becomes an advance they can be refunded.
        const currentDue = Number(customerDoc.data()?.dueBalance) || 0;
        transaction.update(customerRef, { dueBalance: currentDue - totalReturnValue });

        const salesReturnForClient: SalesReturn = {
          id: newReturnRef.id,
          ...returnDataToSave,
          date: new Date().toISOString(),
        };

        return { success: true, salesReturn: salesReturnForClient };
      });

      await invalidateAppData(userId);
      return result;

    } catch (e) {
      console.error("Sales return creation failed: ", e);
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
}

