'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface PurchaseItemMedicineFieldsProps {
  index: number;
  // Generic-group input is pharmacy-only; hidden (not removed) for general
  // businesses so the value round-trips in form state untouched.
  showGroup?: boolean;
}

export function PurchaseItemMedicineFields({ index, showGroup = true }: PurchaseItemMedicineFieldsProps) {
  const { control } = useFormContext();

  return (
    <>
      {showGroup && (
        <FormField
          control={control}
          name={`items.${index}.medicineGroup`}
          render={({ field }) => (
            <FormItem className="md:col-span-3">
              <FormLabel className="text-xs">Group (Generic)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Paracetamol" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name={`items.${index}.expiryDate`}
        render={({ field }) => (
          <FormItem className="md:col-span-3">
            <FormLabel className="text-xs">Expiry Date</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
