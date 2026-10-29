import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DateRange } from 'react-day-picker';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Customer, Item } from '@/lib/types';
import { getFilteredSales, resolveExportBreakdownForSales } from './sales-export-utils';

export async function downloadSalesPdf(userId: string, dateRange: DateRange | undefined, authUser: any, items: Item[], customers: Customer[]) {
  const filteredSales = await getFilteredSales(userId, dateRange);
  if (!filteredSales || filteredSales.length === 0) {
    return false;
  }

  const exportBreakdown = await resolveExportBreakdownForSales(userId, filteredSales, dateRange!.to || dateRange!.from!);

  const doc = new jsPDF();
  const dateString = `${format(dateRange!.from!, 'PPP')} - ${format(dateRange!.to! || dateRange!.from!, 'PPP')}`;

  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || 'Unknown Customer';
  const getItemTitle = (itemId: string) => items.find(i => i.id === itemId)?.title || 'Unknown Item';

  // Left side header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fallbackStoreName(authUser), 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(authUser.address || '', 14, 26);
  doc.text(authUser.phone || '', 14, 32);

  // Right side header
  let yPos = 20;
  if (authUser.bkashNumber) {
    doc.text(`Bkash: ${authUser.bkashNumber}`, 200, yPos, { align: 'right' });
    yPos += 6;
  }
  if (authUser.bankInfo) {
    doc.text(`Bank: ${authUser.bankInfo}`, 200, yPos, { align: 'right' });
  }

  // Report Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Report', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`For the period: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  const totalPaid = filteredSales.reduce((acc, sale) => acc + (exportBreakdown[sale.id]?.paidAmount ?? sale.total), 0);
  const totalDue = filteredSales.reduce((acc, sale) => acc + (exportBreakdown[sale.id]?.dueAmount ?? 0), 0);
  const totalSalesAmount = filteredSales.reduce((acc, sale) => acc + sale.total, 0);

  autoTable(doc, {
    startY: 60,
    head: [['Date', 'Sale ID', 'Customer', 'Items', 'Discount', 'Status', 'Paid Amount', 'Due Amount', 'Total']],
    body: filteredSales.map(sale => [
      format(new Date(sale.date), 'yyyy-MM-dd'),
      sale.saleId,
      getCustomerName(sale.customerId),
      sale.items.map(i => `${i.quantity}x ${getItemTitle(i.itemId)}`).join(', '),
      sale.discountType === 'percentage' ? `${sale.discountValue}%` : `TK ${sale.discountValue.toFixed(2)}`,
      exportBreakdown[sale.id]?.statusLabel || sale.paymentMethod,
      `TK ${(exportBreakdown[sale.id]?.paidAmount ?? sale.total).toFixed(2)}`,
      `TK ${(exportBreakdown[sale.id]?.dueAmount ?? 0).toFixed(2)}`,
      `TK ${sale.total.toFixed(2)}`
    ]),
    foot: [[
      '',
      '',
      '',
      'TOTAL',
      '',
      '',
      `TK ${totalPaid.toFixed(2)}`,
      `TK ${totalDue.toFixed(2)}`,
      `TK ${totalSalesAmount.toFixed(2)}`
    ]],
    footStyles: { fontStyle: 'bold' },
  });

  doc.save(`sales-report-${format(dateRange!.from!, 'yyyy-MM-dd')}-to-${format(dateRange!.to! || dateRange!.from!, 'yyyy-MM-dd')}.pdf`);
  return true;
}

export async function downloadSalesItemsPdf(userId: string, dateRange: DateRange | undefined, authUser: any, items: Item[]) {
  const filteredSales = await getFilteredSales(userId, dateRange);
  if (!filteredSales || filteredSales.length === 0) {
    return false;
  }

  const getItemTitle = (itemId: string) => items.find(i => i.id === itemId)?.title || 'Unknown Item';
  
  const summary: Record<string, { title: string; qty: number; revenue: number }> = {};
  for (const sale of filteredSales) {
    for (const saleItem of sale.items) {
      const title = getItemTitle(saleItem.itemId);
      if (!summary[saleItem.itemId]) {
        summary[saleItem.itemId] = { title, qty: 0, revenue: 0 };
      }
      summary[saleItem.itemId].qty += saleItem.quantity;
      summary[saleItem.itemId].revenue += saleItem.quantity * saleItem.price;
    }
  }
  const summaryRows = Object.values(summary).sort((a, b) => a.title.localeCompare(b.title));

  const dateString = `${format(dateRange!.from!, 'PPP')} - ${format(dateRange!.to! || dateRange!.from!, 'PPP')}`;
  const totalQty = summaryRows.reduce((acc, r) => acc + r.qty, 0);
  const totalRevenue = summaryRows.reduce((acc, r) => acc + r.revenue, 0);

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fallbackStoreName(authUser), 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(authUser.address || '', 14, 26);
  doc.text(authUser.phone || '', 14, 32);

  let yPos = 20;
  if (authUser.bkashNumber) {
    doc.text(`Bkash: ${authUser.bkashNumber}`, 200, yPos, { align: 'right' });
    yPos += 6;
  }
  if (authUser.bankInfo) {
    doc.text(`Bank: ${authUser.bankInfo}`, 200, yPos, { align: 'right' });
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Items Sold Summary', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`For the period: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['#', 'Item / Book Title', 'Qty Sold', 'Total Revenue']],
    body: summaryRows.map((row, i) => [
      i + 1,
      row.title,
      row.qty,
      `BDT ${row.revenue.toFixed(2)}`,
    ]),
    foot: [['', 'TOTAL', totalQty, `BDT ${totalRevenue.toFixed(2)}`]],
    footStyles: { fontStyle: 'bold' },
  });

  doc.save(`items-sold-${format(dateRange!.from!, 'yyyy-MM-dd')}-to-${format(dateRange!.to! || dateRange!.from!, 'yyyy-MM-dd')}.pdf`);
  return true;
}
