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
import { BuildEditorPaperDoll } from '@/components/regear/BuildEditorPaperDoll';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { ALBION_CITIES, ENCHANTMENTS, MARKET_SERVER_REGIONS, QUALITIES, TIERS } from '@/data/constants';
import { resolveSelectedItemVariant } from '@/data/itemCatalog';
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
  formatServerName,
  formatSilver,
  formatTierEnchant,
} from '@/lib/utils';
import { serverParamToRegion } from '@/lib/settingsStorage';
import { getUserEntitlements } from '@/src/lib/entitlements';
import { todayStamp } from '@/src/services/proService';
import {
  createRegearBuild,
  deleteRegearBuild,
  findRegearBuildByName,
  listRegearBuilds,
  updateRegearBuild,
  type SavedRegearBuild,
} from '@/src/services/regearBuildsService';

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

function mergeSlotsWithDefaults(items: RegearSlotForm[]): RegearSlotForm[] {
  return createInitialSlots().map((slot) => {
    const savedSlot = items.find((item) => item.slotId === slot.slotId);

    return savedSlot ? { ...slot, ...savedSlot } : slot;
  });
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

function serializeBuildState(name: string, server: ServerRegion, slots: RegearSlotForm[]) {
  return JSON.stringify({
    name: name.trim(),
    server,
    slots: slots.map(({ slotId, query, selectedUniqueName, tier, enchantment, quality, quantity }) => ({
      slotId,
      query,
      selectedUniqueName,
      tier,
      enchantment,
      quality,
      quantity,
    })),
  });
}

function buildExportText(buildName: string, slots: RegearSlotForm[], checklist = false): string {
  const lines = [`Nome da Build: ${buildName.trim() || 'Sem nome'}`, ''];

  for (const definition of REGEAR_SLOT_DEFINITIONS) {
    const slot = slots.find((item) => item.slotId === definition.id);

    if (!slot || !slot.query.trim() || slot.quantity <= 0) continue;

    const item = slot.selectedUniqueName ? searchCatalogItems(slot.selectedUniqueName, {}, 1)[0] ?? null : null;
    const itemName = item?.baseNamePtBR ?? item?.namePtBR ?? slot.query.trim();
    const quantityLabel = slot.quantity > 1 ? ` x${slot.quantity}` : '';
    const line = `${itemName} ${formatTierEnchant(slot.tier, slot.enchantment)}${quantityLabel}`;

    lines.push(checklist ? `[ ] ${line}` : `${definition.label}: ${line}`);
  }

  return `${lines.join('\n')}\n`;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function makeCopyBuildName(name: string, builds: SavedRegearBuild[]): string {
  const baseName = `${name.trim() || 'Build'} (cópia)`;
  const existingNames = new Set(builds.map((build) => build.name));

  if (!existingNames.has(baseName)) return baseName;

  let copyIndex = 2;
  let candidate = `${baseName} ${copyIndex}`;

  while (existingNames.has(candidate)) {
    copyIndex += 1;
    candidate = `${baseName} ${copyIndex}`;
  }

  return candidate;
}

function getSlotDefinition(slotId: RegearSlotId): RegearSlotDefinition {
  return REGEAR_SLOT_DEFINITIONS.find((slot) => slot.id === slotId) ?? REGEAR_SLOT_DEFINITIONS[0]!;
}

function getCandidateForSlot(slot: RegearSlotForm, definition: RegearSlotDefinition): ItemCatalogEntry | null {
  if (slot.selectedUniqueName) {
    const selectedItem = searchCatalogItems(slot.selectedUniqueName, {}, 1)[0] ?? null;

    return selectedItem ? resolveSelectedItemVariant(selectedItem, slot.tier, slot.enchantment) : null;
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
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const isPro = entitlements.savedRegearBuilds > 1;
  const [serverOverride, setServerOverride] = React.useState<ServerRegion | null>(null);
  const [preferredCity, setPreferredCity] = React.useState<AlbionCity | 'all'>('all');
  const [purchaseMode, setPurchaseMode] = React.useState<RegearPurchaseMode>('optimized');
  const [slots, setSlots] = React.useState<RegearSlotForm[]>(() => createSlotsFromPreset(REGEAR_PRESETS[0]!));
  const [result, setResult] = React.useState<RegearCalculationResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [activePresetId, setActivePresetId] = React.useState<string>(REGEAR_PRESETS[0]!.id);
  const [savedBuilds, setSavedBuilds] = React.useState<SavedRegearBuild[]>([]);
  const [buildName, setBuildName] = React.useState('Meu regear');
  const [currentBuildId, setCurrentBuildId] = React.useState<string | null>(null);
  const [isSavingBuild, setIsSavingBuild] = React.useState(false);
  const [buildStatusMessage, setBuildStatusMessage] = React.useState('');
  const [lastSavedSnapshot, setLastSavedSnapshot] = React.useState('');
  const [playersCount, setPlayersCount] = React.useState(1);
  const server = serverOverride ?? serverParamToRegion(settings.defaultServer);

  const filledSlots = slots.filter((slot) => slot.query.trim().length > 0 && slot.quantity > 0);
  const savedBuildsLimit = entitlements.savedRegearBuilds;
  const canCreateAnotherBuild = savedBuilds.length < savedBuildsLimit;
  const currentBuildSnapshot = React.useMemo(
    () => serializeBuildState(buildName, server, slots),
    [buildName, server, slots],
  );
  const isBuildDirty = currentBuildSnapshot !== lastSavedSnapshot;

  React.useEffect(() => {
    let isActive = true;

    if (!user) return () => {
      isActive = false;
    };

    void listRegearBuilds(user.id)
      .then((builds) => {
        if (isActive) setSavedBuilds(builds);
      })
      .catch(() => {
        if (isActive) setSavedBuilds([]);
      });

    return () => {
      isActive = false;
    };
  }, [user]);

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
    setBuildStatusMessage('');
  }, []);

  const applyPreset = React.useCallback((preset: RegearPreset) => {
    setActivePresetId(preset.id);
    setSlots(createSlotsFromPreset(preset));
    setCurrentBuildId(null);
    setLastSavedSnapshot('');
    setResult(null);
    setErrorMessage('');
    setBuildStatusMessage('');
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

  const blockNewBuildCreation = () => {
    setErrorMessage(
      isPro
        ? 'Limite de 20 builds salvas atingido.'
        : 'O plano Free permite salvar 1 build. O PRO libera até 20 builds.',
    );
  };

  const syncSavedBuild = (savedBuild: SavedRegearBuild) => {
    const mergedSlots = mergeSlotsWithDefaults(savedBuild.items);

    setCurrentBuildId(savedBuild.id);
    setBuildName(savedBuild.name);
    setServerOverride(savedBuild.server);
    setSlots(mergedSlots);
    setSavedBuilds((current) => [savedBuild, ...current.filter((build) => build.id !== savedBuild.id)]);
    setLastSavedSnapshot(serializeBuildState(savedBuild.name, savedBuild.server, mergedSlots));
  };

  const saveNewBuild = async (options?: {
    name?: string;
    sourceSlots?: RegearSlotForm[];
    sourceServer?: ServerRegion;
    successMessage?: string;
  }) => {
    if (!user) {
      setErrorMessage('Entre na sua conta para salvar builds.');
      return;
    }

    const nextName = (options?.name ?? buildName).trim();
    const nextSlots = options?.sourceSlots ?? slots;
    const nextServer = options?.sourceServer ?? server;

    if (!nextName) {
      setErrorMessage('Informe um nome para a build.');
      return;
    }

    setIsSavingBuild(true);
    setBuildStatusMessage('');

    try {
      const duplicatedBuild = await findRegearBuildByName(user.id, nextName);

      if (duplicatedBuild) {
        const shouldOverwrite = window.confirm('Já existe uma build com esse nome. Deseja sobrescrever essa build?');

        if (!shouldOverwrite) return;

        const savedBuild = await updateRegearBuild(duplicatedBuild.id, {
          name: nextName,
          server: nextServer,
          items: nextSlots,
        });

        syncSavedBuild(savedBuild);
        setErrorMessage('');
        setBuildStatusMessage('Build existente atualizada.');
        return;
      }

      if (savedBuilds.length >= savedBuildsLimit) {
        blockNewBuildCreation();
        return;
      }

      const savedBuild = await createRegearBuild({
        name: nextName,
        server: nextServer,
        items: nextSlots,
      });

      syncSavedBuild(savedBuild);
      setErrorMessage('');
      setBuildStatusMessage(options?.successMessage ?? 'Build salva com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar a build.');
    } finally {
      setIsSavingBuild(false);
    }
  };

  const updateCurrentBuild = async () => {
    if (!currentBuildId) {
      await saveNewBuild();
      return;
    }

    setIsSavingBuild(true);
    setBuildStatusMessage('');

    try {
      if (!buildName.trim()) {
        setErrorMessage('Informe um nome para a build.');
        return;
      }

      const savedBuild = await updateRegearBuild(currentBuildId, {
        name: buildName.trim(),
        server,
        items: slots,
      });

      syncSavedBuild(savedBuild);
      setErrorMessage('');
      setBuildStatusMessage('Build atualizada com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar a build.');
    } finally {
      setIsSavingBuild(false);
    }
  };

  const saveCurrentAsNew = async () => {
    await saveNewBuild({
      name: `${buildName.trim() || 'Build'} (cópia)`,
      sourceSlots: slots,
      sourceServer: server,
      successMessage: 'Build salva como nova.',
    });
  };

  const applySavedBuild = (build: SavedRegearBuild) => {
    const mergedSlots = mergeSlotsWithDefaults(build.items);

    setCurrentBuildId(build.id);
    setBuildName(build.name);
    setServerOverride(build.server);
    setSlots(mergedSlots);
    setResult(null);
    setErrorMessage('');
    setBuildStatusMessage('Build carregada.');
    setLastSavedSnapshot(serializeBuildState(build.name, build.server, mergedSlots));
  };

  const duplicateBuild = async (build: SavedRegearBuild) => {
    if (savedBuilds.length >= savedBuildsLimit) {
      blockNewBuildCreation();
      return;
    }

    try {
      const savedBuild = await createRegearBuild({
        name: makeCopyBuildName(build.name, savedBuilds),
        server: build.server,
        items: mergeSlotsWithDefaults(build.items),
      });

      syncSavedBuild(savedBuild);
      setBuildStatusMessage('Build duplicada.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível duplicar a build.');
    }
  };

  const renameSavedBuild = async (build: SavedRegearBuild) => {
    const nextName = window.prompt('Novo nome da build:', build.name)?.trim();

    if (!nextName || nextName === build.name) return;

    const duplicatedName = savedBuilds.find((item) => item.id !== build.id && item.name === nextName);

    if (duplicatedName) {
      setErrorMessage('Já existe uma build salva com esse nome.');
      return;
    }

    try {
      const savedBuild = await updateRegearBuild(build.id, { name: nextName });

      setSavedBuilds((current) =>
        current.map((item) => (item.id === savedBuild.id ? savedBuild : item)),
      );

      if (currentBuildId === savedBuild.id) {
        setBuildName(savedBuild.name);
        setLastSavedSnapshot(serializeBuildState(savedBuild.name, server, slots));
      }

      setErrorMessage('');
      setBuildStatusMessage('Build renomeada.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível renomear a build.');
    }
  };

  const removeSavedBuild = async (buildId: string) => {
    try {
      await deleteRegearBuild(buildId);
      setSavedBuilds((current) => current.filter((build) => build.id !== buildId));
      if (currentBuildId === buildId) {
        setCurrentBuildId(null);
        setLastSavedSnapshot('');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir a build.');
    }
  };

  const clearBuild = React.useCallback(() => {
    if (!window.confirm('Limpar a build atual?')) return;

    setCurrentBuildId(null);
    setBuildName('Meu regear');
    setSlots(createInitialSlots());
    setResult(null);
    setErrorMessage('');
    setBuildStatusMessage('Build limpa. Salve para persistir.');
    setLastSavedSnapshot('');
  }, []);

  const copyBuildList = React.useCallback(async () => {
    try {
      await window.navigator.clipboard.writeText(buildExportText(buildName, slots));
      setBuildStatusMessage('Lista copiada para a área de transferência.');
    } catch {
      setErrorMessage('Não foi possível copiar a lista.');
    }
  }, [buildName, slots]);

  const copyBuildChecklist = React.useCallback(async () => {
    try {
      await window.navigator.clipboard.writeText(buildExportText(buildName, slots, true));
      setBuildStatusMessage('Checklist de compra copiado.');
    } catch {
      setErrorMessage('Não foi possível copiar o checklist.');
    }
  }, [buildName, slots]);

  const downloadBuildTxt = React.useCallback(() => {
    downloadTextFile(`albion-build-${todayStamp()}.txt`, buildExportText(buildName, slots));
    setBuildStatusMessage('Arquivo TXT gerado.');
  }, [buildName, slots]);

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

      <BuildEditorPaperDoll
        buildName={buildName}
        slots={slots}
        isEditingSavedBuild={Boolean(currentBuildId)}
        isDirty={isBuildDirty}
        isSaving={isSavingBuild}
        savedBuildsCount={savedBuilds.length}
        savedBuildsLimit={savedBuildsLimit}
        canSaveAsNew={canCreateAnotherBuild}
        statusMessage={buildStatusMessage}
        onBuildNameChange={(name) => {
          setBuildName(name);
          setBuildStatusMessage('');
        }}
        onSlotChange={updateSlot}
        onCreateNew={() => void saveNewBuild()}
        onUpdate={() => void updateCurrentBuild()}
        onSaveAsNew={() => void saveCurrentAsNew()}
        onNewBuild={clearBuild}
        onCopyList={() => void copyBuildList()}
        onCopyChecklist={() => void copyBuildChecklist()}
        onDownloadTxt={downloadBuildTxt}
      />

      <section className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-black text-white">
              <PackageCheck className="text-brand-primary" size={18} />
              Minhas builds
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Free salva 1 build. PRO salva até 20. Carregue, renomeie, duplique ou exclua suas builds.
            </p>
          </div>
          <Badge variant="muted">Builds salvas: {savedBuilds.length}/{savedBuildsLimit}</Badge>
        </div>

        {!isPro && savedBuilds.length >= 1 && !currentBuildId ? (
          <div className="mt-3 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-primary">
            PRO libera até 20 builds salvas.
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {savedBuilds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-subtle bg-zinc-950/70 p-3 text-sm text-zinc-500 md:col-span-2 xl:col-span-4">
              Nenhuma build salva ainda.
            </p>
          ) : null}
          {savedBuilds.map((build) => (
            <article
              key={build.id}
              className={cn(
                'rounded-lg border border-border-subtle bg-zinc-950 p-3',
                currentBuildId === build.id && 'border-brand-primary/60 bg-brand-primary/10',
              )}
            >
              <h3 className="truncate font-black text-white">{build.name}</h3>
              <p className="mt-1 text-xs text-zinc-500">{formatServerName(build.server)} · {build.items.filter((item) => item.query).length} itens</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => applySavedBuild(build)} className="secondary-button">Carregar</button>
                <button type="button" onClick={() => void renameSavedBuild(build)} className="secondary-button">Renomear</button>
                <button type="button" onClick={() => void duplicateBuild(build)} className="secondary-button">Duplicar</button>
                <button type="button" onClick={() => void removeSavedBuild(build.id)} className="danger-button">Excluir</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Pronto para calcular?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {filledSlots.length} peça(s) preenchida(s). Mercado Negro fica fora do cálculo padrão de regear.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-lg border border-border-subtle bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-300">
            Jogadores
            <input
              type="number"
              min={1}
              value={playersCount}
              onChange={(event) => setPlayersCount(Math.max(1, Number(event.target.value) || 1))}
              className="h-8 w-20 rounded-md border border-border-subtle bg-bg-card px-2 text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void calculateRegear()}
            disabled={isLoading || filledSlots.length === 0}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Calculator size={18} />}
            {isLoading ? 'Calculando custo...' : 'Calcular custo do set'}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-5 text-sm font-bold text-status-warning">
          {errorMessage}
        </div>
      ) : null}

      {result ? <RegearResult result={result} /> : null}

      <section className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4">
        <h2 className="flex items-center gap-2 font-black text-brand-primary">
          <Crown size={18} />
          Regear PRO funcional
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Builds salvas, duplicação, comparação por cidade, múltiplos jogadores e exportação TXT/checklist já estão conectados.
        </p>
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
          description={<RelativeTime date={result.calculatedAt} prefix="Calculado em" />}
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
                      {line.bestPrice?.updatedAt ? <RelativeTime date={line.bestPrice.updatedAt} prefix="Atualizado" /> : 'Sem atualização'}
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

