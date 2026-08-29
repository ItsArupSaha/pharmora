import * as React from 'react';
import { FileSpreadsheet, FileText, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAccountAccess } from '@/hooks/use-account-access';
import { ClosingStockDialog } from './closing-stock-dialog';

interface ItemManagementHeaderProps {
  userId: string;
  isStockDialogOpen: boolean;
  setIsStockDialogOpen: (open: boolean) => void;
  closingStockDate: Date | undefined;
  setClosingStockDate: (date: Date | undefined) => void;
  handleDownloadClosingStockPdf: (company?: string) => void;
  handleDownloadClosingStockXlsx: (company?: string) => void;
  isCalculating: boolean;
  companies?: string[];
  selectedCompany?: string;
  onCompanyChange?: (company: string) => void;
  onDownloadInventoryPdf?: () => void;
  onDownloadInventoryXlsx?: () => void;
  hasItemsToDownload?: boolean;
  handleAddNewItem: () => void;
  loadData: () => void;
}

export function ItemManagementHeader({
  userId,
  isStockDialogOpen,
  setIsStockDialogOpen,
  closingStockDate,
  setClosingStockDate,
  handleDownloadClosingStockPdf,
  handleDownloadClosingStockXlsx,
  isCalculating,
  companies = [],
  selectedCompany = 'all',
  onCompanyChange,
  onDownloadInventoryPdf,
  onDownloadInventoryXlsx,
  hasItemsToDownload = true,
  handleAddNewItem,
  loadData,
}: ItemManagementHeaderProps) {
  const { canWrite } = useAccountAccess();
  return (
    <CardHeader>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <CardTitle className="font-headline text-2xl">Item Inventory</CardTitle>
          <CardDescription>Manage your item catalog, prices, and stock levels.</CardDescription>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
          <Button
            onClick={handleAddNewItem}
            disabled={!canWrite}
            title={canWrite ? undefined : 'Adding items is disabled while the service is paused.'}
            className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item
          </Button>
          {onDownloadInventoryPdf && (
            <Button
              variant="outline"
              onClick={onDownloadInventoryPdf}
              disabled={!hasItemsToDownload}
              className="w-full sm:w-auto"
            >
              <FileText className="mr-2 h-4 w-4" /> Download PDF
            </Button>
          )}
          {onDownloadInventoryXlsx && (
            <Button
              variant="outline"
              onClick={onDownloadInventoryXlsx}
              disabled={!hasItemsToDownload}
              className="w-full sm:w-auto"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
            </Button>
          )}
          <ClosingStockDialog
            isOpen={isStockDialogOpen}
            onOpenChange={setIsStockDialogOpen}
            closingStockDate={closingStockDate}
            onDateChange={setClosingStockDate}
            onDownloadPdf={handleDownloadClosingStockPdf}
            onDownloadXlsx={handleDownloadClosingStockXlsx}
            isCalculating={isCalculating}
            companies={companies}
            selectedCompany={selectedCompany}
            onCompanyChange={onCompanyChange}
          />
        </div>
      </div>
    </CardHeader>
  );
}
