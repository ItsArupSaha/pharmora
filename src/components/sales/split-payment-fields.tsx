'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

/**
 * Split payment: the part handed over in cash right now. The remainder
 * (total − paid) goes onto the shop's dues, so it is previewed live.
 */
export function SplitPaymentFields() {
  const { control, watch } = useFormContext();
  const total = Number(watch('total')) || 0;
  const amountPaid = Number(watch('amountPaid')) || 0;
  const dueAmount = Math.max(total - amountPaid, 0);

  return (
    <div className="space-y-2 rounded-md border p-3 bg-muted/30">
      <FormField
        control={control}
        name="amountPaid"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount Paid Now (Cash)</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Goes to dues</span>
        <span className="font-semibold text-destructive">
          ৳{dueAmount.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
