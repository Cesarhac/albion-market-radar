import type { SubscriptionPlan, UserAccount } from '@/types/albion';

export type EntitlementFeature =
  | 'maxFavorites'
  | 'maxTraderOperations'
  | 'maxWeaponListings'
  | 'maxPriceAlerts'
  | 'maxSavedFilters'
  | 'advancedOpportunityFilters'
  | 'exportCsv'
  | 'savedRegearBuilds';

export type UserEntitlements = {
  maxFavorites: number;
  maxTraderOperations: number;
  maxWeaponListings: number;
  maxPriceAlerts: number;
  maxSavedFilters: number;
  advancedOpportunityFilters: boolean;
  exportCsv: boolean;
  savedRegearBuilds: number;
};

export const FREE_ENTITLEMENTS: UserEntitlements = {
  maxFavorites: 10,
  maxTraderOperations: 50,
  maxWeaponListings: 3,
  maxPriceAlerts: 0,
  maxSavedFilters: 1,
  advancedOpportunityFilters: false,
  exportCsv: false,
  savedRegearBuilds: 1,
};

export const PRO_ENTITLEMENTS: UserEntitlements = {
  maxFavorites: Number.POSITIVE_INFINITY,
  maxTraderOperations: Number.POSITIVE_INFINITY,
  maxWeaponListings: 20,
  maxPriceAlerts: 50,
  maxSavedFilters: 20,
  advancedOpportunityFilters: true,
  exportCsv: true,
  savedRegearBuilds: 20,
};

const PRO_ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function isUserPro(
  profile?:
    | Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'>
    | null,
): boolean {
  if (profile?.plan !== 'pro') return false;
  if (!PRO_ACCESS_STATUSES.has(profile.subscriptionStatus)) return false;

  if (profile.subscriptionCurrentPeriodEnd) {
    const periodEnd = new Date(profile.subscriptionCurrentPeriodEnd).getTime();

    if (!Number.isFinite(periodEnd) || periodEnd <= Date.now()) return false;
  }

  return true;
}

export function isActiveProProfile(
  profile?: Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'> | null,
): boolean {
  return isUserPro(profile);
}

export function getUserPlan(
  profile?: Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'> | null,
): SubscriptionPlan {
  return isUserPro(profile) ? 'pro' : 'free';
}

export function getUserEntitlements(
  profile?: Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'> | null,
): UserEntitlements {
  return getUserPlan(profile) === 'pro' ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

export function canUseFeature(
  profile: Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'> | null | undefined,
  featureName: EntitlementFeature,
): boolean {
  const entitlements = getUserEntitlements(profile);
  const value = entitlements[featureName];

  if (typeof value === 'boolean') return value;

  return value > 0;
}

export function isWithinLimit(
  profile: Pick<UserAccount, 'plan' | 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'> | null | undefined,
  limitName: Extract<
    EntitlementFeature,
    'maxFavorites' | 'maxTraderOperations' | 'maxWeaponListings' | 'maxPriceAlerts' | 'maxSavedFilters' | 'savedRegearBuilds'
  >,
  currentCount: number,
): boolean {
  return currentCount < getUserEntitlements(profile)[limitName];
}

export function formatEntitlementLimit(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('pt-BR').format(value) : 'Ilimitado';
}
