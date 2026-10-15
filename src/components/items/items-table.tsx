'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Edit, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useAuth } from '@/hooks/use-auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Item } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ItemsTableProps {
  items: Item[];
  isInitialLoading: boolean;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}

export function ItemsTable({
  items,
  isInitialLoading,
  onEdit,
  onDelete,
  isPending,
}: ItemsTableProps) {
  const { authUser } = useAuth();
  const { canWrite } = useAccountAccess();
  // Stock-management mode hides category, generic-group, shelf and money
  // columns; the data itself is unchanged.
  const isStockMode = authUser?.appMode === 'stock';
  const showGeneric = !isStockMode;
  const showPrices = !isStockMode;
  const showCategory = !isStockMode;
  const showLocation = !isStockMode;

  // Always-visible: title, company, expiry, stock, actions.
  const columnCount =
    5 +
    (showCategory ? 1 : 0) +
    (showGeneric ? 1 : 0) +
    (showLocation ? 1 : 0) +
    (showPrices ? 2 : 0);

  // Pharmacy column labels
  const titleHeader = 'Medicine Name';
  const detailHeader = 'Group (Generic)';
  const companyHeader = 'Manufacturer';
  const locationHeader = 'Shelf / Row';

  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{titleHeader}</TableHead>
            {showCategory && <TableHead className="hidden sm:table-cell">Category</TableHead>}
            {showGeneric && <TableHead className="hidden md:table-cell">{detailHeader}</TableHead>}
            <TableHead className="hidden md:table-cell">{companyHeader}</TableHead>
            <TableHead className="hidden sm:table-cell">Expiry Date</TableHead>
            {showLocation && <TableHead className="hidden lg:table-cell">{locationHeader}</TableHead>}
            {showPrices && <TableHead className="text-right hidden sm:table-cell">Prod. Cost</TableHead>}
            {showPrices && <TableHead className="text-right">Selling Price</TableHead>}
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInitialLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className={cn('h-5', j === 0 ? 'w-3/4' : 'w-2/4')} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : items.length > 0 ? (
            items.map((item) => {
              const now = new Date();
              const oneMonthFromNow = new Date();
              oneMonthFromNow.setDate(now.getDate() + 30);
              const isExpired = item.expiryDate && new Date(item.expiryDate) <= now;
              const isExpiringSoon = item.expiryDate && !isExpired && new Date(item.expiryDate) <= oneMonthFromNow;

              return (
                <TableRow key={item.id} className={cn(
                  isExpired ? 'bg-destructive/10 hover:bg-destructive/15' : isExpiringSoon ? 'bg-amber-500/10 hover:bg-amber-500/15' : ''
                )}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      {isExpired && <span className="text-[10px] text-destructive font-bold uppercase tracking-wider mt-0.5">Expired</span>}
                      {isExpiringSoon && <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-0.5">Expiring Soon</span>}
                    </div>
                  </TableCell>
                  {showCategory && (
                    <TableCell className="hidden sm:table-cell">{item.categoryName}</TableCell>
                  )}
                  {showGeneric && (
                    <TableCell className="hidden md:table-cell">
                      {item.medicineGroup || '-'}
                    </TableCell>
                  )}
                  <TableCell className="hidden md:table-cell">{item.company || '-'}</TableCell>
                  <TableCell className={cn(
                    "hidden sm:table-cell",
                    isExpired ? 'text-destructive font-semibold' : isExpiringSoon ? 'text-amber-600 font-semibold' : ''
                  )}>
                    {item.expiryDate ? format(new Date(item.expiryDate), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  {showLocation && (
                    <TableCell className="hidden lg:table-cell">{item.location || '-'}</TableCell>
                  )}
                  {showPrices && <TableCell className="text-right hidden sm:table-cell">৳{item.productionPrice.toFixed(2)}</TableCell>}
                  {showPrices && <TableCell className="text-right">৳{item.sellingPrice.toFixed(2)}</TableCell>}
                  <TableCell className="text-right">{item.stock}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item)} disabled={!canWrite}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} disabled={!canWrite || isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                No items found matching your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
