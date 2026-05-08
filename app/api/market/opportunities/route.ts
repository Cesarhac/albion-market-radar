import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
  ALBION_CITIES,
  BLACK_MARKET_BUY_CITIES,
  BLACK_MARKET_LOCATION,
  ENCHANTMENTS,
  ITEM_CATEGORIES,
  MARKET_SERVER_REGIONS,
  TIERS,
} from '@/data/constants';
import { findCatalogItemByUniqueName, getItemCatalog } from '@/data/itemCatalog';
import {
  BASIC_WATCHLIST_ITEM_IDS,
  BLACK_MARKET_WATCHLIST_ITEM_IDS,
  EXTENDED_WATCHLIST_ITEM_IDS,
  QUICK_RESALE_WATCHLIST_ITEM_IDS,
} from '@/data/opportunityWatchlist';
import type {
  AlbionCity,
  AlbionDataPriceResponse,
  CityPrice,
  Enchantment,
  EstimatedLiquidity,
  Item,
  ItemCatalogEntry,
  ItemCategory,
  MarketOpportunitiesResponse,
  Opportunity,
  OpportunityBlackMarketProfile,
  OpportunityConfidence,
  OpportunityFilters,
  OpportunityQuickProfile,
  OpportunityRadarDebug,
  OpportunityRejectionReasons,
  OpportunityScanDepth,
  OpportunityWatchlistMode,
  OpportunitySortBy,
  OpportunityType,
  RiskLevel,
  SubscriptionPlan,
  SubscriptionStatus,
  ServerRegion,
  Tier,
} from '@/types/albion';
import {
  DEFAULT_MAX_DATA_AGE_HOURS,
  DEFAULT_MIN_OPPORTUNITY_MARGIN,
  DEFAULT_MIN_OPPORTUNITY_PROFIT,
  DEFAULT_MIN_ESTIMATED_PROFIT,
  MIN_ROUTE_EFFORT_PROFIT,
  calculateSuggestedQuantity,
  clampScore,
  evaluateOpportunityQuality,
  riskRank,
  scoreLabel,
  shouldShowOpportunityByQuality,
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
import {
  AlbionDataApiError,
  buildAlbionDataPricesUrl,
  fetchAlbionDataPrices,
} from '@/app/api/market/_utils';
import { getSupabaseAdmin } from '@/src/lib/supabase/admin';
import { getSupabasePublicConfig } from '@/src/lib/supabase/env';
import { isUserPro } from '@/src/lib/entitlements';
import {
  calculateInstantSellProfitBreakdown,
  calculateSellOrderProfitBreakdown,
  getSellOrderTotalFeeRate,
  getTransactionTaxRate,
} from '@/src/lib/albionTaxes';

export const dynamic = 'force-dynamic';

const MAX_RESULTS = 80;
const ITEM_BATCH_SIZE = 70;
const FALLBACK_CATALOG_LIMIT = 420;
const QUICK_RESALE_BASIC_LIMIT = 360;
const QUICK_RESALE_PRO_LIMIT = 950;
const QUICK_RESALE_DEEP_LIMIT = 1800;
const QUICK_RESALE_MIN_UNIT_PROFIT = 1000;
const QUICK_RESALE_WIDE_MIN_TOTAL_PROFIT = 1000;
const QUICK_RESALE_SAFE_MIN_TOTAL_PROFIT = 5000;
const BLACK_MARKET_BASIC_LIMIT = 420;
const BLACK_MARKET_PRO_LIMIT = 1200;
const BLACK_MARKET_DEEP_LIMIT = 2200;
const BLACK_MARKET_MIN_UNIT_PROFIT = 1000;
const BLACK_MARKET_WIDE_MIN_TOTAL_PROFIT = 1000;
const BLACK_MARKET_SAFE_MIN_TOTAL_PROFIT = 5000;
const BLACK_MARKET_HIGH_PROFIT_MIN_TOTAL_PROFIT = 50_000;
const BLACK_MARKET_FRESH_ONLY_DEFAULT_HOURS = 24;
const POTIONS_CATEGORY: ItemCategory = 'Po\u00e7\u00f5es';
const REAL_WATCHLIST_FALLBACK_CATEGORIES: ItemCategory[] = [
  'Armas',
  'Armaduras',
  'Bolsas',
  'Capas',
  POTIONS_CATEGORY,
  'Comidas',
  'Recursos',
  'Materiais refinados',
];
const QUICK_RESALE_CATEGORIES: ItemCategory[] = [
  'Capas',
  'Bolsas',
  'Armaduras',
  'Armas',
  POTIONS_CATEGORY,
  'Comidas',
  'Materiais refinados',
];
const QUICK_RESALE_CATEGORY_LIMITS: Record<
  ItemCategory,
  { basic: number; pro: number; deep: number }
> = {
  Capas: { basic: 70, pro: 160, deep: 280 },
  Bolsas: { basic: 45, pro: 120, deep: 200 },
  Armaduras: { basic: 95, pro: 240, deep: 460 },
  Armas: { basic: 95, pro: 260, deep: 520 },
  [POTIONS_CATEGORY]: { basic: 25, pro: 80, deep: 130 },
  Comidas: { basic: 30, pro: 90, deep: 150 },
  'Materiais refinados': { basic: 45, pro: 150, deep: 260 },
  Recursos: { basic: 0, pro: 0, deep: 0 },
  Montarias: { basic: 0, pro: 0, deep: 0 },
  Ferramentas: { basic: 0, pro: 0, deep: 0 },
  Itens: { basic: 0, pro: 0, deep: 0 },
};
const BLACK_MARKET_CATEGORIES: ItemCategory[] = ['Armaduras', 'Armas'];
const BLACK_MARKET_CATEGORY_LIMITS: Record<ItemCategory, { basic: number; pro: number; deep: number }> = {
  Bolsas: { basic: 0, pro: 0, deep: 0 },
  Capas: { basic: 0, pro: 0, deep: 0 },
  Armas: { basic: 210, pro: 620, deep: 1100 },
  Armaduras: { basic: 210, pro: 620, deep: 1100 },
  [POTIONS_CATEGORY]: { basic: 0, pro: 0, deep: 0 },
  Comidas: { basic: 0, pro: 0, deep: 0 },
  Recursos: { basic: 0, pro: 0, deep: 0 },
  'Materiais refinados': { basic: 0, pro: 0, deep: 0 },
  Montarias: { basic: 0, pro: 0, deep: 0 },
  Ferramentas: { basic: 0, pro: 0, deep: 0 },
  Itens: { basic: 0, pro: 0, deep: 0 },
};
const REQUIRED_REAL_ITEM_IDS = [
  'T4_BAG',
  'T5_BAG',
  'T6_BAG',
  'T4_CAPE',
  'T5_CAPE',
  'T6_CAPE',
  'T4_POTION_HEAL',
  'T5_POTION_HEAL',
  'T6_POTION_HEAL',
  'T4_MAIN_RAPIER_MORGANA',
  'T5_MAIN_RAPIER_MORGANA',
  'T6_MAIN_RAPIER_MORGANA',
  'T4_2H_DUALSICKLE_UNDEAD',
  'T5_2H_DUALSICKLE_UNDEAD',
  'T6_2H_DUALSICKLE_UNDEAD',
  'T4_METALBAR',
  'T5_METALBAR',
  'T4_PLANKS',
  'T5_PLANKS',
  'T4_LEATHER',
  'T5_LEATHER',
  'T4_CLOTH',
  'T5_CLOTH',
] as const;
const PRO_WATCHLIST_ITEM_IDS = EXTENDED_WATCHLIST_ITEM_IDS;

type OpportunityErrorStage = 'auth' | 'plan' | 'catalog' | 'watchlist' | 'fetch' | 'parse' | 'scoring' | 'filters';
type OpportunityErrorMetadata = Record<string, unknown>;
type OpportunityProfileRow = {
  plan?: SubscriptionPlan;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
};

class OpportunityRouteError extends Error {
  constructor(
    message: string,
    readonly stage: OpportunityErrorStage,
    readonly status = 500,
    readonly metadata: OpportunityErrorMetadata = {},
  ) {
    super(message);
    this.name = 'OpportunityRouteError';
  }
}

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
    | 'includeMicroFlips'
    | 'blackMarketFreshOnly'
    | 'blackMarketMaxAgeHours'
    | 'sortBy'
    | 'watchlistMode'
    | 'minConfidence'
    | 'quickProfile'
    | 'blackMarketProfile'
  >
> &
  Pick<OpportunityFilters, 'budget' | 'minEstimatedProfit'>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const server = normalizeServerParam(searchParams.get('server'));
  const qualityIds = parseQualityIdsParam(searchParams.get('qualities') ?? searchParams.get('quality'));
  const hasAlbionPremium = parseBoolean(searchParams.get('hasAlbionPremium') ?? searchParams.get('premium'));
  const parsedFilters = parseOpportunityFilters(searchParams);
  const selectedPreset = searchParams.get('preset') ?? searchParams.get('selectedPreset') ?? 'manual';
  const requestedScanDepth = parseScanDepth(searchParams.get('scanDepth'));
  const filters: ParsedOpportunityFilters = {
    ...parsedFilters,
    watchlistMode: 'extended',
  };
  const plan: SubscriptionPlan = 'pro';
  const scanDepth = normalizeScanDepthForMode(requestedScanDepth, filters.type);
  const requestedLocations = getRequestedLocations(filters.includeBlackMarket, filters.type);
  let currentStage: OpportunityErrorStage = 'parse';
  let userId: string | undefined;
  let isPro = false;

  if (!server || !MARKET_SERVER_REGIONS.includes(server)) {
    return opportunityErrorResponse(
      new OpportunityRouteError('Servidor inválido. Use server=americas ou server=europe.', 'parse', 400, {
        server: searchParams.get('server'),
      }),
    );
  }

  if (!qualityIds) {
    return opportunityErrorResponse(
      new OpportunityRouteError('Qualidade inválida. Use valores de 1 a 5.', 'parse', 400, {
        quality: searchParams.get('qualities') ?? searchParams.get('quality'),
      }),
    );
  }

  currentStage = 'auth';
  const authorization = await authorizeOpportunityRadar(request);

  if (!authorization.ok) {
    return opportunityErrorResponse(
      new OpportunityRouteError(authorization.message, authorization.stage, authorization.status, {
        code: authorization.code,
        userId: authorization.userId,
        isPro: authorization.isPro ?? false,
        server,
        mode: filters.type,
        scanDepth,
        selectedPreset,
      }),
    );
  }

  userId = authorization.userId;
  isPro = authorization.isPro;

  try {
    currentStage = 'watchlist';
    const watchlistSelection = getRequestedWatchlistItemIds(filters, scanDepth);
    const requestedItemIds = watchlistSelection.itemIds;
    const { catalogItems, invalidItemIds, staticCatalogItemsCount, fallbackReason } = getWatchlistCatalogItems(
      filters,
      requestedItemIds,
    );
    const itemIds = catalogItems.map((item) => item.uniqueName);
    const debug = createOpportunityDebug({
      server,
      plan,
      scanDepth,
      selectedMode: filters.type,
      selectedPreset,
      quickProfile: filters.quickProfile,
      blackMarketProfile: filters.blackMarketProfile,
      watchlistSource: watchlistSelection.source,
      fallbackReason,
      requestedItemIdsCount: requestedItemIds.length,
      validItemIdsCount: catalogItems.length,
      invalidItemIdsCount: invalidItemIds.length,
      staticCatalogItemsCount,
    });

    if (itemIds.length === 0) {
      throw new OpportunityRouteError('Nenhum item válido encontrado para análise.', 'catalog', 422, {
        ...metadataFromDebug(debug),
        invalidItemIds: invalidItemIds.slice(0, 20),
      });
    }

    currentStage = 'fetch';
    const priceBatches = chunk(itemIds, ITEM_BATCH_SIZE);
    const apiUrls = priceBatches.map((batch) => buildAlbionDataPricesUrl(batch, server, qualityIds, requestedLocations).toString());
    const { rows, fetchErrors } = await fetchPriceRows(priceBatches, server, qualityIds, requestedLocations);

    debug.apiReturnedRows = rows.length;
    debug.fetchErrors = fetchErrors.length > 0 ? fetchErrors.map((error) => error.message) : undefined;

    if (rows.length === 0 && fetchErrors.length > 0) {
      throw new OpportunityRouteError('Não foi possível consultar os dados públicos agora.', 'fetch', 502, {
        ...metadataFromDebug(debug),
        apiUrl: developmentOnly(apiUrls[0]),
        fetchErrors: fetchErrors.map((error) => ({
          message: error.message,
          status: error.status,
          url: developmentOnly(error.url),
        })),
      });
    }

    currentStage = 'scoring';
    const sortedOpportunities = sortOpportunities(
      catalogItems.flatMap((catalogItem) => {
        const item = buildMarketItem(catalogItem, qualityIds, rows, server);
        collectItemPriceDebug(debug, item);

        return buildOpportunitiesForItem(item, server, hasAlbionPremium, filters, getSourceHost(server), debug);
      }),
      filters.sortBy,
    );
    const opportunities = (
      filters.type === 'black-market'
        ? prioritizeBlackMarketFirstPageDiversity(sortedOpportunities)
        : sortedOpportunities
    ).slice(0, MAX_RESULTS);
    debug.finalOpportunitiesCount = opportunities.length;
    const response: MarketOpportunitiesResponse = {
      ...buildMarketMeta(
        server,
        qualityIds,
        opportunities.length > 0
          ? 'Oportunidades ranqueadas por score, lucro, margem, risco e frescor dos dados.'
          : buildEmptyRadarMessage(debug),
        'live',
        requestedLocations,
      ),
      opportunities,
      monitoredItemIds: itemIds,
      analyzedItems: catalogItems.length,
      evaluatedRoutes: debug.rawCandidatesCount,
      displayedOpportunities: opportunities.length,
      analyzedAt: new Date().toISOString(),
      filters,
      debug,
    };

    logDevelopmentDebug({
      userId,
      isPro,
      server,
      mode: filters.type,
      scanDepth,
      selectedPreset,
      quickProfile: filters.quickProfile,
      blackMarketProfile: filters.blackMarketProfile,
      requestedItemIdsCount: debug.requestedItemIdsCount,
      validItemIdsCount: debug.validItemIdsCount,
      apiUrl: apiUrls[0],
      apiReturnedRows: debug.apiReturnedRows,
      rawCandidatesCount: debug.rawCandidatesCount,
      finalOpportunitiesCount: debug.finalOpportunitiesCount,
      fetchErrors: debug.fetchErrors,
      error: null,
    });
    return NextResponse.json(response);
  } catch (error) {
    const routeError = error instanceof OpportunityRouteError
      ? error
      : new OpportunityRouteError(getErrorMessage(error), currentStage, currentStage === 'fetch' ? 502 : 500, {
        userId,
        isPro,
        server,
        mode: filters.type,
        scanDepth,
        selectedPreset,
      });

    return opportunityErrorResponse(routeError);
  }
}

