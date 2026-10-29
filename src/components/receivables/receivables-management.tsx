'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerOverpaymentsTable } from '../payables/customer-overpayments-table';
import { PendingReceivablesTable } from './pending-receivables-table';
import { ReceivedHistoryTable } from './received-history-table';
import { useReceivablesManagement } from '@/hooks/use-receivables-management';

interface ReceivablesManagementProps {
  userId: string;
}

export default function ReceivablesManagement({ userId }: ReceivablesManagementProps) {
  const {
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
  } = useReceivablesManagement(userId);

  const totalPending = receivables.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card className="animate-in fade-in-50">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-2xl">Track Receivables</CardTitle>
            <CardDescription>
              Money your customers owe you — collections, payment history and overpayments.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold font-headline">Pending Receivables</h3>
            {totalPending > 0 && (
              <p className="text-sm text-muted-foreground">
                Outstanding (loaded):{' '}
                <span className="font-semibold text-destructive">
                  ৳{totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>
          <PendingReceivablesTable
            receivables={receivables}
            customersById={customersById}
            isLoading={isInitialLoading}
            userId={userId}
            onPaymentSuccess={loadAllData}
          />
          {hasMoreReceivables && receivables.length > 0 && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleLoadMoreReceivables} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                  </>
                ) : (
                  'Load More Receivables'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Customer Overpayments Section */}
        <div className="border-t pt-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold font-headline text-emerald-600 mb-2">Customer Overpayments</h3>
              <p className="text-sm text-muted-foreground">
                Customers who paid more than they owed. You owe them this amount.
              </p>
            </div>
          </div>
          <CustomerOverpaymentsTable
            overpaidCustomers={overpaidCustomers}
            isLoading={isLoadingCustomers}
            userId={userId}
            onRefundSuccess={loadAllData}
          />
        </div>

        {/* Payments Received Section */}
        <div className="border-t pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold font-headline mb-2">Payments Received</h3>
            <p className="text-sm text-muted-foreground">
              History of payments collected against customer dues.
            </p>
          </div>
          <ReceivedHistoryTable payments={receivedPayments} isLoading={isLoadingHistory} />
        </div>
      </CardContent>
    </Card>
  );
}
