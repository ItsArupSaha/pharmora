'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction } from '@/lib/types';

interface ReceivedHistoryTableProps {
  payments: Transaction[];
  isLoading: boolean;
}

/** Payments received against customer dues (cleared receivables). */
export function ReceivedHistoryTable({ payments, isLoading }: ReceivedHistoryTableProps) {
  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shop / Customer</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={`skeleton-payment-${i}`}>
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
                  <Skeleton className="h-5 w-1/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-1/4 ml-auto" />
                </TableCell>
              </TableRow>
            ))
          ) : payments.length > 0 ? (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="font-medium">{payment.customerName || 'Unknown'}</TableCell>
                <TableCell className="text-muted-foreground">{payment.description}</TableCell>
                <TableCell>{format(new Date(payment.dueDate), 'PPP')}</TableCell>
                <TableCell>{payment.paymentMethod || '—'}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-600">
                  ৳{payment.amount.toFixed(2)}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No payments received yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
