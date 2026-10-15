'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { SearchableItemSelect } from './searchable-item-select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Item } from '@/lib/types';

interface SaleItemsTableRowProps {
  index: number;
  field: any;
  items: Item[];
  watchItems: any[];
  remove: (index: number) => void;
  fieldsLength: number;
  appendRow: () => void;
}

export function SaleItemsTableRow({
  index,
  field,
  items,
  watchItems,
  remove,
  fieldsLength,
  appendRow,
}: SaleItemsTableRowProps) {
  const { control, setValue } = useFormContext();

  const watchItemId = watchItems[index]?.itemId;
  const selectedItem = items.find((i) => i.id === watchItemId);
  const qty = Number(watchItems[index]?.quantity) || 0;
  const price = watchItems[index]?.price !== undefined && watchItems[index]?.price !== ''
    ? Number(watchItems[index]?.price)
    : (Number(selectedItem?.sellingPrice) || 0);
  const rowTotal = qty * price;

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
      {/* Row Number */}
      <td className="border border-slate-200 dark:border-slate-800 p-2 text-center text-slate-500 font-bold bg-slate-50 dark:bg-slate-900/40 select-none">
        {index + 1}
      </td>

      {/* Medicine Selector Cell — name with stock beside it, price/company/shelf underneath */}
      <td className="border border-slate-200 dark:border-slate-800 p-0 bg-transparent min-w-[120px] align-top">
        <FormField
          control={control}
          name={`items.${index}.itemId`}
          render={({ field: selectField }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <div className="flex flex-col w-full min-w-0 h-full justify-between">
                  <div className="p-1">
                    <SearchableItemSelect
                      items={items}
                      value={selectField.value || ''}
                      className="w-full min-h-8 h-auto rounded-none border-0 shadow-none bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-900/20 focus:bg-background focus:ring-0 focus-visible:ring-0 px-3 py-0.5 font-medium text-xs"
                      data-row={index}
                      data-col={0}
                      onChange={(value) => {
                        if (value === selectField.value) return;
                        const item = items.find((i) => i.id === value);
                        selectField.onChange(value);
                        setValue(`items.${index}.price`, item ? item.sellingPrice : '', {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        setValue(`items.${index}.quantity`, 1, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });

                        // Auto-append another row if we selected an item in the last row
                        if (index === fieldsLength - 1) {
                          appendRow();
                        }
                      }}
                      disabledItemIds={watchItems
                        .map((i: any) => i.itemId)
                        .filter((id: string) => id && id !== selectField.value)}
                    />
                  </div>
                  {selectedItem && (
                    <div className="flex items-center gap-1.5 text-[9px] px-2 py-1 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 select-none whitespace-nowrap overflow-hidden">
                      <span className="shrink-0 font-semibold font-mono text-slate-700 dark:text-slate-300">
                        ৳{price.toFixed(2)}
                      </span>
                      <span className="shrink-0 text-slate-300 dark:text-slate-700 select-none">|</span>
                      <span
                        className="min-w-0 truncate font-semibold text-slate-700 dark:text-slate-300"
                        title={selectedItem.company || '—'}
                      >
                        {selectedItem.company || '—'}
                      </span>
                    </div>
                  )}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </td>

      {/* Quantity input */}
      <td className="border border-slate-200 dark:border-slate-800 p-0">
        <FormField
          control={control}
          name={`items.${index}.quantity`}
          render={({ field: qtyField }) => (
            <FormItem className="space-y-0">
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  max={selectedItem?.stock}
                  placeholder="0"
                  className="w-full h-8 rounded-none border-0 shadow-none bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-900/20 focus:bg-background focus:ring-0 focus-visible:ring-0 text-center font-mono py-0.5"
                  data-row={index}
                  data-col={1}
                  {...qtyField}
                  value={qtyField.value ?? ''}
                  disabled={!watchItemId}
                  onChange={(e) => qtyField.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </td>

      {/* Total Formula Cell */}
      <td className="border border-slate-200 dark:border-slate-800 p-2 text-right font-bold font-mono tabular-nums bg-slate-50/50 dark:bg-slate-900/10 text-slate-700 dark:text-slate-300 select-none">
        ৳{rowTotal.toFixed(2)}
      </td>

      {/* Delete Button Cell */}
      <td className="border border-slate-200 dark:border-slate-800 p-0 text-center bg-slate-50/40 dark:bg-slate-900/5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-full text-destructive hover:bg-destructive/10 rounded-none border-0 transition-colors"
          onClick={() => remove(index)}
          disabled={fieldsLength === 1}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
