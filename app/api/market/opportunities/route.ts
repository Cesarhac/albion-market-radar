import { NextResponse } from 'next/server';
import {
  ALBION_CITIES,
  ENCHANTMENTS,
  ITEM_CATEGORIES,
  MARKET_SERVER_REGIONS,
  TIERS,
} from '@/data/constants';
import { findCatalogItemByUniqueName } from '@/data/itemCatalog';
import { OPPORTUNITY_WATCHLIST_ITEM_IDS } from '@/data/opportunityWatchlist';
import type {
  AlbionCity,
  CityPrice,
  Enchantment,
  Item,
  ItemCatalogEntry,
  ItemCategory,
  MarketOpportunitiesResponse,
  Opportunity,
  OpportunityConfidence,
  OpportunityFilters,
  OpportunitySortBy,
  OpportunityType,
  RiskLevel,
  ServerRegion,
  Tier,
} from '@/types/albion';
import { calculateProfitBreakdown } from '@/lib/utils';
import {
  DEFAULT_MAX_DATA_AGE_HOURS,
  DEFAULT_MIN_OPPORTUNITY_MARGIN,
  DEFAULT_MIN_OPPORTUNITY_PROFIT,
  MAX_SUGGESTED_QUANTITY,
  clampScore,
  riskRank,
  scoreLabel,
} from '@/lib/opportunityAnalysis';
import {
  MAX_ABSOLUTE_PRICE_RATIO,
  MAX_DEFAULT_MARGIN_PERCENT,
  MAX_DEFAULT_PRICE_RATIO,
  calculateMedianPrice,
  isSaneOpportunityPrice,
  type OpportunityMarketContext,
  type OpportunityPriceSanityResult,
} from '@/lib/opportunityRules';
import {
  buildMarketItem,
  buildMarketMeta,
  getSourceHost,
  normalizeServerParam,
  parseQualityIdsParam,
} from '@/lib/marketData';
import { fetchAlbionDataPrices } from '@/app/api/market/_utils';

export const revalidate = 300;

const DEFAULT_TAX_RATE = 6.5;
const MAX_RESULTS = 80;
const ITEM_BATCH_SIZE = 70;

type ParsedOpportunityFilters = Required<
  Pick<
    OpportunityFilters,
    | 'type'
    | 'minProfit'
    | 'minMargin'
    | 'maxAgeHours'
    | 'maxRisk'
    | 'buyCity'
    | 'sellCity'
    | 'tier'
    | 'enchantment'
    | 'quality'
    | 'category'
    | 'includeBlackMarket'
    | 'includeLowConfidence'
    | 'includeSuspicious'
    | 'sortBy'
  >
> &
  Pick<OpportunityFilters, 'budget'>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const server = normalizeServerParam(searchParams.get('server'));
  const qualityIds = parseQualityIdsParam(searchParams.get('qualities') ?? searchParams.get('quality'));
  const taxRate = parseTaxRate(searchParams.get('taxRate'));
  const filters = parseOpportunityFilters(searchParams);

  if (!server || !MARKET_SERVER_REGIONS.includes(server)) {
    return NextResponse.json(
      { error: 'Servidor inválido. Use server=americas ou server=europe.' },
      { status: 400 },
    );
  }

  if (!qualityIds) {
    return NextResponse.json({ error: 'Qualidade inválida. Use valores de 1 a 5.' }, { status: 400 });
  }

  if (taxRate === null) {
    return NextResponse.json({ error: 'Taxa inválida.' }, { status: 400 });
  }

  try {
    const catalogItems = getWatchlistCatalogItems(filters);
    const itemIds = catalogItems.map((item) => item.uniqueName);
    const rows = (
      await Promise.all(chunk(itemIds, ITEM_BATCH_SIZE).map((batch) => fetchAlbionDataPrices(batch, server, qualityIds)))
    ).flat();
    const opportunities = sortOpportunities(
      catalogItems.flatMap((catalogItem) => {
        const item = buildMarketItem(catalogItem, qualityIds, rows, server);

        return buildOpportunitiesForItem(item, server, taxRate, filters, getSourceHost(server));
      }),
      filters.sortBy,
    ).slice(0, MAX_RESULTS);
    const message =
      opportunities.length > 0
        ? 'Oportunidades ranqueadas por score, lucro, margem, risco e frescor dos dados.'
        : 'Não encontramos oportunidades positivas com os filtros atuais neste servidor.';
    const response: MarketOpportunitiesResponse = {
      ...buildMarketMeta(server, qualityIds, message),
      opportunities,
      monitoredItemIds: itemIds,
      analyzedItems: catalogItems.length,
      analyzedAt: new Date().toISOString(),
      filters,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível consultar dados reais agora.' },
      { status: 502 },
    );
  }
}

