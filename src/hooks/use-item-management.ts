'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { deleteCategory, deleteItem, getCategories, getItems } from '@/lib/actions';
import type { Category, Item } from '@/lib/types';
import { useClosingStock } from './use-closing-stock';
import { useItemFilters } from './use-item-filters';

export function useItemManagement(userId: string) {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const [allItems, setAllItems] = React.useState<Item[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  // Dialog Open States
  const [isItemDialogOpen, setIsItemDialogOpen] = React.useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);

  // Editing States
  const [editingItem, setEditingItem] = React.useState<Item | null>(null);
  const [editingCategory, setEditingCategory] = React.useState<Category | null>(null);

  const [isPending, startTransition] = React.useTransition();

  // Load inventory lists
  const loadData = React.useCallback(async () => {
    try {
      const allItemsData = await getItems(userId);
      setAllItems(allItemsData);

      const categoriesData = await getCategories(userId);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
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
      loadData();
    }
  }, [userId, loadData]);

  // Editing Actions
  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setIsItemDialogOpen(true);
  };

  const handleAddNewItem = () => {
    setEditingItem(null);
    setIsItemDialogOpen(true);
  };

  const handleAddNewCategory = () => {
    setEditingCategory(null);
    setIsCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const handleDeleteItem = (id: string) => {
    startTransition(async () => {
      try {
        await deleteItem(userId, id);
        await loadData();
        toast({ title: 'Item Deleted', description: 'The item has been removed from the inventory.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the item.' });
      }
    });
  };

  const handleDeleteCategory = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCategory(userId, id);
        await loadData();
        toast({ title: 'Category Deleted', description: 'The category has been removed.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the category.' });
      }
    });
  };

  // Expiry alerts calculation
  const expiringAndExpiredMedicines = React.useMemo(() => {
    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(now.getDate() + 30);

    return allItems.filter((item) => {
      if (!item.expiryDate) return false;
      const exp = new Date(item.expiryDate);
      return exp <= oneMonthFromNow;
    });
  }, [allItems]);

  // Extract unique companies
  const companies = React.useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      if (item.company && item.company.trim()) {
        set.add(item.company.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allItems]);

  // Compose sub-hooks for specific tasks
  const closingStock = useClosingStock({ userId, authUser });
  const itemFilters = useItemFilters({ allItems });

  return {
    allItems,
    categories,
    companies,
    isInitialLoading,
    isItemDialogOpen,
    setIsItemDialogOpen,
    isCategoryDialogOpen,
    setIsCategoryDialogOpen,
    editingItem,
    editingCategory,
    isPending,
    loadData,
    handleEditItem,
    handleAddNewItem,
    handleAddNewCategory,
    handleEditCategory,
    handleDeleteItem,
    handleDeleteCategory,
    expiringAndExpiredMedicines,

    // Delegate closing stock state/actions
    isStockDialogOpen: closingStock.isStockDialogOpen,
    setIsStockDialogOpen: closingStock.setIsStockDialogOpen,
    closingStockDate: closingStock.closingStockDate,
    setClosingStockDate: closingStock.setClosingStockDate,
    closingStockCompanyFilter: closingStock.selectedCompanyFilter,
    setClosingStockCompanyFilter: closingStock.setSelectedCompanyFilter,
    isCalculating: closingStock.isCalculating,
    handleDownloadClosingStockPdf: closingStock.handleDownloadClosingStockPdf,
    handleDownloadClosingStockXlsx: closingStock.handleDownloadClosingStockXlsx,

    // Delegate sorting, filtering and pagination state/actions
    searchQuery: itemFilters.searchQuery,
    setSearchQuery: itemFilters.setSearchQuery,
    selectedCategoryFilter: itemFilters.selectedCategoryFilter,
    setSelectedCategoryFilter: itemFilters.setSelectedCategoryFilter,
    selectedCompanyFilter: itemFilters.selectedCompanyFilter,
    setSelectedCompanyFilter: itemFilters.setSelectedCompanyFilter,
    selectedStatusFilter: itemFilters.selectedStatusFilter,
    setSelectedStatusFilter: itemFilters.setSelectedStatusFilter,
    sortBy: itemFilters.sortBy,
    setSortBy: itemFilters.setSortBy,
    visibleCount: itemFilters.visibleCount,
    setVisibleCount: itemFilters.setVisibleCount,
    filteredAndSortedItems: itemFilters.filteredAndSortedItems,
    displayedItems: itemFilters.displayedItems,
    stockSummary: itemFilters.stockSummary,
    hasMore: itemFilters.hasMore,
    handleLoadMore: itemFilters.handleLoadMore,
  };
}
