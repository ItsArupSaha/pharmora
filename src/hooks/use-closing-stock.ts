'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { calculateClosingStock } from '@/lib/actions';
import { exportClosingStockPdf, exportClosingStockXlsx } from '@/components/items/items-export-utils';

interface UseClosingStockProps {
  userId: string;
  authUser: any;
}

export function useClosingStock({ userId, authUser }: UseClosingStockProps) {
  const { toast } = useToast();
  const [isStockDialogOpen, setIsStockDialogOpen] = React.useState(false);
  const [closingStockDate, setClosingStockDate] = React.useState<Date | undefined>(new Date());
  const [selectedCompanyFilter, setSelectedCompanyFilter] = React.useState<string>('all');
  const [isCalculating, setIsCalculating] = React.useState(false);

  const fetchFilteredClosingStock = async (targetCompany?: string) => {
    if (!closingStockDate) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
      return null;
    }

    const calculatedData = await calculateClosingStock(userId, closingStockDate);
    const company = targetCompany !== undefined ? targetCompany : selectedCompanyFilter;
    const filteredData = (!company || company === 'all')
      ? calculatedData
      : calculatedData.filter(
          (item) => (item.company || '').trim().toLowerCase() === company.toLowerCase()
        );

    return {
      data: filteredData,
      companyName: company !== 'all' ? company : undefined,
    };
  };

  const handleDownloadClosingStockPdf = async (company?: string) => {
    if (!closingStockDate) return;
    setIsCalculating(true);
    try {
      const result = await fetchFilteredClosingStock(company);
      if (!result) return;
      if (result.data.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No items found for this company.' });
        return;
      }
      exportClosingStockPdf(result.data, closingStockDate, authUser, result.companyName);
      toast({ title: 'Downloaded', description: 'Stock PDF downloaded successfully.' });
      setIsStockDialogOpen(false);
    } catch (error) {
      console.error('Failed to download stock PDF:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not download stock report.' });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleDownloadClosingStockXlsx = async (company?: string) => {
    if (!closingStockDate) return;
    setIsCalculating(true);
    try {
      const result = await fetchFilteredClosingStock(company);
      if (!result) return;
      if (result.data.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No items found for this company.' });
        return;
      }
      exportClosingStockXlsx(result.data, closingStockDate, result.companyName);
      toast({ title: 'Downloaded', description: 'Stock Excel downloaded successfully.' });
      setIsStockDialogOpen(false);
    } catch (error) {
      console.error('Failed to download stock Excel:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not download stock report.' });
    } finally {
      setIsCalculating(false);
    }
  };

  return {
    isStockDialogOpen,
    setIsStockDialogOpen,
    closingStockDate,
    setClosingStockDate,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
    isCalculating,
    handleDownloadClosingStockPdf,
    handleDownloadClosingStockXlsx,
  };
}
