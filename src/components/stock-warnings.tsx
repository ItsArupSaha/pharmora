'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { getItems, getCategories } from '@/lib/actions';
import type { Item, Category } from '@/lib/types';
import { isFuzzyMatch, getFormFactorRank } from '@/lib/search-utils';
import { StockWarningsKpis } from './stock-warnings/stock-warnings-kpis';
import { StockWarningsTable } from './stock-warnings/stock-warnings-table';

interface StockWarningsProps {
  userId: string;
}

export default function StockWarnings({ userId }: StockWarningsProps) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<Item[]>([]);
  const [, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [stockThreshold, setStockThreshold] = React.useState<number>(1);
  const [selectedCompany, setSelectedCompany] = React.useState<string>('all');

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [allItems, allCategories] = await Promise.all([
        getItems(userId),
        getCategories(userId),
      ]);
      setItems(allItems);
      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to load stock warning data:', error);
      toast({
        variant: 'destructive',
        title: 'Error loading data',
        description: 'Could not retrieve items from inventory. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, toast]);

  React.useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  // Extract unique list of companies from inventory
  const companies = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.company && item.company.trim()) {
        set.add(item.company.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  // Active Warnings Filter based on threshold, sorted by form-factor priority
  const activeWarnings = React.useMemo(() => {
    const list: Item[] = [];

    items.forEach((item) => {
      const catNameLower = (item.categoryName || '').toLowerCase();
      if (catNameLower === 'assets' || catNameLower === 'surgicals') {
        return;
      }

      if (item.stock === 0 || item.stock < stockThreshold) {
        list.push(item);
      }
    });

    list.sort((a, b) => {
      const formA = getFormFactorRank(a.title);
      const formB = getFormFactorRank(b.title);
      if (formA !== formB) {
        return formA - formB;
      }
      if (a.stock !== b.stock) {
        return a.stock - b.stock;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
    return list;
  }, [items, stockThreshold]);

  // Apply company filter & search query filter
  const filteredItems = React.useMemo(() => {
    let list = activeWarnings;

    if (selectedCompany !== 'all') {
      list = list.filter(
        (item) => (item.company || '').trim().toLowerCase() === selectedCompany.toLowerCase()
      );
    }

    if (!searchQuery.trim()) return list;

    const query = searchQuery.trim().toLowerCase();
    return list.filter((item) => {
      const matchText =
        `${item.title} ${item.categoryName} ${item.medicineGroup || ''} ${item.company || ''}`.toLowerCase();
      return (
        matchText.includes(query) ||
        isFuzzyMatch(item.title, query) ||
        isFuzzyMatch(item.categoryName, query)
      );
    });
  }, [activeWarnings, selectedCompany, searchQuery]);

  return (
    <div className="space-y-6">
      <StockWarningsKpis activeWarnings={activeWarnings} />

      <StockWarningsTable
        isLoading={isLoading}
        filteredItems={filteredItems}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        stockThreshold={stockThreshold}
        setStockThreshold={setStockThreshold}
        companies={companies}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
      />
    </div>
  );
}
