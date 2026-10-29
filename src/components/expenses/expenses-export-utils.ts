import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Expense } from '@/lib/types';
import { getExpenses } from '@/lib/actions';
import type { DateRange } from 'react-day-picker';

export async function getFilteredExpenses(userId: string, dateRange: DateRange | undefined) {
  if (!dateRange?.from) {
    throw new Error("Please select a start date.");
  }

  const allExpenses = await getExpenses(userId);
  const from = dateRange.from;
  const to = dateRange.to || dateRange.from;
  
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return allExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= start && expenseDate <= end;
  });
}

export async function downloadExpensesPdf(userId: string, dateRange: DateRange | undefined, authUser: any) {
  const filteredExpenses = await getFilteredExpenses(userId, dateRange);
  if (!filteredExpenses || filteredExpenses.length === 0) {
    return false;
  }

  const doc = new jsPDF();
  const dateString = `${format(dateRange!.from!, 'PPP')} - ${format(dateRange!.to! || dateRange!.from!, 'PPP')}`;
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

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
  doc.text('Expense Report', 105, 45, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`For the period: ${dateString}`, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 60,
    head: [['Date', 'Expense ID', 'Description', 'Method', 'Amount']],
    body: filteredExpenses.map(e => [
      format(new Date(e.date), 'yyyy-MM-dd'),
      e.expenseId || 'N/A',
      e.description || '',
      e.paymentMethod || '',
      `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(e.amount)}`
    ]).filter(row => row.every(cell => cell !== undefined)),
    foot: [
      [
        { content: 'Total', colSpan: 5, styles: { halign: 'right' } },
        `BDT ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalExpenses)}`
      ],
    ],
    footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
  });

  doc.save(`expense-report-${format(dateRange!.from!, 'yyyy-MM-dd')}-to-${format(dateRange!.to! || dateRange!.from!, 'yyyy-MM-dd')}.pdf`);
  return true;
}

export async function downloadExpensesXlsx(userId: string, dateRange: DateRange | undefined) {
  const filteredExpenses = await getFilteredExpenses(userId, dateRange);
  if (!filteredExpenses || filteredExpenses.length === 0) {
    return false;
  }

  const dataToExport = filteredExpenses.map(e => ({
    'Date': format(new Date(e.date), 'yyyy-MM-dd'),
    'Expense ID': e.expenseId || 'N/A',
    'Description': e.description,
    'Method': e.paymentMethod,
    'Amount': e.amount,
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
  XLSX.writeFile(workbook, `expense-report-${format(dateRange!.from!, 'yyyy-MM-dd')}-to-${format(dateRange!.to! || dateRange!.from!, 'yyyy-MM-dd')}.xlsx`);
  return true;
}
