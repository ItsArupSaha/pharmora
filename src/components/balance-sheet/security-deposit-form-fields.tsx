'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useStoreType } from '@/hooks/use-store-type';
import { SecurityDepositRefundFields } from './security-deposit-refund-fields';

interface SecurityDepositFormFieldsProps {
  form: UseFormReturn<any>;
  editingSecurity: boolean;
}

export function SecurityDepositFormFields({
  form,
  editingSecurity,
}: SecurityDepositFormFieldsProps) {
  const watchStatus = form.watch('status');
  const { isPharmacy } = useStoreType();

  return (
    <div className="space-y-4 py-2">
      <FormField
        control={form.control}
        name="amount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Amount (BDT)</FormLabel>
            <FormControl>
              <Input type="number" step="any" placeholder="Enter amount" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="paymentMethod"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Source Account (Paid From)</FormLabel>
            <FormControl>
              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="Cash" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Cash Balance</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="Bank" />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Bank Balance</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Payment Date</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full pl-3 text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes / Details</FormLabel>
            <FormControl>
              <Textarea
                placeholder={
                  isPharmacy
                    ? 'e.g., Security deposit for pharmacy room rent, etc.'
                    : 'e.g., Security deposit for room rent, etc.'
                }
                className="resize-none"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Refund fields (only in edit mode) */}
      {editingSecurity && (
        <div className="border-t pt-4 space-y-4">
          <h4 className="font-semibold text-sm text-primary">Refund Status</h4>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Refundable">Active / Refundable</SelectItem>
                    <SelectItem value="Refunded">Refunded (Settled)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchStatus === 'Refunded' && <SecurityDepositRefundFields form={form} />}
        </div>
      )}
    </div>
  );
}