function getWatchlistCatalogItems(filters: ParsedOpportunityFilters): ItemCatalogEntry[] {
  const seen = new Set<string>();

  return OPPORTUNITY_WATCHLIST_ITEM_IDS.map((itemId) => findCatalogItemByUniqueName(itemId))
    .filter((item): item is ItemCatalogEntry => Boolean(item))
    .filter((item) => {
      if (seen.has(item.uniqueName)) return false;
      seen.add(item.uniqueName);
      if (filters.category !== 'all' && item.category !== filters.category) return false;
      if (filters.tier !== 'all' && item.tier !== filters.tier) return false;
      if (filters.enchantment !== 'all' && item.enchantment !== filters.enchantment) return false;

      return true;
    });
}

function buildOpportunitiesForItem(
  item: Item,
  server: ServerRegion,
  taxRate: number,
  filters: ParsedOpportunityFilters,
  sourceHost: string,
): Opportunity[] {
  if (!item.hasMarketData) return [];

  const opportunities: Opportunity[] = [];
  const buyCandidates = item.prices.filter((price) => isValidBuyCandidate(price, filters));
  const validSellPrices = item.prices
    .map((price) => price.sellPriceMin)
    .filter((price) => Number.isFinite(price) && price > 0);
  const marketContext = {
    referenceSellMedian: calculateMedianPrice(validSellPrices),
    validSellPriceCount: validSellPrices.length,
    maxAgeHours: filters.maxAgeHours,
  };

  if (filters.type === 'all' || filters.type === 'quick-sale') {
    const sellCandidates = item.prices.filter((price) => isValidQuickSellCandidate(price, filters));

    for (const buy of buyCandidates) {
      for (const sell of sellCandidates) {
        const opportunity = buildOpportunity({
          item,
          server,
          type: 'quick-sale',
          buy,
          sell,
          buyPrice: buy.sellPriceMin,
          sellPrice: sell.buyPriceMax,
          sellPriceReference: 'buy-order',
          taxRate,
          filters,
          sourceHost,
          marketContext,
        });

        if (opportunity) opportunities.push(opportunity);
      }
    }
  }

  if (filters.type === 'all' || filters.type === 'listed-resale') {
    const sellCandidates = item.prices.filter((price) => isValidListedSellCandidate(price, filters));

    for (const buy of buyCandidates) {
      for (const sell of sellCandidates) {
        const estimatedSellPrice = calculateUndercutPrice(sell.sellPriceMin);
        const opportunity = buildOpportunity({
          item,
          server,
          type: 'listed-resale',
          buy,
          sell,
          buyPrice: buy.sellPriceMin,
          sellPrice: estimatedSellPrice,
          sellPriceReference: 'sell-order',
          taxRate,
          filters,
          sourceHost,
          marketContext,
        });

        if (opportunity) opportunities.push(opportunity);
      }
    }
  }

  return opportunities;
}

