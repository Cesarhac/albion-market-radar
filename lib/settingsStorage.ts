import type { ServerRegion } from '@/types/albion';
import type { UserSettings } from '@/types/settings';
import { getStoredUser } from '@/lib/authStorage';
import { normalizeServerParam, serverToParam } from '@/lib/marketData';

const STORAGE_KEY = 'albion-market-radar:user-settings:v1';
const VALID_CITIES: UserSettings['mainCity'][] = [
  'Bridgewatch',
  'Martlock',
  'Thetford',
  'Fort Sterling',
  'Lymhurst',
  'Caerleon',
  'Brecilien',
];
const VALID_INTERVALS = [5, 10, 30, 60];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultServer: 'americas',
  marketTax: 6.5,
  mainCity: 'Bridgewatch',
  updateInterval: 10,
  darkTheme: true,
  currency: 'prata',
};

export function mergeWithDefaultSettings(partialSettings: Partial<UserSettings> | null | undefined): UserSettings {
  const defaultServer = normalizeServerParam(String(partialSettings?.defaultServer ?? '')) ?? 'Americas';
  const marketTax = Number(partialSettings?.marketTax);
  const updateInterval = Number(partialSettings?.updateInterval);
  const mainCity = partialSettings?.mainCity;

  return {
    defaultServer: serverToParam(defaultServer),
    marketTax: Number.isFinite(marketTax) && marketTax >= 0 && marketTax <= 30
      ? marketTax
      : DEFAULT_USER_SETTINGS.marketTax,
    mainCity: mainCity && VALID_CITIES.includes(mainCity) ? mainCity : DEFAULT_USER_SETTINGS.mainCity,
    updateInterval: VALID_INTERVALS.includes(updateInterval)
      ? updateInterval
      : DEFAULT_USER_SETTINGS.updateInterval,
    darkTheme:
      typeof partialSettings?.darkTheme === 'boolean'
        ? partialSettings.darkTheme
        : DEFAULT_USER_SETTINGS.darkTheme,
    currency: 'prata',
  };
}

export function getStoredSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) return getDefaultSettingsForCurrentUser();

    return mergeWithDefaultSettings(JSON.parse(rawValue) as Partial<UserSettings>);
  } catch {
    return getDefaultSettingsForCurrentUser();
  }
}

export function saveStoredSettings(settings: UserSettings): UserSettings {
  const normalizedSettings = mergeWithDefaultSettings(settings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
  }

  return normalizedSettings;
}

export function resetStoredSettings(): UserSettings {
  return saveStoredSettings(getDefaultSettingsForCurrentUser());
}

export function hasStoredSettings(): boolean {
  if (typeof window === 'undefined') return false;

  return Boolean(window.localStorage.getItem(STORAGE_KEY));
}

export function getDefaultSettingsForCurrentUser(): UserSettings {
  const storedUser = getStoredUser();

  if (!storedUser) return DEFAULT_USER_SETTINGS;

  return {
    ...DEFAULT_USER_SETTINGS,
    defaultServer: storedUser.server,
  };
}

export function serverParamToRegion(server: UserSettings['defaultServer']): ServerRegion {
  return server === 'europe' ? 'Europe' : 'Americas';
}

export function intervalLabel(minutes: number): string {
  if (minutes === 60) return '1 h';
  return `${minutes} min`;
}
