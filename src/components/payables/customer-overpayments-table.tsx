'use client';

import * as React from 'react';
import { DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { CustomerWithDue } from '@/lib/types';
import RefundCustomerDialog from '../refund-customer-dialog';

interface CustomerOverpaymentsTableProps {
  overpaidCustomers: CustomerWithDue[];
  isLoading: boolean;
  userId: string;
  onRefundSuccess: () => void;
}

export function CustomerOverpaymentsTable({
  overpaidCustomers,
  isLoading,
  userId,
  onRefundSuccess,
}: CustomerOverpaymentsTableProps) {
  const { canWrite } = useAccountAccess();
  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Overpaid</TableHead>
            <TableHead className="w-32 text-center">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={`skeleton-cust-${i}`}>
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
          ) : overpaidCustomers.length > 0 ? (
            overpaidCustomers.map((cust) => (
              <TableRow key={cust.id}>
                <TableCell className="font-medium">{cust.name}</TableCell>
                <TableCell>{cust.phone}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">
                  ৳{Math.abs(cust.dueBalance).toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <RefundCustomerDialog customer={cust} userId={userId} onRefundSuccess={onRefundSuccess}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                      disabled={!canWrite}
                    >
                      <DollarSign className="w-3 h-3 mr-1" /> Refund
                    </Button>
                  </RefundCustomerDialog>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                No customer overpayments recorded.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
