import { Award, BarChart3, Crown, Hourglass, Medal, Target, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

const futureFeatures = [
  {
    title: 'Ranking de traders',
    description: 'Classificação por lucro líquido, volume negociado e consistência de rotas.',
    icon: Trophy,
  },
  {
    title: 'Desafios semanais',
    description: 'Metas de flip e transporte por cidade, item ou faixa de tier.',
    icon: Target,
  },
  {
    title: 'Torneios de flip',
    description: 'Eventos de tempo limitado para comparar desempenho entre jogadores.',
    icon: Zap,
  },
  {
    title: 'Histórico de pontuação',
    description: 'Evolução de performance, sequências e resultados por temporada.',
    icon: BarChart3,
  },
  {
    title: 'Premiações',
    description: 'Recompensas futuras para rankings, torneios e desafios especiais.',
    icon: Award,
  },
];

export default function CompetitionPage() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-border-subtle bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b,#09090b)] p-6 shadow-2xl md:p-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-lg border border-brand-primary/25 bg-brand-primary/10 text-brand-primary shadow-[0_0_36px_rgba(250,204,21,0.16)]">
            <Trophy size={40} />
          </div>
          <Badge variant="primary" className="mt-6 gap-2">
            <Hourglass size={13} />
            Em desenvolvimento
          </Badge>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white md:text-5xl">Competição</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-300">
            Área futura para rankings, desafios, torneios e comparação de desempenho entre jogadores.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {futureFeatures.map((feature) => (
          <article
            key={feature.title}
            className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-2xl transition-colors hover:border-brand-primary/35"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-border-subtle bg-zinc-950 text-brand-primary">
              <feature.icon size={21} />
            </div>
            <h2 className="font-black text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-brand-primary">
            <Crown size={20} />
            Selo de temporada
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Quando a competição for ativada, o radar poderá transformar dados de mercado em
            pontuação transparente para traders, transportadores e flippers.
          </p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <Medal className="text-brand-primary" size={20} />
            Escopo planejado
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['Lucro validado', 'Rotas auditáveis', 'Temporadas'].map((item) => (
              <div key={item} className="rounded-lg bg-zinc-950 p-4 text-sm font-bold text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
