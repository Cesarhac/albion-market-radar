'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  Clock3,
  Download,
  Eye,
  Filter,
  Grid2X2,
  Layers3,
  List,
  ListFilter,
  MapPin,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { ProGate } from '@/components/ProGate';
import { ProUpgradeModal } from '@/components/ProUpgradeModal';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import {
  ALBION_CITIES,
  ENCHANTMENTS,
  ITEM_CATEGORIES,
  MARKET_SERVER_REGIONS,
  QUALITIES,
  TIERS,
} from '@/data/constants';
import {
  OpportunityApiError,
  fetchOpportunityRadar,
  type OpportunityApiErrorPayload,
} from '@/services/albionMarket';
import type {
  AlbionCity,
  Enchantment,
  ItemCategory,
  MarketDataSource,
  MarketOpportunitiesResponse,
  Opportunity,
  OpportunityBlackMarketProfile,
  OpportunityConfidence,
  OpportunityFilters,
  OpportunityQuickProfile,
  OpportunityScoreLabel,
  OpportunitySortBy,
  OpportunityType,
  OpportunityWatchlistMode,
  Quality,
  RiskLevel,
  ServerRegion,
  Tier,
} from '@/types/albion';
import {
  DEFAULT_MAX_DATA_AGE_HOURS,
  DEFAULT_MIN_ESTIMATED_PROFIT,
  DEFAULT_MIN_OPPORTUNITY_MARGIN,
  DEFAULT_MIN_OPPORTUNITY_PROFIT,
  OPPORTUNITY_SORT_OPTIONS,
  PRO_DEFAULT_MIN_ESTIMATED_PROFIT,
  PRO_DEFAULT_MAX_DATA_AGE_HOURS,
  PRO_DEFAULT_MIN_OPPORTUNITY_MARGIN,
  PRO_DEFAULT_MIN_OPPORTUNITY_PROFIT,
  confidenceLabel,
  opportunityTypeLabel,
  scoreLabelText,
  worthLevelLabel,
} from '@/lib/opportunityAnalysis';
import {
  cn,
  formatCityName,
  formatDateTime,
  formatEnchantment,
  formatPercent,
  formatQuality,
  formatServerName,
  formatSilver,
  formatTierEnchant,
  riskLabel,
  updateStatusLabel,
} from '@/lib/utils';
import { getSourceHost } from '@/lib/marketData';
import { serverParamToRegion } from '@/lib/settingsStorage';
import {
  getSellOrderTotalFeeRate,
  getTransactionTaxRate,
} from '@/src/lib/albionTaxes';
import { getUserEntitlements } from '@/src/lib/entitlements';
import { exportOpportunitiesCsv } from '@/src/services/proService';
import {
  createSavedFilter,
  deleteSavedFilter,
  fetchSavedFilters,
  type SavedFilter,
} from '@/src/services/savedFiltersService';

type CityFilter = AlbionCity | 'all';
type TierFilter = Tier | 'all';
type EnchantmentFilter = Enchantment | 'all';
type CategoryFilter = ItemCategory | 'all';
type QualityFilter = Quality | 'all';
type OpportunityTypeFilter = OpportunityType | 'all';
type RiskMaxFilter = RiskLevel | 'all';
type RadarPresetId =
  | 'mercadoNegro'
  | 'bmAmplo'
  | 'bmAltoLucro'
  | 'bmBaixoRisco'
  | 'trader'
  | 'altoLucro'
  | 'baixoRisco'
  | 'recursos'
  | 'iniciante';
type RadarScanDepth = 'pro' | 'deep' | 'quick_pro' | 'quick_deep' | 'black_market_pro' | 'black_market_deep';

const RADAR_PRESETS: Array<{
  id: RadarPresetId;
  label: string;
  apply: {
    type?: OpportunityTypeFilter;
    minProfit: number;
    minMargin: number;
    minEstimatedProfit: number;
    maxRisk?: RiskMaxFilter;
    minConfidence?: OpportunityConfidence | 'all';
    sortBy?: OpportunitySortBy;
    category?: CategoryFilter;
    includeBlackMarket?: boolean;
    includeSuspicious?: boolean;
    includeMicroFlips?: boolean;
    blackMarketProfile?: OpportunityBlackMarketProfile;
  };
}> = [
  {
    id: 'mercadoNegro',
    label: 'Mercado Negro',
    apply: {
      type: 'black-market',
      minProfit: 5000,
      minMargin: 5,
      minEstimatedProfit: 10_000,
      maxRisk: 'medium',
      minConfidence: 'medium',
      sortBy: 'score',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
      blackMarketProfile: 'safe',
    },
  },
  {
    id: 'bmAmplo',
    label: 'BM Amplo',
    apply: {
      type: 'black-market',
      minProfit: 1000,
      minMargin: 2,
      minEstimatedProfit: 0,
      maxRisk: 'high',
      minConfidence: 'all',
      sortBy: 'score',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
      blackMarketProfile: 'wide',
    },
  },
  {
    id: 'bmAltoLucro',
    label: 'BM Alto lucro',
    apply: {
      type: 'black-market',
      minProfit: 20_000,
      minMargin: 8,
      minEstimatedProfit: 100_000,
      maxRisk: 'high',
      minConfidence: 'medium',
      sortBy: 'profit',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
      blackMarketProfile: 'high_profit',
    },
  },
  {
    id: 'bmBaixoRisco',
    label: 'BM Baixo risco',
    apply: {
      type: 'black-market',
      minProfit: 5000,
      minMargin: 5,
      minEstimatedProfit: 25_000,
      maxRisk: 'medium',
      minConfidence: 'medium',
      sortBy: 'recent',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
      blackMarketProfile: 'low_risk',
    },
  },
  {
    id: 'trader',
    label: 'Trader',
    apply: {
      type: 'all',
      minProfit: 3000,
      minMargin: 5,
      minEstimatedProfit: 25_000,
      maxRisk: 'high',
      minConfidence: 'all',
      sortBy: 'score',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
    },
  },
  {
    id: 'altoLucro',
    label: 'Alto lucro',
    apply: {
      type: 'all',
      minProfit: 20_000,
      minMargin: 10,
      minEstimatedProfit: 100_000,
      maxRisk: 'high',
      minConfidence: 'medium',
      sortBy: 'profit',
      category: 'all',
      includeBlackMarket: true,
      includeSuspicious: false,
      includeMicroFlips: false,
    },
  },
  {
    id: 'baixoRisco',
    label: 'Baixo risco',
    apply: {
      type: 'quick-sale',
      minProfit: 5000,
      minMargin: 8,
      minEstimatedProfit: 25_000,
      maxRisk: 'low',
      minConfidence: 'high',
      sortBy: 'recent',
      category: 'all',
      includeBlackMarket: false,
      includeSuspicious: false,
      includeMicroFlips: false,
    },
  },
  {
    id: 'recursos',
    label: 'Recursos',
    apply: {
      type: 'quick-sale',
      minProfit: 1000,
      minMargin: 5,
      minEstimatedProfit: 50_000,
      maxRisk: 'medium',
      minConfidence: 'medium',
      sortBy: 'score',
      category: 'Materiais refinados',
      includeBlackMarket: false,
      includeSuspicious: false,
      includeMicroFlips: false,
    },
  },
];

const FREE_OPPORTUNITY_CARDS = [
  {
    title: 'Compra e venda entre cidades',
    description: 'Veja onde comprar mais barato e onde vender com melhor retorno.',
    icon: MapPin,
  },
  {
    title: 'Lucro líquido e margem',
    description: 'O cálculo considera as taxas automáticas do Albion e mostra o lucro real estimado.',
    icon: BadgeDollarSign,
  },
  {
    title: 'Risco e confiança',
    description: 'O radar filtra dados antigos, preços suspeitos e oportunidades pouco confiáveis.',
    icon: ShieldCheck,
  },
  {
    title: 'Filtros PRO',
    description: 'Use orçamento, categoria, tier, encantamento, risco máximo, margem mínima e exportação CSV.',
    icon: SlidersHorizontal,
  },
];

const BLACK_MARKET_PROFILE_OPTIONS: Array<{ value: OpportunityBlackMarketProfile; label: string }> = [
  { value: 'safe', label: 'Seguro' },
  { value: 'wide', label: 'Amplo' },
  { value: 'high_profit', label: 'Alto lucro' },
  { value: 'low_risk', label: 'Baixo risco' },
];

function blackMarketProfileLabel(profile: OpportunityBlackMarketProfile): string {
  if (profile === 'wide') return 'Amplo';
  if (profile === 'high_profit') return 'Alto lucro';
  if (profile === 'low_risk') return 'Baixo risco';

  return 'Seguro';
}

function liquidityLabel(value: Opportunity['estimatedLiquidity']): string {
  if (value === 'alta') return 'Alta';
  if (value === 'média') return 'Média';
  if (value === 'baixa') return 'Baixa';

  return 'Desconhecida';
}

function liquidityVariant(value: Opportunity['estimatedLiquidity']): 'success' | 'warning' | 'danger' | 'muted' {
  if (value === 'alta') return 'success';
  if (value === 'média') return 'warning';
  if (value === 'baixa') return 'danger';

  return 'muted';
}

const confidenceVariant = (confidence: OpportunityConfidence | undefined): 'success' | 'warning' | 'danger' => {
  if (confidence === 'high') return 'success';
  if (confidence === 'medium') return 'warning';
  return 'danger';
};

const riskVariant = (risk: RiskLevel): 'success' | 'warning' | 'danger' => {
  if (risk === 'low') return 'success';
  if (risk === 'medium') return 'warning';
  return 'danger';
};

function marketSourceLabel(source?: MarketDataSource): string {
  if (source === 'cache') return 'Dados em cache';
  if (source === 'mock') return 'Dados demonstrativos — somente desenvolvimento';

  return 'Dados reais';
}

function metadataNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const scoreVariant = (label: OpportunityScoreLabel | undefined): 'success' | 'warning' | 'danger' | 'primary' => {
  if (label === 'excellent') return 'success';
  if (label === 'good') return 'primary';
  if (label === 'medium') return 'warning';
  return 'danger';
};

