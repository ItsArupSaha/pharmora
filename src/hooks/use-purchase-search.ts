'use client';

import * as React from 'react';
import { searchPurchases } from '@/lib/actions';
import type { Purchase } from '@/lib/types';

const SEARCH_DEBOUNCE_MS = 300;

// Debounced purchase search over the cached master list. The first search
// loads the collection through the version-guarded cache; every keystroke
// after that filters in memory — no extra Firestore reads.
export function usePurchaseSearch(userId: string) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Purchase[]>([]);

  const trimmed = searchTerm.trim();
  const isSearchActive = trimmed !== '';

  React.useEffect(() => {
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchPurchases(userId, trimmed);
        if (!cancelled) setSearchResults(results);
      } catch (error) {
        console.error('Failed to search purchases:', error);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, userId]);

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };

  return {
    searchTerm,
    setSearchTerm,
    isSearching,
    searchResults,
    isSearchActive,
    handleClearSearch,
  };
}
