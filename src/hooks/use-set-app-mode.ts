'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { setAppMode } from '@/lib/db/user-settings';
import type { AppMode } from '@/lib/types';

interface UseSetAppModeResult {
  selectMode: (mode: AppMode) => Promise<void>;
  isPending: boolean;
}

export function useSetAppMode(onDone?: (mode: AppMode) => void): UseSetAppModeResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPending, setIsPending] = React.useState(false);

  const selectMode = async (mode: AppMode) => {
    if (!user || isPending) return;
    setIsPending(true);
    try {
      await setAppMode(user.uid, mode);
      toast({
        title: mode === 'stock' ? 'Stock Management Mode' : 'Normal Mode',
        description:
          mode === 'stock'
            ? 'Sales, expenses and money reports are hidden. You can switch anytime.'
            : 'All features are enabled. You can switch anytime.',
      });
      onDone?.(mode);
    } catch (error) {
      console.error('Failed to set app mode:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save your mode choice. Please try again.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return { selectMode, isPending };
}
