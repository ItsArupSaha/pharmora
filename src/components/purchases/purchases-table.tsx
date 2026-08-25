'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAccountAccess } from '@/hooks/use-account-access';
import type { Purchase } from '@/lib/types';

interface PurchasesTableProps {
  purchases: Purchase[];
  isInitialLoading: boolean;
  onEdit?: (purchase: Purchase) => void;
  emptyMessage?: string;
}

function PurchaseItemsBreakdown({ purchase }: { purchase: Purchase }) {
  const net = purchase.totalAmount + (purchase.vatAmount || 0) - (purchase.discountAmount || 0);

  return (
    <div className="bg-muted/30 px-4 py-3">
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Batch / Expiry</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit Cost</th>
              <th className="px-3 py-2 text-right font-medium">Sell Price</th>
              <th className="px-3 py-2 text-right font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item, idx) => (
              <tr key={`${item.itemName}-${idx}`} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium">
                  {item.itemName}
                  {item.medicineGroup && (
                    <span className="block text-xs text-muted-foreground">{item.medicineGroup}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{item.categoryName}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {[item.batchNo, item.expiryDate].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">৳{item.cost.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.sellingPrice !== undefined ? `৳${item.sellingPrice.toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  ৳{(item.quantity * item.cost).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 pt-2 text-xs text-muted-foreground">
        Total ৳{purchase.totalAmount.toFixed(2)}
        {purchase.discountAmount ? ` · Discount ৳${purchase.discountAmount.toFixed(2)}` : ''}
        {purchase.vatAmount ? ` · VAT ৳${purchase.vatAmount.toFixed(2)}` : ''} · Net ৳
        {net.toFixed(2)} · Paid by {purchase.paymentMethod}
        {purchase.amountPaid !== undefined ? ` (৳${purchase.amountPaid.toFixed(2)})` : ''}
      </p>
    </div>
  );
}

export function PurchasesTable({
  purchases,
  isInitialLoading,
  onEdit,
  emptyMessage = 'No purchases recorded yet.',
}: PurchasesTableProps) {
  const { canWrite } = useAccountAccess();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <div className="border rounded-md overflow-x-auto w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">Purchase ID</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="hidden sm:table-cell">Payment</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="text-right w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isInitialLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell><Skeleton className="h-5 w-2/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-2/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
                <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                <TableCell><Skeleton className="h-5 w-3/4 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : purchases.length > 0 ? purchases.flatMap((purchase) => {
            const isExpanded = expandedId === purchase.id;
            return [
              <TableRow
                key={purchase.id}
                className="cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : purchase.id)}
              >
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {format(new Date(purchase.date), 'PPP')}
                  </span>
                </TableCell>
                <TableCell className="font-mono hidden sm:table-cell">{purchase.purchaseId}</TableCell>
                <TableCell className="font-medium max-w-[150px] truncate" title={purchase.supplier}>{purchase.supplier}</TableCell>
                <TableCell className="max-w-[200px] truncate" title={purchase.items.map(i => `${i.quantity}x ${i.itemName}`).join(', ')}>
                  {purchase.items.map(i => `${i.quantity}x ${i.itemName}`).join(', ')}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{purchase.paymentMethod}</TableCell>
                <TableCell className="text-right font-bold">৳{(purchase.totalAmount + (purchase.vatAmount || 0) - (purchase.discountAmount || 0)).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(purchase);
                      }}
                      disabled={!canWrite}
                      title="Edit purchase"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>,
              isExpanded ? (
                <TableRow key={`${purchase.id}-details`}>
                  <TableCell colSpan={7} className="p-0">
                    <PurchaseItemsBreakdown purchase={purchase} />
                  </TableCell>
                </TableRow>
              ) : null,
            ];
          }) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">{emptyMessage}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
