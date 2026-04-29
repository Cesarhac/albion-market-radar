import {
  findCatalogItemByQuery,
  findCatalogItemByUniqueName,
  findCatalogItemsByQuery,
  resolveItemVariation,
} from '@/data/itemCatalog';
import { mockFavorites } from '@/data/mockFavorites';
import { mockItems } from '@/data/mockItems';
import { mockOpportunities } from '@/data/mockOpportunities';
import { mockSettings } from '@/data/mockSettings';
import { mockWeapons } from '@/data/mockWeapons';
import type {
  EnchantedWeaponListing,
  FavoriteItem,
  Item,
  ItemSearchFilters,
  MarketOpportunitiesResponse,
  MarketResponseMeta,
  MarketPricesResponse,
  NewEnchantedWeaponListing,
  Opportunity,
  OpportunityFilters,
  ServerRegion,
  UserSettings,
} from '@/types/albion';
import { calculateProfitBreakdown, getUpdateStatus } from '@/lib/utils';
import { getSourceHost, qualityIdsFromQuality, serverToParam } from '@/lib/marketData';
import { riskRank, scoreLabel } from '@/lib/opportunityAnalysis';

const wait = (milliseconds = 120) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function matchesItem(item: Item, query: string, filters: ItemSearchFilters): boolean {
  const normalizedQuery = normalize(query);
  const searchableTerms = [
    item.itemId,
    item.uniqueName,
    item.nameEn,
    item.namePtBR,
    ...item.aliases,
  ].map(normalize);

  const matchesQuery =
    normalizedQuery.length === 0 ||
    searchableTerms.some((term) => term === normalizedQuery || term.includes(normalizedQuery));

  const matchesTier = !filters.tier || filters.tier === 'all' || item.tier === filters.tier;
  const matchesEnchantment =
    filters.enchantment === undefined ||
    filters.enchantment === 'all' ||
    item.enchantment === filters.enchantment;
  const matchesQuality =
    !filters.quality || filters.quality === 'all' || item.quality === filters.quality;

  return matchesQuery && matchesTier && matchesEnchantment && matchesQuality;
}

function withMockSource(item: Item, server: ServerRegion): Item {
  return {
    ...item,
    dataSource: 'mock',
    hasMarketData: true,
    server,
    sourceHost: getSourceHost(server),
    marketNotice: 'Usando dados demonstrativos temporariamente porque a consulta real falhou.',
    prices: item.prices.map((price) => ({
      ...price,
      updateStatus: price.updateStatus ?? getUpdateStatus(price.updatedAt),
      hasMarketData: price.sellPriceMin > 0 || price.buyPriceMax > 0,
    })),
  };
}

function withMockOpportunitySource(opportunity: Opportunity, taxRate: number): Opportunity {
  const profit = calculateProfitBreakdown(opportunity.buyPrice, opportunity.sellPrice, taxRate);
  const score = Math.max(40, Math.min(78, Math.round(profit.margin + profit.netProfit / 1000)));

  return {
    ...opportunity,
    type: opportunity.type ?? 'quick-sale',
    grossProfit: profit.grossProfit,
    estimatedTax: profit.estimatedTax,
    netProfit: profit.netProfit,
    margin: profit.margin,
    roi: profit.margin,
    investment: opportunity.buyPrice,
    suggestedQuantity: 1,
    estimatedInvestment: opportunity.buyPrice,
    estimatedNetProfit: profit.netProfit,
    score,
    scoreLabel: scoreLabel(score),
    scoreReasons: opportunity.scoreReasons ?? ['Fallback local sem explicação detalhada de score.'],
    confidence: opportunity.confidence ?? 'medium',
    confidenceReasons: opportunity.confidenceReasons ?? ['Dados demonstrativos para fallback local.'],
    riskReasons: opportunity.riskReasons ?? ['Fallback local sem análise completa de frescor.'],
    isSuspicious: opportunity.isSuspicious ?? false,
    suspicionReasons: opportunity.suspicionReasons ?? [],
    priceRatio: opportunity.priceRatio ?? (opportunity.buyPrice > 0 ? opportunity.sellPrice / opportunity.buyPrice : undefined),
    sellPriceOutlier: opportunity.sellPriceOutlier ?? false,
    buyPriceOutlier: opportunity.buyPriceOutlier ?? false,
    buyUpdatedAt: opportunity.buyUpdatedAt ?? opportunity.updatedAt,
    sellUpdatedAt: opportunity.sellUpdatedAt ?? opportunity.updatedAt,
    maxDataAgeHours: opportunity.maxDataAgeHours ?? 4,
    dataSource: 'mock',
    sourceHost: getSourceHost(opportunity.server),
  };
}

