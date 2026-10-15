'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { addItem, getItems, updateItem } from '@/lib/actions';
import type { Category, Item } from '@/lib/types';
import {
  addItemsFormSchema,
  type AddItemsFormValues,
} from '@/components/items/schema';
import {
  emptyItemRow,
  rowFromItem,
  rowToItemData,
} from '@/components/items/item-row-mapping';

interface UseAddItemsProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: Item | null;
  categories: Category[];
  onSuccess: () => void;
}

function defaultMedicineCategory(categories: Category[]): Category | undefined {
  return categories.find((c) => c.name.toLowerCase().includes('medicine'));
}

export function useAddItems({
  userId,
  isOpen,
  onOpenChange,
  editingItem,
  categories,
  onSuccess,
}: UseAddItemsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [existingItems, setExistingItems] = React.useState<Item[]>([]);

  const form = useForm<AddItemsFormValues>({
    resolver: zodResolver(addItemsFormSchema),
    defaultValues: { company: '', location: '', items: [emptyItemRow()] },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Existing items power the name autocomplete, same as the purchase dialog.
  React.useEffect(() => {
    if (!isOpen) return;
    getItems(userId)
      .then(setExistingItems)
      .catch((err) => console.error('Failed to load items for autocomplete:', err));
  }, [isOpen, userId]);

  const wasOpenRef = React.useRef(false);
  const prevEditingIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const editingId = editingItem?.id || null;
      const isNewSession = !wasOpenRef.current || editingId !== prevEditingIdRef.current;

      if (isNewSession) {
        if (editingItem) {
          form.reset({
            company: editingItem.company || '',
            location: editingItem.location || '',
            items: [rowFromItem(editingItem)],
          });
        } else {
          const defaultCategory = defaultMedicineCategory(categories);
          form.reset({
            company: '',
            location: '',
            items: [emptyItemRow(defaultCategory?.id, defaultCategory?.name)],
          });
        }
        prevEditingIdRef.current = editingId;
      }
    } else {
      prevEditingIdRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, form, categories, editingItem]);

  const onSubmit = (data: AddItemsFormValues) => {
    startTransition(async () => {
      // Company and shelf location are invoice-level fields applied to every
      // row, exactly like the purchase dialog applies supplier + location.
      const mappedRows = data.items.map((row) => ({
        ...row,
        company: data.company,
        location: data.location,
      }));

      if (editingItem) {
        try {
          await updateItem(userId, editingItem.id, rowToItemData(mappedRows[0], categories));
          toast({ title: 'Item Updated', description: 'The item details have been saved.' });
          onSuccess();
          onOpenChange(false);
        } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to save the item.' });
        }
        return;
      }

      const results = await Promise.allSettled(
        mappedRows.map((row) => addItem(userId, rowToItemData(row, categories)))
      );
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      if (failedCount === data.items.length) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to add the items. Please try again.',
        });
        return;
      }

      if (failedCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Partially saved',
          description: `${data.items.length - failedCount} of ${data.items.length} items added. Please re-add the failed ones.`,
        });
      } else {
        toast({
          title: 'Items Added',
          description: `${data.items.length} item(s) are now in your inventory.`,
        });
      }
      onSuccess();
      onOpenChange(false);
    });
  };

  const handleAddItem = () => {
    const defaultCategory = defaultMedicineCategory(categories);
    append(emptyItemRow(defaultCategory?.id, defaultCategory?.name));
  };

  return {
    form,
    fields,
    remove,
    isPending,
    onSubmit,
    handleAddItem,
    existingItems,
  };
}
