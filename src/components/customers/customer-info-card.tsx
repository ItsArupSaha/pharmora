'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MapPin, User } from 'lucide-react';

interface CustomerInfoCardProps {
  customer: {
    name: string;
    contactName?: string;
    phone: string;
    whatsapp?: string;
    address: string;
    dueBalance: number;
  };
}

export function CustomerInfoCard({ customer }: CustomerInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="font-headline text-3xl">{customer.name}</CardTitle>
            </div>
            {customer.contactName && (
              <p className="text-sm text-muted-foreground -mt-2">
                Contact: {customer.contactName}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{customer.phone}</span>
                {customer.whatsapp && (
                  <>
                    <span>•</span>
                    <span>WhatsApp: {customer.whatsapp}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{customer.address}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p
                className={`font-bold text-3xl ${
                  customer.dueBalance > 0
                    ? 'text-destructive'
                    : customer.dueBalance < 0
                    ? 'text-green-600'
                    : 'text-primary'
                }`}
              >
                ${customer.dueBalance.toFixed(2)}
              </p>
              <div className="flex gap-2 justify-end">
                {customer.dueBalance > 0 && <Badge variant="destructive">Owes Money</Badge>}
                {customer.dueBalance < 0 && (
                  <Badge variant="default" className="bg-green-600">
                    Credit Balance
                  </Badge>
                )}
                {customer.dueBalance === 0 && <Badge variant="secondary">Settled</Badge>}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
