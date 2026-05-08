'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn, formatCityName, formatSilver } from '@/lib/utils';
import { isActiveProProfile } from '@/src/lib/entitlements';
import { listAlerts, type PriceAlert } from '@/src/services/alertsService';

type AlertToast = {
  id: string;
  alertId: string;
  message: string;
};

type AlertsContextValue = {
  triggeredAlertCount: number;
  setTriggeredAlertCount: (count: number) => void;
  notifyAlertTriggered: (alert: PriceAlert, currentPrice?: number) => void;
};

const AlertsContext = React.createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [triggeredAlertCount, setTriggeredAlertCount] = React.useState(0);
  const [toasts, setToasts] = React.useState<AlertToast[]>([]);

  React.useEffect(() => {
    let isActive = true;

    async function loadTriggeredCount() {
      if (!user || !isActiveProProfile(user)) {
        setTriggeredAlertCount(0);
        return;
      }

      try {
        const alerts = await listAlerts(user.id);

        if (!isActive) return;
        setTriggeredAlertCount(alerts.filter((alert) => alert.active && alert.status === 'triggered').length);
      } catch {
        if (isActive) setTriggeredAlertCount(0);
      }
    }

    void loadTriggeredCount();

    return () => {
      isActive = false;
    };
  }, [user]);

  const removeToast = React.useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notifyAlertTriggered = React.useCallback((alert: PriceAlert, currentPrice?: number) => {
    const toastId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `alert-${alert.id}-${Date.now()}`;
    const priceText = currentPrice ? formatSilver(currentPrice) : 'o preço alvo';

    setToasts((current) => [
      ...current,
      {
        id: toastId,
        alertId: alert.id,
        message: `🚨 Alerta atingido: ${alert.itemName} em ${formatCityName(alert.city)} chegou a ${priceText}.`,
      },
    ]);

    window.setTimeout(() => removeToast(toastId), 9000);
  }, [removeToast]);

  const value = React.useMemo(
    () => ({
      triggeredAlertCount,
      setTriggeredAlertCount,
      notifyAlertTriggered,
    }),
    [notifyAlertTriggered, triggeredAlertCount],
  );

  return (
    <AlertsContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] grid w-[min(380px,calc(100vw-2rem))] gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="rounded-lg border border-brand-primary/35 bg-zinc-950 p-4 text-sm shadow-2xl"
            role="status"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md border border-brand-primary/30 bg-brand-primary/10 p-2 text-brand-primary">
                <BellRing size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-white">{toast.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/alerts?alert=${toast.alertId}`);
                      removeToast(toast.id);
                    }}
                    className="primary-button h-9 px-3 text-xs"
                  >
                    Ver alerta
                  </button>
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className={cn('secondary-button h-9 px-3 text-xs')}
                  >
                    Fechar
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-zinc-500 transition-colors hover:text-white"
                aria-label="Fechar notificação"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = React.useContext(AlertsContext);

  if (!context) {
    throw new Error('useAlerts deve ser usado dentro de AlertsProvider.');
  }

  return context;
}
