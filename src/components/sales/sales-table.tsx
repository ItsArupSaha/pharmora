'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { Sale, Item, Customer } from '@/lib/types';
import { SaleDetailsDialog } from '../sale-details-dialog';
import { EditSaleDialog } from './edit-sale-dialog';

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
  const [editingSale, setEditingSale] = React.useState<Sale | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const { canWrite } = useAccountAccess();

  const handleEditClick = (sale: Sale) => {
    setEditingSale(sale);
    setIsEditOpen(true);
  };

  return (
    <div className="border rounded-md overflow-x-auto w-full [&_td]:p-1.5 [&_th]:p-1.5 sm:[&_td]:px-2 sm:[&_th]:px-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right w-12 sm:w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInitialLoading || isSearching ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell><Skeleton className="h-5 w-2/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : sales.length > 0 ? (
            sales.map((sale) => {
              return (
                <TableRow key={sale.id}>
                  <TableCell className="text-xs whitespace-nowrap" title={format(new Date(sale.date), 'PPP')}>
                    {format(new Date(sale.date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {sale.items.length > 0 && (
                      <SaleDetailsDialog sale={sale} items={items}>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-xs font-normal underline-offset-2 hover:underline"
                        >
                          {sale.items.length} {sale.items.length === 1 ? 'item' : 'items'}
                        </Button>
                      </SaleDetailsDialog>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs sm:text-sm font-medium">৳{sale.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-9 sm:w-9" onClick={() => handleEditClick(sale)} disabled={isPending || !canWrite}>
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-9 sm:w-9" onClick={() => onDelete(sale.id)} disabled={isPending || !canWrite}>
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
