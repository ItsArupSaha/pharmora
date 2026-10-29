import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSale } from '../sales-actions';

/**
 * Offline demo tests for Due and Split sales — the money path that crashed
 * in production with "Function doc() cannot be called with an empty path".
 *
 * Firestore is replaced by a tiny in-memory store. The mock doc() throws on
 * an empty id exactly like the real SDK, so the empty-customerId regression
 * is reproduced faithfully. All money math (computeSaleTotals,
 * buildReceivable, sale guards, FEFO) runs for real. Nothing touches any
 * real database or user data.
 */

const h = vi.hoisted(() => {
  type FakeDoc = { exists: boolean; data: Record<string, any> };
  const docs = new Map<string, FakeDoc>();
  const writes: Array<{ op: 'set' | 'update' | 'delete'; path: string; data?: any }> = [];
  const existingCustomers: any[] = [];
  let autoIdCounter = 0;
  let autoIdPrefix = 'auto';

  const buildPath = (segments: any[]) =>
    segments
      .filter((s) => s !== undefined && s !== null)
      .map((s) => (typeof s === 'object' ? s.path ?? '' : String(s)))
      .filter((p) => p !== '')
      .join('/');

  return {
    docs,
    writes,
    existingCustomers: [] as any[],
    reset() {
      docs.clear();
      writes.length = 0;
      existingCustomers.length = 0;
      autoIdCounter = 0;
    },
    setAutoIdPrefix(prefix: string) {
      autoIdPrefix = prefix;
    },
    nextAutoId() {
      return `${autoIdPrefix}-${++autoIdCounter}`;
    },
    seed(path: string, data: Record<string, any>) {
      docs.set(path, { exists: true, data: JSON.parse(JSON.stringify(data)) });
    },
    snapshot(path: string) {
      return docs.get(path) ?? { exists: false, data: {} };
    },
    customerPaths() {
      return [...docs.keys()].filter((p) => p.includes('/customers/'));
    },
    buildPath,
  };
});

vi.mock('../../firebase', () => ({ db: { __mock: true }, auth: null }));

vi.mock('firebase/firestore', () => {
  const emptyPathError = () =>
    new Error('Function doc() cannot be called with an empty path.');

  const docRef = (path: string) => ({
    __kind: 'doc' as const,
    path,
    id: path.split('/').pop(),
  });

  const colRef = (path: string) => ({ __kind: 'col' as const, path });

  return {
    collection: (...segments: any[]) => colRef(h.buildPath(segments)),
    doc: (...segments: any[]) => {
      // Mirror the real SDK: an empty id argument throws, while doc(collection)
      // with no id generates a fresh unique id.
      for (const segment of segments.slice(1)) {
        if (segment === '') throw emptyPathError();
      }
      const last = segments[segments.length - 1];
      const isCollectionRef = last && typeof last === 'object' && last.__kind === 'col';
      const path = isCollectionRef
        ? `${h.buildPath(segments)}/${h.nextAutoId()}`
        : h.buildPath(segments);
      return docRef(path);
    },
    runTransaction: async (_db: unknown, fn: (tx: any) => Promise<any>) => {
      const tx = {
        async get(ref: any) {
          const snap = h.snapshot(ref.path);
          return {
            exists: () => snap.exists,
            data: () => structuredClone(snap.data),
            id: ref.id,
            ref,
          };
        },
        set(ref: any, data: any) {
          h.writes.push({ op: 'set', path: ref.path, data });
          h.docs.set(ref.path, { exists: true, data: JSON.parse(JSON.stringify(data)) });
        },
        update(ref: any, data: any) {
          h.writes.push({ op: 'update', path: ref.path, data });
          const snap = h.docs.get(ref.path);
          if (snap) snap.data = { ...snap.data, ...JSON.parse(JSON.stringify(data)) };
        },
        delete(ref: any) {
          h.writes.push({ op: 'delete', path: ref.path });
          h.docs.delete(ref.path);
        },
      };
      return fn(tx);
    },
    Timestamp: {
      fromDate: (d: Date) => ({ __fakeTimestamp: d.toISOString() }),
    },
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => ({ empty: true, docs: [] as any[] }),
    query: (...args: any[]) => ({ __query: args }),
    where: (...args: any[]) => ({ __where: args }),
  };
});

