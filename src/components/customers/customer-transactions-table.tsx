'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { DollarSign, Book, ShoppingCart, ArrowDownToLine } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useStoreType } from '@/hooks/use-store-type';
import type { Item } from '@/lib/types';

interface CustomerTransactionsTableProps {
  activities: any[];
  customerName: string;
  items: Item[];
}

export function CustomerTransactionsTable({
  activities,
  customerName,
  items,
}: CustomerTransactionsTableProps) {
  const { isPharmacy } = useStoreType();
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-headline text-2xl">Transaction History</CardTitle>
            <CardDescription>
              All transactions between {customerName} and your {isPharmacy ? 'pharmacy' : 'store'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <DollarSign className="mr-2 h-4 w-4" />
            Receive Payment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="border rounded-md max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status / Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity, index) => {
                  const isSale = activity.activityType === 'sale';

                  return (
                    <TableRow key={activity.id || index}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(isSale ? activity.date : activity.dueDate), 'PPP')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          {isSale ? (
                            <>
                              <ShoppingCart className="h-4 w-4 text-primary" /> Sale
                            </>
                          ) : (
                            <>
                              <ArrowDownToLine className="h-4 w-4 text-green-600" /> Payment/Due
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        {isSale ? (
                          <div className="space-y-1">
                            <span className="text-xs text-muted-foreground font-mono">
                              {activity.saleId}
                            </span>
                            <div className="text-sm">
                              {activity.items.map((i: any) => {
                                const itemTitle =
                                  items.find((it) => it.id === i.itemId)?.title || 'Unknown Item';
                                return (
                                  <div key={i.itemId} className="truncate">
                                    {i.quantity}x {itemTitle}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="truncate block">{activity.description}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isSale ? (
                          <Badge variant="outline">{activity.paymentMethod}</Badge>
                        ) : (
                          <Badge
                            variant={
                              activity.status === 'Paid'
                                ? 'default'
                                : activity.status === 'Pending'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className={activity.status === 'Paid' ? 'bg-green-600' : ''}
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        TK {isSale ? activity.total.toFixed(2) : activity.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Transactions Found</h3>
            <p className="text-muted-foreground">
              No transaction history available for this customer yet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
