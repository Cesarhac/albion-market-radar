import type { AlbionCity, Enchantment, ItemCategory, Quality, Tier, UpdateStatus } from '@/types/albion';

export type RegearSlotId =
  | 'mainHand'
  | 'offHand'
  | 'head'
  | 'armor'
  | 'shoes'
  | 'cape'
  | 'bag'
  | 'food'
  | 'potion'
  | 'mount';

export type RegearPurchaseMode = 'lowest' | 'single-city' | 'optimized';

export type RegearConfidence = 'high' | 'medium' | 'low';

export type RegearSlotDefinition = {
  id: RegearSlotId;
  label: string;
  description: string;
  placeholder: string;
  categoryHint?: ItemCategory;
  optional?: boolean;
};

export type RegearSlotForm = {
  slotId: RegearSlotId;
  query: string;
  selectedUniqueName?: string;
  tier: Tier;
  enchantment: Enchantment;
  quality: Quality;
  quantity: number;
};

export type BuildSlotSelection = {
  uniqueName: string | null;
  itemName: string | null;
  itemNameEn?: string | null;
  tier?: number | null;
  enchantment?: number | null;
  quality?: Quality | null;
  quantity?: number | null;
};

export type SavedBuildSlots = Record<RegearSlotId, BuildSlotSelection>;

export type SavedBuild = {
  id: string;
  userId: string;
  name: string;
  slots: SavedBuildSlots;
  createdAt: string;
  updatedAt: string;
};

export type RegearPresetSlot = Omit<RegearSlotForm, 'selectedUniqueName'>;

export type RegearPreset = {
  id: string;
  name: string;
  description: string;
  slots: RegearPresetSlot[];
};

export type RegearCityComparison = {
  city: AlbionCity;
  totalCost: number;
  foundItems: number;
  missingItems: number;
  confidence: RegearConfidence;
  worstStatus: UpdateStatus | 'missing';
};
