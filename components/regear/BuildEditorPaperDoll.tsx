'use client';

import React from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  FileText,
  PlusCircle,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ENCHANTMENTS, QUALITIES, TIERS } from '@/data/constants';
import { REGEAR_SLOT_DEFINITIONS } from '@/data/regearPresets';
import { searchBuildSlotItems } from '@/lib/build-slot-filters';
import {
  cn,
  formatEnchantment,
  formatQuality,
  formatTierEnchant,
} from '@/lib/utils';
import type { Enchantment, ItemCatalogEntry, Quality, Tier } from '@/types/albion';
import type { RegearSlotDefinition, RegearSlotForm, RegearSlotId } from '@/types/regear';

type BuildEditorPaperDollProps = {
  buildName: string;
  slots: RegearSlotForm[];
  isEditingSavedBuild: boolean;
  isDirty: boolean;
  isSaving: boolean;
  savedBuildsCount: number;
  savedBuildsLimit: number;
  canSaveAsNew: boolean;
  statusMessage?: string;
  onBuildNameChange: (name: string) => void;
  onSlotChange: (slotId: RegearSlotId, patch: Partial<RegearSlotForm>) => void;
  onCreateNew: () => void;
  onUpdate: () => void;
  onSaveAsNew: () => void;
  onNewBuild: () => void;
  onCopyList: () => void;
  onCopyChecklist: () => void;
  onDownloadTxt: () => void;
};

const PAPER_DOLL_LAYOUT: Record<RegearSlotId, string> = {
  head: 'col-start-2 row-start-1',
  cape: 'col-start-1 row-start-2',
  armor: 'col-start-2 row-start-2',
  bag: 'col-start-3 row-start-2',
  mainHand: 'col-start-1 row-start-3',
  offHand: 'col-start-3 row-start-3',
  shoes: 'col-start-2 row-start-4',
  food: 'col-start-1 row-start-5',
  potion: 'col-start-2 row-start-5',
  mount: 'col-start-3 row-start-5',
};

export function BuildEditorPaperDoll({
  buildName,
  slots,
  isEditingSavedBuild,
  isDirty,
  isSaving,
  savedBuildsCount,
  savedBuildsLimit,
  canSaveAsNew,
  statusMessage,
  onBuildNameChange,
  onSlotChange,
  onCreateNew,
  onUpdate,
  onSaveAsNew,
  onNewBuild,
  onCopyList,
  onCopyChecklist,
  onDownloadTxt,
}: BuildEditorPaperDollProps) {
  const [activeSlotId, setActiveSlotId] = React.useState<RegearSlotId | null>(null);
  const activeSlot = slots.find((slot) => slot.slotId === activeSlotId) ?? null;
  const filledCount = slots.filter((slot) => slot.query.trim() && slot.quantity > 0).length;

  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
      <div className="flex flex-col gap-3 border-b border-border-subtle bg-zinc-950/60 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Nome da build</span>
            <input
              value={buildName}
              onChange={(event) => onBuildNameChange(event.target.value)}
              placeholder="Nome da build"
              className="h-10 w-full rounded-lg border border-border-subtle bg-bg-card px-3 text-sm font-black text-white outline-none focus:border-brand-primary"
            />
          </label>
          <Badge variant={isEditingSavedBuild ? 'primary' : 'info'} className="w-fit gap-1">
            {isEditingSavedBuild ? 'Editando build salva' : 'Nova build'}
          </Badge>
          <Badge variant={isDirty ? 'warning' : 'success'} className="w-fit gap-1">
            {isDirty ? 'Não salvo' : 'Salvo'}
          </Badge>
          <Badge variant="muted">Builds salvas: {savedBuildsCount}/{savedBuildsLimit}</Badge>
          <Badge variant="muted">{filledCount}/10 slots</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={isEditingSavedBuild ? onUpdate : onCreateNew}
            disabled={isSaving}
            className="primary-button"
          >
            <Save size={15} />
            {isSaving ? 'Salvando...' : isEditingSavedBuild ? 'Atualizar build' : 'Salvar nova build'}
          </button>
          {isEditingSavedBuild && canSaveAsNew ? (
            <button type="button" onClick={onSaveAsNew} disabled={isSaving} className="secondary-button">
              <PlusCircle size={15} />
              Salvar como nova
            </button>
          ) : null}
          <button type="button" onClick={onCopyList} className="secondary-button">
            <Copy size={15} />
            Copiar lista
          </button>
          <button type="button" onClick={onDownloadTxt} className="secondary-button">
            <Download size={15} />
            Exportar lista
          </button>
          <button type="button" onClick={onNewBuild} className="danger-button">
            <Eraser size={15} />
            Nova build
          </button>
        </div>
      </div>

      {statusMessage ? (
        <div className="border-b border-border-subtle bg-brand-primary/10 px-4 py-2 text-sm font-bold text-brand-primary">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[520px] rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_40%),#09090b] p-4">
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-72 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-primary/20 bg-zinc-900/30 shadow-[0_0_80px_rgba(250,204,21,0.08)] md:block" />
          <div className="pointer-events-none absolute left-1/2 top-[47%] hidden h-44 w-24 -translate-x-1/2 rounded-[48%] border border-zinc-700/80 bg-zinc-950/80 md:block" />
          <div className="pointer-events-none absolute left-1/2 top-[31%] hidden h-20 w-20 -translate-x-1/2 rounded-full border border-zinc-700/80 bg-zinc-950/90 md:block" />

          <div className="relative z-10 grid min-h-[480px] grid-cols-3 grid-rows-5 gap-3">
            {REGEAR_SLOT_DEFINITIONS.map((definition) => {
              const slot = slots.find((item) => item.slotId === definition.id);

              if (!slot) return null;

              return (
                <BuildSlotButton
                  key={definition.id}
                  definition={definition}
                  slot={slot}
                  className={PAPER_DOLL_LAYOUT[definition.id]}
                  onClick={() => setActiveSlotId(definition.id)}
                />
              );
            })}
          </div>
        </div>

        <BuildSummaryCard
          slots={slots}
          onEdit={setActiveSlotId}
          onCopyChecklist={onCopyChecklist}
        />
      </div>

      {activeSlot ? (
        <BuildSlotDrawer
          key={activeSlot.slotId}
          slot={activeSlot}
          definition={getSlotDefinition(activeSlot.slotId)}
          onChange={(patch) => onSlotChange(activeSlot.slotId, patch)}
          onClose={() => setActiveSlotId(null)}
        />
      ) : null}
    </section>
  );
}

