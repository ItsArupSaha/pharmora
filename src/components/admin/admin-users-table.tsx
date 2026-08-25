'use client';

import * as React from 'react';
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminUserRecord } from '@/lib/db/user-settings';
import type { AccountStatus, AppMode } from '@/lib/types';

interface AdminUsersTableProps {
  users: AdminUserRecord[];
  busyUserId: string | null;
  onModeChange: (userId: string, mode: AppMode) => void;
  onStatusChange: (userId: string, status: AccountStatus) => void;
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== 'object' || !('toDate' in value)) return '—';
  try {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toLocaleDateString();
  } catch {
    return '—';
  }
}

export function AdminUsersTable({
  users,
  busyUserId,
  onModeChange,
  onStatusChange,
}: AdminUsersTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Pharmacy</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Onboarded</TableHead>
            <TableHead>Since</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isBusy = busyUserId === user.uid;
            const isDisabled = user.accountStatus === 'disabled';
            return (
              <TableRow key={user.uid}>
                <TableCell>
                  <div className="font-medium">{user.displayName || 'Unnamed'}</div>
                  <div className="text-xs text-muted-foreground">{user.email || '—'}</div>
                </TableCell>
                <TableCell>{user.companyName || '—'}</TableCell>
                <TableCell>
                  <Select
                    value={user.appMode ?? 'normal'}
                    onValueChange={(value) => onModeChange(user.uid, value as AppMode)}
                    disabled={isBusy}
                  >
                    <SelectTrigger className="h-8 w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="stock">Stock Only</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={isDisabled ? 'destructive' : 'default'}>
                      {isDisabled ? 'Paused' : 'Active'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() =>
                        onStatusChange(user.uid, isDisabled ? 'active' : 'disabled')
                      }
                    >
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isDisabled ? (
                        <PlayCircle className="h-4 w-4" />
                      ) : (
                        <PauseCircle className="h-4 w-4" />
                      )}
                      {isDisabled ? 'Activate' : 'Pause'}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{user.onboardingComplete ? 'Yes' : 'No'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
