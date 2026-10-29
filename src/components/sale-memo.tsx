'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Download, PlusCircle } from 'lucide-react';
import { Button } from './ui/button';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { getSaleTransaction } from '@/lib/actions';
import type { AuthUser, Customer, Item, Sale } from '@/lib/types';
import { generateSaleMemoPdf } from './sale-memo-pdf';

interface SaleMemoProps {
  sale: Sale;
  customer: Customer;
  items: Item[];
  user: AuthUser;
  onNewSale: () => void;
}

export function SaleMemo({ sale, customer, items, user, onNewSale }: SaleMemoProps) {
  const [currentDue, setCurrentDue] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const getItemTitle = (itemId: string) => items.find((i) => i.id === itemId)?.title || 'Unknown Item';

  React.useEffect(() => {
    const fetchStatus = async () => {
      if (sale.paymentMethod !== 'Due' && sale.paymentMethod !== 'Split') return;
      try {
        const transaction = await getSaleTransaction(user.uid, sale.saleId);
        if (transaction) {
          setCurrentDue(transaction.status === 'Paid' ? 0 : transaction.amount);
          setStatus(transaction.status);
        }
      } catch (e) {
        console.error('Failed to fetch sale status', e);
      }
    };
    fetchStatus();
  }, [sale.saleId, sale.paymentMethod, user.uid]);

  const handleDownload = () => {
    generateSaleMemoPdf({ sale, customer, items, user });
  };

  const displayDueAmount =
    status === 'Paid' ? 0 : currentDue !== null ? currentDue : sale.total - (sale.amountPaid || 0);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-headline text-2xl">Sale Confirmed!</DialogTitle>
        <DialogDescription>
          The sale has been recorded successfully. You can now download the memo.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto p-1 pr-2">
        <div className="text-sm p-4 border rounded-lg">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-semibold mb-1">Billed To</h3>
              <p>{customer.name}</p>
              {customer.contactName && <p className="text-muted-foreground">Attn: {customer.contactName}</p>}
              <p>{customer.address}</p>
            </div>
            <div className="text-right">
              <p>
                <span className="font-semibold">Invoice #:</span> {sale.saleId}
              </p>
              <p>
                <span className="font-semibold">Date:</span> {format(new Date(sale.date), 'PPP')}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{' '}
                <span className={status === 'Paid' ? 'text-green-600 font-bold' : ''}>
                  {status === 'Paid' ? 'PAID' : sale.paymentMethod}
                </span>
              </p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{getItemTitle(item.itemId)}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">TK {(item.quantity * item.price).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-4" />

          <div className="space-y-2 text-sm pr-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>TK {sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.extraSales && sale.extraSales > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Extra / Service Sales</span>
                <span>TK {sale.extraSales.toFixed(2)}</span>
              </div>
            ) : null}
            {(() => {
              const diff = sale.subtotal + (sale.extraSales || 0) - sale.total;
              return (
                <div className="flex justify-between text-green-600">
                  <span>
                    {diff >= 0
                      ? `Discount${sale.discountType === 'percentage' ? ` (${sale.discountValue}%)` : ''}`
                      : 'Extra Profit'}
                  </span>
                  <span>
                    {diff >= 0
                      ? `-TK ${diff.toFixed(2)}`
                      : `+TK ${(sale.total - (sale.subtotal + (sale.extraSales || 0))).toFixed(2)}`}
                  </span>
                </div>
              );
            })()}
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Grand Total</span>
              <span>TK {sale.total.toFixed(2)}</span>
            </div>

            {(sale.paymentMethod === 'Due' || sale.paymentMethod === 'Split') && (
              <div className="flex justify-between font-bold pt-2">
                <span className={status === 'Paid' ? 'text-green-600' : 'text-destructive'}>
                  Remaining Due
                </span>
                <span className={status === 'Paid' ? 'text-green-600' : 'text-destructive'}>
                  TK {displayDueAmount.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-4">
        <Button variant="outline" onClick={onNewSale}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Sale
        </Button>
        <Button onClick={handleDownload}>
          <Download className="mr-2 h-4 w-4" />
          Download Memo
        </Button>
      </DialogFooter>
    </>
  );
}