vi.mock('../customers', () => ({
  getCustomers: async () => h.existingCustomers,
}));

vi.mock('../data-version', () => ({
  invalidateAppData: async () => {},
}));

vi.mock('../batch-utils', () => ({
  fetchItemBatches: async () => [],
  buildBatchData: (input: Record<string, any>) => ({ ...input }),
  newBatchDocRef: (...segments: any[]) => ({ __kind: 'doc', path: h.buildPath(segments) }),
  batchDocRef: (...segments: any[]) => ({ __kind: 'doc', path: h.buildPath(segments) }),
}));

const USER = 'demo-user';

function seedBaseline() {
  h.reset();

  h.seed(`users/${USER}/metadata/counters`, { lastSaleNumber: 0 });
  h.seed(`users/${USER}/items/item1`, {
    title: 'Relax Health Appliance',
    sellingPrice: 1420,
    productionPrice: 1000,
    stock: 10,
  });
  h.seed(`users/${USER}/customers/walkin`, {
    name: 'Walk-in Customer',
    phone: 'N/A',
    address: 'N/A',
    openingBalance: 0,
    dueBalance: 0,
  });
  h.seed(`users/${USER}/customers/shop1`, {
    name: 'Rahim Store',
    phone: '01799999999',
    address: 'N/A',
    openingBalance: 0,
    dueBalance: 50,
    contactName: 'Old Contact',
  });
  h.existingCustomers.push(
    {
      id: 'walkin',
      name: 'Walk-in Customer',
      phone: 'N/A',
      address: 'N/A',
      openingBalance: 0,
      dueBalance: 0,
    },
    {
      id: 'shop1',
      name: 'Rahim Store',
      phone: '01799999999',
      address: 'N/A',
      openingBalance: 0,
      dueBalance: 50,
      contactName: 'Old Contact',
    }
  );
  h.setAutoIdPrefix('auto');
}

const saleBase = {
  date: new Date('2026-10-29T10:00:00Z').toISOString(),
  items: [{ itemId: 'item1', quantity: 1, price: 1325 }],
  discountType: 'none' as const,
  discountValue: 0,
  extraSales: 0,
  total: 1325,
};

