'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Crown,
  Download,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Sword,
  Wallet,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { isUserPro } from '@/src/lib/entitlements';
import { getBrowserSupabase } from '@/src/lib/supabase/client';
import type { SubscriptionStatus } from '@/types/albion';

export const PRO_PRICE_LABEL = 'R$ 10/mês';

const proBenefits = [
  { label: 'Radar de Oportunidades exclusivo', icon: Zap },
  { label: 'Alertas de Preço', icon: Bell },
  { label: 'Mais itens analisados', icon: ShieldCheck },
  { label: 'Filtros avançados', icon: LockKeyhole },
  { label: 'Exportação CSV', icon: Download },
  { label: 'Carteira ilimitada', icon: Wallet },
  { label: 'Relatórios de lucro', icon: FileText },
  { label: 'Regear salvo', icon: ShieldCheck },
  { label: '20 anúncios de Armas .4', icon: Sword },
];

const comparisonRows = [
  ['Busca de itens', 'Catálogo completo incluído', 'Catálogo completo incluído'],
  ['Buscar preços', 'Incluída', 'Incluída'],
  ['Oportunidades', 'Bloqueado', 'Radar real exclusivo'],
  ['Alertas de Preço', 'Bloqueado', '50 alertas ativos'],
  ['Exportação CSV', 'Não', 'Oportunidades e carteira'],
  ['Carteira', '50 operações', 'Ilimitada com relatórios'],
  ['Regear salvo', '1 build', '20 builds'],
  ['Filtros salvos', '1 filtro', '20 filtros'],
  ['Anúncios de Armas .4', '3 ativos', '20 ativos'],
];

const statusLabels: Record<SubscriptionStatus, string> = {
  free: 'Free',
  active: 'Ativa',
  trialing: 'Teste ativo',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
  unpaid: 'Não paga',
  incomplete: 'Incompleta',
  incomplete_expired: 'Expirada',
  inactive: 'Inativa',
  paused: 'Pausada',
};

