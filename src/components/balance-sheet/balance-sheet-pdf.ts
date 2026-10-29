import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fallbackStoreName } from '@/lib/store-copy';
import type { StoreType } from '@/lib/types';

interface BalanceSheetPdfData {
    cash: number;
    bank: number;
    stockValue: number;
    officeAssetsValue: number;
    securityDepositsValue: number;
    totalAssets: number;
    payables: number;
    equity: number;
    totalCapital: number;
    retainedEarnings: number;
}

interface BalanceSheetPdfUser {
    companyName?: string | null;
    address?: string | null;
    phone?: string | null;
    bkashNumber?: string | null;
    bankInfo?: string | null;
    storeType?: StoreType;
}

const formatCurrencyForPdf = (amount: number) =>
    `BDT ${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)}`;

export function exportBalanceSheetPdf(
    current: BalanceSheetPdfData,
    effectiveDate: Date,
    asOfDate: Date | undefined,
    authUser: BalanceSheetPdfUser | null
) {
    if (!authUser || !current) return;
    const doc = new jsPDF();

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
    doc.text('Balance Sheet', 105, 45, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`As of: ${format(effectiveDate, 'PPP')}`, 105, 51, { align: 'center' });
    doc.setTextColor(0);

    // Assets & Dues Table
    const assetsBody = [
        ['Cash', formatCurrencyForPdf(current.cash)],
        ['Bank', formatCurrencyForPdf(current.bank)],
        ['Stock Value', formatCurrencyForPdf(current.stockValue)],
        ['Office Assets', formatCurrencyForPdf(current.officeAssetsValue)],
        ['Security Deposit (Refundable)', formatCurrencyForPdf(current.securityDepositsValue)],
    ];

    autoTable(doc, {
        startY: 60,
        head: [['Assets & Dues', 'Amount']],
        body: assetsBody,
        foot: [
            [{ content: 'Total Assets', styles: { fontStyle: 'bold' } }, { content: formatCurrencyForPdf(current.totalAssets), styles: { fontStyle: 'bold' } }],
        ],
        theme: 'striped',
        headStyles: { fillColor: '#0066CC', fontStyle: 'bold' },
        footStyles: { fillColor: '#F1F5F9', textColor: '#000000', fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;

    // Liabilities & Equity Table
    const liabilitiesBody = [
        ['Payables', formatCurrencyForPdf(current.payables)],
        [{ content: 'Total Liabilities', styles: { fontStyle: 'bold' as const } }, { content: formatCurrencyForPdf(current.payables), styles: { fontStyle: 'bold' as const } }],
        [{ content: 'Owner\'s Equity', styles: { fontStyle: 'bold' as const, textColor: '#0066CC' } }, ''],
        ['  Capital Contributed', formatCurrencyForPdf(current.totalCapital)],
        ['  Retained Earnings (Profit/Loss)', formatCurrencyForPdf(current.retainedEarnings)],
        [{ content: 'Total Owner\'s Equity / Net Worth', styles: { fontStyle: 'bold' as const } }, { content: formatCurrencyForPdf(current.equity), styles: { fontStyle: 'bold' as const } }],
    ] as any;

    autoTable(doc, {
        startY: finalY + 15,
        head: [['Liabilities & Equity', 'Amount']],
        body: liabilitiesBody,
        theme: 'striped',
        headStyles: { fillColor: '#0066CC', fontStyle: 'bold' as const },
        columnStyles: { 1: { halign: 'right' } },
    });

    const fileName = asOfDate
        ? `balance-sheet-${format(effectiveDate, 'yyyy-MM-dd')}.pdf`
        : `balance-sheet-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
}