async function authorizeOpportunityRadar(request: Request): Promise<
  | { ok: true; userId: string; isPro: true }
  | {
      ok: false;
      status: 401 | 403 | 503;
      code: 'auth_required' | 'pro_required' | 'supabase_unavailable';
      stage: 'auth' | 'plan';
      message: string;
      userId?: string;
      isPro?: boolean;
    }
> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);
  const authDebug: {
    hasAuthHeader: boolean;
    hasToken: boolean;
    userId?: string;
    profileFound?: boolean;
    profilePlan?: string | null;
    subscriptionStatus?: string | null;
    subscriptionCurrentPeriodEnd?: string | null;
    isPro?: boolean;
  } = {
    hasAuthHeader: Boolean(authHeader),
    hasToken: Boolean(token),
  };

  if (!token) {
    logDevelopmentAuth(authDebug);

    return {
      ok: false,
      status: 401,
      code: 'auth_required',
      stage: 'auth',
      message: 'Usuário não autenticado.',
      isPro: false,
    };
  }

  const publicConfig = getSupabasePublicConfig();
  const admin = getSupabaseAdmin();
  const tokenSupabase = publicConfig
    ? createClient(publicConfig.url, publicConfig.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
    : null;
  const authSupabase = admin ?? tokenSupabase;

  if (!authSupabase) {
    logDevelopmentAuth(authDebug);

    return {
      ok: false,
      status: 503,
      code: 'supabase_unavailable',
      stage: 'auth',
      message: 'Supabase não configurado. Não foi possível validar o plano PRO.',
      isPro: false,
    };
  }

  const { data: authData, error: authError } = await authSupabase.auth.getUser(token);
  authDebug.userId = authData.user?.id;

  if (authError || !authData.user) {
    logDevelopmentAuth(authDebug);

    return {
      ok: false,
      status: 401,
      code: 'auth_required',
      stage: 'auth',
      message: 'Sessão inválida ou expirada.',
      isPro: false,
    };
  }

  const profileSupabase = admin ?? tokenSupabase;
  const { data: profile, error: profileError } = await profileSupabase!
    .from('profiles')
    .select('plan, subscription_status, subscription_current_period_end')
    .eq('id', authData.user.id)
    .maybeSingle();
  const typedProfile = profile as OpportunityProfileRow | null;
  authDebug.profileFound = Boolean(typedProfile);
  authDebug.profilePlan = typedProfile?.plan ?? null;
  authDebug.subscriptionStatus = typedProfile?.subscription_status ?? null;
  authDebug.subscriptionCurrentPeriodEnd = typedProfile?.subscription_current_period_end ?? null;

  if (profileError) {
    logDevelopmentAuth({
      ...authDebug,
      isPro: false,
    });

    return {
      ok: false,
      status: 503,
      code: 'supabase_unavailable',
      stage: 'auth',
      message: 'Não foi possível carregar o perfil.',
      userId: authData.user.id,
      isPro: false,
    };
  }

  if (!typedProfile) {
    logDevelopmentAuth({
      ...authDebug,
      isPro: false,
    });

    return {
      ok: false,
      status: 401,
      code: 'auth_required',
      stage: 'auth',
      message: 'Perfil não encontrado.',
      userId: authData.user.id,
      isPro: false,
    };
  }

  const isActivePro = isUserPro({
    plan: typedProfile?.plan === 'pro' ? 'pro' : 'free',
    subscriptionStatus: (typedProfile?.subscription_status ?? 'free') as SubscriptionStatus,
    subscriptionCurrentPeriodEnd: typedProfile?.subscription_current_period_end ?? undefined,
  });
  authDebug.isPro = isActivePro;
  logDevelopmentAuth(authDebug);

  if (!isActivePro) {
    return {
      ok: false,
      status: 403,
      code: 'pro_required',
      stage: 'plan',
      message: 'Radar de Oportunidades é exclusivo PRO.',
      userId: authData.user.id,
      isPro: false,
    };
  }

  return { ok: true, userId: authData.user.id, isPro: true };
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());

  return match?.[1]?.trim() || null;
}

function logDevelopmentAuth(payload: {
  hasAuthHeader: boolean;
  hasToken: boolean;
  userId?: string;
  profileFound?: boolean;
  profilePlan?: string | null;
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  isPro?: boolean;
}) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('[opportunities auth]', payload);
}

