'use client';

import * as React from 'react';
import { Boxes, Store, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { AppMode } from '@/lib/types';

interface ModeOption {
  mode: AppMode;
  icon: React.ElementType;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'normal',
    icon: Store,
    title: 'Normal Mode',
    description: 'Complete pharmacy management with sales, stock and money tracking.',
    bullets: [
      'Sell, purchases, expenses',
      'Customer dues & supplier payables',
      'Reports and business overview',
      'Full stock and expiry management',
    ],
    cta: 'Continue with Normal Mode',
  },
  {
    mode: 'stock',
    icon: Boxes,
    title: 'Stock Management Only',
    description: 'Track medicines, batches, expiry and shelf — without money features.',
    bullets: [
      'Medicines / stocks & purchases',
      'Expiry alerts & stock warnings',
      'Shelf update (bulk)',
      'No selling, expenses, reports or dues',
    ],
    cta: 'Continue with Stock Mode',
  },
];

interface ModeSelectionCardsProps {
  currentMode?: AppMode;
  isPending: boolean;
  onSelect: (mode: AppMode) => void;
}

export function ModeSelectionCards({ currentMode, isPending, onSelect }: ModeSelectionCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {MODE_OPTIONS.map((option) => (
        <Card
          key={option.mode}
          className={
            currentMode === option.mode ? 'border-primary ring-1 ring-primary' : undefined
          }
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <option.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-headline text-lg">{option.title}</CardTitle>
                {currentMode === option.mode && (
                  <span className="text-xs font-semibold text-primary">Current mode</span>
                )}
              </div>
            </div>
            <CardDescription className="pt-2">{option.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {option.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  {bullet}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => onSelect(option.mode)}
              disabled={isPending || currentMode === option.mode}
            >
              {isPending && currentMode !== option.mode ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {currentMode === option.mode ? 'Active' : option.cta}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
