'use client';

import * as React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Item } from '@/lib/types';

interface SupplierFormFieldsProps {
  form: UseFormReturn<any>;
  existingItems: Item[];
  // The purchase form stores the company as "supplier"; other dialogs
  // (e.g. add-items) store it as "company".
  companyFieldName?: string;
  // When enabled, resolving a company to one already in the inventory
  // auto-fills the shelf/row with that company's recorded location.
  autoFillLocation?: boolean;
  // Hides the shelf/row input (e.g. stock mode) while keeping the value in
  // the form state so existing locations round-trip unchanged.
  showLocation?: boolean;
}

export function SupplierFormFields({
  form,
  existingItems,
  companyFieldName = 'supplier',
  autoFillLocation = false,
  showLocation = true,
}: SupplierFormFieldsProps) {
  const existingCompanies = React.useMemo(() => {
    if (!existingItems) return [];
    const set = new Set<string>();
    existingItems.forEach((item) => {
      if (item.company && item.company.trim()) {
        set.add(item.company.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingItems]);

  // Most frequent non-empty shelf location recorded for each company.
  const locationByCompany = React.useMemo(() => {
    const counts = new Map<string, Map<string, number>>();
    existingItems.forEach((item) => {
      const companyKey = item.company?.trim().toLowerCase();
      const location = item.location?.trim();
      if (!companyKey || !location) return;
      const locations = counts.get(companyKey) ?? new Map<string, number>();
      locations.set(location, (locations.get(location) ?? 0) + 1);
      counts.set(companyKey, locations);
    });
    const resolved = new Map<string, string>();
    counts.forEach((locations, companyKey) => {
      const best = [...locations.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      )[0][0];
      resolved.set(companyKey, best);
    });
    return resolved;
  }, [existingItems]);

  const supplierName = form.watch(companyFieldName) || '';
  const [showCompanySuggestions, setShowCompanySuggestions] = React.useState(false);
  const autoFilledLocationRef = React.useRef<string | null>(null);

  const companySuggestions = React.useMemo(() => {
    if (!supplierName) return [];
    const query = supplierName.trim().toLowerCase();
    if (!query) return [];
    return existingCompanies.filter((comp) => comp.toLowerCase().includes(query)).slice(0, 5);
  }, [supplierName, existingCompanies]);

  React.useEffect(() => {
    if (!autoFillLocation) return;
    const companyKey = supplierName.trim().toLowerCase();
    if (!companyKey) {
      autoFilledLocationRef.current = null;
      return;
    }
    const knownLocation = locationByCompany.get(companyKey);
    if (!knownLocation) return;
    const currentLocation = (form.getValues('location') || '').trim();
    // A location typed by the user wins; only a blank field or a value this
    // effect auto-filled earlier may be replaced.
    if (currentLocation === knownLocation) return;
    if (currentLocation && currentLocation !== autoFilledLocationRef.current) return;
    form.setValue('location', knownLocation, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    autoFilledLocationRef.current = knownLocation;
  }, [autoFillLocation, supplierName, locationByCompany, form]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name={companyFieldName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Company Name</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder="e.g., Square Pharmaceuticals"
                  {...field}
                  onFocus={() => setShowCompanySuggestions(true)}
                  onBlur={() => {
                    // Slight delay to allow clicks on suggestion buttons
                    setTimeout(() => setShowCompanySuggestions(false), 200);
                  }}
                  autoComplete="off"
                />
                {showCompanySuggestions && companySuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-popover text-popover-foreground border rounded-md shadow-lg p-1">
                    {companySuggestions.map((company) => (
                      <button
                        key={company}
                        type="button"
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted text-foreground font-medium"
                        onMouseDown={() => {
                          form.setValue(companyFieldName, company, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          });
                        }}
                      >
                        {company}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {showLocation && (
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shelf / Row</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 2, Shelf-A, Row-3" {...field} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
