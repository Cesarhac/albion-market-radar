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
  MarketPricesResponse,
  NewEnchantedWeaponListing,
  Opportunity,
  OpportunityConfidence,
  OpportunityFilters,
  ServerRegion,
  UserSettings,
} from '@/types/albion';
import { getUpdateStatus } from '@/lib/utils';
import { getSourceHost, qualityIdsFromQuality, serverToParam } from '@/lib/marketData';
import { getBrowserSupabase } from '@/src/lib/supabase/client';
import {
  calculateInstantSellProfitBreakdown,
  calculateSellOrderProfitBreakdown,
} from '@/src/lib/albionTaxes';
import {
  DEFAULT_MIN_ESTIMATED_PROFIT,
  DEFAULT_MIN_OPPORTUNITY_PROFIT,
  calculateSuggestedQuantity,
  evaluateOpportunityQuality,
  riskRank,
  scoreLabel,
  shouldShowOpportunityByQuality,
} from '@/lib/opportunityAnalysis';

const wait = (milliseconds = 120) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export type OpportunityApiErrorPayload = {
  ok?: false;
  error?: string;
  stage?: string;
  status?: number;
  metadata?: Record<string, unknown>;
};

export class OpportunityApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: OpportunityApiErrorPayload,
  ) {
    super(message);
    this.name = 'OpportunityApiError';
  }

  get stage() {
    return this.payload?.stage;
  }

  get metadata() {
    return this.payload?.metadata;
  }
}

export class OpportunityAccessError extends OpportunityApiError {
  constructor(message: string, status: number, payload?: OpportunityApiErrorPayload) {
    super(message, status, payload);
    this.name = 'OpportunityAccessError';
  }
}

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