function buildOpportunity({
  item,
  server,
  type,
  buy,
  sell,
  buyPrice,
  sellPrice,
  sellPriceReference,
  taxRate,
  filters,
  sourceHost,
  marketContext,
}: {
  item: Item;
  server: ServerRegion;
  type: OpportunityType;
  buy: CityPrice;
  sell: CityPrice;
  buyPrice: number;
  sellPrice: number;
  sellPriceReference: Opportunity['sellPriceReference'];
  taxRate: number;
  filters: ParsedOpportunityFilters;
  sourceHost: string;
  marketContext: OpportunityMarketContext;
}): Opportunity | null {
  if (buy.city === sell.city) return null;
  if (buyPrice <= 0 || sellPrice <= 0) return null;

  const buyUpdatedAt = buy.sellUpdatedAt || buy.updatedAt;
  const sellUpdatedAt =
    type === 'quick-sale'
      ? sell.buyUpdatedAt || sell.updatedAt
      : sell.sellUpdatedAt || sell.updatedAt;
  const buyAgeHours = getAgeHours(buyUpdatedAt);
  const sellAgeHours = getAgeHours(sellUpdatedAt);
  const maxDataAgeHours = Math.max(buyAgeHours, sellAgeHours);

  if (!Number.isFinite(maxDataAgeHours) || maxDataAgeHours > filters.maxAgeHours) return null;

  const profit = calculateProfitBreakdown(buyPrice, sellPrice, taxRate);

  if (profit.netProfit <= 0) return null;
  if (profit.netProfit < filters.minProfit) return null;
  if (profit.margin < filters.minMargin) return null;

  const sanity = isSaneOpportunityPrice(
    {
      type,
      buyPrice,
      sellPrice,
      margin: profit.margin,
      netProfit: profit.netProfit,
      maxDataAgeHours,
      buyCity: buy.city,
      sellCity: sell.city,
    },
    marketContext,
  );

  if (sanity.isSuspicious && !filters.includeSuspicious) return null;

  const confidence = calculateConfidence({
    type,
    buyAgeHours,
    sellAgeHours,
    margin: profit.margin,
    netProfit: profit.netProfit,
    sanity,
  });
  const risk = calculateRisk({
    type,
    margin: profit.margin,
    netProfit: profit.netProfit,
    maxDataAgeHours,
    buyCity: buy.city,
    sellCity: sell.city,
    investment: buyPrice,
    sanity,
  });

  if (!filters.includeLowConfidence && confidence.level === 'low' && !sanity.isSuspicious) return null;
  if (filters.maxRisk !== 'all' && riskRank(risk.level) > riskRank(filters.maxRisk)) return null;

  const budget = filters.budget ?? 0;
  const suggestedQuantity = budget > 0 ? Math.min(MAX_SUGGESTED_QUANTITY, Math.floor(budget / buyPrice)) : 1;
  const estimatedInvestment = buyPrice * suggestedQuantity;
  const estimatedNetProfit = profit.netProfit * suggestedQuantity;
  const score = calculateOpportunityScore({
    type,
    netProfit: profit.netProfit,
    margin: profit.margin,
    maxDataAgeHours,
    risk: risk.level,
    buyPrice,
    budget,
    sellPriceReference,
    buyCity: buy.city,
    sellCity: sell.city,
    sanity,
  });

  return {
    id: `live-${server}-${type}-${item.uniqueName}-${buy.city}-${sell.city}`,
    itemId: item.uniqueName,
    itemName: item.namePtBR,
    itemNameEn: item.nameEn,
    category: item.category,
    subcategory: item.subcategory,
    tier: item.tier,
    enchantment: item.enchantment,
    type,
    buyCity: buy.city,
    sellCity: sell.city,
    buyPrice,
    sellPrice,
    sellPriceReference,
    grossProfit: profit.grossProfit,
    estimatedTax: profit.estimatedTax,
    netProfit: profit.netProfit,
    margin: profit.margin,
    roi: profit.margin,
    investment: buyPrice,
    suggestedQuantity,
    estimatedInvestment,
    estimatedNetProfit,
    score: score.value,
    scoreLabel: scoreLabel(score.value),
    scoreReasons: score.reasons,
    confidence: confidence.level,
    confidenceReasons: confidence.reasons,
    risk: risk.level,
    riskReasons: risk.reasons,
    isSuspicious: sanity.isSuspicious,
    suspicionReasons: sanity.suspicionReasons,
    referenceMedianPrice: sanity.referenceMedianPrice ?? undefined,
    priceRatio: sanity.priceRatio,
    sellPriceOutlier: sanity.sellPriceOutlier,
    buyPriceOutlier: sanity.buyPriceOutlier,
    buyUpdatedAt,
    sellUpdatedAt,
    maxDataAgeHours,
    server,
    sourceHost,
    updatedAt: getOldestCriticalUpdate([buyUpdatedAt, sellUpdatedAt]),
    dataSource: 'live',
    priceTable: item.prices,
  };
}

function isValidBuyCandidate(price: CityPrice, filters: ParsedOpportunityFilters): boolean {
  return (
    price.sellPriceMin > 0 &&
    matchesCityFilter(price.city, filters.buyCity) &&
    isAllowedMarketCity(price.city, filters.includeBlackMarket)
  );
}

