import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Transaction, StoreType } from '@/lib/types';

interface AuthUserProps {
  companyName?: string;
  address?: string;
  phone?: string;
  bkashNumber?: string;
  bankInfo?: string;
  storeType?: StoreType;
}

function drawCompanyHeader(doc: jsPDF, authUser: AuthUserProps) {
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
}

export function generatePendingPayablesPdf(data: Transaction[], date: Date, authUser: AuthUserProps) {
  const doc = new jsPDF();
  const validDate = date && !isNaN(date.getTime()) ? date : new Date();
  const dateString = format(validDate, 'PPP');
  const totalAmount = data.reduce((sum, t) => sum + (t.amount || 0), 0);

  drawCompanyHeader(doc, authUser);

  // Report Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Pending Payables Report', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`As of ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['Description', 'Due Date', 'Amount']],
    body: data.map(t => [
      t.description,
      format(new Date(t.dueDate), 'yyyy-MM-dd'),
      `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t.amount)}`
    ]),
    foot: [[
      { content: 'Total', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
      `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)}`
    ]],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });
  doc.save(`pending-payables-${format(validDate, 'yyyy-MM-dd')}.pdf`);
}

export function generatePendingPayablesXlsx(data: Transaction[], date: Date) {
  const validDate = date && !isNaN(date.getTime()) ? date : new Date();
  const dataToExport = data.map(t => ({
    'Description': t.description,
    'Due Date': format(new Date(t.dueDate), 'yyyy-MM-dd'),
    'Amount': t.amount,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Payables');
  XLSX.writeFile(workbook, `pending-payables-${format(validDate, 'yyyy-MM-dd')}.xlsx`);
}

export function generatePaidPayablesPdf(data: Transaction[], fromDate: Date, toDate?: Date, authUser?: AuthUserProps) {
  const doc = new jsPDF();
  const totalAmount = data.reduce((sum, t) => sum + (t.amount || 0), 0);
  const dateString = toDate
    ? `${format(fromDate, 'PPP')} - ${format(toDate, 'PPP')}`
    : format(fromDate, 'PPP');

  if (authUser) {
    drawCompanyHeader(doc, authUser);
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Paid Payables Report', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`For the period: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['Description', 'Due Date', 'Amount']],
    body: data.map(t => [
      t.description,
      format(new Date(t.dueDate), 'yyyy-MM-dd'),
      `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(t.amount)}`
    ]),
    foot: [[
      { content: 'Total', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } },
      `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)}`
    ]],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
  });
  doc.save(`paid-payables-${format(fromDate, 'yyyy-MM-dd')}.pdf`);
}

export function generatePaidPayablesXlsx(data: Transaction[], fromDate: Date, toDate?: Date) {
  const dataToExport = data.map(t => ({
    'Description': t.description,
    'Due Date': format(new Date(t.dueDate), 'yyyy-MM-dd'),
    'Amount': t.amount,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Paid Payables');
  XLSX.writeFile(workbook, `paid-payables-${format(fromDate, 'yyyy-MM-dd')}.xlsx`);
}
