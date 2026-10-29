'use client';

import { useAuth } from '@/hooks/use-auth';
import type { StoreType } from '@/lib/types';

export interface StoreTypeFlags {
  storeType: StoreType;
  /** True for pharmacy businesses (the default for accounts created before storeType existed). */
  isPharmacy: boolean;
  /** True for general businesses — pharmacy-specific fields and copy are hidden. */
  isGeneral: boolean;
}

export function useStoreType(): StoreTypeFlags {
  const storeType = useAuth().authUser?.storeType ?? 'pharmacy';
  return {
    storeType,
    isPharmacy: storeType === 'pharmacy',
    isGeneral: storeType === 'general',
  };
}
