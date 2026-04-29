'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Calculator,
  CheckCircle2,
  Clock3,
  Crown,
  MapPin,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { useUserSettings } from '@/context/UserSettingsContext';
import { ALBION_CITIES, ENCHANTMENTS, MARKET_SERVER_REGIONS, QUALITIES, TIERS } from '@/data/constants';
import { REGEAR_PRESETS, REGEAR_SLOT_DEFINITIONS } from '@/data/regearPresets';
import { fetchItemPrices, searchCatalogItems } from '@/services/albionMarket';
import type { AlbionCity, CityPrice, Enchantment, Item, ItemCatalogEntry, Quality, ServerRegion, Tier } from '@/types/albion';
import type {
  RegearCityComparison,
  RegearConfidence,
  RegearPreset,
  RegearPurchaseMode,
  RegearSlotDefinition,
  RegearSlotForm,
  RegearSlotId,
} from '@/types/regear';
import {
  aggregateConfidence,
  confidenceFromStatus,
  confidenceLabel,
  confidenceVariant,
  findCitySellPrice,
  findLowestSellPrice,
  REGEAR_MARKET_CITIES,
  worstStatus,
} from '@/lib/regear';
import {
  cn,
  formatCityName,
  formatEnchantment,
  formatQuality,
  formatRelativeTime,
  formatServerName,
  formatSilver,
  formatTierEnchant,
} from '@/lib/utils';
import { serverParamToRegion } from '@/lib/settingsStorage';

type RegearLineResult = {
  slotId: RegearSlotId;
  slotLabel: string;
  query: string;
  item: Item | null;
  quantity: number;
  quality: Quality;
  uniqueName: string;
  displayName: string;
  bestPrice: CityPrice | null;
  unitPrice: number;
  totalPrice: number;
  confidence: RegearConfidence;
  missingReason?: string;
};

type RegearCalculationResult = {
  server: ServerRegion;
  purchaseMode: RegearPurchaseMode;
  preferredCity: AlbionCity | 'all';
  lines: RegearLineResult[];
  cityComparisons: RegearCityComparison[];
  optimizedTotal: number;
  selectedModeTotal: number;
  bestSingleCity: RegearCityComparison | null;
  preferredCityComparison: RegearCityComparison | null;
  savings: number | null;
  missingCount: number;
  confidence: RegearConfidence;
  calculatedAt: string;
};

const MODE_OPTIONS: Array<{ value: RegearPurchaseMode; label: string; description: string }> = [
  {
    value: 'optimized',
    label: 'Compra otimizada por cidade',
    description: 'Cada peça é comprada na cidade com menor ordem de venda.',
  },
  {
    value: 'lowest',
    label: 'Menor preço absoluto',
    description: 'Foco no menor preço de cada peça, ignorando conveniência de rota.',
  },
  {
    value: 'single-city',
    label: 'Comprar tudo em uma cidade',
    description: 'Compara quanto custaria fechar o set em uma praça só.',
  },
];

function createInitialSlots(): RegearSlotForm[] {
  return REGEAR_SLOT_DEFINITIONS.map((slot) => ({
    slotId: slot.id,
    query: '',
    tier: 6,
    enchantment: 0,
    quality: 'Normal',
    quantity: slot.optional ? 0 : 1,
  }));
}

function createSlotsFromPreset(preset: RegearPreset): RegearSlotForm[] {
  return createInitialSlots().map((slot) => {
    const presetSlot = preset.slots.find((item) => item.slotId === slot.slotId);

    if (!presetSlot) return slot;

    return {
      ...slot,
      ...presetSlot,
      selectedUniqueName: undefined,
    };
  });
}

function getSlotDefinition(slotId: RegearSlotId): RegearSlotDefinition {
  return REGEAR_SLOT_DEFINITIONS.find((slot) => slot.id === slotId) ?? REGEAR_SLOT_DEFINITIONS[0]!;
}

