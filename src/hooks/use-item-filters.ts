'use client';

import * as React from 'react';
import { compareItemsForSearch, isFuzzyMatch } from '@/lib/search-utils';
import type { Item } from '@/lib/types';

interface UseItemFiltersProps {
  allItems: Item[];
}

export function useItemFilters({ allItems }: UseItemFiltersProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = React.useState('all');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = React.useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = React.useState('all');
  const [sortBy, setSortBy] = React.useState('title-asc');
  const [visibleCount, setVisibleCount] = React.useState(10);

  // Client-side filtering & sorting
  const filteredAndSortedItems = React.useMemo(() => {
    let result = [...allItems];

    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      const qLower = q.toLowerCase();
      
      result = result.filter(
        (item) =>
          (item.title || '').toLowerCase().includes(qLower) ||
          (item.categoryName || '').toLowerCase().includes(qLower) ||
          (item.medicineGroup && item.medicineGroup.toLowerCase().includes(qLower)) ||
          (item.company && item.company.toLowerCase().includes(qLower)) ||
          (item.location && item.location.toLowerCase().includes(qLower)) ||
          isFuzzyMatch(item.title, q) ||
          isFuzzyMatch(item.categoryName, q) ||
          (item.medicineGroup && isFuzzyMatch(item.medicineGroup, q)) ||
          (item.company && isFuzzyMatch(item.company, q))
      );
    }

    if (selectedCategoryFilter !== 'all') {
      result = result.filter((item) => item.categoryId === selectedCategoryFilter);
    }

    if (selectedCompanyFilter !== 'all') {
      result = result.filter(
        (item) => (item.company || '').trim().toLowerCase() === selectedCompanyFilter.toLowerCase()
      );
    }

    const now = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setDate(now.getDate() + 30);

    if (selectedStatusFilter === 'lowStock') {
      result = result.filter((item) => item.stock <= 5);
    } else if (selectedStatusFilter === 'expiringSoon') {
      result = result.filter((item) => {
        if (!item.expiryDate) return false;
        const exp = new Date(item.expiryDate);
        return exp > now && exp <= oneMonthFromNow;
      });
    } else if (selectedStatusFilter === 'expired') {
      result = result.filter((item) => {
        if (!item.expiryDate) return false;
        const exp = new Date(item.expiryDate);
        return exp <= now;
      });
    }

    result.sort((a, b) => {
      if (searchQuery.trim()) {
        return compareItemsForSearch(a, b, searchQuery.trim(), sortBy);
      }
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'title-desc') {
        return b.title.localeCompare(a.title);
      }
      if (sortBy === 'stock-asc') {
        return a.stock - b.stock;
      }
      if (sortBy === 'stock-desc') {
        return b.stock - a.stock;
      }
      if (sortBy === 'group-asc') {
        const groupA = a.medicineGroup || '';
        const groupB = b.medicineGroup || '';
        return groupA.localeCompare(groupB);
      }
      if (sortBy === 'company-asc') {
        const companyA = a.company || '';
        const companyB = b.company || '';
        return companyA.localeCompare(companyB);
      }
      if (sortBy === 'expiry-asc') {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        return dateA - dateB;
      }
      return 0;
    });

    return result;
  }, [allItems, searchQuery, selectedCategoryFilter, selectedCompanyFilter, selectedStatusFilter, sortBy]);

  const displayedItems = React.useMemo(() => {
    return filteredAndSortedItems.slice(0, visibleCount);
  }, [filteredAndSortedItems, visibleCount]);

  const hasMore = visibleCount < filteredAndSortedItems.length;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    sortBy,
    setSortBy,
    visibleCount,
    setVisibleCount,
    filteredAndSortedItems,
    displayedItems,
    hasMore,
    handleLoadMore,
  };
}
