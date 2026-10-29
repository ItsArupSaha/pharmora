'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useStoreType } from '@/hooks/use-store-type';
import { getAlertCounts } from '@/lib/db/item-alerts';
import { APP_NAME } from '@/lib/app-info';
import { getVisibleFeatures } from '@/lib/features';
import { AdminPanelLink } from './admin-panel-link';
import { ModeSwitcher } from './mode-switcher';
import { ProfileButton } from './profile-button';
import { getNavItems, type NavItem } from './sidebar-navigation';

export function AppSidebar() {
  const pathname = usePathname();
  const { authUser, user } = useAuth();
  const { isPharmacy } = useStoreType();
  const [alertCount, setAlertCount] = React.useState(0);
  const [stockWarningCount, setStockWarningCount] = React.useState(0);

  const visibleFeatures = React.useMemo(
    () => getVisibleFeatures(authUser?.appMode, authUser?.disabledFeatures),
    [authUser?.appMode, authUser?.disabledFeatures]
  );

  const filterVisible = React.useCallback(
    (items: NavItem[]) => items.filter((item) => visibleFeatures.includes(item.feature)),
    [visibleFeatures]
  );

  const navItems = React.useMemo(() => getNavItems(isPharmacy), [isPharmacy]);
  const coreItems = React.useMemo(
    () => filterVisible(navItems.core),
    [filterVisible, navItems]
  );
  const otherItems = React.useMemo(
    () => filterVisible(navItems.other),
    [filterVisible, navItems]
  );

  const refreshCounts = React.useCallback(() => {
    if (!user) return;
    getAlertCounts(user.uid, 90)
      .then(({ expiring, lowStock }) => {
        setAlertCount(expiring);
        setStockWarningCount(lowStock);
      })
      .catch((err) => console.error('Failed to fetch badge counts for sidebar:', err));
  }, [user]);

  // Fetch badge counts once on login and at most once per minute when the tab
  // regains focus — browsers fire focus on every window/app switch, and an
  // unthrottled listener turns routine window-switching into constant reads.
  const lastFetchRef = React.useRef(0);
  React.useEffect(() => {
    refreshCounts();
    lastFetchRef.current = Date.now();
    const onFocus = () => {
      if (Date.now() - lastFetchRef.current > 60_000) {
        lastFetchRef.current = Date.now();
        refreshCounts();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshCounts]);

  const renderMenuItems = (itemsList: NavItem[]) => {
    return itemsList.map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={pathname.startsWith(item.href)}
          tooltip={item.label}
          className="transition-all duration-200"
        >
          <Link href={item.href} className="flex justify-between items-center w-full">
            <div className="flex items-center gap-2.5">
              <item.icon className="h-4 w-4" />
              <span className="font-medium text-[13px]">{item.label}</span>
            </div>
            {item.badge === 'expiry' && alertCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground animate-pulse">
                {alertCount}
              </span>
            )}
            {item.badge === 'stock' && stockWarningCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-semibold text-white animate-pulse">
                {stockWarningCount}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  };

  return (
    <Sidebar className="border-r bg-card/60 backdrop-blur-md">
      <SidebarHeader className="p-2 border-b">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Pharmora"
            width={70}
            height={70}
            priority
            className="h-14 w-14 object-contain shrink-0 drop-shadow-sm"
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center pr-1">
            <h1
              className="font-headline text-lg sm:text-xl font-bold text-foreground leading-tight break-words whitespace-normal"
              title={authUser?.companyName || APP_NAME}
            >
              {authUser?.companyName || APP_NAME}
            </h1>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Core Operations
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 mt-1">
            <SidebarMenu>{renderMenuItems(coreItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Others
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 mt-1">
            <SidebarMenu>{renderMenuItems(otherItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t flex flex-col gap-3 bg-muted/20">
        <ModeSwitcher />
        <AdminPanelLink />
        <ProfileButton />
      </SidebarFooter>
    </Sidebar>
  );
}
