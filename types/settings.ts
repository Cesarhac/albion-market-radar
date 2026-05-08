import type { AlbionCity, ServerParam } from '@/types/albion';

export type UserSettings = {
  defaultServer: ServerParam;
  marketTax: number;
  hasAlbionPremium: boolean;
  mainCity: Exclude<AlbionCity, 'Black Market'>;
  updateInterval: number;
  interfaceDensity: 'comfortable' | 'compact';
  browserNotificationsEnabled: boolean;
  darkTheme: boolean;
  currency: 'prata';
};

export type UserSettingsFeedback = 'saved' | 'restored' | 'error' | null;
