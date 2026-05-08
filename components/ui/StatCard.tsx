import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  description?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, description, className, compact = false }: StatCardProps) {
  return (
    <article
      className={cn(
        'rounded-lg border border-border-subtle bg-bg-card shadow-[0_16px_45px_rgba(0,0,0,0.22)] transition-colors hover:border-brand-primary/35',
        compact ? 'p-3' : 'p-5',
        className,
      )}
    >
      <div className={cn('flex items-start justify-between gap-4', compact ? 'mb-2' : 'mb-4')}>
        <div className={cn('rounded-md border border-brand-primary/20 bg-brand-primary/10 text-brand-primary', compact ? 'p-1.5' : 'p-2')}>
          <Icon size={compact ? 17 : 20} />
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
      <p className={cn('font-medium text-zinc-400', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      <h3 className={cn('mt-1 font-black tracking-tight text-white', compact ? 'text-xl' : 'text-2xl')}>{value}</h3>
      {description && !compact ? <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p> : null}
    </article>
  );
}
