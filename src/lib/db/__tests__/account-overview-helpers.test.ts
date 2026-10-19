import { describe, expect, it } from 'vitest';
import { calculateCashAndBank, calculateStockAndAssets } from '../account-overview-helpers';

// Characterization tests for the Business Overview money equations. They
// lock the accounting rules the page relies on so any future change to the
// math has to consciously update these expectations.

const always = () => true;

describe('calculateCashAndBank', () => {
  it('adds capital by payment method and tracks Asset capital separately', () => {
    const { cash, bank, otherAssets } = calculateCashAndBank(
      [
        { amount: 1000, paymentMethod: 'Cash' },
        { amount: 500, paymentMethod: 'Bank' },
        { amount: 300, paymentMethod: 'Asset' },
      ],
      [], [], [], [], []
    );
    expect(cash).toBe(1000);
    expect(bank).toBe(500);
    expect(otherAssets).toBe(300);
  });

  it('counts only real donations (skips Initial Capital and Internal Transfer)', () => {
    const { cash } = calculateCashAndBank(
      [],
      [
        { amount: 200, paymentMethod: 'Cash', source: 'Donation' },
        { amount: 999, paymentMethod: 'Cash', source: 'Initial Capital' },
        { amount: 888, paymentMethod: 'Cash', donorName: 'Internal Transfer' },
      ],
      [], [], [], []
    );
    expect(cash).toBe(200);
  });

  it('collects cash and bank sales, split sales by their paid method', () => {
    const { cash, bank } = calculateCashAndBank(
      [],
      [],
      [
        { total: 100, paymentMethod: 'Cash' },
        { total: 50, paymentMethod: 'Bank' },
        { total: 80, amountPaid: 30, paymentMethod: 'Split', splitPaymentMethod: 'Bank' },
      ],
      [], [], []
    );
    expect(cash).toBe(100);
    expect(bank).toBe(80); // 50 + 30 split paid to bank
  });

  it('adds customer due payments received in cash or bank', () => {
    const { cash, bank } = calculateCashAndBank(
      [], [],
      [],
      [
        { type: 'Receivable', amount: 70, paymentMethod: 'Cash', description: 'Payment from customer X' },
        { type: 'Receivable', amount: 40, paymentMethod: 'Bank', description: 'Payment from customer Y' },
        { type: 'Receivable', amount: 10, paymentMethod: 'Cash', description: 'Unrelated record' },
      ],
      [], []
    );
    expect(cash).toBe(70);
    expect(bank).toBe(40);
  });

  it('subtracts expenses by method (default cash) and negative refunds add back', () => {
    const { cash, bank } = calculateCashAndBank(
      [], [], [],
      [],
      [
        { amount: 60, paymentMethod: 'Cash' },
        { amount: 25, paymentMethod: 'Bank' },
        { amount: 100 }, // no method = cash convention
        { amount: -50, paymentMethod: 'Bank' }, // supplier refund
      ],
      []
    );
    expect(cash).toBe(-160); // -60 -100
    expect(bank).toBe(25); // -25 +50
  });

  it('moves money between cash and bank on transfers', () => {
    const { cash, bank } = calculateCashAndBank([], [], [], [], [], [
      { amount: 80, from: 'Cash', to: 'Bank' },
    ]);
    expect(cash).toBe(-80);
    expect(bank).toBe(80);
  });
});

describe('calculateStockAndAssets', () => {
  it('live snapshot values current stock directly, ignoring passed transactions', () => {
    const items = [
      { id: 'a', categoryId: 'c1', categoryName: 'Tablet', title: 'Napa', stock: 10, productionPrice: 2 },
      { id: 'b', categoryId: 'c2', categoryName: 'Surgicals', title: 'Forceps', stock: 1, productionPrice: 500 },
    ] as any;
    const sales = [{ date: '2099-01-01', items: [{ itemId: 'a', quantity: 3 }] }] as any;
    const purchases = [{ date: '2099-01-01', items: [{ categoryId: 'c1', itemName: 'Napa', quantity: 5 }] }] as any;
    const { stockValue, officeAssetsValue } = calculateStockAndAssets(items, sales, purchases, purchases, always, true);
    expect(stockValue).toBe(20); // 10 × 2 — no after-cutoff adjustments on the live view
    expect(officeAssetsValue).toBe(500); // surgicals counted as assets
  });

  it('rebuilds closing stock for a past date: adds sales after cutoff back, removes purchases after', () => {
    const items = [
      { id: 'a', categoryId: 'c1', categoryName: 'Tablet', title: 'Napa', stock: 10, productionPrice: 2 },
    ] as any;
    const cutoff = new Date('2026-08-01');
    const isBefore = (d: any) => new Date(d) <= cutoff;
    const sales = [
      { date: '2026-07-15', items: [{ itemId: 'a', quantity: 4 }] }, // before cutoff — already reflected
      { date: '2026-08-15', items: [{ itemId: 'a', quantity: 3 }] }, // after cutoff — add back
    ] as any;
    const purchases = [
      { date: '2026-08-10', items: [{ categoryId: 'c1', itemName: 'Napa', quantity: 5 }] }, // after — subtract
    ] as any;
    const { stockValue } = calculateStockAndAssets(items, sales, purchases, purchases, isBefore, false);
    // 10 + 3 sold later − 5 purchased later = 8 units × 2 = 16
    expect(stockValue).toBe(16);
  });

  it('counts every duplicate line of the same item, not just the first match', () => {
    const items = [
      { id: 'a', categoryId: 'c1', categoryName: 'Tablet', title: 'Napa', stock: 10, productionPrice: 2 },
    ] as any;
    const cutoff = new Date('2026-08-01');
    const isBefore = (d: any) => new Date(d) <= cutoff;
    const sales = [
      { date: '2026-08-15', items: [{ itemId: 'a', quantity: 2 }, { itemId: 'a', quantity: 3 }] },
    ] as any;
    const { stockValue } = calculateStockAndAssets(items, sales, [], [], isBefore, false);
    // 10 + (2 + 3) sold later = 15 units × 2 = 30
    expect(stockValue).toBe(30);
  });
});
