import { findCatalogItemsByQuery } from '@/data/itemCatalog';
import type { ItemCatalogEntry } from '@/types/albion';
import type { RegearSlotId } from '@/types/regear';
import type { ItemSearchFilters } from '@/types/items';

const SLOT_CATEGORY_FILTERS: Partial<Record<RegearSlotId, ItemSearchFilters['category']>> = {
  head: 'Armaduras',
  armor: 'Armaduras',
  shoes: 'Armaduras',
  cape: 'Capas',
  mainHand: 'Armas',
  offHand: 'Armas',
  food: 'Comidas',
  potion: 'Poções',
  bag: 'Bolsas',
  mount: 'Montarias',
};

export function searchBuildSlotItems(
  slotId: RegearSlotId,
  query: string,
  filters: Omit<ItemSearchFilters, 'category'> = {},
  limit = 20,
): ItemCatalogEntry[] {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) return [];

  return findCatalogItemsByQuery(
    trimmedQuery,
    {
      ...filters,
      category: SLOT_CATEGORY_FILTERS[slotId],
    },
    Math.max(limit * 3, 30),
  )
    .filter((item) => itemMatchesBuildSlot(slotId, item))
    .slice(0, limit);
}

export function itemMatchesBuildSlot(slotId: RegearSlotId, item: ItemCatalogEntry): boolean {
  const uniqueName = item.uniqueName.toUpperCase();
  const subcategory = normalize(item.subcategory ?? '');
  const searchText = normalize(`${item.namePtBR} ${item.nameEn} ${item.searchText ?? ''}`);

  if (slotId === 'head') return item.category === 'Armaduras' && uniqueName.includes('_HEAD_');
  if (slotId === 'armor') return item.category === 'Armaduras' && uniqueName.includes('_ARMOR_');
  if (slotId === 'shoes') return item.category === 'Armaduras' && uniqueName.includes('_SHOES_');
  if (slotId === 'cape') return item.category === 'Capas';
  if (slotId === 'bag') return item.category === 'Bolsas';
  if (slotId === 'food') return item.category === 'Comidas';
  if (slotId === 'potion') return item.category === 'Poções';
  if (slotId === 'mount') return item.category === 'Montarias';

  if (slotId === 'offHand') {
    return (
      item.category === 'Armas' &&
      (uniqueName.includes('_OFF_') ||
        subcategory.includes('off') ||
        searchText.includes('escudo') ||
        searchText.includes('tocha') ||
        searchText.includes('shield') ||
        searchText.includes('torch') ||
        searchText.includes('book'))
    );
  }

  if (slotId === 'mainHand') {
    return (
      item.category === 'Armas' &&
      !uniqueName.includes('_OFF_') &&
      (uniqueName.includes('_MAIN_') || uniqueName.includes('_2H_'))
    );
  }

  return true;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
