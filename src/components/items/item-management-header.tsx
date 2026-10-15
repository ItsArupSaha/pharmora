import * as React from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAccountAccess } from '@/hooks/use-account-access';
import { ClosingStockDialog } from './closing-stock-dialog';

interface ItemManagementHeaderProps {
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
  handleAddNewItem: () => void;
}

export function ItemManagementHeader({
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
  handleAddNewItem,
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
