'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useStoreType } from '@/hooks/use-store-type';
import type { Item } from '@/lib/types';

interface SaleItemRowProps {
  index: number;
  items: Item[];
  watchItems: any[];
  onRemove: () => void;
  disabledRemove: boolean;
}

export function SaleItemRow({
  index,
  items,
  watchItems,
  onRemove,
  disabledRemove,
}: SaleItemRowProps) {
  const { control, setValue } = useFormContext();
  const { isPharmacy } = useStoreType();
  const watchItemId = watchItems[index]?.itemId;
  const selectedItem = items.find(i => i.id === watchItemId);

  return (
    <div className="flex gap-2 items-end p-3 border rounded-md relative">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`items.${index}.itemId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Item</FormLabel>
              <Select onValueChange={(value) => {
                const item = items.find(i => i.id === value);
                field.onChange(value);
                setValue(`items.${index}.price`, item?.sellingPrice || 0);
              }} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {items.map(item => {
                    const now = new Date();
                    const oneMonthFromNow = new Date();
                    oneMonthFromNow.setDate(now.getDate() + 30);
                    const isExpired = item.expiryDate && new Date(item.expiryDate) <= now;
                    const isExpiringSoon = item.expiryDate && !isExpired && new Date(item.expiryDate) <= oneMonthFromNow;

                    const details = [
                      item.company,
                      isPharmacy ? item.medicineGroup : null,
                      `Stock: ${item.stock}`,
                      isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : null
                    ].filter(Boolean).join(' - ');

                    const label = details ? `${item.title} (${details})` : item.title;

                    return (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={watchItems.some((i, itemIndex) => i.itemId === item.id && itemIndex !== index)}
                      >
                        <span className={cn(isExpired ? 'text-destructive font-semibold' : isExpiringSoon ? 'text-amber-600 font-semibold' : '')}>
                          {label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Quantity</FormLabel>
              <FormControl>
                <Input type="number" min="1" max={selectedItem?.stock} placeholder="1" {...field} />
              </FormControl>
              {selectedItem && (
                <div className="flex flex-col gap-0.5 mt-1">
                  <span className="text-xs text-muted-foreground">
                    In stock: {selectedItem.stock}
                  </span>
                  {selectedItem.expiryDate && (() => {
                    const now = new Date();
                    const oneMonthFromNow = new Date();
                    oneMonthFromNow.setDate(now.getDate() + 30);
                    const isExpired = new Date(selectedItem.expiryDate) <= now;
                    const isExpiringSoon = !isExpired && new Date(selectedItem.expiryDate) <= oneMonthFromNow;
                    
                    if (isExpired) {
                      return (
                        <span className="text-xs font-bold text-destructive flex items-center gap-1 animate-pulse">
                          ⚠️ Expired on {format(new Date(selectedItem.expiryDate), 'yyyy-MM-dd')}!
                        </span>
                      );
                    }
                    if (isExpiringSoon) {
                      return (
                        <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          ⚠️ Expiring on {format(new Date(selectedItem.expiryDate), 'yyyy-MM-dd')}!
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs text-muted-foreground">
                        Exp: {format(new Date(selectedItem.expiryDate), 'yyyy-MM-dd')}
                      </span>
                    );
                  })()}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10"
        onClick={onRemove}
        disabled={disabledRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