function getCandidateForSlot(slot: RegearSlotForm, definition: RegearSlotDefinition): ItemCatalogEntry | null {
  if (slot.selectedUniqueName) {
    return searchCatalogItems(slot.selectedUniqueName, {}, 1)[0] ?? null;
  }

  return (
    searchCatalogItems(
      slot.query,
      {
        category: definition.categoryHint,
        tier: slot.tier,
        enchantment: slot.enchantment,
      },
      1,
    )[0] ?? null
  );
}

function getDisplayItemLine(item: Item): string {
  return `${item.namePtBR} ${formatTierEnchant(item.tier, item.enchantment)}`;
}

function calculateCityComparisons(lines: RegearLineResult[]): RegearCityComparison[] {
  return REGEAR_MARKET_CITIES.map((city) => {
    let totalCost = 0;
    let foundItems = 0;
    const statuses: Array<RegearCityComparison['worstStatus']> = [];

    for (const line of lines) {
      if (!line.item) {
        statuses.push('missing');
        continue;
      }

      const price = findCitySellPrice(line.item.prices, city);

      if (!price) {
        statuses.push('missing');
        continue;
      }

      foundItems += 1;
      totalCost += price.sellPriceMin * line.quantity;
      statuses.push(price.updateStatus);
    }

    const status = worstStatus(statuses);

    return {
      city,
      totalCost,
      foundItems,
      missingItems: Math.max(0, lines.length - foundItems),
      confidence: aggregateConfidence(statuses),
      worstStatus: status,
    };
  });
}

function pickBestSingleCity(comparisons: RegearCityComparison[]) {
  return [...comparisons].sort((a, b) => {
    if (a.missingItems !== b.missingItems) return a.missingItems - b.missingItems;
    if (a.foundItems !== b.foundItems) return b.foundItems - a.foundItems;
    return a.totalCost - b.totalCost;
  })[0] ?? null;
}

function selectedModeTotal(
  mode: RegearPurchaseMode,
  optimizedTotal: number,
  bestSingleCity: RegearCityComparison | null,
  preferredCityComparison: RegearCityComparison | null,
) {
  if (mode === 'single-city') {
    return (preferredCityComparison ?? bestSingleCity)?.totalCost ?? optimizedTotal;
  }

  return optimizedTotal;
}

function purchaseModeLabel(mode: RegearPurchaseMode): string {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? 'Compra otimizada por cidade';
}

