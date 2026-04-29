import type { Enchantment, Quality } from '@/types/albion';

export type AlbionItemCatalogEntry = {
  uniqueName: string;
  namePtBR: string;
  nameEn?: string;
  familyId?: string;
  baseNamePtBR?: string;
  baseNameEn?: string;
  resolvedFromUniqueName?: string;
  aliases: string[];
  tier?: number;
  enchantment?: Enchantment;
  category?: string;
  subcategory?: string;
  marketable?: boolean;
  iconUrl?: string;
  defaultQuality?: Quality;
  itemPower?: string;
};

export type ItemAliasRule = {
  uniqueName?: string;
  uniqueNamePattern?: string;
  aliases: string[];
  preferredNamePtBR?: string;
  note?: string;
};

export type ItemSearchFilters = {
  category?: string | 'all';
  subcategory?: string | 'all';
  tier?: number | 'all';
  enchantment?: Enchantment | 'all';
  marketableOnly?: boolean;
};
