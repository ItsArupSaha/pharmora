import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { invalidateAppData } from './data-version';
import { getCustomers } from './customers';
import { normalizeCustomerKey } from '../search-utils';
import type { Customer, Item, ItemBatch, Metadata, Sale, SaleItem } from '../types';
import { resolveIsSalable } from '../item-flags';
import { allocateFEFO, sumBatchQuantities } from '../batch-allocation';
import { batchDocRef, buildBatchData, fetchItemBatches, newBatchDocRef, type ItemBatchWithId } from './batch-utils';
import { buildReceivable, computeSaleTotals } from './sale-calculation';
import {
  validateAmountPaid,
  validateCreditApplied,
  validateDiscount,
  validateSaleItems,
} from '../sale-guards';
import { docToSale } from './utils';
import type { Transaction } from 'firebase/firestore';

type SaleBatch = ItemBatchWithId & { isNew?: boolean };

/**
 * Reads an item's batches outside the transaction (plain getDocs — the
 * transaction query API is unavailable in this Firestore build). Stock that
 * predates batch tracking, or drifted past batch totals, is staged as a
 * virtual LEGACY entry the caller persists inside the transaction.
 */
async function loadBatchesForSale(
  userId: string,
  itemId: string,
  itemData: Item
): Promise<{ batches: SaleBatch[]; originalQuantities: Record<string, number> }> {
  const batches: SaleBatch[] = (await fetchItemBatches(userId, itemId, itemData)).map(b => ({ ...b }));
  const originalQuantities: Record<string, number> = {};
  for (const b of batches) originalQuantities[b.id] = b.quantity;

  const stock = Number(itemData.stock) || 0;

  if (batches.length === 0 && stock > 0) {
    const legacyId = `b_legacy_${Date.now()}`;
    const legacy = buildBatchData({
      batchNo: 'LEGACY',
      expiryDate: itemData.expiryDate ?? null,
      quantity: stock,
      initialQuantity: stock,
      cost: Number(itemData.productionPrice) || 0,
    });
    batches.push({ ...legacy, id: legacyId, isNew: true });
    originalQuantities[legacyId] = 0;
  }

  // Self-heal drift: stock recorded on the item beyond what batches account
  // for (manual edits, pre-batch purchases) lands in the LEGACY batch.
  const drift = stock - sumBatchQuantities(batches);
  if (batches.length > 0 && drift > 0) {
    let legacy = batches.find(b => b.batchNo === 'LEGACY');
    if (!legacy) {
      const legacyId = `b_legacy_${Date.now()}`;
      const data = buildBatchData({
        batchNo: 'LEGACY',
        expiryDate: itemData.expiryDate ?? null,
        quantity: 0,
        initialQuantity: 0,
        cost: Number(itemData.productionPrice) || 0,
      });
      legacy = { ...data, id: legacyId, isNew: true };
      batches.push(legacy);
      originalQuantities[legacyId] = 0;
    }
    legacy.quantity += drift;
  }

  return { batches, originalQuantities };
}

interface DeductResult {
  itemsWithPrices: SaleItem[];
  totalProductionCost: number;
}

type BatchRestorePlan = {
  ref: ReturnType<typeof batchDocRef>;
  exists: boolean;
  currentQty: number;
  alloc: NonNullable<SaleItem['batches']>[number];
};

/**
 * FEFO deduction shared by addSale and updateSale: validates stock against
 * live batch quantities, consumes earliest-expiry batches first, writes the
 * updated stock and embedded batches directly to the item document in 1 atomic write.
 */
