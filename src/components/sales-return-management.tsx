'use client';

import { addSalesReturn, getCustomers, getItems, getSalesReturnsPaginated } from '@/lib/actions';
import { PlusCircle } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useToast } from '@/hooks/use-toast';
import type { Customer, Item, SalesReturn } from '@/lib/types';
import { SalesReturnsTable } from './sales-return/sales-returns-table';
import { RecordReturnDialog } from './sales-return/record-return-dialog';
import type { SalesReturnFormValues } from './sales-return/schema';

interface SalesReturnManagementProps {
    userId: string;
}

export default function SalesReturnManagement({ userId }: SalesReturnManagementProps) {
  const [returns, setReturns] = React.useState<SalesReturn[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { toast } = useToast();
  const { canWrite } = useAccountAccess();
  const [isPending, startTransition] = React.useTransition();
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);

  const loadInitialData = React.useCallback(async () => {
    setIsInitialLoading(true);
    try {
        const [{ returns: newReturns, hasMore: newHasMore }, itemsData, customersData] = await Promise.all([
            getSalesReturnsPaginated({ userId, pageLimit: 10 }),
            getItems(userId),
            getCustomers(userId),
        ]);
        setReturns(newReturns);
        setHasMore(newHasMore);
        setItems(itemsData);
        setCustomers(customersData);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not load data." });
    } finally {
        setIsInitialLoading(false);
    }
  }, [userId, toast]);

  React.useEffect(() => {
    if(userId) loadInitialData();
  }, [userId, loadInitialData]);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const lastReturnId = returns[returns.length - 1]?.id;
    try {
        const { returns: newReturns, hasMore: newHasMore } = await getSalesReturnsPaginated({ userId, pageLimit: 10, lastVisibleId: lastReturnId });
        setReturns(prev => [...prev, ...newReturns]);
        setHasMore(newHasMore);
    } catch(e) {
        toast({ variant: "destructive", title: "Error", description: "Could not load more returns." });
    } finally {
        setIsLoadingMore(false);
    }
  };

  const handleAddNew = () => {
    setIsDialogOpen(true);
  };
  
  const onSubmit = (data: SalesReturnFormValues) => {
    startTransition(async () => {
      const result = await addSalesReturn(userId, data);
      if (result?.success && result.salesReturn) {
        toast({ title: 'Return Recorded', description: 'The sales return has been successfully processed.' });
        loadInitialData();
        setIsDialogOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to record return.' });
      }
    });
  };

  return (
    <>
      <Card className="animate-in fade-in-50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">Sales Returns</CardTitle>
              <CardDescription>Manage customer returns and update their balance.</CardDescription>
            </div>
            <Button onClick={handleAddNew} disabled={!canWrite} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Record New Return
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <SalesReturnsTable
            returns={returns}
            items={items}
            customers={customers}
            isInitialLoading={isInitialLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        </CardContent>
      </Card>

      <RecordReturnDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        items={items}
        customers={customers}
        isPending={isPending}
        onSubmit={onSubmit}
      />
    </>
  );
}
