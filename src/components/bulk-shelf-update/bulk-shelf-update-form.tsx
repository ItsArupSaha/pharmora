'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FolderSync, MapPin } from 'lucide-react';
import { useAccountAccess } from '@/hooks/use-account-access';

interface BulkShelfUpdateFormProps {
  companies: string[];
  selectedCompany: string;
  onCompanyChange: (company: string) => void;
  newLocation: string;
  onLocationChange: (location: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  updating: boolean;
  itemCount: number;
}

export function BulkShelfUpdateForm({
  companies,
  selectedCompany,
  onCompanyChange,
  newLocation,
  onLocationChange,
  onSubmit,
  updating,
  itemCount,
}: BulkShelfUpdateFormProps) {
  const { canWrite } = useAccountAccess();
  return (
    <Card className="md:col-span-1 border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Update Location</CardTitle>
        <CardDescription>Select manufacturer company and set the new location.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company / Manufacturer</Label>
            <select
              id="company"
              className="w-full h-10 px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedCompany}
              onChange={(e) => onCompanyChange(e.target.value)}
            >
              <option value="">Select Company</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">New Shelf / Row Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                placeholder="e.g. Shelf A-3, Row 2"
                className="pl-9 h-10"
                value={newLocation}
                onChange={(e) => onLocationChange(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updating || itemCount === 0 || !canWrite}
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Relocating...
              </>
            ) : (
              <>
                <FolderSync className="mr-2 h-4 w-4" />
                Relocate {itemCount} Item(s)
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
