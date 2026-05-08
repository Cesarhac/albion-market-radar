'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  Edit3,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { ProGate } from '@/components/ProGate';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useAlerts } from '@/context/AlertsContext';
import { useAuth } from '@/context/AuthContext';
import { useUserSettings } from '@/context/UserSettingsContext';
import { ALBION_CITIES } from '@/data/constants';
import {
  findCatalogItemsByQuery,
  getDisplayItemName as getCatalogDisplayItemName,
} from '@/data/itemCatalog';
import { serverParamToRegion } from '@/lib/settingsStorage';
import { cn, formatCityName, formatServerName, formatSilver } from '@/lib/utils';
import { formatEntitlementLimit, getUserEntitlements } from '@/src/lib/entitlements';
import {
  checkAlertsIndividually,
  conditionLabel,
  createAlert,
  deleteAlert,
  listAlerts,
  statusLabel,
  updateAlert,
  type NewPriceAlertInput,
  type PriceAlert,
  type PriceAlertCheckResult,
  type PriceAlertCondition,
} from '@/src/services/alertsService';
import type { AlbionCity, ItemCatalogEntry, ServerParam } from '@/types/albion';

type AlertFormState = {
  itemName: string;
  itemId: string;
  server: ServerParam;
  city: AlbionCity;
  condition: PriceAlertCondition;
  targetPrice: string;
  active: boolean;
};

const AUTO_CHECK_INTERVAL_MS = 2 * 60 * 1000;

const FREE_ALERT_CARDS = [
  {
    title: 'Preço cair para ou abaixo de',
    description: 'Use para comprar quando o item ficar barato.',
    icon: Target,
  },
  {
    title: 'Preço subir para ou acima de',
    description: 'Use para vender ou monitorar valorização.',
    icon: BellRing,
  },
  {
    title: 'Monitoramento por cidade',
    description: 'Escolha servidor e cidade para evitar ruído de mercados que você não usa.',
    icon: MapPin,
  },
  {
    title: 'Notificações no site',
    description: 'Receba aviso visual e contador quando o alvo for atingido.',
    icon: CheckCircle2,
  },
  {
    title: 'Notificações do navegador',
    description: 'Receba pop-ups enquanto o site estiver aberto e a permissão estiver ativa.',
    icon: Bell,
  },
] as const;

