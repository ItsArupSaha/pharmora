'use client';

import * as React from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormLabel } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import type { Category, Purchase } from '@/lib/types';
import { useRecordPurchase } from '@/hooks/use-record-purchase';
import { PurchaseItemRow } from './purchase-item-row';
import { PurchasePaymentSection } from './purchase-payment-section';
import { PurchaseSummarySection } from './purchase-summary-section';
import { SupplierFormFields } from './supplier-form-fields';

interface RecordPurchaseDialogProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editingPurchase?: Purchase | null;
  onSuccess: () => void;
  onAddCategoryClick: () => void;
}

export function RecordPurchaseDialog({
  userId,
  isOpen,
  onOpenChange,
  categories,
  editingPurchase,
  onSuccess,
  onAddCategoryClick,
}: RecordPurchaseDialogProps) {
  const {
    form,
    fields,
    remove,
    isPending,
    onSubmit,
    handleAddItem,
    existingItems,
  } = useRecordPurchase({
    userId,
    isOpen,
    onOpenChange,
    categories,
    editingPurchase,
    onSuccess,
  });

  const onError = (errors: any) => {
    console.log('Purchase Form Validation Errors:', errors);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="font-headline">
            {editingPurchase ? 'Edit Purchase Details' : 'Record New Purchase'}
          </DialogTitle>
          <DialogDescription>
            {editingPurchase
              ? 'Update the purchase details. Stock levels and financial transactions will reconcile automatically.'
              : 'Enter company details and the items purchased. New items will be created automatically.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onError)}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <SupplierFormFields
                form={form}
                existingItems={existingItems || []}
              />
              <Separator />

              <FormLabel>Items</FormLabel>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <PurchaseItemRow
                    key={field.id}
                    index={index}
                    categories={categories}
                    existingItems={existingItems || []}
                    onAddCategoryClick={onAddCategoryClick}
                    onRemove={() => remove(index)}
                    disabledRemove={fields.length === 1}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Item
              </Button>

                <Separator />
                <PurchasePaymentSection />
              </div>

            <div className="border-t p-6 bg-background space-y-4 shrink-0">
              <PurchaseSummarySection />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Saving...' : editingPurchase ? 'Update Purchase' : 'Confirm Purchase'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