export function searchCatalogItems(
  query: string,
  filters: Pick<ItemSearchFilters, 'category' | 'tier' | 'enchantment'> = {},
  limit = 8,
) {
  return findCatalogItemsByQuery(query, filters, limit);
}

export function filterOpportunities(
  opportunities: Opportunity[],
  server: ServerRegion,
  filters: OpportunityFilters = {},
): Opportunity[] {
  return opportunities.filter((opportunity) => {
    const matchesServer = opportunity.server === server;
    const matchesProfit = !filters.minProfit || opportunity.netProfit >= filters.minProfit;
    const matchesMargin = !filters.minMargin || opportunity.margin >= filters.minMargin;
    const maxRisk = filters.maxRisk ?? filters.risk;
    const matchesRisk =
      !maxRisk ||
      maxRisk === 'all' ||
      riskRank(opportunity.risk) <= riskRank(maxRisk);
    const matchesType = !filters.type || filters.type === 'all' || opportunity.type === filters.type;
    const matchesCategory =
      !filters.category || filters.category === 'all' || opportunity.category === filters.category;
    const matchesBuyCity =
      !filters.buyCity || filters.buyCity === 'all' || opportunity.buyCity === filters.buyCity;
    const matchesSellCity =
      !filters.sellCity || filters.sellCity === 'all' || opportunity.sellCity === filters.sellCity;
    const matchesTier = !filters.tier || filters.tier === 'all' || opportunity.tier === filters.tier;
    const matchesEnchantment =
      filters.enchantment === undefined ||
      filters.enchantment === 'all' ||
      opportunity.enchantment === filters.enchantment;
    const matchesBlackMarket =
      filters.includeBlackMarket || (opportunity.buyCity !== 'Black Market' && opportunity.sellCity !== 'Black Market');
    const matchesConfidence =
      filters.includeLowConfidence ||
      opportunity.confidence !== 'low' ||
      (filters.includeSuspicious && opportunity.isSuspicious);
    const matchesSuspicion = filters.includeSuspicious || !opportunity.isSuspicious;
    const matchesAge =
      !filters.maxAgeHours ||
      !opportunity.maxDataAgeHours ||
      opportunity.maxDataAgeHours <= filters.maxAgeHours;

    return (
      matchesServer &&
      matchesProfit &&
      matchesMargin &&
      matchesRisk &&
      matchesType &&
      matchesCategory &&
      matchesBuyCity &&
      matchesSellCity &&
      matchesTier &&
      matchesEnchantment &&
      matchesBlackMarket &&
      matchesConfidence &&
      matchesSuspicion &&
      matchesAge
    );
  }).sort((a, b) => sortOpportunities(a, b, filters.sortBy ?? 'score'));
}

export function getItemPricesSnapshot(
  itemIdOrQuery: string,
  _server: ServerRegion,
  filters: ItemSearchFilters = {},
): Item | null {
  const mockItem = mockItems.find((item) => matchesItem(item, itemIdOrQuery, filters)) ?? null;

  return mockItem ? withMockSource(mockItem, _server) : null;
}

export function getOpportunitiesSnapshot(
  server: ServerRegion,
  filters: OpportunityFilters = {},
  taxRate = 6.5,
): Opportunity[] {
  return filterOpportunities(
    mockOpportunities.map((opportunity) => withMockOpportunitySource(opportunity, taxRate)),
    server,
    filters,
  );
}

export async function fetchItemPrices(
  itemIdOrQuery: string,
  server: ServerRegion,
  filters: ItemSearchFilters = {},
): Promise<Item | null> {
  const catalogItem =
    findCatalogItemByUniqueName(itemIdOrQuery) ??
    findCatalogItemByQuery(itemIdOrQuery, {
      category: filters.category,
      tier: filters.tier,
      enchantment: filters.enchantment,
    });

  if (!catalogItem) {
    await wait();
    return getItemPricesSnapshot(itemIdOrQuery, server, filters);
  }

  const resolvedCatalogItem = resolveItemVariation(catalogItem, filters.tier, filters.enchantment);
  const qualityIds = qualityIdsFromQuality(filters.quality, resolvedCatalogItem.defaultQuality);
  const params = new URLSearchParams({
    itemId: resolvedCatalogItem.uniqueName,
    server: serverToParam(server),
    qualities: qualityIds.join(','),
  });

  try {
    const response = await fetch(`/api/market/prices?${params.toString()}`);

    if (!response.ok) throw new Error('Falha ao consultar preços reais.');

    const payload = (await response.json()) as MarketPricesResponse;

    return payload.item;
  } catch {
    return (
      getItemPricesSnapshot(resolvedCatalogItem.uniqueName, server, filters) ??
      getItemPricesSnapshot(resolvedCatalogItem.uniqueName, server)
    );
  }
}

