'use client';

import Link from 'next/link';
import { CheckCircle2, Crown, X } from 'lucide-react';

const benefits = [
  'Filtros avançados',
  'Exportação CSV',
  'Alertas de preço',
  'Carteira ilimitada',
  'Relatórios de lucro',
];

export function ProUpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-upgrade-title"
        className="w-full max-w-md rounded-lg border border-brand-primary/30 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle p-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-black text-brand-primary">
              <Crown size={13} />
              PRO
            </div>
            <h2 id="pro-upgrade-title" className="mt-3 text-2xl font-black text-white">
              Esse recurso é PRO
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Desbloqueie filtros avançados, exportação CSV, alertas e relatórios para analisar o mercado mais rápido.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-button"
            aria-label="Fechar modal PRO"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-card px-3 py-2 text-sm font-bold text-zinc-200">
                <CheckCircle2 size={15} className="text-status-success" />
                {benefit}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button justify-center"
            >
              Agora não
            </button>
            <Link
              href="/pro"
              onClick={onClose}
              className="primary-button justify-center"
            >
              Ver plano PRO
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
