'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Calculator,
  Clock3,
  MapPin,
  Search,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingUp,
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
import type {
  AlbionCity,
  CityPrice,
  Enchantment,
  Item,
  ItemCatalogEntry,
  ItemCategory,
  Quality,
  RiskLevel,
  ServerRegion,
  Tier,
  UpdateStatus,
} from '@/types/albion';
import { fetchItemPrices, searchCatalogItems } from '@/services/albionMarket';
import {
  getDisplayItemName as getCatalogDisplayItemName,
  getItemBaseDisplayName,
} from '@/data/itemCatalog';
import {
  calculateProfitBreakdown,
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
  getDisplayItemFullName,
  getUpdateStatus,
  riskLabel,
  updateStatusLabel,
} from '@/lib/utils';
import { normalizeServerParam } from '@/lib/marketData';
import { serverParamToRegion } from '@/lib/settingsStorage';

type TierFilter = Tier | 'all';
type EnchantmentFilter = Enchantment | 'all';
type QualityFilter = Quality | 'all';
type CategoryFilter = ItemCategory | 'all';
type CityFilter = AlbionCity | 'all';

function parseServer(value: string | null): ServerRegion | null {
  const normalized = normalizeServerParam(value);

  return normalized && MARKET_SERVER_REGIONS.includes(normalized) ? normalized : null;
}

function parseTier(value: string | null): TierFilter {
  const numeric = Number(value);
  return TIERS.includes(numeric as Tier) ? (numeric as Tier) : 'all';
}

function parseEnchantment(value: string | null): EnchantmentFilter {
  const numeric = Number(value);
  return ENCHANTMENTS.includes(numeric as Enchantment) ? (numeric as Enchantment) : 'all';
}

function statusVariant(status: UpdateStatus): 'success' | 'warning' | 'danger' {
  if (status === 'updated') return 'success';
  if (status === 'medium') return 'warning';
  return 'danger';
}

