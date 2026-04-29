'use client';

import React from 'react';
import { Bell, CheckCircle2, Crown, Download, FileText, ShieldCheck, Star, Sword, Wallet, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

const freeFeatures = [
  'Buscar preços',
  'Oportunidades básicas',
  '10 favoritos',
  '50 operações na carteira',
  '3 anúncios de Armas .4',
];

const proFeatures = [
  'Filtros avançados',
  'Favoritos ilimitados',
  'Carteira ilimitada',
  'Alertas de preço',
  'Exportar CSV',
  '20 anúncios de Armas .4',
  'Relatórios',
  'Regear salvo',
];

const proCards = [
  { title: 'Alertas de preço', description: 'Monitorar itens e receber avisos quando chegarem no alvo.', icon: Bell },
  { title: 'Exportar CSV', description: 'Levar carteira, favoritos e relatórios para planilhas.', icon: Download },
  { title: 'Relatórios', description: 'Entender lucro, estoque parado e melhores rotas com mais contexto.', icon: FileText },
  { title: 'Armas .4', description: 'Mais anúncios ativos para jogadores que vendem armas .4 e despertadas.', icon: Sword },
];

export default function ProPage() {
  const { user } = useAuth();
  const isPro = user?.plan === 'pro';

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-brand-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.14),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-6 shadow-2xl md:p-8">
        <Badge variant="primary" className="gap-2">
          <Crown size={13} />
          PRO em breve
        </Badge>
        <h1 className="mt-4 text-3xl font-black text-white md:text-5xl">Plano PRO</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
          Recursos avançados para traders que querem ganhar tempo e encontrar oportunidades melhores.
        </p>
        {isPro ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-status-success/25 bg-status-success/10 px-4 py-3 text-sm font-black text-status-success">
            <CheckCircle2 size={17} />
            Você está no plano PRO
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PlanCard title="Free" badge="Atual" features={freeFeatures} />
        <PlanCard title="Pro" badge="Em breve" features={proFeatures} highlighted />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {proCards.map((feature) => (
          <article key={feature.title} className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl">
            <div className="mb-4 inline-flex rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
              <feature.icon size={20} />
            </div>
            <h2 className="font-black text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-status-success/20 bg-status-success/10 p-5">
        <h2 className="flex items-center gap-2 font-black text-status-success">
          <ShieldCheck size={18} />
          PRO em breve, sem checkout agora
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
          Não há pagamento, Stripe ou cobrança nesta etapa. O Albion Market Radar não vende prata, itens por dinheiro real ou contas.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-black text-bg-dark opacity-70"
        >
          PRO em breve
        </button>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  badge,
  features,
  highlighted,
}: {
  title: string;
  badge: string;
  features: string[];
  highlighted?: boolean;
}) {
  const Icon = title === 'Pro' ? Zap : Wallet;

  return (
    <article
      className={`rounded-lg border p-5 shadow-2xl ${
        highlighted ? 'border-brand-primary/30 bg-brand-primary/10' : 'border-border-subtle bg-bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-white">
            <Icon className="text-brand-primary" size={22} />
            {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">{highlighted ? 'Mais automação e limites maiores.' : 'Ferramentas essenciais para começar.'}</p>
        </div>
        <Badge variant={highlighted ? 'primary' : 'outline'}>{badge}</Badge>
      </div>
      <div className="mt-5 grid gap-2">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-zinc-950 px-3 py-3 text-sm font-bold text-zinc-300">
            {feature.includes('favoritos') ? <Star size={15} className="text-brand-primary" /> : <CheckCircle2 size={15} className="text-status-success" />}
            {feature}
          </div>
        ))}
      </div>
    </article>
  );
}