async function fetchPriceRows(
  priceBatches: string[][],
  server: ServerRegion,
  qualityIds: number[],
  locations: AlbionCity[],
): Promise<{ rows: AlbionDataPriceResponse[]; fetchErrors: Array<{ message: string; status: number | null; url?: string }> }> {
  const results = await Promise.allSettled(
    priceBatches.map((batch) => fetchAlbionDataPrices(batch, server, qualityIds, locations)),
  );
  const rows: AlbionDataPriceResponse[] = [];
  const fetchErrors: Array<{ message: string; status: number | null; url?: string }> = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      rows.push(...result.value);
      return;
    }

    const reason = result.reason;

    if (reason instanceof AlbionDataApiError) {
      fetchErrors.push({
        message: reason.message,
        status: reason.status,
        url: reason.url,
      });
      return;
    }

    fetchErrors.push({
      message: getErrorMessage(reason),
      status: null,
    });
  });

  return { rows, fetchErrors };
}

function opportunityErrorResponse(error: OpportunityRouteError) {
  const metadata = sanitizeMetadata(error.metadata);

  logDevelopmentDebug({
    ...metadata,
    stage: error.stage,
    error: error.message,
  });

  return NextResponse.json(
    {
      ok: false,
      error: error.message,
      stage: error.stage,
      metadata,
    },
    { status: error.status },
  );
}

function metadataFromDebug(debug: OpportunityRadarDebug): OpportunityErrorMetadata {
  return {
    server: debug.server,
    plan: debug.plan,
    scanDepth: debug.scanDepth,
    mode: debug.selectedMode,
    selectedPreset: debug.selectedPreset,
    quickProfile: debug.quickProfile,
    blackMarketProfile: debug.blackMarketProfile,
    watchlistSource: debug.watchlistSource,
    fallbackReason: debug.fallbackReason,
    requestedItemIdsCount: debug.requestedItemIdsCount,
    validItemIdsCount: debug.validItemIdsCount,
    staticCatalogItemsCount: debug.staticCatalogItemsCount,
    apiReturnedRows: debug.apiReturnedRows,
    rawCandidatesCount: debug.rawCandidatesCount,
    afterPositiveProfitCount: debug.afterPositiveProfitCount,
    afterMinProfitCount: debug.afterMinProfitCount,
    afterMinMarginCount: debug.afterMinMarginCount,
    afterMicroFlipFilterCount: debug.afterMicroFlipFilterCount,
    belowMinProfit: debug.rejectionReasons.belowMinProfit,
    microFlip: debug.rejectionReasons.microFlip,
    staleBlackMarketData: debug.rejectionReasons.staleBlackMarketData,
    finalOpportunitiesCount: debug.finalOpportunitiesCount,
  };
}

function sanitizeMetadata(metadata: OpportunityErrorMetadata): OpportunityErrorMetadata {
  if (process.env.NODE_ENV === 'development') return metadata;

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => key !== 'apiUrl')
      .map(([key, value]) => {
        if (key !== 'fetchErrors' || !Array.isArray(value)) return [key, value];

        return [
          key,
          value.map((error) => {
            if (!error || typeof error !== 'object') return error;
            const safeError = { ...(error as Record<string, unknown>) };
            delete safeError.url;

            return safeError;
          }),
        ];
      }),
  );
}

function developmentOnly<T>(value: T): T | undefined {
  return process.env.NODE_ENV === 'development' ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro inesperado ao verificar oportunidades.';
}

function getRequestedWatchlistItemIds(
  filters: ParsedOpportunityFilters,
  scanDepth: OpportunityScanDepth,
): { itemIds: string[]; source: string } {
  if (filters.type === 'black-market') {
    const blackMarketItemIds = getBlackMarketCatalogItemIds(filters, scanDepth);

    return {
      itemIds: normalizeItemIds([...blackMarketItemIds, ...BLACK_MARKET_WATCHLIST_ITEM_IDS, ...REQUIRED_REAL_ITEM_IDS]),
      source: `black_market_catalog_${scanDepth}`,
    };
  }

  if (filters.type === 'quick-sale') {
    const quickItemIds = getQuickResaleCatalogItemIds(filters, scanDepth);

    return {
      itemIds: normalizeItemIds([...quickItemIds, ...REQUIRED_REAL_ITEM_IDS]),
      source: `quick_resale_catalog_${scanDepth}`,
    };
  }

  if (filters.type === 'all') {
    const quickItemIds = getQuickResaleCatalogItemIds(filters, scanDepth);
    const blackMarketItemIds = getBlackMarketCatalogItemIds(filters, scanDepth);

    return {
      itemIds: normalizeItemIds([
        ...blackMarketItemIds,
        ...quickItemIds,
        ...BLACK_MARKET_WATCHLIST_ITEM_IDS,
        ...PRO_WATCHLIST_ITEM_IDS,
        ...EXTENDED_WATCHLIST_ITEM_IDS,
        ...REQUIRED_REAL_ITEM_IDS,
      ]),
      source: `mixed_black_market_${scanDepth}`,
    };
  }

  const watchlists = [
    { source: 'pro', itemIds: PRO_WATCHLIST_ITEM_IDS },
    { source: 'extended', itemIds: EXTENDED_WATCHLIST_ITEM_IDS },
    { source: 'basic', itemIds: BASIC_WATCHLIST_ITEM_IDS },
    { source: 'hardcoded', itemIds: [...REQUIRED_REAL_ITEM_IDS] },
  ];
  const selectedWatchlist = watchlists.find((watchlist) => watchlist.itemIds.length > 0) ?? watchlists.at(-1);
  const deepItemIds = scanDepth === 'deep' ? getFallbackPopularCatalogItemIds(filters) : [];
  const itemIds = normalizeItemIds([
    ...(selectedWatchlist?.itemIds ?? []),
    ...deepItemIds,
    ...REQUIRED_REAL_ITEM_IDS,
  ]);

  return {
    itemIds,
    source: selectedWatchlist?.source ?? 'hardcoded',
  };
}

function getQuickResaleCatalogItemIds(
  filters: ParsedOpportunityFilters,
  scanDepth: OpportunityScanDepth,
): string[] {
  try {
    const catalog = getItemCatalog()
      .filter((item) => item.marketable !== false)
      .filter((item) => isQuickResaleCatalogCandidate(item))
      .filter((item) => filters.category === 'all' || item.category === filters.category)
      .filter((item) => filters.tier === 'all' || item.tier === filters.tier)
      .filter((item) => filters.enchantment === 'all' || item.enchantment === filters.enchantment)
      .sort(compareQuickResaleCatalogItems);
    const staticValidIds = QUICK_RESALE_WATCHLIST_ITEM_IDS
      .map((itemId) => findCatalogItemByUniqueName(itemId)?.uniqueName)
      .filter((itemId): itemId is string => Boolean(itemId));
    const dynamicIds = selectBalancedQuickResaleIds(catalog, filters, scanDepth);

    return normalizeItemIds([...staticValidIds, ...dynamicIds]).slice(0, getQuickResaleDepthLimit(scanDepth));
  } catch {
    return QUICK_RESALE_WATCHLIST_ITEM_IDS
      .map((itemId) => findCatalogItemByUniqueName(itemId)?.uniqueName)
      .filter((itemId): itemId is string => Boolean(itemId))
      .slice(0, getQuickResaleDepthLimit(scanDepth));
  }
}

function selectBalancedQuickResaleIds(
  catalog: ItemCatalogEntry[],
  filters: ParsedOpportunityFilters,
  scanDepth: OpportunityScanDepth,
): string[] {
  const depth = getQuickResaleDepthKey(scanDepth);

  if (filters.category !== 'all') {
    return catalog
      .filter((item) => item.category === filters.category)
      .slice(0, getQuickResaleDepthLimit(scanDepth))
      .map((item) => item.uniqueName);
  }

  return QUICK_RESALE_CATEGORIES.flatMap((category) => {
    const limit = QUICK_RESALE_CATEGORY_LIMITS[category]?.[depth] ?? 0;

    return catalog
      .filter((item) => item.category === category)
      .slice(0, limit)
      .map((item) => item.uniqueName);
  });
}

function isQuickResaleCatalogCandidate(item: ItemCatalogEntry): boolean {
  if (item.tier < 4 || item.tier > 8) return false;
  if (item.enchantment < 0 || item.enchantment > 3) return false;
  if (!QUICK_RESALE_CATEGORIES.includes(item.category)) return false;
  if (/^T[1-8]_ARTEFACT_/i.test(item.uniqueName)) return false;

  if (item.category === 'Capas' || item.category === 'Bolsas') return true;
  if (item.category === POTIONS_CATEGORY) {
    return /POTION_(HEAL|ENERGY|STONESKIN|COOLDOWN|ACID|BERSERK|CLEANSE|MOB_RESET)/i.test(item.uniqueName);
  }
  if (item.category === 'Materiais refinados') {
    return /_(METALBAR|PLANKS|LEATHER|CLOTH|STONEBLOCK)(@|$)/i.test(item.uniqueName);
  }
  if (item.category === 'Comidas') {
    return /MEAL_(OMELETTE|STEW|SANDWICH|PIE|SALAD|SOUP)/i.test(item.uniqueName);
  }
  if (item.category === 'Armaduras') {
    return /_(ARMOR|HEAD|SHOES)_(CLOTH|LEATHER|PLATE)_(SET|MORGANA|UNDEAD|KEEPER|HELL|AVALON)/i.test(item.uniqueName);
  }
  if (item.category === 'Armas') {
    return /_(MAIN|2H)_(RAPIER|DAGGER|DAGGERPAIR|DUALSICKLE|BOW|CROSSBOW|SWORD|CLAYMORE|AXE|SPEAR|HAMMER|MACE|FIRESTAFF|FROSTSTAFF|ARCANESTAFF|CURSEDSTAFF|HOLYSTAFF|NATURESTAFF)/i.test(item.uniqueName);
  }

  return false;
}

