import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getSaleTransaction } from '@/lib/actions';
import { fallbackStoreName } from '@/lib/store-copy';
import type { AuthUser, Customer, Item, Sale } from '@/lib/types';

export async function generateSaleMemoPdf({
  sale,
  customer,
  items,
  user,
}: {
  sale: Sale;
  customer: Customer;
  items: Item[];
  user: AuthUser;
}) {
  let currentPaymentMethod: string = sale.paymentMethod;
  let displayDue = 0;

  if (sale.paymentMethod === 'Due') {
    displayDue = sale.total;
  } else if (sale.paymentMethod === 'Split') {
    displayDue = sale.total - (sale.amountPaid || 0);
  }

  if (sale.paymentMethod === 'Due' || sale.paymentMethod === 'Split') {
    const transaction = await getSaleTransaction(user.uid, sale.saleId);
    if (transaction) {
      if (transaction.status === 'Paid') {
        currentPaymentMethod = 'Paid';
        displayDue = 0;
      } else {
        displayDue = transaction.amount;
      }
    }
  }

  const doc = new jsPDF();
  const companyName = fallbackStoreName(user);
  const address = user.address || '';
  const phone = user.phone || '';
  const getItemTitle = (itemId: string) => items.find((i) => i.id === itemId)?.title || 'Unknown Item';

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
  const nameLines = doc.splitTextToSize(customer.name || '', 110);
  doc.text(nameLines, 14, infoY + 5);
  let addressY = infoY + 5 + nameLines.length * 5;
  if (customer.contactName) {
    doc.text(`Attn: ${customer.contactName}`, 14, addressY);
    addressY += 5;
  }
  const addressLines = doc.splitTextToSize(customer.address || '', 110);
  doc.text(addressLines, 14, addressY);
  const phoneY = addressY + addressLines.length * 5;
  doc.text(customer.phone || '', 14, phoneY);

  doc.setFont('helvetica', 'bold');
  doc.text('Invoice #:', 140, infoY);
  doc.text('Date:', 140, infoY + 5);
  doc.text('Status:', 140, infoY + 10);

  doc.setFont('helvetica', 'normal');
  doc.text(sale.saleId, 165, infoY);
  doc.text(format(new Date(sale.date), 'PPP'), 165, infoY + 5);
  doc.text(currentPaymentMethod, 165, infoY + 10);

  // Table
  const tableData = sale.items.map((item) => [
    getItemTitle(item.itemId),
    item.quantity,
    `TK ${item.price.toFixed(2)}`,
    `TK ${(item.quantity * item.price).toFixed(2)}`,
  ]);

  const discountDiff = sale.subtotal + (sale.extraSales || 0) - sale.total;
  const discountLabel =
    discountDiff >= 0
      ? `Discount${sale.discountType === 'percentage' ? ` (${sale.discountValue}%)` : ''}`
      : 'Extra Profit';
  const discountValueStr =
    discountDiff >= 0
      ? `-TK ${discountDiff.toFixed(2)}`
      : `+TK ${(sale.total - (sale.subtotal + (sale.extraSales || 0))).toFixed(2)}`;

  const footContent = [
    [
      { content: 'Subtotal', colSpan: 3, styles: { halign: 'right', textColor: [100, 100, 100] } },
      { content: `TK ${sale.subtotal.toFixed(2)}`, styles: { textColor: [100, 100, 100] } },
    ],
  ];

  if (sale.extraSales && sale.extraSales > 0) {
    footContent.push([
      { content: 'Extra / Service Sales', colSpan: 3, styles: { halign: 'right', textColor: [100, 100, 100] } },
      { content: `TK ${sale.extraSales.toFixed(2)}`, styles: { textColor: [100, 100, 100] } },
    ]);
  }

  footContent.push(
    [
      { content: discountLabel, colSpan: 3, styles: { halign: 'right', textColor: [34, 197, 94] } },
      { content: discountValueStr, styles: { textColor: [34, 197, 94] } },
    ],
    [
      { content: 'Grand Total', colSpan: 3, styles: { halign: 'right', fontSize: 12, textColor: [0, 0, 0] } as any },
      { content: `TK ${sale.total.toFixed(2)}`, styles: { textColor: [0, 0, 0], fontSize: 12 } as any },
    ]
  );

  if (displayDue > 0) {
    footContent.push([
      { content: 'Remaining Due', colSpan: 3, styles: { halign: 'right' as const, textColor: [220, 38, 38] } },
      { content: `TK ${displayDue.toFixed(2)}`, styles: { textColor: [220, 38, 38] } },
    ]);
  } else if (sale.paymentMethod === 'Due' || sale.paymentMethod === 'Split') {
    footContent.push([
      { content: 'Status', colSpan: 3, styles: { halign: 'right' as const, textColor: [34, 197, 94] } },
      { content: `PAID`, styles: { textColor: [34, 197, 94] } },
    ]);
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

  doc.save(`memo-${sale.saleId}-${customer.name}.pdf`);
}
