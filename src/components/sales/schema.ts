import * as z from 'zod';

export const saleItemSchema = z.object({
  itemId: z.string().optional(),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional(),
  price: z.coerce.number().min(0, 'Price must be non-negative').optional(),
});

export const saleFormSchema = z.object({
  // Set by the edit dialog only; the POS ignores it and resolves due
  // customers on the server.
  customerId: z.string().optional(),
  date: z.date({ required_error: "A sale date is required." }),
  items: z.array(saleItemSchema),
  discountType: z.enum(['none', 'percentage', 'amount']).optional().default('none'),
  discountValue: z.coerce.number().min(0, 'Discount must be non-negative').default(0).optional(),
  // 'Bank' exists only so legacy Bank sales stay editable; the form never
  // offers it as a new choice.
  paymentMethod: z.enum(['Cash', 'Bank', 'Due', 'Split'], { required_error: 'Payment method is required.' }),
  dueShopName: z.string().optional(),
  dueCustomerPhone: z.string().optional(),
  dueContactName: z.string().optional(),
  // Split: the part paid in cash on the spot; the remainder goes to dues.
  amountPaid: z.coerce.number().optional(),
  extraSales: z.coerce.number().min(0, 'Extra sales must be non-negative').default(0).optional(),
  total: z.coerce.number().min(0, 'Total must be non-negative').optional(),
}).refine(data => {
  if (data.discountType === 'percentage' && data.discountValue !== undefined) {
    return data.discountValue >= 0 && data.discountValue <= 100;
  }
  return true;
}, {
  message: "Percentage discount must be between 0 and 100.",
  path: ['discountValue'],
}).refine(data => {
  if (data.paymentMethod === 'Due' || data.paymentMethod === 'Split') {
    return !!(data.dueShopName || '').trim() && !!(data.dueCustomerPhone || '').trim();
  }
  return true;
}, {
  message: "Due and split sales need the shop name and phone number.",
  path: ['dueShopName'],
}).refine(data => {
  if (data.paymentMethod !== 'Due' && data.paymentMethod !== 'Split') return true;
  const digits = (data.dueCustomerPhone || '').replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15;
}, {
  message: "Enter a valid phone number (6–15 digits).",
  path: ['dueCustomerPhone'],
}).refine(data => {
  if (data.paymentMethod !== 'Split') return true;
  const paid = Number(data.amountPaid);
  return Number.isFinite(paid) && paid > 0;
}, {
  message: "Enter how much the customer is paying now.",
  path: ['amountPaid'],
}).refine(data => {
  if (data.paymentMethod !== 'Split') return true;
  const paid = Number(data.amountPaid);
  return paid <= (data.total ?? 0);
}, {
  message: "Amount paid cannot be more than the total.",
  path: ['amountPaid'],
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;
