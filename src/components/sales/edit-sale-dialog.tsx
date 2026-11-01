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
import { getCustomers, updateSale } from '@/lib/actions';
import type { Customer, Item, Sale } from '@/lib/types';
import { saleFormSchema, type SaleFormValues } from './schema';
import { SalePaymentToggle } from './sale-payment-toggle';
import { SaleItemsTable } from './sale-items-table';
import { DueCustomerFields } from './due-customer-fields';
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

  // The page's customer list can be stale (a due shop created by the POS in
  // this session is not in it yet), which would leave the shop fields empty.
  // Refresh the directory every time the dialog opens.
  const [directory, setDirectory] = React.useState<Customer[]>(customers);
  React.useEffect(() => setDirectory(customers), [customers]);
  React.useEffect(() => {
    if (!isOpen || !userId) return;
    let active = true;
    getCustomers(userId)
      .then((list) => {
        if (active) setDirectory(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, userId]);

  // Reset once per opened sale — never while the user is editing.
  const saleCustomer = directory.find((c) => c.id === sale?.customerId);
  const resetKey = `${isOpen}:${sale?.id ?? ''}`;
  React.useEffect(() => {
    if (!isOpen || !sale) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const watchPaymentMethod = useWatch({ control: form.control, name: 'paymentMethod' });
  const isDueLike = watchPaymentMethod === 'Due' || watchPaymentMethod === 'Split';

  // Top up any shop field the reset could not fill (customer list arrived
  // after the reset, or the record predates the field). Each field is filled
  // only while still empty, so typing is never overwritten.
  React.useEffect(() => {
    if (!isDueLike || !sale) return;
    const currentId = form.getValues('customerId') || sale.customerId;
    const selected = directory.find((c) => c.id === currentId);
    if (!selected) return;
    if (!(form.getValues('dueShopName') || '').trim()) {
      form.setValue('dueShopName', selected.name, { shouldValidate: false });
    }
    if (!(form.getValues('dueCustomerPhone') || '').trim()) {
      form.setValue('dueCustomerPhone', selected.phone, { shouldValidate: false });
    }
    if (!(form.getValues('dueContactName') || '').trim() && selected.contactName) {
      form.setValue('dueContactName', selected.contactName, { shouldValidate: false });
    }
  }, [isDueLike, directory, form, sale]);

  const watchItems = useWatch({ control: form.control, name: 'items' }) || [];
  const watchDiscountType = useWatch({ control: form.control, name: 'discountType' }) || 'none';
  const watchDiscountValue = Number(useWatch({ control: form.control, name: 'discountValue' }) || 0);

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

  // The summary's final total must include the sale's own discount, so a
  // plain re-save never trades a discounted total for the raw item sum.
  const netSubtotal = React.useMemo(() => {
    const discountAmount = watchDiscountType === 'percentage'
      ? subtotal * (watchDiscountValue / 100)
      : watchDiscountType === 'amount'
        ? watchDiscountValue
        : 0;
    return subtotal - Math.min(subtotal, Math.max(0, discountAmount));
  }, [subtotal, watchDiscountType, watchDiscountValue]);

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
          // Due/split sales are attributed by the typed shop identity; cash
          // and bank keep the customer select. The sale's own credit stays
          // applied on due/split edits — the server releases it when the
          // sale moves to a different customer.
          customerId: isDueLike ? '' : (data.customerId || sale.customerId || ''),
          dueCustomer: isDueLike
            ? {
                name: (data.dueShopName || '').trim(),
                phone: (data.dueCustomerPhone || '').trim(),
                contactName: (data.dueContactName || '').trim() || undefined,
              }
            : undefined,
          creditApplied: isDueLike ? (sale.creditApplied || 0) : 0,
          // Split keeps its paid-now amount; other methods carry none.
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
              {isDueLike ? (
                <div className="space-y-1">
                  {saleCustomer && (
                    <p className="text-sm text-muted-foreground">
                      Currently recorded under <span className="font-medium text-foreground">{saleCustomer.name}</span>. Change the shop name and
                      phone below to move this sale — its dues and receivable move with it.
                    </p>
                  )}
                  <DueCustomerFields customers={directory} />
                </div>
              ) : (
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
                          {directory.map((c) => (
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
              )}

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
              <SaleSummaryCard
                subtotal={netSubtotal}
                authoredTotal={sale?.total}
                resetKey={resetKey}
              />
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
