'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesTable } from './sales/sales-table';
import { RecordSaleForm } from './sales/record-sale-form';
import { SalesDirectorySearch } from './sales/sales-directory-search';
import { SalesHistoryFilters } from './sales/sales-history-filters';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useSalesManagement } from '@/hooks/use-sales-management';

interface SalesManagementProps {
  userId: string;
}

export default function SalesManagement({ userId }: SalesManagementProps) {
  const [activeTab, setActiveTab] = React.useState<'checkout' | 'history'>('checkout');
  const { canWrite } = useAccountAccess();
  const {
    authUser,
    items,
    customers,
    isDialogOpen,
    setIsDialogOpen,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    dateRange,
    setDateRange,
    isPending,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    searchTerm,
    setSearchTerm,
    isSearching,
    displaySales,
    loadInitialData,
    handleSaleCreated,
    handleLoadMore,
    handleSearch,
    handleClearSearch,
    handleDelete,
    handleDownloadPdf,
    handleDownloadXlsx,
    handleDownloadItemsPdf,
    handleDownloadItemsXlsx,
  } = useSalesManagement({ userId });

  const sellableItems = React.useMemo(() => {
    return items.filter(item => {
      const catName = (item.categoryName || '').toLowerCase();
      return catName !== 'assets' && catName !== 'surgicals';
    });
  }, [items]);

  return (
    <div className="space-y-6 animate-in fade-in-50 w-full max-w-none">
      {/* Tab toggle buttons */}
      <div className="flex gap-2 border-b pb-4">
        <Button
          variant={activeTab === 'checkout' ? 'default' : 'outline'}
          onClick={() => setActiveTab('checkout')}
          disabled={!canWrite}
          title={canWrite ? undefined : 'Recording sales is disabled while the service is paused.'}
          className="flex-1 sm:flex-initial"
        >
          Record Sale
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'outline'}
          onClick={() => setActiveTab('history')}
          className="flex-1 sm:flex-initial"
        >
          Sales History
        </Button>
      </div>

      {activeTab === 'checkout' && canWrite ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start w-full">
          <Card className="xl:col-span-2 w-full min-w-0">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">POS Receipt Checkout</CardTitle>
              <CardDescription>Select items, adjust prices, and confirm transactions instantly.</CardDescription>
            </CardHeader>
            <CardContent>
              <RecordSaleForm
                userId={userId}
                items={items}
                customers={customers}
                onSuccess={handleSaleCreated}
                authUser={authUser}
              />
            </CardContent>
          </Card>

          {/* Directory Deep Search Panel */}
          <SalesDirectorySearch items={sellableItems} />
        </div>
      ) : (
        <Card className="w-full">
          <CardHeader>
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
              <div>
                <CardTitle className="font-headline text-2xl">Sales History & Reports</CardTitle>
                <CardDescription>Search past invoices, reprint receipts, and download monthly statements.</CardDescription>
              </div>
              <SalesHistoryFilters
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                isSearching={isSearching}
                handleSearch={handleSearch}
                handleClearSearch={handleClearSearch}
                isDownloadDialogOpen={isDownloadDialogOpen}
                setIsDownloadDialogOpen={setIsDownloadDialogOpen}
                dateRange={dateRange}
                setDateRange={setDateRange}
                handleDownloadPdf={handleDownloadPdf}
                handleDownloadXlsx={handleDownloadXlsx}
                handleDownloadItemsPdf={handleDownloadItemsPdf}
                handleDownloadItemsXlsx={handleDownloadItemsXlsx}
              />
            </div>
          </CardHeader>
          <CardContent>
            <SalesTable
              userId={userId}
              sales={displaySales}
              items={items}
              customers={customers}
              isInitialLoading={isInitialLoading}
              isSearching={isSearching}
              isPending={isPending}
              onDelete={handleDelete}
              onSuccess={loadInitialData}
              authUser={authUser}
            />
            {hasMore && !searchTerm && (
              <div className="flex justify-center mt-4">
                <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Load More'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
