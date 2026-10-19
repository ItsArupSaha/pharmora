import { Timestamp } from 'firebase/firestore';
import type { Sale, Item, Purchase } from '../types';

export function toNum(v: unknown, fallback = 0): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export function calculateCashAndBank(
  filteredCapital: any[],
  filteredDonations: any[],
  filteredSales: any[],
  paidTransactionsUpToCutoff: any[],
  filteredExpenses: any[],
  filteredTransfers: any[]
) {
    let cash = 0;
    let bank = 0;
    let otherAssets = 0;

    filteredCapital.forEach((capital: any) => {
        const amt = toNum(capital.amount);
        if (capital.paymentMethod === 'Cash') {
            cash += amt;
        } else if (capital.paymentMethod === 'Bank') {
            bank += amt;
        } else if (capital.paymentMethod === 'Asset') {
            otherAssets += amt;
        }
    });

    filteredDonations.forEach((donation: any) => {
        if (donation.source !== 'Initial Capital' && donation.donorName !== 'Internal Transfer') {
            const amt = toNum(donation.amount);
            if (donation.paymentMethod === 'Cash') {
                cash += amt;
            } else if (donation.paymentMethod === 'Bank') {
                bank += amt;
            }
        }
    });

    filteredSales.forEach((sale: any) => {
        const total = toNum(sale.total);
        const amountPaid = toNum(sale.amountPaid);
        if (sale.paymentMethod === 'Cash') {
            cash += total;
        } else if (sale.paymentMethod === 'Bank') {
            bank += total;
        } else if (sale.paymentMethod === 'Split' && amountPaid > 0) {
            if (sale.splitPaymentMethod === 'Bank') {
                bank += amountPaid;
            } else {
                cash += amountPaid;
            }
        }
    });

    paidTransactionsUpToCutoff.forEach((t: any) => {
        if (t.type === 'Receivable') {
            const description = t.description || '';
            if (description.startsWith('Payment from customer')) {
                const amt = toNum(t.amount);
                if (t.paymentMethod === 'Cash') {
                    cash += amt;
                } else if (t.paymentMethod === 'Bank') {
                    bank += amt;
                }
            }
        }
    });

    filteredExpenses.forEach((expense: any) => {
        const amt = toNum(expense.amount);
        if (expense.paymentMethod === 'Bank') {
            bank -= amt;
        } else {
            cash -= amt;
        }
    });

    filteredTransfers.forEach((transfer: any) => {
        const amt = toNum(transfer.amount);
        if (transfer.from === 'Cash') {
            cash -= amt;
        } else if (transfer.from === 'Bank') {
            bank -= amt;
        }

        if (transfer.to === 'Cash') {
            cash += amt;
        } else if (transfer.to === 'Bank') {
            bank += amt;
        }
    });

    return { cash, bank, otherAssets };
}

// Purchases carry no item reference, so lines match items by category + exact
// name spelling — the only linkage the purchase schema stores.
const purchaseLineKey = (categoryId: string, itemName: string) => `${categoryId}::${itemName}`;

export function calculateStockAndAssets(
  allItems: Item[],
  allSales: Sale[],
  allPurchases: Purchase[],
  filteredPurchases: Purchase[],
  isBeforeOrOnCutoff: (date: any) => boolean,
  isLiveSnapshot: boolean
) {
    let stockValue = 0;
    let assetItemsValue = 0;

    // Historical view only: rebuild the stock that existed on the cutoff date
    // by undoing every transaction recorded after it. Each ledger is tallied
    // in a single pass and each item then reads its tally with one Map
    // lookup, instead of rescanning every sale and purchase once per item.
    // On the live snapshot item.stock already reflects the present, so the
    // tallies stay empty and the lookups add zero.
    const soldAfterCutoff = new Map<string, number>();
    const purchasedAfterCutoff = new Map<string, number>();
    if (!isLiveSnapshot) {
        allSales.forEach((sale) => {
            if (isBeforeOrOnCutoff(sale.date)) return;
            for (const line of sale.items) {
                soldAfterCutoff.set(line.itemId, (soldAfterCutoff.get(line.itemId) ?? 0) + toNum(line.quantity));
            }
        });
        allPurchases.forEach((purchase) => {
            if (isBeforeOrOnCutoff(purchase.date)) return;
            for (const line of purchase.items) {
                const key = purchaseLineKey(line.categoryId, line.itemName);
                purchasedAfterCutoff.set(key, (purchasedAfterCutoff.get(key) ?? 0) + toNum(line.quantity));
            }
        });
    }

    allItems.forEach((item: Item) => {
        const closingStockAsOfDate =
            toNum(item.stock) +
            (soldAfterCutoff.get(item.id) ?? 0) -
            (purchasedAfterCutoff.get(purchaseLineKey(item.categoryId, item.title)) ?? 0);

        const unitCost = toNum(item.productionPrice);
        const value = closingStockAsOfDate > 0 ? unitCost * closingStockAsOfDate : 0;
        
        const catName = (item.categoryName || '').toLowerCase();
        if (catName === 'assets' || catName === 'surgicals') {
            assetItemsValue += value;
        } else {
            stockValue += value;
        }
    });

    const officeAssetsValue = filteredPurchases
        .flatMap((p: any) => p.items)
        .filter((i: any) => i.categoryName === 'Office Asset')
        .reduce((sum: number, item: any) => sum + toNum(item.cost) * toNum(item.quantity), 0) + assetItemsValue;

    return { stockValue, officeAssetsValue };
}