function compareQuickResaleCatalogItems(a: ItemCatalogEntry, b: ItemCatalogEntry): number {
  const scoreA = quickResaleItemPriority(a);
  const scoreB = quickResaleItemPriority(b);

  if (scoreA !== scoreB) return scoreA - scoreB;
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.enchantment !== b.enchantment) return a.enchantment - b.enchantment;

  return a.uniqueName.localeCompare(b.uniqueName);
}

function quickResaleItemPriority(item: ItemCatalogEntry): number {
  let score = QUICK_RESALE_CATEGORIES.indexOf(item.category) * 1000;

  if (item.enchantment >= 1 && item.enchantment <= 2) score -= 80;
  if (item.enchantment === 3) score += 40;
  if (item.tier >= 5 && item.tier <= 7) score -= 60;
  if (/CAPEITEM_FW|_BAG|POTION_HEAL|POTION_STONESKIN|POTION_COOLDOWN|MEAL_OMELETTE|MEAL_STEW/i.test(item.uniqueName)) {
    score -= 120;
  }
  if (/RAPIER_MORGANA|DAGGER|BOW|CROSSBOW|SWORD|AXE|SPEAR|HOLYSTAFF|NATURESTAFF/i.test(item.uniqueName)) {
    score -= 90;
  }
  if (/_SET[123](@|$)/i.test(item.uniqueName)) score -= 70;

  return score;
}

function getQuickResaleDepthKey(scanDepth: OpportunityScanDepth): 'basic' | 'pro' | 'deep' {
  if (scanDepth === 'quick_deep' || scanDepth === 'deep') return 'deep';
  if (scanDepth === 'quick_basic' || scanDepth === 'basic') return 'basic';

  return 'pro';
}

function getQuickResaleDepthLimit(scanDepth: OpportunityScanDepth): number {
  const depth = getQuickResaleDepthKey(scanDepth);

  if (depth === 'deep') return QUICK_RESALE_DEEP_LIMIT;
  if (depth === 'basic') return QUICK_RESALE_BASIC_LIMIT;

  return QUICK_RESALE_PRO_LIMIT;
}

function getBlackMarketCatalogItemIds(
  filters: ParsedOpportunityFilters,
  scanDepth: OpportunityScanDepth,
): string[] {
  try {
    const catalog = getItemCatalog()
      .filter((item) => item.marketable !== false)
      .filter((item) => isBlackMarketCatalogCandidate(item))
      .filter((item) => filters.category === 'all' || item.category === filters.category)
      .filter((item) => filters.tier === 'all' || item.tier === filters.tier)
      .filter((item) => filters.enchantment === 'all' || item.enchantment === filters.enchantment)
      .sort(compareBlackMarketCatalogItems);
    const staticValidIds = BLACK_MARKET_WATCHLIST_ITEM_IDS
      .map((itemId) => findCatalogItemByUniqueName(itemId)?.uniqueName)
      .filter((itemId): itemId is string => Boolean(itemId));
    const dynamicIds = selectBalancedBlackMarketIds(catalog, filters, scanDepth);

    return normalizeItemIds([...staticValidIds, ...dynamicIds]).slice(0, getBlackMarketDepthLimit(scanDepth));
  } catch {
    return BLACK_MARKET_WATCHLIST_ITEM_IDS
      .map((itemId) => findCatalogItemByUniqueName(itemId)?.uniqueName)
      .filter((itemId): itemId is string => Boolean(itemId))
      .slice(0, getBlackMarketDepthLimit(scanDepth));
  }
}

function selectBalancedBlackMarketIds(
  catalog: ItemCatalogEntry[],
  filters: ParsedOpportunityFilters,
  scanDepth: OpportunityScanDepth,
): string[] {
  const depth = getBlackMarketDepthKey(scanDepth);

  if (filters.category !== 'all') {
    return catalog
      .filter((item) => item.category === filters.category)
      .slice(0, getBlackMarketDepthLimit(scanDepth))
      .map((item) => item.uniqueName);
  }

  return BLACK_MARKET_CATEGORIES.flatMap((category) => {
    const limit = BLACK_MARKET_CATEGORY_LIMITS[category]?.[depth] ?? 0;

    return catalog
      .filter((item) => item.category === category)
      .slice(0, limit)
      .map((item) => item.uniqueName);
  });
}

function isBlackMarketCatalogCandidate(item: ItemCatalogEntry): boolean {
  if (item.tier < 4 || item.tier > 8) return false;
  if (item.enchantment < 0 || item.enchantment > 3) return false;
  if (!BLACK_MARKET_CATEGORIES.includes(item.category)) return false;
  if (/^T[1-8]_ARTEFACT_/i.test(item.uniqueName)) return false;

  if (item.category === 'Armaduras') {
    return /_(ARMOR|HEAD|SHOES)_(CLOTH|LEATHER|PLATE)_(SET|MORGANA|UNDEAD|KEEPER|HELL|AVALON)/i.test(item.uniqueName);
  }

  if (item.category === 'Armas') {
    return /_(MAIN|2H)_(SWORD|CLAYMORE|AXE|BOW|CROSSBOW|SPEAR|HAMMER|MACE|DAGGER|DAGGERPAIR|RAPIER|DUALSICKLE|FIRESTAFF|FROSTSTAFF|ARCANESTAFF|CURSEDSTAFF|HOLYSTAFF|NATURESTAFF)/i.test(item.uniqueName);
  }

  return false;
}

function compareBlackMarketCatalogItems(a: ItemCatalogEntry, b: ItemCatalogEntry): number {
  const scoreA = blackMarketItemPriority(a);
  const scoreB = blackMarketItemPriority(b);

  if (scoreA !== scoreB) return scoreA - scoreB;
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.enchantment !== b.enchantment) return a.enchantment - b.enchantment;

  return a.uniqueName.localeCompare(b.uniqueName);
}

function blackMarketItemPriority(item: ItemCatalogEntry): number {
  let score = BLACK_MARKET_CATEGORIES.indexOf(item.category) * 1000;

  if (item.enchantment >= 1 && item.enchantment <= 2) score -= 80;
  if (item.enchantment === 3) score += 20;
  if (item.tier >= 5 && item.tier <= 7) score -= 80;
  if (/_SET[123](@|$)|RAPIER_MORGANA|DUALSICKLE_UNDEAD|DAGGER|BOW|CROSSBOW|HOLYSTAFF|NATURESTAFF/i.test(item.uniqueName)) {
    score -= 120;
  }
  if (/KEEPER|MORGANA|UNDEAD|AVALON/i.test(item.uniqueName)) score += 80;

  return score;
}

function getBlackMarketDepthKey(scanDepth: OpportunityScanDepth): 'basic' | 'pro' | 'deep' {
  if (scanDepth === 'black_market_deep' || scanDepth === 'deep') return 'deep';
  if (scanDepth === 'black_market_basic' || scanDepth === 'basic') return 'basic';

  return 'pro';
}

function getBlackMarketDepthLimit(scanDepth: OpportunityScanDepth): number {
  const depth = getBlackMarketDepthKey(scanDepth);

  if (depth === 'deep') return BLACK_MARKET_DEEP_LIMIT;
  if (depth === 'basic') return BLACK_MARKET_BASIC_LIMIT;

  return BLACK_MARKET_PRO_LIMIT;
}

function getWatchlistCatalogItems(
  filters: ParsedOpportunityFilters,
  requestedItemIds: string[],
): {
  catalogItems: ItemCatalogEntry[];
  invalidItemIds: string[];
  staticCatalogItemsCount: number;
  fallbackReason?: string;
} {
  const invalidItemIds: string[] = [];
  const staticCatalogItemIds = new Set<string>();
  const catalogItems = buildCatalogItemsForIds(filters, requestedItemIds, invalidItemIds, staticCatalogItemIds);

  if (catalogItems.length > 0) {
    return {
      catalogItems,
      invalidItemIds,
      staticCatalogItemsCount: staticCatalogItemIds.size,
    };
  }

  const relaxedFilters: ParsedOpportunityFilters = {
    ...filters,
    category: 'all',
    tier: 'all',
    enchantment: 'all',
  };
  const fallbackCatalogItems = buildCatalogItemsForIds(
    relaxedFilters,
    REQUIRED_REAL_ITEM_IDS,
    invalidItemIds,
    staticCatalogItemIds,
  );

  return {
    catalogItems: fallbackCatalogItems,
    invalidItemIds,
    staticCatalogItemsCount: staticCatalogItemIds.size,
    fallbackReason: 'filters_empty',
  };
}