function BuildSlotButton({
  definition,
  slot,
  className,
  onClick,
}: {
  definition: RegearSlotDefinition;
  slot: RegearSlotForm;
  className: string;
  onClick: () => void;
}) {
  const hasItem = Boolean(slot.query.trim());
  const iconUrl = hasItem && slot.selectedUniqueName
    ? `https://render.albiononline.com/v1/item/${encodeURIComponent(slot.selectedUniqueName)}.png`
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[78px] flex-col justify-between rounded-lg border p-2 text-left transition-all hover:-translate-y-0.5 hover:border-brand-primary/60 focus:outline-none focus:ring-2 focus:ring-brand-primary/45',
        hasItem
          ? 'border-brand-primary/35 bg-brand-primary/10'
          : 'border-border-subtle bg-zinc-950/90 hover:bg-zinc-900',
        className,
      )}
      aria-label={hasItem ? `Editar ${definition.label}` : definition.placeholder}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{definition.label}</span>
        {iconUrl ? (
          <span
            aria-hidden="true"
            className="h-8 w-8 rounded-md border border-brand-primary/25 bg-zinc-950 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${iconUrl}")` }}
          />
        ) : hasItem ? (
          <CheckCircle2 size={14} className="text-status-success" />
        ) : (
          <Sparkles size={13} className="text-zinc-600 group-hover:text-brand-primary" />
        )}
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-black', hasItem ? 'text-white' : 'text-zinc-500')}>
          {hasItem ? slot.query : definition.placeholder}
        </span>
        {hasItem ? (
          <span className="mt-1 block text-xs font-bold text-brand-primary">
            {formatTierEnchant(slot.tier, slot.enchantment)}
            {slot.quantity > 1 ? ` x${slot.quantity}` : ''}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function BuildSlotDrawer({
  slot,
  definition,
  onChange,
  onClose,
}: {
  slot: RegearSlotForm;
  definition: RegearSlotDefinition;
  onChange: (patch: Partial<RegearSlotForm>) => void;
  onClose: () => void;
}) {
  const titleId = React.useId();
  const [query, setQuery] = React.useState(slot.query);
  const [debouncedQuery, setDebouncedQuery] = React.useState(slot.query);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 160);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const suggestions = React.useMemo(
    () =>
      searchBuildSlotItems(
        slot.slotId,
        debouncedQuery,
        {
          tier: slot.tier,
          enchantment: slot.enchantment,
        },
        12,
      ),
    [debouncedQuery, slot.enchantment, slot.slotId, slot.tier],
  );

  const selectItem = (item: ItemCatalogEntry) => {
    const itemName = item.baseNamePtBR ?? item.namePtBR;

    setQuery(itemName);
    onChange({
      query: itemName,
      selectedUniqueName: item.uniqueName,
      tier: item.tier,
      enchantment: item.enchantment,
      quantity: Math.max(1, slot.quantity),
    });
  };

  const removeItem = () => {
    setQuery('');
    onChange({
      query: '',
      selectedUniqueName: undefined,
      quantity: definition.optional ? 0 : 1,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="h-full w-full max-w-md overflow-y-auto border-l border-border-subtle bg-bg-card shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border-subtle bg-bg-card/95 p-4 backdrop-blur">
          <div>
            <Badge variant="primary">{definition.label}</Badge>
            <h2 id={titleId} className="mt-2 text-xl font-black text-white">Selecionar item</h2>
            <p className="mt-1 text-sm text-zinc-500">{definition.description}</p>
          </div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Fechar seletor">
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
              <Search size={17} />
            </span>
            <span className="sr-only">Buscar item para {definition.label}</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                onChange({ query: event.target.value, selectedUniqueName: undefined });
              }}
              placeholder={definition.placeholder}
              className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Tier">
              <select
                value={slot.tier}
                onChange={(event) => onChange({ tier: Number(event.target.value) as Tier })}
                className="field-control"
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>T{tier}</option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Encantamento">
              <select
                value={slot.enchantment}
                onChange={(event) => onChange({ enchantment: Number(event.target.value) as Enchantment })}
                className="field-control"
              >
                {ENCHANTMENTS.map((enchantment) => (
                  <option key={enchantment} value={enchantment}>{formatEnchantment(enchantment)}</option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Qualidade">
              <select
                value={slot.quality}
                onChange={(event) => onChange({ quality: event.target.value as Quality })}
                className="field-control"
              >
                {QUALITIES.map((quality) => (
                  <option key={quality} value={quality}>{formatQuality(quality)}</option>
                ))}
              </select>
            </SelectField>

            <SelectField label="Quantidade">
              <input
                type="number"
                min={definition.optional ? 0 : 1}
                value={slot.quantity}
                onChange={(event) => onChange({ quantity: Math.max(definition.optional ? 0 : 1, Number(event.target.value) || 0) })}
                className="field-control"
              />
            </SelectField>
          </div>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((item) => (
                <button
                  key={item.uniqueName}
                  type="button"
                  onClick={() => selectItem(item)}
                  className={cn(
                    'w-full rounded-lg border border-border-subtle bg-zinc-950 p-3 text-left transition-colors hover:border-brand-primary/50',
                    slot.selectedUniqueName === item.uniqueName && 'border-brand-primary/60 bg-brand-primary/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {(item.baseNamePtBR ?? item.namePtBR)} {formatTierEnchant(item.tier, item.enchantment)}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">{item.baseNameEn ?? item.nameEn}</p>
                      <p className="mt-1 break-all font-mono text-[11px] text-zinc-600">{item.uniqueName}</p>
                    </div>
                    <Badge variant="outline">{item.category}</Badge>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border-subtle bg-zinc-950 p-4 text-sm text-zinc-500">
              Busque por nome em português, inglês, alias ou Item ID. Os resultados são filtrados para este slot.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={removeItem} className="danger-button justify-center">
              <Trash2 size={15} />
              Remover item
            </button>
            <button type="button" onClick={onClose} className="primary-button justify-center">
              Concluir
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function BuildSummaryCard({
  slots,
  onEdit,
  onCopyChecklist,
}: {
  slots: RegearSlotForm[];
  onEdit: (slotId: RegearSlotId) => void;
  onCopyChecklist: () => void;
}) {
  return (
    <aside className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-white">Resumo da build</h2>
          <p className="mt-1 text-xs text-zinc-500">Lista curta para revisar antes de calcular.</p>
        </div>
        <button type="button" onClick={onCopyChecklist} className="secondary-button">
          <FileText size={15} />
          Checklist
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {REGEAR_SLOT_DEFINITIONS.map((definition) => {
          const slot = slots.find((item) => item.slotId === definition.id);
          const hasItem = Boolean(slot?.query.trim());

          return (
            <button
              key={definition.id}
              type="button"
              onClick={() => onEdit(definition.id)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-card px-3 py-2 text-left transition-colors hover:border-brand-primary/40"
            >
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase text-zinc-500">{definition.label}</span>
                <span className={cn('block truncate text-sm font-black', hasItem ? 'text-white' : 'text-zinc-600')}>
                  {hasItem ? slot?.query : definition.placeholder}
                </span>
              </span>
              {slot && hasItem ? (
                <span className="shrink-0 text-xs font-black text-brand-primary">
                  {formatTierEnchant(slot.tier, slot.enchantment)}
                  {slot.quantity > 1 ? ` x${slot.quantity}` : ''}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
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

function getSlotDefinition(slotId: RegearSlotId): RegearSlotDefinition {
  return REGEAR_SLOT_DEFINITIONS.find((slot) => slot.id === slotId) ?? REGEAR_SLOT_DEFINITIONS[0]!;
}
