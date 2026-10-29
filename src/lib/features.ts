import type { AppMode, FeatureKey, StoreType } from './types';
import { FEATURE_KEYS } from './types';

// Features available in "stock management only" mode. Everything else in
// FEATURE_KEYS is considered a normal-mode feature and hidden for stock users.
export const STOCK_MODE_FEATURES: FeatureKey[] = [
  'sell',
  'items',
  'expiry-alerts',
  'stock-warnings',
  'shelf-update',
];

// Features exclusive to general businesses; hidden for pharmacy accounts.
export const GENERAL_ONLY_FEATURES: FeatureKey[] = ['receivables'];

// Maps every (main) route prefix to the feature that owns it. Used by the
// route guard to keep hidden features unreachable by typing the URL.
export const ROUTE_FEATURES: Record<string, FeatureKey> = {
  '/sales': 'sell',
  '/sales-returns': 'sell',
  '/items': 'items',
  '/expenses': 'expenses',
  '/purchases': 'purchases',
  '/expiry-alerts': 'expiry-alerts',
  '/stock-warnings': 'stock-warnings',
  '/reports': 'reports',
  '/balance-sheet': 'business-overview',
  '/dashboard': 'business-overview',
  '/payables': 'payables',
  '/dues': 'customer-dues',
  '/customers': 'customer-dues',
  '/receivables': 'receivables',
  '/bulk-shelf-update': 'shelf-update',
};

export function getModeFeatures(appMode: AppMode): FeatureKey[] {
  if (appMode === 'stock') return STOCK_MODE_FEATURES;
  // Normal mode exposes every known feature.
  return [...FEATURE_KEYS];
}

export function getVisibleFeatures(
  appMode: AppMode | undefined,
  disabledFeatures: FeatureKey[] | undefined,
  storeType?: StoreType
): FeatureKey[] {
  const mode = appMode ?? 'normal';
  const disabled = new Set(disabledFeatures ?? []);
  const generalOnly = storeType === 'general' ? new Set<FeatureKey>() : new Set<FeatureKey>(GENERAL_ONLY_FEATURES);
  return getModeFeatures(mode).filter(
    (feature) => !disabled.has(feature) && !generalOnly.has(feature)
  );
}

export function isFeatureVisible(
  feature: FeatureKey,
  appMode: AppMode | undefined,
  disabledFeatures: FeatureKey[] | undefined,
  storeType?: StoreType
): boolean {
  return getVisibleFeatures(appMode, disabledFeatures, storeType).includes(feature);
}

export function isRouteAllowed(
  pathname: string,
  appMode: AppMode | undefined,
  disabledFeatures: FeatureKey[] | undefined,
  storeType?: StoreType
): boolean {
  const matched = Object.keys(ROUTE_FEATURES)
    .filter((prefix) => pathname.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  if (!matched) return true;
  return isFeatureVisible(ROUTE_FEATURES[matched], appMode, disabledFeatures, storeType);
}

export function getLandingPath(appMode: AppMode | undefined): string {
  // Every mode opens on the sale page.
  return '/sales';
}