export default function RegearPage() {
  const { settings } = useUserSettings();
  const [serverOverride, setServerOverride] = React.useState<ServerRegion | null>(null);
  const [preferredCity, setPreferredCity] = React.useState<AlbionCity | 'all'>('all');
  const [purchaseMode, setPurchaseMode] = React.useState<RegearPurchaseMode>('optimized');
  const [slots, setSlots] = React.useState<RegearSlotForm[]>(() => createSlotsFromPreset(REGEAR_PRESETS[0]!));
  const [result, setResult] = React.useState<RegearCalculationResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [activePresetId, setActivePresetId] = React.useState<string>(REGEAR_PRESETS[0]!.id);
  const server = serverOverride ?? serverParamToRegion(settings.defaultServer);

  const filledSlots = slots.filter((slot) => slot.query.trim().length > 0 && slot.quantity > 0);

  const updateSlot = React.useCallback((slotId: RegearSlotId, patch: Partial<RegearSlotForm>) => {
    setSlots((current) =>
      current.map((slot) =>
        slot.slotId === slotId
          ? {
              ...slot,
              ...patch,
            }
          : slot,
      ),
    );
    setResult(null);
  }, []);

  const applyPreset = React.useCallback((preset: RegearPreset) => {
    setActivePresetId(preset.id);
    setSlots(createSlotsFromPreset(preset));
    setResult(null);
    setErrorMessage('');
  }, []);

  const calculateRegear = async () => {
    if (filledSlots.length === 0) {
      setErrorMessage('Escolha pelo menos uma peça para calcular o custo do set.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const lines = await Promise.all(
        filledSlots.map(async (slot): Promise<RegearLineResult> => {
          const definition = getSlotDefinition(slot.slotId);
          const candidate = getCandidateForSlot(slot, definition);

          if (!candidate) {
            return {
              slotId: slot.slotId,
              slotLabel: definition.label,
              query: slot.query,
              item: null,
              quantity: slot.quantity,
              quality: slot.quality,
              uniqueName: '',
              displayName: slot.query,
              bestPrice: null,
              unitPrice: 0,
              totalPrice: 0,
              confidence: 'low',
              missingReason: 'Item não encontrado no catálogo.',
            };
          }

          const item = await fetchItemPrices(candidate.uniqueName, server, {
            category: definition.categoryHint,
            tier: slot.tier,
            enchantment: slot.enchantment,
            quality: slot.quality,
          });
          const bestPrice = item ? findLowestSellPrice(item.prices) : null;
          const confidence = bestPrice ? confidenceFromStatus(bestPrice.updateStatus) : 'low';

          return {
            slotId: slot.slotId,
            slotLabel: definition.label,
            query: slot.query,
            item,
            quantity: slot.quantity,
            quality: slot.quality,
            uniqueName: item?.uniqueName ?? candidate.uniqueName,
            displayName: item ? getDisplayItemLine(item) : candidate.namePtBR,
            bestPrice,
            unitPrice: bestPrice?.sellPriceMin ?? 0,
            totalPrice: (bestPrice?.sellPriceMin ?? 0) * slot.quantity,
            confidence,
            missingReason: bestPrice ? undefined : 'Sem ordem de venda recente nas cidades de regear.',
          };
        }),
      );
      const cityComparisons = calculateCityComparisons(lines);
      const optimizedTotal = lines.reduce((total, line) => total + line.totalPrice, 0);
      const bestSingleCity = pickBestSingleCity(cityComparisons);
      const preferredCityComparison =
        preferredCity === 'all'
          ? null
          : cityComparisons.find((comparison) => comparison.city === preferredCity) ?? null;
      const completeCity = cityComparisons
        .filter((comparison) => comparison.missingItems === 0)
        .sort((a, b) => a.totalCost - b.totalCost)[0] ?? null;
      const savings = completeCity ? Math.max(0, completeCity.totalCost - optimizedTotal) : null;
      const missingCount = lines.filter((line) => !line.bestPrice).length;
      const confidence = aggregateConfidence(lines.map((line) => line.bestPrice?.updateStatus ?? 'missing'));

      setResult({
        server,
        purchaseMode,
        preferredCity,
        lines,
        cityComparisons,
        optimizedTotal,
        selectedModeTotal: selectedModeTotal(purchaseMode, optimizedTotal, bestSingleCity, preferredCityComparison),
        bestSingleCity,
        preferredCityComparison,
        savings,
        missingCount,
        confidence,
        calculatedAt: new Date().toISOString(),
      });
    } catch {
      setErrorMessage('Não foi possível calcular o regear agora. Tente novamente em instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr] xl:items-end">
          <div className="space-y-4">
            <Badge variant="primary" className="gap-2">
              <PackageSearch size={13} />
              Radar de Regear
            </Badge>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Quanto custa montar seu set agora?</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
                Monte um set completo, escolha um servidor e descubra onde comprar cada peça pelo menor preço.
                O radar calcula custo otimizado, custo por cidade e economia estimada sem misturar economias.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-brand-primary/20 bg-zinc-950/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-brand-primary/10 p-2 text-brand-primary">
                <ShoppingCart size={20} />
              </div>
              <div>
                <p className="font-black text-white">Compra inteligente de regear</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  Compare comprar tudo em uma cidade contra dividir a lista entre cidades mais baratas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <SelectField label="Servidor">
          <select
            value={server}
            onChange={(event) => {
              setServerOverride(event.target.value as ServerRegion);
              setResult(null);
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

        <SelectField label="Cidade preferida">
          <select
            value={preferredCity}
            onChange={(event) => {
              setPreferredCity(event.target.value as AlbionCity | 'all');
              setResult(null);
            }}
            className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
          >
            <option value="all">Sem preferência</option>
            {REGEAR_MARKET_CITIES.map((city) => (
              <option key={city} value={city}>
                {formatCityName(city)}
              </option>
            ))}
          </select>
        </SelectField>

        <SelectField label="Modo de compra">
          <select
            value={purchaseMode}
            onChange={(event) => {
              setPurchaseMode(event.target.value as RegearPurchaseMode);
              setResult(null);
            }}
            className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SelectField>
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Sparkles className="text-brand-primary" size={20} />
              Presets de set
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Use um preset como ponto de partida e ajuste peças, tier e quantidades.</p>
          </div>
          <Badge variant="muted">Dados reais ao calcular</Badge>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {REGEAR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                'rounded-lg border border-border-subtle bg-zinc-950 p-4 text-left transition-colors hover:border-brand-primary/50',
                activePresetId === preset.id && 'border-brand-primary/60 bg-brand-primary/10',
              )}
            >
              <p className="font-black text-white">{preset.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {slots.map((slot) => (
          <SlotEditor
            key={slot.slotId}
            slot={slot}
            definition={getSlotDefinition(slot.slotId)}
            onChange={(patch) => updateSlot(slot.slotId, patch)}
          />
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Pronto para calcular?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {filledSlots.length} peça(s) preenchida(s). Mercado Negro fica fora do cálculo padrão de regear.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void calculateRegear()}
          disabled={isLoading || filledSlots.length === 0}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Calculator size={18} />}
          {isLoading ? 'Calculando custo...' : 'Calcular custo do set'}
        </button>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-5 text-sm font-bold text-status-warning">
          {errorMessage}
        </div>
      ) : null}

      {result ? <RegearResult result={result} /> : null}

      <section className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-brand-primary">
              <Crown size={20} />
              Recursos Pro em breve para Regear
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">
              Monetização futura focada em ferramenta, análise e conveniência. Nada de venda de prata, itens por dinheiro real ou RMT.
            </p>
          </div>
          <Badge variant="primary">Em breve</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            'Salvar builds',
            'Duplicar sets',
            'Compartilhar link do set',
            'Histórico de custo',
            'Alerta de set mais barato',
            'Cálculo para múltiplos jogadores',
            'Regear para guildas',
            'Exportar lista de compras',
          ].map((feature) => (
            <div key={feature} className="rounded-lg border border-brand-primary/20 bg-zinc-950/60 px-3 py-3 text-sm font-bold text-zinc-300">
              {feature}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SlotEditor({
  slot,
  definition,
  onChange,
}: {
  slot: RegearSlotForm;
  definition: RegearSlotDefinition;
  onChange: (patch: Partial<RegearSlotForm>) => void;
}) {
  const suggestions = React.useMemo(() => {
    if (slot.query.trim().length < 2) return [];

    return searchCatalogItems(
      slot.query,
      {
        category: definition.categoryHint,
        tier: slot.tier,
        enchantment: slot.enchantment,
      },
      4,
    );
  }, [definition.categoryHint, slot.enchantment, slot.query, slot.tier]);

  const selectedItem = slot.selectedUniqueName
    ? searchCatalogItems(slot.selectedUniqueName, {}, 1)[0] ?? null
    : null;

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-white">{definition.label}</h3>
          <p className="mt-1 text-xs text-zinc-500">{definition.description}</p>
        </div>
        {definition.optional ? <Badge variant="muted">Opcional</Badge> : <Badge variant="outline">Slot</Badge>}
      </div>

      <div className="mt-4 space-y-3">
        <label className="relative block">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
            <Search size={16} />
          </span>
          <span className="sr-only">{definition.label}</span>
          <input
            value={slot.query}
            onChange={(event) =>
              onChange({
                query: event.target.value,
                selectedUniqueName: undefined,
              })
            }
            placeholder={definition.placeholder}
            className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 pl-9 pr-10 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary"
          />
          {slot.query ? (
            <button
              type="button"
              aria-label="Limpar slot"
              onClick={() =>
                onChange({
                  query: '',
                  selectedUniqueName: undefined,
                  quantity: definition.optional ? 0 : 1,
                })
              }
              className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-900 hover:text-white"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>

        {suggestions.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {suggestions.map((item) => (
              <button
                key={item.uniqueName}
                type="button"
                onClick={() =>
                  onChange({
                    query: item.baseNamePtBR ?? item.namePtBR,
                    selectedUniqueName: item.uniqueName,
                    tier: item.tier,
                    enchantment: item.enchantment,
                    quantity: Math.max(1, slot.quantity),
                  })
                }
                className={cn(
                  'rounded-lg border border-border-subtle bg-zinc-950 p-3 text-left transition-colors hover:border-brand-primary/45',
                  slot.selectedUniqueName === item.uniqueName && 'border-brand-primary/60 bg-brand-primary/10',
                )}
              >
                <p className="truncate text-sm font-black text-white">
                  {(item.baseNamePtBR ?? item.namePtBR)} {formatTierEnchant(item.tier, item.enchantment)}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-500">{item.baseNameEn ?? item.nameEn}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">{item.uniqueName}</p>
              </button>
            ))}
          </div>
        ) : null}

        {selectedItem ? (
          <div className="rounded-lg border border-status-success/20 bg-status-success/10 px-3 py-2 text-xs text-status-success">
            <span className="font-bold">Selecionado:</span> {selectedItem.uniqueName}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <SelectField label="Tier">
            <select
              value={slot.tier}
              onChange={(event) => onChange({ tier: Number(event.target.value) as Tier })}
              className="h-10 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  T{tier}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Enc.">
            <select
              value={slot.enchantment}
              onChange={(event) => onChange({ enchantment: Number(event.target.value) as Enchantment })}
              className="h-10 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {ENCHANTMENTS.map((enchantment) => (
                <option key={enchantment} value={enchantment}>
                  {formatEnchantment(enchantment)}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Qualidade">
            <select
              value={slot.quality}
              onChange={(event) => onChange({ quality: event.target.value as Quality })}
              className="h-10 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            >
              {QUALITIES.map((quality) => (
                <option key={quality} value={quality}>
                  {formatQuality(quality)}
                </option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Qtd.">
            <input
              type="number"
              min={definition.optional ? 0 : 1}
              value={slot.quantity}
              onChange={(event) => onChange({ quantity: Math.max(definition.optional ? 0 : 1, Number(event.target.value) || 0) })}
              className="h-10 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
            />
          </SelectField>
        </div>
      </div>
    </article>
  );
}

function RegearResult({ result }: { result: RegearCalculationResult }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Custo total do set"
          value={result.selectedModeTotal > 0 ? formatSilver(result.selectedModeTotal) : 'Sem preço'}
          icon={PackageCheck}
          description={purchaseModeLabel(result.purchaseMode)}
        />
        <StatCard
          title="Melhor cidade única"
          value={result.bestSingleCity ? formatCityName(result.bestSingleCity.city) : 'Indisponível'}
          icon={MapPin}
          description={
            result.bestSingleCity
              ? `${formatSilver(result.bestSingleCity.totalCost)} com ${result.bestSingleCity.missingItems} item(ns) sem preço`
              : 'Nenhuma cidade com dados suficientes'
          }
        />
        <StatCard
          title="Economia otimizada"
          value={result.savings === null ? 'Indisponível' : formatSilver(result.savings)}
          icon={BadgeCheck}
          trend={result.savings !== null ? { value: formatSilver(result.savings), isPositive: result.savings > 0 } : undefined}
          description="Diferença contra a melhor cidade completa"
        />
        <StatCard
          title="Confiança dos dados"
          value={confidenceLabel(result.confidence)}
          icon={ShieldCheck}
          description={`Calculado em ${formatRelativeTime(result.calculatedAt)}`}
        />
        <StatCard
          title="Itens sem preço recente"
          value={result.missingCount}
          icon={AlertTriangle}
          description={`Servidor: ${formatServerName(result.server)}`}
        />
      </div>

      <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-border-subtle p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Boxes className="text-brand-primary" size={20} />
              Lista de compras otimizada
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Cada peça considera a menor ordem de venda nas cidades do servidor selecionado.
            </p>
          </div>
          <Badge variant="primary">Servidor: {formatServerName(result.server)}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-zinc-950/70">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Slot</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Item</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Qualidade</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Qtd.</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Melhor cidade</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Menor preço</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Total</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Atualização</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Confiança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {result.lines.map((line) => (
                <tr key={line.slotId} className="transition-colors hover:bg-zinc-900/60">
                  <td className="px-5 py-4 font-bold text-white">{line.slotLabel}</td>
                  <td className="px-5 py-4">
                    <p className="font-black text-white">{line.displayName}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">{line.uniqueName || line.query}</p>
                    {line.missingReason ? <p className="mt-1 text-xs text-status-warning">{line.missingReason}</p> : null}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-zinc-300">{formatQuality(line.quality)}</td>
                  <td className="px-5 py-4 text-sm font-bold text-zinc-300">{line.quantity}</td>
                  <td className="px-5 py-4 text-sm font-bold text-zinc-300">
                    {line.bestPrice ? formatCityName(line.bestPrice.city) : 'Sem preço'}
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-status-success">
                    {line.unitPrice > 0 ? formatSilver(line.unitPrice) : 'Sem dado'}
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-brand-primary">
                    {line.totalPrice > 0 ? formatSilver(line.totalPrice) : 'Sem dado'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 text-sm text-zinc-400">
                      <Clock3 size={14} className="text-zinc-600" />
                      {line.bestPrice?.updatedAt ? `Atualizado ${formatRelativeTime(line.bestPrice.updatedAt)}` : 'Sem atualização'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={confidenceVariant(line.confidence)}>{confidenceLabel(line.confidence)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
        <div className="border-b border-border-subtle p-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <MapPin className="text-brand-primary" size={20} />
            Comprar tudo em uma cidade
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Mercado Negro fica fora do modo padrão porque não funciona como praça normal de compra para regear.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-zinc-950/70">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cidade</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Custo total</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Itens encontrados</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Itens sem preço</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Confiança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {result.cityComparisons.map((comparison) => {
                const isBest = result.bestSingleCity?.city === comparison.city;
                const isPreferred = result.preferredCity === comparison.city;

                return (
                  <tr
                    key={comparison.city}
                    className={cn(
                      'transition-colors hover:bg-zinc-900/60',
                      isBest && 'bg-brand-primary/5',
                      isPreferred && 'outline outline-1 outline-brand-primary/30',
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white">{formatCityName(comparison.city)}</span>
                        {isBest ? <Badge variant="primary">Melhor</Badge> : null}
                        {isPreferred ? <Badge variant="outline">Preferida</Badge> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-brand-primary">
                      {comparison.totalCost > 0 ? formatSilver(comparison.totalCost) : 'Sem dados'}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">{comparison.foundItems}</td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">{comparison.missingItems}</td>
                    <td className="px-5 py-4">
                      <Badge variant={confidenceVariant(comparison.confidence)}>{confidenceLabel(comparison.confidence)}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
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