function SearchContent() {
  const searchParams = useSearchParams();
  const { settings, isLoaded: settingsLoaded } = useUserSettings();
  const initialItem = searchParams.get('item') ?? '';
  const initialServer = parseServer(searchParams.get('server'));

  const [query, setQuery] = React.useState(initialItem);
  const [serverOverride, setServerOverride] = React.useState<ServerRegion | null>(initialServer);
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [tier, setTier] = React.useState<TierFilter>(parseTier(searchParams.get('tier')));
  const [enchantment, setEnchantment] = React.useState<EnchantmentFilter>(parseEnchantment(searchParams.get('enchantment')));
  const [quality, setQuality] = React.useState<QualityFilter>('all');
  const [city, setCity] = React.useState<CityFilter>('all');
  const [selectedCatalogItem, setSelectedCatalogItem] = React.useState<ItemCatalogEntry | null>(null);
  const [result, setResult] = React.useState<Item | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [notFound, setNotFound] = React.useState(false);
  const didRunInitialSearch = React.useRef(false);
  const server = serverOverride ?? initialServer ?? serverParamToRegion(settings.defaultServer);
  const marketTaxRate = settings.marketTax;

  const suggestions = React.useMemo(
    () =>
      searchCatalogItems(
        query,
        {
          category,
          tier,
          enchantment,
        },
        8,
      ),
    [category, enchantment, query, tier],
  );

  const selectedItem = selectedCatalogItem ?? suggestions[0] ?? null;

  const runSearch = React.useCallback(
    async (candidate: ItemCatalogEntry | null = selectedItem, serverOverride: ServerRegion = server) => {
      const itemToSearch = candidate ?? searchCatalogItems(query, { category, tier, enchantment }, 1)[0] ?? null;

      if (!itemToSearch) {
        setNotFound(true);
        setResult(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      setNotFound(false);
      setSelectedCatalogItem(itemToSearch);
      setQuery(getItemBaseDisplayName(itemToSearch));

      try {
        const item = await fetchItemPrices(itemToSearch.uniqueName, serverOverride, {
          category,
          tier,
          enchantment,
          quality,
        });

        setResult(item);
        setNotFound(!item);
      } catch {
        setErrorMessage('Não foi possível consultar os dados de mercado agora.');
        setResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [category, enchantment, quality, query, selectedItem, server, tier],
  );

  React.useEffect(() => {
    if (!initialItem || didRunInitialSearch.current || (!settingsLoaded && !initialServer)) return;

    didRunInitialSearch.current = true;
    const firstSuggestion = searchCatalogItems(initialItem, {}, 1)[0] ?? null;
    void runSearch(firstSuggestion);
  }, [initialItem, initialServer, runSearch, settingsLoaded]);

  const handleSuggestionSelect = (item: ItemCatalogEntry) => {
    setSelectedCatalogItem(item);
    setQuery(getItemBaseDisplayName(item));
    setTier(item.tier);
    setEnchantment(item.enchantment);
    setCategory(item.category);
    setResult(null);
    setNotFound(false);
  };

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Badge variant="primary" className="gap-2">
              <Search size={13} />
              Busca avançada de mercado
            </Badge>
            <h1 className="text-3xl font-black text-white">Buscar item</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-400">
              Pesquise por nome em português, nome em inglês, Item ID, alias da comunidade ou categoria. Escolha o
              servidor e consulte preços reais por cidade.
            </p>
          </div>

          <div className="text-sm text-zinc-500">
            Taxa considerada:{' '}
            <span className="font-black text-brand-primary">{formatPercent(marketTaxRate)}</span>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
            className="space-y-3"
          >
            <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-zinc-950/80 p-2 shadow-[0_18px_55px_rgba(0,0,0,0.32)] focus-within:border-brand-primary/70 sm:flex-row">
              <label className="relative flex min-w-0 flex-1 items-center">
                <span className="absolute left-3 text-zinc-500">
                  <Search size={20} />
                </span>
                <span className="sr-only">Buscar item por nome, ID ou categoria</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedCatalogItem(null);
                    setNotFound(false);
                  }}
                  placeholder="Buscar item por nome, ID ou categoria"
                  className="min-h-12 w-full rounded-md bg-transparent pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </label>
              <button
                type="submit"
                disabled={isLoading || !selectedItem}
                className="min-h-12 rounded-md bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Consultando...' : 'Consultar preços reais'}
              </button>
            </div>

            {query.trim().length > 0 && suggestions.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {suggestions.map((item) => (
                  <button
                    key={item.uniqueName}
                    type="button"
                    onClick={() => handleSuggestionSelect(item)}
                    className={cn(
                      'rounded-lg border border-border-subtle bg-zinc-950 p-3 text-left transition-colors hover:border-brand-primary/45',
                      selectedCatalogItem?.uniqueName === item.uniqueName && 'border-brand-primary/60 bg-brand-primary/10',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{getCatalogDisplayItemName(item)}</p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {getCatalogDisplayItemName(item, item.tier, item.enchantment, 'en-US')}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">{item.uniqueName}</p>
                      </div>
                      <Badge variant="outline">{formatTierEnchant(item.tier, item.enchantment)}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="muted">{item.category}</Badge>
                      {item.subcategory ? <Badge variant="muted">{item.subcategory}</Badge> : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SelectField label="Servidor">
              <select
                value={server}
                onChange={(event) => {
                  const nextServer = event.target.value as ServerRegion;
                  setServerOverride(nextServer);

                  if (selectedItem) {
                    void runSearch(selectedItem, nextServer);
                  }
                }}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                {MARKET_SERVER_REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {formatServerName(region)}
                  </option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Categoria">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value as CategoryFilter);
                  setResult(null);
                }}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                <option value="all">Todas</option>
                {ITEM_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Tier">
              <select
                value={tier}
                onChange={(event) => {
                  setTier(event.target.value === 'all' ? 'all' : (Number(event.target.value) as Tier));
                  setResult(null);
                }}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                <option value="all">Todos</option>
                {TIERS.map((value) => (
                  <option key={value} value={value}>
                    T{value}
                  </option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Encantamento">
              <select
                value={enchantment}
                onChange={(event) => {
                  setEnchantment(
                    event.target.value === 'all' ? 'all' : (Number(event.target.value) as Enchantment),
                  );
                  setResult(null);
                }}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                <option value="all">Todos</option>
                {ENCHANTMENTS.map((value) => (
                  <option key={value} value={value}>
                    {formatEnchantment(value)}
                  </option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Qualidade">
              <select
                value={quality}
                onChange={(event) => {
                  setQuality(event.target.value as QualityFilter);
                  setResult(null);
                }}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                <option value="all">Padrão do item</option>
                {QUALITIES.map((value) => (
                  <option key={value} value={value}>
                    {formatQuality(value)}
                  </option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Cidade">
              <select
                value={city}
                onChange={(event) => setCity(event.target.value as CityFilter)}
                className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
              >
                <option value="all">Todas</option>
                {ALBION_CITIES.map((value) => (
                  <option key={value} value={value}>
                    {formatCityName(value)}
                  </option>
                ))}
              </select>
            </SelectField>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-zinc-950/60 px-4 py-3 text-xs leading-relaxed text-zinc-500 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-bold text-zinc-300">Fonte:</span> Albion Online Data Project.
              <span className="ml-1">Atualizado conforme dados públicos disponíveis.</span>
            </div>
            <div className="rounded-md border border-brand-primary/40 bg-brand-primary/10 px-3 py-2 font-bold text-brand-primary">
              Servidor atual: {formatServerName(server)}
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <LoadingPanel label={`Carregando preços reais em ${formatServerName(server)}...`} />
      ) : null}

      {!isLoading && errorMessage ? <WarningPanel title="Consulta indisponível" message={errorMessage} /> : null}

      {!isLoading && notFound ? (
        <WarningPanel
          title="Item não encontrado"
          message="Nenhum item encontrado. Tente buscar pelo nome em português, inglês, alias da comunidade ou ID do item."
        />
      ) : null}

      {!isLoading && !result && !notFound ? (
        <EmptyState
          onPick={(value) => {
            setQuery(value);
            const first = searchCatalogItems(value, {}, 1)[0] ?? null;
            setSelectedCatalogItem(first);
          }}
        />
      ) : null}

      {!isLoading && result ? (
        <MarketResultSection
          item={result}
          server={server}
          cityFilter={city}
          marketTaxRate={marketTaxRate}
        />
      ) : null}
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

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-80 items-center justify-center rounded-lg border border-border-subtle bg-bg-card">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        <p className="mt-4 text-sm font-bold text-zinc-400">{label}</p>
      </div>
    </div>
  );
}

function WarningPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-6 text-center">
      <AlertTriangle className="mx-auto text-status-warning" size={34} />
      <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">{message}</p>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (value: string) => void }) {
  const suggestions = ['Dessangra', 'Bloodletter', 'Mortificus', 'T4_BAG', 'Mochila', 'Poção', 'Healing Potion'];

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center shadow-2xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-950 text-zinc-600">
        <Search size={32} />
      </div>
      <h2 className="mt-4 text-xl font-black text-white">Escolha um item para consultar</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        A busca usa um catálogo local gerado a partir dos dumps públicos de Albion e consulta preços reais no servidor selecionado.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="rounded-lg border border-border-subtle bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 transition-colors hover:border-brand-primary/40 hover:text-white"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarketResultSection({
  item,
  server,
  cityFilter,
  marketTaxRate,
}: {
  item: Item;
  server: ServerRegion;
  cityFilter: CityFilter;
  marketTaxRate: number;
}) {
  const pricesForCalculation = item.prices;
  const visiblePrices = cityFilter === 'all' ? item.prices : item.prices.filter((price) => price.city === cityFilter);
  const bestBuy = pricesForCalculation
    .filter((price) => price.sellPriceMin > 0)
    .sort((a, b) => a.sellPriceMin - b.sellPriceMin)[0];
  const bestSell = pricesForCalculation
    .filter((price) => price.buyPriceMax > 0)
    .sort((a, b) => b.buyPriceMax - a.buyPriceMax)[0];
  const profit =
    bestBuy && bestSell
      ? calculateProfitBreakdown(bestBuy.sellPriceMin, bestSell.buyPriceMax, marketTaxRate)
      : null;
  const generalUpdate = item.prices
    .filter((price) => price.updatedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const risk: RiskLevel =
    !profit || profit.netProfit <= 0
      ? 'high'
      : profit.margin >= 20 && bestBuy && getUpdateStatus(bestBuy.updatedAt) === 'updated'
        ? 'low'
        : 'medium';

  if (!item.hasMarketData) {
    return (
      <WarningPanel
        title={`Sem dados recentes em ${formatServerName(server)}`}
        message="A API pública depende da coleta feita por jogadores. Esta combinação pode estar sem dados recentes."
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-brand-primary/20 bg-brand-primary/10 text-brand-primary">
              <Tag size={34} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="primary">Servidor: {formatServerName(server)}</Badge>
                <Badge variant="outline">{formatTierEnchant(item.tier, item.enchantment)}</Badge>
                <Badge variant="outline">{formatQuality(item.quality)}</Badge>
                {item.dataSource === 'mock' ? <Badge variant="warning">Fallback demonstrativo</Badge> : null}
              </div>
              <h2 className="mt-3 text-3xl font-black text-white">{getDisplayItemFullName(item)}</h2>
              <div className="mt-2 grid gap-1 text-sm text-zinc-500">
                <p>
                  <span className="font-bold text-zinc-300">Nome EN:</span> {item.nameEn}
                </p>
                <p className="break-all font-mono text-xs">{item.uniqueName}</p>
                <p>
                  <span className="font-bold text-zinc-300">Categoria:</span> {item.category}
                  {item.subcategory ? ` / ${item.subcategory}` : ''}
                </p>
              </div>
              <div className="mt-4 grid gap-1 text-xs text-zinc-500">
                <p>
                  <span className="font-bold text-zinc-300">Fonte:</span> Albion Online Data Project
                </p>
                <p>
                  <span className="font-bold text-zinc-300">Host:</span>{' '}
                  <span className="font-mono">{item.sourceHost}</span>
                </p>
                <p>
                  <span className="font-bold text-zinc-300">Taxa considerada:</span>{' '}
                  {formatPercent(marketTaxRate)}
                </p>
                <p>
                  <span className="font-bold text-zinc-300">Última atualização geral:</span>{' '}
                  {generalUpdate ? formatDateTime(generalUpdate.updatedAt) : 'indisponível'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {bestBuy && bestSell && profit ? (
          <div className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl md:p-6">
            <h3 className="flex items-center gap-2 text-lg font-black text-white">
              <TrendingUp className="text-brand-primary" size={20} />
              {profit.netProfit > 0 ? 'Melhor rota comercial' : 'Sem oportunidade lucrativa'}
            </h3>
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-zinc-950 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Comprar em</p>
                <p className="mt-1 font-black text-white">{formatCityName(bestBuy.city)}</p>
                <p className="text-sm text-status-success">{formatSilver(bestBuy.sellPriceMin)}</p>
              </div>
              <ArrowRight className="text-brand-primary" size={20} />
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Vender em</p>
                <p className="mt-1 font-black text-white">{formatCityName(bestSell.city)}</p>
                <p className="text-sm text-status-info">{formatSilver(bestSell.buyPriceMax)}</p>
              </div>
            </div>
          </div>
        ) : (
          <WarningPanel
            title="Dados insuficientes para calcular arbitragem"
            message="Encontramos parte dos preços, mas falta ordem de venda ou ordem de compra suficiente para calcular uma rota."
          />
        )}
      </div>

      {bestBuy && bestSell && profit ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Melhor cidade para comprar"
            value={formatCityName(bestBuy.city)}
            icon={ShoppingCart}
            description={`Menor preço de venda: ${formatSilver(bestBuy.sellPriceMin)}`}
          />
          <StatCard
            title="Melhor cidade para vender"
            value={formatCityName(bestSell.city)}
            icon={MapPin}
            description={`Maior preço de compra: ${formatSilver(bestSell.buyPriceMax)}`}
          />
          <StatCard
            title="Lucro bruto"
            value={formatSilver(profit.grossProfit)}
            icon={BadgeDollarSign}
            description="Diferença antes da taxa"
          />
          <StatCard
            title="Lucro líquido"
            value={formatSilver(profit.netProfit)}
            icon={Calculator}
            trend={{ value: formatPercent(profit.margin), isPositive: profit.netProfit > 0 }}
            description={`${formatSilver(profit.estimatedTax)} de taxa estimada (${formatPercent(marketTaxRate)})`}
          />
          <StatCard
            title="Risco da oportunidade"
            value={riskLabel(risk)}
            icon={ShieldCheck}
            description="Baseado em margem e idade dos dados"
          />
        </div>
      ) : null}

      <PriceTable
        prices={visiblePrices}
        bestBuy={bestBuy}
        bestSell={bestSell}
      />
    </section>
  );
}

function PriceTable({
  prices,
  bestBuy,
  bestSell,
}: {
  prices: CityPrice[];
  bestBuy?: CityPrice;
  bestSell?: CityPrice;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
      <div className="border-b border-border-subtle p-5">
        <h3 className="text-xl font-black text-white">Preço por cidade</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Destaques: menor preço de venda para compra e maior preço de compra para saída rápida.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border-subtle bg-zinc-950/70">
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cidade</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Menor preço de venda</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Maior preço de compra</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Preço médio</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Volume estimado</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Atualização</th>
              <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/70">
            {prices
              .slice()
              .sort((a, b) => ALBION_CITIES.indexOf(a.city) - ALBION_CITIES.indexOf(b.city))
              .map((price) => {
                const isBestBuy = bestBuy?.city === price.city;
                const isBestSell = bestSell?.city === price.city;

                return (
                  <tr
                    key={price.city}
                    className={cn(
                      'transition-colors hover:bg-zinc-900/60',
                      isBestBuy && 'bg-status-success/5',
                      isBestSell && 'bg-status-info/5',
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{formatCityName(price.city)}</span>
                        {isBestBuy ? <Badge variant="success">Comprar</Badge> : null}
                        {isBestSell ? <Badge variant="info">Vender</Badge> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-black text-status-success">
                      {price.sellPriceMin > 0 ? formatSilver(price.sellPriceMin) : 'Sem dado'}
                    </td>
                    <td className="px-5 py-4 font-black text-status-info">
                      {price.buyPriceMax > 0 ? formatSilver(price.buyPriceMax) : 'Sem dado'}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">
                      {price.averagePrice > 0 ? formatSilver(price.averagePrice) : 'Sem dado'}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">
                      {price.estimatedVolume > 0 ? price.estimatedVolume : 'Sem dado'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Clock3 size={14} className="text-zinc-600" />
                        {price.updatedAt ? `Atualizado ${formatRelativeTime(price.updatedAt)}` : 'Sem atualização'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant(price.updateStatus)}>{updateStatusLabel(price.updateStatus)}</Badge>
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

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-80 items-center justify-center rounded-lg border border-border-subtle bg-bg-card">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