async function deductSaleLinesFEFO(
  transaction: Transaction,
  userId: string,
  itemDocsMap: Record<string, { ref: any; data: Item; id: string }>,
  saleItems: SaleItem[]
): Promise<DeductResult> {
  const itemsWithPrices: SaleItem[] = [];
  let totalProductionCost = 0;

  // Pre-load all unique items' batches (uses in-memory embedded batches instantly)
  const uniqueItemIds = Array.from(new Set(saleItems.map(si => si.itemId)));
  const batchResults = await Promise.all(
    uniqueItemIds.map(async (itemId) => {
      const itemState = itemDocsMap[itemId];
      const res = itemState ? await loadBatchesForSale(userId, itemId, itemState.data) : { batches: [], originalQuantities: {} };
      return { itemId, ...res };
    })
  );

  const batchesByItem: Record<string, SaleBatch[]> = {};
  const originalsByItem: Record<string, Record<string, number>> = {};
  for (const res of batchResults) {
    batchesByItem[res.itemId] = res.batches;
    originalsByItem[res.itemId] = res.originalQuantities;
  }

  for (const saleItem of saleItems) {
    const itemState = itemDocsMap[saleItem.itemId];
    if (!itemState) {
      throw new Error(`Item with id ${saleItem.itemId} not found.`);
    }

    const itemTitle = itemState.data.title || '';
    const qtyRequested = Number(saleItem.quantity);
    const batches = batchesByItem[saleItem.itemId] || [];
    const effectiveStock = batches.length > 0 ? sumBatchQuantities(batches) : Number(itemState.data.stock) || 0;

    if (effectiveStock < qtyRequested) {
      throw new Error(`Not enough stock for ${itemTitle}. Available in selected item: ${effectiveStock}, Requested: ${qtyRequested}`);
    }

    const price = saleItem.price !== undefined && saleItem.price !== null
      ? Number(saleItem.price)
      : Number(itemState.data.sellingPrice || 0);

    let lineCost = 0;
    let allocations: SaleItem['batches'];

    if (batches.length > 0) {
      const plan = allocateFEFO(batches, qtyRequested);
      for (const alloc of plan.allocations) {
        const batch = batches.find(b => b.id === alloc.batchId);
        if (batch) batch.quantity -= alloc.quantity;
        lineCost += alloc.quantity * alloc.costAtSale;
      }
      allocations = plan.allocations;
    } else {
      lineCost = (Number(itemState.data.productionPrice) || 0) * qtyRequested;
    }

    const newStockTotal = effectiveStock - qtyRequested;
    itemState.data.stock = newStockTotal; // keep local state fresh for duplicate lines
    totalProductionCost += lineCost;

    itemsWithPrices.push({ ...saleItem, price, batches: allocations });
  }

  // Persist each item's stock and embedded batches in 1 atomic transaction write per item
  for (const itemId of uniqueItemIds) {
    const itemState = itemDocsMap[itemId];
    if (!itemState) continue;
    const finalBatches = (batchesByItem[itemId] || []).map(({ isNew, ...b }) => b);
    transaction.update(itemState.ref, {
      stock: itemState.data.stock,
      batches: finalBatches,
    });
  }

  return { itemsWithPrices, totalProductionCost };
}

/**
 * Read phase of batch restoration: fetches every batch document a sale line's
 * allocations point at via transaction reads. Firestore requires all
 * transaction reads before the first staged write, so planning and applying
 * are separate steps.
 */
