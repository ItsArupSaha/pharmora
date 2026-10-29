'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useStoreType } from '@/hooks/use-store-type';
import { cn } from '@/lib/utils';

export function SalePaymentToggle() {
  const { control, watch } = useFormContext();
  const { isGeneral } = useStoreType();
  const currentMethod = watch('paymentMethod');
  // Due/Split are general-business features for now; pharmacy keeps
  // Cash-only. They still render when editing a legacy Due/Split sale so
  // the old record can be saved back unchanged.
  const showDueOptions = isGeneral || currentMethod === 'Due' || currentMethod === 'Split';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sale Date Picker */}
      <FormField
        control={control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Sale Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "pl-3 text-left font-normal w-full",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Payment Method Selector */}
      <FormField
        control={control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Payment Method</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                value={field.value || 'Cash'}
                className="flex gap-4 pt-2"
              >
                {/* Bank stays hidden everywhere. Due (full credit) and Split
                    (part cash now, rest to dues) are general-business only. */}
                <FormItem className="flex items-center space-x-2">
                  <FormControl><RadioGroupItem value="Cash" id="form-cash" /></FormControl>
                  <FormLabel htmlFor="form-cash" className="font-normal cursor-pointer">Cash</FormLabel>
                </FormItem>
                {showDueOptions && (
                  <>
                    <FormItem className="flex items-center space-x-2">
                      <FormControl><RadioGroupItem value="Due" id="form-due" /></FormControl>
                      <FormLabel htmlFor="form-due" className="font-normal cursor-pointer">Due</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-2">
                      <FormControl><RadioGroupItem value="Split" id="form-split" /></FormControl>
                      <FormLabel htmlFor="form-split" className="font-normal cursor-pointer">Split</FormLabel>
                    </FormItem>
                  </>
                )}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
