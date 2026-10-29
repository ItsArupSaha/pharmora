'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSalesDirectorySearch } from '@/hooks/use-sales-directory-search';
import { useStoreType } from '@/hooks/use-store-type';
import { AlternativeMedicinesDialog } from './alternative-medicines-dialog';
import type { Item } from '@/lib/types';

interface SalesDirectorySearchProps {
  items: Item[];
}

export function SalesDirectorySearch({ items }: SalesDirectorySearchProps) {
  const { isPharmacy } = useStoreType();
  const {
    directoryQuery,
    setDirectoryQuery,
    selectedAlternativeItem,
    setSelectedAlternativeItem,
    alternativeMedicines,
    filteredDirectoryItems,
  } = useSalesDirectorySearch(items);

  return (
    <Card className="xl:col-span-1 w-full min-w-0 overflow-hidden h-fit sticky top-20 shadow-sm border border-muted/60">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="font-headline text-base flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Directory Deep Search
        </CardTitle>
        <CardDescription className="text-[10px]">
          {isPharmacy
            ? 'Search medicines by name, company, generic group, or shelf.'
            : 'Search items by name, company, or shelf.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Type to search directory..."
            className="pl-8 w-full h-9 text-xs"
            value={directoryQuery}
            onChange={(e) => setDirectoryQuery(e.target.value)}
          />
          {directoryQuery && (
            <button
              onClick={() => setDirectoryQuery('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="h-[520px] overflow-y-auto overflow-x-hidden pr-1.5 space-y-2 w-full min-w-0">
          {filteredDirectoryItems.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No matching {isPharmacy ? 'medicines' : 'items'} found.
            </p>
          ) : (
            filteredDirectoryItems.map((item) => (
              <div
                key={item.id}
                className="p-2.5 border rounded-lg bg-card/40 hover:bg-card/85 transition-all duration-200 space-y-1.5 text-xs min-w-0 overflow-hidden"
              >
                <div className="font-bold text-foreground truncate min-w-0" title={item.title}>
                  {item.title}
                </div>

                <div className="text-[10px] text-muted-foreground leading-tight truncate">
                  {item.company}{' '}
                  {isPharmacy && item.medicineGroup ? ` • ${item.medicineGroup}` : ''}
                </div>

                <div className="text-[10px] text-muted-foreground pt-0.5 leading-normal flex flex-wrap gap-x-1.5 gap-y-0.5 min-w-0">
                  <span
                    className={cn(
                      'font-semibold',
                      item.stock <= 5
                        ? 'text-destructive'
                        : item.stock <= 20
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                    )}
                  >
                    Stock: {item.stock}
                  </span>
                  {item.location && <span className="shrink-0">• Shelf: {item.location}</span>}
                  {item.expiryDate && (
                    <span
                      className={cn(
                        'shrink-0',
                        new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                          ? 'text-destructive font-semibold animate-pulse'
                          : ''
                      )}
                    >
                      • Exp: {item.expiryDate}
                    </span>
                  )}
                </div>

                <div className="text-[10px] font-bold text-primary pt-0.5">
                  Price: ৳{Number(item.sellingPrice).toFixed(2)}
                </div>

                {isPharmacy && item.medicineGroup && (
                  <div className="pt-1 flex">
                    <button
                      onClick={() => setSelectedAlternativeItem(item)}
                      className="w-full text-center py-0.5 rounded border border-primary/25 text-primary text-[9px] font-bold hover:bg-primary/10 transition-colors bg-primary/5"
                    >
                      Alternatives
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>

      <AlternativeMedicinesDialog
        isOpen={!!selectedAlternativeItem}
        onOpenChange={(open) => {
          if (!open) setSelectedAlternativeItem(null);
        }}
        selectedAlternativeItem={selectedAlternativeItem}
        alternativeMedicines={alternativeMedicines}
      />
    </Card>
  );
}