export default function ProPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isPro = isUserPro(user);
  const isPastDue = user?.subscriptionStatus === 'past_due';
  const isCancelingAtPeriodEnd = user?.subscriptionCancelAtPeriodEnd === true;
  const cancelAt = user?.subscriptionCancelAt ?? user?.subscriptionCurrentPeriodEnd;
  const checkoutState = searchParams.get('checkout');
  const [message, setMessage] = React.useState('');
  const [checkoutNotice, setCheckoutNotice] = React.useState<'success' | 'cancelled' | null>(
    checkoutState === 'success' || checkoutState === 'cancelled' ? checkoutState : null,
  );
  const [busyAction, setBusyAction] = React.useState<'checkout' | 'portal' | null>(null);
  const [showPortalCta, setShowPortalCta] = React.useState(false);
  const previousUserId = React.useRef<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (checkoutState !== 'success' && checkoutState !== 'cancelled') return;

    router.replace('/pro', { scroll: false });
  }, [checkoutState, router]);

  React.useEffect(() => {
    if (!checkoutNotice) return;

    const timer = window.setTimeout(() => {
      setCheckoutNotice(null);
    }, 6500);

    return () => window.clearTimeout(timer);
  }, [checkoutNotice]);

  React.useEffect(() => {
    const currentUserId = user?.id ?? null;

    if (previousUserId.current === undefined) {
      previousUserId.current = currentUserId;
      return;
    }

    if (previousUserId.current !== currentUserId) {
      window.setTimeout(() => {
        setCheckoutNotice(null);
        setShowPortalCta(false);
      }, 0);
      previousUserId.current = currentUserId;
    }
  }, [user?.id]);

  const startCheckout = async () => {
    setBusyAction('checkout');
    setMessage('');
    setShowPortalCta(false);

    try {
      const token = await getCurrentAccessToken();

      if (!token) {
        setMessage('Não foi possível validar sua sessão. Faça login novamente.');
        return;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
        action?: 'customer_portal';
      } | null;

      if (!response.ok || !payload?.url) {
        if (payload?.action === 'customer_portal') {
          setMessage(payload.error ?? 'Você já possui uma assinatura ativa.');
          setShowPortalCta(Boolean(user?.stripeCustomerId));
          return;
        }

        setMessage(payload?.error ?? 'Não foi possível abrir o checkout. Tente novamente.');
        return;
      }

      window.location.href = payload.url;
    } catch {
      setMessage('Não foi possível abrir o checkout. Tente novamente.');
    } finally {
      setBusyAction(null);
    }
  };

  const openCustomerPortal = async () => {
    setBusyAction('portal');
    setMessage('');

    try {
      const token = await getCurrentAccessToken();

      if (!token) {
        setMessage('Não foi possível validar sua sessão. Faça login novamente.');
        return;
      }

      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !payload?.url) {
        setMessage(payload?.error ?? 'Não foi possível abrir o portal da assinatura.');
        return;
      }

      window.location.href = payload.url;
    } catch {
      setMessage('Não foi possível abrir o portal da assinatura.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-5" data-pro-price-label={PRO_PRICE_LABEL}>
      {checkoutNotice === 'success' ? (
        <Notice tone="success" message="Pagamento concluído. Seu PRO será ativado em instantes." />
      ) : null}
      {checkoutNotice === 'cancelled' ? (
        <Notice tone="warning" message="Pagamento cancelado. Nenhuma cobrança foi feita." />
      ) : null}
      {message ? <Notice tone="warning" message={message} /> : null}

      <section className="rounded-lg border border-brand-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.15),transparent_32%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="primary" className="gap-2">
              <Crown size={13} />
              {isPro ? 'PRO ativo' : 'PRO mensal'}
            </Badge>
            <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">Albion Market Radar PRO</h1>
            <p className="mt-2 max-w-3xl text-base font-bold text-zinc-200">
              Radar de Oportunidades, Alertas de Preço e ferramentas avançadas para traders.
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              O PRO libera ferramentas de análise e organização. O Albion Market Radar não vende prata, itens, contas ou vantagens dentro do jogo.
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-zinc-950/70 p-4 text-sm lg:min-w-72">
            {isPro ? (
              <ProSubscriptionPanel
                status={user?.subscriptionStatus}
                periodEnd={user?.subscriptionCurrentPeriodEnd}
                stripeCustomerId={user?.stripeCustomerId}
                cancelAtPeriodEnd={isCancelingAtPeriodEnd}
                cancelAt={cancelAt}
                isPastDue={isPastDue}
                busy={busyAction === 'portal'}
                onManage={() => void openCustomerPortal()}
              />
            ) : (
              <FreeSubscriptionPanel
                busy={busyAction === 'checkout'}
                portalBusy={busyAction === 'portal'}
                showPortalCta={showPortalCta && Boolean(user?.stripeCustomerId)}
                onCheckout={() => void startCheckout()}
                onManage={() => void openCustomerPortal()}
              />
            )}
          </div>
        </div>
      </section>

      {isPastDue ? (
        <Notice
          tone="warning"
          message="Houve um problema com o pagamento. Atualize sua forma de pagamento para evitar perda de acesso."
        />
      ) : null}

      <section className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 shadow-xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Benefícios PRO</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {isPro ? 'Recursos disponíveis na sua conta.' : 'Assine por R$ 10,00 por mês e desbloqueie o radar completo.'}
            </p>
          </div>
          {isPro ? <Badge variant="success">Você está no PRO</Badge> : <Badge variant="primary">{PRO_PRICE_LABEL}</Badge>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {proBenefits.map((benefit) => (
            <div key={benefit.label} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-zinc-950/70 px-3 py-2">
              <benefit.icon className="shrink-0 text-brand-primary" size={16} />
              <span className="text-sm font-bold text-zinc-200">{benefit.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card shadow-xl">
        <div className="border-b border-border-subtle p-4">
          <h2 className="text-xl font-black text-white">Free x PRO</h2>
          <p className="mt-1 text-sm text-zinc-500">Comparativo compacto dos limites e ferramentas.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-zinc-950/70">
                <th className="px-4 py-3 text-xs font-bold uppercase text-zinc-500">Recurso</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-zinc-500">Free</th>
                <th className="px-4 py-3 text-xs font-bold uppercase text-brand-primary">PRO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/70">
              {comparisonRows.map(([feature, free, pro]) => (
                <tr key={feature} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-3 text-sm font-black text-white">{feature}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{free}</td>
                  <td className="px-4 py-3 text-sm font-bold text-zinc-200">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function getCurrentAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();

  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();

  return data.session?.access_token ?? null;
}

function FreeSubscriptionPanel({
  busy,
  portalBusy,
  showPortalCta,
  onCheckout,
  onManage,
}: {
  busy: boolean;
  portalBusy: boolean;
  showPortalCta: boolean;
  onCheckout: () => void;
  onManage: () => void;
}) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Plano PRO</p>
      <p className="mt-1 text-3xl font-black text-white">{PRO_PRICE_LABEL}</p>
      <p className="mt-1 text-xs text-zinc-500">Assinatura mensal recorrente via Stripe.</p>
      <button
        type="button"
        onClick={onCheckout}
        disabled={busy}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy ? 'Abrindo Stripe...' : 'Assinar PRO'}
      </button>
      {showPortalCta ? (
        <button
          type="button"
          onClick={onManage}
          disabled={portalBusy}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-border-subtle bg-zinc-900 px-4 text-sm font-black text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {portalBusy ? 'Abrindo portal...' : 'Gerenciar assinatura'}
        </button>
      ) : null}
    </>
  );
}

function ProSubscriptionPanel({
  status,
  periodEnd,
  stripeCustomerId,
  cancelAtPeriodEnd,
  cancelAt,
  isPastDue,
  busy,
  onManage,
}: {
  status?: SubscriptionStatus;
  periodEnd?: string;
  stripeCustomerId?: string;
  cancelAtPeriodEnd: boolean;
  cancelAt?: string;
  isPastDue: boolean;
  busy: boolean;
  onManage: () => void;
}) {
  const accessUntil = cancelAt ?? periodEnd;

  return (
    <>
      <div className="flex items-center gap-2 font-black text-status-success">
        <CheckCircle2 size={18} />
        {cancelAtPeriodEnd && accessUntil ? `PRO ativo até ${formatLongDate(accessUntil)}` : 'Você está no PRO'}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-zinc-400">
        <p>
          Status:{' '}
          <span className={cn('font-black text-white', isPastDue && 'text-status-warning')}>
            {statusLabels[status ?? 'active']}
          </span>
        </p>
        {cancelAtPeriodEnd && accessUntil ? (
          <p className="rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 font-bold text-status-warning">
            Sua assinatura foi cancelada e ficará ativa até {formatLongDate(accessUntil)}.
            <span className="mt-1 block text-zinc-300">Você não será cobrado novamente após essa data.</span>
          </p>
        ) : null}
        {periodEnd && !cancelAtPeriodEnd ? (
          <p>
            Próxima renovação: <span className="font-black text-white">{formatDate(periodEnd)}</span>
          </p>
        ) : null}
      </div>
      {stripeCustomerId ? (
        <button
          type="button"
          onClick={onManage}
          disabled={busy}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? 'Abrindo portal...' : 'Gerenciar assinatura'}
        </button>
      ) : (
        <p className="mt-3 rounded-lg border border-status-warning/25 bg-status-warning/10 p-3 text-xs font-bold text-status-warning">
          PRO ativo sem assinatura Stripe vinculada.
        </p>
      )}
    </>
  );
}

function Notice({ message, tone }: { message: string; tone: 'success' | 'warning' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-sm font-bold',
        tone === 'success'
          ? 'border-status-success/25 bg-status-success/10 text-status-success'
          : 'border-status-warning/25 bg-status-warning/10 text-status-warning',
      )}
    >
      {tone === 'success' ? <CheckCircle2 className="mt-0.5 shrink-0" size={20} /> : <AlertTriangle className="mt-0.5 shrink-0" size={20} />}
      <p>{message}</p>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
