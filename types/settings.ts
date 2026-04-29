import type { AlbionCity, ServerParam } from '@/types/albion';

export type UserSettings = {
  defaultServer: ServerParam;
  marketTax: number;
  mainCity: Exclude<AlbionCity, 'Black Market'>;
  updateInterval: number;
  darkTheme: boolean;
  currency: 'prata';
};

export type UserSettingsFeedback = 'saved' | 'restored' | 'error' | null;
