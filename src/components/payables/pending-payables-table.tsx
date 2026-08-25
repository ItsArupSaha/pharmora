'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { Transaction } from '@/lib/types';
import PayPayableDialog from '../pay-payable-dialog';

interface PendingPayablesTableProps {
  payables: Transaction[];
  isLoading: boolean;
  userId: string;
  onPaymentSuccess: () => void;
}

export function PendingPayablesTable({
  payables,
  isLoading,
  userId,
  onPaymentSuccess,
}: PendingPayablesTableProps) {
  const { canWrite } = useAccountAccess();
  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-32 text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-payable-${i}`}>
                <TableCell>
                  <Skeleton className="h-5 w-3/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-2/4" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-1/4 ml-auto" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : payables.length > 0 ? (
            payables.map((payable) => (
              <TableRow key={payable.id}>
                <TableCell className="font-medium">{payable.description}</TableCell>
                <TableCell>{format(new Date(payable.dueDate), 'PPP')}</TableCell>
                <TableCell className="text-right">৳{payable.amount.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <PayPayableDialog payable={payable} userId={userId} onPaymentSuccess={onPaymentSuccess}>
                    <Button size="sm" variant="outline" className="w-full whitespace-nowrap" disabled={!canWrite}>
                      <DollarSign className="w-3 h-3 mr-1" /> Pay
                    </Button>
                  </PayPayableDialog>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                No pending payables right now.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
