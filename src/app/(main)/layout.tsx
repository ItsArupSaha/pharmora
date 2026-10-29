'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PauseCircle } from 'lucide-react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAccountAccess } from '@/hooks/use-account-access';
import { useAuth } from '@/hooks/use-auth';
import { useStoreType } from '@/hooks/use-store-type';
import { itemsNavLabel } from '@/components/layout/sidebar-navigation';
import { getLandingPath, isRouteAllowed } from '@/lib/features';

// Dynamic Page Title resolution based on current path
function usePageTitle(pathname: string, isPharmacy: boolean): string {
  return React.useMemo(() => {
    const matched = [
      { href: '/sales', label: 'Sell' },
      { href: '/items', label: itemsNavLabel(isPharmacy) },
      { href: '/expenses', label: 'Expense' },
      { href: '/purchases', label: 'Purchase' },
      { href: '/expiry-alerts', label: 'Expiry Alerts' },
      { href: '/stock-warnings', label: 'Stock Warnings' },
      { href: '/reports', label: 'Reports' },
      { href: '/balance-sheet', label: 'Business Overview' },
      { href: '/dues', label: 'Customer Dues' },
      { href: '/receivables', label: 'Receivables' },
      { href: '/payables', label: 'Payables (Suppliers)' },
      { href: '/bulk-shelf-update', label: 'Shelf Update (Bulk)' },
    ].find((item) => pathname.startsWith(item.href));

    return matched?.label || 'Sell';
  }, [pathname, isPharmacy]);
}

function ReadOnlyBanner() {
  const { isReadOnly } = useAccountAccess();
  if (!isReadOnly) return null;

  return (
    <div className="flex items-start gap-3 border-b border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-2.5 sm:px-6">
      <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-sm text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Service paused — read-only mode.</span> You can
        browse, search and download your data, but changes are disabled. Please contact
        your service provider to restore full access.
      </p>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPharmacy } = useStoreType();
  const pageTitle = usePageTitle(pathname, isPharmacy);
  const { authUser } = useAuth();

  // Keeps features hidden by the user's mode, business type (or by the
  // admin) unreachable even when the URL is typed directly.
  React.useEffect(() => {
    if (
      authUser?.onboardingComplete &&
      !isRouteAllowed(pathname, authUser.appMode, authUser.disabledFeatures, authUser.storeType)
    ) {
      router.replace(getLandingPath(authUser.appMode));
    }
  }, [authUser, pathname, router]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="max-w-full flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="font-headline text-xl font-bold tracking-tight text-foreground">
                {pageTitle}
              </h2>
            </div>
          </header>
          <ReadOnlyBanner />
          <main className="p-4 sm:p-6 w-full flex-1 min-w-0 overflow-hidden">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
