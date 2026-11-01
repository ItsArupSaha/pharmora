import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSalesReturn } from '../sales-returns';

/**
 * Offline tests for sale-linked sales returns: stock and batches must be
 * restored exactly, the customer credited once, and the per-sale cap must
 * hold across multiple returns. Firestore is replaced by a tiny in-memory
 * store; nothing touches any real database or user data.
 */

const h = vi.hoisted(() => {
  type FakeDoc = { exists: boolean; data: Record<string, any> };
  const docs = new Map<string, FakeDoc>();
  const customers: any[] = [];
  let autoIdCounter = 0;

  const buildPath = (segments: any[]) =>
    segments
      .filter((s) => s !== undefined && s !== null)
      .map((s) => (typeof s === 'object' ? s.path ?? '' : String(s)))
      .filter((p) => p !== '')
      .join('/');

  const snapshot = (path: string) => docs.get(path) ?? { exists: false, data: {} };

  const matchesWheres = (data: Record<string, any>, wheres: any[]) =>
    wheres.every((w) => {
      if (w.op !== '==') return false;
      return data[w.__whereField] === w.value;
    });

  // JSON-safe clones cannot carry functions, so fake timestamps are stored as
  // markers and revived with a callable toDate() on every read.
  const revive = (data: Record<string, any>) => {
    const clone = JSON.parse(JSON.stringify(data));
    const walk = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if (typeof obj.__fakeTimestamp === 'string') {
          obj.toDate = () => new Date(obj.__fakeTimestamp);
        } else {
          Object.values(obj).forEach(walk);
        }
      }
      return obj;
    };
    return walk(clone);
  };

  return {
    docs,
    customers,
    reset() {
      docs.clear();
      customers.length = 0;
      autoIdCounter = 0;
    },
    nextAutoId() {
      return `auto-${++autoIdCounter}`;
    },
    seed(path: string, data: Record<string, any>) {
      docs.set(path, { exists: true, data: JSON.parse(JSON.stringify(data)) });
    },
    snapshot,
    revive,
    buildPath,
    matchesWheres,
    returnPaths() {
      return [...docs.keys()].filter((p) => p.includes('/sales_returns/'));
    },
  };
});

vi.mock('../../firebase', () => ({ db: { __mock: true }, auth: null }));

vi.mock('firebase/firestore', () => {
  const docRef = (path: string) => ({
    __kind: 'doc' as const,
    path,
    id: path.split('/').pop(),
  });
  const colRef = (path: string) => ({ __kind: 'col' as const, path });
  const asCollection = (last: any) => last && typeof last === 'object' && last.__kind === 'col';

  return {
    collection: (...segments: any[]) => colRef(h.buildPath(segments)),
    doc: (...segments: any[]) => {
      const last = segments[segments.length - 1];
      return asCollection(last)
        ? docRef(`${h.buildPath(segments)}/${h.nextAutoId()}`)
        : docRef(h.buildPath(segments));
    },
    runTransaction: async (_db: unknown, fn: (tx: any) => Promise<any>) => {
      const tx = {
        async get(ref: any) {
          const snap = h.snapshot(ref.path);
          return { exists: () => snap.exists, data: () => h.revive(snap.data), id: ref.id, ref };
        },
        set(ref: any, data: any) {
          h.docs.set(ref.path, { exists: true, data: JSON.parse(JSON.stringify(data)) });
        },
        update(ref: any, data: any) {
          const snap = h.docs.get(ref.path);
          if (snap) snap.data = { ...snap.data, ...JSON.parse(JSON.stringify(data)) };
        },
        delete(ref: any) {
          h.docs.delete(ref.path);
        },
      };
      return fn(tx);
    },
    Timestamp: {
      fromDate: (d: Date) => ({ __fakeTimestamp: d.toISOString(), toDate: () => d }),
      now: () => ({ __fakeTimestamp: new Date().toISOString(), toDate: () => new Date() }),
    },
    getDoc: async (ref: any) => {
      const snap = h.snapshot(ref.path);
      return { exists: () => snap.exists, data: () => h.revive(snap.data), id: ref.id, ref };
    },
    getDocs: async (q: any) => {
      const args: any[] = q.__args ?? [];
      const col = args.find((a) => a?.__kind === 'col');
      const wheres = args.filter((a) => a?.__whereField);
      const docs = [...h.docs.entries()]
        .filter(([path]) => !col || path.startsWith(`${col.path}/`))
        .filter(([, snap]) => snap.exists)
        .filter(([, snap]) => h.matchesWheres(snap.data, wheres))
        .map(([path, snap]) => ({
          id: path.split('/').pop(),
          ref: docRef(path),
          exists: true,
          data: () => h.revive(snap.data),
        }));
      return {
        empty: docs.length === 0,
        docs,
        forEach: (cb: (d: any) => void) => docs.forEach(cb),
        size: docs.length,
      };
    },
    query: (...args: any[]) => ({ __args: args }),
    where: (field: string, op: string, value: any) => ({ __whereField: field, op, value }),
    orderBy: (field: string) => ({ __orderBy: field }),
  };
});

