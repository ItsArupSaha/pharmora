import type { Sale, SaleItem } from '../types';

export type SaleDiscountType = 'none' | 'percentage' | 'amount';
export type SalePaymentMethod = 'Cash' | 'Bank' | 'Due' | 'Split' | 'Paid by Credit';

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  totalAfterDiscount: number;
  finalTotal: number;
  totalSaleProfit: number;
}

export interface SaleTotalsInput {
  items: SaleItem[];
  totalProductionCost: number;
  discountType: SaleDiscountType;
  discountValue?: number;
  /** Service/extra sales added on top of item lines — revenue with no cost. */
  extraSales?: number;
  /** Direct override of the total sale amount (e.g. rounded or edited in POS). */
  totalOverride?: number;
  creditApplied: number;
}

/**
 * Single source of truth for sale money math.
 * - subtotal = Σ price × qty
 * - discount clamped to the item subtotal
 * - extra sales (no cost) added after the discount
 * - totalOverride sets totalAfterDiscount directly if provided (>= 0)
 * - profit = totalAfterDiscount − production cost
 * - finalTotal = totalAfterDiscount − credit applied
 */
export function computeSaleTotals(input: SaleTotalsInput): SaleTotals {
  const subtotal = input.items.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );

  let discountAmount = 0;
  if (input.discountType === 'percentage' && input.discountValue !== undefined) {
    discountAmount = subtotal * (input.discountValue / 100);
  } else if (input.discountType === 'amount' && input.discountValue !== undefined) {
    discountAmount = input.discountValue;
  }
  discountAmount = Math.min(subtotal, discountAmount);

  let totalAfterDiscount = subtotal - discountAmount + (Number(input.extraSales) || 0);

  if (input.totalOverride !== undefined && input.totalOverride >= 0) {
    totalAfterDiscount = input.totalOverride;
  }

  const totalSaleProfit = totalAfterDiscount - input.totalProductionCost;
  const finalTotal = totalAfterDiscount - input.creditApplied;

  return { subtotal, discountAmount, totalAfterDiscount, finalTotal, totalSaleProfit };
}

/**
 * The outstanding bill a stored sale currently attributes to its customer:
 * everything not settled at the till. Cash/Bank settle fully (0); credit
 * applied on the sale settles its own share; the rest is the receivable as
 * originally created. This is the unit updateSale re-attribution trades in —
 * an identical re-save yields a balance delta of zero by construction, and
 * money already collected against the receivable is never double-counted.
 */
export function saleBillAmount(
  sale: Pick<Sale, 'paymentMethod' | 'total'> & Partial<Pick<Sale, 'creditApplied' | 'amountPaid'>>
): number {
  const credit = Number(sale.creditApplied) || 0;
  if (sale.paymentMethod === 'Due') {
    return Math.max(0, (Number(sale.total) || 0) - credit);
  }
  if (sale.paymentMethod === 'Split') {
    return Math.max(0, (Number(sale.total) || 0) - credit - (Number(sale.amountPaid) || 0));
  }
  if (sale.paymentMethod === 'Paid by Credit') {
    return Math.max(0, credit);
  }
  return 0;
}

export interface ReceivableDraft {
  description: string;
  amount: number;
  status: 'Pending';
  type: 'Receivable';
  customerId: string;
  saleId: string;
  totalSaleProfit: number;
  remainingProfit: number;
}

export interface ReceivableInput {
  paymentMethod: SalePaymentMethod;
  amountPaid?: number;
  finalTotal: number;
  totalSaleProfit: number;
  creditApplied: number;
  saleId: string;
  customerId: string;
}

/**
 * Returns the receivable ledger entry for Due/Split sales, or null when
 * nothing remains owed. Profit recognition is proportional to what was
 * paid at sale time (Split); the rest is recognized on collection.
 */
export function buildReceivable(input: ReceivableInput): ReceivableDraft | null {
  if (input.paymentMethod !== 'Due' && input.paymentMethod !== 'Split') return null;

  let dueAmount = input.finalTotal;
  let realizedProfit = 0;

  if (input.paymentMethod === 'Split' && input.amountPaid && input.amountPaid > 0) {
    dueAmount = input.finalTotal - input.amountPaid;
    if (input.finalTotal > 0) {
      realizedProfit = input.totalSaleProfit * (input.amountPaid / input.finalTotal);
    }
  }

  if (dueAmount <= 0) return null;

  return {
    description: `Due from ${input.saleId}`,
    amount: dueAmount,
    status: 'Pending',
    type: 'Receivable',
    customerId: input.customerId,
    saleId: input.saleId,
    totalSaleProfit: input.totalSaleProfit,
    remainingProfit: input.totalSaleProfit - realizedProfit,
  };
}
