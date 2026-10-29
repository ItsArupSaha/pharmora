'use client';

import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Item, StoreType } from '@/lib/types';

interface ExportUser {
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  storeType?: StoreType;
}

export function handleDownloadPdf(filteredAndSortedItems: Item[], authUser: ExportUser | null, reportTitle: string) {
  if (!filteredAndSortedItems.length || !authUser) return;

  const doc = new jsPDF();
  const dateString = format(new Date(), 'PPP');
  const isGeneral = authUser.storeType === 'general';

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(fallbackStoreName(authUser), 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(authUser.address || '', 14, 26);
  doc.text(authUser.phone || '', 14, 32);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${isGeneral ? 'Expiry' : 'Medicine Expiry'} Report (${reportTitle})`, 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Generated on: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 58,
    head: [[
      'Title',
      ...(isGeneral ? [] : ['Group (Generic)']),
      'Company',
      'Expiry Date',
      'Stock'
    ]],
    body: filteredAndSortedItems.map(item => [
      item.title,
      ...(isGeneral ? [] : [item.medicineGroup || '-']),
      item.company || '-',
      item.expiryDate || '-',
      item.stock,
    ]),
  });

  doc.save(`expiry-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function handleDownloadXlsx(
  filteredAndSortedItems: Item[],
  reportTitle: string,
  storeType?: StoreType
) {
  if (!filteredAndSortedItems.length) return;

  const showGroup = storeType !== 'general';
  const dataToExport = filteredAndSortedItems.map(item => {
    const row: Record<string, string | number> = { Title: item.title };
    if (showGroup) row['Group (Generic)'] = item.medicineGroup || '-';
    return {
      ...row,
      Company: item.company || '-',
      'Expiry Date': item.expiryDate || '-',
      Stock: item.stock,
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
  XLSX.utils.book_append_sheet(workbook, worksheet, reportTitle.slice(0, 30) || 'Expiry Report');
  XLSX.writeFile(workbook, `expiry-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
