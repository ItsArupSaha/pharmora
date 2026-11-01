import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSale, deleteSale, updateSale } from '../sales-actions';

/**
 * Offline tests for the sale-edit bill model — moving a sale between
 * customers (or re-saving it) must never double-count dues, credit or money
 * already collected against a receivable. Firestore is replaced by a tiny
 * in-memory store; all money math (saleBillAmount, buildReceivable, guards,
 * FEFO) runs for real. Nothing touches any real database or user data.
 */

const h = vi.hoisted(() => {
  type FakeDoc = { exists: boolean; data: Record<string, any> };
  const docs = new Map<string, FakeDoc>();
  const writes: Array<{ op: 'set' | 'update' | 'delete'; path: string; data?: any }> = [];
  const customers: any[] = [];
  let autoIdCounter = 0;
  let autoIdPrefix = 'auto';

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
  // markers and revived with a callable toDate() on every read — exactly what
  // docToSale/docToSalesReturn expect.
  const revive = (data: Record<string, any>) => {
    const clone = structuredClone(data);
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
    writes,
    customers,
    reset() {
      docs.clear();
      writes.length = 0;
      customers.length = 0;
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
    snapshot,
    revive,
    buildPath,
    customerPaths() {
      return [...docs.keys()].filter((p) => p.includes('/customers/'));
    },
    transactionPaths() {
      return [...docs.keys()].filter((p) => p.includes('/transactions/'));
    },
    matchesWheres,
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
  const asCollection = (last: any) => last && typeof last === 'object' && last.__kind === 'col';

  return {
    collection: (...segments: any[]) => colRef(h.buildPath(segments)),
    doc: (...segments: any[]) => {
      for (const segment of segments.slice(1)) {
        if (segment === '') throw emptyPathError();
      }
      const last = segments[segments.length - 1];
      return asCollection(last)
        ? docRef(`${h.buildPath(segments)}/${h.nextAutoId()}`)
        : docRef(h.buildPath(segments));
    },
    runTransaction: async (_db: unknown, fn: (tx: any) => Promise<any>) => {
      const tx = {
        async get(ref: any) {
          const snap = h.snapshot(ref.path);
          return {
            exists: () => snap.exists,
            data: () => h.revive(snap.data),
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
const itemDoc = (id: string) => `users/${USER}/items/${id}`;
const customerDoc = (id: string) => `users/${USER}/customers/${id}`;
const saleDoc = (id: string) => `users/${USER}/sales/${id}`;
const transactionDoc = (id: string) => `users/${USER}/transactions/${id}`;

function seedSale(overrides: Record<string, any> = {}) {
  const sale = {
    saleId: 'SALE-0001',
    customerId: 'custA',
    items: [{ itemId: 'item1', quantity: 10, price: 100 }],
    subtotal: 1000,
    total: 1000,
    discountType: 'none',
    discountValue: 0,
    paymentMethod: 'Due',
    extraSales: 0,
    date: { __fakeTimestamp: '2026-10-01T10:00:00.000Z', toDate: () => new Date('2026-10-01T10:00:00.000Z') },
    ...overrides,
  };
  h.seed(saleDoc('saleDoc1'), sale);
  return sale;
}

function seedBaseState() {
  h.customers.length = 0;
  h.customers.push({ id: 'custA', name: 'Shop A', phone: '017000000001' });
  if (!h.docs.has(customerDoc('custA'))) {
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 1000 });
  }
  h.seed(itemDoc('item1'), {
    title: 'Napa',
    sellingPrice: 100,
    productionPrice: 60,
    stock: 90,
  });
}

const editPayload = (overrides: Record<string, any> = {}) => ({
  customerId: 'custA',
  items: [{ itemId: 'item1', quantity: 10, price: 100 }],
  discountType: 'none' as const,
  discountValue: 0,
  paymentMethod: 'Due' as const,
  amountPaid: undefined,
  extraSales: 0,
  date: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

function seededReceivable(amount: number, customerId = 'custA') {
  h.seed(transactionDoc('tx1'), {
    description: 'Due from SALE-0001',
    amount,
    status: 'Pending',
    type: 'Receivable',
    customerId,
    saleId: 'SALE-0001',
    totalSaleProfit: 400,
    remainingProfit: 400,
  });
}

const balanceOf = (path: string) => h.snapshot(path).data.dueBalance;
const receivablePaths = () => h.transactionPaths();

describe('updateSale — the bill model', () => {
  beforeEach(() => {
    h.reset();
    h.setAutoIdPrefix('auto');
    seedBaseState();
  });

  it('re-saving an unchanged due sale causes zero drift', async () => {
    seedSale();
    seededReceivable(1000);
    const before = balanceOf(customerDoc('custA'));

    const result = await updateSale(USER, 'saleDoc1', editPayload());

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(before);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(1000);
    expect(receivables[0].customerId).toBe('custA');
  });

  it('reducing quantities rebalances the same customer and the receivable follows', async () => {
    seedSale();
    seededReceivable(1000);

    const result = await updateSale(USER, 'saleDoc1', editPayload({ items: [{ itemId: 'item1', quantity: 6, price: 100 }] }));

    expect(result.success).toBe(true);
    // 10 × 100 = 1000 due; the edit sells 6 × 100 = 600 instead.
    expect(balanceOf(customerDoc('custA'))).toBe(600);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(600);
    expect(h.snapshot(itemDoc('item1')).data.stock).toBe(94);
  });

  it('moving a due sale to another shop moves the due and the receivable', async () => {
    seedSale();
    seededReceivable(1000);
    h.customers.push({ id: 'custB', name: 'Shop B', phone: '017000000002' });
    h.seed(customerDoc('custB'), { name: 'Shop B', phone: '017000000002', dueBalance: 50 });

    const result = await updateSale(USER, 'saleDoc1', editPayload({ customerId: 'custB' }));

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(0);
    expect(balanceOf(customerDoc('custB'))).toBe(1050);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(1000);
    expect(receivables[0].customerId).toBe('custB');
    expect(h.snapshot(saleDoc('saleDoc1')).data.customerId).toBe('custB');
  });

  it('moving a partially collected sale never resurrects collected money', async () => {
    // Sale of 1000: the customer paid 500, leaving a 500 pending receivable
    // and a 500 balance. Moving the sale unchanged must leave the old shop at
    // zero, put the remaining 500 on the new shop, and recreate only a 500
    // receivable — not the original 1000.
    seedSale();
    seededReceivable(500);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 500 });
    h.customers.push({ id: 'custB', name: 'Shop B', phone: '017000000002' });
    h.seed(customerDoc('custB'), { name: 'Shop B', phone: '017000000002', dueBalance: 0 });

    const result = await updateSale(USER, 'saleDoc1', editPayload({ customerId: 'custB' }));

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(0);
    expect(balanceOf(customerDoc('custB'))).toBe(500);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(500);
    expect(receivables[0].customerId).toBe('custB');
  });

  it('reducing a partially collected sale nets the collection against the new bill', async () => {
    // 1000 sale, 500 collected, edited down to a 600 total: the shop owes the
    // customer nothing extra and only 100 remains due.
    seedSale();
    seededReceivable(500);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 500 });

    const result = await updateSale(USER, 'saleDoc1', editPayload({ items: [{ itemId: 'item1', quantity: 6, price: 100 }] }));

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(100);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(100);
  });

  it('moving a due sale to a typed new shop creates that customer', async () => {
    seedSale();
    seededReceivable(1000);
    h.setAutoIdPrefix('newshop');

    const result = await updateSale(
      USER,
      'saleDoc1',
      editPayload({
        customerId: '',
        dueCustomer: { name: 'New Store', phone: '017111111222' },
      })
    );

    expect(result.success).toBe(true);
    const newCustomerPath = h.customerPaths().find((p) => p !== customerDoc('custA'));
    expect(newCustomerPath).toBeDefined();
    const newCustomer = h.snapshot(newCustomerPath!).data;
    expect(newCustomer.name).toBe('New Store');
    expect(newCustomer.phone).toBe('017111111222');
    expect(newCustomer.dueBalance).toBe(1000);
    expect(balanceOf(customerDoc('custA'))).toBe(0);
    expect(h.snapshot(saleDoc('saleDoc1')).data.customerId).toBe(newCustomerPath!.split('/').pop());
  });

  it('re-saving a sale that applied customer credit causes no drift', async () => {
    // Sale of 1000 where 300 was paid from the customer's advance: the sale
    // stores creditApplied 300, the receivable is 700 and the balance is 700.
    seedSale({ creditApplied: 300, total: 1000 });
    seededReceivable(700);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 700 });

    const result = await updateSale(USER, 'saleDoc1', editPayload({ creditApplied: 300 }));

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(700);
    const receivables = receivablePaths().map((p) => h.snapshot(p).data);
    expect(receivables).toHaveLength(1);
    expect(receivables[0].amount).toBe(700);
    expect(h.snapshot(saleDoc('saleDoc1')).data.creditApplied).toBe(300);
  });

  it('a credit sale moving to another shop releases the credit and bills the new shop fully', async () => {
    seedSale({ creditApplied: 300 });
    seededReceivable(700);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 700 });
    h.customers.push({ id: 'custB', name: 'Shop B', phone: '017000000002' });
    h.seed(customerDoc('custB'), { name: 'Shop B', phone: '017000000002', dueBalance: 0 });

    // The edit dialog re-sends creditApplied (300), but a different customer
    // cannot inherit it: their advance, the old shop's advance is restored.
    const result = await updateSale(USER, 'saleDoc1', editPayload({ customerId: 'custB', creditApplied: 300 }));

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(-300);
    expect(balanceOf(customerDoc('custB'))).toBe(1000);
  });
});

describe('deleteSale — reversal of the original impact', () => {
  beforeEach(() => {
    h.reset();
    h.setAutoIdPrefix('auto');
    seedBaseState();
  });

  it('deleting a credit sale restores the customer advance', async () => {
    // Advance was −300 before the sale; the sale (1000 due, 300 on credit)
    // left the balance at 700. Deleting it must restore the advance exactly.
    seedSale({ creditApplied: 300 });
    seededReceivable(700);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 700 });

    const result = await deleteSale(USER, 'saleDoc1');

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(-300);
    expect(receivablePaths()).toHaveLength(0);
    expect(h.snapshot(itemDoc('item1')).data.stock).toBe(100);
    expect(h.snapshot(saleDoc('saleDoc1')).exists).toBe(false);
  });

  it('deleting a collected-against sale keeps the paid money as refundable advance', async () => {
    seedSale();
    seededReceivable(500);
    h.seed(customerDoc('custA'), { name: 'Shop A', phone: '017000000001', dueBalance: 500 });

    const result = await deleteSale(USER, 'saleDoc1');

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(-500);
    expect(receivablePaths()).toHaveLength(0);
  });
});

describe('addSale regression — new sale math still lines up', () => {
  beforeEach(() => {
    h.reset();
    h.setAutoIdPrefix('auto');
    seedBaseState();
  });

  it('records a due sale for an existing shop by name', async () => {
    const result = await addSale(USER, {
      customerId: '',
      items: [{ itemId: 'item1', quantity: 2, price: 100 }],
      discountType: 'none',
      discountValue: 0,
      paymentMethod: 'Due',
      dueCustomer: { name: 'shop a', phone: '017000000001' },
      amountPaid: undefined,
      extraSales: 0,
      date: '2026-10-01T10:00:00.000Z',
    });

    expect(result.success).toBe(true);
    expect(balanceOf(customerDoc('custA'))).toBe(1200);
  });
});
