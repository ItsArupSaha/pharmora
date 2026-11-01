'use client';

import * as React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface SaleSummaryCardProps {
  subtotal: number;
  /**
   * Grand total stored on the record being edited. While the form total still
   * equals it, the card leaves the field alone — manual overrides and
   * discounts the form cannot recompute must survive a plain re-open.
   */
  authoredTotal?: number;
  /** Changes whenever a different record is opened; re-arms auto-total. */
  resetKey?: string;
}

/**
 * POS totals strip. Only extra/service sales is an input; the final total is
 * display-only — the server computes it from item-record prices plus this
 * field, so the browser can never hand-pick a total.
 */
export function SaleSummaryCard({ subtotal, authoredTotal, resetKey }: SaleSummaryCardProps) {
  const { control, setValue, watch } = useFormContext();
  const [isTotalEdited, setIsTotalEdited] = React.useState(false);
  const totalValue = watch('total');
  const extraSalesValue = watch('extraSales') || 0;
  // Tracks what this card last saw as the computed total, so a freshly opened
  // record's stored total is honored exactly once.
  const seenComputedRef = React.useRef<number | null>(null);

  // Re-arm auto-total whenever a different record is opened for editing.
  React.useEffect(() => {
    seenComputedRef.current = null;
    setIsTotalEdited(false);
  }, [resetKey]);

  // Auto-update final total in form when subtotal or extraSales changes, unless manually overridden
  React.useEffect(() => {
    if (isTotalEdited) return;
    const computed = subtotal + Number(extraSalesValue);
    const authored = authoredTotal !== undefined ? Number(authoredTotal) : null;
    if (
      authored !== null &&
      seenComputedRef.current === null &&
      Math.abs(Number(totalValue) - authored) < 0.005
    ) {
      // Freshly opened record: its stored total is authoritative.
      seenComputedRef.current = computed;
      return;
    }
    seenComputedRef.current = computed;
    if (Number(totalValue) === computed) return;
    setValue('total', computed);
  }, [subtotal, extraSalesValue, isTotalEdited, authoredTotal, totalValue, setValue]);

  // Reset override state when subtotal, extraSales, and total value all become zero (e.g. on form reset)
  React.useEffect(() => {
    if (subtotal === 0 && Number(extraSalesValue) === 0 && (Number(totalValue) === 0 || !totalValue)) {
      setIsTotalEdited(false);
    }
  }, [subtotal, extraSalesValue, totalValue]);

  return (
    <div className="flex flex-col sm:flex-row justify-end">
      <div className="w-full sm:w-80 bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Computed Subtotal:</span>
          <span className="font-semibold font-mono">৳{subtotal.toFixed(2)}</span>
        </div>

        {/* Extra / Service Sales Field */}
        <div className="flex justify-between items-center text-sm border-t pt-2">
          <span className="text-muted-foreground">Extra / Service Sales:</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">৳</span>
            <FormField
              control={control}
              name="extraSales"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="w-24 text-right h-8 font-mono bg-background border rounded-md px-2"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t font-bold text-base">
          <span>Final Total:</span>
          <div className="flex items-center gap-1">
            <span>৳</span>
            <FormField
              control={control}
              name="total"
              render={({ field: totalField }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-28 text-right h-8 font-bold font-mono tabular-nums bg-background border rounded-md px-2"
                      {...totalField}
                      value={totalField.value ?? ''}
                      onChange={(e) => {
                        setIsTotalEdited(true);
                        totalField.onChange(e.target.value === '' ? '' : Number(e.target.value));
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
