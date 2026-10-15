import * as z from 'zod';

// One row of the "Add New Items" dialog. Mirrors the purchase item row so the
// same row component can be reused. Stock mode only surfaces name, group,
// expiry and quantity in the UI — category and prices stay in the form state
// (hidden) so editing an existing item round-trips its stored values untouched.
export const itemRowSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  categoryId: z.string().default(''),
  categoryName: z.string().default(''),
  medicineGroup: z.string().optional(),
  company: z.string().optional(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
  quantity: z.coerce.number().int().min(0, 'Quantity must be a non-negative integer'),
  cost: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
});

export const addItemsFormSchema = z.object({
  // Company and shelf location apply to every row, mirroring the purchase dialog.
  company: z.string().optional(),
  location: z.string().optional(),
  items: z.array(itemRowSchema).min(1, 'At least one item is required.'),
});

export type ItemRowValues = z.infer<typeof itemRowSchema>;
export type AddItemsFormValues = z.infer<typeof addItemsFormSchema>;
