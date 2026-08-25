'use client';

import * as React from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PurchaseSearchInputProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  isSearching: boolean;
  isSearchActive: boolean;
  resultCount: number;
  onClear: () => void;
}

export function PurchaseSearchInput({
  searchTerm,
  onSearchTermChange,
  isSearching,
  isSearchActive,
  resultCount,
  onClear,
}: PurchaseSearchInputProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by medicine name or memo no (e.g. Napa, PUR-0001)..."
          className="pl-8 pr-10"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isSearching && searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isSearchActive && !isSearching && (
        <div className="flex items-center justify-between rounded-md bg-muted p-3">
          <span className="text-sm text-muted-foreground">
            Found {resultCount} purchase{resultCount !== 1 ? 's' : ''} matching
            &quot;{searchTerm.trim()}&quot;
          </span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear Search
          </Button>
        </div>
      )}
    </div>
  );
}
