'use client';

import Link from 'next/link';
import React from 'react';
import { Crown, LockKeyhole } from 'lucide-react';
import { ProUpgradeModal } from '@/components/ProUpgradeModal';
import { Badge } from '@/components/ui/Badge';

export function ProGate({
  title = 'Recurso PRO',
  description = 'Recurso disponível no plano PRO.',
  ctaLabel = 'Ver plano PRO',
  variant = 'card',
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  variant?: 'inline' | 'card' | 'modal';
}) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  if (variant === 'inline') {
    return (
      <>
        <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-brand-primary/25 bg-brand-primary/10 px-2.5 py-1.5 text-xs font-bold text-brand-primary">
          <Crown size={13} />
          <span>PRO</span>
          <span className="text-zinc-300">{description}</span>
          <Link href="/pro" className="rounded bg-brand-primary px-2 py-1 text-[11px] font-black text-bg-dark">
            {ctaLabel}
          </Link>
        </div>
      </>
    );
  }

  if (variant === 'modal') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-brand-primary/25 bg-brand-primary/10 px-3 text-xs font-black text-brand-primary transition-colors hover:border-brand-primary/50"
        >
          <Crown size={14} />
          {description}
        </button>
        <ProUpgradeModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-4 shadow-xl">
      <Badge variant="primary" className="gap-2">
        <Crown size={13} />
        PRO
      </Badge>
      <div className="mt-3 flex items-start gap-3">
        <div className="rounded-md border border-brand-primary/25 bg-zinc-950/70 p-2 text-brand-primary">
          <LockKeyhole size={18} />
        </div>
        <div>
          <h2 className="font-black text-white">{title}</h2>
          <p className="mt-1 text-sm text-zinc-300">{description}</p>
          <Link
            href="/pro"
            className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-brand-primary px-3 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
