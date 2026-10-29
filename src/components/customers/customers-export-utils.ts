import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Customer, StoreType } from '@/lib/types';

interface AuthUserProps {
  companyName?: string;
  address?: string;
  phone?: string;
  bkashNumber?: string;
  bankInfo?: string;
  storeType?: StoreType;
}

export function exportCustomersToPdf(allCustomers: Customer[], authUser: AuthUserProps | null) {
  if (!allCustomers.length || !authUser) return;

  const doc = new jsPDF();
  const dateString = format(new Date(), 'PPP');

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
  doc.text('Customer List', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`As of ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['Name', 'Phone', 'Address', 'Due Balance']],
    body: allCustomers.map(c => [
      c.name,
      c.phone,
      c.address,
      `BDT ${(c.dueBalance || 0).toFixed(2)}`
    ]),
  });

  doc.save(`customer-list-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportCustomersToXlsx(allCustomers: Customer[]) {
  if (!allCustomers.length) return;

  const dataToExport = allCustomers.map(c => ({
    Name: c.name,
    Phone: c.phone,
    WhatsApp: c.whatsapp || '',
    Address: c.address,
    'Due Balance': c.dueBalance || 0,
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');
  XLSX.writeFile(workbook, `customer-list-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
