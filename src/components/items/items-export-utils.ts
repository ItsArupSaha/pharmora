import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { ClosingStock, StoreType } from '@/lib/types';

interface AuthUserProps {
  companyName?: string;
  address?: string;
  phone?: string;
  bkashNumber?: string;
  bankInfo?: string;
  storeType?: StoreType;
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
  const showGroup = authUser.storeType !== 'general';

  autoTable(doc, {
    startY: 60,
    head: [[
      'Title',
      'Category',
      ...(showGroup ? [detailHeader] : []),
      'Company',
      'Expiry Date',
      'Prod. Price (TK)',
      'MRP (TK)',
      'Stock'
    ]],
    body: sortedData.map(item => [
      item.title,
      item.categoryName,
      ...(showGroup ? [item.medicineGroup || '-'] : []),
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
  companyName?: string,
  storeType?: StoreType
) {
  if (!closingStockData.length || !closingStockDate) return;

  const sortedData = [...closingStockData].sort((a, b) =>
    (a.title || '').localeCompare(b.title || '')
  );

  const showGroup = storeType !== 'general';
  const dataToExport = sortedData.map(item => {
    const row: Record<string, string | number> = {
      Title: item.title,
      Category: item.categoryName,
    };
    if (showGroup) row['Group (Generic)'] = item.medicineGroup || '-';
    return {
      ...row,
      Company: item.company || '-',
      'Expiry Date': item.expiryDate || '-',
      'Production Price': item.productionPrice,
      'MRP': item.sellingPrice,
      Stock: item.closingStock,
    };
  });

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
