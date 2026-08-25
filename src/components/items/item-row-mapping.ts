import type { Category, Item } from '@/lib/types';
import type { ItemRowValues } from './schema';

export const emptyItemRow = (categoryId = '', categoryName = ''): ItemRowValues => ({
  itemName: '',
  categoryId,
  categoryName,
  medicineGroup: '',
  company: '',
  expiryDate: '',
  location: '',
  quantity: 1,
  cost: 0,
  sellingPrice: 0,
});

export const rowFromItem = (item: Item): ItemRowValues => ({
  itemName: item.title,
  categoryId: item.categoryId,
  categoryName: item.categoryName,
  medicineGroup: item.medicineGroup || '',
  company: item.company || '',
  expiryDate: item.expiryDate || '',
  location: item.location || '',
  quantity: item.stock,
  cost: item.productionPrice,
  sellingPrice: item.sellingPrice,
});

export function isAssetOrSurgicalCategory(
  categories: Category[],
  categoryId: string
): boolean {
  const name = categories.find((c) => c.id === categoryId)?.name.toLowerCase();
  return name === 'assets' || name === 'surgicals';
}

export const rowToItemData = (
  row: ItemRowValues,
  categories: Category[]
): Omit<Item, 'id'> => ({
  title: row.itemName.trim(),
  categoryId: row.categoryId,
  categoryName: categories.find((c) => c.id === row.categoryId)?.name || row.categoryName,
  medicineGroup: row.medicineGroup || undefined,
  company: row.company || undefined,
  expiryDate: row.expiryDate || undefined,
  location: row.location || undefined,
  productionPrice: row.cost,
  sellingPrice: row.sellingPrice,
  stock: row.quantity,
});
