'use client';

import React from 'react';
import { AlertCircle, RefreshCw, ShieldCheck, TicketPercent, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type PartnerSummary = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  promotion_code: string;
  active: boolean;
  commission_type: string | null;
  commission_value: number | null;
  created_at: string;
  updated_at: string;
  totalUses: number;
  activeSubscriptions: number;
  revenueTotal: number;
  discountTotal: number;
  lastUse: string | null;
};

type RecentRedemption = {
  id: string;
  createdAt: string;
  userId: string | null;
  email: string | null;
  promotionCode: string;
  streamerName: string;
  amountSubtotal: number;
  amountTotal: number;
  amountDiscount: number;
  currency: string;
  status: string;
};

type PartnersResponse = {
  partners: PartnerSummary[];
  recentRedemptions: RecentRedemption[];
};

export default function AdminPartnersPage() {
  const [data, setData] = React.useState<PartnersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setData(await fetchPartnersData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar parceiros.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const payload = await fetchPartnersData();
        if (!isMounted) return;
        setData(payload);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar parceiros.');
        setData(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = React.useMemo(() => {
    const partners = data?.partners ?? [];

    return partners.reduce(
      (acc, partner) => ({
        uses: acc.uses + partner.totalUses,
        activeSubscriptions: acc.activeSubscriptions + partner.activeSubscriptions,
        revenue: acc.revenue + partner.revenueTotal,
        discount: acc.discount + partner.discountTotal,
      }),
      { uses: 0, activeSubscriptions: 0, revenue: 0, discount: 0 },
    );
  }, [data?.partners]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="primary" className="gap-2">
              <ShieldCheck size={13} />
              Admin
            </Badge>
            <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">Parceiros e Cupons</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Atribuição de assinaturas PRO por códigos promocionais cadastrados na Stripe.
            </p>
          </div>
          <button type="button" onClick={loadData} className="secondary-button justify-center" disabled={loading}>
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-4 text-status-danger">
          <div className="flex items-center gap-2 font-black">
            <AlertCircle size={18} />
            Acesso indisponível
          </div>
          <p className="mt-2 text-sm font-bold">{error}</p>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={TicketPercent} label="Usos totais" value={formatNumber(totals.uses)} />
        <MetricCard icon={Users} label="Assinaturas ativas" value={formatNumber(totals.activeSubscriptions)} />
        <MetricCard icon={TicketPercent} label="Receita paga" value={formatMoney(totals.revenue)} />
        <MetricCard icon={TicketPercent} label="Desconto concedido" value={formatMoney(totals.discount)} />
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card shadow-xl">
        <div className="border-b border-border-subtle p-4">
          <h2 className="font-black text-white">Desempenho dos streamers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-zinc-950/70 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Usos</th>
                <th className="px-4 py-3">Ativas</th>
                <th className="px-4 py-3">Receita</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Último uso</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? <TableLoading colSpan={8} /> : null}
              {!loading && data?.partners.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-zinc-500">
                    Nenhum parceiro cadastrado.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? data?.partners.map((partner) => (
                    <tr key={partner.id} className="text-zinc-300">
                      <td className="px-4 py-3">
                        <p className="font-black text-white">{partner.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{partner.email ?? partner.slug}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-brand-primary">{partner.promotion_code}</td>
                      <td className="px-4 py-3 font-bold">{formatNumber(partner.totalUses)}</td>
                      <td className="px-4 py-3 font-bold">{formatNumber(partner.activeSubscriptions)}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(partner.revenueTotal)}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(partner.discountTotal)}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDate(partner.lastUse)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={partner.active ? 'success' : 'muted'}>
                          {partner.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card shadow-xl">
        <div className="border-b border-border-subtle p-4">
          <h2 className="font-black text-white">Usos recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-subtle text-sm">
            <thead className="bg-zinc-950/70 text-left text-[11px] font-black uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Streamer</th>
                <th className="px-4 py-3">Valor original</th>
                <th className="px-4 py-3">Desconto</th>
                <th className="px-4 py-3">Valor pago</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? <TableLoading colSpan={8} /> : null}
              {!loading && data?.recentRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-zinc-500">
                    Nenhum uso registrado.
                  </td>
                </tr>
              ) : null}
              {!loading
                ? data?.recentRedemptions.map((redemption) => (
                    <tr key={redemption.id} className="text-zinc-300">
                      <td className="px-4 py-3 text-zinc-400">{formatDate(redemption.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-white">{redemption.email ?? 'Sem e-mail'}</p>
                        <p className="mt-1 max-w-40 truncate text-xs text-zinc-500">{redemption.userId ?? 'Sem usuário'}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-brand-primary">{redemption.promotionCode}</td>
                      <td className="px-4 py-3 font-bold">{redemption.streamerName}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(redemption.amountSubtotal, redemption.currency)}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(redemption.amountDiscount, redemption.currency)}</td>
                      <td className="px-4 py-3 font-bold">{formatMoney(redemption.amountTotal, redemption.currency)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={redemption.status} />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

async function fetchPartnersData() {
  const response = await fetch('/api/admin/partners', {
    cache: 'no-store',
  });
  const payload = (await response.json()) as PartnersResponse | { error?: string };

  if (!response.ok) {
    throw new Error('error' in payload && payload.error ? payload.error : 'Não foi possível carregar parceiros.');
  }

  return payload as PartnersResponse;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof TicketPercent; label: string; value: string }) {
  return (
    <article className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <span className="rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
          <Icon size={17} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </article>
  );
}

function TableLoading({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm font-bold text-zinc-500">
        Carregando dados...
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const variant =
    normalizedStatus === 'active'
      ? 'success'
      : normalizedStatus === 'trialing'
        ? 'info'
        : normalizedStatus === 'past_due'
          ? 'warning'
          : normalizedStatus === 'canceled'
            ? 'danger'
            : 'muted';

  return <Badge variant={variant}>{status}</Badge>;
}

function formatMoney(cents: number, currency = 'brl') {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDate(value: string | null) {
  if (!value) return 'Nunca';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
