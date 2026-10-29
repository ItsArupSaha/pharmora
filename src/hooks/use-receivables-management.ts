'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomers,
  getCustomersWithNegativeBalance,
  getPaidReceivablesForDateRange,
  getTransactionsPaginated,
} from '@/lib/actions';
import type { Customer, CustomerWithDue, Transaction } from '@/lib/types';

// The paid-receivables query filters client-side, so an early floor date
// simply returns the full collection history.
const HISTORY_FROM = new Date(2000, 0, 1);

export function useReceivablesManagement(userId: string) {
  const { toast } = useToast();

  // Pending receivables (one row per outstanding due)
  const [receivables, setReceivables] = React.useState<Transaction[]>([]);
  const [hasMoreReceivables, setHasMoreReceivables] = React.useState(true);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Customer lookup for naming receivable rows
  const [customersById, setCustomersById] = React.useState<Map<string, Customer>>(new Map());

  // Customer overpayments (we owe them)
  const [overpaidCustomers, setOverpaidCustomers] = React.useState<CustomerWithDue[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = React.useState(true);

  // Payments received (history)
  const [receivedPayments, setReceivedPayments] = React.useState<Transaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);

  const loadPendingReceivables = React.useCallback(async () => {
    setIsInitialLoading(true);
    try {
      const { transactions, hasMore } = await getTransactionsPaginated({
        userId,
        type: 'Receivable',
        pageLimit: 10,
      });
      setReceivables(transactions);
      setHasMoreReceivables(hasMore);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load receivables.' });
    } finally {
      setIsInitialLoading(false);
    }
  }, [userId, toast]);

  const loadCustomers = React.useCallback(async () => {
    try {
      const customers = await getCustomers(userId);
      setCustomersById(new Map(customers.map((c) => [c.id, c])));
    } catch (e) {
      console.error('Failed to load customers for receivables:', e);
    }
  }, [userId]);

  const loadOverpaidCustomers = React.useCallback(async () => {
    setIsLoadingCustomers(true);
    try {
      const customers = await getCustomersWithNegativeBalance(userId);
      setOverpaidCustomers(customers);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load customer overpayments.' });
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [userId, toast]);

  const loadHistory = React.useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const payments = await getPaidReceivablesForDateRange(userId, HISTORY_FROM);
      setReceivedPayments(payments);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load payment history.' });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [userId, toast]);

  const loadAllData = React.useCallback(() => {
    loadPendingReceivables();
    loadCustomers();
    loadOverpaidCustomers();
    loadHistory();
  }, [loadPendingReceivables, loadCustomers, loadOverpaidCustomers, loadHistory]);

  React.useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId, loadAllData]);

  const handleLoadMoreReceivables = async () => {
    if (!hasMoreReceivables || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const lastTransactionId = receivables[receivables.length - 1]?.id;
      const { transactions, hasMore } = await getTransactionsPaginated({
        userId,
        type: 'Receivable',
        pageLimit: 10,
        lastVisibleId: lastTransactionId,
      });
      setReceivables((prev) => [...prev, ...transactions]);
      setHasMoreReceivables(hasMore);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load more receivables.' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    receivables,
    hasMoreReceivables,
    isInitialLoading,
    isLoadingMore,
    customersById,
    overpaidCustomers,
    isLoadingCustomers,
    receivedPayments,
    isLoadingHistory,
    loadAllData,
    handleLoadMoreReceivables,
  };
}
