import Link from 'next/link';
import { Crown, LockKeyhole } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function ProGate({
  title = 'Recurso PRO',
  description = 'Este recurso será liberado no plano PRO.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-brand-primary/25 bg-brand-primary/10 p-5 shadow-2xl">
      <Badge variant="primary" className="gap-2">
        <Crown size={13} />
        PRO
      </Badge>
      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-md border border-brand-primary/25 bg-zinc-950/70 p-2 text-brand-primary">
          <LockKeyhole size={20} />
        </div>
        <div>
          <h2 className="font-black text-white">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">{description}</p>
          <Link
            href="/pro"
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-brand-primary px-4 text-sm font-black text-bg-dark transition-colors hover:bg-brand-secondary"
          >
            Ver plano PRO
          </Link>
        </div>
      </div>
    </div>
  );
}
