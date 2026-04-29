import type { SubscriptionPlan, UserAccount } from '@/types/albion';

export type EntitlementFeature =
  | 'maxFavorites'
  | 'maxTraderOperations'
  | 'maxWeaponListings'
  | 'maxPriceAlerts'
  | 'advancedOpportunityFilters'
  | 'exportCsv'
  | 'savedRegearBuilds';

export type UserEntitlements = {
  maxFavorites: number;
  maxTraderOperations: number;
  maxWeaponListings: number;
  maxPriceAlerts: number;
  advancedOpportunityFilters: boolean;
  exportCsv: boolean;
  savedRegearBuilds: number;
};

export const FREE_ENTITLEMENTS: UserEntitlements = {
  maxFavorites: 10,
  maxTraderOperations: 50,
  maxWeaponListings: 3,
  maxPriceAlerts: 0,
  advancedOpportunityFilters: false,
  exportCsv: false,
  savedRegearBuilds: 1,
};

export const PRO_ENTITLEMENTS: UserEntitlements = {
  maxFavorites: Number.POSITIVE_INFINITY,
  maxTraderOperations: Number.POSITIVE_INFINITY,
  maxWeaponListings: 20,
  maxPriceAlerts: 50,
  advancedOpportunityFilters: true,
  exportCsv: true,
  savedRegearBuilds: 20,
};

export function getUserPlan(profile?: Pick<UserAccount, 'plan'> | null): SubscriptionPlan {
  return profile?.plan === 'pro' ? 'pro' : 'free';
}

export function getUserEntitlements(profile?: Pick<UserAccount, 'plan'> | null): UserEntitlements {
  return getUserPlan(profile) === 'pro' ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

export function canUseFeature(
  profile: Pick<UserAccount, 'plan'> | null | undefined,
  featureName: EntitlementFeature,
): boolean {
  const entitlements = getUserEntitlements(profile);
  const value = entitlements[featureName];

  if (typeof value === 'boolean') return value;

  return value > 0;
}

export function isWithinLimit(
  profile: Pick<UserAccount, 'plan'> | null | undefined,
  limitName: Extract<EntitlementFeature, 'maxFavorites' | 'maxTraderOperations' | 'maxWeaponListings' | 'maxPriceAlerts' | 'savedRegearBuilds'>,
  currentCount: number,
): boolean {
  return currentCount < getUserEntitlements(profile)[limitName];
}

export function formatEntitlementLimit(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('pt-BR').format(value) : 'Ilimitado';
}
