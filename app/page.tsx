'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  BarChart3,
  Bell,
  Clock3,
  Coins,
  MapPin,
  PackageSearch,
  Radar,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { Badge } from '@/components/ui/Badge';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { StatCard } from '@/components/ui/StatCard';
import { ENCHANTMENTS, MARKET_SERVER_REGIONS, TIERS } from '@/data/constants';
import { mockOpportunities } from '@/data/mockOpportunities';
import type { Enchantment, ServerRegion, Tier } from '@/types/albion';
import {
  cn,
  formatCityName,
  formatDateTime,
  formatEnchantment,
  formatPercent,
  formatServerName,
  formatSilver,
  riskLabel,
} from '@/lib/utils';

const chartBars = [38, 44, 41, 57, 52, 69, 73, 66, 82, 78, 91, 86];

export default function PainelPage() {
  const router = useRouter();
  const [server, setServer] = React.useState<ServerRegion>('Americas');
  const [tier, setTier] = React.useState<Tier>(4);
  const [enchantment, setEnchantment] = React.useState<Enchantment>(0);

  const serverOpportunities = mockOpportunities.filter((opportunity) => opportunity.server === server);
  const fallbackOpportunity = mockOpportunities[0]!;
  const activeOpportunities = serverOpportunities.length > 0 ? serverOpportunities : [fallbackOpportunity];
  const visibleOpportunities = activeOpportunities.slice(0, 5);
  const bestOpportunity = [...activeOpportunities].sort((a, b) => b.margin - a.margin)[0] ?? fallbackOpportunity;
  const highestProfit = [...activeOpportunities].sort((a, b) => b.netProfit - a.netProfit)[0] ?? bestOpportunity;
  const cheapestRoute = [...activeOpportunities].sort((a, b) => a.buyPrice - b.buyPrice)[0] ?? bestOpportunity;
  const mostExpensiveRoute = [...activeOpportunities].sort((a, b) => b.sellPrice - a.sellPrice)[0] ?? bestOpportunity;
  const latestUpdate = [...activeOpportunities].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0] ?? bestOpportunity;

  const handleSearch = (query: string) => {
    const params = new URLSearchParams({
      item: query,
      server,
    });

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_72%)] p-5 shadow-2xl md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="primary" className="gap-2">
              <Radar size={13} />
              Radar de mercado para Albion Online
            </Badge>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white md:text-6xl">
                Albion Market Radar
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-300 md:text-lg">
                O radar BR para buscar preços, encontrar oportunidades e montar seu regear gastando menos.
              </p>
              <p className="max-w-2xl text-sm leading-relaxed text-zinc-500 md:text-base">
                Escolha seu servidor, consulte preços por cidade e descubra onde comprar, vender e montar sets com mais economia.
              </p>
            </div>

            <SearchBar onSearch={handleSearch} />

            <Link
              href="/regear"
              className="group flex flex-col gap-4 rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 transition-colors hover:border-brand-primary/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-start gap-3">
                <span className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary">
                  <PackageSearch size={22} />
                </span>
                <span>
                  <span className="block font-black text-white">Radar de Regear</span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                    Monte um set completo e descubra onde comprar cada peça pelo menor preço no servidor escolhido.
                  </span>
                </span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-black text-brand-primary">
                Montar set <ArrowRight className="transition-transform group-hover:translate-x-1" size={16} />
              </span>
            </Link>

            <Link
              href="/trader"
              className="group flex flex-col gap-4 rounded-lg border border-status-success/20 bg-status-success/10 p-4 transition-colors hover:border-status-success/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-start gap-3">
                <span className="rounded-lg bg-status-success/10 p-2 text-status-success">
                  <Wallet size={22} />
                </span>
                <span>
                  <span className="block font-black text-white">Carteira do Trader</span>
                  <span className="mt-1 block text-sm leading-relaxed text-zinc-400">
                    Registre compras e vendas em segundos e acompanhe se seus flips realmente deram lucro.
                  </span>
                </span>
              </span>
              <span className="inline-flex items-center gap-2 text-sm font-black text-status-success">
                Abrir carteira <ArrowRight className="transition-transform group-hover:translate-x-1" size={16} />
              </span>
            </Link>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Servidor</span>
                <select
                  value={server}
                  onChange={(event) => setServer(event.target.value as ServerRegion)}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
                >
                  {MARKET_SERVER_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {formatServerName(region)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Tier</span>
                <select
                  value={tier}
                  onChange={(event) => setTier(Number(event.target.value) as Tier)}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
                >
                  {TIERS.map((value) => (
                    <option key={value} value={value}>
                      T{value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Encantamento</span>
                <select
                  value={enchantment}
                  onChange={(event) => setEnchantment(Number(event.target.value) as Enchantment)}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-zinc-950 px-3 text-sm font-bold text-white outline-none focus:border-brand-primary"
                >
                  {ENCHANTMENTS.map((value) => (
                    <option key={value} value={value}>
                      {formatEnchantment(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-brand-primary/20 bg-zinc-950/70 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Melhor oportunidade atual
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">{bestOpportunity.itemName}</h2>
              </div>
              <div className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary">
                <Zap size={22} />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-bg-dark/80 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Comprar em</p>
                <p className="font-black text-white">{formatCityName(bestOpportunity.buyCity)}</p>
                <p className="text-xs text-zinc-500">{formatSilver(bestOpportunity.buyPrice)}</p>
              </div>
              <ArrowRight className="text-brand-primary" size={20} />
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Vender em</p>
                <p className="font-black text-white">{formatCityName(bestOpportunity.sellCity)}</p>
                <p className="text-xs text-zinc-500">{formatSilver(bestOpportunity.sellPrice)}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-status-success/20 bg-status-success/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-status-success/80">
                  Lucro líquido
                </p>
                <p className="mt-1 text-xl font-black text-status-success">
                  {formatSilver(bestOpportunity.netProfit)}
                </p>
              </div>
              <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-primary/80">Margem</p>
                <p className="mt-1 text-xl font-black text-brand-primary">
                  {formatPercent(bestOpportunity.margin)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Melhor oportunidade"
          value={formatSilver(bestOpportunity.netProfit)}
          icon={TrendingUp}
          trend={{ value: formatPercent(bestOpportunity.margin), isPositive: true }}
          description={`${formatCityName(bestOpportunity.buyCity)} para ${formatCityName(bestOpportunity.sellCity)}`}
        />
        <StatCard
          title="Maior lucro líquido"
          value={formatSilver(highestProfit.netProfit)}
          icon={Coins}
          description={highestProfit.itemName}
        />
        <StatCard
          title="Cidade mais barata"
          value={formatCityName(cheapestRoute.buyCity)}
          icon={ArrowDownCircle}
          description={`${cheapestRoute.itemName}: ${formatSilver(cheapestRoute.buyPrice)}`}
        />
        <StatCard
          title="Cidade mais cara"
          value={formatCityName(mostExpensiveRoute.sellCity)}
          icon={ArrowUpCircle}
          description={`${mostExpensiveRoute.itemName}: ${formatSilver(mostExpensiveRoute.sellPrice)}`}
        />
        <StatCard
          title="Dados atualizados recentemente"
          value={<RelativeTime date={latestUpdate.updatedAt} />}
          icon={Clock3}
          description={formatDateTime(latestUpdate.updatedAt)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="rounded-lg border border-border-subtle bg-bg-card shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-border-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <Zap className="text-brand-primary" size={20} />
                Oportunidades recentes
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Rotas de arbitragem com lucro bruto, taxa estimada, lucro líquido e risco.
              </p>
            </div>
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-brand-primary/40"
            >
              Ver todas <ArrowRight size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-subtle bg-zinc-950/65">
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Item</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cidade de compra</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Cidade de venda</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Lucro líquido</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Margem</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Risco</th>
                  <th className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/70">
                {visibleOpportunities.map((opportunity) => (
                  <tr key={opportunity.id} className="transition-colors hover:bg-zinc-900/60">
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">{opportunity.itemName}</p>
                      <p className="mt-1 font-mono text-[11px] text-zinc-500">{opportunity.itemId}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">
                      {formatCityName(opportunity.buyCity)}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-300">
                      {formatCityName(opportunity.sellCity)}
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-status-success">
                      {formatSilver(opportunity.netProfit)}
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-brand-primary">
                      {formatPercent(opportunity.margin)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          opportunity.risk === 'low'
                            ? 'success'
                            : opportunity.risk === 'medium'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {riskLabel(opportunity.risk)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500">
                      <RelativeTime date={opportunity.updatedAt} prefix="Atualizado" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <BarChart3 className="text-brand-primary" size={20} />
                  Histórico de preço
                </h2>
                <p className="mt-1 text-sm text-zinc-500">Visual demonstrativo para evolução de preço por cidade.</p>
              </div>
              <Badge variant="muted">Demonstração</Badge>
            </div>

            <div className="flex h-52 items-end gap-2 rounded-lg border border-border-subtle bg-zinc-950 p-4">
              {chartBars.map((height, index) => (
                <div key={`${height}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className={cn(
                      'w-full rounded-t-md border border-brand-primary/20 bg-gradient-to-t from-brand-primary/25 to-brand-primary',
                      index > 8 && 'from-status-success/25 to-status-success',
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] font-bold text-zinc-700">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <h3 className="flex items-center gap-2 font-black text-white">
              <ShieldAlert className="text-status-warning" size={18} />
              Como ler o radar
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-400">
              <p>
                O foco é simples: comprar onde o menor preço de venda está baixo e vender onde a
                maior ordem de compra sustenta margem após taxas.
              </p>
              <p>
                Rotas para Mercado Negro e Caerleon podem pagar melhor, mas o risco de transporte
                precisa entrar na decisão.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5">
            <h3 className="flex items-center gap-2 font-black text-brand-primary">
              <Bell size={18} />
              Recursos PRO ativos
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Filtros avançados, CSV, alertas internos, builds salvas, relatórios e interface compacta.
            </p>
          </div>

          <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
            <h3 className="flex items-center gap-2 font-black text-white">
              <MapPin size={18} className="text-brand-primary" />
              Filtros rápidos ativos
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="rounded-md bg-zinc-950/70 p-2 text-white">{formatServerName(server)}</div>
              <div className="rounded-md bg-zinc-950/70 p-2 text-white">T{tier}</div>
              <div className="rounded-md bg-zinc-950/70 p-2 text-white">{formatEnchantment(enchantment)}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
