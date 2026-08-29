import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ClosingStock, Item } from '@/lib/types';

interface AuthUserProps {
  companyName?: string;
  address?: string;
  phone?: string;
  bkashNumber?: string;
  bankInfo?: string;
}

export function exportClosingStockPdf(
  closingStockData: ClosingStock[],
  closingStockDate: Date,
  authUser: AuthUserProps | null,
  companyName?: string
) {
  if (!closingStockData.length || !closingStockDate || !authUser) return;

  const sortedData = [...closingStockData].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  const doc = new jsPDF();
  const dateString = format(closingStockDate, 'PPP');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(authUser.companyName || 'Pharmacy', 14, 20);
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
  const titleText = companyName && companyName !== 'all'
    ? `Closing Stock Report - ${companyName}`
    : 'Closing Stock Report';
  doc.text(titleText, 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`As of ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  const detailHeader = 'Group (Generic)';

  autoTable(doc, {
    startY: 60,
    head: [['Title', 'Category', detailHeader, 'Company', 'Expiry Date', 'Prod. Price (TK)', 'MRP (TK)', 'Stock']],
    body: sortedData.map(item => [
      item.title,
      item.categoryName,
      item.medicineGroup || '-',
      item.company || '-',
      item.expiryDate || '-',
      item.productionPrice.toFixed(2),
      item.sellingPrice.toFixed(2),
      item.closingStock
    ]),
  });

  const companySlug = companyName && companyName !== 'all'
    ? `-${companyName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  doc.save(`closing-stock-report${companySlug}-${format(closingStockDate, 'yyyy-MM-dd')}.pdf`);
}

export function exportClosingStockXlsx(
  closingStockData: ClosingStock[],
  closingStockDate: Date,
  companyName?: string
) {
  if (!closingStockData.length || !closingStockDate) return;

  const sortedData = [...closingStockData].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  const detailHeader = 'Group (Generic)';

  const dataToExport = sortedData.map(item => ({
    Title: item.title,
    Category: item.categoryName,
    [detailHeader]: item.medicineGroup || '-',
    Company: item.company || '-',
    'Expiry Date': item.expiryDate || '-',
    'Production Price': item.productionPrice,
    'MRP': item.sellingPrice,
    Stock: item.closingStock,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  const columnWidths = Object.keys(dataToExport[0]).map(key => {
    const maxLength = Math.max(
      ...dataToExport.map(row => String(row[key as keyof typeof row]).length),
      key.length
    );
    return { wch: maxLength + 2 };
  });
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = companyName && companyName !== 'all'
    ? companyName.slice(0, 31)
    : 'Closing Stock';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const companySlug = companyName && companyName !== 'all'
    ? `-${companyName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  XLSX.writeFile(workbook, `closing-stock-report${companySlug}-${format(closingStockDate, 'yyyy-MM-dd')}.xlsx`);
}

export function exportInventoryPdf(
  items: Item[],
  authUser: AuthUserProps | null,
  companyName?: string
) {
  if (!items.length || !authUser) return;

  const sortedItems = [...items].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  const doc = new jsPDF();
  const dateString = format(new Date(), 'PPP');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(authUser.companyName || 'Pharmacy', 14, 20);
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
  const titleText = companyName && companyName !== 'all'
    ? `Stock Report - ${companyName}`
    : 'Stock Report (Full Inventory)';
  doc.text(titleText, 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated on ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  const detailHeader = 'Group (Generic)';

  autoTable(doc, {
    startY: 60,
    head: [['Title', 'Category', detailHeader, 'Company', 'Expiry Date', 'Prod. Price (TK)', 'MRP (TK)', 'Stock']],
    body: sortedItems.map(item => [
      item.title,
      item.categoryName,
      item.medicineGroup || '-',
      item.company || '-',
      item.expiryDate || '-',
      (item.productionPrice || 0).toFixed(2),
      (item.sellingPrice || 0).toFixed(2),
      item.stock ?? 0,
    ]),
  });

  const companySlug = companyName && companyName !== 'all'
    ? `-${companyName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  doc.save(`stock-report${companySlug}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportInventoryXlsx(
  items: Item[],
  companyName?: string
) {
  if (!items.length) return;

  const sortedItems = [...items].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  const detailHeader = 'Group (Generic)';

  const dataToExport = sortedItems.map(item => ({
    Title: item.title,
    Category: item.categoryName,
    [detailHeader]: item.medicineGroup || '-',
    Company: item.company || '-',
    'Expiry Date': item.expiryDate || '-',
    'Production Price': item.productionPrice || 0,
    'MRP': item.sellingPrice || 0,
    Stock: item.stock ?? 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);

  const columnWidths = Object.keys(dataToExport[0]).map(key => {
    const maxLength = Math.max(
      ...dataToExport.map(row => String(row[key as keyof typeof row]).length),
      key.length
    );
    return { wch: maxLength + 2 };
  });
  worksheet['!cols'] = columnWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = companyName && companyName !== 'all'
    ? companyName.slice(0, 31)
    : 'Stock Report';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const companySlug = companyName && companyName !== 'all'
    ? `-${companyName.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  XLSX.writeFile(workbook, `stock-report${companySlug}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
