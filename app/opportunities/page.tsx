'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  Calculator,
  Clock3,
  Eye,
  Filter,
  Layers3,
  ListFilter,
  MapPin,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { useUserSettings } from '@/context/UserSettingsContext';
import {
  ALBION_CITIES,
  ENCHANTMENTS,
  ITEM_CATEGORIES,
  MARKET_SERVER_REGIONS,
  QUALITIES,
  TIERS,
} from '@/data/constants';
import { fetchOpportunityRadar } from '@/services/albionMarket';
import type {
  AlbionCity,
  Enchantment,
  ItemCategory,
  MarketOpportunitiesResponse,
  Opportunity,
  OpportunityConfidence,
  OpportunityScoreLabel,
  OpportunitySortBy,
  OpportunityType,
  Quality,
  RiskLevel,
  ServerRegion,
  Tier,
} from '@/types/albion';
import {
  DEFAULT_MAX_DATA_AGE_HOURS,
  DEFAULT_MIN_OPPORTUNITY_MARGIN,
  DEFAULT_MIN_OPPORTUNITY_PROFIT,
  OPPORTUNITY_SORT_OPTIONS,
  confidenceLabel,
  opportunityTypeLabel,
  scoreLabelText,
} from '@/lib/opportunityAnalysis';
import {
  cn,
  formatCityName,
  formatDateTime,
  formatEnchantment,
  formatPercent,
  formatQuality,
  formatRelativeTime,
  formatServerName,
  formatSilver,
  formatTierEnchant,
  riskLabel,
  updateStatusLabel,
} from '@/lib/utils';
import { getSourceHost } from '@/lib/marketData';
import { serverParamToRegion } from '@/lib/settingsStorage';

type CityFilter = AlbionCity | 'all';
type TierFilter = Tier | 'all';
type EnchantmentFilter = Enchantment | 'all';
type CategoryFilter = ItemCategory | 'all';
type QualityFilter = Quality | 'all';
type OpportunityTypeFilter = OpportunityType | 'all';
type RiskMaxFilter = RiskLevel | 'all';

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

const scoreVariant = (label: OpportunityScoreLabel | undefined): 'success' | 'warning' | 'danger' | 'primary' => {
  if (label === 'excellent') return 'success';
  if (label === 'good') return 'primary';
  if (label === 'medium') return 'warning';
  return 'danger';
};

