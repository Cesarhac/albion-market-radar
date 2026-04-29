import generatedCatalog from '@/data/itemCatalog.generated.json';
import { itemAliasesPtBR } from '@/data/itemAliases.ptBR';
import type { Enchantment, ItemCatalogEntry, ItemCategory, Quality, Tier } from '@/types/albion';
import type { AlbionItemCatalogEntry, ItemSearchFilters } from '@/types/items';

type ScoredItem = {
  item: ItemCatalogEntry;
  score: number;
};

const DEFAULT_QUALITY: Quality = 'Normal';
const VARIANT_COMPATIBLE_CATEGORIES = new Set<ItemCategory>([
  'Armas',
  'Armaduras',
  'Bolsas',
  'Capas',
  'Ferramentas',
]);
const SEARCHABLE_CATEGORIES: ItemCategory[] = [
  'Bolsas',
  'Capas',
  'Armas',
  'Armaduras',
  'Poções',
  'Comidas',
  'Recursos',
  'Materiais refinados',
  'Montarias',
  'Ferramentas',
  'Itens',
];

const catalog = buildCatalog();
const catalogByUniqueName = new Map(catalog.map((item) => [item.uniqueName.toUpperCase(), item]));

export const itemCatalog = catalog;
export const ITEM_CATEGORIES = SEARCHABLE_CATEGORIES;

export function normalizeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9@_]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function compactSearchTerm(value: string) {
  return normalizeSearchTerm(value).replace(/[^a-z0-9@]+/g, '');
}

