import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReportAnalysis, DailyReportAnalysis } from '@/lib/report-generator';
import { fallbackStoreName } from '@/lib/store-copy';

interface GenerateReportPdfProps {
  reportData: ReportAnalysis | DailyReportAnalysis;
  reportType: 'monthly' | 'daily';
  dateLabel: string;
  authUser: any;
}

const formatCurrencyForPdf = (amount: number) => {
  return `BDT ${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
};

export function generateReportPdf({
  reportData,
  reportType,
  dateLabel,
  authUser,
}: GenerateReportPdfProps) {
  if (!authUser) return;
  const doc = new jsPDF();

  const activity =
    reportType === 'daily'
      ? (reportData as DailyReportAnalysis).dailyActivity
      : (reportData as ReportAnalysis).monthlyActivity;

  // Mismatched payload/type has nothing printable; the preview already
  // refuses to render it.
  if (!activity) return;

  const { salesBreakdown, cashFlow, netResult, purchases } = reportData;

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
  doc.text(
    reportType === 'daily' ? 'Daily Financial Report' : 'Monthly Financial Report',
    105,
    45,
    { align: 'center' }
  );
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(dateLabel, 105, 51, { align: 'center' });
  doc.setTextColor(0);

  // Activity Table
  const activityBody: (string[])[] = [
    ['Total Sales', formatCurrencyForPdf(activity.totalSales)],
  ];
  if (activity.totalExtraSales && activity.totalExtraSales > 0) {
    activityBody.push(['  └ Extra / Service Sales (100% Profit)', formatCurrencyForPdf(activity.totalExtraSales)]);
  }
  activityBody.push(
    ['Total Profit', formatCurrencyForPdf(activity.totalProfit)],
    ['Received Payments from Dues', formatCurrencyForPdf(activity.receivedPaymentsFromDues)],
    ['Total Expenses', `(${formatCurrencyForPdf(activity.totalExpenses)})`]
  );

  autoTable(doc, {
    startY: 60,
    head: [[reportType === 'daily' ? 'Daily Activity' : 'Monthly Activity', 'Amount']],
    body: activityBody,
    theme: 'striped',
    headStyles: { fillColor: '#0066CC' },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 10;

  // Sales Breakdown Table
  const salesBreakdownBody = [
    ['Paid Sale', formatCurrencyForPdf(salesBreakdown.paid)],
    ['Due Sale', formatCurrencyForPdf(salesBreakdown.due)],
  ];

  autoTable(doc, {
    startY: finalY,
    head: [['Sales Breakdown', 'Amount']],
    body: salesBreakdownBody,
    theme: 'striped',
    headStyles: { fillColor: '#0066CC' },
  });

  finalY = (doc as any).lastAutoTable.finalY + 10;

  // Purchases Summary Table
  const purchasesBody = [
    ['Total Purchased', formatCurrencyForPdf(purchases.totalPurchased)],
    ['Paid to Suppliers', `(${formatCurrencyForPdf(Math.max(0, purchases.paidToSuppliers))})`],
    ['New Supplier Due', `(${formatCurrencyForPdf(purchases.newSupplierDue)})`],
  ];

  autoTable(doc, {
    startY: finalY,
    head: [['Purchases (Stock Inflow)', 'Amount']],
    body: purchasesBody,
    theme: 'striped',
    headStyles: { fillColor: '#0066CC' },
  });

  finalY = (doc as any).lastAutoTable.finalY + 10;

  // Cash Flow Summary Table
  const cashFlowBody = [
    ['Sales - Cash', formatCurrencyForPdf(cashFlow.sales.cash)],
    ['Sales - Bank', formatCurrencyForPdf(cashFlow.sales.bank)],
    ['Due Payments - Cash', formatCurrencyForPdf(cashFlow.duePayments.cash)],
    ['Due Payments - Bank', formatCurrencyForPdf(cashFlow.duePayments.bank)],
    ['Expenses - Cash', `(${formatCurrencyForPdf(cashFlow.expenses.cash)})`],
    ['Expenses - Bank', `(${formatCurrencyForPdf(cashFlow.expenses.bank)})`],
  ];

  autoTable(doc, {
    startY: finalY,
    head: [['Cash Flow Summary', 'Amount']],
    body: cashFlowBody,
    theme: 'striped',
    headStyles: { fillColor: '#0066CC' },
  });

  finalY = (doc as any).lastAutoTable.finalY + 10;

  // Net Result
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(
    reportType === 'daily'
      ? 'Net Profit / Loss for the Day:'
      : 'Net Profit / Loss for the Month:',
    14,
    finalY + 15
  );
  const netColor = netResult.netProfitOrLoss >= 0 ? '#0066CC' : '#E53E3E';
  doc.setTextColor(netColor);
  doc.text(formatCurrencyForPdf(netResult.netProfitOrLoss), 200, finalY + 15, {
    align: 'right',
  });
  doc.setTextColor(0);

  const safeDateLabel = dateLabel.replace(/[\s,]+/g, '-').toLowerCase();
  doc.save(`report-${reportType}-${safeDateLabel}.pdf`);
}
