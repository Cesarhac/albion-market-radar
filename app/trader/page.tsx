'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  History,
  MinusCircle,
  PackageOpen,
  PlusCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { ProGate } from '@/components/ProGate';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { ALBION_CITIES } from '@/data/constants';
import {
  findCatalogItemsByQuery as searchCatalogItems,
  getDisplayItemName as getCatalogDisplayItemName,
} from '@/data/itemCatalog';
import { calculateTraderSummary, getTraderPositionKey } from '@/lib/traderWalletStorage';
import { serverParamToRegion } from '@/lib/settingsStorage';
import {
  cn,
  formatCityName,
  formatDateTime,
  formatPercent,
  formatRelativeTime,
  formatServerName,
  formatSilver,
} from '@/lib/utils';
import { formatEntitlementLimit, getUserEntitlements } from '@/src/lib/entitlements';
import {
  clearTraderOperations,
  createTraderOperation,
  deleteTraderOperation,
  fetchTraderOperations,
  updateTraderOperation,
} from '@/src/lib/supabase/database';
import type { AlbionCity, ItemCatalogEntry, ServerParam } from '@/types/albion';
import type {
  NewTraderOperation,
  TraderOperation,
  TraderOperationMetrics,
  TraderPosition,
  TraderWallet,
} from '@/types/trader';

type ModalMode = 'buy' | 'sell' | null;
type SaleMode = 'open' | 'quick';
type TraderFormState = {
  itemName: string;
  itemId: string;
  server: ServerParam;
  city: AlbionCity | '';
  unitPrice: string;
  unitBuyPrice: string;
  unitSellPrice: string;
  quantity: string;
  taxRate: string;
  relatedPositionKey: string;
  isQuickSale: boolean;
  createdAt: string;
  notes: string;
};

const EMPTY_WALLET: TraderWallet = {
  operations: [],
  updatedAt: '',
};

function createDefaultForm(settings: ReturnType<typeof useUserSettings>['settings']): TraderFormState {
  return {
    itemName: '',
    itemId: '',
    server: settings.defaultServer,
    city: settings.mainCity,
    unitPrice: '',
    unitBuyPrice: '',
    unitSellPrice: '',
    quantity: '1',
    taxRate: String(settings.marketTax),
    relatedPositionKey: '',
    isQuickSale: false,
    createdAt: toDateTimeLocalValue(new Date().toISOString()),
    notes: '',
  };
}

