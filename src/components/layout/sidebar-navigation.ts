import {
  AlertTriangle,
  ArrowRightLeft,
  CreditCard,
  FileText,
  FolderSync,
  Package,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Store,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { FeatureKey } from '@/lib/types';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  feature: FeatureKey;
  badge?: 'expiry' | 'stock';
}

export const CORE_NAV_ITEMS: NavItem[] = [
  { href: '/sales', icon: ShoppingCart, label: 'Sell', feature: 'sell' },
  { href: '/items', icon: Package, label: 'Medicines / Stocks', feature: 'items' },
  { href: '/expenses', icon: CreditCard, label: 'Expense', feature: 'expenses' },
  { href: '/purchases', icon: ShoppingBag, label: 'Purchase', feature: 'purchases' },
  { href: '/expiry-alerts', icon: AlertTriangle, label: 'Expiry Alerts', feature: 'expiry-alerts', badge: 'expiry' },
  { href: '/stock-warnings', icon: ShieldAlert, label: 'Stock Warnings', feature: 'stock-warnings', badge: 'stock' },
  { href: '/reports', icon: FileText, label: 'Reports', feature: 'reports' },
  { href: '/balance-sheet', icon: Store, label: 'Business Overview', feature: 'business-overview' },
];

export const OTHER_NAV_ITEMS: NavItem[] = [
  { href: '/payables', icon: ArrowRightLeft, label: 'Payables (Suppliers)', feature: 'payables' },
  { href: '/dues', icon: Wallet, label: 'Customer Dues', feature: 'customer-dues' },
  { href: '/bulk-shelf-update', icon: FolderSync, label: 'Shelf Update (Bulk)', feature: 'shelf-update' },
];

/** Label for the items page/nav entry — "medicines" wording is pharmacy-only. */
export function itemsNavLabel(isPharmacy: boolean): string {
  return isPharmacy ? 'Medicines / Stocks' : 'Items / Stocks';
}

/** Nav entries with labels resolved for the user's business type. */
export function getNavItems(isPharmacy: boolean): { core: NavItem[]; other: NavItem[] } {
  if (isPharmacy) return { core: CORE_NAV_ITEMS, other: OTHER_NAV_ITEMS };
  return {
    core: CORE_NAV_ITEMS.map((item) =>
      item.href === '/items' ? { ...item, label: itemsNavLabel(false) } : item
    ),
    other: OTHER_NAV_ITEMS,
  };
}