function withMockOpportunitySource(opportunity: Opportunity, hasAlbionPremium: boolean): Opportunity {
  const profit = opportunity.type === 'listed-resale'
    ? calculateSellOrderProfitBreakdown(opportunity.buyPrice, opportunity.sellPrice, hasAlbionPremium)
    : calculateInstantSellProfitBreakdown(opportunity.buyPrice, opportunity.sellPrice, hasAlbionPremium);
  const suggestedQuantity = calculateSuggestedQuantity({
    buyPrice: opportunity.buyPrice,
    category: opportunity.category,
  });
  const estimatedNetProfit = profit.netProfit * suggestedQuantity;
  const practicalQuality = evaluateOpportunityQuality({
    netProfitPerUnit: profit.netProfit,
    estimatedNetProfit,
    margin: profit.margin,
    buyPrice: opportunity.buyPrice,
    buyCity: opportunity.buyCity,
    sellCity: opportunity.sellCity,
    category: opportunity.category,
    confidence: opportunity.confidence ?? 'medium',
    isSuspicious: opportunity.isSuspicious ?? false,
  });
  const rawScore = Math.round(
    Math.min(60, profit.margin) * 0.15 +
      Math.min(100, profit.netProfit / 1000) * 0.35 +
      Math.min(100, estimatedNetProfit / 5000) * 0.25 +
      25,
  );
  const score = practicalQuality.isMicroFlip
    ? Math.min(rawScore, 15)
    : estimatedNetProfit < DEFAULT_MIN_ESTIMATED_PROFIT
      ? Math.min(rawScore, 30)
      : Math.max(20, Math.min(88, rawScore));

  return {
    ...opportunity,
    type: opportunity.type ?? 'quick-sale',
    grossProfit: profit.grossProfit,
    estimatedTax: profit.estimatedTax,
    netProfit: profit.netProfit,
    margin: profit.margin,
    roi: profit.margin,
    investment: opportunity.buyPrice,
    suggestedQuantity,
    estimatedInvestment: opportunity.buyPrice * suggestedQuantity,
    estimatedNetProfit,
    netProfitPerUnit: profit.netProfit,
    isMicroFlip: practicalQuality.isMicroFlip,
    microFlipReasons: practicalQuality.microFlipReasons,
    worthLevel: practicalQuality.worthLevel,
    worthReasons: practicalQuality.worthReasons,
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
    const netProfitPerUnit = opportunity.netProfitPerUnit ?? opportunity.netProfit;
    const matchesProfit = netProfitPerUnit >= (filters.minProfit ?? DEFAULT_MIN_OPPORTUNITY_PROFIT);
    const matchesQuality = shouldShowOpportunityByQuality(opportunity, filters);
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
    const matchesConfidence = true;
    const matchesMinimumConfidence =
      !filters.minConfidence ||
      filters.minConfidence === 'all' ||
      confidenceRank(opportunity.confidence ?? 'low') >= confidenceRank(filters.minConfidence);
    const matchesSuspicion = filters.includeSuspicious || !opportunity.isSuspicious;
    const matchesAge =
      !filters.maxAgeHours ||
      !opportunity.maxDataAgeHours ||
      opportunity.maxDataAgeHours <= filters.maxAgeHours;

    return (
      matchesServer &&
      matchesProfit &&
      matchesQuality &&
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
      matchesMinimumConfidence &&
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
  hasAlbionPremium = false,
): Opportunity[] {
  return filterOpportunities(
    mockOpportunities.map((opportunity) => withMockOpportunitySource(opportunity, hasAlbionPremium)),
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
  hasAlbionPremium = false,
): Promise<MarketOpportunitiesResponse> {
  const qualityIds = qualityIdsFromQuality(filters.quality, 'Normal');
  const params = new URLSearchParams({
    server: serverToParam(server),
    qualities: qualityIds.join(','),
    hasAlbionPremium: String(hasAlbionPremium),
  });

  appendOpportunityFilterParams(params, filters);

  try {
    const accessToken = await getCurrentAccessToken();
    const response = await fetch(`/api/market/opportunities?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const payload = (await response.json().catch(() => null)) as (MarketOpportunitiesResponse & OpportunityApiErrorPayload) | null;

    if (!response.ok) {
      const message = payload?.error ?? 'Não foi possível consultar os dados públicos agora.';

      if (response.status === 401 || response.status === 403) {
        throw new OpportunityAccessError(message, response.status, payload ?? undefined);
      }

      throw new OpportunityApiError(message, response.status, payload ?? undefined);
    }

    if (!payload) throw new OpportunityApiError('Resposta vazia do Radar de Oportunidades.', response.status);

    return payload;
  } catch (error) {
    if (error instanceof OpportunityApiError) throw error;

    throw new Error('Não foi possível carregar dados reais agora.');
  }
}

async function getCurrentAccessToken(): Promise<string> {
  const supabase = getBrowserSupabase();

  if (!supabase) {
    throw new OpportunityAccessError('Usuário não autenticado.', 401, {
      ok: false,
      error: 'Usuário não autenticado.',
      stage: 'auth',
      status: 401,
    });
  }

  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    throw new OpportunityAccessError('Não foi possível validar sua sessão. Faça login novamente.', 401, {
      ok: false,
      error: 'Não foi possível validar sua sessão. Faça login novamente.',
      stage: 'auth',
      status: 401,
    });
  }

  return accessToken;
}

export async function fetchOpportunities(
  server: ServerRegion,
  filters: OpportunityFilters = {},
  hasAlbionPremium = false,
): Promise<Opportunity[]> {
  const payload = await fetchOpportunityRadar(server, filters, hasAlbionPremium);

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
  if (filters.minEstimatedProfit !== undefined) params.set('minEstimatedProfit', String(filters.minEstimatedProfit));
  if (filters.includeBlackMarket) params.set('includeBlackMarket', 'true');
  if (filters.includeLowConfidence) params.set('includeLowConfidence', 'true');
  if (filters.includeSuspicious) params.set('includeSuspicious', 'true');
  if (filters.includeMicroFlips) params.set('includeMicroFlips', 'true');
  if (filters.blackMarketFreshOnly) params.set('blackMarketFreshOnly', 'true');
  if (filters.blackMarketMaxAgeHours !== undefined) {
    params.set('blackMarketMaxAgeHours', String(filters.blackMarketMaxAgeHours));
  }
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.watchlistMode) params.set('watchlist', filters.watchlistMode);
  if (filters.minConfidence && filters.minConfidence !== 'all') params.set('minConfidence', filters.minConfidence);
  if (filters.plan) params.set('plan', filters.plan);
  if (filters.scanDepth) params.set('scanDepth', filters.scanDepth);
  if (filters.selectedPreset) params.set('preset', filters.selectedPreset);
  if (filters.quickProfile) params.set('quickProfile', filters.quickProfile);
  if (filters.blackMarketProfile) params.set('blackMarketProfile', filters.blackMarketProfile);
}

function sortOpportunities(a: Opportunity, b: Opportunity, sortBy: OpportunityFilters['sortBy']) {
  if (a.isSuspicious !== b.isSuspicious) return a.isSuspicious ? 1 : -1;
  if (a.isMicroFlip !== b.isMicroFlip) return a.isMicroFlip ? 1 : -1;
  if (worthRank(a.worthLevel) !== worthRank(b.worthLevel)) {
    return worthRank(b.worthLevel) - worthRank(a.worthLevel);
  }

  if (sortBy === 'profit') return b.netProfit - a.netProfit;
  if (sortBy === 'margin') return b.margin - a.margin;
  if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (sortBy === 'investment') return (a.investment ?? a.buyPrice) - (b.investment ?? b.buyPrice);

  return (b.score ?? 0) - (a.score ?? 0);
}

function worthRank(level: Opportunity['worthLevel']): number {
  if (level === 'excelente') return 5;
  if (level === 'boa') return 4;
  if (level === 'fraca') return 2;
  if (level === 'micro') return 1;
  return 0;
}

function confidenceRank(confidence: OpportunityConfidence): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
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
