'use client';

import * as React from 'react';
import type { DateRange } from 'react-day-picker';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { deleteSale, getCustomers, getItems, getSalesPaginated, searchSales } from '@/lib/actions';
import type { Customer, Item, Sale } from '@/lib/types';
import { useSalesExport } from './use-sales-export';

interface UseSalesManagementProps {
  userId: string;
}

export function useSalesManagement({ userId }: UseSalesManagementProps) {
  const { authUser } = useAuth();
  const [sales, setSales] = React.useState<Sale[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Sale[]>([]);

  const handleSaleCreated = React.useCallback((newSale?: Sale) => {
    if (!newSale) return;
    setSales(prev => [newSale, ...prev.filter(s => s.id !== newSale.id)]);
    if (newSale.items && newSale.items.length > 0) {
      const soldMap = new Map(newSale.items.map(item => [item.itemId, Number(item.quantity) || 0]));
      setItems(prev => prev.map(item => {
        const soldQty = soldMap.get(item.id);
        if (soldQty) {
          return { ...item, stock: Math.max(0, (Number(item.stock) || 0) - soldQty) };
        }
        return item;
      }));
    }
    // A due/split sale may have created a new shop server-side — refresh the
    // customer directory so the sales history edit dialog prefills it.
    getCustomers(userId).then(setCustomers).catch(() => {});
  }, [userId]);

  const loadInitialData = React.useCallback(async () => {
    setIsInitialLoading(true);
    try {
      const [{ sales: newSales, hasMore: newHasMore }, itemsData, customersData] = await Promise.all([
        getSalesPaginated({ userId, pageLimit: 5 }),
        getItems(userId),
        getCustomers(userId),
      ]);
      setSales(newSales);
      setHasMore(newHasMore);
      setItems(itemsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Failed to load initial sales data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load data. Please try again later.',
      });
    } finally {
      setIsInitialLoading(false);
    }
  }, [userId, toast]);

  React.useEffect(() => {
    if (userId) {
      loadInitialData();
    }
  }, [userId, loadInitialData]);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const lastSaleId = sales[sales.length - 1]?.id;
    try {
      const { sales: newSales, hasMore: newHasMore } = await getSalesPaginated({ userId, pageLimit: 5, lastVisibleId: lastSaleId });
      setSales(prev => [...prev, ...newSales]);
      setHasMore(newHasMore);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not load more sales.',
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchSales(userId, searchTerm.trim());
      setSearchResults(results);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Search Error', description: 'Failed to search sales.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  const displaySales = searchTerm.trim() !== '' ? searchResults : sales;

  const handleDelete = (saleId: string) => {
    startTransition(async () => {
      const result = await deleteSale(userId, saleId);
      if (result.success) {
        toast({ title: 'Sale Deleted', description: 'The sale has been removed and stock restored.' });
        loadInitialData();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to delete sale.' });
      }
    });
  };

  // Call the sales export sub-hook
  const salesExport = useSalesExport({
    userId,
    dateRange,
    authUser,
    items,
    customers,
  });

  return {
    authUser,
    sales,
    items,
    customers,
    isDialogOpen,
    setIsDialogOpen,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    dateRange,
    setDateRange,
    isPending,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    searchTerm,
    setSearchTerm,
    isSearching,
    displaySales,
    loadInitialData,
    handleSaleCreated,
    handleLoadMore,
    handleSearch,
    handleClearSearch,
    handleDelete,
    handleDownloadPdf: salesExport.handleDownloadPdf,
    handleDownloadXlsx: salesExport.handleDownloadXlsx,
    handleDownloadItemsPdf: salesExport.handleDownloadItemsPdf,
    handleDownloadItemsXlsx: salesExport.handleDownloadItemsXlsx,
  };
}
