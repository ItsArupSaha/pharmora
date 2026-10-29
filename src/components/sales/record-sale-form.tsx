'use client';

import * as React from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Printer } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { addSale } from '@/lib/actions';
import type { Customer, Item, Sale } from '@/lib/types';
import { SaleMemo } from '../sale-memo';
import { saleFormSchema, type SaleFormValues } from './schema';
import { SalePaymentToggle } from './sale-payment-toggle';
import { DueCustomerFields } from './due-customer-fields';
import { SplitPaymentFields } from './split-payment-fields';
import { SaleItemsTable } from './sale-items-table';
import { SaleSummaryCard } from './sale-summary-card';

interface RecordSaleFormProps {
  userId: string;
  items: Item[];
  customers: Customer[];
  onSuccess?: (sale?: Sale) => void;
  authUser: any;
}

const DEFAULT_ROWS = Array.from({ length: 7 }).map(() => ({ itemId: '', quantity: 1 }));

const getDefaultValues = () => ({
  items: DEFAULT_ROWS,
  date: new Date(),
  discountType: 'none' as const,
  discountValue: 0,
  paymentMethod: 'Cash' as const,
  dueShopName: '',
  dueCustomerPhone: '',
  dueContactName: '',
  amountPaid: 0,
  extraSales: 0,
  total: 0,
});

export function RecordSaleForm({
  userId,
  items,
  customers,
  onSuccess,
  authUser,
}: RecordSaleFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [completedSale, setCompletedSale] = React.useState<Sale | null>(null);
  const [lastSale, setLastSale] = React.useState<Sale | null>(null);
  // Shop typed on the last due/split sale — the memo bills the shop, which
  // may not exist in the local customers list yet when just created.
  const [lastDueShop, setLastDueShop] = React.useState<Customer | null>(null);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: getDefaultValues() as any,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const walkInCustomer = React.useMemo(() => {
    return customers.find((c) => c.name === 'Walk-in Customer') || customers[0];
  }, [customers]);

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

  const focusFirstSearch = React.useCallback(() => {
    requestAnimationFrame(() => {
      const firstInput = document.querySelector<HTMLInputElement>('[data-row="0"][data-col="0"]');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    });
  }, []);

  React.useEffect(() => {
    focusFirstSearch();
  }, [focusFirstSearch]);

  const handleAddNewRow = () => append({ itemId: '', quantity: 1 });

  const handleResetForm = () => {
    form.reset(getDefaultValues() as any);
    setCompletedSale(null);
    focusFirstSearch();
  };

  const onSubmit = (data: SaleFormValues) => {
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
        // Due and split sales both owe money to a shop: the customer is
        // resolved/created on the server from the typed shop name + phone.
        // Cash/Bank sales stay on the walk-in record. Split pays part in
        // cash now; the remainder lands on the shop's dues.
        const hasDueCustomer = data.paymentMethod === 'Due' || data.paymentMethod === 'Split';
        const saleData = {
          ...data,
          customerId: hasDueCustomer ? '' : walkInCustomer?.id || '',
          dueCustomer: hasDueCustomer
            ? {
                name: data.dueShopName?.trim() || '',
                phone: data.dueCustomerPhone?.trim() || '',
                contactName: data.dueContactName?.trim() || undefined,
              }
            : undefined,
          amountPaid: data.paymentMethod === 'Split' ? Number(data.amountPaid) : undefined,
          splitPaymentMethod: data.paymentMethod === 'Split' ? ('Cash' as const) : undefined,
          items: activeItems as any,
          date: data.date.toISOString(),
          discountType: 'none' as const,
          discountValue: 0,
        };

        const result = await addSale(userId, saleData);

        if (result?.success && result.sale) {
          setCompletedSale(result.sale);
          setLastSale(result.sale);
          setLastDueShop(
            hasDueCustomer
              ? {
                  id: result.sale.customerId || '',
                  name: data.dueShopName?.trim() || '',
                  contactName: data.dueContactName?.trim() || undefined,
                  phone: data.dueCustomerPhone?.trim() || '',
                  address: 'N/A',
                  openingBalance: 0,
                  dueBalance: 0,
                }
              : null
          );
          onSuccess?.(result.sale);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to record sale.' });
        }
      } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
      }
    });
  };

  const sellableItems = React.useMemo(() => {
    return items.filter((item) => item.isSalable !== false);
  }, [items]);

  const memoSale = completedSale || lastSale;
  // Due/split memos bill the shop they were sold to; cash/bank bill walk-in.
  const memoCustomer =
    memoSale && (memoSale.paymentMethod === 'Due' || memoSale.paymentMethod === 'Split')
      ? lastDueShop || walkInCustomer
      : walkInCustomer;

  return (
    <div className="space-y-6 w-full max-w-none">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <SalePaymentToggle />
          {(form.watch('paymentMethod') === 'Due' || form.watch('paymentMethod') === 'Split') && (
            <DueCustomerFields customers={customers} />
          )}
          <SaleItemsTable
            items={sellableItems}
            fields={fields}
            remove={remove}
            appendRow={handleAddNewRow}
          />
          <SaleSummaryCard subtotal={subtotal} />
          {form.watch('paymentMethod') === 'Split' && <SplitPaymentFields />}
          <div className="flex justify-end gap-2 border-t pt-4">
            {lastSale && !completedSale && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCompletedSale(lastSale)}
              >
                <Printer className="mr-2 h-4 w-4" /> Reprint Last Memo
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleResetForm} disabled={isPending}>
              Reset Form
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Confirming...' : 'Confirm Sale & Print'}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={!!completedSale} onOpenChange={(open) => !open && handleResetForm()}>
        <DialogContent className="sm:max-w-2xl">
          {memoSale && authUser && (
            <SaleMemo
              sale={memoSale}
              customer={memoCustomer}
              items={items}
              onNewSale={handleResetForm}
              user={authUser}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
