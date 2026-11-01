'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { addSalesReturn, getSalesReturnsForSale } from '@/lib/actions';
import { saleReturnPriceFactor } from '@/lib/db/sale-calculation';
import type { Customer, Item, Sale } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SaleReturnDialogProps {
  userId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  items: Item[];
  customers: Customer[];
  onSuccess: () => void;
}

interface ReturnLine {
  itemId: string;
  title: string;
  unitPrice: number;
  soldQty: number;
  alreadyReturned: number;
  returnQty: number;
}

export function SaleReturnDialog({
  userId,
  isOpen,
  onOpenChange,
  sale,
  items,
  customers,
  onSuccess,
}: SaleReturnDialogProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = React.useTransition();
  const [isLoading, setIsLoading] = React.useState(false);
  const [lines, setLines] = React.useState<ReturnLine[]>([]);
  const [restock, setRestock] = React.useState(true);

  // One row per distinct item in the sale; prior returns shrink the cap.
  const loadLines = React.useCallback(async () => {
    if (!sale) return;
    setIsLoading(true);
    try {
      const priorReturns = await getSalesReturnsForSale(userId, sale.id);
      const returnedByItem = new Map<string, number>();
      for (const ret of priorReturns) {
        // Sale-adjusted returns already shrank the sale's own lines — the
        // quantities on display are what remains, so only older returns
        // (recorded before sale-adjustment) still reduce the cap here.
        if (ret.saleAdjusted) continue;
        for (const line of ret.items) {
          returnedByItem.set(line.itemId, (returnedByItem.get(line.itemId) || 0) + (Number(line.quantity) || 0));
        }
      }

      const titleById = new Map(items.map((item) => [item.id, item.title]));
      // Credit previews use the discounted unit price the customer actually
      // paid — identical to the server's pricing for the same sale.
      const priceFactor = saleReturnPriceFactor(sale);
      const aggregated = new Map<string, ReturnLine>();
      for (const line of sale.items) {
        const existing = aggregated.get(line.itemId);
        if (existing) {
          existing.soldQty += Number(line.quantity) || 0;
        } else {
          aggregated.set(line.itemId, {
            itemId: line.itemId,
            title: titleById.get(line.itemId) || 'Unknown Item',
            unitPrice: Math.round((Number(line.price) || 0) * priceFactor * 100) / 100,
            soldQty: Number(line.quantity) || 0,
            alreadyReturned: returnedByItem.get(line.itemId) || 0,
            returnQty: 0,
          });
        }
      }
      setLines([...aggregated.values()]);
    } catch (e) {
      console.error('Failed to load prior returns:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load this sale for return.' });
    } finally {
      setIsLoading(false);
    }
  }, [sale, userId, items, toast]);

  React.useEffect(() => {
    if (isOpen && sale) {
      setRestock(true);
      loadLines();
    }
  }, [isOpen, sale, loadLines]);

  const setReturnQty = (itemId: string, raw: string) => {
    const value = raw === '' ? 0 : Number(raw);
    setLines((prev) =>
      prev.map((line) =>
        line.itemId === itemId
          ? { ...line, returnQty: Number.isFinite(value) ? Math.max(0, value) : 0 }
          : line
      )
    );
  };

  const totalCredit = lines.reduce((sum, line) => sum + line.returnQty * line.unitPrice, 0);
  const returnableFor = (line: ReturnLine) => Math.max(0, line.soldQty - line.alreadyReturned);
  const invalidLines = lines.filter((line) => line.returnQty > returnableFor(line));
  const hasReturn = lines.some((line) => line.returnQty > 0);
  const canSubmit = hasReturn && invalidLines.length === 0 && !isLoading;

  const customerName = customers.find((c) => c.id === sale?.customerId)?.name || 'the customer';

  const handleSubmit = () => {
    if (!sale) return;
    const items = lines
      .filter((line) => line.returnQty > 0)
      .map((line) => ({ itemId: line.itemId, quantity: line.returnQty, price: line.unitPrice }));

    startTransition(async () => {
      const result = await addSalesReturn(userId, {
        saleId: sale.id,
        customerId: sale.customerId,
        items,
        restock,
      });
      if (result?.success) {
        toast({
          title: 'Return Recorded',
          description: `৳${totalCredit.toFixed(2)} will be credited to ${customerName}.`,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({ variant: 'destructive', title: 'Return Failed', description: result.error || 'Could not record the return.' });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-headline">Return Items ({sale?.saleId})</DialogTitle>
          <DialogDescription>
            Enter how many units the customer returned. The value will be credited to {customerName}&apos;s account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Sold</TableHead>
                    <TableHead className="text-center">Returned</TableHead>
                    <TableHead className="text-center w-24">Return Qty</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.itemId}>
                      <TableCell className="font-medium break-words min-w-28">{line.title}</TableCell>
                      <TableCell className="text-center">{line.soldQty}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{line.alreadyReturned}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={returnableFor(line)}
                          value={line.returnQty === 0 ? '' : String(line.returnQty)}
                          placeholder="0"
                          className="h-8 w-20 text-center"
                          onChange={(e) => setReturnQty(line.itemId, e.target.value)}
                        />
                        {line.returnQty > returnableFor(line) && (
                          <p className="text-xs text-destructive mt-1">Max {returnableFor(line)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">৳{(line.returnQty * line.unitPrice).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="return-restock" checked={restock} onCheckedChange={setRestock} />
              <Label htmlFor="return-restock" className="text-sm">
                Add returned items back to stock
                <span className="block text-xs text-muted-foreground">Turn off for defective goods you will discard.</span>
              </Label>
            </div>
            <div className="font-bold text-base whitespace-nowrap">
              Total Credit: <span>৳{totalCredit.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !canSubmit}>
            {isPending ? 'Recording...' : 'Record Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
