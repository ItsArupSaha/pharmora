import { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getExpenses } from './expenses';
import { getItems } from './items';
import { getPurchases } from './purchases';
import { getSales } from './sales';
import { getSecurityDeposits } from './security';
import {
  toNum,
  calculateCashAndBank,
  calculateStockAndAssets,
} from './account-overview-helpers';
import { getRawCapital, getRawDonations, getRawTransactions, getRawTransfers } from './ledger-docs';


export async function getAccountOverview(userId: string, asOfDate?: Date) {
    if (!db) {
        throw new Error("Database not connected");
    }

    // Every input below is a ledger-version-guarded cached master, so this
    // join runs on warm data after the first read per data change. Computing
    // per as-of-date on every call (instead of caching per date) is what makes
    // flipping dates free while staying live: any mutation bumps the ledger
    // version and every master refetches on the next read.
    const cutoffTimestamp = asOfDate ? Timestamp.fromDate(asOfDate) : undefined;

    const [allItems, allSales, allExpenses, allTransactions, allPurchases, allCapital, allTransfers, allDonations, allSecurityDeposits] = await Promise.all([
        getItems(userId),
        getSales(userId),
        getExpenses(userId),
        getRawTransactions(userId),
        getPurchases(userId),
        getRawCapital(userId),
        getRawTransfers(userId),
        getRawDonations(userId),
        getSecurityDeposits(userId),
    ]);

    const cutoffTs = (() => {
        if (!asOfDate) return undefined;
        // Ensure cutoff is End of Day
        const cutoff = new Date(asOfDate);
        cutoff.setHours(23, 59, 59, 999);
        return Timestamp.fromDate(cutoff);
    })();

    const isBeforeOrOnCutoff = (date: any): boolean => {
        if (!cutoffTs) return true;
        if (!date) return false;

        const dateTimestamp = date instanceof Timestamp ? date : Timestamp.fromDate(new Date(date));
        return dateTimestamp.toMillis() <= cutoffTs.toMillis();
    };

    // Nothing can exist after a cutoff that is now or later, so item.stock
    // already reflects the snapshot and the per-item back-calculation in
    // calculateStockAndAssets would only scan every sale to add zero back.
    const isLiveSnapshot = !cutoffTs || cutoffTs.toMillis() >= Date.now();

    const filteredCapital = allCapital.filter((capital: any) =>
        capital.source === 'Initial Capital' || isBeforeOrOnCutoff(capital.date)
    );
    const filteredDonations = allDonations.filter((donation: any) => isBeforeOrOnCutoff(donation.date));
    const filteredSales = allSales.filter((sale: any) => isBeforeOrOnCutoff(sale.date));
    const filteredExpenses = allExpenses.filter((expense: any) => isBeforeOrOnCutoff(expense.date));
    const filteredTransfers = allTransfers.filter((transfer: any) => isBeforeOrOnCutoff(transfer.date));
    const filteredPurchases = allPurchases.filter((purchase: any) => isBeforeOrOnCutoff(purchase.date));
    const filteredTransactions = allTransactions.filter((t: any) => isBeforeOrOnCutoff(t.dueDate));

    const paidTransactionsUpToCutoff = filteredTransactions.filter((t: any) => t.status === 'Paid');

    /** Payables from purchases: description contains purchase id (see purchases.ts). PUR-0001 and PUR-A-0001 both match PUR-[^\s]+. */
    const parsePayablePurchaseId = (description: string): string | null => {
        const d = description || '';
        const balanceMatch = d.match(/Balance for Purchase\s+(PUR-[^\s]+)/i);
        if (balanceMatch) return balanceMatch[1];
        const purchaseMatch = d.match(/Purchase\s+(PUR-[^\s]+)/i);
        if (purchaseMatch) return purchaseMatch[1];
        return null;
    };

    /**
     * For a paid payable, find the payment trace transaction to determine when it was paid.
     * payPayable() creates a trace with description "Payment for: <original description>"
     * and dueDate = the actual payment date.
     */
    const findPaymentTraceDate = (originalDescription: string): Date | null => {
        const traceDescription = `Payment for: ${originalDescription}`;
        const trace = allTransactions.find(
            (t: any) =>
                t.type === 'Payable' &&
                t.status === 'Paid' &&
                !t.isHiddenFromHistory &&
                (t.description === traceDescription || t.description?.startsWith(`Payment for: ${originalDescription}`))
        );
        if (!trace) return null;
        if (trace.dueDate instanceof Timestamp) return trace.dueDate.toDate();
        return trace.dueDate ? new Date(trace.dueDate as string | number | Date) : null;
    };

    /**
     * A payable obligation existed as-of the cutoff if:
     *   - The obligation was created (dueDate or linked purchase) on or before the cutoff, AND
     *   - It was either still Pending, OR it was paid AFTER the cutoff date.
     *
     * This ensures historical balance sheets correctly show payables that were later settled.
     */
    const isPayableOutstandingAsOf = (t: any): boolean => {
        if (!asOfDate) return true;

        // Check whether the obligation existed by the cutoff date
        const obligationExistedByThen = (() => {
            if (isBeforeOrOnCutoff(t.dueDate)) return true;
            const pid = parsePayablePurchaseId(t.description);
            if (!pid) return false;
            const purchase = allPurchases.find((p: any) => p.purchaseId === pid);
            return Boolean(purchase && isBeforeOrOnCutoff(purchase.date));
        })();

        if (!obligationExistedByThen) return false;

        // If still pending, it's definitely outstanding
        if (t.status === 'Pending') return true;

        // If paid, only count it as outstanding as-of the cutoff if payment happened AFTER the cutoff
        if (t.status === 'Paid') {
            const paymentDate = findPaymentTraceDate(t.description);
            if (!paymentDate) {
                // No trace found — fall back to: if it was paid and we can't tell when,
                // assume it was paid after the cutoff (conservative: avoids understating liabilities)
                return true;
            }
            // Payment date is after the cutoff → obligation was still outstanding as-of cutoff
            return paymentDate.getTime() > (asOfDate instanceof Date ? asOfDate : new Date(asOfDate)).getTime();
        }

        return false;
    };

    let { cash, bank, otherAssets } = calculateCashAndBank(
        filteredCapital,
        filteredDonations,
        filteredSales,
        paidTransactionsUpToCutoff,
        filteredExpenses,
        filteredTransfers
    );

    // Apply security deposits impact on Cash/Bank
    const filteredSecurityDeposits = allSecurityDeposits.filter((sec: any) => isBeforeOrOnCutoff(sec.date));
    
    filteredSecurityDeposits.forEach((sec: any) => {
        const amt = toNum(sec.amount);
        // Decrease cash/bank when security deposit is paid
        if (sec.paymentMethod === 'Cash') {
            cash -= amt;
        } else if (sec.paymentMethod === 'Bank') {
            bank -= amt;
        }

        // Increase cash/bank if security deposit is refunded on/before cutoff date
        if (sec.status === 'Refunded' && sec.refundDate && isBeforeOrOnCutoff(sec.refundDate)) {
            const refundMethod = sec.refundPaymentMethod || sec.paymentMethod;
            if (refundMethod === 'Cash') {
                cash += amt;
            } else if (refundMethod === 'Bank') {
                bank += amt;
            }
        }
    });

    // Security deposits that are outstanding (Refundable OR Refunded AFTER cutoff)
    const activeSecurityDeposits = filteredSecurityDeposits.filter((sec: any) => {
        if (sec.status === 'Refundable') return true;
        if (sec.status === 'Refunded') {
            if (!sec.refundDate) return false;
            return !isBeforeOrOnCutoff(sec.refundDate);
        }
        return false;
    });

    const securityDepositsValue = activeSecurityDeposits.reduce((sum: number, sec: any) => sum + toNum(sec.amount), 0);

    const { stockValue, officeAssetsValue } = calculateStockAndAssets(
        allItems,
        allSales,
        allPurchases,
        filteredPurchases,
        isBeforeOrOnCutoff,
        isLiveSnapshot
    );

    // Include payables that were outstanding as-of the cutoff date.
    // This covers: currently-Pending payables, AND payables that were Paid AFTER the cutoff
    // (i.e. they were a real liability on that historical date even though settled later).
    // Exclude trace transactions (isHiddenFromHistory=false, description starts with "Payment for:")
    // and exclude the payment traces themselves (they are the settlement records, not obligations).
    const pendingPayables = allTransactions.filter((t: any) => {
        if (t.type !== 'Payable') return false;
        // Skip payment trace records — these are settlement logs, not obligations
        if (t.description?.startsWith('Payment for:')) return false;
        return isPayableOutstandingAsOf(t);
    });
    const payables = pendingPayables.reduce((sum: number, t: any) => sum + toNum(t.amount), 0);

    const totalAssets = cash + bank + stockValue + officeAssetsValue + securityDepositsValue;
    const equity = totalAssets - payables;

    const totalCapital = filteredCapital.reduce((sum, cap) => sum + toNum(cap.amount), 0);
    const retainedEarnings = equity - totalCapital;

    const initialCashCapital = filteredCapital
        .filter((cap: any) => cap.source === 'Initial Capital' && cap.paymentMethod === 'Cash')
        .reduce((sum: number, cap: any) => sum + toNum(cap.amount), 0);

    const initialBankCapital = filteredCapital
        .filter((cap: any) => cap.source === 'Initial Capital' && cap.paymentMethod === 'Bank')
        .reduce((sum: number, cap: any) => sum + toNum(cap.amount), 0);

    const totalExpenses = filteredExpenses.reduce((sum: number, expense: any) => sum + toNum(expense.amount), 0);
    const totalStockCount = allItems.reduce((sum: number, item: any) => sum + toNum(item.stock), 0);

    return {
        cash,
        bank,
        stockValue,
        officeAssetsValue,
        securityDepositsValue,
        totalAssets,
        payables,
        equity,
        otherAssets,
        totalCapital,
        retainedEarnings,
        initialCashCapital,
        initialBankCapital,
        totalExpenses,
        totalStockCount,
    };
}

