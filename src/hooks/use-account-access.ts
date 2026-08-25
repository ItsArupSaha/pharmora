'use client';

import { useAuth } from '@/hooks/use-auth';

// Read-only means the admin paused the service: the user can browse, search
// and export, but every write action must be disabled.
export function useAccountAccess(): { isReadOnly: boolean; canWrite: boolean } {
  const { authUser } = useAuth();
  const isReadOnly = authUser?.accountStatus === 'disabled';
  return { isReadOnly, canWrite: !isReadOnly };
}