vi.mock('../customers', () => ({
  getCustomers: async () => h.customers,
}));

vi.mock('../data-version', () => ({
  invalidateAppData: async () => {},
}));

const USER = 'demo-user';
const itemPath = `users/${USER}/items/item1`;
const customerPath = `users/${USER}/customers/custA`;
const salePath = `users/${USER}/sales/saleDoc1`;

/** Sale of 5 × ৳100 (cost ৳60) from batch B1; 3 units remain in stock. */
function seedSaleAndStock() {
  h.customers.length = 0;
  h.customers.push({ id: 'custA', name: 'Shop A', phone: '017000000001' });
  h.seed(customerPath, { name: 'Shop A', phone: '017000000001', dueBalance: 500 });
  h.seed(itemPath, {
    title: 'Napa',
    sellingPrice: 100,
    productionPrice: 60,
    stock: 3,
    batches: [{ id: 'b1', batchNo: 'B1', expiryDate: '2027-01-01', quantity: 3, initialQuantity: 10, cost: 60 }],
  });
  h.seed(salePath, {
    saleId: 'SALE-0001',
    customerId: 'custA',
    items: [{
      itemId: 'item1',
      quantity: 5,
      price: 100,
      batches: [{ batchId: 'b1', batchNo: 'B1', expiryDate: '2027-01-01', quantity: 5, costAtSale: 60 }],
    }],
    subtotal: 500,
    total: 500,
    discountType: 'none',
    discountValue: 0,
    paymentMethod: 'Due',
    extraSales: 0,
    date: { __fakeTimestamp: '2026-10-01T10:00:00.000Z' },
  });
}