describe('addSale — Split and Due (offline, in-memory Firestore)', () => {
  beforeEach(seedBaseline);

  it('records a Split sale with no customerId — the production crash regression', async () => {
    // The POS sends customerId: '' for due/split sales. Before the fix this
    // crashed with "Function doc() cannot be called with an empty path."
    const result = await addSale(USER, {
      ...saleBase,
      customerId: '',
      paymentMethod: 'Split',
      amountPaid: 1000,
      splitPaymentMethod: 'Cash',
      dueCustomer: { name: 'Karim Electronics', phone: '01712345678' },
    });

    expect(result.success).toBe(true);
    const sale = result.sale!;
    expect(sale.paymentMethod).toBe('Split');
    expect(sale.amountPaid).toBe(1000);
    expect(sale.splitPaymentMethod).toBe('Cash');
    expect(sale.total).toBe(1325);
    expect(sale.saleId).toBe('SALE-0001');

    // A new customer was created with the typed shop name…
    const customerPath = h.customerPaths().find((p) => p.endsWith('Karim Electronics') === false && p !== `users/${USER}/customers/walkin` && p !== `users/${USER}/customers/shop1`);
    expect(customerPath).toBeDefined();
    const customer = h.snapshot(customerPath!);
    expect(customer.data.name).toBe('Karim Electronics');
    expect(customer.data.phone).toBe('01712345678');
    // …and their dues hold exactly the un-paid remainder: 1325 − 1000.
    expect(customer.data.dueBalance).toBe(325);

    // A pending receivable was written for the remainder.
    const receivableWrite = h.writes.find(
      (w) => w.op === 'set' && w.path.includes('/transactions/') && w.data?.type === 'Receivable'
    );
    expect(receivableWrite).toBeDefined();
    expect(receivableWrite!.data.amount).toBe(325);
    expect(receivableWrite!.data.status).toBe('Pending');
    expect(receivableWrite!.data.description).toBe('Due from SALE-0001');

    // Stock was deducted server-side.
    expect(h.snapshot(`users/${USER}/items/item1`).data.stock).toBe(9);
  });

  it('reuses an existing shop matched by name even when the typed phone differs', async () => {
    const customerCountBefore = h.customerPaths().length;

    const result = await addSale(USER, {
      ...saleBase,
      customerId: '',
      paymentMethod: 'Split',
      amountPaid: 325,
      splitPaymentMethod: 'Cash',
      dueCustomer: { name: '  rahim   STORE ', phone: '01700000001' },
    });

    expect(result.success).toBe(true);
    // Same name (case/spacing-insensitive) → the same shop, no duplicate.
    expect(h.customerPaths().length).toBe(customerCountBefore);
    const shop = h.snapshot(`users/${USER}/customers/shop1`);
    // 50 existing + (1325 − 325)
    expect(shop.data.dueBalance).toBe(1050);
    // Existing contact/phone are never overwritten by the backfill.
    expect(shop.data.contactName).toBe('Old Contact');
    expect(shop.data.phone).toBe('01799999999');
  });

  it('records a Due sale with the full total landing on the shop dues', async () => {
    const result = await addSale(USER, {
      ...saleBase,
      customerId: '',
      paymentMethod: 'Due',
      dueCustomer: { name: 'New Shop', phone: '01712345678', contactName: 'Karim' },
    });

    expect(result.success).toBe(true);
    expect(result.sale!.paymentMethod).toBe('Due');

    const customerPath = h
      .customerPaths()
      .find((p) => !p.endsWith('walkin') && !p.endsWith('shop1'));
    const customer = h.snapshot(customerPath!);
    expect(customer.data.name).toBe('New Shop');
    expect(customer.data.contactName).toBe('Karim');
    expect(customer.data.dueBalance).toBe(1325);

    const receivableWrite = h.writes.find(
      (w) => w.op === 'set' && w.path.includes('/transactions/') && w.data?.type === 'Receivable'
    );
    expect(receivableWrite!.data.amount).toBe(1325);
  });

  it('rejects a Split sale paying more than the total', async () => {
    const result = await addSale(USER, {
      ...saleBase,
      customerId: '',
      paymentMethod: 'Split',
      amountPaid: 2000,
      splitPaymentMethod: 'Cash',
      dueCustomer: { name: 'Karim Electronics', phone: '01712345678' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/paid/i);
  });

  it('rejects Due and Split sales without a shop name', async () => {
    const result = await addSale(USER, {
      ...saleBase,
      customerId: '',
      paymentMethod: 'Due',
      dueCustomer: { name: '', phone: '01712345678' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/shop name/i);
  });

  it('keeps Cash sales on the walk-in customer with no receivable', async () => {
    const result = await addSale(USER, {
      ...saleBase,
      customerId: 'walkin',
      paymentMethod: 'Cash',
    });

    expect(result.success).toBe(true);
    expect(result.sale!.paymentMethod).toBe('Cash');
    expect(result.sale!.amountPaid).toBeUndefined();

    const walkin = h.snapshot(`users/${USER}/customers/walkin`);
    expect(walkin.data.dueBalance).toBe(0);

    const receivableWrite = h.writes.find(
      (w) => w.op === 'set' && w.path.includes('/transactions/') && w.data?.type === 'Receivable'
    );
    expect(receivableWrite).toBeUndefined();
  });
});
