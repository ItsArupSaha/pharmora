'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { updateSale } from '@/lib/actions';
import type { Customer, Item, Sale } from '@/lib/types';
import { saleFormSchema, type SaleFormValues } from './schema';
import { SalePaymentToggle } from './sale-payment-toggle';
import { SaleItemsTable } from './sale-items-table';
import { SplitPaymentFields } from './split-payment-fields';
import { SaleSummaryCard } from './sale-summary-card';

interface EditSaleDialogProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  items: Item[];
  customers: Customer[];
  onSuccess: () => void;
}

export function EditSaleDialog({
  userId,
  isOpen,
  onOpenChange,
  sale,
  items,
  customers,
  onSuccess,
}: EditSaleDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customerId: '',
      date: new Date(),
      items: [],
      discountType: 'none',
      discountValue: 0,
      paymentMethod: 'Cash',
      dueShopName: '',
      dueCustomerPhone: '',
      dueContactName: '',
      amountPaid: 0,
      extraSales: 0,
      total: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  React.useEffect(() => {
    if (isOpen && sale) {
      const saleCustomer = customers.find((c) => c.id === sale.customerId);
      form.reset({
        customerId: sale.customerId || '',
        date: sale.date ? new Date(sale.date) : new Date(),
        items: (sale.items || []).map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          price: item.price !== undefined ? item.price : 0,
        })),
        discountType: sale.discountType || 'none',
        discountValue: sale.discountValue || 0,
        // Legacy Paid-by-Credit sales default to Due when edited; Split
        // sales stay editable as Split with their original paid amount.
        paymentMethod: (['Cash', 'Bank', 'Due', 'Split'] as const).includes(sale.paymentMethod as any)
          ? (sale.paymentMethod as 'Cash' | 'Bank' | 'Due' | 'Split')
          : 'Due',
        dueShopName: saleCustomer?.name || '',
        dueCustomerPhone: saleCustomer?.phone || '',
        dueContactName: saleCustomer?.contactName || '',
        amountPaid: sale.amountPaid ?? 0,
        extraSales: sale.extraSales || 0,
        total: sale.total || 0,
      });
    }
  }, [isOpen, sale, customers, form]);

  // Due/split validation requires the shop identity; keep it in sync with
  // the customer selected above (updateSale attributes dues by customerId).
  const watchCustomerId = useWatch({ control: form.control, name: 'customerId' });
  React.useEffect(() => {
    if (!watchCustomerId) return;
    const selected = customers.find((c) => c.id === watchCustomerId);
    if (selected) {
      form.setValue('dueShopName', selected.name, { shouldValidate: false });
      form.setValue('dueCustomerPhone', selected.phone, { shouldValidate: false });
    }
  }, [watchCustomerId, customers, form]);

  const watchItems = useWatch({ control: form.control, name: 'items' }) || [];

  const subtotal = React.useMemo(() => {
    const priceById = new Map(items.map((item) => [item.id, Number(item.sellingPrice) || 0]));
    return watchItems.reduce((acc: number, item: any) => {
      if (!item?.itemId) return acc;
      const unitPrice =
        item.price !== undefined && item.price !== '' && !isNaN(Number(item.price))
          ? Number(item.price)
          : (priceById.get(item.itemId) || 0);
      return acc + unitPrice * (Number(item?.quantity) || 0);
    }, 0);
  }, [watchItems, items]);

  const handleAddNewRow = () => append({ itemId: '', quantity: 1 });

  const onSubmit = (data: SaleFormValues) => {
    if (!sale) return;
    const activeItems = data.items.filter((item) => item.itemId !== '');

    if (activeItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select at least one item to sell.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const saleData = {
          ...data,
          customerId: data.customerId || sale.customerId || '',
          // The edit dialog attributes dues via the customer select; the
          // typed shop fields are validation-only here. Split keeps its
          // paid-now amount; other methods carry none.
          amountPaid: data.paymentMethod === 'Split' ? Number(data.amountPaid) : undefined,
          splitPaymentMethod: data.paymentMethod === 'Split' ? ('Cash' as const) : undefined,
          items: activeItems as any,
          date: data.date.toISOString(),
          discountType: data.discountType || 'none',
          discountValue: data.discountValue || 0,
        };

        const result = await updateSale(userId, sale.id, saleData);

        if (result?.success) {
          toast({ title: 'Sale Updated', description: `Sale ${sale.saleId} has been updated.` });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ variant: 'destructive', title: 'Update Failed', description: result.error || 'Could not update sale.' });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
      }
    });
  };

  const sellableItems = React.useMemo(() => {
    const oldSaleQtyMap: Record<string, number> = {};
    if (sale && sale.items) {
      sale.items.forEach((item) => {
        oldSaleQtyMap[item.itemId] = (oldSaleQtyMap[item.itemId] || 0) + (Number(item.quantity) || 0);
      });
    }

    return items
      .filter((item) => {
        const catName = (item.categoryName || '').toLowerCase();
        return catName !== 'assets' && catName !== 'surgicals';
      })
      .map((item) => {
        const oldQty = oldSaleQtyMap[item.id] || 0;
        if (oldQty > 0) {
          return {
            ...item,
            stock: (Number(item.stock) || 0) + oldQty,
          };
        }
        return item;
      });
  }, [items, sale]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Sale ({sale?.saleId})</DialogTitle>
          <DialogDescription>
            Update items, prices, quantities, date, or customer details for this recorded sale. Stock and balances will reconcile automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden space-y-4">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SalePaymentToggle />
              <Separator />

              <SaleItemsTable
                items={sellableItems}
                fields={fields}
                remove={remove}
                appendRow={handleAddNewRow}
              />

              <Separator />
              {form.watch('paymentMethod') === 'Split' && <SplitPaymentFields />}
              <SaleSummaryCard subtotal={subtotal} />
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
