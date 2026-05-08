import { fetchItemPrices } from '@/services/albionMarket';
import { ensureSupabaseClient } from '@/src/lib/supabase/database';
import { serverParamToRegion } from '@/lib/settingsStorage';
import type { AlbionCity, ServerParam } from '@/types/albion';

export const ALERT_COOLDOWN_MINUTES = 30;
export const ALERT_COOLDOWN_MS = ALERT_COOLDOWN_MINUTES * 60 * 1000;

export type PriceAlertCondition = 'below' | 'above';
export type PriceAlertStatus = 'waiting' | 'triggered' | 'no_data' | 'error';

export type PriceAlert = {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  server: ServerParam;
  city: AlbionCity;
  targetPrice: number;
  condition: PriceAlertCondition;
  active: boolean;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
  lastPrice?: number;
  status: PriceAlertStatus;
  browserNotificationEnabled: boolean;
  createdAt: string;
};

export type NewPriceAlertInput = {
  userId: string;
  itemId: string;
  itemName: string;
  server: ServerParam;
  city: AlbionCity;
  targetPrice: number;
  condition: PriceAlertCondition;
  active: boolean;
  browserNotificationEnabled?: boolean;
};

export type UpdatePriceAlertInput = Partial<
  Pick<
    PriceAlert,
    | 'itemId'
    | 'itemName'
    | 'server'
    | 'city'
    | 'targetPrice'
    | 'condition'
    | 'active'
    | 'lastCheckedAt'
    | 'lastTriggeredAt'
    | 'status'
    | 'browserNotificationEnabled'
  >
> & {
  lastPrice?: number | null;
};

export type PriceAlertCheckResult = {
  alert: PriceAlert;
  triggered: boolean;
  shouldNotify: boolean;
  currentPrice?: number;
  checkedAt: string;
  message: string;
};

type PriceAlertRow = {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  server: ServerParam;
  city: AlbionCity | null;
  target_price: number | string;
  condition: PriceAlertCondition | 'less_than' | 'greater_than';
  active: boolean | null;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  last_price: number | string | null;
  status: PriceAlertStatus | 'hit' | 'not_checked' | null;
  browser_notification_enabled: boolean | null;
  created_at: string;
};

export async function listAlerts(userId: string): Promise<PriceAlert[]> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as PriceAlertRow[]).map(rowToPriceAlert);
}

export async function createAlert(input: NewPriceAlertInput): Promise<PriceAlert> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('price_alerts')
    .insert(priceAlertToRow(input))
    .select('*')
    .single();

  if (error) throw error;

  return rowToPriceAlert(data as PriceAlertRow);
}

export async function updateAlert(alertId: string, input: UpdatePriceAlertInput): Promise<PriceAlert> {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from('price_alerts')
    .update(priceAlertPatchToRow(input))
    .eq('id', alertId)
    .select('*')
    .single();

  if (error) throw error;

  return rowToPriceAlert(data as PriceAlertRow);
}

export async function deleteAlert(alertId: string): Promise<void> {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from('price_alerts').delete().eq('id', alertId);

  if (error) throw error;
}

export async function checkAlert(alert: PriceAlert): Promise<PriceAlertCheckResult> {
  const checkedAt = new Date().toISOString();

  if (!alert.active) {
    return {
      alert,
      triggered: false,
      shouldNotify: false,
      checkedAt,
      message: 'Alerta inativo.',
    };
  }

  try {
    const item = await fetchItemPrices(alert.itemId, serverParamToRegion(alert.server));
    const cityPrice = item?.prices.find((price) => price.city === alert.city);
    const currentPrice = cityPrice?.sellPriceMin;

    if (!Number.isFinite(currentPrice) || !currentPrice || currentPrice <= 0) {
      const nextAlert = await persistAlertCheckUpdate(alert, {
        lastCheckedAt: checkedAt,
        lastPrice: null,
        status: 'no_data',
      });

      return {
        alert: nextAlert,
        triggered: false,
        shouldNotify: false,
        checkedAt,
        message: 'Sem dados para este item/local no momento.',
      };
    }

    const triggered =
      alert.condition === 'below'
        ? currentPrice <= alert.targetPrice
        : currentPrice >= alert.targetPrice;
    const inCooldown = isAlertInCooldown(alert.lastTriggeredAt);
    const shouldNotify = triggered && !inCooldown;
    const nextStatus: PriceAlertStatus = triggered ? 'triggered' : 'waiting';
    const nextAlert = await persistAlertCheckUpdate(alert, {
      lastCheckedAt: checkedAt,
      lastPrice: currentPrice,
      status: nextStatus,
      ...(shouldNotify ? { lastTriggeredAt: checkedAt } : {}),
    });

    return {
      alert: nextAlert,
      triggered,
      shouldNotify,
      currentPrice,
      checkedAt,
      message: triggered ? 'Alvo atingido.' : 'Aguardando.',
    };
  } catch {
    const nextAlert = await persistAlertCheckUpdate(alert, {
      lastCheckedAt: checkedAt,
      status: 'error',
    });

    return {
      alert: nextAlert,
      triggered: false,
      shouldNotify: false,
      checkedAt,
      message: 'Erro ao verificar.',
    };
  }
}

