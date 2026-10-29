'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminUsersTable } from '@/components/admin/admin-users-table';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { isAdminEmail } from '@/lib/admin-config';
import {
  adminListUsers,
  adminSetAccountStatus,
  adminSetUserAppMode,
  adminSetUserStoreType,
  type AdminUserRecord,
} from '@/lib/db/user-settings';
import type { AccountStatus, AppMode, StoreType } from '@/lib/types';

export default function AdminPage() {
  const { user, authUser, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<AdminUserRecord[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);

  const isAdmin = isAdminEmail(user?.email);

  const loadUsers = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      setUsers(await adminListUsers());
      setLoadError(null);
    } catch (error) {
      console.error('Failed to list users:', error);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load the user list.'
      );
      setUsers([]);
    }
  }, [isAdmin]);

  React.useEffect(() => {
    if (!authUser) return;
    if (!isAdmin) {
      router.replace('/sales');
      return;
    }
    void loadUsers();
  }, [authUser, isAdmin, loadUsers, router]);

  const updateUser = async (
    userId: string,
    action: () => Promise<void>,
    successTitle: string
  ) => {
    setBusyUserId(userId);
    try {
      await action();
      await loadUsers();
      toast({ title: successTitle });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Update failed.',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleModeChange = (userId: string, mode: AppMode) =>
    updateUser(
      userId,
      () => adminSetUserAppMode(userId, mode),
      mode === 'stock' ? 'User switched to Stock Only mode.' : 'User switched to Normal mode.'
    );

  const handleStoreTypeChange = (userId: string, storeType: StoreType) =>
    updateUser(
      userId,
      () => adminSetUserStoreType(userId, storeType),
      storeType === 'general'
        ? 'User switched to General Business.'
        : 'User switched to Pharmacy.'
    );

  const handleStatusChange = (userId: string, status: AccountStatus) =>
    updateUser(
      userId,
      () => adminSetAccountStatus(userId, status),
      status === 'disabled'
        ? 'Service paused — that account is now read-only.'
        : 'Service restored for that account.'
    );

  if (!isAdmin || !users) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-headline text-2xl font-semibold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Manage modes and service access for every Pharmora account.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => void signOut()}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Accounts</CardTitle>
            <CardDescription>
              Pausing an account puts it in read-only mode: the client can still browse,
              search and download their data, but cannot record sales, purchases or edit
              stock. Mode changes apply the next time they navigate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
                <p className="font-semibold text-destructive">
                  Failed to load accounts
                </p>
                <p className="pt-1 text-muted-foreground">
                  {loadError}
                </p>
                <p className="pt-1 text-muted-foreground">
                  This usually means the Firestore rules do not allow listing
                  the users collection for the admin yet — publish the admin
                  rules (with your admin email) in the Firebase console, then
                  reload this page.
                </p>
              </div>
            ) : users.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No accounts found.
              </p>
            ) : (
              <AdminUsersTable
                users={users}
                busyUserId={busyUserId}
                onModeChange={(userId, mode) => void handleModeChange(userId, mode)}
                onStoreTypeChange={(userId, storeType) => void handleStoreTypeChange(userId, storeType)}
                onStatusChange={(userId, status) => void handleStatusChange(userId, status)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
