'use client';

import * as React from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useAuth } from '@/hooks/use-auth';
import { usePurchaseSearch } from '@/hooks/use-purchase-search';
import { useToast } from '@/hooks/use-toast';
import { getCategories, getPurchasesPaginated } from '@/lib/actions';
import type { Category, Purchase } from '@/lib/types';
import { PurchasesTable } from './purchases/purchases-table';
import { PurchaseSearchInput } from './purchases/purchase-search-input';
import { RecordPurchaseDialog } from './purchases/record-purchase-dialog';
import { AddCategoryDialog } from './items/add-category-dialog';
import { DownloadPurchasesDialog } from './purchases/download-purchases-dialog';

interface PurchaseManagementProps {
  userId: string;
}

export default function PurchaseManagement({ userId }: PurchaseManagementProps) {
  const { authUser } = useAuth();
  const { canWrite } = useAccountAccess();
  const {
    searchTerm,
    setSearchTerm,
    isSearching,
    searchResults,
    isSearchActive,
    handleClearSearch,
  } = usePurchaseSearch(userId);
  const [purchases, setPurchases] = React.useState<Purchase[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const { toast } = useToast();
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [editingPurchase, setEditingPurchase] = React.useState<Purchase | null>(null);

  const loadInitialData = React.useCallback(async () => {
    setIsInitialLoading(true);
    try {
      const { purchases: newPurchases, hasMore: newHasMore } = await getPurchasesPaginated({ userId, pageLimit: 10 });
      setPurchases(newPurchases);
      setHasMore(newHasMore);
      const categoriesData = await getCategories(userId);
      setCategories(categoriesData);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load purchases.' });
    } finally {
      setIsInitialLoading(false);
    }
  }, [userId, toast]);

  React.useEffect(() => {
    if (userId) {
      loadInitialData();
    }
  }, [userId, loadInitialData]);

  const handleLoadMore = async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const lastPurchaseId = purchases[purchases.length - 1]?.id;
    try {
      const { purchases: newPurchases, hasMore: newHasMore } = await getPurchasesPaginated({
        userId,
        pageLimit: 10,
        lastVisibleId: lastPurchaseId,
      });
      setPurchases((prev) => [...prev, ...newPurchases]);
      setHasMore(newHasMore);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load more purchases.' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <>
      <Card className="w-full min-w-0 overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">Record Purchases</CardTitle>
              <CardDescription>Manage purchases of items and other assets for the store.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              <Button
                onClick={() => {
                  setEditingPurchase(null);
                  setIsDialogOpen(true);
                }}
                disabled={!canWrite}
                title={canWrite ? undefined : 'Recording purchases is disabled while the service is paused.'}
                className="w-full sm:w-auto"
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Record New Purchase
              </Button>
              <DownloadPurchasesDialog userId={userId} authUser={authUser} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <PurchaseSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            isSearching={isSearching}
            isSearchActive={isSearchActive}
            resultCount={searchResults.length}
            onClear={handleClearSearch}
          />
          <PurchasesTable
            purchases={isSearchActive ? searchResults : purchases}
            isInitialLoading={isInitialLoading && !isSearchActive}
            emptyMessage={isSearchActive ? 'No purchases match your search.' : undefined}
            onEdit={(purchase) => {
              setEditingPurchase(purchase);
              setIsDialogOpen(true);
            }}
          />
          {hasMore && !isSearchActive && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPurchaseDialog
        userId={userId}
        isOpen={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingPurchase(null);
        }}
        categories={categories}
        editingPurchase={editingPurchase}
        onSuccess={loadInitialData}
        onAddCategoryClick={() => setIsCategoryDialogOpen(true)}
      />

      <AddCategoryDialog
        userId={userId}
        isOpen={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        editingCategory={null}
        onSuccess={loadInitialData}
      />
    </>
  );
}
