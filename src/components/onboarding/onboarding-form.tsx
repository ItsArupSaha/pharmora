'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { OnboardingFormValues } from '@/app/onboarding/schema';

interface OnboardingFormProps {
  form: UseFormReturn<OnboardingFormValues>;
  isSubmitting: boolean;
  onSubmit: (values: OnboardingFormValues) => void;
}

export function OnboardingForm({ form, isSubmitting, onSubmit }: OnboardingFormProps) {
  const isGeneral = form.watch('storeType') === 'general';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{isGeneral ? 'Business Name' : 'Pharmacy Name'}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={isGeneral ? 'e.g., My Store' : 'e.g., MediCare Pharmacy'}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-title / Tagline (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    isGeneral ? 'e.g., Your neighborhood store' : 'e.g., Your neighborhood pharmacy'
                  }
                  {...field}
                />
              </FormControl>
              <FormDescription>A short, descriptive tagline for your store.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="Your primary contact number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bkashNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>bKash Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Your bKash account number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Store Address</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., 123 Main Street, Cityville, USA" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bankInfo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bank Details (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Bank Name, Account Number" {...field} />
              </FormControl>
              <FormDescription>This can be useful for your records and reports.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="initialCash"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Capital (Cash)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormDescription>Starting cash on hand.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="initialBank"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Capital (Bank)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormDescription>Starting balance in your bank account.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Setup
          </Button>
        </div>
      </form>
    </Form>
  );
}
