import * as z from 'zod';

// One row of the "Add New Items" dialog. Mirrors the purchase item row so the
// same row component can be reused, with stock-friendly quantity rules.
export const itemRowSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  categoryName: z.string().min(1, 'Category name is required'),
  medicineGroup: z.string().optional(),
  company: z.string().optional(),
  expiryDate: z.string().optional(),
  location: z.string().optional(),
  quantity: z.coerce.number().int().min(0, 'Quantity must be a non-negative integer'),
  cost: z.coerce.number().min(0, 'Cost must be non-negative'),
  sellingPrice: z.coerce.number().min(0, 'Selling price must be non-negative'),
});

export const addItemsFormSchema = z.object({
  // Company and shelf location apply to every row, mirroring the purchase dialog.
  company: z.string().optional(),
  location: z.string().optional(),
  items: z.array(itemRowSchema).min(1, 'At least one item is required.'),
});

export type ItemRowValues = z.infer<typeof itemRowSchema>;
export type AddItemsFormValues = z.infer<typeof addItemsFormSchema>;
