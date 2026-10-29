'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStoreType } from '@/hooks/use-store-type';

interface CompanyBaseFieldsProps {
  form: UseFormReturn<any>;
}

export function CompanyBaseFields({ form }: CompanyBaseFieldsProps) {
  const { isPharmacy } = useStoreType();
  return (
    <>
      <FormField
        control={form.control}
        name="companyName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{isPharmacy ? 'Pharmacy Name' : 'Business Name'}</FormLabel>
            <FormControl>
              <Input
                placeholder={isPharmacy ? 'e.g., MediCare Pharmacy' : 'e.g., My Store'}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="subtitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Sub-title / Tagline (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder={
                  isPharmacy ? 'e.g., Your neighborhood pharmacy' : 'e.g., Your neighborhood store'
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
              <Textarea placeholder="e.g., 123 Main Road, Dhaka" {...field} />
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
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
