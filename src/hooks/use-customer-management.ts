'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { addCustomer, deleteCustomer, updateCustomer } from '@/lib/actions';
import type { Customer } from '@/lib/types';
import { customerSchema, type CustomerFormValues } from '@/components/customers/schema';
import { exportCustomersToPdf, exportCustomersToXlsx } from '@/components/customers/customers-export-utils';
import { useCustomerSearchPagination } from './use-customer-search-pagination';

export function useCustomerManagement(userId: string) {
  const { authUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);
  const [isPending, startTransition] = React.useTransition();

  // Call the search and pagination lifecycle hook
  const searchPaginate = useCustomerSearchPagination({ userId });

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      contactName: '',
      phone: '',
      whatsapp: '',
      address: '',
      openingBalance: 0,
    },
  });

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset(customer);
    setIsDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingCustomer(null);
    form.reset({ name: '', contactName: '', phone: '', whatsapp: '', address: '', openingBalance: 0 });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCustomer(userId, id);
        if (searchPaginate.searchQuery.trim()) {
          searchPaginate.performSearch(searchPaginate.searchQuery);
        } else {
          await searchPaginate.loadInitialCustomers();
        }
        await searchPaginate.loadAllCustomers();
        toast({ title: 'Customer Deleted', description: 'The customer has been removed.' });
      } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete customer.' });
      }
    });
  };

  const onSubmit = (data: CustomerFormValues) => {
    // An empty contact field is stored as absent, not as ''.
    const payload = {
      ...data,
      contactName: data.contactName?.trim() || undefined,
    };
    startTransition(async () => {
      try {
        if (editingCustomer) {
          await updateCustomer(userId, editingCustomer.id, payload);
          toast({ title: 'Customer Updated', description: 'The customer details have been saved.' });
        } else {
          await addCustomer(userId, payload);
          toast({ title: 'Customer Added', description: 'The new customer has been added.' });
        }
        if (searchPaginate.searchQuery.trim()) {
          searchPaginate.performSearch(searchPaginate.searchQuery);
        } else {
          await searchPaginate.loadInitialCustomers();
        }
        await searchPaginate.loadAllCustomers();
        setIsDialogOpen(false);
        setEditingCustomer(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not save customer.';
        toast({ variant: 'destructive', title: 'Duplicate Customer', description: message });
      }
    });
  };

  const handleDownloadPdf = () => {
    exportCustomersToPdf(searchPaginate.allCustomers, authUser);
  };

  const handleDownloadXlsx = () => {
    exportCustomersToXlsx(searchPaginate.allCustomers);
  };

  const showLoadMore = searchPaginate.hasMore && searchPaginate.customers.length > 0;

  return {
    customers: searchPaginate.customers,
    hasMore: searchPaginate.hasMore,
    isInitialLoading: searchPaginate.isInitialLoading,
    isLoadingMore: searchPaginate.isLoadingMore,
    isDialogOpen,
    setIsDialogOpen,
    editingCustomer,
    searchQuery: searchPaginate.searchQuery,
    isSearching: searchPaginate.isSearching,
    form,
    handleEdit,
    handleAddNew,
    handleDelete,
    onSubmit,
    handleDownloadPdf,
    handleDownloadXlsx,
    showLoadMore,
    handleSearchChange: searchPaginate.handleSearchChange,
    clearSearch: searchPaginate.clearSearch,
    handleLoadMore: searchPaginate.handleLoadMore,
    isPending,
  };
}
