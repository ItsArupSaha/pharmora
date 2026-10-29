'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClosingStock } from '@/lib/types';
import { useStoreType } from '@/hooks/use-store-type';

interface ClosingStockResultsProps {
  closingStockData: ClosingStock[];
  closingStockDate: Date | undefined;
  companies?: string[];
  selectedCompany?: string;
  onCompanyChange?: (company: string) => void;
  onDownloadPdf: (company?: string) => void;
  onDownloadXlsx: (company?: string) => void;
  onClear: () => void;
}

export function ClosingStockResults({
  closingStockData,
  closingStockDate,
  companies,
  selectedCompany: controlledCompany,
  onCompanyChange,
  onDownloadPdf,
  onDownloadXlsx,
  onClear,
}: ClosingStockResultsProps) {
  const [internalCompany, setInternalCompany] = React.useState('all');
  const activeCompany = controlledCompany !== undefined ? controlledCompany : internalCompany;
  const { isPharmacy } = useStoreType();

  const handleCompanyChange = (val: string) => {
    setInternalCompany(val);
    onCompanyChange?.(val);
  };

  const availableCompanies = React.useMemo(() => {
    if (companies && companies.length > 0) return companies;
    const set = new Set<string>();
    closingStockData.forEach((item) => {
      if (item.company && item.company.trim()) {
        set.add(item.company.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [companies, closingStockData]);

  const displayedItems = React.useMemo(() => {
    if (!activeCompany || activeCompany === 'all') return closingStockData;
    return closingStockData.filter(
      (item) => (item.company || '').trim().toLowerCase() === activeCompany.toLowerCase()
    );
  }, [closingStockData, activeCompany]);

  if (closingStockData.length === 0) return null;

  const detailHeader = 'Group (Generic)';
  // Generic group is a pharmacy-only concept; general businesses skip the column.
  const columnCount = isPharmacy ? 8 : 7;

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold">
          Closing Stock as of {closingStockDate ? format(closingStockDate, 'PPP') : ''}
        </h3>
        {availableCompanies.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Company:
            </span>
            <Select value={activeCompany} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies ({closingStockData.length})</SelectItem>
                {availableCompanies.map((company) => {
                  const count = closingStockData.filter(
                    (i) => (i.company || '').trim().toLowerCase() === company.toLowerCase()
                  ).length;
                  return (
                    <SelectItem key={company} value={company}>
                      {company} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              {isPharmacy && <TableHead>{detailHeader}</TableHead>}
              <TableHead>Company</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead className="text-right">Prod. Price</TableHead>
              <TableHead className="text-right">MRP</TableHead>
              <TableHead className="text-right">Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-center py-6 text-muted-foreground">
                  No stock records found for this company.
                </TableCell>
              </TableRow>
            ) : (
              displayedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell>{item.categoryName}</TableCell>
                  {isPharmacy && <TableCell>{item.medicineGroup || '-'}</TableCell>}
                  <TableCell>{item.company || '-'}</TableCell>
                  <TableCell>
                    {item.expiryDate ? format(new Date(item.expiryDate), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  <TableCell className="text-right">৳{item.productionPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">৳{item.sellingPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.closingStock}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          disabled={displayedItems.length === 0}
          onClick={() => onDownloadPdf(activeCompany)}
        >
          <FileText className="mr-2 h-4 w-4" /> Download PDF{' '}
          {activeCompany !== 'all' ? `(${activeCompany})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={displayedItems.length === 0}
          onClick={() => onDownloadXlsx(activeCompany)}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel{' '}
          {activeCompany !== 'all' ? `(${activeCompany})` : ''}
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
          Clear Results
        </Button>
      </div>
      <hr className="my-6" />
    </div>
  );
}