function isValidQuickSellCandidate(price: CityPrice, filters: ParsedOpportunityFilters): boolean {
  return (
    price.buyPriceMax > 0 &&
    matchesCityFilter(price.city, filters.sellCity) &&
    isAllowedMarketCity(price.city, filters.includeBlackMarket)
  );
}

function isValidListedSellCandidate(price: CityPrice, filters: ParsedOpportunityFilters): boolean {
  return (
    price.sellPriceMin > 0 &&
    matchesCityFilter(price.city, filters.sellCity) &&
    isAllowedMarketCity(price.city, filters.includeBlackMarket)
  );
}

function matchesCityFilter(city: AlbionCity, filter: AlbionCity | 'all') {
  return filter === 'all' || city === filter;
}

function isAllowedMarketCity(city: AlbionCity, includeBlackMarket: boolean) {
  return includeBlackMarket || city !== 'Black Market';
}

function calculateUndercutPrice(sellPriceMin: number): number {
  return Math.max(0, Math.floor(Math.min(sellPriceMin - 1, sellPriceMin * 0.995)));
}

function calculateConfidence({
  type,
  buyAgeHours,
  sellAgeHours,
  margin,
  netProfit,
  sanity,
}: {
  type: OpportunityType;
  buyAgeHours: number;
  sellAgeHours: number;
  margin: number;
  netProfit: number;
  sanity: OpportunityPriceSanityResult;
}): { level: OpportunityConfidence; reasons: string[] } {
  const maxAge = Math.max(buyAgeHours, sellAgeHours);
  const reasons: string[] = [];

  if (sanity.isSuspicious) {
    reasons.push('Confiança baixa porque o preço foi marcado como suspeito.');
    reasons.push(...sanity.suspicionReasons);
    return { level: 'low', reasons };
  }

  if (type === 'listed-resale') {
    reasons.push('Revenda anunciada depende de outro jogador comprar sua ordem.');

    if (maxAge <= 12 && margin > 0 && netProfit > 0 && sanity.priceRatio <= MAX_DEFAULT_PRICE_RATIO) {
      reasons.push('Preço passou pelos filtros de mediana e razão.');
      return { level: 'medium', reasons };
    }

    reasons.push('Dados insuficientes para confiança alta em revenda anunciada.');
    return { level: 'low', reasons };
  }

  if (
    buyAgeHours <= 2 &&
    sellAgeHours <= 2 &&
    margin >= 8 &&
    margin <= 100 &&
    netProfit > 0 &&
    sanity.priceRatio <= MAX_DEFAULT_PRICE_RATIO
  ) {
    reasons.push('Compra e venda atualizadas há menos de 2h.');
    reasons.push('Margem suficiente para absorver pequena variação.');
    return { level: 'high', reasons };
  }

  if (maxAge <= 12 && margin > 0 && netProfit > 0) {
    reasons.push('Dados ainda utilizáveis, mas um dos lados pode ter mais de 2h.');
    return { level: 'medium', reasons };
  }

  reasons.push('Oportunidade depende de dado antigo ou margem baixa.');
  return { level: 'low', reasons };
}

function calculateRisk({
  type,
  margin,
  netProfit,
  maxDataAgeHours,
  buyCity,
  sellCity,
  investment,
  sanity,
}: {
  type: OpportunityType;
  margin: number;
  netProfit: number;
  maxDataAgeHours: number;
  buyCity: AlbionCity;
  sellCity: AlbionCity;
  investment: number;
  sanity: OpportunityPriceSanityResult;
}): { level: RiskLevel; reasons: string[] } {
  let level: RiskLevel = 'low';
  const reasons: string[] = [];

  if (sanity.isSuspicious) {
    level = maxRisk(level, 'high');
    reasons.push('Preço marcado como suspeito pelos filtros de sanidade.');
  }

  if (type === 'listed-resale') {
    level = maxRisk(level, 'medium');
    reasons.push('Revenda anunciada especulativa depende de vender ordem no mercado.');
  }

  if (maxDataAgeHours > 12) {
    level = maxRisk(level, 'high');
    reasons.push('Algum dado usado no cálculo tem mais de 12h.');
  } else if (maxDataAgeHours > 2) {
    level = maxRisk(level, 'medium');
    reasons.push('Dados não são instantâneos.');
  }

  if (margin < 8) {
    level = maxRisk(level, 'high');
    reasons.push('Margem baixa para cobrir variação de preço.');
  } else if (margin < 15) {
    level = maxRisk(level, 'medium');
    reasons.push('Margem moderada.');
  } else if (margin > MAX_DEFAULT_MARGIN_PERCENT) {
    level = maxRisk(level, 'high');
    reasons.push('Margem acima do limite plausível.');
  }

  if (netProfit < 5000) {
    level = maxRisk(level, 'medium');
    reasons.push('Lucro por unidade relativamente baixo.');
  }

  if (buyCity === 'Black Market' || sellCity === 'Black Market') {
    level = maxRisk(level, 'high');
    reasons.push('Mercado Negro tem variação maior e exige conferência no jogo.');
  }

  if (investment > 5_000_000) {
    level = maxRisk(level, 'high');
    reasons.push('Investimento por unidade muito alto.');
  } else if (investment > 1_000_000) {
    level = maxRisk(level, 'medium');
    reasons.push('Investimento por unidade alto.');
  }

  if (reasons.length === 0) reasons.push('Venda rápida, dados recentes e margem saudável.');

  return { level, reasons };
}

