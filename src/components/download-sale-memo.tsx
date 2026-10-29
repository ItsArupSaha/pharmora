
'use client';

import { fallbackStoreName } from '@/lib/store-copy';
import type { AuthUser, Customer, Item, Sale } from '@/lib/types';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import { Button } from './ui/button';

import { getSaleTransaction } from '@/lib/actions';

interface DownloadSaleMemoProps {
  sale: Sale;
  customer: Customer;
  items: Item[];
  user: AuthUser;
}

export function DownloadSaleMemo({ sale, customer, items, user }: DownloadSaleMemoProps) {
  const getItemTitle = (itemId: string) => items.find(i => i.id === itemId)?.title || 'Unknown Item';

  const generatePdf = async () => {
    let currentPaymentMethod: string = sale.paymentMethod;
    let currentAmountDue = 0;

    // Default currentAmountDue based on initial sale state
    if (sale.paymentMethod === 'Due') {
      currentAmountDue = sale.total;
    } else if (sale.paymentMethod === 'Split') {
      currentAmountDue = sale.total - (sale.amountPaid || 0);
    }

    // Fetch the absolute latest status from the transactions system
    if (sale.paymentMethod === 'Due' || sale.paymentMethod === 'Split') {
      try {
        const transaction = await getSaleTransaction(user.uid, sale.saleId);
        if (transaction) {
          if (transaction.status === 'Paid') {
            currentPaymentMethod = 'Paid';
            currentAmountDue = 0;
          } else {
            // Partially paid or still pending - amount in transaction is the REMAINING due
            currentAmountDue = transaction.amount;
          }
        }
      } catch (error) {
        console.error("Error fetching latest sale status:", error);
      }
    }

    const doc = new jsPDF();
    const companyName = fallbackStoreName(user);
    const address = user.address || '';
    const phone = user.phone || '';

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(companyName, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(address, 14, 28);
    doc.text(phone, 14, 32);

    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 200, 22, { align: 'right' });

    // Customer & Invoice Info
    const infoY = 45;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO', 14, infoY);
    doc.setFont('helvetica', 'normal');
    const nameLines = doc.splitTextToSize(String(customer?.name || ''), 110);
    doc.text(nameLines, 14, infoY + 5);
    const addressY = infoY + 5 + (nameLines.length * 5);
    const addressLines = doc.splitTextToSize(String(customer?.address || ''), 110);
    doc.text(addressLines, 14, addressY);
    const phoneY = addressY + (addressLines.length * 5);
    doc.text(String(customer?.phone || ''), 14, phoneY);

    doc.setFont('helvetica', 'bold');
    doc.text('Invoice #:', 140, infoY);
    doc.text('Date:', 140, infoY + 5);
    doc.text('Status:', 140, infoY + 10);

    doc.setFont('helvetica', 'normal');
    doc.text(String(sale?.saleId || ''), 165, infoY);
    doc.text(format(new Date(sale.date), 'PPP'), 165, infoY + 5);
    doc.text(currentPaymentMethod, 165, infoY + 10);


    // Table
    const tableData = sale.items.map(item => [
      getItemTitle(item.itemId),
      item.quantity,
      `TK ${item.price.toFixed(2)}`,
      `TK ${(item.quantity * item.price).toFixed(2)}`
    ]);

    const footContent = [
      [{ content: 'Subtotal', colSpan: 3, styles: { halign: 'right', textColor: [100, 100, 100] } }, { content: `TK ${sale.subtotal.toFixed(2)}`, styles: { textColor: [100, 100, 100] } }],
      [{ content: `Discount${sale.discountType === 'percentage' ? ` (${sale.discountValue}%)` : ''}`, colSpan: 3, styles: { halign: 'right', textColor: [34, 197, 94] } }, { content: `-TK ${(sale.subtotal - sale.total).toFixed(2)}`, styles: { textColor: [34, 197, 94] } }],
      [{ content: 'Grand Total', colSpan: 3, styles: { halign: 'right', fontSize: 12, textColor: [0, 0, 0] } }, { content: `TK ${sale.total.toFixed(2)}`, styles: { textColor: [0, 0, 0], fontSize: 12 } }],
    ];

    if (currentAmountDue > 0) {
      footContent.push(
        [{ content: 'Remaining Due', colSpan: 3, styles: { halign: 'right' as const, textColor: [220, 38, 38] } }, { content: `TK ${currentAmountDue.toFixed(2)}`, styles: { textColor: [220, 38, 38] } }]
      );
    } else if (sale.paymentMethod === 'Due' || sale.paymentMethod === 'Split') {
      footContent.push(
        [{ content: 'Status', colSpan: 3, styles: { halign: 'right' as const, textColor: [34, 197, 94] } }, { content: `PAID`, styles: { textColor: [34, 197, 94] } }]
      );
    }

    autoTable(doc, {
      startY: Math.max(infoY + 25, phoneY + 10),
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204] }, // #0066CC Indigo
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
      foot: footContent as any,
    });

    // Footer
    let finalY = (doc as any).lastAutoTable.finalY || doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(10);
    doc.text('Thank you for your business!', 105, finalY + 20, { align: 'center' });

    doc.save(`memo-${sale.saleId}-${customer?.name || 'Customer'}.pdf`);
  };

  return (
    <Button onClick={generatePdf} variant="ghost" size="icon" title="Download Memo">
      <Download className="h-4 w-4" />
    </Button>
  );
}
