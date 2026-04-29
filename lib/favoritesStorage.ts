import { mockFavorites } from '@/data/mockFavorites';
import { normalizePlayerName } from '@/lib/authStorage';
import type { FavoriteItem } from '@/types/albion';

const STORAGE_KEY = 'albion-market-radar:favorites';

export function getFavoritesStorageKey(playerName?: string): string {
  const normalizedPlayerName = normalizePlayerName(playerName ?? '');

  return normalizedPlayerName ? `${STORAGE_KEY}:${normalizedPlayerName}` : STORAGE_KEY;
}

export function getStoredFavorites(playerName?: string): FavoriteItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(getFavoritesStorageKey(playerName));

    if (!rawValue) return mockFavorites;

    const parsed = JSON.parse(rawValue) as Partial<FavoriteItem>[];

    return Array.isArray(parsed) ? parsed.map(normalizeFavorite).filter(Boolean) : mockFavorites;
  } catch {
    return mockFavorites;
  }
}

export function saveStoredFavorites(favorites: FavoriteItem[], playerName?: string): FavoriteItem[] {
  const normalizedFavorites = favorites.map(normalizeFavorite).filter(Boolean);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getFavoritesStorageKey(playerName), JSON.stringify(normalizedFavorites));
  }

  return normalizedFavorites;
}

function normalizeFavorite(favorite: Partial<FavoriteItem>): FavoriteItem {
  return {
    id: typeof favorite.id === 'string' && favorite.id ? favorite.id : `favorite-${Date.now()}`,
    itemId: String(favorite.itemId ?? '').trim(),
    itemName: String(favorite.itemName ?? '').trim(),
    targetPrice: positiveNumber(favorite.targetPrice),
    buyCity: favorite.buyCity ?? 'Bridgewatch',
    sellCity: favorite.sellCity ?? 'Caerleon',
    alertStatus: Boolean(favorite.alertStatus),
    expectedProfit: positiveNumber(favorite.expectedProfit),
    updatedAt:
      typeof favorite.updatedAt === 'string' && favorite.updatedAt
        ? favorite.updatedAt
        : new Date().toISOString(),
  };
}

function positiveNumber(value: unknown): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}