export function searchItems(
  query: string,
  filters: ItemSearchFilters = {},
  limit = 12,
): ItemCatalogEntry[] {
  const normalizedQuery = normalizeSearchTerm(query);
  const compactQuery = compactSearchTerm(query);
  const hasQuery = normalizedQuery.length > 0;
  const seen = new Set<string>();

  return catalog
    .filter((item) => catalogItemMatchesSearchFilters(item, filters))
    .map((item) => ({ item, score: scoreItem(item, normalizedQuery, compactQuery, hasQuery) }))
    .filter(({ score }) => score < 999)
    .sort(compareSearchResults)
    .map(({ item }) => resolveItemVariation(item, filters.tier, filters.enchantment))
    .filter((item) => {
      const key = item.uniqueName.toUpperCase();

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function findCatalogItemByQuery(
  query: string,
  filters: ItemSearchFilters = {},
): ItemCatalogEntry | null {
  return searchItems(query, filters, 1)[0] ?? null;
}

export function findCatalogItemsByQuery(
  query: string,
  filters: ItemSearchFilters = {},
  limit = 8,
): ItemCatalogEntry[] {
  return searchItems(query, filters, limit);
}

export function findCatalogItemByUniqueName(uniqueName: string): ItemCatalogEntry | null {
  return catalogByUniqueName.get(uniqueName.trim().toUpperCase()) ?? null;
}

export function catalogItemMatchesFilters(item: ItemCatalogEntry, filters: ItemSearchFilters = {}) {
  const matchesCategory = !filters.category || filters.category === 'all' || item.category === filters.category;
  const matchesSubcategory =
    !filters.subcategory || filters.subcategory === 'all' || item.subcategory === filters.subcategory;
  const matchesTier = !filters.tier || filters.tier === 'all' || item.tier === filters.tier;
  const matchesEnchantment =
    filters.enchantment === undefined ||
    filters.enchantment === 'all' ||
    item.enchantment === filters.enchantment;
  const matchesMarketable = filters.marketableOnly === false || item.marketable !== false;

  return matchesCategory && matchesSubcategory && matchesTier && matchesEnchantment && matchesMarketable;
}

export function getItemFamilyId(uniqueName: string): string | null {
  const withoutEnchantment = uniqueName.trim().toUpperCase().replace(/@[1-4]$/, '');
  const match = /^T[1-8]_(.+)$/.exec(withoutEnchantment);

  return match?.[1] ?? null;
}

export function buildItemUniqueName(
  baseUniqueNameOrFamilyId: string,
  tier: Tier,
  enchantment: Enchantment,
): string {
  const normalized = baseUniqueNameOrFamilyId.trim().toUpperCase().replace(/@[1-4]$/, '');
  const familyId = getItemFamilyId(normalized) ?? normalized.replace(/^T[1-8]_/, '');
  const base = `T${tier}_${familyId}`;

  return enchantment > 0 ? `${base}@${enchantment}` : base;
}

export function getDisplayItemTierLabel(tier: Tier, enchantment: Enchantment): string {
  return `T${tier}.${enchantment}`;
}

export function getItemBaseDisplayName(
  item: ItemCatalogEntry,
  locale: 'pt-BR' | 'en-US' = 'pt-BR',
): string {
  if (locale === 'en-US') {
    return item.baseNameEn ?? getBaseNameFromLocalizedName(item.nameEn, locale);
  }

  return item.baseNamePtBR ?? getBaseNameFromLocalizedName(item.namePtBR, locale);
}

export function getDisplayItemName(
  item: ItemCatalogEntry,
  tier: Tier = item.tier,
  enchantment: Enchantment = item.enchantment,
  locale: 'pt-BR' | 'en-US' = 'pt-BR',
): string {
  return `${getItemBaseDisplayName(item, locale)} ${getDisplayItemTierLabel(tier, enchantment)}`;
}

export function resolveItemVariation(
  item: ItemCatalogEntry,
  tierFilter?: number | 'all',
  enchantmentFilter?: Enchantment | 'all',
): ItemCatalogEntry {
  const requestedTier = resolveTierFilter(tierFilter, item.tier);
  const requestedEnchantment = resolveEnchantmentFilter(enchantmentFilter, item.enchantment);

  if (requestedTier === item.tier && requestedEnchantment === item.enchantment) {
    return item;
  }

  const uniqueName = buildItemUniqueName(item.uniqueName, requestedTier, requestedEnchantment);
  const exactVariant = catalogByUniqueName.get(uniqueName.toUpperCase());

  if (exactVariant) {
    return mergeResolvedVariant(exactVariant, item);
  }

  if (!canGenerateSyntheticVariant(item)) {
    return item;
  }

  return mergeResolvedVariant(
    {
      ...item,
      itemId: uniqueName,
      uniqueName,
      tier: requestedTier,
      enchantment: requestedEnchantment,
      familyId: getItemFamilyId(uniqueName) ?? item.familyId,
      iconUrl: `https://render.albiononline.com/v1/item/${encodeURIComponent(uniqueName)}.png`,
    },
    item,
  );
}

export function getCatalogSearchText(item: ItemCatalogEntry) {
  return [
    item.itemId,
    item.uniqueName,
    item.nameEn,
    item.namePtBR,
    item.familyId ?? '',
    item.baseNameEn ?? '',
    item.baseNamePtBR ?? '',
    item.category,
    item.subcategory ?? '',
    item.itemPower ?? '',
    ...item.aliases,
  ]
    .map(normalizeSearchTerm)
    .join(' ');
}

function buildCatalog(): ItemCatalogEntry[] {
  return (generatedCatalog as AlbionItemCatalogEntry[])
    .map(normalizeGeneratedEntry)
    .filter((item): item is ItemCatalogEntry => Boolean(item))
    .map(applyAliasRules)
    .sort((a, b) => a.namePtBR.localeCompare(b.namePtBR, 'pt-BR') || a.uniqueName.localeCompare(b.uniqueName));
}

function normalizeGeneratedEntry(entry: AlbionItemCatalogEntry): ItemCatalogEntry | null {
  const tier = toTier(entry.tier);

  if (!tier) return null;

  const nameEn = entry.nameEn?.trim() || entry.uniqueName;
  const namePtBR = entry.namePtBR?.trim() || nameEn;
  const familyId = getItemFamilyId(entry.uniqueName) ?? undefined;

  return {
    itemId: entry.uniqueName,
    uniqueName: entry.uniqueName,
    nameEn,
    namePtBR,
    familyId,
    baseNameEn: entry.baseNameEn ?? getBaseNameFromLocalizedName(nameEn, 'en-US'),
    baseNamePtBR: entry.baseNamePtBR ?? getBaseNameFromLocalizedName(namePtBR, 'pt-BR'),
    resolvedFromUniqueName: entry.resolvedFromUniqueName,
    aliases: normalizeAliases(entry.aliases ?? []),
    tier,
    enchantment: toEnchantment(entry.enchantment),
    defaultQuality: entry.defaultQuality ?? DEFAULT_QUALITY,
    category: toCategory(entry.category),
    subcategory: entry.subcategory,
    itemPower: entry.itemPower,
    marketable: entry.marketable ?? true,
    iconUrl: entry.iconUrl,
  };
}

function applyAliasRules(item: ItemCatalogEntry): ItemCatalogEntry {
  const aliases = [...item.aliases];
  let namePtBR = item.namePtBR;

  for (const rule of itemAliasesPtBR) {
    const matchesUniqueName = rule.uniqueName && rule.uniqueName.toUpperCase() === item.uniqueName.toUpperCase();
    const matchesPattern = rule.uniqueNamePattern && new RegExp(rule.uniqueNamePattern, 'i').test(item.uniqueName);

    if (!matchesUniqueName && !matchesPattern) continue;

    aliases.push(...rule.aliases);

    if (rule.preferredNamePtBR) {
      namePtBR = rule.preferredNamePtBR;
    }
  }

  return {
    ...item,
    namePtBR,
    baseNameEn: getBaseNameFromLocalizedName(item.nameEn, 'en-US'),
    baseNamePtBR: getBaseNameFromLocalizedName(namePtBR, 'pt-BR'),
    aliases: normalizeAliases(aliases),
  };
}

function normalizeAliases(aliases: string[]) {
  return Array.from(
    new Set(
      aliases
        .map((alias) => alias.trim())
        .filter(Boolean),
    ),
  );
}

function toTier(value: number | undefined): Tier | null {
  return [1, 2, 3, 4, 5, 6, 7, 8].includes(value ?? 0) ? (value as Tier) : null;
}

function toEnchantment(value: number | undefined): Enchantment {
  return [1, 2, 3, 4].includes(value ?? 0) ? (value as Enchantment) : 0;
}

function toCategory(value: string | undefined): ItemCategory {
  return SEARCHABLE_CATEGORIES.includes(value as ItemCategory) ? (value as ItemCategory) : 'Itens';
}

function catalogItemMatchesSearchFilters(item: ItemCatalogEntry, filters: ItemSearchFilters = {}) {
  const matchesCategory = !filters.category || filters.category === 'all' || item.category === filters.category;
  const matchesSubcategory =
    !filters.subcategory || filters.subcategory === 'all' || item.subcategory === filters.subcategory;
  const matchesMarketable = filters.marketableOnly === false || item.marketable !== false;

  return matchesCategory && matchesSubcategory && matchesMarketable;
}

function resolveTierFilter(value: number | 'all' | undefined, fallback: Tier): Tier {
  if (!value || value === 'all') return fallback;

  return toTier(value) ?? fallback;
}

function resolveEnchantmentFilter(value: Enchantment | 'all' | undefined, fallback: Enchantment): Enchantment {
  if (value === undefined || value === 'all') return fallback;

  return toEnchantment(value);
}

function canGenerateSyntheticVariant(item: ItemCatalogEntry): boolean {
  return Boolean(item.familyId) && VARIANT_COMPATIBLE_CATEGORIES.has(item.category);
}

function mergeResolvedVariant(variant: ItemCatalogEntry, source: ItemCatalogEntry): ItemCatalogEntry {
  return {
    ...variant,
    familyId: variant.familyId ?? source.familyId,
    baseNameEn: source.baseNameEn ?? variant.baseNameEn ?? getBaseNameFromLocalizedName(variant.nameEn, 'en-US'),
    baseNamePtBR:
      source.baseNamePtBR ?? variant.baseNamePtBR ?? getBaseNameFromLocalizedName(variant.namePtBR, 'pt-BR'),
    resolvedFromUniqueName: source.uniqueName === variant.uniqueName ? variant.resolvedFromUniqueName : source.uniqueName,
    aliases: normalizeAliases([...variant.aliases, ...source.aliases]),
  };
}

function getBaseNameFromLocalizedName(value: string, locale: 'pt-BR' | 'en-US'): string {
  const cleanValue = value.trim();

  if (locale === 'en-US') {
    return cleanValue
      .replace(/^(Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's)\s+/i, '')
      .trim();
  }

  return cleanValue
    .replace(
      /\s+d(?:o|a|os|as)\s+(Novato|Novata|Iniciante|Adepto|Adepta|Perito|Perita|Especialista|Mestre|Grão-mestre|Grao-mestre|Ancião|Anciao)$/i,
      '',
    )
    .trim();
}

function scoreItem(
  item: ItemCatalogEntry,
  normalizedQuery: string,
  compactQuery: string,
  hasQuery: boolean,
) {
  if (!hasQuery) return 500;

  const exactTerms = [item.uniqueName, item.itemId, item.namePtBR, item.nameEn, ...item.aliases];
  const normalizedTerms = exactTerms.map(normalizeSearchTerm);
  const compactTerms = exactTerms.map(compactSearchTerm);

  if (normalizeSearchTerm(item.uniqueName) === normalizedQuery || compactSearchTerm(item.uniqueName) === compactQuery) {
    return 0;
  }

  if (normalizeSearchTerm(item.namePtBR) === normalizedQuery || compactSearchTerm(item.namePtBR) === compactQuery) {
    return 10;
  }

  if (normalizeSearchTerm(item.nameEn) === normalizedQuery || compactSearchTerm(item.nameEn) === compactQuery) {
    return 12;
  }

  if (item.aliases.some((alias) => normalizeSearchTerm(alias) === normalizedQuery || compactSearchTerm(alias) === compactQuery)) {
    return 14;
  }

  if (normalizedTerms.some((term) => term.startsWith(normalizedQuery)) || compactTerms.some((term) => term.startsWith(compactQuery))) {
    return 30;
  }

  if (normalizedTerms.some((term) => term.includes(normalizedQuery)) || compactTerms.some((term) => term.includes(compactQuery))) {
    return 50;
  }

  const searchText = getCatalogSearchText(item);
  const allTokensMatch = normalizedQuery.split(' ').every((token) => searchText.includes(token));
  if (allTokensMatch) return 70;

  const categoryText = normalizeSearchTerm(`${item.category} ${item.subcategory ?? ''}`);
  if (categoryText.includes(normalizedQuery)) return 80;

  return 999;
}

function compareSearchResults(a: ScoredItem, b: ScoredItem) {
  if (a.score !== b.score) return a.score - b.score;
  if (a.item.marketable !== b.item.marketable) return a.item.marketable ? -1 : 1;
  if (a.item.tier !== b.item.tier) return a.item.tier - b.item.tier;
  if (a.item.enchantment !== b.item.enchantment) return a.item.enchantment - b.item.enchantment;

  return a.item.namePtBR.localeCompare(b.item.namePtBR, 'pt-BR');
}