export default function TraderPage() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const [wallet, setWallet] = React.useState<TraderWallet>(EMPTY_WALLET);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<ModalMode>(null);
  const [saleMode, setSaleMode] = React.useState<SaleMode>('open');
  const [editingOperation, setEditingOperation] = React.useState<TraderOperation | null>(null);
  const [form, setForm] = React.useState<TraderFormState>(() => createDefaultForm(settings));
  const [toast, setToast] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  React.useEffect(() => {
    let isActive = true;

    async function loadWallet() {
      setIsLoaded(false);
      setErrorMessage('');

      if (!user) {
        setWallet(EMPTY_WALLET);
        setIsLoaded(true);
        return;
      }

      try {
        const operations = await fetchTraderOperations();

        if (!isActive) return;
        setWallet({
          operations,
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!isActive) return;
        setWallet(EMPTY_WALLET);
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar a carteira.');
      }

      if (isActive) setIsLoaded(true);
    }

    void loadWallet();

    return () => {
      isActive = false;
    };
  }, [user]);

  const summary = React.useMemo(
    () => calculateTraderSummary(wallet.operations, settings),
    [settings, wallet.operations],
  );
  const hasReachedOperationLimit =
    Number.isFinite(entitlements.maxTraderOperations) &&
    wallet.operations.length >= entitlements.maxTraderOperations;

  const showToast = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const openBuyModal = React.useCallback((operation?: TraderOperation) => {
    setModalMode('buy');
    setSaleMode('open');
    setEditingOperation(operation ?? null);
    setErrorMessage('');
    setForm(operation ? formFromOperation(operation, settings) : createDefaultForm(settings));
  }, [settings]);

  const openSaleModal = React.useCallback(
    (position?: TraderPosition, operation?: TraderOperation) => {
      const nextForm = operation ? formFromOperation(operation, settings) : createDefaultForm(settings);

      if (position) {
        nextForm.itemName = position.itemName;
        nextForm.itemId = position.itemId ?? '';
        nextForm.server = position.server ?? settings.defaultServer;
        nextForm.quantity = String(Math.min(1, position.quantity));
        nextForm.unitBuyPrice = String(Math.round(position.averageBuyPrice));
        nextForm.relatedPositionKey = position.key;
        nextForm.isQuickSale = false;
      }

      setModalMode('sell');
      setSaleMode(operation?.isQuickSale ? 'quick' : position || operation?.relatedPositionKey ? 'open' : 'quick');
      setEditingOperation(operation ?? null);
      setErrorMessage('');
      setForm(nextForm);
    },
    [settings],
  );

  const closeModal = React.useCallback(() => {
    setModalMode(null);
    setEditingOperation(null);
    setErrorMessage('');
  }, []);

  const handleSaveOperation = React.useCallback(async () => {
    const validationError = validateForm(form, modalMode, saleMode, summary.positions, editingOperation);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!user) {
      setErrorMessage('Entre para registrar operações na carteira.');
      return;
    }

    if (!editingOperation && hasReachedOperationLimit) {
      setErrorMessage(
        `O plano Free permite até ${formatEntitlementLimit(entitlements.maxTraderOperations)} operações. O plano PRO terá carteira ilimitada.`,
      );
      return;
    }

    const operation = operationFromForm(form, modalMode, saleMode);

    try {
      if (editingOperation) {
        const savedOperation = await updateTraderOperation(editingOperation.id, {
          ...operation,
          createdAt: fromDateTimeLocalValue(form.createdAt),
        });

        setWallet({
          operations: sortOperationsDescending(
            wallet.operations.map((currentOperation) =>
              currentOperation.id === editingOperation.id ? savedOperation : currentOperation,
            ),
          ),
          updatedAt: new Date().toISOString(),
        });
        showToast('Operação atualizada.');
      } else {
        const savedOperation = await createTraderOperation(operation);

        setWallet({
          operations: sortOperationsDescending([savedOperation, ...wallet.operations]),
          updatedAt: new Date().toISOString(),
        });
        showToast(modalMode === 'buy' ? 'Compra registrada.' : 'Venda registrada.');
      }

      closeModal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível salvar a operação.');
    }
  }, [
    closeModal,
    editingOperation,
    entitlements.maxTraderOperations,
    form,
    hasReachedOperationLimit,
    modalMode,
    saleMode,
    showToast,
    summary.positions,
    user,
    wallet.operations,
  ]);

  const handleDeleteOperation = React.useCallback(
    async (operation: TraderOperation) => {
      if (!window.confirm('Excluir esta operação?')) return;

      try {
        await deleteTraderOperation(operation.id);

        setWallet({
          operations: wallet.operations.filter((currentOperation) => currentOperation.id !== operation.id),
          updatedAt: new Date().toISOString(),
        });
        showToast('Operação excluída.');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Não foi possível excluir a operação.');
      }
    },
    [showToast, wallet.operations],
  );

  const handleClearWallet = React.useCallback(async () => {
    if (wallet.operations.length === 0) return;
    if (!window.confirm('Excluir todas as operações da carteira?')) return;

    try {
      await clearTraderOperations();

      setWallet({
        operations: [],
        updatedAt: new Date().toISOString(),
      });
      showToast('Carteira limpa.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível limpar a carteira.');
    }
  }, [showToast, wallet.operations.length]);

  return (
    <div className="space-y-8">
      <header className="rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.13),transparent_32%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-3">
            <Badge variant="primary" className="gap-2">
              <Wallet size={13} />
              Controle rápido de flips
            </Badge>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Carteira do Trader</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 md:text-base">
                Registre seus flips e veja seu lucro real em prata. Dados salvos no Supabase para{' '}
                <span className="font-bold text-brand-primary">{user?.playerName ?? 'seu player'}</span>.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-zinc-950/70 p-4 text-sm text-zinc-400">
            <p>
              Servidor padrão:{' '}
              <span className="font-black text-brand-primary">
                {formatServerName(serverParamToRegion(settings.defaultServer))}
              </span>
            </p>
            <p className="mt-1">
              Taxa padrão: <span className="font-black text-brand-primary">{formatPercent(settings.marketTax)}</span>
            </p>
          </div>
        </div>
      </header>

      {toast ? (
        <div className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg border border-status-success/25 bg-status-success/10 px-4 py-3 text-sm font-bold text-status-success shadow-2xl">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-lg border border-status-warning/25 bg-status-warning/10 p-4 text-sm font-bold text-status-warning">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Lucro líquido total"
          value={formatSilver(summary.netProfit)}
          icon={Wallet}
          trend={{ value: formatPercent(summary.roi), isPositive: summary.netProfit >= 0 }}
          description="Resultado real das vendas registradas"
        />
        <StatCard
          title="Prata investida"
          value={formatSilver(summary.totalInvested)}
          icon={PackageOpen}
          description="Capital ainda preso em itens abertos"
        />
        <StatCard
          title="Vendas realizadas"
          value={summary.completedSales}
          icon={ReceiptText}
          description={`Receita bruta: ${formatSilver(summary.totalRevenue)}`}
        />
        <StatCard
          title="Itens em aberto"
          value={summary.openPositionsCount}
          icon={ShieldCheck}
          description={`Taxas pagas: ${formatSilver(summary.totalTaxes)}`}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => openBuyModal()}
          disabled={hasReachedOperationLimit}
          className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-status-success/20 bg-status-success/10 px-5 text-lg font-black text-status-success transition-colors hover:border-status-success/45 hover:bg-status-success/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusCircle size={26} />
          Registrar compra
        </button>
        <button
          type="button"
          onClick={() => openSaleModal()}
          disabled={hasReachedOperationLimit}
          className="flex min-h-24 items-center justify-center gap-3 rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-5 text-lg font-black text-brand-primary transition-colors hover:border-brand-primary/55 hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MinusCircle size={26} />
          Registrar venda
        </button>
      </section>

      {hasReachedOperationLimit ? (
        <ProGate
          title="Limite da carteira Free"
          description={`Você atingiu ${formatEntitlementLimit(entitlements.maxTraderOperations)} operações. O plano PRO terá carteira ilimitada.`}
        />
      ) : null}

      {!isLoaded ? (
        <section className="rounded-lg border border-border-subtle bg-bg-card p-6 text-sm font-bold text-zinc-400">
          Carregando carteira no Supabase...
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <OpenPositionsSection positions={summary.positions} onSell={(position) => openSaleModal(position)} />
        <RecentOperationsSection
          operations={summary.recentOperations}
          onEdit={(operation) => {
            if (operation.type === 'buy') openBuyModal(operation);
            else openSaleModal(undefined, operation);
          }}
          onDelete={handleDeleteOperation}
          onClear={handleClearWallet}
        />
      </section>

      {modalMode ? (
        <TraderOperationModal
          mode={modalMode}
          saleMode={saleMode}
          form={form}
          positions={summary.positions}
          editingOperation={editingOperation}
          errorMessage={errorMessage}
          onSaleModeChange={(nextMode) => {
            setSaleMode(nextMode);
            setForm((current) => ({
              ...current,
              isQuickSale: nextMode === 'quick',
              relatedPositionKey: nextMode === 'quick' ? '' : current.relatedPositionKey,
            }));
            setErrorMessage('');
          }}
          onChange={(patch) => {
            setForm((current) => ({ ...current, ...patch }));
            setErrorMessage('');
          }}
          onPickPosition={(position) => {
            setForm((current) => ({
              ...current,
              itemName: position.itemName,
              itemId: position.itemId ?? '',
              server: position.server ?? settings.defaultServer,
              quantity: String(Math.min(1, position.quantity)),
              unitBuyPrice: String(Math.round(position.averageBuyPrice)),
              relatedPositionKey: position.key,
              isQuickSale: false,
            }));
            setSaleMode('open');
          }}
          onSave={handleSaveOperation}
          onClose={closeModal}
        />
      ) : null}
    </div>
  );
}

function OpenPositionsSection({
  positions,
  onSell,
}: {
  positions: TraderPosition[];
  onSell: (position: TraderPosition) => void;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
      <div className="border-b border-border-subtle p-5">
        <h2 className="flex items-center gap-2 text-xl font-black text-white">
          <PackageOpen className="text-brand-primary" size={20} />
          Itens ainda não vendidos
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Posições calculadas por item e servidor, com preço médio ponderado.</p>
      </div>

      <div className="space-y-3 p-4">
        {positions.length === 0 ? (
          <EmptyPanel
            title="Nenhum item em aberto"
            message="Registre uma compra para começar a acompanhar seu capital investido."
          />
        ) : null}

        {positions.map((position) => (
          <article key={position.key} className="rounded-lg border border-border-subtle bg-zinc-950 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-lg font-black text-white">{position.itemName}</h3>
                  {position.server ? <Badge variant="muted">{formatServerParam(position.server)}</Badge> : null}
                </div>
                {position.itemId ? <p className="mt-1 break-all font-mono text-[11px] text-zinc-600">{position.itemId}</p> : null}
                <p className="mt-2 text-xs text-zinc-500">
                  Atualizado {formatRelativeTime(position.lastUpdatedAt)}
                  {position.lastCity ? ` em ${formatCityName(position.lastCity)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSell(position)}
                className="primary-button justify-center"
              >
                <MinusCircle size={17} />
                Vender
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniMetric label="Quantidade restante" value={new Intl.NumberFormat('pt-BR').format(position.quantity)} />
              <MiniMetric label="Preço médio" value={formatSilver(position.averageBuyPrice)} />
              <MiniMetric label="Total investido" value={formatSilver(position.totalInvested)} />
              <MiniMetric label="Preço mínimo para empatar" value={formatSilver(position.breakEvenPrice)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentOperationsSection({
  operations,
  onEdit,
  onDelete,
  onClear,
}: {
  operations: TraderOperationMetrics[];
  onEdit: (operation: TraderOperation) => void;
  onDelete: (operation: TraderOperation) => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
      <div className="flex flex-col gap-3 border-b border-border-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white">
            <History className="text-brand-primary" size={20} />
            Últimas operações
          </h2>
          <p className="mt-1 text-sm text-zinc-500">Compras e vendas em ordem mais recente.</p>
        </div>
        {operations.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-status-danger/25 bg-status-danger/10 px-3 py-2 text-xs font-black text-status-danger transition-colors hover:border-status-danger/45"
          >
            <Trash2 size={14} />
            Limpar carteira
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        {operations.length === 0 ? (
          <EmptyPanel
            title="Sem operações registradas"
            message="Use os botões de compra e venda para montar seu histórico em segundos."
          />
        ) : null}

        {operations.map((metric) => {
          const operation = metric.operation;
          const isSale = operation.type === 'sell';
          const isPositive = metric.netProfit >= 0;

          return (
            <article
              key={operation.id}
              className={cn(
                'rounded-lg border bg-zinc-950 p-4',
                isSale && isPositive && 'border-status-success/20',
                isSale && !isPositive && 'border-status-danger/25',
                !isSale && 'border-border-subtle',
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={isSale ? (isPositive ? 'success' : 'danger') : 'outline'}>
                      {isSale ? 'Venda' : 'Compra'}
                    </Badge>
                    {operation.server ? <Badge variant="muted">{formatServerParam(operation.server)}</Badge> : null}
                    {operation.isQuickSale ? <Badge variant="warning">Venda rápida</Badge> : null}
                  </div>
                  <h3 className="mt-2 truncate text-lg font-black text-white">{operation.itemName}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {operation.quantity} un. · {operation.city ? formatCityName(operation.city) : 'Sem cidade'} ·{' '}
                    {formatDateTime(operation.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(operation)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-zinc-900 text-white transition-colors hover:border-brand-primary/40"
                    aria-label="Editar operação"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(operation)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-status-danger/20 bg-status-danger/10 text-status-danger transition-colors hover:border-status-danger/45"
                    aria-label="Excluir operação"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {!isSale ? (
                  <>
                    <MiniMetric label="Preço unitário" value={formatSilver(operation.unitPrice ?? 0)} />
                    <MiniMetric label="Total da compra" value={formatSilver(metric.total)} />
                  </>
                ) : (
                  <>
                    <MiniMetric label="Preço de venda" value={formatSilver(operation.unitSellPrice ?? 0)} />
                    <MiniMetric label="Lucro líquido" value={formatSilver(metric.netProfit)} isPositive={isPositive} />
                    <MiniMetric label="ROI" value={formatPercent(metric.roi)} isPositive={isPositive} />
                    <MiniMetric label="Taxa" value={formatSilver(metric.tax)} />
                  </>
                )}
              </div>

              {operation.notes ? <p className="mt-3 text-sm text-zinc-500">{operation.notes}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TraderOperationModal({
  mode,
  saleMode,
  form,
  positions,
  editingOperation,
  errorMessage,
  onSaleModeChange,
  onChange,
  onPickPosition,
  onSave,
  onClose,
}: {
  mode: Exclude<ModalMode, null>;
  saleMode: SaleMode;
  form: TraderFormState;
  positions: TraderPosition[];
  editingOperation: TraderOperation | null;
  errorMessage: string;
  onSaleModeChange: (mode: SaleMode) => void;
  onChange: (patch: Partial<TraderFormState>) => void;
  onPickPosition: (position: TraderPosition) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const suggestions = React.useMemo(() => {
    if (form.itemName.trim().length < 2) return [];

    return searchCatalogItems(form.itemName, {}, 5);
  }, [form.itemName]);
  const selectedPosition = positions.find((position) => position.key === form.relatedPositionKey) ?? null;
  const isBuy = mode === 'buy';
  const isQuickSale = mode === 'sell' && saleMode === 'quick';

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-border-subtle bg-bg-card shadow-2xl md:max-w-2xl md:rounded-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-card/95 p-5 backdrop-blur">
          <div>
            <h2 className="text-xl font-black text-white">
              {editingOperation ? 'Editar operação' : isBuy ? 'Registrar compra' : 'Registrar venda'}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isBuy ? 'Entrada de item na carteira.' : 'Venda de item aberto ou venda rápida sem compra anterior.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-zinc-950 text-zinc-400 hover:text-white"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {!isBuy ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onSaleModeChange('open')}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-black transition-colors',
                  saleMode === 'open'
                    ? 'border-brand-primary/45 bg-brand-primary/10 text-brand-primary'
                    : 'border-border-subtle bg-zinc-950 text-zinc-400 hover:text-white',
                )}
              >
                Item em aberto
              </button>
              <button
                type="button"
                onClick={() => onSaleModeChange('quick')}
                className={cn(
                  'rounded-lg border px-4 py-3 text-sm font-black transition-colors',
                  saleMode === 'quick'
                    ? 'border-brand-primary/45 bg-brand-primary/10 text-brand-primary'
                    : 'border-border-subtle bg-zinc-950 text-zinc-400 hover:text-white',
                )}
              >
                Venda rápida
              </button>
            </div>
          ) : null}

          {!isBuy && saleMode === 'open' ? (
            <label className="space-y-2">
              <span className="field-label">Selecione o item vendido</span>
              <select
                value={form.relatedPositionKey}
                onChange={(event) => {
                  const position = positions.find((item) => item.key === event.target.value);

                  if (position) onPickPosition(position);
                }}
                className="field-control"
              >
                <option value="">Escolher item em aberto</option>
                {positions.map((position) => (
                  <option key={position.key} value={position.key}>
                    {position.itemName} · {position.quantity} un. · {formatSilver(position.averageBuyPrice)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ItemInput
            value={form.itemName}
            itemId={form.itemId}
            disabled={!isBuy && saleMode === 'open' && Boolean(selectedPosition)}
            suggestions={suggestions}
            onTextChange={(value) => onChange({ itemName: value, itemId: '' })}
            onPick={(item) =>
              onChange({
                itemName: getCatalogDisplayItemName(item),
                itemId: item.uniqueName,
              })
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {isBuy ? (
              <NumberField
                label="Preço unitário"
                value={form.unitPrice}
                onChange={(value) => onChange({ unitPrice: value })}
              />
            ) : null}

            {isQuickSale ? (
              <NumberField
                label="Preço de compra unitário"
                value={form.unitBuyPrice}
                onChange={(value) => onChange({ unitBuyPrice: value })}
              />
            ) : null}

            {!isBuy ? (
              <NumberField
                label="Preço unitário de venda"
                value={form.unitSellPrice}
                onChange={(value) => onChange({ unitSellPrice: value })}
              />
            ) : null}

            <NumberField
              label="Quantidade"
              value={form.quantity}
              onChange={(value) => onChange({ quantity: value })}
            />
          </div>

          {!isBuy && selectedPosition ? (
            <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-3 text-sm text-zinc-300">
              <span className="font-bold text-brand-primary">Preço médio de compra:</span>{' '}
              {formatSilver(selectedPosition.averageBuyPrice)} · disponível: {selectedPosition.quantity} un.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Servidor">
              <select
                value={form.server}
                onChange={(event) => onChange({ server: event.target.value as ServerParam })}
                className="field-control"
              >
                <option value="americas">Américas</option>
                <option value="europe">Europa</option>
              </select>
            </SelectField>

            <SelectField label={isBuy ? 'Cidade' : 'Cidade de venda'}>
              <select
                value={form.city}
                onChange={(event) => onChange({ city: event.target.value as AlbionCity | '' })}
                className="field-control"
              >
                <option value="">Sem cidade</option>
                {ALBION_CITIES.map((city) => (
                  <option key={city} value={city}>
                    {formatCityName(city)}
                  </option>
                ))}
              </select>
            </SelectField>
          </div>

          {!isBuy ? (
            <NumberField
              label="Taxa (%)"
              value={form.taxRate}
              min={0}
              max={30}
              step={0.1}
              onChange={(value) => onChange({ taxRate: value })}
            />
          ) : null}

          <label className="space-y-2">
            <span className="field-label">Data</span>
            <input
              type="datetime-local"
              value={form.createdAt}
              onChange={(event) => onChange({ createdAt: event.target.value })}
              className="field-control"
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">Observação</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              rows={3}
              placeholder="Ex: flip de Caerleon, compra pós-ZvZ..."
              className="w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary"
            />
          </label>

          {errorMessage ? (
            <div className="flex items-start gap-2 rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 text-sm font-bold text-status-warning">
              <AlertTriangle className="mt-0.5 shrink-0" size={17} />
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border-subtle bg-bg-card/95 p-5 backdrop-blur sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg border border-border-subtle bg-zinc-950 px-5 text-sm font-black text-white transition-colors hover:border-brand-primary/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="min-h-12 rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
          >
            {editingOperation ? 'Salvar alterações' : isBuy ? 'Salvar compra' : 'Salvar venda'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemInput({
  value,
  itemId,
  disabled,
  suggestions,
  onTextChange,
  onPick,
}: {
  value: string;
  itemId: string;
  disabled?: boolean;
  suggestions: ItemCatalogEntry[];
  onTextChange: (value: string) => void;
  onPick: (item: ItemCatalogEntry) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600">
          <Search size={17} />
        </span>
        <span className="sr-only">Item</span>
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Item, nome livre ou ID"
          className="h-12 w-full rounded-lg border border-border-subtle bg-zinc-950 pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary disabled:opacity-70"
        />
      </label>

      {itemId ? <p className="break-all font-mono text-[11px] text-zinc-600">Item ID: {itemId}</p> : null}

      {!disabled && suggestions.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((item) => (
            <button
              key={item.uniqueName}
              type="button"
              onClick={() => onPick(item)}
              className="rounded-lg border border-border-subtle bg-zinc-950 p-3 text-left transition-colors hover:border-brand-primary/45"
            >
              <p className="truncate text-sm font-black text-white">{getCatalogDisplayItemName(item)}</p>
              <p className="mt-1 truncate text-xs text-zinc-500">{item.nameEn}</p>
              <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">{item.uniqueName}</p>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      />
    </label>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function MiniMetric({
  label,
  value,
  isPositive,
}: {
  label: string;
  value: string | number;
  isPositive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card/70 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 font-black text-white',
          isPositive === true && 'text-status-success',
          isPositive === false && 'text-status-danger',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-6 text-center">
      <Wallet className="mx-auto text-zinc-700" size={30} />
      <h3 className="mt-3 font-black text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">{message}</p>
    </div>
  );
}

function validateForm(
  form: TraderFormState,
  mode: ModalMode,
  saleMode: SaleMode,
  positions: TraderPosition[],
  editingOperation: TraderOperation | null,
): string {
  if (!mode) return 'Escolha uma operação.';
  if (!form.itemName.trim()) return 'Informe o item.';

  const quantity = Number(form.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 'Informe uma quantidade maior que zero.';

  if (mode === 'buy') {
    const unitPrice = Number(form.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return 'Informe o preço unitário da compra.';
    return '';
  }

  const unitSellPrice = Number(form.unitSellPrice);
  if (!Number.isFinite(unitSellPrice) || unitSellPrice <= 0) return 'Informe o preço unitário de venda.';

  const taxRate = Number(form.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 30) return 'A taxa precisa estar entre 0% e 30%.';

  if (saleMode === 'quick') {
    const unitBuyPrice = Number(form.unitBuyPrice);
    if (!Number.isFinite(unitBuyPrice) || unitBuyPrice <= 0) return 'Informe o preço de compra unitário.';
    return '';
  }

  if (!form.relatedPositionKey) return 'Selecione um item em aberto.';

  const selectedPosition = positions.find((position) => position.key === form.relatedPositionKey);
  const extraQuantity =
    editingOperation?.type === 'sell' && editingOperation.relatedPositionKey === form.relatedPositionKey
      ? editingOperation.quantity
      : 0;
  const availableQuantity = (selectedPosition?.quantity ?? 0) + extraQuantity;

  if (quantity > availableQuantity) {
    return `Quantidade maior que o disponível (${new Intl.NumberFormat('pt-BR').format(availableQuantity)}).`;
  }

  return '';
}

function operationFromForm(
  form: TraderFormState,
  mode: ModalMode,
  saleMode: SaleMode,
): NewTraderOperation {
  const baseOperation = {
    itemName: form.itemName.trim(),
    itemId: form.itemId || undefined,
    server: form.server,
    city: form.city || undefined,
    quantity: Number(form.quantity),
    createdAt: fromDateTimeLocalValue(form.createdAt),
    notes: form.notes.trim() || undefined,
  };

  if (mode === 'buy') {
    return {
      ...baseOperation,
      type: 'buy',
      unitPrice: Number(form.unitPrice),
    };
  }

  return {
    ...baseOperation,
    type: 'sell',
    unitBuyPrice: saleMode === 'quick' ? Number(form.unitBuyPrice) : Number(form.unitBuyPrice || 0),
    unitSellPrice: Number(form.unitSellPrice),
    taxRate: Number(form.taxRate),
    relatedPositionKey: saleMode === 'open' ? form.relatedPositionKey : undefined,
    isQuickSale: saleMode === 'quick',
  };
}

function formFromOperation(
  operation: TraderOperation,
  settings: ReturnType<typeof useUserSettings>['settings'],
): TraderFormState {
  return {
    itemName: operation.itemName,
    itemId: operation.itemId ?? '',
    server: operation.server ?? settings.defaultServer,
    city: operation.city ?? settings.mainCity,
    unitPrice: operation.unitPrice ? String(operation.unitPrice) : '',
    unitBuyPrice: operation.unitBuyPrice ? String(operation.unitBuyPrice) : '',
    unitSellPrice: operation.unitSellPrice ? String(operation.unitSellPrice) : '',
    quantity: String(operation.quantity || 1),
    taxRate: String(operation.taxRate ?? settings.marketTax),
    relatedPositionKey: operation.relatedPositionKey ?? getTraderPositionKey(operation),
    isQuickSale: Boolean(operation.isQuickSale),
    createdAt: toDateTimeLocalValue(operation.createdAt),
    notes: operation.notes ?? '',
  };
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return '';

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string): string {
  if (!value) return new Date().toISOString();

  const date = new Date(value);

  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function sortOperationsDescending(operations: TraderOperation[]): TraderOperation[] {
  return [...operations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatServerParam(server: ServerParam): string {
  return server === 'europe' ? 'Europa' : 'Américas';
}
