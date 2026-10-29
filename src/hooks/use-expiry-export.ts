'use client';

import { handleDownloadPdf, handleDownloadXlsx } from '@/components/expiry/expiry-export-utils';
import type { AuthUser, Item } from '@/lib/types';

interface UseExpiryExportProps {
  authUser: AuthUser | null;
}

export function useExpiryExport({ authUser }: UseExpiryExportProps) {
  const handlePdf = (items: Item[], reportTitle: string) => {
    handleDownloadPdf(items, authUser, reportTitle);
  };

  const handleXlsx = (items: Item[], reportTitle: string) => {
    handleDownloadXlsx(items, reportTitle, authUser?.storeType);
  };

  return {
    handlePdf,
    handleXlsx,
  };
}