const worthVariant = (level: Opportunity['worthLevel']): 'success' | 'warning' | 'danger' | 'primary' | 'muted' => {
  if (level === 'excelente') return 'success';
  if (level === 'boa') return 'primary';
  if (level === 'suspeita') return 'danger';
  if (level === 'micro') return 'muted';
  return 'warning';
};

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const { settings, isLoaded: settingsLoaded } = useUserSettings();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const isPro = entitlements.advancedOpportunityFilters;
  const canSaveFilters = isPro && entitlements.maxSavedFilters > 0;
  const isCompact = settings.interfaceDensity === 'compact';
  const [serverOverride, setServerOverride] = React.useState<ServerRegion | null>(null);
  const [type, setType] = React.useState<OpportunityTypeFilter>('black-market');
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [tier, setTier] = React.useState<TierFilter>('all');
  const [enchantment, setEnchantment] = React.useState<EnchantmentFilter>('all');
  const [quality, setQuality] = React.useState<QualityFilter>('Normal');
  const [buyCity, setBuyCity] = React.useState<CityFilter>('all');
  const [sellCity, setSellCity] = React.useState<CityFilter>('all');
  const [minProfit, setMinProfit] = React.useState(DEFAULT_MIN_OPPORTUNITY_PROFIT);
  const [minMargin, setMinMargin] = React.useState(DEFAULT_MIN_OPPORTUNITY_MARGIN);
  const [minEstimatedProfit, setMinEstimatedProfit] = React.useState(DEFAULT_MIN_ESTIMATED_PROFIT);
  const [maxAgeHours, setMaxAgeHours] = React.useState(DEFAULT_MAX_DATA_AGE_HOURS);
  const [maxRisk, setMaxRisk] = React.useState<RiskMaxFilter>('high');
  const [budget, setBudget] = React.useState('');
  const [includeBlackMarket, setIncludeBlackMarket] = React.useState(false);
  const [includeLowConfidence, setIncludeLowConfidence] = React.useState(false);
  const [includeSuspicious, setIncludeSuspicious] = React.useState(false);
  const [includeMicroFlips, setIncludeMicroFlips] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<OpportunitySortBy>('score');
  const [minConfidence, setMinConfidence] = React.useState<OpportunityConfidence | 'all'>('all');
  const [watchlistMode, setWatchlistMode] = React.useState<OpportunityWatchlistMode>('extended');
  const [scanDepth, setScanDepth] = React.useState<RadarScanDepth>('black_market_pro');
  const [quickProfile, setQuickProfile] = React.useState<OpportunityQuickProfile>('safe');
  const [blackMarketProfile, setBlackMarketProfile] = React.useState<OpportunityBlackMarketProfile>('safe');
  const [blackMarketFreshOnly, setBlackMarketFreshOnly] = React.useState(true);
  const [blackMarketMaxAgeHours, setBlackMarketMaxAgeHours] = React.useState(24);
  const [activePreset, setActivePreset] = React.useState<RadarPresetId>('mercadoNegro');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'cards' | 'list'>('cards');
  const [displayLimit, setDisplayLimit] = React.useState(25);
  const [savedFilters, setSavedFilters] = React.useState<SavedFilter[]>([]);
  const [gateMessage, setGateMessage] = React.useState('');
  const [upgradeModalOpen, setUpgradeModalOpen] = React.useState(false);
  const [radar, setRadar] = React.useState<MarketOpportunitiesResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [radarError, setRadarError] = React.useState<OpportunityApiErrorPayload | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = React.useState<Opportunity | null>(null);
  const server = serverOverride ?? serverParamToRegion(settings.defaultServer);
  const hasAlbionPremium = settings.hasAlbionPremium;
  const transactionTaxRate = getTransactionTaxRate(hasAlbionPremium);
  const sellOrderTotalFeeRate = getSellOrderTotalFeeRate(hasAlbionPremium);
  const didApplyPlanDefaults = React.useRef(false);

  React.useEffect(() => {
    if (didApplyPlanDefaults.current) return;
    if (!user) return;

    didApplyPlanDefaults.current = true;

    queueMicrotask(() => {
      if (isPro) {
        setActivePreset('mercadoNegro');
        setMinProfit(5000);
        setMinMargin(PRO_DEFAULT_MIN_OPPORTUNITY_MARGIN);
        setMinEstimatedProfit(10_000);
        setMaxAgeHours(24);
        setType('black-market');
        setQuickProfile('safe');
        setBlackMarketProfile('safe');
        setBlackMarketFreshOnly(true);
        setBlackMarketMaxAgeHours(24);
        setMaxRisk('medium');
        setMinConfidence('medium');
        setIncludeBlackMarket(true);
        setSortBy('score');
        setWatchlistMode('extended');
        setScanDepth('black_market_pro');
        return;
      }

      setActivePreset('iniciante');
      setType('all');
      setMinProfit(DEFAULT_MIN_OPPORTUNITY_PROFIT);
      setMinMargin(DEFAULT_MIN_OPPORTUNITY_MARGIN);
      setMinEstimatedProfit(DEFAULT_MIN_ESTIMATED_PROFIT);
      setMaxAgeHours(DEFAULT_MAX_DATA_AGE_HOURS);
    });
  }, [isPro, user]);

  const filters = React.useMemo<OpportunityFilters>(
    () => ({
      type,
      category: isPro ? category : 'all',
      tier: isPro ? tier : 'all',
      enchantment: isPro ? enchantment : 'all',
      quality: isPro ? quality : 'Normal',
      buyCity: isPro ? buyCity : 'all',
      sellCity: isPro ? sellCity : 'all',
      minProfit,
      minMargin,
      maxAgeHours,
      maxRisk: isPro ? maxRisk : 'high',
      budget: isPro && budget.trim() ? Number(budget) : undefined,
      includeBlackMarket: isPro && includeBlackMarket,
      includeLowConfidence: isPro && includeLowConfidence,
      includeSuspicious: isPro && includeSuspicious,
      includeMicroFlips,
      blackMarketFreshOnly: type === 'black-market' && blackMarketFreshOnly,
      blackMarketMaxAgeHours,
      minEstimatedProfit,
      sortBy: isPro ? sortBy : 'score',
      minConfidence: isPro ? minConfidence : 'all',
      watchlistMode: isPro ? watchlistMode : ('basic' as const),
      plan: isPro ? ('pro' as const) : ('free' as const),
      scanDepth: isPro ? scanDepth : ('basic' as const),
      selectedPreset: activePreset,
      quickProfile,
      blackMarketProfile,
    }),
    [
      activePreset,
      blackMarketFreshOnly,
      blackMarketMaxAgeHours,
      blackMarketProfile,
      budget,
      buyCity,
      category,
      enchantment,
      includeBlackMarket,
      includeLowConfidence,
      includeSuspicious,
      includeMicroFlips,
      isPro,
      maxAgeHours,
      maxRisk,
      minEstimatedProfit,
      minConfidence,
      minMargin,
      minProfit,
      quality,
      quickProfile,
      sellCity,
      scanDepth,
      sortBy,
      tier,
      type,
      watchlistMode,
    ],
  );

  React.useEffect(() => {
    let isActive = true;

    if (!user || !canSaveFilters) {
      queueMicrotask(() => {
        if (isActive) setSavedFilters([]);
      });
      return () => {
        isActive = false;
      };
    }

    void fetchSavedFilters('opportunities')
      .then((filters) => {
        if (isActive) setSavedFilters(filters);
      })
      .catch(() => {
        if (isActive) setSavedFilters([]);
      });

    return () => {
      isActive = false;
    };
  }, [canSaveFilters, user]);

  React.useEffect(() => {
    if (!settingsLoaded) return;

    let isActive = true;

    if (!isPro) {
      queueMicrotask(() => {
        if (!isActive) return;

        setRadar(null);
        setErrorMessage('');
        setIsLoading(false);
      });

      return () => {
        isActive = false;
      };
    }

    queueMicrotask(() => {
      if (!isActive) return;

      setIsLoading(true);
      setErrorMessage('');
      setRadarError(null);

      void fetchOpportunityRadar(server, filters, hasAlbionPremium)
        .then((payload) => {
          if (!isActive) return;

          setRadar(payload);
          setRadarError(null);
        })
        .catch((error) => {
          if (!isActive) return;

          setRadar(null);
          setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar dados reais agora.');

          if (error instanceof OpportunityApiError) {
            setRadarError({
              ...(error.payload ?? {}),
              error: error.message,
              stage: error.stage,
              status: error.status,
              metadata: error.metadata,
            });
          } else {
            setRadarError(null);
          }
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    });

    return () => {
      isActive = false;
    };
  }, [filters, hasAlbionPremium, isPro, server, settingsLoaded]);

  React.useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (isActive) setDisplayLimit(25);
    });

    return () => {
      isActive = false;
    };
  }, [filters, server]);

  const opportunities = React.useMemo(() => radar?.opportunities ?? [], [radar?.opportunities]);
  const visibleOpportunities = React.useMemo(
    () => opportunities.slice(0, displayLimit),
    [displayLimit, opportunities],
  );
  const usefulOpportunities = React.useMemo(
    () => opportunities.filter((opportunity) => opportunity.worthLevel === 'boa' || opportunity.worthLevel === 'excelente'),
    [opportunities],
  );
  const bestOpportunity = usefulOpportunities[0] ?? null;
  const highestProfit = [...usefulOpportunities].sort((a, b) => b.netProfit - a.netProfit)[0] ?? null;
  const highestMargin = [...usefulOpportunities]
    .filter((opportunity) => opportunity.confidence !== 'low' && !opportunity.isSuspicious && !opportunity.isMicroFlip)
    .sort((a, b) => b.margin - a.margin)[0] ?? null;
  const trustedCount = usefulOpportunities.filter(
    (opportunity) => opportunity.confidence === 'high' && !opportunity.isSuspicious,
  ).length;
  const bestLiquidity = usefulOpportunities.find((opportunity) => opportunity.estimatedLiquidity === 'alta')
    ?? usefulOpportunities.find((opportunity) => opportunity.estimatedLiquidity === 'média')
    ?? usefulOpportunities.find((opportunity) => opportunity.estimatedLiquidity === 'baixa')
    ?? null;
  const isBlackMarketMode = type === 'black-market';
  const marketSource = radar?.source ?? opportunities.find((opportunity) => opportunity.dataSource)?.dataSource ?? 'live';
  const isMockData = marketSource === 'mock';
  const sourceHost = radar?.sourceHost ?? opportunities[0]?.sourceHost ?? getSourceHost(server);
  const scanDepthLabel =
    scanDepth === 'black_market_deep'
      ? 'BM ampliada'
      : scanDepth === 'black_market_pro'
        ? 'Mercado Negro PRO'
        : scanDepth === 'quick_deep' || scanDepth === 'deep'
      ? 'ampliada'
      : scanDepth === 'quick_pro'
        ? 'Venda rápida PRO'
        : 'PRO';
  const requestedItemsCount = radar?.debug?.requestedItemIdsCount ?? metadataNumber(radarError?.metadata?.requestedItemIdsCount);
  const validItemsCount = radar?.debug?.validItemIdsCount ?? metadataNumber(radarError?.metadata?.validItemIdsCount);
  const apiReturnedRows = radar?.debug?.apiReturnedRows ?? metadataNumber(radarError?.metadata?.apiReturnedRows);
  const rawCandidatesCount = radar?.debug?.rawCandidatesCount ?? metadataNumber(radarError?.metadata?.rawCandidatesCount);
  const finalOpportunitiesCount =
    radar?.debug?.finalOpportunitiesCount ?? metadataNumber(radarError?.metadata?.finalOpportunitiesCount);
  const positiveCandidatesCount =
    radar?.debug?.afterPositiveProfitCount ?? metadataNumber(radarError?.metadata?.afterPositiveProfitCount);
  const removedByMinProfitCount =
    radar?.debug?.rejectionReasons?.belowMinProfit ?? metadataNumber(radarError?.metadata?.belowMinProfit);
  const removedByMicroFlipCount =
    radar?.debug?.rejectionReasons?.microFlip ?? metadataNumber(radarError?.metadata?.microFlip);
  const removedByStaleBlackMarketCount =
    radar?.debug?.rejectionReasons?.staleBlackMarketData ??
    metadataNumber(radarError?.metadata?.staleBlackMarketData);
  const errorTitle = radarError?.stage === 'plan' || radarError?.status === 403
    ? 'Acesso PRO necessário'
    : radarError?.stage === 'auth'
      ? 'Sessão não validada'
    : 'Consulta indisponível';

  const relaxFilters = React.useCallback(() => {
    setActivePreset(type === 'black-market' ? 'bmAmplo' : type === 'quick-sale' ? 'trader' : 'iniciante');
    setMinProfit(type === 'black-market' || type === 'quick-sale' ? 1000 : 500);
    setMinMargin(type === 'black-market' || type === 'quick-sale' ? 2 : 0);
    setMaxAgeHours(168);
    setMinEstimatedProfit(0);
    setMaxRisk('all');
    setMinConfidence('all');
    setIncludeMicroFlips(false);
    setIncludeSuspicious(false);
    setIncludeLowConfidence(true);
    setIncludeBlackMarket(type === 'black-market');
    setCategory('all');
    setTier('all');
    setEnchantment('all');
    setBuyCity('all');
    setSellCity('all');
    setQuickProfile(type === 'quick-sale' ? 'wide' : quickProfile);
    setBlackMarketProfile(type === 'black-market' ? 'wide' : blackMarketProfile);
    setBlackMarketFreshOnly(false);
    setBlackMarketMaxAgeHours(168);
    setScanDepth(type === 'black-market' ? 'black_market_pro' : type === 'quick-sale' ? 'quick_pro' : 'deep');
  }, [blackMarketProfile, quickProfile, type]);

  const applyBlackMarketProfile = React.useCallback((profile: OpportunityBlackMarketProfile) => {
    setBlackMarketProfile(profile);
    setType('black-market');
    setIncludeBlackMarket(true);
    setIncludeMicroFlips(false);
    setIncludeSuspicious(false);
    setWatchlistMode('extended');
    setBuyCity('all');
    setSellCity('all');
    setCategory('all');

    if (profile === 'wide') {
      setActivePreset('bmAmplo');
      setMinProfit(1000);
      setMinMargin(2);
      setMaxAgeHours(168);
      setMinEstimatedProfit(0);
      setMaxRisk('high');
      setMinConfidence('all');
      setSortBy('score');
      setBlackMarketFreshOnly(false);
      setBlackMarketMaxAgeHours(168);
      setScanDepth('black_market_pro');
      return;
    }

    if (profile === 'high_profit') {
      setActivePreset('bmAltoLucro');
      setMinProfit(20_000);
      setMinMargin(8);
      setMaxAgeHours(72);
      setMinEstimatedProfit(100_000);
      setMaxRisk('high');
      setMinConfidence('medium');
      setSortBy('profit');
      setBlackMarketFreshOnly(false);
      setBlackMarketMaxAgeHours(72);
      setScanDepth('black_market_pro');
      return;
    }

    if (profile === 'low_risk') {
      setActivePreset('bmBaixoRisco');
      setMinProfit(5000);
      setMinMargin(5);
      setMaxAgeHours(12);
      setMinEstimatedProfit(25_000);
      setMaxRisk('medium');
      setMinConfidence('medium');
      setSortBy('recent');
      setBlackMarketFreshOnly(true);
      setBlackMarketMaxAgeHours(12);
      setScanDepth('black_market_pro');
      return;
    }

    setActivePreset('mercadoNegro');
    setMinProfit(5000);
    setMinMargin(5);
    setMaxAgeHours(24);
    setMinEstimatedProfit(10_000);
    setMaxRisk('medium');
    setMinConfidence('medium');
    setSortBy('score');
    setBlackMarketFreshOnly(true);
    setBlackMarketMaxAgeHours(24);
    setScanDepth('black_market_pro');
  }, []);

  const applyQuickProfile = React.useCallback((profile: OpportunityQuickProfile) => {
    setQuickProfile(profile);
    setType('quick-sale');
    setIncludeMicroFlips(false);
    setIncludeSuspicious(false);
    setWatchlistMode('extended');

    if (profile === 'wide') {
      setMinProfit(1000);
      setMinMargin(2);
      setMaxAgeHours(168);
      setMinEstimatedProfit(0);
      setMaxRisk('high');
      setMinConfidence('all');
      setScanDepth('quick_pro');
      return;
    }

    setMinProfit(5000);
    setMinMargin(5);
    setMaxAgeHours(48);
    setMinEstimatedProfit(10_000);
    setMaxRisk('medium');
    setMinConfidence('medium');
    setScanDepth('quick_pro');
  }, []);

  const handleTypeChange = React.useCallback((nextType: OpportunityTypeFilter) => {
    setType(nextType);

    if (nextType === 'black-market') {
      setScanDepth((current) => current === 'black_market_deep' || current === 'deep' ? 'black_market_deep' : 'black_market_pro');
      setWatchlistMode('extended');
      setIncludeBlackMarket(true);
      return;
    }

    if (nextType === 'quick-sale') {
      setScanDepth((current) => current === 'quick_deep' || current === 'deep' ? 'quick_deep' : 'quick_pro');
      setWatchlistMode('extended');
      setIncludeBlackMarket(false);
    }
  }, []);

  const showMicroFlips = React.useCallback(() => {
    if (!isPro) {
      setUpgradeModalOpen(true);
      return;
    }

    setIncludeMicroFlips(true);
  }, [isPro]);

  const showProGate = React.useCallback((message: string) => {
    setGateMessage(message);
    window.setTimeout(() => setGateMessage(''), 3200);
  }, []);

  const handleExportCsv = React.useCallback(() => {
    if (!entitlements.exportCsv) {
      setUpgradeModalOpen(true);
      return;
    }

    exportOpportunitiesCsv(opportunities);
  }, [entitlements.exportCsv, opportunities]);

  const handleSaveFilter = React.useCallback(async () => {
    if (!canSaveFilters) {
      setUpgradeModalOpen(true);
      return;
    }

    if (savedFilters.length >= entitlements.maxSavedFilters) {
      if (isPro) {
        showProGate('Limite de presets PRO atingido.');
      } else {
        setUpgradeModalOpen(true);
      }
      return;
    }

    const name = window.prompt('Nome do filtro');

    if (!name?.trim()) return;

    try {
      const savedFilter = await createSavedFilter({
        name: name.trim(),
        page: 'opportunities',
        filters,
      });

      setSavedFilters((current) => [savedFilter, ...current]);
    } catch (error) {
      showProGate(error instanceof Error ? error.message : 'Não foi possível salvar o filtro.');
    }
  }, [canSaveFilters, entitlements.maxSavedFilters, filters, isPro, savedFilters.length, showProGate]);

  const applySavedFilter = React.useCallback((filter: SavedFilter) => {
    const value = filter.filters as Partial<typeof filters>;

    if (value.type) handleTypeChange(value.type as OpportunityTypeFilter);
    if (value.category) setCategory(value.category as CategoryFilter);
    if (value.tier !== undefined) setTier(value.tier as TierFilter);
    if (value.enchantment !== undefined) setEnchantment(value.enchantment as EnchantmentFilter);
    if (value.quality) setQuality(value.quality as QualityFilter);
    if (value.buyCity) setBuyCity(value.buyCity as CityFilter);
    if (value.sellCity) setSellCity(value.sellCity as CityFilter);
    if (typeof value.minProfit === 'number') setMinProfit(value.minProfit);
    if (typeof value.minMargin === 'number') setMinMargin(value.minMargin);
    if (typeof value.minEstimatedProfit === 'number') setMinEstimatedProfit(value.minEstimatedProfit);
    if (typeof value.maxAgeHours === 'number') setMaxAgeHours(value.maxAgeHours);
    if (value.maxRisk) setMaxRisk(value.maxRisk as RiskMaxFilter);
    if (typeof value.budget === 'number') setBudget(String(value.budget));
    if (typeof value.includeBlackMarket === 'boolean') setIncludeBlackMarket(value.includeBlackMarket);
    if (typeof value.includeLowConfidence === 'boolean') setIncludeLowConfidence(value.includeLowConfidence);
    if (typeof value.includeSuspicious === 'boolean') setIncludeSuspicious(value.includeSuspicious);
    if (typeof value.includeMicroFlips === 'boolean') setIncludeMicroFlips(value.includeMicroFlips);
    if (value.sortBy) setSortBy(value.sortBy as OpportunitySortBy);
    if (value.minConfidence) setMinConfidence(value.minConfidence as OpportunityConfidence | 'all');
    if (value.watchlistMode) setWatchlistMode('extended');
    if (
      value.scanDepth === 'deep' ||
      value.scanDepth === 'pro' ||
      value.scanDepth === 'quick_pro' ||
      value.scanDepth === 'quick_deep' ||
      value.scanDepth === 'black_market_pro' ||
      value.scanDepth === 'black_market_deep'
    ) {
      setScanDepth(value.scanDepth);
    }
    if (value.quickProfile === 'safe' || value.quickProfile === 'wide') setQuickProfile(value.quickProfile);
    if (
      value.blackMarketProfile === 'safe' ||
      value.blackMarketProfile === 'wide' ||
      value.blackMarketProfile === 'high_profit' ||
      value.blackMarketProfile === 'low_risk'
    ) {
      setBlackMarketProfile(value.blackMarketProfile);
    }
    if (typeof value.blackMarketFreshOnly === 'boolean') setBlackMarketFreshOnly(value.blackMarketFreshOnly);
    if (typeof value.blackMarketMaxAgeHours === 'number') setBlackMarketMaxAgeHours(value.blackMarketMaxAgeHours);
  }, [handleTypeChange]);

  const handleDeleteSavedFilter = React.useCallback(async (filterId: string) => {
    try {
      await deleteSavedFilter(filterId);
      setSavedFilters((current) => current.filter((filter) => filter.id !== filterId));
    } catch {
      showProGate('Não foi possível excluir o filtro.');
    }
  }, [showProGate]);

  const applyRadarPreset = React.useCallback((presetId: RadarPresetId) => {
    const preset = RADAR_PRESETS.find((item) => item.id === presetId);

    if (!preset) return;

    if (!isPro && presetId !== 'iniciante') {
      setUpgradeModalOpen(true);
      return;
    }

    setActivePreset(presetId);
    if (preset.apply.type) handleTypeChange(preset.apply.type);
    if (preset.apply.type === 'quick-sale') {
      setQuickProfile(presetId === 'baixoRisco' ? 'safe' : 'wide');
      setScanDepth('quick_pro');
    }
    if (preset.apply.type === 'black-market') {
      setBlackMarketProfile(preset.apply.blackMarketProfile ?? 'safe');
      setScanDepth('black_market_pro');
      setBlackMarketFreshOnly(preset.apply.blackMarketProfile === 'safe' || preset.apply.blackMarketProfile === 'low_risk');
      setBlackMarketMaxAgeHours(
        preset.apply.blackMarketProfile === 'low_risk'
          ? 12
          : preset.apply.blackMarketProfile === 'high_profit'
            ? 72
            : preset.apply.blackMarketProfile === 'wide'
              ? 168
              : 24,
      );
    }
    setMinProfit(preset.apply.minProfit);
    setMinMargin(preset.apply.minMargin);
    setMinEstimatedProfit(preset.apply.minEstimatedProfit);
    if (preset.apply.maxRisk) setMaxRisk(preset.apply.maxRisk);
    if (preset.apply.minConfidence) setMinConfidence(preset.apply.minConfidence);
    if (preset.apply.sortBy) setSortBy(preset.apply.sortBy);
    if (preset.apply.category) setCategory(preset.apply.category);
    if (typeof preset.apply.includeBlackMarket === 'boolean') {
      setIncludeBlackMarket(preset.apply.includeBlackMarket);
    }
    if (typeof preset.apply.includeSuspicious === 'boolean') {
      setIncludeSuspicious(preset.apply.includeSuspicious);
    }
    if (typeof preset.apply.includeMicroFlips === 'boolean') {
      setIncludeMicroFlips(preset.apply.includeMicroFlips);
    }
    if (preset.apply.type === 'black-market') {
      showProGate('Mercado Negro tem risco maior. Confira tudo no jogo antes de transportar.');
    }
  }, [handleTypeChange, isPro, showProGate]);

  if (!isPro) {
    return <FreeOpportunityGate />;
  }

  return (
    <div className="space-y-8">
      <ProUpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
      <header className={cn(
        'rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] shadow-2xl',
        isCompact ? 'p-4' : 'p-5 md:p-6',
      )}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Badge variant={isPro ? 'primary' : 'outline'} className="gap-2">
              <Zap size={13} />
              {isPro ? 'PRO ativo' : 'Free'}
            </Badge>
            <h1 className={cn('mt-2 font-black text-white', isCompact ? 'text-2xl' : 'text-3xl md:text-4xl')}>
              Radar de Oportunidades
            </h1>
            {!isCompact ? (
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Lucro líquido, margem, risco e confiança dos dados em uma lista mais densa.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={server}
              onChange={(event) => setServerOverride(event.target.value as ServerRegion)}
              className="h-10 rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              aria-label="Servidor"
            >
              {MARKET_SERVER_REGIONS.map((region) => (
                <option key={region} value={region}>{formatServerName(region)}</option>
              ))}
            </select>

            <select
              value={type}
              onChange={(event) => handleTypeChange(event.target.value as OpportunityTypeFilter)}
              className="h-10 rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              aria-label="Tipo de oportunidade"
            >
              <option value="black-market">Mercado Negro</option>
              <option value="quick-sale">Venda rápida entre cidades</option>
              <option value="listed-resale">Revenda anunciada</option>
              <option value="underpriced">Subpreço</option>
              <option value="all">Todos</option>
            </select>

            <button type="button" onClick={() => setAdvancedOpen(true)} className="secondary-button">
              <SlidersHorizontal size={16} />
              Filtros
            </button>
            <button type="button" onClick={handleExportCsv} className="secondary-button">
              <Download size={16} />
              Exportar CSV
            </button>
            <button type="button" onClick={() => void handleSaveFilter()} className="secondary-button">
              <Save size={16} />
              Salvar filtro
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span>Fonte: Albion Online Data Project</span>
          <span className="font-mono">{sourceHost}</span>
          <span>{hasAlbionPremium ? 'Premium ativo' : 'Sem Premium'}</span>
          <span>Mercado Negro: {formatPercent(transactionTaxRate * 100)}</span>
          <span>Venda rápida: {formatPercent(transactionTaxRate * 100)}</span>
          <span>Revenda anunciada: {formatPercent(sellOrderTotalFeeRate * 100)}</span>
          <span>Watchlist: {filters.watchlistMode === 'extended' ? 'estendida' : 'básica'}</span>
          <span>Varredura: {scanDepthLabel}</span>
          {type === 'quick-sale' ? (
            <span>Perfil da venda rápida: {quickProfile === 'safe' ? 'Segura' : 'Ampla'}</span>
          ) : null}
          {type === 'black-market' ? (
            <span>Perfil BM: {blackMarketProfileLabel(blackMarketProfile)}</span>
          ) : null}
          <span
            className={cn(
              'font-bold',
              isMockData
                ? 'text-status-warning'
                : marketSource === 'cache'
                  ? 'text-brand-primary'
                  : 'text-status-success',
            )}
          >
            {marketSourceLabel(marketSource)}
          </span>
        </div>
      </header>

      <section className={cn('rounded-lg border border-border-subtle bg-bg-card shadow-xl', isCompact ? 'p-3' : 'p-4')}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="Lucro mínimo" value={minProfit} onChange={setMinProfit} compact={isCompact} />
            <NumberField label="Margem mínima (%)" value={minMargin} onChange={setMinMargin} step={0.5} compact={isCompact} />
            <SelectField label="Tipo">
              <select
                value={type}
                onChange={(event) => handleTypeChange(event.target.value as OpportunityTypeFilter)}
                className={cn('w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary', isCompact ? 'h-9' : 'h-11')}
              >
                <option value="black-market">Mercado Negro</option>
                <option value="quick-sale">Venda rápida entre cidades</option>
                <option value="listed-resale">Revenda anunciada</option>
                <option value="underpriced">Subpreço</option>
                <option value="all">Todos</option>
              </select>
            </SelectField>
            <SelectField label="Meus filtros">
              <select
                disabled={!canSaveFilters || savedFilters.length === 0}
                onChange={(event) => {
                  const savedFilter = savedFilters.find((filter) => filter.id === event.target.value);
                  if (savedFilter) applySavedFilter(savedFilter);
                  event.currentTarget.value = '';
                }}
                className={cn('w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary disabled:opacity-50', isCompact ? 'h-9' : 'h-11')}
                defaultValue=""
              >
                <option value="">{canSaveFilters ? 'Aplicar preset' : 'PRO'}</option>
                {savedFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>{filter.name}</option>
                ))}
              </select>
            </SelectField>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn('secondary-button', viewMode === 'cards' && 'border-brand-primary/40 text-brand-primary')}
              aria-pressed={viewMode === 'cards'}
            >
              <Grid2X2 size={15} />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn('secondary-button', viewMode === 'list' && 'border-brand-primary/40 text-brand-primary')}
              aria-pressed={viewMode === 'list'}
            >
              <List size={15} />
              Lista compacta
            </button>
          </div>
        </div>

        {gateMessage ? <div className="mt-3"><ProGate variant="inline" description={gateMessage} /></div> : null}
        {!isPro ? (
          <div className="mt-3 text-xs text-zinc-500">
            Free usa watchlist básica, filtros essenciais e 1 preset. PRO libera filtros avançados, suspeitas, Mercado Negro, 20 presets e CSV.
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {RADAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyRadarPreset(preset.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-black transition-colors',
                activePreset === preset.id
                  ? 'border-brand-primary/50 bg-brand-primary/15 text-brand-primary'
                  : 'border-border-subtle bg-zinc-950 text-zinc-400 hover:border-brand-primary/35 hover:text-white',
                !isPro && preset.id !== 'iniciante' && 'opacity-70',
              )}
              title={!isPro && preset.id !== 'iniciante' ? 'Preset PRO' : undefined}
            >
              {preset.label}
              {!isPro && preset.id !== 'iniciante' ? ' PRO' : ''}
            </button>
          ))}
        </div>
        {type === 'black-market' ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-brand-primary">Mercado Negro recomendado</p>
                <p className="mt-1 text-sm text-zinc-300">
                  Compre em cidades comuns e venda direto para a maior ordem de compra do Black Market.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {BLACK_MARKET_PROFILE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyBlackMarketProfile(option.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-black transition-colors',
                      blackMarketProfile === option.value
                        ? 'border-brand-primary/50 bg-brand-primary/15 text-brand-primary'
                        : 'border-border-subtle bg-bg-card text-zinc-400 hover:border-brand-primary/40 hover:text-white',
                    )}
                    aria-pressed={blackMarketProfile === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Quantidade disponível: não informada pela API. O radar usa liquidez estimada pela existência e idade do dado do Mercado Negro.
            </p>
          </div>
        ) : null}
        {type === 'quick-sale' ? (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border-subtle bg-zinc-950/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Perfil da venda rápida</p>
              <p className="mt-1 text-sm text-zinc-300">
                Segura prioriza dados recentes. Ampla analisa mais rotas e relaxa idade/lucro mínimo.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => applyQuickProfile('safe')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-black transition-colors',
                  quickProfile === 'safe'
                    ? 'border-status-success/50 bg-status-success/15 text-status-success'
                    : 'border-border-subtle bg-bg-card text-zinc-400 hover:border-status-success/40 hover:text-white',
                )}
                aria-pressed={quickProfile === 'safe'}
              >
                Segura
              </button>
              <button
                type="button"
                onClick={() => applyQuickProfile('wide')}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-black transition-colors',
                  quickProfile === 'wide'
                    ? 'border-brand-primary/50 bg-brand-primary/15 text-brand-primary'
                    : 'border-border-subtle bg-bg-card text-zinc-400 hover:border-brand-primary/40 hover:text-white',
                )}
                aria-pressed={quickProfile === 'wide'}
              >
                Ampla
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {advancedOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border-subtle bg-bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-card/95 p-4 backdrop-blur">
              <div>
                <h2 className="flex items-center gap-2 font-black text-white">
                  <Filter className="text-brand-primary" size={18} />
                  Filtros avançados
                </h2>
                <p className="mt-1 text-xs text-zinc-500">O painel fica fechado para manter o radar denso.</p>
              </div>
              <button type="button" onClick={() => setAdvancedOpen(false)} className="icon-button" aria-label="Fechar filtros">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {!isPro ? <ProGate variant="inline" description="Filtros avançados são PRO." /> : null}

              <div className={cn('grid gap-3 sm:grid-cols-2', !isPro && 'pointer-events-none opacity-50')}>
                {type === 'black-market' ? (
                  <>
                    <SelectField label="Perfil Mercado Negro">
                      <select
                        value={blackMarketProfile}
                        onChange={(event) => applyBlackMarketProfile(event.target.value as OpportunityBlackMarketProfile)}
                        className="field-control"
                      >
                        {BLACK_MARKET_PROFILE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </SelectField>
                    <NumberField
                      label="Idade máxima BM (h)"
                      value={blackMarketMaxAgeHours}
                      onChange={setBlackMarketMaxAgeHours}
                    />
                  </>
                ) : null}

                {type === 'quick-sale' ? (
                  <SelectField label="Perfil da venda rápida">
                    <select
                      value={quickProfile}
                      onChange={(event) => applyQuickProfile(event.target.value as OpportunityQuickProfile)}
                      className="field-control"
                    >
                      <option value="safe">Segura</option>
                      <option value="wide">Ampla</option>
                    </select>
                  </SelectField>
                ) : null}

                <SelectField label="Categoria">
                  <select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)} className="field-control">
                    <option value="all">Todas</option>
                    {ITEM_CATEGORIES.map((itemCategory) => (
                      <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
                    ))}
                  </select>
                </SelectField>

                <SelectField label="Tier">
                  <select value={tier} onChange={(event) => setTier(event.target.value === 'all' ? 'all' : Number(event.target.value) as Tier)} className="field-control">
                    <option value="all">Todos</option>
                    {TIERS.map((value) => <option key={value} value={value}>T{value}</option>)}
                  </select>
                </SelectField>

                <SelectField label="Encantamento">
                  <select value={enchantment} onChange={(event) => setEnchantment(event.target.value === 'all' ? 'all' : Number(event.target.value) as Enchantment)} className="field-control">
                    <option value="all">Todos</option>
                    {ENCHANTMENTS.map((value) => <option key={value} value={value}>{formatEnchantment(value)}</option>)}
                  </select>
                </SelectField>

                <SelectField label="Qualidade">
                  <select value={quality} onChange={(event) => setQuality(event.target.value as QualityFilter)} className="field-control">
                    {QUALITIES.map((value) => <option key={value} value={value}>{formatQuality(value)}</option>)}
                  </select>
                </SelectField>

                <SelectField label="Cidade de compra">
                  <select value={buyCity} onChange={(event) => setBuyCity(event.target.value as CityFilter)} className="field-control">
                    <option value="all">Todas</option>
                    {ALBION_CITIES.map((city) => <option key={city} value={city}>{formatCityName(city)}</option>)}
                  </select>
                </SelectField>

                <SelectField label="Cidade de venda">
                  <select value={sellCity} onChange={(event) => setSellCity(event.target.value as CityFilter)} className="field-control">
                    <option value="all">Todas</option>
                    {ALBION_CITIES.map((city) => <option key={city} value={city}>{formatCityName(city)}</option>)}
                  </select>
                </SelectField>

                <NumberField label="Idade máxima (h)" value={maxAgeHours} onChange={setMaxAgeHours} />
                <NumberField label="Lucro total mínimo" value={minEstimatedProfit} onChange={setMinEstimatedProfit} />

                <SelectField label="Risco máximo">
                  <select value={maxRisk} onChange={(event) => setMaxRisk(event.target.value as RiskMaxFilter)} className="field-control">
                    <option value="low">Baixo risco</option>
                    <option value="medium">Risco médio</option>
                    <option value="high">Alto risco</option>
                    <option value="all">Todos</option>
                  </select>
                </SelectField>

                <SelectField label="Confiança mínima">
                  <select value={minConfidence} onChange={(event) => setMinConfidence(event.target.value as OpportunityConfidence | 'all')} className="field-control">
                    <option value="all">Todas</option>
                    <option value="medium">Média ou alta</option>
                    <option value="high">Alta</option>
                  </select>
                </SelectField>

                <label className="space-y-2">
                  <span className="field-label">Tenho disponível</span>
                  <input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="500000"
                    className="field-control"
                  />
                </label>

                <SelectField label="Ordenar por">
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as OpportunitySortBy)} className="field-control">
                    {OPPORTUNITY_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </SelectField>

                <SelectField label="Watchlist">
                  <select value="extended" onChange={() => setWatchlistMode('extended')} className="field-control">
                    <option value="extended">Estendida PRO</option>
                  </select>
                </SelectField>
              </div>

              <div className={cn('grid gap-2', !isPro && 'pointer-events-none opacity-50')}>
                {type !== 'black-market' ? (
                  <ToggleRow checked={includeBlackMarket} onChange={setIncludeBlackMarket} label="Incluir Mercado Negro" />
                ) : null}
                {type === 'black-market' ? (
                  <ToggleRow
                    checked={blackMarketFreshOnly}
                    onChange={setBlackMarketFreshOnly}
                    label="Somente dados recentes do Mercado Negro"
                    description="Exige que a ordem de compra do Black Market respeite a idade máxima BM configurada."
                  />
                ) : null}
                <ToggleRow checked={includeLowConfidence} onChange={setIncludeLowConfidence} label="Mostrar confiança baixa" />
                <ToggleRow checked={includeSuspicious} onChange={setIncludeSuspicious} label="Mostrar suspeitas" />
                <ToggleRow
                  checked={includeMicroFlips}
                  onChange={setIncludeMicroFlips}
                  label="Mostrar micro-flips"
                  description="Mostra oportunidades pequenas marcadas como Micro, sem destaque de oportunidade boa."
                />
              </div>

              {savedFilters.length > 0 ? (
                <section className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
                  <h3 className="font-black text-white">Presets salvos</h3>
                  <div className="mt-2 grid gap-2">
                    {savedFilters.map((filter) => (
                      <div key={filter.id} className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-card px-3 py-2">
                        <button type="button" onClick={() => applySavedFilter(filter)} className="truncate text-left text-sm font-bold text-zinc-200">
                          {filter.name}
                        </button>
                        <button type="button" onClick={() => void handleDeleteSavedFilter(filter.id)} className="text-xs font-bold text-status-danger">
                          Excluir
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <button type="button" onClick={() => setAdvancedOpen(false)} className="primary-button w-full justify-center">
                Aplicar
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title={isBlackMarketMode ? 'Melhor oportunidade BM' : 'Melhor oportunidade útil'}
          value={bestOpportunity ? `Score ${bestOpportunity.score ?? 0}` : 'Sem rota'}
          icon={Zap}
          description={bestOpportunity ? `${bestOpportunity.itemName} · ${formatCityName(bestOpportunity.buyCity)}` : 'Ajuste os filtros'}
          compact={isCompact}
        />
        <StatCard
          title={isBlackMarketMode ? 'Maior lucro BM' : 'Maior lucro líquido útil'}
          value={highestProfit ? formatSilver(highestProfit.netProfit) : '0 prata'}
          icon={BadgeDollarSign}
          description={highestProfit ? `${highestProfit.itemName} · ${formatCityName(highestProfit.buyCity)}` : 'Sem dados'}
          compact={isCompact}
        />
        <StatCard
          title={isBlackMarketMode ? 'Melhor liquidez estimada' : 'Maior margem confiável'}
          value={isBlackMarketMode ? liquidityLabel(bestLiquidity?.estimatedLiquidity) : highestMargin ? formatPercent(highestMargin.margin) : '0,0%'}
          icon={TrendingUp}
          description={isBlackMarketMode ? bestLiquidity?.itemName ?? 'Sem dados' : highestMargin?.itemName ?? 'Sem dados'}
          compact={isCompact}
        />
        <StatCard
          title={isBlackMarketMode ? 'Oportunidades BM úteis' : 'Oportunidades úteis'}
          value={usefulOpportunities.length}
          icon={ShieldCheck}
          description={`${trustedCount} com confiança alta`}
          compact={isCompact}
        />
        <StatCard
          title="Itens analisados"
          value={radar?.analyzedItems ?? validItemsCount}
          icon={BarChart3}
          description={`Solicitados: ${requestedItemsCount}`}
          compact={isCompact}
        />
        <StatCard
          title={isBlackMarketMode ? 'Rotas BM avaliadas' : 'Oportunidades exibidas'}
          value={radar?.displayedOpportunities ?? finalOpportunitiesCount}
          icon={ListFilter}
          description={`Rotas avaliadas: ${radar?.evaluatedRoutes ?? rawCandidatesCount}`}
          compact={isCompact}
        />
      </section>

      <RadarMetadataStrip
        requestedItemsCount={requestedItemsCount}
        validItemsCount={validItemsCount}
        apiReturnedRows={apiReturnedRows}
        rawCandidatesCount={rawCandidatesCount}
        positiveCandidatesCount={positiveCandidatesCount}
        removedByMinProfitCount={removedByMinProfitCount}
        removedByStaleBlackMarketCount={removedByStaleBlackMarketCount}
        removedByMicroFlipCount={removedByMicroFlipCount}
        finalOpportunitiesCount={finalOpportunitiesCount}
        stage={radarError?.stage}
        message={radar?.message}
      />

      {errorMessage ? (
        <WarningPanel title={errorTitle} message={errorMessage} />
      ) : null}

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-border-subtle bg-bg-card">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-zinc-400">
              {type === 'black-market'
                ? 'Analisando oportunidades no Mercado Negro...'
                : `Analisando oportunidades do mercado em ${formatServerName(server)}...`}
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && !errorMessage && opportunities.length === 0 ? (
        <EmptyOpportunityState
          message={radar?.message}
          isBlackMarketMode={type === 'black-market'}
          onRelaxFilters={relaxFilters}
          onBlackMarketWide={() => applyBlackMarketProfile('wide')}
          onReduceProfit={() => setMinProfit(1000)}
          onIncreaseBlackMarketAge={() => {
            setBlackMarketFreshOnly(false);
            setBlackMarketMaxAgeHours(168);
            setMaxAgeHours(168);
          }}
          onShowMicroFlips={showMicroFlips}
          onAllModes={() => {
            setType('all');
            setMinConfidence('all');
          }}
          canRunExpandedScan={isPro}
          onExpandedScan={() => {
            setWatchlistMode('extended');
            setMaxAgeHours(168);

            if (type === 'quick-sale') {
              setQuickProfile('wide');
              setScanDepth('quick_deep');
              setMinProfit(1000);
              setMinMargin(2);
              setIncludeMicroFlips(false);
              return;
            }

            if (type === 'black-market') {
              setBlackMarketProfile('wide');
              setBlackMarketFreshOnly(false);
              setBlackMarketMaxAgeHours(168);
              setScanDepth('black_market_deep');
              setMinProfit(1000);
              setMinMargin(2);
              setIncludeMicroFlips(false);
              return;
            }

            setScanDepth('deep');
          }}
        />
      ) : null}

      {!isLoading && opportunities.length > 0 ? (
        <>
          {viewMode === 'list' ? (
            <OpportunityCompactTable
              opportunities={visibleOpportunities}
              isBlackMarketMode={isBlackMarketMode}
              onDetails={setSelectedOpportunity}
            />
          ) : (
            <section className={cn('space-y-4', isCompact && 'space-y-2')}>
              {visibleOpportunities.map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  hasBudget={Boolean(filters.budget)}
                  hasAlbionPremium={hasAlbionPremium}
                  compact={isCompact}
                  onDetails={setSelectedOpportunity}
                />
              ))}
            </section>
          )}
          {opportunities.length > visibleOpportunities.length ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setDisplayLimit((current) => current + 25)}
                className="secondary-button"
              >
                Carregar mais oportunidades
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <details className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-brand-primary">
          <Layers3 size={18} />
          Como funciona o Radar
        </summary>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          O radar compara preços entre cidades, calcula lucro líquido após taxas e ranqueia oportunidades por score, margem, risco e confiança. Preços muito fora da curva ou antigos são filtrados para evitar oportunidades falsas.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          Mercado Negro procura itens que podem ser comprados em cidades comuns e vendidos diretamente para ordens de compra do Black Market. O cálculo usa o preço de compra da cidade, a maior ordem de compra do Mercado Negro e a taxa de transação conforme seu Premium.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          A API pública não informa com segurança a quantidade disponível na ordem do Mercado Negro. Por isso, o site mostra liquidez estimada com base na existência e idade dos dados.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          Na Venda rápida, o radar procura itens que podem ser comprados pelo menor preço anunciado em uma cidade e vendidos imediatamente para a maior ordem de compra em outra cidade. É o modo mais conservador, mas também o mais difícil de encontrar em grande quantidade.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          Se aparecerem poucas rotas, use Venda rápida Ampla, reduza o lucro mínimo ou aumente a idade máxima dos dados.
        </p>
        <p className="mt-3 max-w-4xl text-xs font-bold leading-relaxed text-status-warning">
          Os preços vêm de dados públicos e podem mudar dentro do jogo. Confira antes de transportar.
        </p>
      </details>

      {selectedOpportunity ? (
        <OpportunityDetailsModal
          opportunity={selectedOpportunity}
          hasAlbionPremium={hasAlbionPremium}
          isPro={isPro}
          onClose={() => setSelectedOpportunity(null)}
        />
      ) : null}
    </div>
  );
}

function FreeOpportunityGate() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <Badge variant="primary" className="gap-2">
          <Zap size={13} />
          PRO
        </Badge>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">Radar de Oportunidades</h1>
        <p className="mt-3 max-w-3xl text-base font-bold leading-relaxed text-zinc-200">
          Encontre rotas de compra e venda com lucro líquido, margem, risco e confiança dos dados.
        </p>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-400 md:text-base">
          O Radar de Oportunidades analisa preços públicos do mercado do Albion, compara cidades e destaca possíveis flips considerando taxas, margem, risco, idade dos dados e filtros de sanidade.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {FREE_OPPORTUNITY_CARDS.map((card) => (
          <article key={card.title} className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
            <div className="mb-3 inline-flex rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
              <card.icon size={19} />
            </div>
            <h2 className="font-black text-white">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{card.description}</p>
          </article>
        ))}
      </section>

      <ProGate
        title="Desbloquear Radar PRO"
        description="A lista real de oportunidades é exclusiva para usuários PRO ativos."
      />
    </div>
  );
}

function OpportunityCard({
  opportunity,
  hasBudget,
  hasAlbionPremium,
  compact,
  onDetails,
}: {
  opportunity: Opportunity;
  hasBudget: boolean;
  hasAlbionPremium: boolean;
  compact: boolean;
  onDetails: (opportunity: Opportunity) => void;
}) {
  const appliedTaxRate = opportunity.taxRateApplied ?? (
    opportunity.type === 'listed-resale'
      ? getSellOrderTotalFeeRate(hasAlbionPremium)
      : getTransactionTaxRate(hasAlbionPremium)
  );
  const taxModeLabel = hasAlbionPremium ? 'Premium' : 'sem Premium';

  return (
    <article className={cn('rounded-lg border border-border-subtle bg-bg-card shadow-xl transition-colors hover:border-brand-primary/35', compact ? 'p-3' : 'p-5 lg:p-6')}>
      <div className={cn('grid xl:grid-cols-[1.1fr_1fr_1.2fr_0.78fr] xl:items-center', compact ? 'gap-3' : 'gap-6')}>
        <div className={cn(compact ? 'space-y-2' : 'space-y-3')}>
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center justify-center rounded-lg border border-border-subtle bg-zinc-950 font-black text-brand-primary', compact ? 'h-9 w-9' : 'h-12 w-12')}>
              {opportunity.itemName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h3 className={cn('truncate font-black text-white', compact ? 'text-base' : 'text-lg')}>{opportunity.itemName}</h3>
              {!compact ? <p className="truncate text-xs text-zinc-500">{opportunity.itemNameEn ?? opportunity.itemId}</p> : null}
              {!compact ? <p className="font-mono text-[11px] text-zinc-600">{opportunity.itemId}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatTierEnchant(opportunity.tier, opportunity.enchantment)}</Badge>
            <Badge variant="primary">{opportunityTypeLabel(opportunity.type)}</Badge>
            <Badge variant={worthVariant(opportunity.worthLevel)}>{worthLevelLabel(opportunity.worthLevel)}</Badge>
            {opportunity.isSuspicious ? <Badge variant="danger">Suspeita</Badge> : null}
            {opportunity.category ? <Badge variant="muted">{opportunity.category}</Badge> : null}
          </div>
          {opportunity.isSuspicious && !compact ? (
            <div className="rounded-lg border border-status-danger/25 bg-status-danger/10 p-3 text-xs leading-relaxed text-status-danger">
              Confira manualmente no jogo. Esta oportunidade pode ser preço trollado ou dado inconsistente.
            </div>
          ) : null}
          {opportunity.type === 'black-market' ? (
            <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-3 text-xs leading-relaxed text-zinc-300">
              <p>Quantidade: {opportunity.quantityAvailableLabel ?? 'não informada pela API'}</p>
              <p>Liquidez estimada: {liquidityLabel(opportunity.estimatedLiquidity)}</p>
            </div>
          ) : null}
        </div>

        <div className={cn('rounded-lg border border-border-subtle bg-zinc-950', compact ? 'p-3' : 'p-4')}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Comprar em</p>
              <p className="mt-1 font-black text-white">{formatCityName(opportunity.buyCity)}</p>
              <p className="text-sm text-status-success">{formatSilver(opportunity.buyPrice)}</p>
            </div>
            <ArrowRight className="text-brand-primary" size={18} />
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Vender em</p>
              <p className="mt-1 font-black text-white">{formatCityName(opportunity.sellCity)}</p>
              <p className="text-sm text-status-info">{formatSilver(opportunity.sellPrice)}</p>
            </div>
          </div>
        </div>

        <div className={cn('grid sm:grid-cols-3', compact ? 'gap-2' : 'gap-3')}>
          <MiniMetric label="Lucro un." value={formatSilver(opportunity.netProfit)} tone={opportunity.isMicroFlip ? undefined : 'success'} />
          <MiniMetric label="Margem" value={formatPercent(opportunity.margin)} tone="brand" />
          <MiniMetric label="Score" value={`${opportunity.score ?? 0}/100`} tone="brand" />
          <MiniMetric label={`Taxa usada: ${formatPercent(appliedTaxRate * 100)} ${taxModeLabel}`} value={formatSilver(opportunity.estimatedTax)} tone="danger" />
          <MiniMetric label="Investimento" value={formatSilver(opportunity.investment ?? opportunity.buyPrice)} />
          <MiniMetric label="Dados" value={formatAgeHours(opportunity.maxDataAgeHours)} />
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Badge variant={scoreVariant(opportunity.scoreLabel)}>
              {scoreLabelText(opportunity.scoreLabel)}
            </Badge>
            <Badge variant={confidenceVariant(opportunity.confidence)}>
              {confidenceLabel(opportunity.confidence)}
            </Badge>
            <Badge variant={riskVariant(opportunity.risk)}>{riskLabel(opportunity.risk)}</Badge>
          </div>

          {hasBudget ? (
            <div className="w-full rounded-lg border border-border-subtle bg-zinc-950 p-3 text-xs xl:text-right">
              <p className="font-bold text-zinc-500">Quantidade sugerida</p>
              <p className="mt-1 font-black text-white">{opportunity.suggestedQuantity ?? 0} un.</p>
              <p className="mt-1 text-status-success">
                Lucro estimado: {formatSilver(opportunity.estimatedNetProfit ?? 0)}
              </p>
            </div>
          ) : null}

          <p className="text-xs text-zinc-500">
            <RelativeTime date={opportunity.updatedAt} prefix="Atualizado" />
          </p>
          <button
            type="button"
            onClick={() => onDetails(opportunity)}
            className={cn('inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-subtle bg-zinc-900 text-sm font-bold text-white transition-colors hover:border-brand-primary/40 xl:w-auto', compact ? 'px-3 py-2' : 'px-4 py-3')}
          >
            Ver detalhes <Eye size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function OpportunityCompactTable({
  opportunities,
  isBlackMarketMode,
  onDetails,
}: {
  opportunities: Opportunity[];
  isBlackMarketMode: boolean;
  onDetails: (opportunity: Opportunity) => void;
}) {
  const headers = isBlackMarketMode
    ? ['Item', 'Comprar em', 'Vender no BM', 'Preço compra', 'Ordem BM', 'Lucro líquido', 'Margem', 'Score', 'Liquidez estimada', 'Dados BM', 'Risco', 'Detalhes']
    : ['Item', 'Tipo', 'Compra', 'Venda', 'Lucro', 'Margem', 'Score', 'Vale a pena?', 'Confiança', 'Risco', 'Detalhes'];

  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-zinc-950/80">
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 text-[11px] font-bold uppercase text-zinc-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/70">
            {opportunities.map((opportunity) => {
              if (isBlackMarketMode) {
                return (
                  <tr key={opportunity.id} className="hover:bg-zinc-900/60">
                    <td className="max-w-[260px] px-3 py-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-black text-white">{opportunity.itemName}</p>
                        <Badge variant="outline">{formatTierEnchant(opportunity.tier, opportunity.enchantment)}</Badge>
                      </div>
                      <p className="truncate font-mono text-[11px] text-zinc-600">{opportunity.itemId}</p>
                    </td>
                    <td className="px-3 py-2 font-bold text-white">{formatCityName(opportunity.buyCity)}</td>
                    <td className="px-3 py-2 font-bold text-white">Mercado Negro</td>
                    <td className="px-3 py-2 text-status-success">{formatSilver(opportunity.buyPrice)}</td>
                    <td className="px-3 py-2 text-status-info">{formatSilver(opportunity.blackMarketBuyPrice ?? opportunity.sellPrice)}</td>
                    <td className={cn('px-3 py-2 font-black', opportunity.isMicroFlip ? 'text-zinc-400' : 'text-status-success')}>
                      {formatSilver(opportunity.netProfit)}
                    </td>
                    <td className="px-3 py-2 font-black text-brand-primary">{formatPercent(opportunity.margin)}</td>
                    <td className="px-3 py-2 font-black text-white">{opportunity.score ?? 0}</td>
                    <td className="px-3 py-2"><Badge variant={liquidityVariant(opportunity.estimatedLiquidity)}>{liquidityLabel(opportunity.estimatedLiquidity)}</Badge></td>
                    <td className="px-3 py-2 text-zinc-400">{opportunity.blackMarketUpdatedAt ? <RelativeTime date={opportunity.blackMarketUpdatedAt} /> : 'Sem data'}</td>
                    <td className="px-3 py-2"><Badge variant={riskVariant(opportunity.risk)}>{riskLabel(opportunity.risk)}</Badge></td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onDetails(opportunity)} className="secondary-button">
                        <Eye size={15} />
                        Detalhes
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
              <tr key={opportunity.id} className="hover:bg-zinc-900/60">
                <td className="max-w-[260px] px-3 py-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate font-black text-white">{opportunity.itemName}</p>
                    <Badge variant="outline">{formatTierEnchant(opportunity.tier, opportunity.enchantment)}</Badge>
                  </div>
                  <p className="truncate font-mono text-[11px] text-zinc-600">{opportunity.itemId}</p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="primary">{opportunityTypeLabel(opportunity.type)}</Badge>
                </td>
                <td className="px-3 py-2">
                  <p className="font-bold text-white">{formatCityName(opportunity.buyCity)}</p>
                  <p className="text-status-success">{formatSilver(opportunity.buyPrice)}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="font-bold text-white">{formatCityName(opportunity.sellCity)}</p>
                  <p className="text-status-info">{formatSilver(opportunity.sellPrice)}</p>
                </td>
                <td className={cn('px-3 py-2 font-black', opportunity.isMicroFlip ? 'text-zinc-400' : 'text-status-success')}>
                  {formatSilver(opportunity.netProfit)}
                </td>
                <td className="px-3 py-2 font-black text-brand-primary">{formatPercent(opportunity.margin)}</td>
                <td className="px-3 py-2 font-black text-white">{opportunity.score ?? 0}</td>
                <td className="px-3 py-2">
                  <Badge variant={worthVariant(opportunity.worthLevel)}>{worthLevelLabel(opportunity.worthLevel)}</Badge>
                </td>
                <td className="px-3 py-2"><Badge variant={confidenceVariant(opportunity.confidence)}>{confidenceLabel(opportunity.confidence)}</Badge></td>
                <td className="px-3 py-2"><Badge variant={riskVariant(opportunity.risk)}>{riskLabel(opportunity.risk)}</Badge></td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => onDetails(opportunity)} className="secondary-button">
                    <Eye size={15} />
                    Detalhes
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OpportunityDetailsModal({
  opportunity,
  hasAlbionPremium,
  isPro,
  onClose,
}: {
  opportunity: Opportunity;
  hasAlbionPremium: boolean;
  isPro: boolean;
  onClose: () => void;
}) {
  const feeRate = opportunity.type === 'listed-resale'
    ? getSellOrderTotalFeeRate(hasAlbionPremium)
    : getTransactionTaxRate(hasAlbionPremium);
  const feeLabel =
    opportunity.type === 'listed-resale'
      ? 'Revenda anunciada'
      : opportunity.type === 'black-market'
        ? 'Mercado Negro'
        : 'Venda rápida';
  const taxModeLabel = hasAlbionPremium ? 'Premium' : 'sem Premium';

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-bg-card shadow-2xl md:max-w-5xl md:rounded-lg">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-card/95 p-5 backdrop-blur">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{opportunityTypeLabel(opportunity.type)}</Badge>
              <Badge variant={worthVariant(opportunity.worthLevel)}>{worthLevelLabel(opportunity.worthLevel)}</Badge>
              {opportunity.isSuspicious ? <Badge variant="danger">Suspeita</Badge> : null}
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">{opportunity.itemName}</h2>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{opportunity.itemId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-zinc-950 text-zinc-400 hover:text-white"
            aria-label="Fechar detalhes"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <MiniMetric label="Tipo de operação" value={opportunityTypeLabel(opportunity.type)} tone="brand" />
            <MiniMetric label="Compra" value={`${formatCityName(opportunity.buyCity)} · ${formatSilver(opportunity.buyPrice)}`} />
            <MiniMetric label="Venda" value={`${formatCityName(opportunity.sellCity)} · ${formatSilver(opportunity.sellPrice)}`} />
            <MiniMetric label="Lucro por unidade" value={formatSilver(opportunity.netProfitPerUnit ?? opportunity.netProfit)} tone={opportunity.isMicroFlip ? undefined : 'success'} />
            <MiniMetric label="Lucro total estimado" value={formatSilver(opportunity.estimatedNetProfit ?? opportunity.netProfit)} tone={opportunity.isMicroFlip ? undefined : 'success'} />
            <MiniMetric label="Qtd. sugerida" value={`${opportunity.suggestedQuantity ?? 1} un.`} />
            <MiniMetric label="Investimento estimado" value={formatSilver(opportunity.estimatedInvestment ?? opportunity.buyPrice)} />
            <MiniMetric label="Score" value={`${opportunity.score ?? 0}/100`} tone="brand" />
            <MiniMetric label="Mediana do item" value={opportunity.referenceMedianPrice ? formatSilver(opportunity.referenceMedianPrice) : 'Sem referência'} />
            <MiniMetric label="Razão venda/compra" value={formatPriceRatio(opportunity.priceRatio)} tone={opportunity.priceRatio && opportunity.priceRatio > 4 ? 'danger' : undefined} />
            <MiniMetric label="Margem" value={formatPercent(opportunity.margin)} tone={opportunity.margin > 300 ? 'danger' : 'brand'} />
            <MiniMetric label="Idade dos dados" value={formatAgeHours(opportunity.maxDataAgeHours)} />
            <MiniMetric label="Outlier detectado" value={formatOutlierState(opportunity)} tone={opportunity.sellPriceOutlier || opportunity.buyPriceOutlier ? 'danger' : undefined} />
            {opportunity.type === 'black-market' ? (
              <>
                <MiniMetric label="Ordem BM" value={formatSilver(opportunity.blackMarketBuyPrice ?? opportunity.sellPrice)} tone="brand" />
                <MiniMetric label="Dados BM" value={formatAgeHours(opportunity.blackMarketAgeHours)} />
                <MiniMetric label="Liquidez estimada" value={liquidityLabel(opportunity.estimatedLiquidity)} tone={opportunity.estimatedLiquidity === 'alta' ? 'success' : undefined} />
                <MiniMetric label="Quantidade" value={opportunity.quantityAvailableLabel ?? 'não informada'} />
              </>
            ) : null}
          </div>

          {opportunity.type === 'black-market' ? (
            <section className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 text-sm leading-relaxed text-zinc-300">
              <h3 className="font-black text-white">Mercado Negro</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <p>Item ID: <span className="font-mono text-zinc-200">{opportunity.itemId}</span></p>
                <p>Cidade de compra: {formatCityName(opportunity.buyCity)}</p>
                <p>Preço de compra: {formatSilver(opportunity.buyPrice)}</p>
                <p>Black Market buy_price_max: {formatSilver(opportunity.blackMarketBuyPrice ?? opportunity.sellPrice)}</p>
                <p>Taxa usada: {formatPercent(feeRate * 100)} {taxModeLabel}</p>
                <p>Liquidez estimada: {liquidityLabel(opportunity.estimatedLiquidity)}</p>
                <p>Quantidade disponível: {opportunity.quantityAvailableLabel ?? 'não informada pela API'}</p>
                <p>Dado BM: {opportunity.blackMarketUpdatedAt ? <RelativeTime date={opportunity.blackMarketUpdatedAt} /> : 'Sem data'}</p>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                A API pública não informa a quantidade exata disponível na ordem. A liquidez é estimada pela existência e idade dos dados do Mercado Negro.
              </p>
            </section>
          ) : null}

          {opportunity.isSuspicious ? (
            <div className="rounded-lg border border-status-danger/25 bg-status-danger/10 p-4 text-sm leading-relaxed text-status-danger">
              Confira manualmente no jogo. Esta oportunidade pode ser preço trollado ou dado inconsistente.
            </div>
          ) : null}

          {opportunity.isMicroFlip ? (
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300">
              Esta oportunidade tem margem positiva, mas o lucro absoluto é muito baixo e pode não compensar o tempo de transporte.
            </div>
          ) : null}

          {isPro ? (
            <section className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <Calculator className="text-brand-primary" size={18} />
                Como o cálculo foi feito
              </h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-400">
                <p>Preço de compra usado: {formatSilver(opportunity.buyPrice)} em {formatCityName(opportunity.buyCity)}.</p>
                <p>Preço de venda usado: {formatSilver(opportunity.sellPrice)} em {formatCityName(opportunity.sellCity)}.</p>
                {opportunity.type === 'black-market' ? (
                  <>
                    <p>Venda no Mercado Negro usa buy_price_max do Black Market: {formatSilver(opportunity.blackMarketBuyPrice ?? opportunity.sellPrice)}.</p>
                    <p>Quantidade disponível: {opportunity.quantityAvailableLabel ?? 'não informada pela API'}.</p>
                    <p>Liquidez estimada: {liquidityLabel(opportunity.estimatedLiquidity)}.</p>
                  </>
                ) : null}
                <p>Mediana de venda do item nas cidades: {opportunity.referenceMedianPrice ? formatSilver(opportunity.referenceMedianPrice) : 'sem referência suficiente'}.</p>
                <p>Razão venda/compra: {formatPriceRatio(opportunity.priceRatio)}.</p>
                <p>Outlier: {formatOutlierState(opportunity)}.</p>
                <p>Lucro bruto = {formatSilver(opportunity.sellPrice)} - {formatSilver(opportunity.buyPrice)} = {formatSilver(opportunity.grossProfit)}</p>
                <p>
                  {feeLabel}: {formatSilver(opportunity.sellPrice)} x {formatPercent(feeRate * 100)} ={' '}
                  {formatSilver(opportunity.estimatedTax)}
                </p>
                <p>Lucro líquido = {formatSilver(opportunity.grossProfit)} - {formatSilver(opportunity.estimatedTax)} = {formatSilver(opportunity.netProfit)}</p>
                <p>Lucro total estimado = {opportunity.suggestedQuantity ?? 1} x {formatSilver(opportunity.netProfitPerUnit ?? opportunity.netProfit)} = {formatSilver(opportunity.estimatedNetProfit ?? opportunity.netProfit)}</p>
                <p>Classificação prática: {worthLevelLabel(opportunity.worthLevel)}.</p>
                <p>Margem/ROI por unidade: {formatPercent(opportunity.roi ?? opportunity.margin)}</p>
                <p>Idade máxima dos dados usados: {formatAgeHours(opportunity.maxDataAgeHours)}</p>
                <p>Atualização compra: {opportunity.buyUpdatedAt ? formatDateTime(opportunity.buyUpdatedAt) : 'Sem data'}</p>
                <p>Atualização venda: {opportunity.sellUpdatedAt ? formatDateTime(opportunity.sellUpdatedAt) : 'Sem data'}</p>
              </div>
            </section>
          ) : (
            <ProGate variant="inline" description="Detalhes completos do cálculo são PRO." />
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <ReasonPanel
              title="Sanidade do preço"
              items={
                opportunity.isSuspicious
                  ? opportunity.suspicionReasons ?? []
                  : ['Nenhum outlier detectado pelos filtros atuais.']
              }
              danger={opportunity.isSuspicious}
            />
            <ReasonPanel title="Confiança dos dados" items={opportunity.confidenceReasons ?? []} />
            <ReasonPanel title="Risco da rota" items={opportunity.riskReasons ?? []} />
            <ReasonPanel title="Explicação do score" items={opportunity.scoreReasons ?? []} />
            <ReasonPanel
              title="Vale a pena?"
              items={[...(opportunity.worthReasons ?? []), ...(opportunity.microFlipReasons ?? [])]}
              danger={opportunity.isMicroFlip || opportunity.worthLevel === 'suspeita'}
            />
          </section>

          <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
            <div className="border-b border-border-subtle p-4">
              <h3 className="flex items-center gap-2 font-black text-white">
                <MapPin className="text-brand-primary" size={18} />
                Preços por cidade do item
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-subtle bg-zinc-950/70">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Cidade</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Menor venda</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Maior compra</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Atualização</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/70">
                  {(opportunity.priceTable ?? []).map((price) => (
                    <tr key={price.city} className="hover:bg-zinc-900/60">
                      <td className="px-4 py-3 font-black text-white">{formatCityName(price.city)}</td>
                      <td className="px-4 py-3 font-bold text-status-success">{price.sellPriceMin > 0 ? formatSilver(price.sellPriceMin) : 'Sem dado'}</td>
                      <td className="px-4 py-3 font-bold text-status-info">{price.buyPriceMax > 0 ? formatSilver(price.buyPriceMax) : 'Sem dado'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{price.updatedAt ? <RelativeTime date={price.updatedAt} /> : 'Sem data'}</td>
                      <td className="px-4 py-3"><Badge variant={price.updateStatus === 'updated' ? 'success' : price.updateStatus === 'medium' ? 'warning' : 'danger'}>{updateStatusLabel(price.updateStatus)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm leading-relaxed text-status-warning">
            {opportunity.type === 'black-market'
              ? 'Antes de comprar e transportar, confira a ordem do Mercado Negro dentro do jogo. Os dados vêm de coleta pública e podem mudar.'
              : 'Confira o preço dentro do jogo antes de transportar. Os dados dependem da última coleta pública disponível.'}
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarMetadataStrip({
  requestedItemsCount,
  validItemsCount,
  apiReturnedRows,
  rawCandidatesCount,
  positiveCandidatesCount,
  removedByMinProfitCount,
  removedByStaleBlackMarketCount,
  removedByMicroFlipCount,
  finalOpportunitiesCount,
  stage,
  message,
}: {
  requestedItemsCount: number;
  validItemsCount: number;
  apiReturnedRows: number;
  rawCandidatesCount: number;
  positiveCandidatesCount: number;
  removedByMinProfitCount: number;
  removedByStaleBlackMarketCount: number;
  removedByMicroFlipCount: number;
  finalOpportunitiesCount: number;
  stage?: string;
  message?: string;
}) {
  const hasAnyMetadata =
    requestedItemsCount > 0 ||
    validItemsCount > 0 ||
    apiReturnedRows > 0 ||
    rawCandidatesCount > 0 ||
    positiveCandidatesCount > 0 ||
    removedByMinProfitCount > 0 ||
    removedByStaleBlackMarketCount > 0 ||
    removedByMicroFlipCount > 0 ||
    finalOpportunitiesCount > 0 ||
    Boolean(stage);

  if (!hasAnyMetadata) return null;

  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-xs text-zinc-500 shadow-xl">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <span>Itens solicitados: {requestedItemsCount}</span>
        <span>Itens válidos: {validItemsCount}</span>
        <span>Linhas da API: {apiReturnedRows}</span>
        <span>Rotas avaliadas: {rawCandidatesCount}</span>
        <span>Candidatos com lucro positivo: {positiveCandidatesCount}</span>
        <span>Removidos por lucro mínimo: {removedByMinProfitCount}</span>
        <span>Removidos por dado BM antigo: {removedByStaleBlackMarketCount}</span>
        <span>Removidos por micro-flip: {removedByMicroFlipCount}</span>
        <span>Após filtros: {finalOpportunitiesCount}</span>
        {process.env.NODE_ENV === 'development' && stage ? (
          <span className="font-bold text-status-warning">Stage: {stage}</span>
        ) : null}
      </div>
      {message ? <p className="mt-2 text-zinc-400">{message}</p> : null}
    </section>
  );
}

function EmptyOpportunityState({
  message,
  isBlackMarketMode,
  onRelaxFilters,
  onBlackMarketWide,
  onReduceProfit,
  onIncreaseBlackMarketAge,
  onShowMicroFlips,
  onAllModes,
  canRunExpandedScan,
  onExpandedScan,
}: {
  message?: string;
  isBlackMarketMode?: boolean;
  onRelaxFilters: () => void;
  onBlackMarketWide?: () => void;
  onReduceProfit?: () => void;
  onIncreaseBlackMarketAge?: () => void;
  onShowMicroFlips: () => void;
  onAllModes: () => void;
  canRunExpandedScan: boolean;
  onExpandedScan: () => void;
}) {
  return (
    <section className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-5 shadow-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-status-warning">
            <AlertTriangle size={20} />
            <h2 className="font-black text-white">Nenhuma oportunidade útil encontrada</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
            {message ?? (isBlackMarketMode
              ? 'Nenhuma oportunidade útil no Mercado Negro encontrada com os filtros atuais.'
              : 'Nenhuma rota passou pelos filtros atuais. Tente reduzir lucro, margem, risco ou idade dos dados.')}
          </p>
          <p className="mt-2 text-sm font-bold text-status-warning">
            {isBlackMarketMode
              ? 'Teste o perfil Amplo, aumente a idade dos dados BM ou rode a varredura ampliada BM.'
              : 'Você também pode testar outra qualidade, servidor ou ativar micro-flips.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isBlackMarketMode && onBlackMarketWide ? (
            <button type="button" onClick={onBlackMarketWide} className="primary-button">
              Perfil Amplo
            </button>
          ) : null}
          {isBlackMarketMode && onReduceProfit ? (
            <button type="button" onClick={onReduceProfit} className="secondary-button">
              Reduzir lucro mínimo
            </button>
          ) : null}
          {isBlackMarketMode && onIncreaseBlackMarketAge ? (
            <button type="button" onClick={onIncreaseBlackMarketAge} className="secondary-button">
              Aumentar idade dos dados
            </button>
          ) : null}
          <button type="button" onClick={onRelaxFilters} className="primary-button">
            Relaxar filtros
          </button>
          <button type="button" onClick={onShowMicroFlips} className="secondary-button">
            Mostrar micro-flips
          </button>
          <button type="button" onClick={onAllModes} className="secondary-button">
            Mudar para Todos
          </button>
          {canRunExpandedScan ? (
            <button type="button" onClick={onExpandedScan} className="secondary-button">
              {isBlackMarketMode ? 'Varredura ampliada BM' : 'Varredura ampliada'}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  compact = false,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn('w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary', compact ? 'h-9' : 'h-11')}
      />
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle bg-zinc-950 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-brand-primary"
      />
      <span>
        <span className="block font-black text-white">{label}</span>
        {description ? <span className="mt-1 block text-sm leading-relaxed text-zinc-500">{description}</span> : null}
      </span>
    </label>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'success' | 'danger' | 'brand';
}) {
  return (
    <div className="rounded-lg bg-zinc-950 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 font-black text-white',
          tone === 'success' && 'text-status-success',
          tone === 'danger' && 'text-status-danger',
          tone === 'brand' && 'text-brand-primary',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReasonPanel({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-zinc-950 p-4',
        danger ? 'border-status-danger/30' : 'border-border-subtle',
      )}
    >
      <h3 className="font-black text-white">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-zinc-400">
        {(items.length > 0 ? items : ['Sem observações adicionais.']).map((item) => (
          <li key={item} className="flex gap-2">
            <span className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', danger ? 'bg-status-danger' : 'bg-brand-primary')} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarningPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-8 text-center">
      <AlertTriangle className="mx-auto text-status-warning" size={34} />
      <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function formatAgeHours(value: number | undefined): string {
  if (!Number.isFinite(value)) return 'Sem data';
  if ((value ?? 0) < 1) return 'menos de 1 h';
  return `${Math.round(value ?? 0)} h`;
}

function formatPriceRatio(value: number | undefined): string {
  if (!Number.isFinite(value)) return 'Sem dado';

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value ?? 0)}x`;
}

function formatOutlierState(opportunity: Opportunity): string {
  if (opportunity.sellPriceOutlier && opportunity.buyPriceOutlier) return 'Compra e venda';
  if (opportunity.sellPriceOutlier) return 'Venda';
  if (opportunity.buyPriceOutlier) return 'Compra';
  return 'Não';
}
