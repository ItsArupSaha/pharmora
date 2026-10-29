'use client';

import * as React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AddItemsDialog } from './items/add-items-dialog';
import { AddCategoryDialog } from './items/add-category-dialog';
import { ItemsTable } from './items/items-table';
import { ExpiryFiltersHeader } from './expiry/expiry-filters-header';
import { useExpiryAlerts } from '@/hooks/use-expiry-alerts';
import { useStoreType } from '@/hooks/use-store-type';

interface ExpiryAlertsProps {
  userId: string;
}

export default function ExpiryAlerts({ userId }: ExpiryAlertsProps) {
  const {
    categories,
    companies,
    isInitialLoading,
    isItemDialogOpen,
    setIsItemDialogOpen,
    isCategoryDialogOpen,
    setIsCategoryDialogOpen,
    editingItem,
    searchQuery,
    setSearchQuery,
    selectedStatusFilter,
    setSelectedStatusFilter,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
    sortBy,
    setSortBy,
    setVisibleCount,
    isPending,
    displayedItems,
    hasMore,
    loadData,
    handleEditItem,
    handleDeleteItem,
    handleLoadMore,
    handlePdf,
    handleXlsx,
    filteredAndSortedItems,
  } = useExpiryAlerts({ userId });
  const { isPharmacy } = useStoreType();

  return (
    <Card className="animate-in fade-in-50">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <CardTitle className="font-headline text-2xl">Expiry Alerts</CardTitle>
            <CardDescription>
              View, manage, and download lists of expired {isPharmacy ? 'medicines or items' : 'items'}{' '}
              expiring within 90 days.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePdf}
              disabled={filteredAndSortedItems.length === 0}
              className="w-full sm:w-auto"
            >
              <FileText className="mr-2 h-4 w-4" /> Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleXlsx}
              disabled={filteredAndSortedItems.length === 0}
              className="w-full sm:w-auto"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Controls Header */}
        <ExpiryFiltersHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedStatusFilter={selectedStatusFilter}
          setSelectedStatusFilter={setSelectedStatusFilter}
          companies={companies}
          selectedCompanyFilter={selectedCompanyFilter}
          setSelectedCompanyFilter={setSelectedCompanyFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          setVisibleCount={setVisibleCount}
        />

        <ItemsTable
          items={displayedItems}
          isInitialLoading={isInitialLoading}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          isPending={isPending}
        />

        {hasMore && (
          <div className="flex justify-center mt-4">
            <Button onClick={handleLoadMore}>Load More</Button>
          </div>
        )}
      </CardContent>

      <AddItemsDialog
        userId={userId}
        isOpen={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        editingItem={editingItem}
        categories={categories}
        onSuccess={loadData}
      />

      <AddCategoryDialog
        userId={userId}
        isOpen={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        editingCategory={null}
        onSuccess={loadData}
      />
    </Card>
  );
}
