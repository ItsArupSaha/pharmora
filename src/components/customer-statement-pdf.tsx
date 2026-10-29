
'use client';

import { useAuth } from '@/hooks/use-auth';
import { fallbackStoreName } from '@/lib/store-copy';
import type { Customer, Item, Sale } from '@/lib/types';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText } from 'lucide-react';
import { Button } from './ui/button';

interface CustomerStatementPDFProps {
  customer: Customer;
  sales: Sale[];
  items: Item[];
}

export default function CustomerStatementPDF({ customer, sales, items }: CustomerStatementPDFProps) {
  const { authUser } = useAuth();
  const getItemTitle = (itemId: string) => items.find(i => i.id === itemId)?.title || 'Unknown Item';

  const generatePdf = () => {
    if (!authUser) return;
    const doc = new jsPDF();
    
    const companyName = fallbackStoreName(authUser);
    const companyAddress = authUser.address || '';
    const companyPhone = authUser.phone || '';
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(companyName, 14, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(companyAddress, 14, 28);
    doc.text(companyPhone, 14, 32);


    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Customer Statement', 200, 22, { align: 'right' });


    // Customer Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, 38, 45);
    let infoRow = 51;
    if (customer.contactName) {
      doc.text(`Attn: ${customer.contactName}`, 38, infoRow);
      infoRow += 6;
    }
    doc.text(customer.address, 38, infoRow);
    doc.text(customer.phone, 38, infoRow + 6);

    doc.setFont('helvetica', 'bold');
    doc.text('Date:', 140, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), 'PPP'), 155, 45);


    // Table
    const tableData = sales.map(sale => {
      const itemsString = sale.items.map(i => `${i.quantity}x ${getItemTitle(i.itemId)}`).join('\n');
      return [
        format(new Date(sale.date), 'yyyy-MM-dd'),
        itemsString,
        sale.paymentMethod,
        `BDT ${sale.total.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 65,
      head: [['Date', 'Description', 'Payment Method', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 102, 204] }, // #0066CC Indigo
      didParseCell: function (data) {
        if (data.column.dataKey === 1) { // Description column
          data.cell.styles.cellWidth = 'auto';
        }
      }
    });

    // Footer
    let finalY = (doc as any).lastAutoTable.finalY || 10;
    doc.setFontSize(10);
    doc.text('Thank you for your business!', 105, finalY + 20, { align: 'center' });

    doc.save(`statement-${customer.name.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Button onClick={generatePdf} variant="outline" disabled={!authUser}>
      <FileText className="mr-2 h-4 w-4" />
      Download PDF
    </Button>
  );
}
