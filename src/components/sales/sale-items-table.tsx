'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Item } from '@/lib/types';
import { SaleItemsTableRow } from './sale-items-table-row';

interface SaleItemsTableProps {
  items: Item[];
  fields: any[];
  remove: (index: number) => void;
  appendRow: () => void;
}

export function SaleItemsTable({
  items,
  fields,
  remove,
  appendRow,
}: SaleItemsTableProps) {
  const { watch } = useFormContext();
  const watchItems = watch('items') || [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const rowStr = target.getAttribute('data-row');
    const colStr = target.getAttribute('data-col');
    if (rowStr === null || colStr === null) return;

    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);

    let nextRow = row;
    let nextCol = col;

    if (e.key === 'ArrowUp') {
      if (col === 1) return; // Allow numeric increment/decrement
      e.preventDefault();
      nextRow = Math.max(0, row - 1);
    } else if (e.key === 'ArrowDown') {
      if (col === 1) return; // Allow numeric increment/decrement
      e.preventDefault();
      nextRow = Math.min(fields.length - 1, row + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextCol = Math.max(0, col - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextCol = Math.min(1, col + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (row === fields.length - 1 && col === 1) {
        appendRow();
        setTimeout(() => {
          const newInput = target.closest('table')?.querySelector(
            `[data-row="${row + 1}"][data-col="0"]`
          ) as HTMLElement;
          if (newInput) {
            newInput.focus();
            if (newInput instanceof HTMLInputElement) newInput.select();
          }
        }, 50);
        return;
      } else if (col === 1) {
        nextRow = row + 1;
        nextCol = 0;
      } else {
        nextCol = col + 1;
      }
    } else {
      return; // Do nothing
    }

    const nextInput = target.closest('table')?.querySelector(
      `[data-row="${nextRow}"][data-col="${nextCol}"]`
    ) as HTMLElement;

    if (nextInput) {
      nextInput.focus();
      if (nextInput instanceof HTMLInputElement) {
        nextInput.select();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-slate-300 dark:border-slate-700 rounded-none overflow-x-auto bg-card shadow-sm">
        <table
          onKeyDown={handleKeyDown}
          className="w-full min-w-full text-xs text-left border-collapse border border-slate-300 dark:border-slate-700"
        >
          <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 select-none">
            <tr>
              <th className="border border-slate-300 dark:border-slate-700 p-2 w-6 text-center bg-slate-100/80 dark:bg-slate-900/80">#</th>
              <th className="border border-slate-300 dark:border-slate-700 p-2 min-w-[120px]">Medicine / Item</th>
              <th className="border border-slate-300 dark:border-slate-700 p-2 w-14 text-center">Quantity</th>
              <th className="border border-slate-300 dark:border-slate-700 p-2 w-24 text-right">Total (৳)</th>
              <th className="border border-slate-300 dark:border-slate-700 p-2 w-10 text-center bg-slate-100/80 dark:bg-slate-900/80">Action</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <SaleItemsTableRow
                key={field.id}
                index={index}
                field={field}
                items={items}
                watchItems={watchItems}
                remove={remove}
                fieldsLength={fields.length}
                appendRow={appendRow}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="outline" size="sm" onClick={appendRow}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Blank Row
        </Button>
      </div>
    </div>
  );
}
