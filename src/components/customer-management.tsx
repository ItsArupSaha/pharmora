'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, PlusCircle, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AddCustomerDialog } from './customers/add-customer-dialog';
import { CustomersTable } from './customers/customers-table';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useCustomerManagement } from '@/hooks/use-customer-management';

interface CustomerManagementProps {
  userId: string;
}

export default function CustomerManagement({ userId }: CustomerManagementProps) {
  const { canWrite } = useAccountAccess();
  const {
    customers,
    isInitialLoading,
    isLoadingMore,
    isDialogOpen,
    setIsDialogOpen,
    editingCustomer,
    searchQuery,
    isSearching,
    form,
    handleEdit,
    handleAddNew,
    handleDelete,
    onSubmit,
    handleDownloadPdf,
    handleDownloadXlsx,
    showLoadMore,
    handleSearchChange,
    clearSearch,
    handleLoadMore,
    isPending
  } = useCustomerManagement(userId);

  return (
    <Card className="animate-in fade-in-50">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-2xl">Customer List</CardTitle>
            <CardDescription>Manage your customer information and balances.</CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button onClick={handleAddNew} disabled={!canWrite}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer
            </Button>
            {/* Search Input */}
            <div className="relative w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10 pr-10 min-w-[180px] max-w-[220px]"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                <FileText className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadXlsx}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Status */}
        {searchQuery.trim() && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isSearching
                  ? 'Searching...'
                  : `Found ${customers.length} customer${customers.length !== 1 ? 's' : ''} matching "${searchQuery}"`}
              </span>
              <Button variant="ghost" size="sm" onClick={clearSearch}>
                Clear Search
              </Button>
            </div>
          </div>
        )}

        <CustomersTable
          customers={customers}
          isLoading={isInitialLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isPending={isPending}
          searchQuery={searchQuery}
        />

        {showLoadMore && (
          <div className="flex justify-center mt-4">
            <Button onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}
      </CardContent>

      <AddCustomerDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        editingCustomer={editingCustomer}
      />
    </Card>
  );
}
