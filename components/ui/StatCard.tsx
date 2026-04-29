import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, description, className }: StatCardProps) {
  return (
    <article
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-card p-5 shadow-[0_16px_45px_rgba(0,0,0,0.22)] transition-colors hover:border-brand-primary/35',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="rounded-md border border-brand-primary/20 bg-brand-primary/10 p-2 text-brand-primary">
          <Icon size={20} />
        </div>
        {trend ? (
          <span
            className={cn(
              'rounded-md px-2 py-1 text-xs font-bold',
              trend.isPositive
                ? 'bg-status-success/10 text-status-success'
                : 'bg-status-danger/10 text-status-danger',
            )}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <h3 className="mt-1 text-2xl font-black tracking-tight text-white">{value}</h3>
      {description ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p> : null}
    </article>
  );
}
