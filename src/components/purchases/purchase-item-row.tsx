'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { Category } from '@/lib/types';
import { PurchaseItemNameInput } from './purchase-item-name-input';
import { PurchaseItemMedicineFields } from './purchase-item-medicine-fields';

type RowVariant = 'purchase' | 'stock';

interface PurchaseItemRowProps {
  index: number;
  categories: Category[];
  existingItems?: any[];
  onAddCategoryClick?: () => void;
  onRemove: () => void;
  disabledRemove: boolean;
  // "stock" (stock-taking dialog) hides category and pricing. Those values
  // remain in the form state so editing an item preserves what is stored.
  variant?: RowVariant;
}

export function PurchaseItemRow({
  index,
  categories,
  existingItems,
  onAddCategoryClick,
  onRemove,
  disabledRemove,
  variant = 'purchase',
}: PurchaseItemRowProps) {
  const { control, watch, setValue } = useFormContext();
  const watchCategoryId = watch(`items.${index}.categoryId`);
  const selectedCategory = categories.find((c) => c.id === watchCategoryId);
  const isMedicine = selectedCategory?.name?.toLowerCase().includes('medicine');

  const categoryName = (selectedCategory?.name || '').toLowerCase();
  const isAssetOrSurgical = categoryName === 'assets' || categoryName === 'surgicals';

  const showCategory = variant === 'purchase';
  const showPricing = variant === 'purchase';
  const showMedicineFields = variant === 'stock' || !!isMedicine;

  React.useEffect(() => {
    if (showPricing && isAssetOrSurgical) {
      setValue(`items.${index}.sellingPrice`, 0);
    }
  }, [showPricing, isAssetOrSurgical, index, setValue]);

  return (
    <div className="flex gap-2 items-start p-3 border rounded-md relative">
      <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-6">
        <PurchaseItemNameInput
          index={index}
          existingItems={existingItems}
          isMedicine={!!isMedicine}
        />

        {showCategory && (
          <div className="flex items-end gap-2 md:col-span-3">
            <FormField
              control={control}
              name={`items.${index}.categoryId`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">Category</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const category = categories.find((c) => c.id === value);
                      field.onChange(value);
                      setValue(`items.${index}.categoryName`, category?.name || '');
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="outline" size="icon" onClick={onAddCategoryClick}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}

        {showMedicineFields && <PurchaseItemMedicineFields index={index} />}

        <FormField
          control={control}
          name={`items.${index}.quantity`}
          render={({ field }) => (
            <FormItem className={variant === 'stock' ? 'md:col-span-3' : 'md:col-span-2'}>
              <FormLabel className="text-xs">Qty</FormLabel>
              <FormControl>
                <Input type="number" min="1" placeholder="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showPricing && (
          <FormField
            control={control}
            name={`items.${index}.cost`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-xs">Unit Cost</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {showPricing && (
          <FormField
            control={control}
            name={`items.${index}.sellingPrice`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-xs">Selling Price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="0.00" disabled={isAssetOrSurgical} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-destructive hover:bg-destructive/10 mt-6"
        onClick={onRemove}
        disabled={disabledRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
