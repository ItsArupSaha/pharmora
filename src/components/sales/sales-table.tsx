'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { Sale, Item, Customer } from '@/lib/types';
import { getSaleTransaction } from '@/lib/actions';
import { SaleDetailsDialog } from '../sale-details-dialog';
import { EditSaleDialog } from './edit-sale-dialog';
import { getImmediateSaleStatus, getResolvedSaleStatus, type SaleStatus } from './sales-status-utils';

interface SalesTableProps {
  userId: string;
  sales: Sale[];
  items: Item[];
  customers: Customer[];
  isInitialLoading: boolean;
  isSearching: boolean;
  isPending: boolean;
  onDelete: (id: string) => void;
  onSuccess?: () => void;
  authUser: any;
}

export function SalesTable({
  userId,
  sales,
  items,
  customers,
  isInitialLoading,
  isSearching,
  isPending,
  onDelete,
  onSuccess,
  authUser,
}: SalesTableProps) {
  const [saleStatuses, setSaleStatuses] = React.useState<Record<string, SaleStatus>>({});
  const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const { canWrite } = useAccountAccess();

  const getItemTitle = (itemId: string) => items.find((i) => i.id === itemId)?.title || 'Unknown Item';

  const handleEditClick = (sale: Sale) => {
    setEditingSale(sale);
    setIsEditOpen(true);
  };

  React.useEffect(() => {
    let isCancelled = false;

    async function loadSaleStatuses() {
      const nextStatuses: Record<string, SaleStatus> = {};

      await Promise.all(
        sales.map(async (sale) => {
          if (sale.paymentMethod !== 'Due' && sale.paymentMethod !== 'Split') {
            nextStatuses[sale.id] = getImmediateSaleStatus(sale);
            return;
          }

          try {
            const transaction = await getSaleTransaction(userId, sale.saleId);
            nextStatuses[sale.id] = getResolvedSaleStatus(sale, transaction);
          } catch (error) {
            console.error(`Failed to resolve live status for ${sale.saleId}:`, error);
            nextStatuses[sale.id] = getImmediateSaleStatus(sale);
          }
        })
      );

      if (!isCancelled) {
        setSaleStatuses(nextStatuses);
      }
    }

    if (sales.length === 0) {
      setSaleStatuses({});
      return () => {
        isCancelled = true;
      };
    }

    loadSaleStatuses();

    return () => {
      isCancelled = true;
    };
  }, [sales, userId]);

  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">Sale ID</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInitialLoading || isSearching ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell><Skeleton className="h-5 w-2/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : sales.length > 0 ? (
            sales.map((sale) => {
              const customer = customers.find((c) => c.id === sale.customerId) || {
                id: 'walk-in',
                name: 'Walk-in Customer',
                phone: 'N/A',
                address: 'N/A',
                openingBalance: 0,
                dueBalance: 0,
              };
              return (
                <TableRow key={sale.id}>
                  <TableCell>{format(new Date(sale.date), 'PPP')}</TableCell>
                  <TableCell className="font-mono hidden sm:table-cell">{sale.saleId}</TableCell>
                  <TableCell className="max-w-[300px]">
                    {sale.items.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span>
                          {sale.items[0].quantity}x {getItemTitle(sale.items[0].itemId)}
                        </span>
                        {sale.items.length > 1 && (
                          <SaleDetailsDialog sale={sale} items={items}>
                            <Badge variant="secondary" className="cursor-pointer hover:bg-muted">
                              +{sale.items.length - 1} more
                            </Badge>
                          </SaleDetailsDialog>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={saleStatuses[sale.id]?.variant || 'outline'}>
                        {saleStatuses[sale.id]?.label || sale.paymentMethod}
                      </Badge>
                      {saleStatuses[sale.id]?.dueAmount !== undefined && saleStatuses[sale.id].dueAmount! > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Due: ৳{saleStatuses[sale.id].dueAmount!.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">৳{sale.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(sale)} disabled={isPending || !canWrite}>
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(sale.id)} disabled={isPending || !canWrite}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No sales recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EditSaleDialog
        userId={userId}
        isOpen={isEditOpen}
        onOpenChange={setIsEditOpen}
        sale={editingSale}
        items={items}
        customers={customers}
        onSuccess={() => {
          if (onSuccess) onSuccess();
        }}
      />
    </div>
  );
}
