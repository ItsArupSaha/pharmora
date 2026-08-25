'use client';

import * as React from 'react';
import { HandCoins, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ReceivePaymentDialog from '@/components/receive-payment-dialog';
import { getCustomers } from '@/lib/actions';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useAuth } from '@/hooks/use-auth';
import type { Customer } from '@/lib/types';

/**
 * Customer dues: everyone the shop still owes-money-from (dueBalance > 0),
 * straight from the version-guarded cached customer list — no extra reads.
 * Collect taps the existing receive-payment flow.
 */
export function DuesPage() {
  const { user } = useAuth();
  const { canWrite } = useAccountAccess();
  const [customers, setCustomers] = React.useState<Customer[] | null>(null);
  const [totalDue, setTotalDue] = React.useState(0);

  const load = React.useCallback(async () => {
    if (!user) return;
    const all = await getCustomers(user.uid);
    const withDue = all
      .filter((c) => (Number(c.dueBalance) || 0) > 0)
      .sort((a, b) => (Number(b.dueBalance) || 0) - (Number(a.dueBalance) || 0));
    setCustomers(withDue);
    setTotalDue(withDue.reduce((sum, c) => sum + (Number(c.dueBalance) || 0), 0));
  }, [user]);

  React.useEffect(() => {
    load().catch((err) => {
      console.error('Failed to load dues:', err);
      setCustomers([]);
    });
  }, [load]);

  return (
    <Card className="animate-in fade-in-50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
          <div>
            <CardTitle className="font-headline text-2xl">Customer Dues</CardTitle>
            <CardDescription>People who owe you money. Tap the phone to call, tap Collect to receive payment.</CardDescription>
          </div>
          {customers !== null && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total outstanding</p>
              <p className="text-xl font-bold text-primary">৳{totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {customers === null ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No outstanding dues — everyone is settled up.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Due Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </a>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    ৳{(Number(c.dueBalance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {user && (
                      <ReceivePaymentDialog customerId={c.id} userId={user.uid} onPaymentReceived={load}>
                        <Button variant="outline" size="sm" disabled={!canWrite}>
                          <HandCoins className="mr-1 h-3.5 w-3.5" /> Collect
                        </Button>
                      </ReceivePaymentDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
