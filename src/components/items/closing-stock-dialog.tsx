import * as React from 'react';
import { format } from 'date-fns';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ClosingStockDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  closingStockDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  companies?: string[];
  selectedCompany?: string;
  onCompanyChange?: (company: string) => void;
  onDownloadPdf: (company?: string) => void;
  onDownloadXlsx: (company?: string) => void;
  isCalculating: boolean;
}

export function ClosingStockDialog({
  isOpen,
  onOpenChange,
  closingStockDate,
  onDateChange,
  companies = [],
  selectedCompany = 'all',
  onCompanyChange,
  onDownloadPdf,
  onDownloadXlsx,
  isCalculating,
}: ClosingStockDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" /> Download Stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Stock Report</DialogTitle>
          <DialogDescription>
            Select a date and company to directly download the stock report.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {companies.length > 0 && onCompanyChange && (
            <div className="space-y-1.5 px-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Company / Manufacturer
              </Label>
              <Select value={selectedCompany} onValueChange={onCompanyChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col items-center gap-3 pt-1">
            <Calendar
              mode="single"
              selected={closingStockDate}
              onSelect={onDateChange}
              initialFocus
              numberOfMonths={1}
              disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
            />
            <p className="text-sm text-muted-foreground">
              {closingStockDate ? (
                <>Stock as of: {format(closingStockDate, 'PPP')}</>
              ) : (
                <span>Please pick a date.</span>
              )}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-center pt-3 border-t">
          <Button
            variant="outline"
            onClick={() => onDownloadPdf(selectedCompany)}
            disabled={isCalculating || !closingStockDate}
            className="w-full sm:w-auto"
          >
            {isCalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => onDownloadXlsx(selectedCompany)}
            disabled={isCalculating || !closingStockDate}
            className="w-full sm:w-auto"
          >
            {isCalculating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