export default function OpportunitiesPage() {
  const { settings, isLoaded: settingsLoaded } = useUserSettings();
  const [serverOverride, setServerOverride] = React.useState<ServerRegion | null>(null);
  const [type, setType] = React.useState<OpportunityTypeFilter>('quick-sale');
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [tier, setTier] = React.useState<TierFilter>('all');
  const [enchantment, setEnchantment] = React.useState<EnchantmentFilter>('all');
  const [quality, setQuality] = React.useState<QualityFilter>('Normal');
  const [buyCity, setBuyCity] = React.useState<CityFilter>('all');
  const [sellCity, setSellCity] = React.useState<CityFilter>('all');
  const [minProfit, setMinProfit] = React.useState(DEFAULT_MIN_OPPORTUNITY_PROFIT);
  const [minMargin, setMinMargin] = React.useState(DEFAULT_MIN_OPPORTUNITY_MARGIN);
  const [maxAgeHours, setMaxAgeHours] = React.useState(DEFAULT_MAX_DATA_AGE_HOURS);
  const [maxRisk, setMaxRisk] = React.useState<RiskMaxFilter>('high');
  const [budget, setBudget] = React.useState('');
  const [includeBlackMarket, setIncludeBlackMarket] = React.useState(false);
  const [includeLowConfidence, setIncludeLowConfidence] = React.useState(false);
  const [includeSuspicious, setIncludeSuspicious] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<OpportunitySortBy>('score');
  const [radar, setRadar] = React.useState<MarketOpportunitiesResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [selectedOpportunity, setSelectedOpportunity] = React.useState<Opportunity | null>(null);
  const server = serverOverride ?? serverParamToRegion(settings.defaultServer);
  const marketTaxRate = settings.marketTax;

  const filters = React.useMemo(
    () => ({
      type,
      category,
      tier,
      enchantment,
      quality,
      buyCity,
      sellCity,
      minProfit,
      minMargin,
      maxAgeHours,
      maxRisk,
      budget: budget.trim() ? Number(budget) : undefined,
      includeBlackMarket,
      includeLowConfidence,
      includeSuspicious,
      sortBy,
    }),
    [
      budget,
      buyCity,
      category,
      enchantment,
      includeBlackMarket,
      includeLowConfidence,
      includeSuspicious,
      maxAgeHours,
      maxRisk,
      minMargin,
      minProfit,
      quality,
      sellCity,
      sortBy,
      tier,
      type,
    ],
  );

  React.useEffect(() => {
    if (!settingsLoaded) return;

    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) return;

      setIsLoading(true);
      setErrorMessage('');

      void fetchOpportunityRadar(server, filters, marketTaxRate)
        .then((payload) => {
          if (!isActive) return;

          setRadar(payload);
        })
        .catch(() => {
          if (!isActive) return;

          setRadar(null);
          setErrorMessage('Não foi possível consultar dados reais agora.');
        })
        .finally(() => {
          if (isActive) setIsLoading(false);
        });
    });

    return () => {
      isActive = false;
    };
  }, [filters, marketTaxRate, server, settingsLoaded]);

  const opportunities = radar?.opportunities ?? [];
  const bestOpportunity = opportunities[0] ?? null;
  const highestProfit = [...opportunities].sort((a, b) => b.netProfit - a.netProfit)[0] ?? null;
  const highestMargin = [...opportunities].sort((a, b) => b.margin - a.margin)[0] ?? null;
  const trustedCount = opportunities.filter(
    (opportunity) => opportunity.confidence === 'high' && !opportunity.isSuspicious,
  ).length;
  const isMockData = radar?.source === 'mock' || opportunities.some((opportunity) => opportunity.dataSource === 'mock');
  const sourceHost = radar?.sourceHost ?? opportunities[0]?.sourceHost ?? getSourceHost(server);

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <Badge variant="primary" className="gap-2">
              <Zap size={13} />
              Radar de arbitragem
            </Badge>
            <h1 className="text-3xl font-black text-white md:text-5xl">Radar de Oportunidades</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
              Encontre flips com lucro líquido, margem, risco e confiança dos dados.
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-zinc-950/70 p-4 text-sm text-zinc-400">
            <p>
              Servidor atual:{' '}
              <span className="font-black text-brand-primary">{formatServerName(server)}</span>
            </p>
            <p className="mt-1">
              Taxa considerada:{' '}
              <span className="font-black text-brand-primary">{formatPercent(marketTaxRate)}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border-subtle bg-zinc-950/60 px-4 py-3 text-xs leading-relaxed text-zinc-500">
          <span className="font-bold text-zinc-300">Fonte:</span> Albion Online Data Project.
          <span className="ml-1">Host: <span className="font-mono">{sourceHost}</span>.</span>
          <span className="ml-1">Análise por servidor único, sem misturar economias.</span>
          <span className="ml-1">Filtramos preços fora da curva para evitar ordens trolladas ou dados irreais.</span>
          {isMockData ? (
            <span className="ml-1 font-bold text-status-warning">Dados demonstrativos.</span>
          ) : null}
        </div>
      </header>

      <section className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="text-brand-primary" size={18} />
          <h2 className="font-black text-white">Filtros do radar</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <SelectField label="Servidor">
            <select
              value={server}
              onChange={(event) => setServerOverride(event.target.value as ServerRegion)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {MARKET_SERVER_REGIONS.map((region) => (
                <option key={region} value={region}>{formatServerName(region)}</option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Tipo">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as OpportunityTypeFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="quick-sale">Venda rápida</option>
              <option value="listed-resale">Revenda anunciada</option>
              <option value="all">Ambos</option>
            </select>
          </SelectField>

          <SelectField label="Categoria">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="all">Todas</option>
              {ITEM_CATEGORIES.map((itemCategory) => (
                <option key={itemCategory} value={itemCategory}>{itemCategory}</option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Tier">
            <select
              value={tier}
              onChange={(event) => setTier(event.target.value === 'all' ? 'all' : Number(event.target.value) as Tier)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="all">Todos</option>
              {TIERS.map((value) => <option key={value} value={value}>T{value}</option>)}
            </select>
          </SelectField>

          <SelectField label="Encantamento">
            <select
              value={enchantment}
              onChange={(event) => setEnchantment(event.target.value === 'all' ? 'all' : Number(event.target.value) as Enchantment)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="all">Todos</option>
              {ENCHANTMENTS.map((value) => <option key={value} value={value}>{formatEnchantment(value)}</option>)}
            </select>
          </SelectField>

          <SelectField label="Qualidade">
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as QualityFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {QUALITIES.map((value) => <option key={value} value={value}>{formatQuality(value)}</option>)}
            </select>
          </SelectField>

          <SelectField label="Cidade de compra">
            <select
              value={buyCity}
              onChange={(event) => setBuyCity(event.target.value as CityFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="all">Todas</option>
              {ALBION_CITIES.map((city) => <option key={city} value={city}>{formatCityName(city)}</option>)}
            </select>
          </SelectField>

          <SelectField label="Cidade de venda">
            <select
              value={sellCity}
              onChange={(event) => setSellCity(event.target.value as CityFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="all">Todas</option>
              {ALBION_CITIES.map((city) => <option key={city} value={city}>{formatCityName(city)}</option>)}
            </select>
          </SelectField>

          <NumberField label="Lucro mínimo" value={minProfit} onChange={setMinProfit} />
          <NumberField label="Margem mínima (%)" value={minMargin} onChange={setMinMargin} step={0.5} />
          <NumberField label="Idade máxima (h)" value={maxAgeHours} onChange={setMaxAgeHours} />

          <SelectField label="Risco máximo">
            <select
              value={maxRisk}
              onChange={(event) => setMaxRisk(event.target.value as RiskMaxFilter)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              <option value="low">Baixo risco</option>
              <option value="medium">Risco médio</option>
              <option value="high">Alto risco</option>
              <option value="all">Todos</option>
            </select>
          </SelectField>

          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tenho disponível</span>
            <input
              type="number"
              min={0}
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              placeholder="500000"
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary"
            />
          </label>

          <SelectField label="Ordenar por">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as OpportunitySortBy)}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {OPPORTUNITY_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </SelectField>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ToggleRow
            checked={includeBlackMarket}
            onChange={setIncludeBlackMarket}
            label="Incluir Mercado Negro"
            description="Pode apresentar maior variação e risco. Confira os preços dentro do jogo antes de transportar."
          />
          <ToggleRow
            checked={includeLowConfidence}
            onChange={setIncludeLowConfidence}
            label="Mostrar confiança baixa"
            description="Exibe oportunidades que dependem de dados antigos ou margem mais apertada."
          />
          <ToggleRow
            checked={includeSuspicious}
            onChange={setIncludeSuspicious}
            label="Mostrar oportunidades suspeitas"
            description="Exibe rotas com preço fora da mediana, margem extrema ou revenda especulativa para conferência manual."
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Melhor oportunidade"
          value={bestOpportunity ? `Score ${bestOpportunity.score ?? 0}` : 'Sem rota'}
          icon={Zap}
          description={bestOpportunity ? `${bestOpportunity.itemName} · ${formatSilver(bestOpportunity.netProfit)}` : 'Ajuste os filtros'}
        />
        <StatCard
          title="Maior lucro líquido"
          value={highestProfit ? formatSilver(highestProfit.netProfit) : '0 prata'}
          icon={BadgeDollarSign}
          description={highestProfit?.itemName ?? 'Sem dados'}
        />
        <StatCard
          title="Maior margem"
          value={highestMargin ? formatPercent(highestMargin.margin) : '0,0%'}
          icon={TrendingUp}
          description={highestMargin?.itemName ?? 'Sem dados'}
        />
        <StatCard
          title="Oportunidades confiáveis"
          value={trustedCount}
          icon={ShieldCheck}
          description="Confiança alta"
        />
        <StatCard
          title="Dados analisados"
          value={radar?.analyzedItems ?? 0}
          icon={BarChart3}
          description={`${opportunities.length} rotas exibidas`}
        />
      </section>

      {errorMessage ? (
        <WarningPanel title="Consulta indisponível" message={errorMessage} />
      ) : null}

      {isLoading ? (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-border-subtle bg-bg-card">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
            <p className="mt-4 text-sm font-bold text-zinc-400">
              Analisando oportunidades do mercado em {formatServerName(server)}...
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && opportunities.length === 0 ? (
        <WarningPanel
          title="Nenhuma oportunidade confiável encontrada"
          message="Nenhuma oportunidade confiável encontrada com os filtros atuais."
        />
      ) : null}

      {!isLoading && opportunities.length > 0 ? (
        <section className="space-y-4">
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              hasBudget={Boolean(filters.budget)}
              onDetails={setSelectedOpportunity}
            />
          ))}
        </section>
      ) : null}

      <section className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5">
        <h2 className="flex items-center gap-2 text-lg font-black text-brand-primary">
          <Layers3 size={20} />
          Como o radar escolhe as melhores rotas
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
          O ranking combina lucro líquido, margem, frescor dos dados, confiança, risco e investimento necessário.
          Venda rápida usa ordens de compra para saída imediata; revenda anunciada usa a menor ordem de venda do destino com desconto estimado,
          mas passa por mediana, razão de preço e penalidade de risco antes de entrar no ranking.
        </p>
      </section>

      {selectedOpportunity ? (
        <OpportunityDetailsModal
          opportunity={selectedOpportunity}
          taxRate={marketTaxRate}
          onClose={() => setSelectedOpportunity(null)}
        />
      ) : null}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  hasBudget,
  onDetails,
}: {
  opportunity: Opportunity;
  hasBudget: boolean;
  onDetails: (opportunity: Opportunity) => void;
}) {
  return (
    <article className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl transition-colors hover:border-brand-primary/35 lg:p-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr_1.2fr_0.78fr] xl:items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-zinc-950 font-black text-brand-primary">
              {opportunity.itemName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-white">{opportunity.itemName}</h3>
              <p className="truncate text-xs text-zinc-500">{opportunity.itemNameEn ?? opportunity.itemId}</p>
              <p className="font-mono text-[11px] text-zinc-600">{opportunity.itemId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{formatTierEnchant(opportunity.tier, opportunity.enchantment)}</Badge>
            <Badge variant="primary">{opportunityTypeLabel(opportunity.type)}</Badge>
            {opportunity.isSuspicious ? <Badge variant="danger">Suspeita</Badge> : null}
            {opportunity.category ? <Badge variant="muted">{opportunity.category}</Badge> : null}
          </div>
          {opportunity.isSuspicious ? (
            <div className="rounded-lg border border-status-danger/25 bg-status-danger/10 p-3 text-xs leading-relaxed text-status-danger">
              Confira manualmente no jogo. Esta oportunidade pode ser preço trollado ou dado inconsistente.
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
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

        <div className="grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Lucro un." value={formatSilver(opportunity.netProfit)} tone="success" />
          <MiniMetric label="Margem" value={formatPercent(opportunity.margin)} tone="brand" />
          <MiniMetric label="Score" value={`${opportunity.score ?? 0}/100`} tone="brand" />
          <MiniMetric label="Taxa" value={formatSilver(opportunity.estimatedTax)} tone="danger" />
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
            Atualizado {formatRelativeTime(opportunity.updatedAt)}
          </p>
          <button
            type="button"
            onClick={() => onDetails(opportunity)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-subtle bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:border-brand-primary/40 xl:w-auto"
          >
            Ver detalhes <Eye size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function OpportunityDetailsModal({
  opportunity,
  taxRate,
  onClose,
}: {
  opportunity: Opportunity;
  taxRate: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-bg-card shadow-2xl md:max-w-5xl md:rounded-lg">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-bg-card/95 p-5 backdrop-blur">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{opportunityTypeLabel(opportunity.type)}</Badge>
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
            <MiniMetric label="Compra" value={`${formatCityName(opportunity.buyCity)} · ${formatSilver(opportunity.buyPrice)}`} />
            <MiniMetric label="Venda" value={`${formatCityName(opportunity.sellCity)} · ${formatSilver(opportunity.sellPrice)}`} />
            <MiniMetric label="Lucro líquido" value={formatSilver(opportunity.netProfit)} tone="success" />
            <MiniMetric label="Score" value={`${opportunity.score ?? 0}/100`} tone="brand" />
            <MiniMetric label="Mediana do item" value={opportunity.referenceMedianPrice ? formatSilver(opportunity.referenceMedianPrice) : 'Sem referência'} />
            <MiniMetric label="Razão venda/compra" value={formatPriceRatio(opportunity.priceRatio)} tone={opportunity.priceRatio && opportunity.priceRatio > 4 ? 'danger' : undefined} />
            <MiniMetric label="Margem" value={formatPercent(opportunity.margin)} tone={opportunity.margin > 300 ? 'danger' : 'brand'} />
            <MiniMetric label="Idade dos dados" value={formatAgeHours(opportunity.maxDataAgeHours)} />
            <MiniMetric label="Outlier detectado" value={formatOutlierState(opportunity)} tone={opportunity.sellPriceOutlier || opportunity.buyPriceOutlier ? 'danger' : undefined} />
          </div>

          {opportunity.isSuspicious ? (
            <div className="rounded-lg border border-status-danger/25 bg-status-danger/10 p-4 text-sm leading-relaxed text-status-danger">
              Confira manualmente no jogo. Esta oportunidade pode ser preço trollado ou dado inconsistente.
            </div>
          ) : null}

          <section className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
            <h3 className="flex items-center gap-2 font-black text-white">
              <Calculator className="text-brand-primary" size={18} />
              Como o cálculo foi feito
            </h3>
            <div className="mt-3 grid gap-2 text-sm text-zinc-400">
              <p>Preço de compra usado: {formatSilver(opportunity.buyPrice)} em {formatCityName(opportunity.buyCity)}.</p>
              <p>Preço de venda usado: {formatSilver(opportunity.sellPrice)} em {formatCityName(opportunity.sellCity)}.</p>
              <p>Mediana de venda do item nas cidades: {opportunity.referenceMedianPrice ? formatSilver(opportunity.referenceMedianPrice) : 'sem referência suficiente'}.</p>
              <p>Razão venda/compra: {formatPriceRatio(opportunity.priceRatio)}.</p>
              <p>Outlier: {formatOutlierState(opportunity)}.</p>
              <p>Lucro bruto = {formatSilver(opportunity.sellPrice)} - {formatSilver(opportunity.buyPrice)} = {formatSilver(opportunity.grossProfit)}</p>
              <p>Taxa = {formatSilver(opportunity.sellPrice)} x {formatPercent(taxRate)} = {formatSilver(opportunity.estimatedTax)}</p>
              <p>Lucro líquido = {formatSilver(opportunity.grossProfit)} - {formatSilver(opportunity.estimatedTax)} = {formatSilver(opportunity.netProfit)}</p>
              <p>Margem/ROI por unidade: {formatPercent(opportunity.roi ?? opportunity.margin)}</p>
              <p>Idade máxima dos dados usados: {formatAgeHours(opportunity.maxDataAgeHours)}</p>
              <p>Atualização compra: {opportunity.buyUpdatedAt ? formatDateTime(opportunity.buyUpdatedAt) : 'Sem data'}</p>
              <p>Atualização venda: {opportunity.sellUpdatedAt ? formatDateTime(opportunity.sellUpdatedAt) : 'Sem data'}</p>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                      <td className="px-4 py-3 text-sm text-zinc-400">{price.updatedAt ? formatRelativeTime(price.updatedAt) : 'Sem data'}</td>
                      <td className="px-4 py-3"><Badge variant={price.updateStatus === 'updated' ? 'success' : price.updateStatus === 'medium' ? 'warning' : 'danger'}>{updateStatusLabel(price.updateStatus)}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm leading-relaxed text-status-warning">
            Confira o preço dentro do jogo antes de transportar. Os dados dependem da última coleta pública disponível.
          </div>
        </div>
      </div>
    </div>
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
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
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
        className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
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
  description: string;
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
        <span className="mt-1 block text-sm leading-relaxed text-zinc-500">{description}</span>
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