async function planBatchRestores(
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
function applyBatchRestores(
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

export interface DueCustomerInput {
  name: string;
  phone: string;
  contactName?: string;
}

export async function addSale(
  userId: string,
  data: Omit<Sale, 'id' | 'saleId' | 'subtotal' | 'total'> & {
    creditApplied?: number;
    total?: number;
    dueCustomer?: DueCustomerInput;
  }
): Promise<{ success: boolean; error?: string; sale?: Sale }> {
  if (!db || !userId) return { success: false, error: "Database not configured." };

  try {
    const userRef = doc(db, 'users', userId);
    const itemsCollection = collection(userRef, 'items');
    const customersCollection = collection(userRef, 'customers');
    const salesCollection = collection(userRef, 'sales');
    const transactionsCollection = collection(userRef, 'transactions');
    const metadataRef = doc(userRef, 'metadata', 'counters');
    const saleDate = new Date(data.date) || new Date();

    // Due and split sales both carry a shop name + phone instead of a
    // customer id. The shop name is the identity: an exact (case/spacing-
    // insensitive) name match reuses the shop no matter what, so one shop
    // can never be created twice; a phone-digit match (with country-prefix
    // tolerance) is the fallback. Only a genuinely new shop is created.
    // Cash/Bank sales stay on the walk-in customer.
    let customerRef = doc(customersCollection, data.customerId);
    let createCustomerInTx = false;
    let backfillExistingCustomer = false;
    if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
      const name = (data.dueCustomer?.name || '').trim();
      const phoneDigits = (data.dueCustomer?.phone || '').replace(/\D/g, '');
      if (!name || phoneDigits.length < 6 || phoneDigits.length > 15) {
        return { success: false, error: 'Due and split sales need a shop name and a valid phone number.' };
      }
      const existing = await getCustomers(userId); // cached, version-guarded
      const byShopName = existing.find(
        (c) => normalizeCustomerKey(c.name) === normalizeCustomerKey(name) && normalizeCustomerKey(c.name) !== 'walk-in customer'
      );
      const phoneTail = phoneDigits.slice(-10);
      const byPhone = byShopName ||
        existing.find((c) => {
          const d = (c.phone || '').replace(/\D/g, '');
          if (d === phoneDigits) return true;
          // Tolerate country-prefix differences (8801… vs 01…) on 6+ digit numbers.
          return d.length >= 6 && phoneDigits.length >= 6 &&
            (d.endsWith(phoneTail) || phoneDigits.endsWith(d.slice(-10)));
        });
      if (byPhone) {
        customerRef = doc(customersCollection, byPhone.id);
        backfillExistingCustomer = true;
      } else {
        customerRef = doc(customersCollection); // new customer
        createCustomerInTx = true;
      }
      data.customerId = customerRef.id;
    }

    // Server-side law (M3): the browser never decides money. Quantities must
    // be whole and positive — initial synchronous check.
    const itemsError = validateSaleItems(data.items);
    if (itemsError) return { success: false, error: itemsError };

    const selectedItemRefs = data.items.map(item => doc(itemsCollection, item.itemId));

    const result = await runTransaction(db, async (transaction) => {
      const [metadataDoc, customerDoc, ...itemDocs] = await Promise.all([
        transaction.get(metadataRef),
        transaction.get(customerRef),
        ...selectedItemRefs.map(ref => transaction.get(ref)),
      ]);

      if (createCustomerInTx) {
        transaction.set(customerRef, {
          name: (data.dueCustomer?.name || '').trim(),
          phone: (data.dueCustomer?.phone || '').trim(),
          address: 'N/A',
          openingBalance: 0,
          dueBalance: 0,
          ...(data.dueCustomer?.contactName ? { contactName: data.dueCustomer.contactName } : {}),
        });
      } else if (!customerDoc.exists()) {
        throw new Error(`Customer with id ${data.customerId} does not exist!`);
      } else if (backfillExistingCustomer) {
        // Matched an existing shop: fill in contact details only where the
        // record is missing them — never overwrite what is already stored.
        const existingData = (customerDoc.data() || {}) as Partial<Customer>;
        const patch: { phone?: string; contactName?: string } = {};
        const existingPhone = (existingData.phone || '').replace(/\D/g, '');
        if (!existingPhone && data.dueCustomer?.phone) {
          patch.phone = data.dueCustomer.phone.trim();
        }
        if (!existingData.contactName && data.dueCustomer?.contactName) {
          patch.contactName = data.dueCustomer.contactName;
        }
        if (Object.keys(patch).length > 0) {
          transaction.update(customerRef, patch);
        }
      }

      // Credit can only spend the advance the customer really has (M2 guard).
      const customerDueForCredit = createCustomerInTx ? 0 : Number(customerDoc.data()?.dueBalance) || 0;
      const creditError = validateCreditApplied(
        Number(data.creditApplied) || 0,
        customerDueForCredit
      );
      if (creditError) throw new Error(creditError);

      let serverSubtotal = 0;
      const itemDocsMap: Record<string, { ref: any; data: Item; id: string }> = {};

      for (let i = 0; i < itemDocs.length; i++) {
        const snap = itemDocs[i];
        if (!snap.exists()) {
          throw new Error(`Item with id ${data.items[i].itemId} does not exist.`);
        }
        const itemData = snap.data() as Item;
        if (!resolveIsSalable(itemData)) {
          throw new Error(`Item "${itemData.title}" is a non-salable asset and cannot be sold.`);
        }
        const customPrice = (data.items[i] as any).price;
        const unitPrice =
          customPrice !== undefined && customPrice !== null && !isNaN(Number(customPrice)) && Number(customPrice) >= 0
            ? Number(customPrice)
            : (Number(itemData.sellingPrice) || 0);

        (data.items[i] as SaleItem).price = unitPrice;
        serverSubtotal += unitPrice * Number(data.items[i].quantity);

        itemDocsMap[snap.id] = {
          ref: snap.ref,
          data: itemData,
          id: snap.id,
        };
      }

      const discountError = validateDiscount(
        data.discountType === 'percentage'
          ? { type: 'percentage', value: Number(data.discountValue) || 0 }
          : data.discountType === 'amount'
            ? { type: 'amount', value: Number(data.discountValue) || 0 }
            : { type: 'none' },
        serverSubtotal
      );
      if (discountError) throw new Error(discountError);

      const discountTotal = data.discountType === 'percentage'
        ? serverSubtotal * ((Number(data.discountValue) || 0) / 100)
        : data.discountType === 'amount' ? (Number(data.discountValue) || 0) : 0;
      const effectiveBaseTotal = serverSubtotal - Math.min(serverSubtotal, discountTotal) + (Number(data.extraSales) || 0);
      const payableTotal = data.total !== undefined && !isNaN(Number(data.total)) && Number(data.total) >= 0
        ? Number(data.total)
        : effectiveBaseTotal;
      const paidError = validateAmountPaid(
        data.paymentMethod === 'Split' ? Number(data.amountPaid) : undefined,
        payableTotal
      );
      if (paidError) throw new Error(paidError);

      const lastSaleNumber = (metadataDoc.data() as Metadata)?.lastSaleNumber || 0;
      const newSaleNumber = lastSaleNumber + 1;
      const saleId = `SALE-${String(newSaleNumber).padStart(4, '0')}`;

      const { itemsWithPrices, totalProductionCost } = await deductSaleLinesFEFO(
        transaction,
        userId,
        itemDocsMap,
        data.items
      );

      const creditApplied = data.creditApplied || 0;
      const { subtotal: calculatedSubtotal, totalAfterDiscount, finalTotal, totalSaleProfit } = computeSaleTotals({
        items: itemsWithPrices,
        totalProductionCost,
        discountType: data.discountType,
        discountValue: data.discountValue,
        extraSales: Number(data.extraSales) || 0,
        totalOverride: data.total !== undefined && !isNaN(Number(data.total)) && Number(data.total) >= 0 ? Number(data.total) : undefined,
        creditApplied,
      });

      const newSaleRef = doc(salesCollection);

      const saleDataToSave: Omit<Sale, 'id'> & { date: Timestamp; creditApplied?: number } = {
        customerId: data.customerId,
        saleId,
        items: itemsWithPrices,
        subtotal: calculatedSubtotal,
        total: totalAfterDiscount,
        date: Timestamp.fromDate(saleDate) as any,
        discountType: data.discountType || 'none',
        discountValue: Number(data.discountValue) || 0,
        paymentMethod: finalTotal <= 0 ? 'Paid by Credit' : data.paymentMethod,
        extraSales: Number(data.extraSales) || 0,
      };

      if (creditApplied > 0) {
        saleDataToSave.creditApplied = creditApplied;
      }
      if (data.paymentMethod === 'Split' && data.amountPaid !== undefined) {
        saleDataToSave.amountPaid = Number(data.amountPaid) || 0;
        if (data.splitPaymentMethod) {
          saleDataToSave.splitPaymentMethod = data.splitPaymentMethod;
        }
      }

      transaction.set(newSaleRef, saleDataToSave);
      transaction.set(metadataRef, { lastSaleNumber: newSaleNumber }, { merge: true });

      const currentDue = customerDoc.data()?.dueBalance || 0;
      let finalDue = currentDue;

      if (creditApplied > 0) {
        finalDue += creditApplied;
      }

      if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
        const receivable = buildReceivable({
          paymentMethod: data.paymentMethod,
          amountPaid: data.amountPaid,
          finalTotal,
          totalSaleProfit,
          creditApplied,
          saleId,
          customerId: data.customerId,
        });

        if (receivable) {
          finalDue += receivable.amount;
          transaction.set(doc(transactionsCollection), {
            ...receivable,
            dueDate: Timestamp.fromDate(new Date()),
          });
        }
      }

      if (finalDue !== currentDue) {
        transaction.update(customerRef, { dueBalance: finalDue });
      }

      const saleForClient: Sale = {
        ...saleDataToSave,
        id: newSaleRef.id,
        total: totalAfterDiscount,
        date: saleDate.toISOString(),
      };

      return { success: true, sale: saleForClient };
    });

    await invalidateAppData(userId, {
      salesMasterPatch: { kind: 'upsert', sale: result.sale },
    });
    if (data.customerId) {
    }
    return result;

  } catch (e) {
    console.error("Sale creation failed: ", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function deleteSale(userId: string, saleId: string): Promise<{ success: boolean; error?: string }> {
  if (!db || !userId) return { success: false, error: "Database not configured." };

  try {
    const saleRef = doc(db, 'users', userId, 'sales', saleId);

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db!, 'users', userId);

      // --- READ PHASE ---
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error("Sale not found.");
      }
      const saleToDelete = docToSale(saleDoc);

      const customerRef = doc(userRef, 'customers', saleToDelete.customerId);
      const customerDoc = await transaction.get(customerRef);
      if (!customerDoc.exists()) {
        console.warn(`Customer ${saleToDelete.customerId} not found during sale deletion.`);
      }

      const itemRefs = saleToDelete.items.map(item => doc(userRef, 'items', item.itemId));
      const itemDocs = await Promise.all(itemRefs.map(ref => transaction.get(ref)));

      const transactionsCollection = collection(userRef, 'transactions');
      const relatedTransactionsQuery = query(transactionsCollection, where('saleId', '==', saleToDelete.saleId));
      const relatedTransactionDocs = await getDocs(relatedTransactionsQuery);

      // Batch restore reads must also complete before the first write.
      const restorePlans = await Promise.all(
        saleToDelete.items.map((line) => planBatchRestores(transaction, userId, line))
      );

      // --- WRITE PHASE ---

      // 1. Restore item stock and return quantities to originating batches
      for (let i = 0; i < itemDocs.length; i++) {
        const itemDoc = itemDocs[i];
        if (itemDoc.exists()) {
          const newStock = Number(itemDoc.data().stock) + Number(saleToDelete.items[i].quantity);
          transaction.update(itemDoc.ref, { stock: newStock });
          applyBatchRestores(transaction, restorePlans[i]);
        }
      }

      // 2. Adjust customer balance
      if (customerDoc.exists()) {
        let amountToReverse = 0;
        if (saleToDelete.paymentMethod === 'Due' || saleToDelete.paymentMethod === 'Split') {
          amountToReverse = saleToDelete.total - (saleToDelete.amountPaid || 0);
        }
        const creditReversal = saleToDelete.creditApplied || 0;
        const currentDue = customerDoc.data().dueBalance || 0;
        const newDueBalance = currentDue - amountToReverse + creditReversal;
        transaction.update(customerRef, { dueBalance: newDueBalance });
      }

      // 3. Delete related transactions
      relatedTransactionDocs.forEach(doc => {
        transaction.delete(doc.ref);
      });

      // 4. Delete the sale document
      transaction.delete(saleRef);
    });

    await invalidateAppData(userId, {
      salesMasterPatch: { kind: 'remove', saleId: saleId },
    });
    return { success: true };
  } catch (e) {
    console.error("Sale deletion failed: ", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateSale(
  userId: string,
  saleDocId: string,
  data: Omit<Sale, 'id' | 'saleId' | 'subtotal' | 'total'> & { creditApplied?: number; total?: number; date?: string }
): Promise<{ success: boolean; error?: string; sale?: Sale }> {
  if (!db || !userId || !saleDocId) return { success: false, error: "Database not configured or invalid sale ID." };

  try {
    const userRef = doc(db, 'users', userId);
    const saleRef = doc(userRef, 'sales', saleDocId);
    const oldSaleSnap = await getDoc(saleRef);
    if (!oldSaleSnap.exists()) {
      return { success: false, error: "Sale not found." };
    }
    const oldSale = docToSale(oldSaleSnap);

    const itemsCollection = collection(userRef, 'items');
    const customersCollection = collection(userRef, 'customers');
    const transactionsCollection = collection(userRef, 'transactions');
    const saleDate = data.date ? new Date(data.date) : new Date(oldSale.date);

    const relatedTransactionsQuery = query(transactionsCollection, where('saleId', '==', oldSale.saleId));
    const relatedTransactionDocs = await getDocs(relatedTransactionsQuery);

    const allItemIdsToFetch = new Set<string>();
    data.items.forEach((item) => allItemIdsToFetch.add(item.itemId));
    oldSale.items.forEach((item) => allItemIdsToFetch.add(item.itemId));

    // Server-side law (M3), same as addSale: whole positive quantities and
    // prices locked to the item record — the browser's numbers never win.
    const itemsError = validateSaleItems(data.items);
    if (itemsError) return { success: false, error: itemsError };

    let serverSubtotal = 0;
    const priceByItemId = new Map<string, number>();
    const selectedItemRefs = Array.from(allItemIdsToFetch).map((id) => doc(itemsCollection, id));
    const selectedItemSnaps = await Promise.all(selectedItemRefs.map((ref) => getDoc(ref)));

    for (let i = 0; i < selectedItemSnaps.length; i++) {
      const snap = selectedItemSnaps[i];
      if (!snap.exists()) {
        continue;
      }
      const itemData = snap.data() as Item;
      if (!resolveIsSalable(itemData)) {
        return { success: false, error: `Item "${itemData.title}" is a non-salable asset and cannot be sold.` };
      }
      priceByItemId.set(snap.id, itemData.sellingPrice);
    }
    for (const line of data.items) {
      const serverDefaultPrice = priceByItemId.get(line.itemId) ?? 0;
      const customPrice = (line as any).price;
      const unitPrice =
        customPrice !== undefined && customPrice !== null && !isNaN(Number(customPrice)) && Number(customPrice) >= 0
          ? Number(customPrice)
          : serverDefaultPrice;
      (line as SaleItem).price = unitPrice;
      serverSubtotal += unitPrice * Number(line.quantity);
    }

    const discountError = validateDiscount(
      data.discountType === 'percentage'
        ? { type: 'percentage', value: Number(data.discountValue) || 0 }
        : data.discountType === 'amount'
          ? { type: 'amount', value: Number(data.discountValue) || 0 }
          : { type: 'none' },
      serverSubtotal
    );
    if (discountError) return { success: false, error: discountError };

    const updDiscountTotal = data.discountType === 'percentage'
      ? serverSubtotal * ((Number(data.discountValue) || 0) / 100)
      : data.discountType === 'amount' ? (Number(data.discountValue) || 0) : 0;
    const effectiveBaseTotal = serverSubtotal - Math.min(serverSubtotal, updDiscountTotal) + (Number(data.extraSales) || 0);
    const payableTotal = data.total !== undefined && !isNaN(Number(data.total)) && Number(data.total) >= 0
      ? Number(data.total)
      : effectiveBaseTotal;
    const updPaidError = validateAmountPaid(
      data.paymentMethod === 'Split' ? Number(data.amountPaid) : undefined,
      payableTotal
    );
    if (updPaidError) return { success: false, error: updPaidError };

    const result = await runTransaction(db, async (transaction) => {
      const oldCustomerRef = doc(customersCollection, oldSale.customerId);
      const newCustomerRef = doc(customersCollection, data.customerId);

      const oldCustomerDoc = await transaction.get(oldCustomerRef);
      const newCustomerDoc =
        oldSale.customerId === data.customerId
          ? oldCustomerDoc
          : await transaction.get(newCustomerRef);

      if (!newCustomerDoc.exists()) {
        throw new Error(`Customer with id ${data.customerId} does not exist!`);
      }

      // Credit can only spend the advance the customer really has (M2 guard).
      const updCreditError = validateCreditApplied(
        Number(data.creditApplied) || 0,
        Number(newCustomerDoc.data()?.dueBalance) || 0
      );
      if (updCreditError) throw new Error(updCreditError);

      const itemDocs = await Promise.all(selectedItemRefs.map((ref) => transaction.get(ref)));
      const itemDocsMap: Record<string, { ref: any; data: Item; id: string }> = {};
      itemDocs.forEach((d) => {
        if (d.exists()) {
          itemDocsMap[d.id] = {
            ref: d.ref,
            data: d.data() as Item,
            id: d.id,
          };
        }
      });

      // Batch restore reads must complete before the first staged write.
      const restorePlans = await Promise.all(
        oldSale.items.map((oldItem) => planBatchRestores(transaction, userId, oldItem))
      );

      // 1. Restore stock from oldSale.items to the exact old item IDs
      //    (item total plus the originating batches)
      oldSale.items.forEach((oldItem, index) => {
        const itemState = itemDocsMap[oldItem.itemId];
        if (itemState) {
          const restoredStock = (Number(itemState.data.stock) || 0) + Number(oldItem.quantity);
          itemState.data.stock = restoredStock;
          transaction.update(itemState.ref, { stock: restoredStock });
          applyBatchRestores(transaction, restorePlans[index]);
        }
      });

      // 2. Deduct stock from newSale.items strictly on the selected item IDs (FEFO)
      const { itemsWithPrices, totalProductionCost } = await deductSaleLinesFEFO(
        transaction,
        userId,
        itemDocsMap,
        data.items
      );

      const creditApplied = data.creditApplied || 0;
      const { subtotal: calculatedSubtotal, totalAfterDiscount, finalTotal, totalSaleProfit } = computeSaleTotals({
        items: itemsWithPrices,
        totalProductionCost,
        discountType: data.discountType,
        discountValue: data.discountValue,
        extraSales: Number(data.extraSales) || 0,
        totalOverride: data.total !== undefined && !isNaN(Number(data.total)) && Number(data.total) >= 0 ? Number(data.total) : undefined,
        creditApplied,
      });

      // 4. Adjust customer due balances
      if (oldCustomerDoc.exists()) {
        let oldAmountDue = 0;
        if (oldSale.paymentMethod === 'Due' || oldSale.paymentMethod === 'Split') {
          oldAmountDue = oldSale.total - (oldSale.amountPaid || 0);
        }
        const oldCredit = oldSale.creditApplied || 0;
        const currentOldDue = oldCustomerDoc.data().dueBalance || 0;
        const newOldCustomerDue = currentOldDue - oldAmountDue + oldCredit;

        if (oldSale.customerId === data.customerId) {
          let newAmountDue = 0;
          if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
            if (data.paymentMethod === 'Split' && data.amountPaid && data.amountPaid > 0) {
              newAmountDue = finalTotal - data.amountPaid;
            } else {
              newAmountDue = finalTotal;
            }
          }
          const finalCustomerDue = newOldCustomerDue + newAmountDue + creditApplied;
          transaction.update(newCustomerRef, { dueBalance: finalCustomerDue });
        } else {
          transaction.update(oldCustomerRef, { dueBalance: newOldCustomerDue });

          const currentNewDue = newCustomerDoc.data()?.dueBalance || 0;
          let newAmountDue = 0;
          if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
            if (data.paymentMethod === 'Split' && data.amountPaid && data.amountPaid > 0) {
              newAmountDue = finalTotal - data.amountPaid;
            } else {
              newAmountDue = finalTotal;
            }
          }
          const finalNewCustomerDue = currentNewDue + newAmountDue + creditApplied;
          transaction.update(newCustomerRef, { dueBalance: finalNewCustomerDue });
        }
      }

      // 5. Delete old related receivables
      relatedTransactionDocs.forEach((d) => transaction.delete(d.ref));

      // 6. Create new receivable transaction if Due or Split
      if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
        const receivable = buildReceivable({
          paymentMethod: data.paymentMethod,
          amountPaid: data.amountPaid,
          finalTotal,
          totalSaleProfit,
          creditApplied,
          saleId: oldSale.saleId,
          customerId: data.customerId,
        });

        if (receivable) {
          transaction.set(doc(transactionsCollection), {
            ...receivable,
            dueDate: Timestamp.fromDate(new Date()),
          });
        }
      }

      const updatedSaleData: Omit<Sale, 'id'> & { date: Timestamp; creditApplied?: number } = {
        customerId: data.customerId,
        saleId: oldSale.saleId,
        items: itemsWithPrices,
        subtotal: calculatedSubtotal,
        total: totalAfterDiscount,
        date: Timestamp.fromDate(saleDate) as any,
        discountType: data.discountType || 'none',
        discountValue: Number(data.discountValue) || 0,
        paymentMethod: finalTotal <= 0 ? 'Paid by Credit' : data.paymentMethod,
        extraSales: Number(data.extraSales) || 0,
      };

      if (creditApplied > 0) {
        updatedSaleData.creditApplied = creditApplied;
      }
      if (data.paymentMethod === 'Split' && data.amountPaid !== undefined) {
        updatedSaleData.amountPaid = Number(data.amountPaid) || 0;
        if (data.splitPaymentMethod) {
          updatedSaleData.splitPaymentMethod = data.splitPaymentMethod;
        }
      }

      transaction.update(saleRef, updatedSaleData);

      const saleForClient: Sale = {
        ...updatedSaleData,
        id: saleDocId,
        total: totalAfterDiscount,
        date: saleDate.toISOString(),
      };

      return { success: true, sale: saleForClient };
    });

    await invalidateAppData(userId, {
      salesMasterPatch: result.sale ? { kind: 'upsert', sale: result.sale } : undefined,
    });
    if (data.customerId) {
    }
    return result;
  } catch (e) {
    console.error("Sale update failed: ", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