function buildCatalogItemsForIds(
  filters: ParsedOpportunityFilters,
  itemIds: readonly string[],
  invalidItemIds: string[],
  staticCatalogItemIds: Set<string>,
): ItemCatalogEntry[] {
  const seen = new Set<string>();

  return itemIds
    .map((itemId) => {
      const item = findCatalogItemByUniqueName(itemId) ?? buildStaticCatalogItem(itemId);
      if (!item) {
        invalidItemIds.push(itemId);
        return null;
      }
      if (item.resolvedFromUniqueName === 'static-radar-watchlist') {
        staticCatalogItemIds.add(item.uniqueName);
      }

      return item;
    })
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

function getFallbackPopularCatalogItemIds(filters: ParsedOpportunityFilters): string[] {
  try {
    return getItemCatalog()
      .filter((item) => item.marketable !== false)
      .filter((item) => REAL_WATCHLIST_FALLBACK_CATEGORIES.includes(item.category))
      .filter((item) => filters.category === 'all' || item.category === filters.category)
      .filter((item) => filters.tier === 'all' || item.tier === filters.tier)
      .filter((item) => filters.enchantment === 'all' || item.enchantment === filters.enchantment)
      .filter((item) => item.tier >= 4 && item.tier <= 8)
      .filter((item) => item.enchantment >= 0 && item.enchantment <= 2)
      .slice(0, FALLBACK_CATALOG_LIMIT)
      .map((item) => item.uniqueName);
  } catch {
    return [];
  }
}

function normalizeItemIds(itemIds: readonly string[]): string[] {
  return Array.from(
    new Set(
      itemIds
        .map((itemId) => itemId.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function buildStaticCatalogItem(itemId: string): ItemCatalogEntry | null {
  const uniqueName = itemId.trim().toUpperCase();
  const tierMatch = /^T([1-8])_/.exec(uniqueName);
  if (!tierMatch) return null;

  const enchantmentMatch = /@([1-4])$/.exec(uniqueName);
  const enchantment = (enchantmentMatch ? Number(enchantmentMatch[1]) : 0) as Enchantment;
  const tier = Number(tierMatch[1]) as Tier;
  const familyId = uniqueName.replace(/^T[1-8]_/, '').replace(/@[1-4]$/, '');
  const staticName = formatStaticItemName(uniqueName, familyId);

  return {
    itemId: uniqueName,
    uniqueName,
    nameEn: staticName,
    namePtBR: staticName,
    familyId,
    baseNameEn: staticName,
    baseNamePtBR: staticName,
    resolvedFromUniqueName: 'static-radar-watchlist',
    aliases: [uniqueName, familyId],
    tier,
    enchantment,
    defaultQuality: 'Normal',
    category: inferStaticCategory(familyId),
    subcategory: familyId,
    marketable: true,
  };
}

function inferStaticCategory(familyId: string): ItemCategory {
  if (familyId.includes('BAG')) return 'Bolsas';
  if (familyId.includes('CAPE')) return 'Capas';
  if (familyId.includes('POTION')) return 'Poções';
  if (familyId.includes('MEAL')) return 'Comidas';
  if (['METALBAR', 'PLANKS', 'LEATHER', 'CLOTH'].includes(familyId)) return 'Materiais refinados';
  if (['ORE', 'WOOD', 'HIDE', 'FIBER', 'ROCK'].includes(familyId)) return 'Recursos';
  if (familyId.startsWith('MAIN_') || familyId.startsWith('2H_')) return 'Armas';
  if (familyId.startsWith('ARMOR_') || familyId.startsWith('HEAD_') || familyId.startsWith('SHOES_')) {
    return 'Armaduras';
  }
  if (familyId.startsWith('MOUNT_')) return 'Montarias';
  if (familyId.startsWith('TOOL_')) return 'Ferramentas';

  return 'Itens';
}

function formatStaticItemName(uniqueName: string, familyId: string): string {
  return `${uniqueName.split('_')[0]} ${familyId.toLowerCase().replaceAll('_', ' ')}`;
}

function buildOpportunitiesForItem(
  item: Item,
  server: ServerRegion,
  hasAlbionPremium: boolean,
  filters: ParsedOpportunityFilters,
  sourceHost: string,
  debug: OpportunityRadarDebug,
): Opportunity[] {
  if (!item.hasMarketData) {
    debug.rejectionReasons.noPriceData += 1;
    return [];
  }

  const opportunities: Opportunity[] = [];
  const buyCandidates = item.prices.filter((price) => isValidBuyCandidate(price, filters));
  if (buyCandidates.length === 0) debug.rejectionReasons.noSellPrice += 1;
  const validSellPrices = item.prices
    .map((price) => price.sellPriceMin)
    .filter((price) => Number.isFinite(price) && price > 0);
  const marketContext = {
    referenceSellMedian: calculateMedianPrice(validSellPrices),
    validSellPriceCount: validSellPrices.length,
    maxAgeHours: filters.maxAgeHours,
  };

  if (filters.type === 'all' || filters.type === 'black-market') {
    const blackMarketSell = item.prices.find((price) => isValidBlackMarketSellCandidate(price));
    const blackMarketBuyCandidates = item.prices.filter((price) => isValidBlackMarketBuyCandidate(price, filters));

    if (!blackMarketSell) debug.rejectionReasons.noBuyPrice += 1;
    if (blackMarketBuyCandidates.length === 0) debug.rejectionReasons.noSellPrice += 1;

    if (blackMarketSell) {
      for (const buy of blackMarketBuyCandidates) {
        const opportunity = buildOpportunity({
          item,
          server,
          type: 'black-market',
          buy,
          sell: blackMarketSell,
          buyPrice: buy.sellPriceMin,
          sellPrice: blackMarketSell.buyPriceMax,
          sellPriceReference: 'buy-order',
          hasAlbionPremium,
          filters,
          sourceHost,
          marketContext,
          debug,
        });

        if (opportunity) opportunities.push(opportunity);
      }
    }
  }

  if (filters.type === 'all' || filters.type === 'quick-sale') {
    const sellCandidates = item.prices.filter((price) => isValidQuickSellCandidate(price, filters));
    if (sellCandidates.length === 0) debug.rejectionReasons.noBuyPrice += 1;

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
          hasAlbionPremium,
          filters,
          sourceHost,
          marketContext,
          debug,
        });

        if (opportunity) opportunities.push(opportunity);
      }
    }
  }

  if (filters.type === 'all' || filters.type === 'listed-resale') {
    const sellCandidates = item.prices.filter((price) => isValidListedSellCandidate(price, filters));
    if (sellCandidates.length === 0) debug.rejectionReasons.noSellPrice += 1;

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
          hasAlbionPremium,
          filters,
          sourceHost,
          marketContext,
          debug,
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
  hasAlbionPremium,
  filters,
  sourceHost,
  marketContext,
  debug,
}: {
  item: Item;
  server: ServerRegion;
  type: OpportunityType;
  buy: CityPrice;
  sell: CityPrice;
  buyPrice: number;
  sellPrice: number;
  sellPriceReference: Opportunity['sellPriceReference'];
  hasAlbionPremium: boolean;
  filters: ParsedOpportunityFilters;
  sourceHost: string;
  marketContext: OpportunityMarketContext;
  debug: OpportunityRadarDebug;
}): Opportunity | null {
  debug.rawCandidatesCount += 1;

  if (buy.city === sell.city) {
    debug.rejectionReasons.sameCity += 1;
    return null;
  }

  if (buyPrice <= 0) {
    debug.rejectionReasons.noSellPrice += 1;
    return null;
  }

  if (sellPrice <= 0) {
    debug.rejectionReasons.noBuyPrice += 1;
    return null;
  }

  const buyUpdatedAt = buy.sellUpdatedAt || buy.updatedAt;
  const sellUpdatedAt =
    type === 'quick-sale' || type === 'black-market'
      ? sell.buyUpdatedAt || sell.updatedAt
      : sell.sellUpdatedAt || sell.updatedAt;
  const buyAgeHours = getAgeHours(buyUpdatedAt);
  const sellAgeHours = getAgeHours(sellUpdatedAt);
  const maxDataAgeHours = Math.max(buyAgeHours, sellAgeHours);

  if (!Number.isFinite(maxDataAgeHours) || maxDataAgeHours > filters.maxAgeHours) {
    debug.rejectionReasons.tooOld += 1;
    return null;
  }

  if (
    type === 'black-market' &&
    filters.blackMarketFreshOnly &&
    (!Number.isFinite(sellAgeHours) || sellAgeHours > filters.blackMarketMaxAgeHours)
  ) {
    debug.rejectionReasons.staleBlackMarketData += 1;
    return null;
  }
  debug.afterAgeFilterCount += 1;

  const profit =
    type === 'quick-sale' || type === 'black-market'
      ? calculateInstantSellProfitBreakdown(buyPrice, sellPrice, hasAlbionPremium)
      : calculateSellOrderProfitBreakdown(buyPrice, sellPrice, hasAlbionPremium);

  if (profit.netProfit <= 0) {
    debug.rejectionReasons.negativeProfit += 1;
    return null;
  }
  debug.afterPositiveProfitCount += 1;

  if (profit.netProfit < filters.minProfit) {
    debug.rejectionReasons.belowMinProfit += 1;
    return null;
  }
  debug.afterMinProfitCount += 1;

  if (profit.margin < filters.minMargin) {
    debug.rejectionReasons.belowMinMargin += 1;
    return null;
  }
  debug.afterMinMarginCount += 1;

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

  if (sanity.isSuspicious && !filters.includeSuspicious) {
    debug.rejectionReasons.suspicious += 1;
    return null;
  }
  debug.afterSuspiciousFilterCount += 1;

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

  if (!matchesConfidenceMinimum(confidence.level, filters.minConfidence)) {
    debug.rejectionReasons.lowConfidence += 1;
    return null;
  }
  if (filters.maxRisk !== 'all' && riskRank(risk.level) > riskRank(filters.maxRisk)) {
    debug.rejectionReasons.highRisk += 1;
    return null;
  }

  const budget = filters.budget ?? 0;
  const suggestedQuantity = calculateSuggestedQuantity({
    budget,
    buyPrice,
    category: item.category,
  });
  const estimatedInvestment = buyPrice * suggestedQuantity;
  const estimatedNetProfit = profit.netProfit * suggestedQuantity;
  const practicalQualityBase = evaluateOpportunityQuality({
    netProfitPerUnit: profit.netProfit,
    estimatedNetProfit,
    margin: profit.margin,
    buyPrice,
    buyCity: buy.city,
    sellCity: sell.city,
    category: item.category,
    confidence: confidence.level,
    isSuspicious: sanity.isSuspicious,
  });
  const practicalQuality = adjustQuickResalePracticalQuality({
    type,
    quickProfile: filters.quickProfile,
    blackMarketProfile: filters.blackMarketProfile,
    practicalQuality: practicalQualityBase,
    netProfitPerUnit: profit.netProfit,
    estimatedNetProfit,
    margin: profit.margin,
    isSuspicious: sanity.isSuspicious,
  });
  const estimatedLiquidity = calculateEstimatedLiquidity({
    type,
    blackMarketAgeHours: sellAgeHours,
    category: item.category,
    itemId: item.uniqueName,
    hasBlackMarketBuyOrder: sell.buyPriceMax > 0,
  });

  if (practicalQuality.isMicroFlip && !filters.includeMicroFlips) {
    debug.rejectionReasons.microFlip += 1;
    return null;
  }

  if (filters.budget && estimatedNetProfit < (filters.minEstimatedProfit ?? DEFAULT_MIN_ESTIMATED_PROFIT)) {
    debug.rejectionReasons.belowEstimatedProfit += 1;
    return null;
  }

  if (!shouldShowOpportunityByQuality(
    {
      netProfit: profit.netProfit,
      netProfitPerUnit: profit.netProfit,
      estimatedNetProfit,
      isMicroFlip: practicalQuality.isMicroFlip,
      worthLevel: practicalQuality.worthLevel,
      isSuspicious: sanity.isSuspicious,
    },
    filters,
  )) {
    debug.rejectionReasons.weakOpportunity += 1;
    return null;
  }
  debug.afterMicroFlipFilterCount += 1;

  const score = calculateOpportunityScore({
    type,
    netProfit: profit.netProfit,
    estimatedNetProfit,
    margin: profit.margin,
    maxDataAgeHours,
    risk: risk.level,
    buyPrice,
    budget,
    minProfit: filters.minProfit,
    minEstimatedProfit: filters.minEstimatedProfit,
    isMicroFlip: practicalQuality.isMicroFlip,
    sellPriceReference,
    buyCity: buy.city,
    sellCity: sell.city,
    category: item.category,
    confidence: confidence.level,
    sanity,
    estimatedLiquidity: estimatedLiquidity.level,
    blackMarketAgeHours: sellAgeHours,
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
    blackMarketBuyPrice: type === 'black-market' ? sell.buyPriceMax : undefined,
    blackMarketUpdatedAt: type === 'black-market' ? sellUpdatedAt : undefined,
    blackMarketAgeHours: type === 'black-market' ? sellAgeHours : undefined,
    estimatedLiquidity: type === 'black-market' ? estimatedLiquidity.level : undefined,
    estimatedLiquidityReasons: type === 'black-market' ? estimatedLiquidity.reasons : undefined,
    quantityAvailableLabel: type === 'black-market' ? 'não informada pela API' : undefined,
    quantityAvailableSource: type === 'black-market' ? 'not_provided' : undefined,
    taxRateApplied: type === 'listed-resale'
      ? getSellOrderTotalFeeRate(hasAlbionPremium)
      : getTransactionTaxRate(hasAlbionPremium),
    grossProfit: profit.grossProfit,
    estimatedTax: profit.estimatedTax,
    netProfit: profit.netProfit,
    netProfitPerUnit: profit.netProfit,
    margin: profit.margin,
    roi: profit.margin,
    investment: buyPrice,
    suggestedQuantity,
    estimatedInvestment,
    estimatedNetProfit,
    isMicroFlip: practicalQuality.isMicroFlip,
    microFlipReasons: practicalQuality.microFlipReasons,
    worthLevel: practicalQuality.worthLevel,
    worthReasons: practicalQuality.worthReasons,
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

function isValidBlackMarketBuyCandidate(price: CityPrice, filters: ParsedOpportunityFilters): boolean {
  return (
    price.sellPriceMin > 0 &&
    BLACK_MARKET_BUY_CITIES.includes(price.city) &&
    matchesCityFilter(price.city, filters.buyCity)
  );
}

function isValidBlackMarketSellCandidate(price: CityPrice): boolean {
  return price.city === BLACK_MARKET_LOCATION && price.buyPriceMax > 0;
}

function adjustQuickResalePracticalQuality({
  type,
  quickProfile,
  blackMarketProfile,
  practicalQuality,
  netProfitPerUnit,
  estimatedNetProfit,
  margin,
  isSuspicious,
}: {
  type: OpportunityType;
  quickProfile: OpportunityQuickProfile;
  blackMarketProfile: OpportunityBlackMarketProfile;
  practicalQuality: ReturnType<typeof evaluateOpportunityQuality>;
  netProfitPerUnit: number;
  estimatedNetProfit: number;
  margin: number;
  isSuspicious: boolean;
}): ReturnType<typeof evaluateOpportunityQuality> {
  if (type === 'black-market') {
    return adjustBlackMarketPracticalQuality({
      blackMarketProfile,
      practicalQuality,
      netProfitPerUnit,
      estimatedNetProfit,
      margin,
      isSuspicious,
    });
  }

  if (type !== 'quick-sale' || isSuspicious) return practicalQuality;

  const minTotalProfit = quickProfile === 'wide'
    ? QUICK_RESALE_WIDE_MIN_TOTAL_PROFIT
    : QUICK_RESALE_SAFE_MIN_TOTAL_PROFIT;
  const quickMicroReasons: string[] = [];

  if (netProfitPerUnit < QUICK_RESALE_MIN_UNIT_PROFIT) {
    quickMicroReasons.push('Venda rápida com lucro por unidade abaixo de 1.000 prata');
  }

  if (estimatedNetProfit < minTotalProfit) {
    quickMicroReasons.push('Venda rápida com lucro total estimado baixo');
  }

  if (quickMicroReasons.length > 0) {
    return {
      ...practicalQuality,
      isMicroFlip: true,
      microFlipReasons: quickMicroReasons,
      worthLevel: 'micro',
      worthReasons: ['Margem positiva, mas ganho absoluto pequeno para Venda rápida.'],
    };
  }

  if (quickProfile === 'wide' && margin >= 2) {
    return {
      ...practicalQuality,
      isMicroFlip: false,
      microFlipReasons: [],
      worthLevel: practicalQuality.worthLevel === 'excelente' ? 'excelente' : 'boa',
      worthReasons: [
        'Venda rápida ampla: lucro por unidade acima de 1.000 prata e sem sinal de micro-flip.',
        ...practicalQuality.worthReasons.filter((reason) => !reason.toLowerCase().includes('micro')),
      ],
    };
  }

  if (netProfitPerUnit >= 5000 && margin >= 5) {
    return {
      ...practicalQuality,
      isMicroFlip: false,
      microFlipReasons: [],
      worthLevel: practicalQuality.worthLevel === 'excelente' ? 'excelente' : 'boa',
      worthReasons: [
        'Venda rápida segura: lucro e margem suficientes para entrar no radar.',
        ...practicalQuality.worthReasons.filter((reason) => !reason.toLowerCase().includes('micro')),
      ],
    };
  }

  return practicalQuality;
}

function adjustBlackMarketPracticalQuality({
  blackMarketProfile,
  practicalQuality,
  netProfitPerUnit,
  estimatedNetProfit,
  margin,
  isSuspicious,
}: {
  blackMarketProfile: OpportunityBlackMarketProfile;
  practicalQuality: ReturnType<typeof evaluateOpportunityQuality>;
  netProfitPerUnit: number;
  estimatedNetProfit: number;
  margin: number;
  isSuspicious: boolean;
}): ReturnType<typeof evaluateOpportunityQuality> {
  if (isSuspicious) return practicalQuality;

  const minTotalProfit =
    blackMarketProfile === 'wide'
      ? BLACK_MARKET_WIDE_MIN_TOTAL_PROFIT
      : blackMarketProfile === 'high_profit'
        ? BLACK_MARKET_HIGH_PROFIT_MIN_TOTAL_PROFIT
        : BLACK_MARKET_SAFE_MIN_TOTAL_PROFIT;
  const microReasons: string[] = [];

  if (netProfitPerUnit < BLACK_MARKET_MIN_UNIT_PROFIT) {
    microReasons.push('Mercado Negro com lucro por unidade abaixo de 1.000 prata');
  }

  if (estimatedNetProfit < minTotalProfit) {
    microReasons.push('Mercado Negro com lucro total estimado baixo');
  }

  if (microReasons.length > 0) {
    return {
      ...practicalQuality,
      isMicroFlip: true,
      microFlipReasons: microReasons,
      worthLevel: 'micro',
      worthReasons: ['Margem positiva, mas ganho absoluto pequeno para transporte ao Mercado Negro.'],
    };
  }

  if (
    (blackMarketProfile === 'wide' && margin >= 2) ||
    (blackMarketProfile !== 'wide' && netProfitPerUnit >= 5000 && margin >= 5)
  ) {
    return {
      ...practicalQuality,
      isMicroFlip: false,
      microFlipReasons: [],
      worthLevel: practicalQuality.worthLevel === 'excelente' ? 'excelente' : 'boa',
      worthReasons: [
        'Mercado Negro: compra em cidade comum e venda direta para ordem de compra do Black Market.',
        ...practicalQuality.worthReasons.filter((reason) => !reason.toLowerCase().includes('micro')),
      ],
    };
  }

  return practicalQuality;
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
  return includeBlackMarket || city !== BLACK_MARKET_LOCATION;
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

  if (type === 'black-market') {
    if (
      sellAgeHours <= 6 &&
      buyAgeHours <= 24 &&
      margin >= 5 &&
      netProfit > 0 &&
      sanity.priceRatio <= MAX_DEFAULT_PRICE_RATIO
    ) {
      reasons.push('Mercado Negro com ordem de compra real e dado do BM atualizado há menos de 6h.');
      reasons.push('Compra em cidade comum e margem suficiente para absorver variação.');
      return { level: 'high', reasons };
    }

    if (sellAgeHours <= 24 && margin > 0 && netProfit > 0) {
      reasons.push('Mercado Negro com buy order existente e dado ainda utilizável.');
      return { level: 'medium', reasons };
    }

    reasons.push('Dado do Mercado Negro antigo ou margem baixa.');
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
    buyAgeHours <= 6 &&
    sellAgeHours <= 6 &&
    margin >= 5 &&
    margin <= 100 &&
    netProfit > 0 &&
    sanity.priceRatio <= MAX_DEFAULT_PRICE_RATIO
  ) {
    reasons.push('Venda rápida com ordem de compra real e dados atualizados há menos de 6h.');
    reasons.push('Margem suficiente para absorver pequena variação.');
    return { level: 'high', reasons };
  }

  if (maxAge <= 48 && margin > 0 && netProfit > 0) {
    reasons.push('Venda rápida com dados ainda utilizáveis, mas um dos lados pode estar menos recente.');
    return { level: 'medium', reasons };
  }

  reasons.push('Oportunidade depende de dado antigo ou margem baixa.');
  return { level: 'low', reasons };
}

function calculateEstimatedLiquidity({
  type,
  blackMarketAgeHours,
  category,
  itemId,
  hasBlackMarketBuyOrder,
}: {
  type: OpportunityType;
  blackMarketAgeHours: number;
  category?: ItemCategory;
  itemId: string;
  hasBlackMarketBuyOrder: boolean;
}): { level: EstimatedLiquidity; reasons: string[] } {
  if (type !== 'black-market') {
    return { level: 'desconhecida', reasons: [] };
  }

  if (!hasBlackMarketBuyOrder || !Number.isFinite(blackMarketAgeHours)) {
    return {
      level: 'desconhecida',
      reasons: ['A API pública não retornou uma ordem de compra válida do Mercado Negro.'],
    };
  }

  const isPopular =
    category === 'Armas' ||
    category === 'Armaduras' ||
    /_SET[123]|RAPIER_MORGANA|DUALSICKLE_UNDEAD|DAGGER|BOW|CROSSBOW|HOLYSTAFF|NATURESTAFF/i.test(itemId);

  if (blackMarketAgeHours <= 6 && isPopular) {
    return {
      level: 'alta',
      reasons: ['Há ordem de compra no Mercado Negro, dado recente e item popular.'],
    };
  }

  if (blackMarketAgeHours <= 24) {
    return {
      level: 'média',
      reasons: ['Há ordem de compra no Mercado Negro com dado de até 24h.'],
    };
  }

  return {
    level: 'baixa',
    reasons: ['Há ordem de compra no Mercado Negro, mas o dado está antigo.'],
  };
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

  if (type === 'black-market') {
    level = maxRisk(level, 'medium');
    reasons.push('Mercado Negro exige transportar até Caerleon e a ordem pode desaparecer antes da venda.');

    if (maxDataAgeHours > 12) {
      level = maxRisk(level, 'high');
      reasons.push('Dado do Mercado Negro ou da compra está antigo para uma venda direta.');
    }
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

  if (buyCity === BLACK_MARKET_LOCATION || sellCity === BLACK_MARKET_LOCATION) {
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
  estimatedNetProfit,
  margin,
  maxDataAgeHours,
  risk,
  buyPrice,
  budget,
  minProfit,
  minEstimatedProfit,
  isMicroFlip,
  sellPriceReference,
  buyCity,
  sellCity,
  category,
  confidence,
  sanity,
  estimatedLiquidity,
  blackMarketAgeHours,
}: {
  type: OpportunityType;
  netProfit: number;
  estimatedNetProfit: number;
  margin: number;
  maxDataAgeHours: number;
  risk: RiskLevel;
  buyPrice: number;
  budget: number;
  minProfit: number;
  minEstimatedProfit?: number;
  isMicroFlip: boolean;
  sellPriceReference: Opportunity['sellPriceReference'];
  buyCity: AlbionCity;
  sellCity: AlbionCity;
  category?: ItemCategory;
  confidence: OpportunityConfidence;
  sanity: OpportunityPriceSanityResult;
  estimatedLiquidity?: EstimatedLiquidity;
  blackMarketAgeHours?: number;
}): { value: number; reasons: string[] } {
  const reasons = ['Score combina margem, lucro líquido, frescor, risco e qualidade do preço usado.'];
  const marginNormalized = Math.min(Math.max(margin, 0), 60) / 60 * 100;
  const profitNormalized = Math.min(Math.log10(Math.max(netProfit, 0) + 1) / Math.log10(100_000 + 1), 1) * 100;
  const totalProfitNormalized = Math.min(
    Math.log10(Math.max(estimatedNetProfit, 0) + 1) / Math.log10(500_000 + 1),
    1,
  ) * 100;
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
  const confidenceBonus = confidence === 'high' ? 12 : confidence === 'medium' ? 6 : 0;
  const blackMarketFreshness = Math.max(0, 100 - ((blackMarketAgeHours ?? maxDataAgeHours) / 24) * 100);
  const liquidityScore =
    estimatedLiquidity === 'alta'
      ? 100
      : estimatedLiquidity === 'média'
        ? 65
        : estimatedLiquidity === 'baixa'
          ? 30
          : 0;
  const quickLiquidityBonus =
    type === 'quick-sale' && category && QUICK_RESALE_CATEGORIES.includes(category)
      ? 8
      : 0;

  if (type === 'listed-resale') reasons.push('Revenda anunciada recebeu penalidade por ser especulativa.');
  if (type === 'black-market') reasons.push('Mercado Negro usa buy order real do Black Market e score próprio para frescor do BM.');
  if (type === 'quick-sale') reasons.push('Venda rápida usa buy order real e recebeu score específico para liquidez e frescor.');
  if (sellPriceReference === 'sell-order') reasons.push('Sem buy order real no destino; preço de saída depende de anúncio.');
  if (sanity.isSuspicious) reasons.push('Preço suspeito reduziu fortemente o score.');
  if (budgetPenalty > 0) reasons.push('Preço por unidade acima do orçamento informado.');
  if (stalePenalty > 0) reasons.push('Dados menos recentes reduziram o score.');
  if (blackMarketPenalty > 0) reasons.push('Mercado Negro recebeu penalidade de risco.');
  if (netProfit < minProfit) reasons.push('Lucro por unidade abaixo do lucro mínimo configurado.');
  if (isMicroFlip) reasons.push('Micro-flip limitado: margem positiva não compensa lucro absoluto baixo.');
  if (estimatedNetProfit < (minEstimatedProfit ?? DEFAULT_MIN_ESTIMATED_PROFIT)) {
    reasons.push('Lucro total estimado abaixo do mínimo do radar.');
  }
  if (buyCity !== sellCity && netProfit < MIN_ROUTE_EFFORT_PROFIT) {
    reasons.push('Rota entre cidades penalizada por lucro unitário baixo.');
  }

  const rawScore = type === 'black-market'
    ? profitNormalized * 0.22 +
      totalProfitNormalized * 0.08 +
      blackMarketFreshness * 0.25 +
      marginNormalized * 0.15 +
      confidenceBonus * 1.25 +
      riskScore * 0.1 +
      liquidityScore * 0.05 -
      budgetPenalty -
      stalePenalty -
      extremeMarginPenalty -
      ratioPenalty -
      sanity.scorePenalty
    : type === 'quick-sale'
      ? profitNormalized * 0.34 +
        totalProfitNormalized * 0.16 +
        marginNormalized * 0.16 +
        freshness * 0.2 +
        riskScore * 0.14 +
        confidenceBonus +
        quickLiquidityBonus -
        budgetPenalty -
        stalePenalty -
        blackMarketPenalty -
        extremeMarginPenalty -
        ratioPenalty -
        sanity.scorePenalty
      : profitNormalized * 0.35 +
          totalProfitNormalized * 0.25 +
          marginNormalized * 0.15 +
          freshness * 0.15 +
          riskScore * 0.1 -
          typePenalty -
          noBuyOrderPenalty -
          budgetPenalty -
          stalePenalty -
          blackMarketPenalty -
          extremeMarginPenalty -
          ratioPenalty -
          sanity.scorePenalty;

  let cappedScore = rawScore;

  if (netProfit < minProfit) cappedScore = Math.min(cappedScore, 20);
  if (isMicroFlip) cappedScore = Math.min(cappedScore, 15);
  if (estimatedNetProfit < (minEstimatedProfit ?? DEFAULT_MIN_ESTIMATED_PROFIT)) {
    cappedScore = Math.min(cappedScore, 30);
  }
  if (sanity.isRejectedByDefault) cappedScore = Math.min(cappedScore, 12);
  else if (sanity.isSuspicious) cappedScore = Math.min(cappedScore, 35);

  return {
    value: clampScore(cappedScore),
    reasons,
  };
}

function sortOpportunities(opportunities: Opportunity[], sortBy: OpportunitySortBy): Opportunity[] {
  return [...opportunities].sort((a, b) => {
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
  });
}

function prioritizeBlackMarketFirstPageDiversity(opportunities: Opportunity[]): Opportunity[] {
  const firstPage: Opportunity[] = [];
  const overflow: Opportunity[] = [];
  const baseCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();

  for (const opportunity of opportunities) {
    const baseKey = opportunity.itemId.replace(/@\d+$/, '').replace(/^T\d_/, '');
    const categoryKey = opportunity.category ?? 'Itens';
    const baseCount = baseCounts.get(baseKey) ?? 0;
    const categoryCount = categoryCounts.get(categoryKey) ?? 0;

    if (firstPage.length < 25 && baseCount < 3 && categoryCount < 5) {
      firstPage.push(opportunity);
      baseCounts.set(baseKey, baseCount + 1);
      categoryCounts.set(categoryKey, categoryCount + 1);
      continue;
    }

    overflow.push(opportunity);
  }

  return [...firstPage, ...overflow];
}

function worthRank(level: Opportunity['worthLevel']): number {
  if (level === 'excelente') return 5;
  if (level === 'boa') return 4;
  if (level === 'fraca') return 2;
  if (level === 'micro') return 1;
  return 0;
}

function createOpportunityDebug({
  server,
  plan,
  scanDepth,
  selectedMode,
  selectedPreset,
  quickProfile,
  blackMarketProfile,
  watchlistSource,
  fallbackReason,
  requestedItemIdsCount,
  validItemIdsCount,
  invalidItemIdsCount,
  staticCatalogItemsCount,
}: {
  server: ServerRegion;
  plan: SubscriptionPlan;
  scanDepth: OpportunityScanDepth;
  selectedMode: OpportunityType | 'all';
  selectedPreset?: string;
  quickProfile?: OpportunityQuickProfile;
  blackMarketProfile?: OpportunityBlackMarketProfile;
  watchlistSource?: string;
  fallbackReason?: string;
  requestedItemIdsCount: number;
  validItemIdsCount: number;
  invalidItemIdsCount: number;
  staticCatalogItemsCount?: number;
}): OpportunityRadarDebug {
  return {
    server: server === 'Americas' ? 'americas' : 'europe',
    plan,
    scanDepth,
    selectedMode,
    selectedPreset,
    quickProfile,
    blackMarketProfile,
    watchlistSource,
    fallbackReason,
    requestedItemIdsCount,
    validItemIdsCount,
    staticCatalogItemsCount,
    apiReturnedRows: 0,
    itemsWithAnyPrice: 0,
    itemsWithSellPrice: 0,
    itemsWithBuyPrice: 0,
    rawCandidatesCount: 0,
    afterPositiveProfitCount: 0,
    afterMinProfitCount: 0,
    afterMinMarginCount: 0,
    afterAgeFilterCount: 0,
    afterSuspiciousFilterCount: 0,
    afterMicroFlipFilterCount: 0,
    finalOpportunitiesCount: 0,
    rejectionReasons: {
      ...createEmptyRejectionReasons(),
      invalidItemId: invalidItemIdsCount,
    },
  };
}

function createEmptyRejectionReasons(): OpportunityRejectionReasons {
  return {
    noPriceData: 0,
    noSellPrice: 0,
    noBuyPrice: 0,
    sameCity: 0,
    negativeProfit: 0,
    belowMinProfit: 0,
    belowMinMargin: 0,
    tooOld: 0,
    suspicious: 0,
    microFlip: 0,
    invalidItemId: 0,
    belowEstimatedProfit: 0,
    lowConfidence: 0,
    highRisk: 0,
    weakOpportunity: 0,
    staleBlackMarketData: 0,
  };
}

function collectItemPriceDebug(debug: OpportunityRadarDebug, item: Item) {
  const hasSellPrice = item.prices.some((price) => price.sellPriceMin > 0);
  const hasBuyPrice = item.prices.some((price) => price.buyPriceMax > 0);

  if (hasSellPrice || hasBuyPrice) debug.itemsWithAnyPrice += 1;
  if (hasSellPrice) debug.itemsWithSellPrice += 1;
  if (hasBuyPrice) debug.itemsWithBuyPrice += 1;
}

function buildEmptyRadarMessage(debug: OpportunityRadarDebug): string {
  const reasons = debug.rejectionReasons;

  if (debug.selectedMode === 'black-market') {
    if (debug.validItemIdsCount === 0) return 'Nenhum item válido encontrado para análise no Mercado Negro.';
    if (debug.apiReturnedRows === 0 || debug.itemsWithAnyPrice === 0) {
      return 'A API pública não retornou dados suficientes do Mercado Negro agora.';
    }
    if (reasons.staleBlackMarketData > 0) {
      return 'As oportunidades do Mercado Negro foram removidas porque o dado do BM estava antigo.';
    }
    if (reasons.belowMinProfit > 0) return 'Nenhuma oportunidade do Mercado Negro passou pelo lucro mínimo atual.';
    if (reasons.microFlip > 0) return 'Encontramos apenas micro-oportunidades no Mercado Negro; elas estão ocultas.';

    return 'Nenhuma oportunidade útil no Mercado Negro encontrada com os filtros atuais.';
  }

  if (debug.validItemIdsCount === 0) return 'Nenhum item válido foi encontrado para esta varredura.';
  if (debug.apiReturnedRows === 0 || debug.itemsWithAnyPrice === 0) {
    return 'A API pública não retornou dados de preço para a watchlist e servidor selecionados.';
  }
  if (debug.rawCandidatesCount === 0) {
    return 'O radar recebeu preços, mas não encontrou rotas candidatas entre cidades com os dados atuais.';
  }
  if (reasons.belowMinProfit >= Math.max(reasons.microFlip, reasons.tooOld, reasons.suspicious)) {
    return 'As rotas encontradas ficaram abaixo do lucro mínimo configurado.';
  }
  if (reasons.microFlip > 0 && reasons.microFlip >= reasons.belowMinProfit) {
    return 'Encontramos apenas micro-oportunidades; elas estão ocultas pelos filtros atuais.';
  }
  if (reasons.tooOld > 0) return 'As oportunidades candidatas dependiam de dados mais antigos que o limite configurado.';
  if (reasons.suspicious > 0) return 'As oportunidades encontradas foram classificadas como suspeitas ou outliers.';

  return 'O radar analisou os itens e rotas, mas nenhuma oportunidade passou pelos filtros atuais.';
}

function logDevelopmentDebug(payload: OpportunityErrorMetadata) {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('[opportunities]', payload);
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
    minEstimatedProfit: parseOptionalNumber(searchParams.get('minEstimatedProfit')) ?? DEFAULT_MIN_ESTIMATED_PROFIT,
    includeBlackMarket: parseBoolean(searchParams.get('includeBlackMarket')),
    includeLowConfidence: parseBoolean(searchParams.get('includeLowConfidence')),
    includeSuspicious: parseBoolean(searchParams.get('includeSuspicious')),
    includeMicroFlips: parseBoolean(searchParams.get('includeMicroFlips')) || searchParams.get('hideMicroFlips') === 'false',
    blackMarketFreshOnly: parseBoolean(searchParams.get('blackMarketFreshOnly')),
    blackMarketMaxAgeHours: parseNumber(
      searchParams.get('blackMarketMaxAgeHours'),
      BLACK_MARKET_FRESH_ONLY_DEFAULT_HOURS,
    ),
    sortBy: parseSortBy(searchParams.get('sortBy')),
    watchlistMode: parseWatchlistMode(searchParams.get('watchlist')),
    minConfidence: parseMinConfidence(searchParams.get('minConfidence')),
    quickProfile: parseQuickProfile(searchParams.get('quickProfile') ?? searchParams.get('quickResaleProfile')),
    blackMarketProfile: parseBlackMarketProfile(
      searchParams.get('blackMarketProfile') ?? searchParams.get('bmProfile'),
    ),
  };
}

function parseOpportunityType(value: string | null): OpportunityType | 'all' {
  if (value === 'black-market' || value === 'quick-sale' || value === 'listed-resale' || value === 'underpriced') {
    return value;
  }
  if (value === 'all') return 'all';
  return 'black-market';
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

function parseWatchlistMode(value: string | null): OpportunityWatchlistMode {
  return value === 'extended' ? 'extended' : 'basic';
}

function parseScanDepth(value: string | null): OpportunityScanDepth {
  if (
    value === 'deep' ||
    value === 'pro' ||
    value === 'basic' ||
    value === 'quick_basic' ||
    value === 'quick_pro' ||
    value === 'quick_deep' ||
    value === 'black_market_basic' ||
    value === 'black_market_pro' ||
    value === 'black_market_deep'
  ) {
    return value;
  }

  return 'black_market_pro';
}

function normalizeScanDepthForMode(
  scanDepth: OpportunityScanDepth,
  type: OpportunityType | 'all',
): OpportunityScanDepth {
  if (type === 'black-market') {
    if (scanDepth === 'deep' || scanDepth === 'black_market_deep') return 'black_market_deep';
    if (scanDepth === 'basic' || scanDepth === 'black_market_basic') return 'black_market_basic';

    return 'black_market_pro';
  }

  if (type === 'quick-sale') {
    if (scanDepth === 'deep' || scanDepth === 'quick_deep') return 'quick_deep';
    if (scanDepth === 'basic' || scanDepth === 'quick_basic') return 'quick_basic';

    return 'quick_pro';
  }

  return scanDepth;
}

function getRequestedLocations(includeBlackMarket: boolean, type?: OpportunityType | 'all'): AlbionCity[] {
  if (type === 'black-market' || type === 'all') return [...BLACK_MARKET_BUY_CITIES, BLACK_MARKET_LOCATION];

  return includeBlackMarket
    ? [...ALBION_CITIES]
    : ALBION_CITIES.filter((city) => city !== BLACK_MARKET_LOCATION);
}

function parseMinConfidence(value: string | null): OpportunityConfidence | 'all' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'all';
}

function parseQuickProfile(value: string | null): OpportunityQuickProfile {
  return value === 'wide' ? 'wide' : 'safe';
}

function parseBlackMarketProfile(value: string | null): OpportunityBlackMarketProfile {
  if (value === 'wide' || value === 'high_profit' || value === 'low_risk') return value;

  return 'safe';
}

function confidenceRank(confidence: OpportunityConfidence): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function matchesConfidenceMinimum(
  confidence: OpportunityConfidence,
  minimum: OpportunityConfidence | 'all',
): boolean {
  return minimum === 'all' || confidenceRank(confidence) >= confidenceRank(minimum);
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