export async function checkAlertsIndividually(alerts: PriceAlert[]): Promise<PriceAlertCheckResult[]> {
  return Promise.all(
    alerts.map(async (alert) => {
      try {
        return await checkAlert(alert);
      } catch {
        const checkedAt = new Date().toISOString();

        return {
          alert: applyAlertPatch(alert, {
            lastCheckedAt: checkedAt,
            status: 'error',
          }),
          triggered: false,
          shouldNotify: false,
          checkedAt,
          message: 'Erro ao verificar.',
        };
      }
    }),
  );
}

export async function checkAllUserAlerts(userId: string): Promise<PriceAlertCheckResult[]> {
  const alerts = (await listAlerts(userId)).filter((alert) => alert.active);

  return checkAlertsIndividually(alerts);
}

export function isAlertInCooldown(lastTriggeredAt?: string): boolean {
  if (!lastTriggeredAt) return false;

  return Date.now() - new Date(lastTriggeredAt).getTime() < ALERT_COOLDOWN_MS;
}

export function conditionLabel(condition: PriceAlertCondition): string {
  return condition === 'below' ? 'Preço cair para ou abaixo de' : 'Preço subir para ou acima de';
}

export function statusLabel(status: PriceAlertStatus): string {
  if (status === 'triggered') return 'Alvo atingido';
  if (status === 'no_data') return 'Sem dados';
  if (status === 'error') return 'Erro ao verificar';

  return 'Aguardando';
}

function rowToPriceAlert(row: PriceAlertRow): PriceAlert {
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    itemName: row.item_name,
    server: row.server === 'europe' ? 'europe' : 'americas',
    city: row.city ?? 'Caerleon',
    targetPrice: Number(row.target_price),
    condition: normalizeCondition(row.condition),
    active: row.active !== false,
    lastCheckedAt: row.last_checked_at ?? undefined,
    lastTriggeredAt: row.last_triggered_at ?? undefined,
    lastPrice: toOptionalPrice(row.last_price),
    status: normalizeStatus(row.status),
    browserNotificationEnabled: row.browser_notification_enabled === true,
    createdAt: row.created_at,
  };
}

async function persistAlertCheckUpdate(alert: PriceAlert, input: UpdatePriceAlertInput): Promise<PriceAlert> {
  try {
    return await updateAlert(alert.id, input);
  } catch {
    return applyAlertPatch(alert, input);
  }
}

function applyAlertPatch(alert: PriceAlert, input: UpdatePriceAlertInput): PriceAlert {
  return {
    ...alert,
    ...(input.itemId !== undefined ? { itemId: input.itemId } : {}),
    ...(input.itemName !== undefined ? { itemName: input.itemName } : {}),
    ...(input.server !== undefined ? { server: input.server } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.targetPrice !== undefined ? { targetPrice: input.targetPrice } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.lastCheckedAt !== undefined ? { lastCheckedAt: input.lastCheckedAt } : {}),
    ...(input.lastTriggeredAt !== undefined ? { lastTriggeredAt: input.lastTriggeredAt } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.browserNotificationEnabled !== undefined
      ? { browserNotificationEnabled: input.browserNotificationEnabled }
      : {}),
    lastPrice:
      input.lastPrice === undefined
        ? alert.lastPrice
        : toOptionalPrice(input.lastPrice),
  };
}

function priceAlertToRow(input: NewPriceAlertInput) {
  return {
    user_id: input.userId,
    item_id: input.itemId,
    item_name: input.itemName,
    server: input.server,
    city: input.city,
    target_price: input.targetPrice,
    condition: input.condition,
    active: input.active,
    status: 'waiting',
    browser_notification_enabled: input.browserNotificationEnabled ?? false,
  };
}

function priceAlertPatchToRow(input: UpdatePriceAlertInput) {
  return {
    ...(input.itemId !== undefined ? { item_id: input.itemId } : {}),
    ...(input.itemName !== undefined ? { item_name: input.itemName } : {}),
    ...(input.server !== undefined ? { server: input.server } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.targetPrice !== undefined ? { target_price: input.targetPrice } : {}),
    ...(input.condition !== undefined ? { condition: input.condition } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.lastCheckedAt !== undefined ? { last_checked_at: input.lastCheckedAt } : {}),
    ...(input.lastTriggeredAt !== undefined ? { last_triggered_at: input.lastTriggeredAt } : {}),
    ...(input.lastPrice !== undefined ? { last_price: input.lastPrice ?? null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.browserNotificationEnabled !== undefined
      ? { browser_notification_enabled: input.browserNotificationEnabled }
      : {}),
  };
}

function normalizeCondition(condition: PriceAlertRow['condition']): PriceAlertCondition {
  if (condition === 'above' || condition === 'greater_than') return 'above';

  return 'below';
}

function normalizeStatus(status: PriceAlertRow['status']): PriceAlertStatus {
  if (status === 'triggered' || status === 'hit') return 'triggered';
  if (status === 'no_data') return 'no_data';
  if (status === 'error') return 'error';

  return 'waiting';
}

function toOptionalPrice(value: number | string | null | undefined): number | undefined {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}
