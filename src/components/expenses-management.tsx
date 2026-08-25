'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Edit, Loader2, PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useExpensesManagement } from '@/hooks/use-expenses-management';
import { Skeleton } from './ui/skeleton';
import { AddExpenseDialog } from './expenses/add-expense-dialog';
import { ExpensesReportDialog } from './expenses/expenses-report-dialog';

interface ExpensesManagementProps {
  userId: string;
}

export default function ExpensesManagement({ userId }: ExpensesManagementProps) {
  const { canWrite } = useAccountAccess();
  const {
    expenses,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isDownloadDialogOpen,
    setIsDownloadDialogOpen,
    editingExpense,
    dateRange,
    setDateRange,
    isPending,
    handleLoadMore,
    handleAddNew,
    handleEdit,
    handleDelete,
    handleSuccess,
    handleDownloadPdf,
    handleDownloadXlsx,
  } = useExpensesManagement({ userId });

  return (
    <>
      <Card className="animate-in fade-in-50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="font-headline text-2xl">Track Expenses</CardTitle>
              <CardDescription>Record and manage all store expenses.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
              <Button onClick={handleAddNew} disabled={!canWrite} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Expense
              </Button>
              <ExpensesReportDialog
                isOpen={isDownloadDialogOpen}
                onOpenChange={setIsDownloadDialogOpen}
                dateRange={dateRange}
                setDateRange={setDateRange}
                handleDownloadPdf={handleDownloadPdf}
                handleDownloadXlsx={handleDownloadXlsx}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Expense ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInitialLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-2/4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-1/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[100px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : expenses.length > 0 ? expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-mono hidden sm:table-cell">{expense.expenseId || 'N/A'}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>{format(new Date(expense.date), 'PPP')}</TableCell>
                    <TableCell className="hidden sm:table-cell">{expense.paymentMethod}</TableCell>
                    <TableCell className="text-right">৳{expense.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(expense)} disabled={!canWrite}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(expense.id)} disabled={!canWrite || isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No expenses recorded.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Load More'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddExpenseDialog
        userId={userId}
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        editingExpense={editingExpense}
        onSuccess={handleSuccess}
      />
    </>
  );
}
