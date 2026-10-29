'use client';

import * as React from 'react';
import { Pill, Store } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { StoreType } from '@/lib/types';

interface BusinessTypeOption {
  storeType: StoreType;
  icon: React.ElementType;
  title: string;
  description: string;
  bullets: string[];
}

const BUSINESS_TYPE_OPTIONS: BusinessTypeOption[] = [
  {
    storeType: 'pharmacy',
    icon: Pill,
    title: 'Pharmacy',
    description: 'Medicine sales with generic groups, batches and expiry tracking.',
    bullets: [
      'Generic (salt) groups & alternative medicine suggestions',
      'Batch, expiry and shelf management',
      'Pharmacy-tuned search and reports',
    ],
  },
  {
    storeType: 'general',
    icon: Store,
    title: 'General Business Management',
    description: 'Sales, stock and money tracking for any other kind of store.',
    bullets: [
      'Sales, purchases, expenses, dues and reports',
      'Stock, shelf and expiry management',
      'No medicine-specific fields',
    ],
  },
];

interface BusinessTypeCardsProps {
  value: StoreType | undefined;
  onSelect: (storeType: StoreType) => void;
}

export function BusinessTypeCards({ value, onSelect }: BusinessTypeCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {BUSINESS_TYPE_OPTIONS.map((option) => (
        <Card
          key={option.storeType}
          role="radio"
          aria-checked={value === option.storeType}
          tabIndex={0}
          className={
            value === option.storeType
              ? 'cursor-pointer border-primary ring-1 ring-primary'
              : 'cursor-pointer'
          }
          onClick={() => onSelect(option.storeType)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(option.storeType);
            }
          }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <option.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="font-headline text-lg">{option.title}</CardTitle>
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
        </Card>
      ))}
    </div>
  );
}
