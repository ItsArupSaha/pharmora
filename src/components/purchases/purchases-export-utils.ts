import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Purchase } from '@/lib/types';
import { getPurchases } from '@/lib/actions';
import type { DateRange } from 'react-day-picker';

export async function getFilteredPurchases(userId: string, dateRange: DateRange | undefined) {
  if (!dateRange?.from) {
    throw new Error("Please select a start date.");
  }
  
  const allPurchases = await getPurchases(userId);
  const from = dateRange.from;
  const to = dateRange.to || dateRange.from;
  
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  
  return allPurchases.filter(p => {
    const pDate = new Date(p.date);
    return pDate >= start && pDate <= end;
  });
}

export async function downloadPurchasesPdf(userId: string, dateRange: DateRange | undefined, authUser: any) {
  const filteredPurchases = await getFilteredPurchases(userId, dateRange);
  if (!filteredPurchases || filteredPurchases.length === 0) {
    return false;
  }
  
  const doc = new jsPDF();
  const dateString = `${format(dateRange!.from!, 'PPP')} - ${format(dateRange!.to! || dateRange!.from!, 'PPP')}`;

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
  doc.text('Purchases Report', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`For the period: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['Date', 'Purchase ID', 'Supplier', 'Items', 'Total', 'Discount', 'Net']],
    body: filteredPurchases.map(p => {
      const discount = p.discountAmount || 0;
      const net = p.totalAmount - discount;
      return [
        format(new Date(p.date), 'yyyy-MM-dd'),
        p.purchaseId,
        p.supplier,
        p.items.map(i => `${i.quantity}x ${i.itemName}`).join(', '),
        `TK ${p.totalAmount.toFixed(2)}`,
        `TK ${discount.toFixed(2)}`,
        `TK ${net.toFixed(2)}`
      ];
    }),
  });
  doc.save(`purchases-report-${format(dateRange!.from!, 'yyyy-MM-dd')}.pdf`);
  return true;
}

export async function downloadPurchasesXlsx(userId: string, dateRange: DateRange | undefined) {
  const filteredPurchases = await getFilteredPurchases(userId, dateRange);
  if (!filteredPurchases || filteredPurchases.length === 0) {
    return false;
  }
  
  const dataToExport = filteredPurchases.flatMap(p => 
    p.items.map(i => {
      const discount = p.discountAmount || 0;
      const net = p.totalAmount - discount;
      return {
        'Date': format(new Date(p.date), 'yyyy-MM-dd'),
        'Purchase ID': p.purchaseId,
        'Supplier': p.supplier,
        'Item Name': i.itemName,
        'Category': i.categoryName,
        'Quantity': i.quantity,
        'Unit Cost': i.cost,
        'Total Cost': i.quantity * i.cost,
        'Grand Total': p.totalAmount,
        'Discount': discount,
        'Net Total': net,
      };
    })
  );

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  // Auto-fit columns
  const columnWidths = Object.keys(dataToExport[0]).map(key => {
    const maxLength = Math.max(
      ...dataToExport.map(row => {
        const value = row[key as keyof typeof row];
        return typeof value === 'number' ? String(value).length : (value || '').length;
      }),
      key.length
    );
    return { wch: maxLength + 2 };
  });
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchases');
  XLSX.writeFile(workbook, `purchases-report-${format(dateRange!.from!, 'yyyy-MM-dd')}.xlsx`);
  return true;
}