function calculateOpportunityScore({
  type,
  netProfit,
  margin,
  maxDataAgeHours,
  risk,
  buyPrice,
  budget,
  sellPriceReference,
  buyCity,
  sellCity,
  sanity,
}: {
  type: OpportunityType;
  netProfit: number;
  margin: number;
  maxDataAgeHours: number;
  risk: RiskLevel;
  buyPrice: number;
  budget: number;
  sellPriceReference: Opportunity['sellPriceReference'];
  buyCity: AlbionCity;
  sellCity: AlbionCity;
  sanity: OpportunityPriceSanityResult;
}): { value: number; reasons: string[] } {
  const reasons = ['Score combina margem, lucro líquido, frescor, risco e qualidade do preço usado.'];
  const marginNormalized = Math.min(Math.max(margin, 0), 60) / 60 * 100;
  const profitNormalized = Math.min(Math.log10(Math.max(netProfit, 0) + 1) / Math.log10(100_000 + 1), 1) * 100;
  const freshness = Math.max(0, 100 - (maxDataAgeHours / DEFAULT_MAX_DATA_AGE_HOURS) * 100);
  const riskScore = risk === 'low' ? 100 : risk === 'medium' ? 65 : 25;
  const typePenalty = type === 'listed-resale' ? 18 : 0;
  const noBuyOrderPenalty = sellPriceReference === 'sell-order' ? 12 : 0;
  const budgetPenalty = budget > 0 && buyPrice > budget ? 25 : 0;
  const stalePenalty = maxDataAgeHours > 12 ? 25 : maxDataAgeHours > 2 ? 10 : 0;
  const blackMarketPenalty = buyCity === 'Black Market' || sellCity === 'Black Market' ? 12 : 0;
  const extremeMarginPenalty = margin > MAX_DEFAULT_MARGIN_PERCENT ? 70 : margin > 100 ? 25 : 0;
  const ratioPenalty =
    sanity.priceRatio > MAX_ABSOLUTE_PRICE_RATIO
      ? 80
      : sanity.priceRatio > MAX_DEFAULT_PRICE_RATIO
        ? 35
        : 0;

  if (type === 'listed-resale') reasons.push('Revenda anunciada recebeu penalidade por ser especulativa.');
  if (sellPriceReference === 'sell-order') reasons.push('Sem buy order real no destino; preço de saída depende de anúncio.');
  if (sanity.isSuspicious) reasons.push('Preço suspeito reduziu fortemente o score.');
  if (budgetPenalty > 0) reasons.push('Preço por unidade acima do orçamento informado.');
  if (stalePenalty > 0) reasons.push('Dados menos recentes reduziram o score.');
  if (blackMarketPenalty > 0) reasons.push('Mercado Negro recebeu penalidade de risco.');

  const rawScore =
    marginNormalized * 0.35 +
      profitNormalized * 0.3 +
      freshness * 0.25 +
      riskScore * 0.1 -
      typePenalty -
      noBuyOrderPenalty -
      budgetPenalty -
      stalePenalty -
      blackMarketPenalty -
      extremeMarginPenalty -
      ratioPenalty -
      sanity.scorePenalty;

  const cappedScore = sanity.isRejectedByDefault
    ? Math.min(rawScore, 12)
    : sanity.isSuspicious
      ? Math.min(rawScore, 35)
      : rawScore;

  return {
    value: clampScore(cappedScore),
    reasons,
  };
}

