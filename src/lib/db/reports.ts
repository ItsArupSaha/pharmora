
import type { ClosingStock } from '../types';
import { getItems } from './items';
import { getSales } from './sales';

/**
 * Calculates the closing stock for all books up to a specific date.
 * This is a heavy operation and should be called from a server action.
 * @param closingStockDate The date to calculate the closing stock for.
 * @returns A promise that resolves to an array of books with their closing stock.
 */
export async function calculateClosingStock(userId: string, closingStockDate: Date): Promise<ClosingStock[]> {
    const [allItems, allSales] = await Promise.all([getItems(userId), getSales(userId)]);

    const salesAfterDate = allSales.filter((s: any) => s.date && new Date(s.date) > closingStockDate);

    const calculatedData = allItems.map((item: any) => {
        const quantitySoldAfter = salesAfterDate.reduce((total: number, sale: any) => {
            const saleItems = Array.isArray(sale.items) ? sale.items : [];
            const saleItem = saleItems.find((i: any) => i.itemId === item.id);
            return total + (saleItem ? Number(saleItem.quantity) || 0 : 0);
        }, 0);
        
        return {
            ...item,
            closingStock: (Number(item.stock) || 0) + quantitySoldAfter
        }
    });

    return calculatedData;
}
