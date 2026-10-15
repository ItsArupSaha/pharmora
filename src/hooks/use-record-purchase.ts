'use client';

import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { addPurchase, updatePurchase } from '@/lib/actions';
import type { Category, Purchase } from '@/lib/types';
import { purchaseFormSchema, type PurchaseFormValues } from '@/components/purchases/schema';
import { usePurchaseAutofill } from './use-purchase-autofill';

interface UseRecordPurchaseProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  editingPurchase?: Purchase | null;
  onSuccess: () => void;
}

const emptyItemRow = (categoryId = '', categoryName = '') => ({
  itemName: '',
  categoryId,
  categoryName,
  medicineGroup: '',
  company: '',
  expiryDate: '',
  location: '',
  quantity: 1,
  cost: 0,
  sellingPrice: 0,
});

export function useRecordPurchase({
  userId,
  isOpen,
  onOpenChange,
  categories,
  editingPurchase,
  onSuccess,
}: UseRecordPurchaseProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplier: '',
      location: '',
      items: [emptyItemRow()],
      discountType: 'amount',
      discountValue: 0,
      vatType: 'amount',
      vatValue: 0,
      paymentMethod: 'Cash',
      amountPaid: 0,
      splitPaymentMethod: 'Cash',
      dueDate: new Date(),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Call the dedicated autofill and category sync hook
  const { existingItems } = usePurchaseAutofill({
    form,
    isOpen,
    userId,
    categories,
  });

  const wasOpenRef = React.useRef(false);
  const prevPurchaseIdRef = React.useRef<string | null>(null);

  // Manage purchase dialog reset and pre-filling logic when editing
  React.useEffect(() => {
    if (isOpen) {
      const purchaseId = editingPurchase?.id || null;
      const isNewSession = !wasOpenRef.current || (purchaseId !== prevPurchaseIdRef.current);

      if (isNewSession) {
        if (editingPurchase) {
          const mappedItems = editingPurchase.items.map(item => ({
            itemName: item.itemName,
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            medicineGroup: item.medicineGroup || '',
            company: item.company || '',
            expiryDate: item.expiryDate || '',
            location: item.location || '',
            quantity: item.quantity,
            cost: item.cost,
            sellingPrice: item.sellingPrice || 0
          }));

          form.reset({
            supplier: editingPurchase.supplier || '',
            location: editingPurchase.items[0]?.location || '',
            items: mappedItems,
            discountType: 'amount',
            discountValue: editingPurchase.discountAmount || 0,
            vatType: editingPurchase.vatType || 'amount',
            vatValue: editingPurchase.vatValue || 0,
            paymentMethod: editingPurchase.paymentMethod === 'N/A' ? 'Cash' : editingPurchase.paymentMethod,
            amountPaid: editingPurchase.amountPaid || 0,
            splitPaymentMethod: editingPurchase.splitPaymentMethod || 'Cash',
            dueDate: editingPurchase.dueDate ? new Date(editingPurchase.dueDate) : new Date(),
          });
        } else {
          const defaultCategory = categories.find(c => c.name.toLowerCase().includes('medicine'));
          form.reset({
            supplier: '',
            location: '',
            items: [emptyItemRow(defaultCategory?.id, defaultCategory?.name)],
            discountType: 'amount',
            discountValue: 0,
            vatType: 'amount',
            vatValue: 0,
            paymentMethod: 'Cash',
            amountPaid: 0,
            splitPaymentMethod: 'Cash',
            dueDate: new Date(),
          });
        }
        prevPurchaseIdRef.current = purchaseId;
      }
    } else {
      prevPurchaseIdRef.current = null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, form, categories, editingPurchase]);

  // Form submission coordinator
  const onSubmit = (data: PurchaseFormValues) => {
    startTransition(async () => {
      try {
        const calculatedTotal = data.items.reduce((acc, item) => acc + (item.cost * item.quantity), 0);
        const calculatedDiscount = data.discountType === 'percentage'
            ? (calculatedTotal * (data.discountValue || 0)) / 100
            : (data.discountValue || 0);

        // Pharmacy convention: the supplier is the medicine company and the
        // invoice-level shelf location applies to every line.
        const mappedItems = data.items.map(item => ({
          ...item,
          company: data.supplier,
          location: data.location
        }));

        const purchaseData = {
          ...data,
          items: mappedItems,
          discountAmount: calculatedDiscount,
          dueDate: data.dueDate.toISOString()
        };

        // @ts-ignore
        delete purchaseData.discountType;
        // @ts-ignore
        delete purchaseData.discountValue;
        // @ts-ignore
        delete purchaseData.location;

        const result = editingPurchase
          ? await updatePurchase(userId, editingPurchase.id, purchaseData)
          : await addPurchase(userId, purchaseData);

        if (result?.success) {
          toast({
            title: editingPurchase ? 'Purchase Updated' : 'Purchase Recorded',
            description: editingPurchase ? 'The purchase details and inventory have been updated.' : 'The new purchase has been added and stock updated.'
          });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: (result as any)?.error || 'Failed to save purchase.' });
        }
      } catch (err) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save the purchase.' });
      }
    });
  };

  const handleAddItem = () => {
    const defaultCategory = categories.find(c => c.name.toLowerCase().includes('medicine'));
    append(emptyItemRow(defaultCategory?.id, defaultCategory?.name));
  };

  return {
    form,
    fields,
    append,
    remove,
    isPending,
    onSubmit,
    handleAddItem,
    existingItems,
  };
}
