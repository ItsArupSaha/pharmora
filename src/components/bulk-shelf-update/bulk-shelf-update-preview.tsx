'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FolderSync, ArrowRight } from 'lucide-react';
import { useStoreType } from '@/hooks/use-store-type';
import type { Item } from '@/lib/types';

interface BulkShelfUpdatePreviewProps {
  selectedCompany: string;
  filteredItems: Item[];
  newLocation: string;
}

export function BulkShelfUpdatePreview({
  selectedCompany,
  filteredItems,
  newLocation,
}: BulkShelfUpdatePreviewProps) {
  const { isPharmacy } = useStoreType();
  const itemNoun = isPharmacy ? 'Medicines' : 'Items';

  return (
    <Card className="md:col-span-2 border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{itemNoun} Preview</span>
          {selectedCompany && (
            <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-muted rounded-full">
              {filteredItems.length} items found
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {selectedCompany
            ? `Showing all stock items manufactured by ${selectedCompany}.`
            : `Select a manufacturer company on the left to preview ${itemNoun.toLowerCase()}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!selectedCompany ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <FolderSync className="h-10 w-10 text-muted-foreground mb-3 animate-pulse" />
            <h4 className="font-semibold text-muted-foreground">No Company Selected</h4>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Choose a company on the left form layout to see affected {itemNoun.toLowerCase()} and their current shelf locations.
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg bg-muted/20">
            <h4 className="font-semibold text-muted-foreground">No {itemNoun} Associated</h4>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              No stock items in your inventory currently match this company name.
            </p>
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-muted/50 border-b text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">{isPharmacy ? 'Medicine / Item' : 'Item'}</th>
                  <th className="p-3 text-center">Current Shelf</th>
                  <th className="p-3 text-center">New Shelf</th>
                  <th className="p-3 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-medium">
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {isPharmacy && item.medicineGroup && (
                          <span className="text-xs text-muted-foreground">{item.medicineGroup}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono text-muted-foreground text-xs">
                      {item.location || '—'}
                    </td>
                    <td className="p-3 text-center">
                      {newLocation.trim() ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium">
                          <span className="text-muted-foreground line-through font-mono">
                            {item.location || '—'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-primary" />
                          <span className="bg-primary/10 px-2 py-0.5 rounded font-mono">
                            {newLocation.trim()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono text-muted-foreground">
                      {item.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