describe('addSalesReturn — sale-linked returns', () => {
  beforeEach(() => {
    h.reset();
    seedSaleAndStock();
  });

  it('restores stock into the originating batch and credits the customer once', async () => {
    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 2 }],
      restock: true,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.returnId).toBe('RTN-0001');
    expect(result.salesReturn?.saleId).toBe('saleDoc1');
    expect(result.salesReturn?.saleAdjusted).toBe(true);
    expect(result.salesReturn?.totalReturnValue).toBe(200);
    expect(result.salesReturn?.totalReturnCost).toBe(120);
    expect(result.salesReturn?.restocked).toBe(true);

    const item = h.snapshot(itemPath).data;
    expect(item.stock).toBe(5);
    expect(item.batches[0].quantity).toBe(5);
    expect(item.batches[0].batchNo).toBe('B1');

    // The sale of 5 × 100 becomes a sale of 3 × 100 — history and the
    // edit dialog show the net sale.
    const sale = h.snapshot(salePath).data;
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].quantity).toBe(3);
    expect(sale.items[0].batches[0].quantity).toBe(3);
    expect(sale.subtotal).toBe(300);
    expect(sale.total).toBe(300);

    // The return credits the customer's account: 500 due drops to 300.
    expect(h.snapshot(customerPath).data.dueBalance).toBe(300);
  });

  it('credits returns at the discounted unit price the customer actually paid', async () => {
    // 5 units at 100 (subtotal 500) with the bill discounted by 100 to 400:
    // one returned unit is worth 80, not the sticker 100.
    h.seed(salePath, {
      saleId: 'SALE-0001',
      customerId: 'custA',
      items: [{ itemId: 'item1', quantity: 5, price: 100 }],
      subtotal: 500,
      total: 400,
      discountType: 'amount',
      discountValue: 100,
      paymentMethod: 'Due',
      extraSales: 0,
      date: { __fakeTimestamp: '2026-10-01T10:00:00.000Z' },
    });

    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 1 }],
      restock: true,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.items[0].price).toBe(80);
    expect(result.salesReturn?.totalReturnValue).toBe(80);
    const sale = h.snapshot(salePath).data;
    expect(sale.items[0].quantity).toBe(4);
    expect(sale.subtotal).toBe(400);
    expect(sale.total).toBe(320);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(420);
  });

  it('applies percentage discounts to return pricing the same way', async () => {
    // 20% off 500 is 400 — identical economics to the flat-discount case.
    h.seed(salePath, {
      saleId: 'SALE-0001',
      customerId: 'custA',
      items: [{ itemId: 'item1', quantity: 5, price: 100 }],
      subtotal: 500,
      total: 400,
      discountType: 'percentage',
      discountValue: 20,
      paymentMethod: 'Due',
      extraSales: 0,
      date: { __fakeTimestamp: '2026-10-01T10:00:00.000Z' },
    });

    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 2 }],
      restock: true,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.totalReturnValue).toBe(160);
    const sale = h.snapshot(salePath).data;
    expect(sale.items[0].quantity).toBe(3);
    expect(sale.total).toBe(240);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(340);
  });

  it('reduces a pending receivable by the returned value', async () => {
    h.seed(`users/${USER}/transactions/tx1`, {
      description: 'Due from SALE-0001',
      amount: 500,
      status: 'Pending',
      type: 'Receivable',
      customerId: 'custA',
      saleId: 'SALE-0001',
      totalSaleProfit: 200,
      remainingProfit: 200,
    });

    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 2 }],
      restock: true,
    });

    expect(result.success).toBe(true);
    const receivable = h.snapshot(`users/${USER}/transactions/tx1`).data;
    expect(receivable.amount).toBe(300);
    expect(receivable.remainingProfit).toBe(120);
    expect(receivable.status).toBe('Pending');
  });

  it('prices returned units from the sale, not from the caller', async () => {
    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 1, price: 1 }],
      restock: false,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.totalReturnValue).toBe(100);
  });

  it('rejects returning more units than the sale line has left', async () => {
    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 6 }],
      restock: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('can still be returned');
    expect(h.snapshot(itemPath).data.stock).toBe(3);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(500);
    expect(h.snapshot(salePath).data.items[0].quantity).toBe(5);
  });

  it('caps a second return at what the first return left', async () => {
    const first = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 2 }],
      restock: true,
    });
    expect(first.success).toBe(true);

    const tooMuch = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 4 }],
      restock: true,
    });
    expect(tooMuch.success).toBe(false);
    expect(tooMuch.error).toContain('Only 3');
    expect(h.snapshot(itemPath).data.stock).toBe(5);

    const rest = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 3 }],
      restock: true,
    });
    expect(rest.success).toBe(true);
    expect(h.snapshot(itemPath).data.stock).toBe(8);
    expect(h.snapshot(itemPath).data.batches[0].quantity).toBe(8);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(0);
    // Everything returned: the sale is empty and worth nothing.
    expect(h.snapshot(salePath).data.items).toHaveLength(0);
    expect(h.snapshot(salePath).data.total).toBe(0);
    expect(h.returnPaths()).toHaveLength(2);
  });

  it('still caps against returns recorded before sale-adjustment existed', async () => {
    // Legacy return doc: 1 unit already returned, sale doc never adjusted.
    h.seed(`users/${USER}/sales_returns/legacy1`, {
      customerId: 'custA',
      items: [{ itemId: 'item1', quantity: 1, price: 100 }],
      returnId: 'RTN-0001',
      totalReturnValue: 100,
      saleId: 'saleDoc1',
      date: { __fakeTimestamp: '2026-10-02T10:00:00.000Z' },
    });

    const tooMuch = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 5 }],
      restock: true,
    });
    expect(tooMuch.success).toBe(false);
    expect(tooMuch.error).toContain('Only 4');

    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 4 }],
      restock: true,
    });
    expect(result.success).toBe(true);
    expect(h.snapshot(itemPath).data.stock).toBe(7);
    // The legacy return never shrank the doc, so 5 − 4 = 1 unit remains on it.
    expect(h.snapshot(salePath).data.items[0].quantity).toBe(1);
  });

  it('keeps defective goods out of stock while still crediting the customer', async () => {
    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 2 }],
      restock: false,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.restocked).toBe(false);
    const item = h.snapshot(itemPath).data;
    expect(item.stock).toBe(3);
    expect(item.batches[0].quantity).toBe(3);
    // The sale still shrinks — the goods are gone from the customer either way.
    expect(h.snapshot(salePath).data.items[0].quantity).toBe(3);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(300);
  });

  it('falls back to the walk-in customer when a legacy sale has none', async () => {
    h.seed(salePath, {
      saleId: 'SALE-0001',
      customerId: '',
      items: [{ itemId: 'item1', quantity: 5, price: 100 }],
      subtotal: 500,
      total: 500,
      paymentMethod: 'Cash',
      date: { __fakeTimestamp: '2026-10-01T10:00:00.000Z' },
    });
    h.customers.push({ id: 'walkin', name: 'Walk-in Customer', phone: '' });
    h.seed(`users/${USER}/customers/walkin`, { name: 'Walk-in Customer', phone: '', dueBalance: 0 });

    const result = await addSalesReturn(USER, {
      saleId: 'saleDoc1',
      items: [{ itemId: 'item1', quantity: 1 }],
      restock: true,
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.customerId).toBe('walkin');
    expect(h.snapshot(`users/${USER}/customers/walkin`).data.dueBalance).toBe(-100);
    expect(h.snapshot(salePath).data.items[0].quantity).toBe(4);
  });
});

describe('addSalesReturn — free-form returns keep working', () => {
  beforeEach(() => {
    h.reset();
    seedSaleAndStock();
  });

  it('bumps stock and credits the submitted price', async () => {
    const result = await addSalesReturn(USER, {
      customerId: 'custA',
      items: [{ itemId: 'item1', quantity: 2, price: 90 }],
    });

    expect(result.success).toBe(true);
    expect(result.salesReturn?.totalReturnValue).toBe(180);
    expect(result.salesReturn?.saleId).toBeUndefined();
    expect(h.snapshot(itemPath).data.stock).toBe(5);
    // Free-form returns have no batch provenance; only the total moves.
    expect(h.snapshot(itemPath).data.batches[0].quantity).toBe(3);
    expect(h.snapshot(customerPath).data.dueBalance).toBe(320);
  });

  it('rejects whole-number violations before any write', async () => {
    const result = await addSalesReturn(USER, {
      customerId: 'custA',
      items: [{ itemId: 'item1', quantity: 1.5, price: 90 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('whole number');
    expect(h.returnPaths()).toHaveLength(0);
  });
});
