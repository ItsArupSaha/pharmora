'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { Customer, Transaction } from '@/lib/types';
import ReceivePaymentDialog from '../receive-payment-dialog';

interface PendingReceivablesTableProps {
  receivables: Transaction[];
  customersById: Map<string, Customer>;
  isLoading: boolean;
  userId: string;
  onPaymentSuccess: () => void;
}

/**
 * One row per outstanding receivable. Collect opens the standard
 * receive-payment dialog for that customer (settlement runs oldest-first,
 * matching the dues ledger).
 */
export function PendingReceivablesTable({
  receivables,
  customersById,
  isLoading,
  userId,
  onPaymentSuccess,
}: PendingReceivablesTableProps) {
  const { canWrite } = useAccountAccess();
  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shop / Customer</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-32 text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-receivable-${i}`}>
                <TableCell>
                  <Skeleton className="h-5 w-3/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-2/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-1/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-1/4 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : receivables.length > 0 ? (
            receivables.map((receivable) => {
              const customer = receivable.customerId
                ? customersById.get(receivable.customerId)
                : undefined;
              return (
                <TableRow key={receivable.id}>
                  <TableCell className="font-medium">
                    {customer?.name || receivable.customerName || 'Unknown'}
                    {customer?.phone && (
                      <span className="block text-xs text-muted-foreground">{customer.phone}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{receivable.description}</TableCell>
                  <TableCell>{format(new Date(receivable.dueDate), 'PPP')}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    ৳{receivable.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    {customer && (
                      <ReceivePaymentDialog
                        customerId={customer.id}
                        userId={userId}
                        onPaymentReceived={onPaymentSuccess}
                      >
                        <Button size="sm" variant="outline" className="w-full whitespace-nowrap" disabled={!canWrite}>
                          <HandCoins className="w-3 h-3 mr-1" /> Collect
                        </Button>
                      </ReceivePaymentDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No pending receivables — everyone has settled up.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