export async function fetchOpportunityRadar(
  server: ServerRegion,
  filters: OpportunityFilters = {},
  taxRate = 6.5,
): Promise<MarketOpportunitiesResponse> {
  const qualityIds = qualityIdsFromQuality(filters.quality, 'Normal');
  const params = new URLSearchParams({
    server: serverToParam(server),
    qualities: qualityIds.join(','),
    taxRate: String(taxRate),
  });

  appendOpportunityFilterParams(params, filters);

  try {
    const response = await fetch(`/api/market/opportunities?${params.toString()}`);

    if (!response.ok) throw new Error('Falha ao consultar oportunidades reais.');

    const payload = (await response.json()) as MarketOpportunitiesResponse;

    return {
      ...payload,
      opportunities: filterOpportunities(payload.opportunities, server, filters),
    };
  } catch {
    await wait();
    const opportunities = getOpportunitiesSnapshot(server, filters, taxRate);

    return {
      ...mockMarketMeta(server, qualityIds),
      opportunities,
      monitoredItemIds: opportunities.map((opportunity) => opportunity.itemId),
      analyzedItems: opportunities.length,
      analyzedAt: new Date().toISOString(),
      filters,
    };
  }
}

export async function fetchOpportunities(
  server: ServerRegion,
  filters: OpportunityFilters = {},
  taxRate = 6.5,
): Promise<Opportunity[]> {
  const payload = await fetchOpportunityRadar(server, filters, taxRate);

  return payload.opportunities;
}

function appendOpportunityFilterParams(params: URLSearchParams, filters: OpportunityFilters) {
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.tier && filters.tier !== 'all') params.set('tier', String(filters.tier));
  if (filters.enchantment !== undefined && filters.enchantment !== 'all') {
    params.set('enchantment', String(filters.enchantment));
  }
  if (filters.buyCity && filters.buyCity !== 'all') params.set('buyCity', filters.buyCity);
  if (filters.sellCity && filters.sellCity !== 'all') params.set('sellCity', filters.sellCity);
  if (filters.minProfit !== undefined) params.set('minProfit', String(filters.minProfit));
  if (filters.minMargin !== undefined) params.set('minMargin', String(filters.minMargin));
  if (filters.maxAgeHours !== undefined) params.set('maxAgeHours', String(filters.maxAgeHours));
  if (filters.maxRisk && filters.maxRisk !== 'all') params.set('maxRisk', filters.maxRisk);
  if (filters.budget !== undefined) params.set('budget', String(filters.budget));
  if (filters.includeBlackMarket) params.set('includeBlackMarket', 'true');
  if (filters.includeLowConfidence) params.set('includeLowConfidence', 'true');
  if (filters.includeSuspicious) params.set('includeSuspicious', 'true');
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
}

function sortOpportunities(a: Opportunity, b: Opportunity, sortBy: OpportunityFilters['sortBy']) {
  if (a.isSuspicious !== b.isSuspicious) return a.isSuspicious ? 1 : -1;

  if (sortBy === 'profit') return b.netProfit - a.netProfit;
  if (sortBy === 'margin') return b.margin - a.margin;
  if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (sortBy === 'investment') return (a.investment ?? a.buyPrice) - (b.investment ?? b.buyPrice);

  return (b.score ?? 0) - (a.score ?? 0);
}

function mockMarketMeta(server: ServerRegion, qualityIds: number[]): MarketResponseMeta {
  return {
    server: serverToParam(server),
    serverLabel: server === 'Americas' ? 'Américas' : 'Europa',
    sourceHost: getSourceHost(server),
    requestedLocations: [],
    requestedQualities: qualityIds,
    fetchedAt: new Date().toISOString(),
    source: 'mock',
    message: 'Dados demonstrativos usados porque a consulta real falhou.',
  };
}

export async function fetchFavorites(): Promise<FavoriteItem[]> {
  await wait();
  return mockFavorites;
}

export async function fetchUserSettings(): Promise<UserSettings> {
  await wait(80);
  return mockSettings;
}

export async function fetchEnchantedWeaponListings(): Promise<EnchantedWeaponListing[]> {
  await wait();
  return mockWeapons;
}

export async function createEnchantedWeaponListing(
  data: NewEnchantedWeaponListing,
): Promise<EnchantedWeaponListing> {
  await wait(180);

  return {
    ...data,
    id: `weapon-${Date.now()}`,
    imageLabel: data.imageLabel ?? 'custom',
    status: 'available',
    createdAt: new Date().toISOString(),
  };
}
