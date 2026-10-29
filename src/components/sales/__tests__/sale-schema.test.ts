import { describe, expect, it } from 'vitest';
import { saleFormSchema } from '../../sales/schema';

const base = {
  date: new Date('2026-01-01'),
  items: [{ itemId: 'item-1', quantity: 2, price: 50 }],
};

describe('saleFormSchema payment refinements', () => {
  it('accepts a Split sale with a positive partial payment within the total', () => {
    const result = saleFormSchema.safeParse({
      ...base,
      paymentMethod: 'Split',
      dueShopName: 'Rahim Store',
      dueCustomerPhone: '01712345678',
      amountPaid: 40,
      total: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a Split sale without a paid amount', () => {
    const result = saleFormSchema.safeParse({
      ...base,
      paymentMethod: 'Split',
      dueShopName: 'Rahim Store',
      dueCustomerPhone: '01712345678',
      amountPaid: 0,
      total: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a Split sale paying more than the total', () => {
    const result = saleFormSchema.safeParse({
      ...base,
      paymentMethod: 'Split',
      dueShopName: 'Rahim Store',
      dueCustomerPhone: '01712345678',
      amountPaid: 150,
      total: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects Due and Split sales without the shop identity', () => {
    for (const paymentMethod of ['Due', 'Split'] as const) {
      const result = saleFormSchema.safeParse({
        ...base,
        paymentMethod,
        dueShopName: '',
        dueCustomerPhone: '01712345678',
        amountPaid: 40,
        total: 100,
      });
      expect(result.success).toBe(false);
    }
  });

  it('rejects Due and Split sales with a too-short phone', () => {
    for (const paymentMethod of ['Due', 'Split'] as const) {
      const result = saleFormSchema.safeParse({
        ...base,
        paymentMethod,
        dueShopName: 'Rahim Store',
        dueCustomerPhone: '123',
        total: 100,
      });
      expect(result.success).toBe(false);
    }
  });

  it('accepts a Cash sale with no shop fields at all', () => {
    const result = saleFormSchema.safeParse({
      ...base,
      paymentMethod: 'Cash',
      total: 100,
    });
    expect(result.success).toBe(true);
  });
});
