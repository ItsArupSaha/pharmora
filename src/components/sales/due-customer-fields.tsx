'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Store } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Customer } from '@/lib/types';
import { isFuzzyMatch } from '@/lib/search-utils';
import type { SaleFormValues } from './schema';

interface DueCustomerFieldsProps {
  customers: Customer[];
}

const digits = (value: string) => value.replace(/\D/g, '');

/**
 * Shop capture for due and split sales. The shop name is the identity —
 * suggestions match by shop name (fuzzy) and phone digits so an existing
 * shop is reused instead of being created a second time. The server
 * re-resolves and has the final word; suggestions only guide the input.
 */
export function DueCustomerFields({ customers }: DueCustomerFieldsProps) {
  const { control, watch, setValue } = useFormContext<SaleFormValues>();
  const shopName = watch('dueShopName') || '';
  const phone = watch('dueCustomerPhone') || '';

  const suggestions = React.useMemo(() => {
    const nameQuery = shopName.trim();
    if (phone.trim()) {
      const byPhone = customers.filter(
        (c) => digits(c.phone).includes(digits(phone)) && digits(phone).length >= 3
      );
      if (byPhone.length > 0) return byPhone.slice(0, 5);
    }
    if (!nameQuery) return [];
    const byShop = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(nameQuery.toLowerCase()) ||
        isFuzzyMatch(c.name, nameQuery)
    );
    return byShop.slice(0, 5);
  }, [customers, shopName, phone]);

  const applySuggestion = (customer: Customer) => {
    setValue('dueShopName', customer.name, { shouldValidate: true });
    setValue('dueCustomerPhone', customer.phone, { shouldValidate: true });
    if (customer.contactName) {
      setValue('dueContactName', customer.contactName, { shouldValidate: true });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-primary">
        <Store className="h-4 w-4" /> Due shop — name &amp; phone required
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="dueShopName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shop Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Rahim Medical Store" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="dueCustomerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 01712345678" inputMode="tel" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="dueContactName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contact Person (Optional)</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Rahim Uddin" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Existing shops — tap to reuse (avoids duplicates):</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => applySuggestion(c)}
                className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {c.name} · {c.phone}
                {(Number(c.dueBalance) || 0) > 0 ? ` · due ৳${Number(c.dueBalance).toFixed(0)}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
