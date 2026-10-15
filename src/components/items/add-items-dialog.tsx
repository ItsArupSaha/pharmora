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
import type { Category, Item } from '@/lib/types';
import { PurchaseItemRow } from '@/components/purchases/purchase-item-row';
import { SupplierFormFields } from '@/components/purchases/supplier-form-fields';
import { useAddItems } from '@/hooks/use-add-items';

interface AddItemsDialogProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: Item | null;
  categories: Category[];
  onSuccess: () => void;
}

export function AddItemsDialog({
  userId,
  isOpen,
  onOpenChange,
  editingItem,
  categories,
  onSuccess,
}: AddItemsDialogProps) {
  const {
    form,
    fields,
    remove,
    isPending,
    onSubmit,
    handleAddItem,
    existingItems,
  } = useAddItems({
    userId,
    isOpen,
    onOpenChange,
    editingItem,
    categories,
    onSuccess,
  });

  const isEditing = Boolean(editingItem);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="font-headline">
            {isEditing ? 'Edit Item' : 'Add New Items'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the details of this item.'
              : 'Enter the medicines you already have on hand. No billing here — this only builds your stock list.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <SupplierFormFields
                form={form}
                existingItems={existingItems}
                companyFieldName="company"
                autoFillLocation
                showLocation={false}
              />
              <Separator />

              <FormLabel>Items</FormLabel>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <PurchaseItemRow
                    key={field.id}
                    index={index}
                    categories={categories}
                    existingItems={existingItems}
                    onRemove={() => remove(index)}
                    disabledRemove={fields.length === 1}
                    variant="stock"
                  />
                ))}
              </div>
              {!isEditing && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              )}
            </div>

            <div className="border-t p-6 bg-background shrink-0">
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? 'Saving...'
                    : isEditing
                      ? 'Save Changes'
                      : `Add ${fields.length} Item(s)`}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