function createEmptyForm(server: ServerParam = 'americas'): AlertFormState {
  return {
    itemName: '',
    itemId: '',
    server,
    city: 'Caerleon',
    condition: 'below',
    targetPrice: '',
    active: true,
  };
}

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusedAlertId = searchParams.get('alert');
  const { user } = useAuth();
  const { settings, saveSettings } = useUserSettings();
  const { notifyAlertTriggered, setTriggeredAlertCount } = useAlerts();
  const entitlements = React.useMemo(() => getUserEntitlements(user), [user]);
  const canUseAlerts = entitlements.maxPriceAlerts > 0;
  const maxAlerts = entitlements.maxPriceAlerts;
  const [alerts, setAlerts] = React.useState<PriceAlert[]>([]);
  const [form, setForm] = React.useState<AlertFormState>(() => createEmptyForm(user?.server ?? settings.defaultServer));
  const [editingAlertId, setEditingAlertId] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [checkingAlertIds, setCheckingAlertIds] = React.useState<Set<string>>(() => new Set());
  const [message, setMessage] = React.useState('');
  const [highlightedAlertId, setHighlightedAlertId] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLDivElement | null>(null);
  const cardRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const isChecking = checkingAlertIds.size > 0;

  const activeAlerts = React.useMemo(() => alerts.filter((alert) => alert.active), [alerts]);
  const triggeredAlerts = React.useMemo(
    () => alerts.filter((alert) => alert.active && alert.status === 'triggered'),
    [alerts],
  );
  const activeCountExcludingEdited = React.useMemo(
    () => alerts.filter((alert) => alert.active && alert.id !== editingAlertId).length,
    [alerts, editingAlertId],
  );
  const hasReachedActiveLimit =
    form.active && Number.isFinite(maxAlerts) && activeCountExcludingEdited >= maxAlerts;

  React.useEffect(() => {
    setTriggeredAlertCount(triggeredAlerts.length);
  }, [setTriggeredAlertCount, triggeredAlerts.length]);

  const suggestions = React.useMemo(() => {
    if (form.itemName.trim().length < 2) return [];

    return findCatalogItemsByQuery(form.itemName, {}, 6);
  }, [form.itemName]);

  const dispatchNotifications = React.useCallback(
    (results: PriceAlertCheckResult[]) => {
      for (const result of results) {
        if (!result.shouldNotify) continue;

        notifyAlertTriggered(result.alert, result.currentPrice);

        if (
          settings.browserNotificationsEnabled &&
          result.alert.browserNotificationEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          const notification = new Notification('Alerta de preço atingido', {
            body: `${result.alert.itemName} em ${formatCityName(result.alert.city)} chegou a ${formatSilver(result.currentPrice ?? result.alert.targetPrice)}.`,
          });

          notification.onclick = () => {
            window.focus();
            router.push(`/alerts?alert=${result.alert.id}`);
          };
        }
      }
    },
    [notifyAlertTriggered, router, settings.browserNotificationsEnabled],
  );

  const mergeCheckResults = React.useCallback((results: PriceAlertCheckResult[]) => {
    if (results.length === 0) return;

    const resultByAlertId = new Map(results.map((result) => [result.alert.id, result.alert]));
    setAlerts((current) => current.map((alert) => resultByAlertId.get(alert.id) ?? alert));
  }, []);

  const setAlertsChecking = React.useCallback((alertIds: string[], checking: boolean) => {
    setCheckingAlertIds((current) => {
      const next = new Set(current);

      for (const alertId of alertIds) {
        if (checking) {
          next.add(alertId);
        } else {
          next.delete(alertId);
        }
      }

      return next;
    });
  }, []);

  const verifyAlerts = React.useCallback(
    async (alertsToVerify: PriceAlert[], showSuccessMessage = false) => {
      const activeAlertsToVerify = alertsToVerify.filter((alert) => alert.active);
      const alertIds = activeAlertsToVerify.map((alert) => alert.id);

      if (!user || !canUseAlerts || activeAlertsToVerify.length === 0) return [];

      setAlertsChecking(alertIds, true);
      setMessage('');

      try {
        const results = await checkAlertsIndividually(activeAlertsToVerify);

        mergeCheckResults(results);
        dispatchNotifications(results);

        if (showSuccessMessage) {
          const hits = results.filter((result) => result.triggered).length;
          const errors = results.filter((result) => result.alert.status === 'error').length;
          const noData = results.filter((result) => result.alert.status === 'no_data').length;

          if (hits > 0) {
            setMessage(`${hits} alerta(s) com alvo atingido.`);
          } else if (errors > 0) {
            setMessage(`Verificação concluída com ${errors} alerta(s) em erro. Os demais foram processados normalmente.`);
          } else if (noData > 0) {
            setMessage(`Verificação concluída. ${noData} alerta(s) sem dados para o item/local no momento.`);
          } else {
            setMessage('Verificação concluída. Nenhum alvo atingido agora.');
          }
        }

        return results;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível verificar os alertas.');
        return [];
      } finally {
        setAlertsChecking(alertIds, false);
      }
    },
    [canUseAlerts, dispatchNotifications, mergeCheckResults, setAlertsChecking, user],
  );

  React.useEffect(() => {
    let isActive = true;

    async function loadAlerts() {
      if (!user || !canUseAlerts) {
        setAlerts([]);
        setIsLoaded(true);
        return;
      }

      setIsLoaded(false);
      setMessage('');

      try {
        const nextAlerts = await listAlerts(user.id);

        if (!isActive) return;
        setAlerts(nextAlerts);
        setIsLoaded(true);
        void verifyAlerts(nextAlerts);
      } catch (error) {
        if (!isActive) return;
        setMessage(error instanceof Error ? error.message : 'Não foi possível carregar alertas.');
        setIsLoaded(true);
      }
    }

    void loadAlerts();

    return () => {
      isActive = false;
    };
  }, [canUseAlerts, user, verifyAlerts]);

  React.useEffect(() => {
    if (!canUseAlerts || !user || activeAlerts.length === 0) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void verifyAlerts(activeAlerts);
    }, AUTO_CHECK_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeAlerts, canUseAlerts, user, verifyAlerts]);

  React.useEffect(() => {
    if (!focusedAlertId || !isLoaded) return;

    const element = cardRefs.current[focusedAlertId];
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedAlertId(focusedAlertId);

    const timeoutId = window.setTimeout(() => setHighlightedAlertId(null), 3200);

    return () => window.clearTimeout(timeoutId);
  }, [focusedAlertId, isLoaded]);

  const pickItem = (item: ItemCatalogEntry) => {
    setForm((current) => ({
      ...current,
      itemName: getCatalogDisplayItemName(item),
      itemId: item.uniqueName,
    }));
  };

  const resetForm = () => {
    setEditingAlertId(null);
    setForm(createEmptyForm(user?.server ?? settings.defaultServer));
  };

  const saveAlert = async () => {
    if (!user || !canUseAlerts) return;

    const targetPrice = Number(form.targetPrice);

    if (!form.itemName.trim() || !form.itemId.trim()) {
      setMessage('Informe o item e selecione um resultado da busca.');
      return;
    }

    if (!form.server || !form.city) {
      setMessage('Informe servidor e cidade.');
      return;
    }

    if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
      setMessage('Preço alvo precisa ser maior que zero.');
      return;
    }

    if (hasReachedActiveLimit) {
      setMessage(`Limite de ${formatEntitlementLimit(maxAlerts)} alertas ativos atingido.`);
      return;
    }

    try {
      const payload: NewPriceAlertInput = {
        userId: user.id,
        itemId: form.itemId,
        itemName: form.itemName.trim(),
        server: form.server,
        city: form.city,
        condition: form.condition,
        targetPrice,
        active: form.active,
        browserNotificationEnabled: settings.browserNotificationsEnabled,
      };
      const savedAlert = editingAlertId
        ? await updateAlert(editingAlertId, payload)
        : await createAlert(payload);

      setAlerts((current) => {
        if (editingAlertId) {
          return current.map((alert) => (alert.id === savedAlert.id ? savedAlert : alert));
        }

        return [savedAlert, ...current];
      });
      resetForm();
      setMessage(editingAlertId ? 'Alerta atualizado.' : 'Alerta criado.');

      if (savedAlert.active) {
        void verifyAlerts([savedAlert]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o alerta.');
    }
  };

  const editAlert = (alert: PriceAlert) => {
    setEditingAlertId(alert.id);
    setForm({
      itemName: alert.itemName,
      itemId: alert.itemId,
      server: alert.server,
      city: alert.city,
      condition: alert.condition,
      targetPrice: String(alert.targetPrice),
      active: alert.active,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleAlert = async (alert: PriceAlert) => {
    if (!user || !canUseAlerts) return;

    if (!alert.active && Number.isFinite(maxAlerts) && activeAlerts.length >= maxAlerts) {
      setMessage(`Limite de ${formatEntitlementLimit(maxAlerts)} alertas ativos atingido.`);
      return;
    }

    try {
      const nextAlert = await updateAlert(alert.id, { active: !alert.active });
      setAlerts((current) => current.map((item) => (item.id === alert.id ? nextAlert : item)));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o alerta.');
    }
  };

  const removeAlert = async (alertId: string) => {
    try {
      await deleteAlert(alertId);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      if (editingAlertId === alertId) resetForm();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o alerta.');
    }
  };

  const updateAlertBrowserNotifications = async (enabled: boolean) => {
    if (alerts.length === 0) return;

    const updatedAlerts = await Promise.all(
      alerts.map((alert) =>
        updateAlert(alert.id, { browserNotificationEnabled: enabled }).catch(() => null),
      ),
    );
    const updatedById = new Map(
      updatedAlerts
        .filter((alert): alert is PriceAlert => Boolean(alert))
        .map((alert) => [alert.id, alert]),
    );

    setAlerts((current) =>
      current.map((alert) => updatedById.get(alert.id) ?? { ...alert, browserNotificationEnabled: enabled }),
    );
  };

  const enableBrowserNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setMessage('Seu navegador não suporta notificações.');
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      saveSettings({ ...settings, browserNotificationsEnabled: true });
      await updateAlertBrowserNotifications(true);
      setMessage('Notificações ativadas.');
      return;
    }

    saveSettings({ ...settings, browserNotificationsEnabled: false });
    await updateAlertBrowserNotifications(false);

    if (permission === 'denied') {
      setMessage('Permissão negada pelo navegador.');
      return;
    }

    setMessage('Permissão não concedida.');
  };

  if (!canUseAlerts) {
    return (
      <div className="space-y-6">
        <AlertsHeader
          activeCount={0}
          maxAlerts={maxAlerts}
          triggeredCount={0}
          browserNotificationsEnabled={false}
          isChecking={false}
          onCreateClick={() => undefined}
          onVerifyAll={() => undefined}
          onEnableNotifications={() => undefined}
          canUseAlerts={false}
        />
        <AlertExplanation isPro={false} />
        <FreeAlertsGate />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertsHeader
        activeCount={activeAlerts.length}
        maxAlerts={maxAlerts}
        triggeredCount={triggeredAlerts.length}
        browserNotificationsEnabled={settings.browserNotificationsEnabled}
        isChecking={isChecking}
        onCreateClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onVerifyAll={() => void verifyAlerts(alerts, true)}
        onEnableNotifications={() => void enableBrowserNotifications()}
        canUseAlerts
      />

      <AlertExplanation isPro />

      <BrowserNotificationPanel
        enabled={settings.browserNotificationsEnabled}
        onEnable={() => void enableBrowserNotifications()}
      />

      <section ref={formRef} className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-black text-white">{editingAlertId ? 'Editar alerta' : 'Criar alerta'}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Use a busca completa de itens, escolha cidade e defina o preço alvo.
            </p>
          </div>
          {editingAlertId ? (
            <button type="button" onClick={resetForm} className="secondary-button">
              Cancelar edição
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.35fr_0.75fr_0.75fr_0.9fr_0.7fr]">
          <div className="space-y-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <span className="sr-only">Item</span>
              <input
                value={form.itemName}
                onChange={(event) => setForm((current) => ({ ...current, itemName: event.target.value, itemId: '' }))}
                placeholder="Buscar item ou Item ID"
                className="field-control pl-9"
              />
            </label>
            {suggestions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((item) => (
                  <button
                    key={item.uniqueName}
                    type="button"
                    onClick={() => pickItem(item)}
                    className={cn(
                      'rounded-lg border border-border-subtle bg-zinc-950 p-2 text-left transition-colors hover:border-brand-primary/45',
                      form.itemId === item.uniqueName && 'border-brand-primary/60 bg-brand-primary/10',
                    )}
                  >
                    <p className="truncate text-sm font-black text-white">{getCatalogDisplayItemName(item)}</p>
                    <p className="truncate font-mono text-[11px] text-zinc-600">{item.uniqueName}</p>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <SelectField label="Servidor">
            <select
              value={form.server}
              onChange={(event) => setForm((current) => ({ ...current, server: event.target.value as ServerParam }))}
              className="field-control"
            >
              <option value="americas">Américas</option>
              <option value="europe">Europa</option>
            </select>
          </SelectField>

          <SelectField label="Cidade">
            <select
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value as AlbionCity }))}
              className="field-control"
            >
              {ALBION_CITIES.filter((city) => city !== 'Black Market').map((city) => (
                <option key={city} value={city}>{formatCityName(city)}</option>
              ))}
            </select>
          </SelectField>

          <SelectField label="Condição">
            <select
              value={form.condition}
              onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value as PriceAlertCondition }))}
              className="field-control"
            >
              <option value="below">Preço cair para ou abaixo de</option>
              <option value="above">Preço subir para ou acima de</option>
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {form.condition === 'below'
                ? 'Use para comprar quando o item ficar barato.'
                : 'Use para vender ou monitorar valorização.'}
            </p>
          </SelectField>

          <label className="space-y-2">
            <span className="field-label">Preço alvo</span>
            <input
              type="number"
              min={1}
              value={form.targetPrice}
              onChange={(event) => setForm((current) => ({ ...current, targetPrice: event.target.value }))}
              className="field-control"
              placeholder="118500"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-zinc-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              className="h-4 w-4 accent-brand-primary"
            />
            Ativo
          </label>
          <button type="button" onClick={() => void saveAlert()} disabled={hasReachedActiveLimit} className="primary-button">
            <Plus size={16} />
            {editingAlertId ? 'Salvar alterações' : 'Criar alerta'}
          </button>
          <button
            type="button"
            onClick={() => void verifyAlerts(alerts, true)}
            disabled={isChecking || activeAlerts.length === 0}
            className="secondary-button"
          >
            <RefreshCw className={isChecking ? 'animate-spin' : ''} size={16} />
            Verificar agora
          </button>
          <span className="text-xs text-zinc-500">
            Alertas externos, como Discord e e-mail, serão adicionados futuramente.
          </span>
        </div>

        {hasReachedActiveLimit ? (
          <p className="mt-3 text-sm font-bold text-status-warning">Limite de 50 alertas ativos atingido.</p>
        ) : null}
        {message ? <p className="mt-3 text-sm font-bold text-status-warning">{message}</p> : null}
      </section>

      {!isLoaded ? (
        <section className="rounded-lg border border-border-subtle bg-bg-card p-5 text-sm font-bold text-zinc-400">
          Carregando alertas...
        </section>
      ) : null}

      <section className="grid gap-3">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            isHighlighted={highlightedAlertId === alert.id}
            isChecking={checkingAlertIds.has(alert.id)}
            setRef={(element) => {
              cardRefs.current[alert.id] = element;
            }}
            onEdit={editAlert}
            onDelete={(alertId) => void removeAlert(alertId)}
            onToggle={(nextAlert) => void toggleAlert(nextAlert)}
            onCheck={(nextAlert) => void verifyAlerts([nextAlert], true)}
          />
        ))}

        {alerts.length === 0 && isLoaded ? (
          <div className="rounded-lg border border-border-subtle bg-bg-card p-8 text-center">
            <Bell className="mx-auto text-zinc-700" size={34} />
            <h2 className="mt-3 font-black text-white">Nenhum alerta criado</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              Crie um alerta para monitorar um item por cidade enquanto o site estiver aberto.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AlertsHeader({
  activeCount,
  maxAlerts,
  triggeredCount,
  browserNotificationsEnabled,
  isChecking,
  canUseAlerts,
  onCreateClick,
  onVerifyAll,
  onEnableNotifications,
}: {
  activeCount: number;
  maxAlerts: number;
  triggeredCount: number;
  browserNotificationsEnabled: boolean;
  isChecking: boolean;
  canUseAlerts: boolean;
  onCreateClick: () => void;
  onVerifyAll: () => void;
  onEnableNotifications: () => void;
}) {
  return (
    <header className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-xl md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <Badge variant="primary" className="gap-2">
            <Bell size={13} />
            PRO
          </Badge>
          <h1 className="mt-3 text-3xl font-black text-white">Alertas de Preço</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Monitore itens por cidade e receba avisos enquanto o site estiver aberto.
          </p>
          {browserNotificationsEnabled ? (
            <Badge variant="success" className="mt-3 gap-2">
              <CheckCircle2 size={13} />
              Notificações do navegador ativadas
            </Badge>
          ) : (
            <p className="mt-3 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-primary">
              Ative as notificações do navegador para receber pop-ups quando um alerta bater.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px]">
          <MiniCounter label="Alertas ativos" value={`${activeCount}/${formatEntitlementLimit(maxAlerts)}`} />
          <MiniCounter label="Alertas atingidos" value={triggeredCount} tone={triggeredCount > 0 ? 'warning' : undefined} />
          {canUseAlerts ? (
            <>
              <button type="button" onClick={onCreateClick} className="primary-button justify-center">
                <Plus size={16} />
                Criar alerta
              </button>
              <button type="button" onClick={onVerifyAll} disabled={isChecking || activeCount === 0} className="secondary-button justify-center">
                <RefreshCw className={isChecking ? 'animate-spin' : ''} size={16} />
                Verificar agora
              </button>
              <button type="button" onClick={onEnableNotifications} className="secondary-button justify-center sm:col-span-2">
                <BellRing size={16} />
                Ativar notificações do navegador
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function AlertExplanation({ isPro }: { isPro: boolean }) {
  return (
    <details className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-brand-primary">
        <Info size={18} />
        Como os alertas funcionam?
      </summary>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-zinc-300">
        Os alertas verificam os preços enquanto você está com o site aberto. Quando um item atinge o preço alvo definido, o Albion Market Radar mostra um aviso dentro do site e, se você permitir, também envia uma notificação do navegador.
      </p>
      <ul className="mt-3 grid gap-2 text-sm text-zinc-400 md:grid-cols-2">
        <li>O alerta é privado e só aparece para você.</li>
        <li>A verificação acontece ao abrir a aba Alertas, ao clicar em &quot;Verificar agora&quot; e automaticamente enquanto o site estiver aberto.</li>
        <li>As notificações do navegador funcionam apenas se você ativar a permissão no navegador.</li>
        <li>Nesta versão, os alertas não funcionam com o site totalmente fechado.</li>
        <li>Alertas em segundo plano, Discord e e-mail serão adicionados futuramente.</li>
        <li>Os preços vêm de dados públicos e podem mudar dentro do jogo. Confira sempre antes de comprar ou transportar.</li>
      </ul>
      <p className="mt-3 text-sm font-bold text-status-warning">
        {isPro ? 'Você pode criar até 50 alertas ativos.' : 'Alertas são um recurso PRO. Usuários Free podem visualizar esta explicação, mas não podem criar alertas.'}
      </p>
    </details>
  );
}

function BrowserNotificationPanel({
  enabled,
  onEnable,
}: {
  enabled: boolean;
  onEnable: () => void;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-black text-white">Notificações do navegador</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Receba um pop-up do navegador quando um alerta bater enquanto o site estiver aberto.
          </p>
          <p className="mt-2 text-xs font-bold text-status-warning">
            As notificações do navegador funcionam enquanto o site estiver aberto. Alertas em segundo plano serão adicionados futuramente.
          </p>
        </div>
        <button type="button" onClick={onEnable} className="secondary-button justify-center">
          <BellRing size={16} />
          {enabled ? 'Notificações ativadas' : 'Ativar notificações'}
        </button>
      </div>
    </section>
  );
}

function FreeAlertsGate() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <Badge variant="primary" className="gap-2">
          <Bell size={13} />
          PRO
        </Badge>
        <h2 className="mt-3 text-3xl font-black text-white">Alertas de Preço</h2>
        <p className="mt-3 max-w-3xl text-base font-bold leading-relaxed text-zinc-200">
          Receba avisos quando um item atingir o preço desejado em uma cidade e servidor.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {FREE_ALERT_CARDS.map((card) => (
          <article key={card.title} className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
            <div className="mb-3 inline-flex rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
              <card.icon size={19} />
            </div>
            <h3 className="font-black text-white">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{card.description}</p>
          </article>
        ))}
      </section>

      <ProGate
        title="Desbloquear Alertas PRO"
        description="Crie alertas privados de preço e receba notificações enquanto o site estiver aberto."
        ctaLabel="Desbloquear Alertas PRO"
      />
    </div>
  );
}

function AlertCard({
  alert,
  isHighlighted,
  isChecking,
  setRef,
  onEdit,
  onDelete,
  onToggle,
  onCheck,
}: {
  alert: PriceAlert;
  isHighlighted: boolean;
  isChecking: boolean;
  setRef: (element: HTMLElement | null) => void;
  onEdit: (alert: PriceAlert) => void;
  onDelete: (alertId: string) => void;
  onToggle: (alert: PriceAlert) => void;
  onCheck: (alert: PriceAlert) => void;
}) {
  const isTriggered = alert.status === 'triggered';

  return (
    <article
      ref={setRef}
      className={cn(
        'rounded-lg border bg-bg-card p-4 shadow-xl transition-colors',
        isTriggered ? 'border-status-warning/55 bg-status-warning/10' : 'border-border-subtle',
        isHighlighted && 'ring-2 ring-brand-primary',
      )}
    >
      <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-black text-white">{alert.itemName}</h2>
            <Badge variant={statusVariant(alert.status)}>{statusLabel(alert.status)}</Badge>
            <Badge variant={alert.active ? 'success' : 'muted'}>{alert.active ? 'Ativo' : 'Inativo'}</Badge>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">{alert.itemId}</p>
        </div>
        <MiniLine label="Local" value={`${formatCityName(alert.city)} · ${formatServerName(serverParamToRegion(alert.server))}`} />
        <MiniLine label="Condição" value={conditionLabel(alert.condition)} />
        <MiniLine label="Preço alvo" value={formatSilver(alert.targetPrice)} tone="brand" />
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" onClick={() => onCheck(alert)} disabled={isChecking || !alert.active} className="secondary-button">
            <RefreshCw className={isChecking ? 'animate-spin' : ''} size={15} />
            Verificar
          </button>
          <button type="button" onClick={() => onEdit(alert)} className="secondary-button">
            <Edit3 size={15} />
            Editar
          </button>
          <button type="button" onClick={() => onToggle(alert)} className="secondary-button">
            {alert.active ? 'Pausar' : 'Ativar'}
          </button>
          <button type="button" onClick={() => onDelete(alert.id)} className="danger-button" aria-label="Excluir alerta">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-border-subtle bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-300">
        {formatAlertRule(alert)}
      </p>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MiniLine
          label="Preço atual"
          value={formatAlertCurrentPrice(alert)}
          tone={isTriggered ? 'success' : undefined}
        />
        <MiniLine
          label="Última verificação"
          value={alert.lastCheckedAt ? <RelativeTime date={alert.lastCheckedAt} /> : 'Ainda não verificado'}
        />
        <MiniLine
          label="Último disparo"
          value={alert.lastTriggeredAt ? <RelativeTime date={alert.lastTriggeredAt} /> : 'Não disparou'}
        />
      </div>
    </article>
  );
}

function MiniCounter({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warning' }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-black text-brand-primary', tone === 'warning' && 'text-status-warning')}>{value}</p>
    </div>
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

function MiniLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'brand' | 'success';
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-zinc-950 p-3">
      <p className="text-[11px] font-bold uppercase text-zinc-500">{label}</p>
      <p className={cn('mt-1 break-words font-black text-white', tone === 'brand' && 'text-brand-primary', tone === 'success' && 'text-status-success')}>
        {value}
      </p>
    </div>
  );
}

function statusVariant(status: PriceAlert['status']): 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'triggered') return 'success';
  if (status === 'no_data') return 'warning';
  if (status === 'error') return 'danger';

  return 'muted';
}

function formatAlertRule(alert: PriceAlert): string {
  return `Regra: ${conditionLabel(alert.condition)} ${formatSilver(alert.targetPrice)}`;
}

function formatAlertCurrentPrice(alert: PriceAlert): string {
  if (alert.lastPrice && Number.isFinite(alert.lastPrice)) return formatSilver(alert.lastPrice);
  if (alert.status === 'no_data') return 'Sem dados para este item/local no momento';
  if (alert.status === 'error') return 'Erro ao verificar este alerta';

  return 'Aguardando verificação';
}
