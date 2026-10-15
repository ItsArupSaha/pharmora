'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddItemsDialog } from './items/add-items-dialog';
import { AddCategoryDialog } from './items/add-category-dialog';
import { ItemsTable } from './items/items-table';
import { useItemManagement } from '@/hooks/use-item-management';
import { ItemManagementHeader } from './items/item-management-header';
import { ItemManagementControls } from './items/item-management-controls';

interface ItemManagementProps {
  userId: string;
}

export default function ItemManagement({ userId }: ItemManagementProps) {
  const {
    allItems,
    categories,
    companies,
    isInitialLoading,
    isItemDialogOpen,
    setIsItemDialogOpen,
    isCategoryDialogOpen,
    setIsCategoryDialogOpen,
    isStockDialogOpen,
    setIsStockDialogOpen,
    editingItem,
    editingCategory,
    closingStockDate,
    setClosingStockDate,
    closingStockCompanyFilter,
    setClosingStockCompanyFilter,
    isCalculating,
    isPending,
    searchQuery,
    setSearchQuery,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    selectedCompanyFilter,
    setSelectedCompanyFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    sortBy,
    setSortBy,
    setVisibleCount,
    loadData,
    handleEditItem,
    handleAddNewItem,
    handleDeleteItem,
    handleDownloadInventoryPdf,
    handleDownloadInventoryXlsx,
    handleDownloadClosingStockPdf,
    handleDownloadClosingStockXlsx,
    expiringAndExpiredMedicines,
    filteredAndSortedItems,
    displayedItems,
    hasMore,
    handleLoadMore,
  } = useItemManagement(userId);

  return (
    <Card className="animate-in fade-in-50">
      <ItemManagementHeader
        userId={userId}
        isStockDialogOpen={isStockDialogOpen}
        setIsStockDialogOpen={setIsStockDialogOpen}
        closingStockDate={closingStockDate}
        setClosingStockDate={setClosingStockDate}
        handleDownloadClosingStockPdf={handleDownloadClosingStockPdf}
        handleDownloadClosingStockXlsx={handleDownloadClosingStockXlsx}
        isCalculating={isCalculating}
        companies={companies}
        selectedCompany={closingStockCompanyFilter}
        onCompanyChange={setClosingStockCompanyFilter}
        onDownloadInventoryPdf={handleDownloadInventoryPdf}
        onDownloadInventoryXlsx={handleDownloadInventoryXlsx}
        hasItemsToDownload={allItems.length > 0}
        handleAddNewItem={handleAddNewItem}
        loadData={loadData}
      />
      <CardContent>
        {/* Expiry Warning Banner */}
        {expiringAndExpiredMedicines.length > 0 && (
          <div className="mb-6 p-4 border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 rounded-lg flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-amber-800 dark:text-amber-400">
                Medicine Expiry Alert
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                There are {expiringAndExpiredMedicines.length} medicine(s) expired or expiring within
                30 days.
              </p>
              <Button
                variant="link"
                className="p-0 h-auto text-sm text-amber-800 dark:text-amber-400 font-semibold underline hover:text-amber-900"
                onClick={() => {
                  setSelectedStatusFilter('expiringSoon');
                  setSelectedCategoryFilter('all');
                }}
              >
                Filter items to view them
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Current Inventory</h3>
        </div>

        <ItemManagementControls
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setVisibleCount={setVisibleCount}
          selectedCategoryFilter={selectedCategoryFilter}
          setSelectedCategoryFilter={setSelectedCategoryFilter}
          categories={categories}
          companies={companies}
          selectedCompanyFilter={selectedCompanyFilter}
          setSelectedCompanyFilter={setSelectedCompanyFilter}
          selectedStatusFilter={selectedStatusFilter}
          setSelectedStatusFilter={setSelectedStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
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
        editingCategory={editingCategory}
        onSuccess={loadData}
      />
    </Card>
  );
}
