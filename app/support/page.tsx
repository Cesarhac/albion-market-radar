import { ArrowRight, Bug, LifeBuoy, Lightbulb, Mail, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { APP_NAME } from '@/lib/branding';

const supportEmail = 'cesar018_@outlook.com';
const suggestionMailto = `mailto:cesar018_@outlook.com?subject=${encodeURIComponent(`Sugestão - ${APP_NAME}`)}`;

const supportOptions = [
  {
    title: 'Sugestões de melhoria',
    description: 'Envie ideias para novos filtros, telas, relatórios ou ajustes no fluxo de trader.',
    icon: Lightbulb,
  },
  {
    title: 'Reportar bugs',
    description: 'Conte o que aconteceu, qual página estava aberta e quais filtros ou ações você usou.',
    icon: Bug,
  },
  {
    title: 'Dúvidas e suporte',
    description: 'Peça ajuda sobre assinatura, uso do radar, alertas, regear ou leitura dos resultados.',
    icon: MessageSquare,
  },
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-brand-primary/25 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_34%),linear-gradient(135deg,#18181b_0%,#09090b_78%)] p-5 shadow-2xl md:p-7">
        <Badge variant="primary" className="gap-2">
          <LifeBuoy size={13} />
          Suporte
        </Badge>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">Sugestões e Suporte</h1>
        <p className="mt-3 max-w-3xl text-base font-bold leading-relaxed text-zinc-200">
          Sugestões, bugs e dúvidas podem ser enviados por e-mail para o {APP_NAME}.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
          Use o endereço abaixo para compartilhar melhorias, pedir ajuda ou avisar sobre algo que não funcionou como esperado.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {supportOptions.map((option) => (
          <article key={option.title} className="rounded-lg border border-border-subtle bg-bg-card p-4 shadow-xl">
            <div className="mb-3 inline-flex rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
              <option.icon size={19} />
            </div>
            <h2 className="font-black text-white">{option.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{option.description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-border-subtle bg-bg-card p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">E-mail de suporte</p>
            <p className="mt-2 font-mono text-lg font-black text-white">{supportEmail}</p>
          </div>
          <a href={suggestionMailto} className="primary-button justify-center">
            <Mail size={16} />
            Enviar sugestão por e-mail
            <ArrowRight size={16} />
          </a>
        </div>
      </section>
    </div>
  );
}