function sortOpportunities(opportunities: Opportunity[], sortBy: OpportunitySortBy): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    if (a.isSuspicious !== b.isSuspicious) return a.isSuspicious ? 1 : -1;

    if (sortBy === 'profit') return b.netProfit - a.netProfit;
    if (sortBy === 'margin') return b.margin - a.margin;
    if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (sortBy === 'investment') return (a.investment ?? a.buyPrice) - (b.investment ?? b.buyPrice);

    return (b.score ?? 0) - (a.score ?? 0);
  });
}

function parseOpportunityFilters(searchParams: URLSearchParams): ParsedOpportunityFilters {
  return {
    type: parseOpportunityType(searchParams.get('type')),
    minProfit: parseNumber(searchParams.get('minProfit'), DEFAULT_MIN_OPPORTUNITY_PROFIT),
    minMargin: parseNumber(searchParams.get('minMargin'), DEFAULT_MIN_OPPORTUNITY_MARGIN),
    maxAgeHours: parseNumber(searchParams.get('maxAgeHours'), DEFAULT_MAX_DATA_AGE_HOURS),
    maxRisk: parseRisk(searchParams.get('maxRisk') ?? searchParams.get('risk')) ?? 'high',
    buyCity: parseCity(searchParams.get('buyCity')),
    sellCity: parseCity(searchParams.get('sellCity')),
    tier: parseTier(searchParams.get('tier')),
    enchantment: parseEnchantment(searchParams.get('enchantment')),
    quality: 'Normal',
    category: parseCategory(searchParams.get('category')),
    budget: parseOptionalNumber(searchParams.get('budget')),
    includeBlackMarket: parseBoolean(searchParams.get('includeBlackMarket')),
    includeLowConfidence: parseBoolean(searchParams.get('includeLowConfidence')),
    includeSuspicious: parseBoolean(searchParams.get('includeSuspicious')),
    sortBy: parseSortBy(searchParams.get('sortBy')),
  };
}

function parseOpportunityType(value: string | null): OpportunityType | 'all' {
  if (value === 'quick-sale' || value === 'listed-resale') return value;
  if (value === 'all') return 'all';
  return 'quick-sale';
}

function parseCity(value: string | null): AlbionCity | 'all' {
  if (value && ALBION_CITIES.includes(value as AlbionCity)) return value as AlbionCity;
  return 'all';
}

function parseCategory(value: string | null): ItemCategory | 'all' {
  if (value && ITEM_CATEGORIES.includes(value as ItemCategory)) return value as ItemCategory;
  return 'all';
}

function parseTier(value: string | null): ParsedOpportunityFilters['tier'] {
  const numeric = Number(value);
  return TIERS.includes(numeric as Tier) ? numeric as Tier : 'all';
}

function parseEnchantment(value: string | null): ParsedOpportunityFilters['enchantment'] {
  const numeric = Number(value);
  return ENCHANTMENTS.includes(numeric as Enchantment)
    ? numeric as Enchantment
    : 'all';
}

function parseRisk(value: string | null): RiskLevel | 'all' | null {
  if (value === 'all') return 'all';
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return null;
}

function parseSortBy(value: string | null): OpportunitySortBy {
  if (value === 'profit' || value === 'margin' || value === 'recent' || value === 'investment') return value;
  return 'score';
}

function parseNumber(value: string | null, fallback: number): number {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function parseOptionalNumber(value: string | null): number | undefined {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseBoolean(value: string | null): boolean {
  return value === 'true' || value === '1';
}

function parseTaxRate(value: string | null): number | null {
  if (!value) return DEFAULT_TAX_RATE;

  const numeric = Number(value);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) return null;

  return numeric <= 1 ? numeric * 100 : numeric;
}

function getAgeHours(value: string): number {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;

  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

function getOldestCriticalUpdate(values: string[]): string {
  const timestamps = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);

  if (timestamps.length === 0) return '';

  return new Date(Math.min(...timestamps)).toISOString();
}

function maxRisk(current: RiskLevel, next: RiskLevel): RiskLevel {
  return riskRank(next) > riskRank(current) ? next : current;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
