import type { NewWeapon4Listing, Weapon4Listing } from '@/types/albion';

export const WEAPONS_4_STORAGE_KEY = 'albion-market-radar:weapons-4';

export function readWeapon4Listings(): Weapon4Listing[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(WEAPONS_4_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .map(normalizeStoredWeapon4Listing)
      .filter((listing): listing is Weapon4Listing => Boolean(listing));
  } catch {
    return [];
  }
}

export function writeWeapon4Listings(listings: Weapon4Listing[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(WEAPONS_4_STORAGE_KEY, JSON.stringify(listings));
}

export function createWeapon4Listing(input: NewWeapon4Listing): Weapon4Listing {
  const now = new Date().toISOString();

  return normalizeWeapon4Listing({
    ...input,
    id: input.id ?? `weapon-4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.isAwakened ? 'awakened' : 'standard-4',
    createdAt: now,
    updatedAt: now,
  });
}

export function updateWeapon4Listing(
  current: Weapon4Listing,
  input: NewWeapon4Listing,
): Weapon4Listing {
  return normalizeWeapon4Listing({
    ...current,
    ...input,
    id: current.id,
    sellerName: current.sellerPlayerName ?? current.sellerName ?? input.sellerPlayerName,
    sellerUserId: current.sellerUserId ?? input.sellerUserId,
    sellerPlayerName: current.sellerPlayerName ?? current.sellerName ?? input.sellerPlayerName,
    sellerPlayerId: current.sellerPlayerId ?? input.sellerPlayerId,
    sellerServer: current.sellerServer ?? input.sellerServer,
    safetyAcceptedAt: current.safetyAcceptedAt ?? input.safetyAcceptedAt,
    type: input.isAwakened ? 'awakened' : 'standard-4',
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

function normalizeWeapon4Listing(listing: Weapon4Listing): Weapon4Listing {
  const isAwakened = Boolean(listing.awakened ?? listing.isAwakened);
  const sellerPlayerName =
    normalizeOptionalString(listing.sellerPlayerName) ??
    normalizeOptionalString(listing.sellerName) ??
    'Vendedor não informado';
  const screenshots = Array.isArray(listing.screenshots) ? listing.screenshots : [];
  const traits = Array.isArray(listing.traits) ? listing.traits : [];
  const traitTags = Array.isArray(listing.traitTags) ? listing.traitTags : [];
  const useCases = Array.isArray(listing.useCases) ? listing.useCases : [];
  const investedCost = normalizeOptionalNumber(listing.investedCost ?? listing.estimatedInvestment);

  return {
    ...listing,
    enchantment: 4,
    type: isAwakened ? 'awakened' : 'standard-4',
    isAwakened,
    awakened: isAwakened,
    sellerName: sellerPlayerName,
    sellerPlayerName,
    sellerContact: normalizeOptionalString(listing.sellerContact),
    discordUsername: normalizeOptionalString(listing.discordUsername),
    discordUserId: normalizeOptionalString(listing.discordUserId),
    discordInviteUrl: normalizeOptionalString(listing.discordInviteUrl),
    safetyAcceptedAt: normalizeDate(listing.safetyAcceptedAt, listing.createdAt),
    traits: isAwakened ? traits : [],
    traitTags: Array.from(new Set(traitTags.map((tag) => normalizeOptionalString(tag)).filter(Boolean) as string[])),
    investedCost,
    estimatedInvestment: investedCost,
    screenshots: screenshots.filter(Boolean),
    useCases: Array.from(new Set(useCases)),
  };
}

function normalizeStoredWeapon4Listing(value: unknown): Weapon4Listing | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<Weapon4Listing>;
  const sellerPlayerName =
    normalizeOptionalString(candidate.sellerPlayerName) ?? normalizeOptionalString(candidate.sellerName);

  if (
    !(
      typeof candidate.id === 'string' &&
      typeof candidate.weaponName === 'string' &&
      typeof candidate.tier === 'number' &&
      candidate.enchantment === 4 &&
      typeof candidate.askingPrice === 'number' &&
      typeof sellerPlayerName === 'string' &&
      typeof candidate.createdAt === 'string' &&
      typeof candidate.updatedAt === 'string'
    )
  ) {
    return null;
  }

  return normalizeWeapon4Listing({
    ...(candidate as Weapon4Listing),
    sellerName: sellerPlayerName,
    sellerPlayerName,
    sellerContact: normalizeOptionalString(candidate.sellerContact),
    safetyAcceptedAt: normalizeDate(candidate.safetyAcceptedAt, candidate.createdAt),
  });
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function normalizeDate(value: unknown, fallback?: unknown): string {
  const timestamp = typeof value === 'string' ? new Date(value).getTime() : Number.NaN;
  const fallbackTimestamp = typeof fallback === 'string' ? new Date(fallback).getTime() : Number.NaN;

  if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  if (Number.isFinite(fallbackTimestamp)) return new Date(fallbackTimestamp).toISOString();

  return new Date().toISOString();
}
