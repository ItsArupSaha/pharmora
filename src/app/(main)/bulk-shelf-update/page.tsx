'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useStoreType } from '@/hooks/use-store-type';
import { getItems, bulkUpdateItemLocationByCompany } from '@/lib/actions';
import type { Item } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { BulkShelfUpdateForm } from '@/components/bulk-shelf-update/bulk-shelf-update-form';
import { BulkShelfUpdatePreview } from '@/components/bulk-shelf-update/bulk-shelf-update-preview';

export default function BulkShelfUpdatePage() {
  const { user } = useAuth();
  const { isPharmacy } = useStoreType();
  const { toast } = useToast();
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [selectedCompany, setSelectedCompany] = React.useState('');
  const [newLocation, setNewLocation] = React.useState('');

  const loadData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const allItems = await getItems(user.uid);
      setItems(allItems);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load inventory items.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique sorted list of pharmaceutical companies
  const companies = React.useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.company && item.company.trim()) {
        set.add(item.company.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [items]);

  // Filter medicines belonging to the currently selected company
  const filteredItems = React.useMemo(() => {
    if (!selectedCompany) return [];
    return items.filter(
      (item) =>
        item.company &&
        item.company.trim().toLowerCase() === selectedCompany.trim().toLowerCase()
    );
  }, [selectedCompany, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedCompany) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a company.',
      });
      return;
    }
    if (!newLocation.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please specify the new shelf or row location.',
      });
      return;
    }

    try {
      setUpdating(true);
      const result = await bulkUpdateItemLocationByCompany(
        user.uid,
        selectedCompany,
        newLocation.trim()
      );

      if (result?.success) {
        toast({
          title: 'Location Updated',
          description: `Successfully moved ${result.updatedCount} ${isPharmacy ? 'medicine' : 'item'}(s) from ${selectedCompany} to ${newLocation.trim()}.`,
        });
        setNewLocation('');
        // Reload items list from DB
        await loadData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result?.error || 'Failed to update location.',
        });
      }
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred.',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 w-full max-w-5xl mx-auto">
      <div>
        <h1 className="font-headline text-3xl font-bold">Bulk Shelf Manager</h1>
        <p className="text-sm text-muted-foreground">
          Shift all {isPharmacy ? 'medicines' : 'items'} from a specific company to another shelf or
          storage row in one click.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <BulkShelfUpdateForm
          companies={companies}
          selectedCompany={selectedCompany}
          onCompanyChange={setSelectedCompany}
          newLocation={newLocation}
          onLocationChange={setNewLocation}
          onSubmit={handleSubmit}
          updating={updating}
          itemCount={filteredItems.length}
        />

        <BulkShelfUpdatePreview
          selectedCompany={selectedCompany}
          filteredItems={filteredItems}
          newLocation={newLocation}
        />
      </div>
    </div>
  );
}
